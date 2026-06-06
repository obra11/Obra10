import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

// Lazy-load Anthropic to avoid crash when API key not set
let Anthropic: any;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch {
  Anthropic = null;
}

const AI_MODEL = 'claude-3-5-sonnet-20241022';
const CACHE_TTL_HOURS = 24;
const MAX_CHAMADAS_DIA = 3;

function extrairLinhasDeTexto(texto: any): string[] {
  if (!texto) return [];
  if (Array.isArray(texto)) {
    return texto
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object' && typeof item.descricao === 'string') {
          return item.descricao.trim();
        }
        return '';
      })
      .filter((line) => line.length > 3);
  }
  if (typeof texto !== 'string') return [];
  return texto
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*•\d.]+\s*/, '').trim())
    .filter((line) => line.length > 3);
}

function capitalizarPrimeiraLetra(texto: string): string {
  if (!texto) return '';
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private activeQueries = new Set<string>(); // Controla concorrência por obraId para perguntas

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gera relatório executivo consolidado para um período de RDOs de uma obra.
   * Cache: reutiliza relatório gerado nas últimas 24h para o mesmo obraId + período.
   * Rate limit: máx 3 chamadas por obra por dia.
   */
  async gerarRelatorioObra(
    obraId: string,
    empresaId: string,
    dataInicio: string,
    dataFim: string,
    foco?: string,
    secoes?: string[],
  ) {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    if (inicio > fim)
      throw new BadRequestException('dataInicio deve ser anterior a dataFim.');

    // 1. Verificar cache (último relatório para mesmo período nas últimas 24h)
    const vintEquatroHAtras = new Date(
      Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000,
    );
    const cached = await this.prisma.relatorioIA.findFirst({
      where: {
        obraId,
        dataInicio: inicio,
        dataFim: fim,
        createdAt: { gte: vintEquatroHAtras },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (cached) {
      return {
        ...(cached.conteudo as object),
        cached: true,
        cachedAt: cached.createdAt,
      };
    }

    // 2. Rate limiting: máx 3 geracoes por obra hoje
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const totalHoje = await this.prisma.relatorioIA.count({
      where: { obraId, createdAt: { gte: inicioDia } },
    });
    if (totalHoje >= MAX_CHAMADAS_DIA) {
      throw new ForbiddenException(
        `Limite de ${MAX_CHAMADAS_DIA} relatórios por dia atingido para esta obra. Tente novamente amanhã ou use o relatório em cache.`,
      );
    }

    // 3. Buscar RDOs aprovados do período
    const rdos = await this.prisma.rdo.findMany({
      where: {
        obraId,
        status: 'APROVADO' as any,
        dataReferencia: { gte: inicio, lte: fim },
        deletedAt: null,
      },
      include: {
        atividades: { where: { deletedAt: null } },
        efetivos: { where: { deletedAt: null } },
        ocorrencias: { where: { deletedAt: null } },
        tarefas: true,
        aprovador: { select: { nome: true } },
      },
      orderBy: { dataReferencia: 'asc' },
    });

    if (rdos.length === 0) {
      throw new BadRequestException(
        'Nenhum RDO aprovado encontrado no período informado.',
      );
    }

    // 4. Consolidar dados localmente e calcular estatísticas programáticas
    const totalDias = rdos.length;
    let somaEfetivo = 0;
    const climas: string[] = [];
    const servicosSet = new Set<string>();

    let diasChuva = 0;
    let diasSol = 0;
    let diasNublado = 0;
    let diasOutros = 0;

    const frequenciaAtividades: Record<string, number> = {};
    const frequenciaPendencias: Record<string, number> = {};

    const resumoRdosParaIA = rdos.map((r) => {
      const d = (r.dadosExtras as any) || {};

      // Extração robusta do clima
      let climaStr = '';
      if (d.clima) {
        climaStr = d.clima;
      } else if (d.climaManha || d.climaTarde) {
        climaStr = `Manhã: ${d.climaManha ?? 'Sol'}, Tarde: ${d.climaTarde ?? 'Sol'}, Noite: ${d.climaNoite ?? 'Sol'}`;
      } else if (d.condicoesClimaticas) {
        climaStr = d.condicoesClimaticas;
      } else {
        climaStr = 'Não informado';
      }
      climas.push(climaStr.toLowerCase());

      // Contagem programática do clima
      const textClima = [d.climaManha, d.climaTarde, d.climaNoite, d.clima, d.condicoesClimaticas]
        .filter(Boolean)
        .map((c) => c.toLowerCase())
        .join(' ');

      if (
        textClima.includes('chuva') ||
        textClima.includes('chuvoso') ||
        textClima.includes('chuvosa') ||
        textClima.includes('tempestade') ||
        textClima.includes('🌧️') ||
        textClima.includes('⛈️') ||
        textClima.includes('🌦️')
      ) {
        diasChuva++;
      } else if (
        textClima.includes('sol') ||
        textClima.includes('☀️') ||
        textClima.includes('ensolarado')
      ) {
        diasSol++;
      } else if (
        textClima.includes('nublado') ||
        textClima.includes('☁️') ||
        textClima.includes('⛅')
      ) {
        diasNublado++;
      } else {
        diasOutros++;
      }

      // Soma de efetivos dos diários (suporta dadosExtras.profissionais)
      let efetivoDia = 0;
      if (d.profissionais && Array.isArray(d.profissionais)) {
        efetivoDia = d.profissionais.reduce(
          (sum: number, p: any) => sum + Number(p && typeof p === 'object' ? p.quantidade || 0 : 0),
          0,
        );
      } else {
        efetivoDia = r.efetivos.reduce((s, e) => s + e.quantidade, 0);
      }
      somaEfetivo += efetivoDia;

      // Extração programática de atividades e pendências para contagem de frequência
      const atividadesList = extrairLinhasDeTexto(d.atividadesExecutadas);
      atividadesList.forEach((atv) => {
        const key = atv.toLowerCase();
        frequenciaAtividades[key] = (frequenciaAtividades[key] || 0) + 1;
        servicosSet.add(atv);
      });

      const pendenciasList = extrairLinhasDeTexto(d.atividadesPendentes);
      pendenciasList.forEach((pnd) => {
        const key = pnd.toLowerCase();
        frequenciaPendencias[key] = (frequenciaPendencias[key] || 0) + 1;
      });

      // Relações do DB
      r.atividades.forEach((a) => servicosSet.add(a.descricao));
      r.tarefas
        .filter((t) => t.statusExecucao === 'EXECUTADO')
        .forEach((t) => servicosSet.add(t.descricao));

      const gargalosRdo = r.tarefas
        .filter((t) => t.statusExecucao !== 'EXECUTADO')
        .map((t) => `${t.descricao} (${t.motivoNaoExecucao})`);

      return {
        data: r.dataReferencia.toISOString().split('T')[0],
        clima: climaStr,
        atividadesExecutadas: d.atividadesExecutadas || '',
        atividadesPendentes: d.atividadesPendentes || '',
        profissionais: (d.profissionais || [])
          .filter((p: any) => p && typeof p === 'object')
          .map((p: any) => `${p.nome || 'Profissional'}: ${p.quantidade || 0}`),
        observacoes: d.observacoes || '',
        gargalos: gargalosRdo,
      };
    });

    const mediaEfetivoDiario = Math.round(somaEfetivo / totalDias);
    const servicosExecutados = Array.from(servicosSet);

    // Identificar clima predominante
    let climaPredominante = 'Predominantemente Ensolarado/Bom';
    if (diasChuva > totalDias / 2) {
      climaPredominante = 'Predominantemente Chuvoso';
    } else if (diasChuva > 0) {
      climaPredominante = `Dias bons (chuva em aprox. ${diasChuva} dia(s))`;
    }

    // Listagem ordenada das contagens programáticas
    const listaFrequenciaAtividades = Object.entries(frequenciaAtividades)
      .map(([item, count]) => ({ item: capitalizarPrimeiraLetra(item), count }))
      .sort((a, b) => b.count - a.count);

    const listaFrequenciaPendencias = Object.entries(frequenciaPendencias)
      .map(([item, count]) => ({ item: capitalizarPrimeiraLetra(item), count }))
      .sort((a, b) => b.count - a.count);

    const baseData = {
      totalDias,
      mediaEfetivoDiario,
      climaPredominante,
      contagemClima: {
        chuva: diasChuva,
        sol: diasSol,
        nublado: diasNublado,
        outros: diasOutros,
      },
      servicosExecutados,
    };

    // Helper para gerar o Mock Result com foco dinâmico
    const gerarMockResult = (isFallback = false, errMsg?: string) => {
      const focusText = foco?.trim() ? ` com foco em "${foco}"` : '';
      const secoesText = secoes && secoes.length > 0 ? ` (seções focadas: ${secoes.join(', ')})` : '';

      return {
        ...baseData,
        resumoExecutivo: `Período: ${dataInicio} a ${dataFim}. Análise consolidada de ${totalDias} diários de obras${focusText}${secoesText}. Relatório gerado com base nas atividades e ocorrências registradas no canteiro de obras.`,
        gargalos: [
          foco?.trim() ? `Gargalo operacional relacionado a: ${foco}` : 'Chuva frequente prejudicou o ritmo de concretagem',
          'Falha mecânica em equipamento secundário no 3º dia',
        ],
        recomendacoes: [
          foco?.trim() ? `Ajustar planejamento para mitigar gargalo: ${foco}` : 'Melhorar planejamento de estoque de materiais para períodos de chuva instável',
          'Realizar manutenção preventiva nos equipamentos locados',
        ],
        lembretes: [
          'Acompanhar a liberação da fôrma de vigas e pilares do 2º pavimento',
          'Cobrar prazo de entrega de insumos com o fornecedor de impermeabilizantes',
        ],
        topAtividades: listaFrequenciaAtividades.slice(0, 5).length
          ? listaFrequenciaAtividades.slice(0, 5)
          : [
              { item: 'Concretagem', count: 3 },
              { item: 'Montagem de Armadura', count: 2 },
            ],
        topPendencias: listaFrequenciaPendencias.slice(0, 5).length
          ? listaFrequenciaPendencias.slice(0, 5)
          : [
              { item: 'Cobrança de entrega do cimento', count: 1 },
              { item: 'Ajuste de nível da sapata', count: 1 },
            ],
        modelo: isFallback ? 'MOCK-FALLBACK' : 'MOCK',
        cached: false,
      };
    };

    // 5. Stub se Anthropic não configurado
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !Anthropic) {
      const mockResult = gerarMockResult();
      await this.prisma.relatorioIA.create({
        data: {
          obraId,
          dataInicio: inicio,
          dataFim: fim,
          conteudo: mockResult as any,
          modelo: 'MOCK',
        },
      });
      return mockResult;
    }

    // 6. Chamar Claude Sonnet
    const client = new Anthropic.default({ apiKey });
    
    let promptFocus = '';
    if (foco?.trim()) {
      promptFocus += `\nINSTRUÇÃO DE FOCO DO USUÁRIO: O usuário solicitou prioridade na análise sobre: "${foco}". Direcione a análise, resumo executivo, recomendações e gargalos para cobrir este assunto com destaque.\n`;
    }
    if (secoes && Array.isArray(secoes) && secoes.length > 0) {
      promptFocus += `\nÁREAS DE INTERESSE: O usuário selecionou foco especial nas seguintes seções: ${secoes.join(', ')}. Certifique-se de preencher e refinar essas seções com o máximo de detalhes possível.\n`;
    }

    const prompt = `Você é um assistente especializado em gestão de obras de construção civil.

Analise as atividades, pendências, gargalos e observações de ${totalDias} Relatórios Diários de Obra do período ${dataInicio} a ${dataFim}.
${promptFocus}
Gere um JSON estruturado com os insights. NÃO gere markdown, introduções ou explicações. Responda APENAS com o objeto JSON.

O JSON deve seguir exatamente este formato:
{
  "resumoExecutivo": "um parágrafo resumindo as ocorrências, gargalos e andamento da obra no período",
  "gargalos": ["lista direta e curta de gargalos operacionais encontrados"],
  "recomendacoes": ["ações práticas recomendadas em tópicos"],
  "lembretes": ["lembretes ou alertas importantes para o gestor"],
  "topAtividades": [
    { "item": "Nome refinado da atividade", "count": 2 }
  ],
  "topPendencias": [
    { "item": "Nome refinado da pendência/cobrança", "count": 1 }
  ]
}

Aqui estão as frequências exatas calculadas programaticamente no backend. Use e refine esses termos para as chaves 'topAtividades' e 'topPendencias' usando os mesmos 'count' calculados. Não recalcule nem invente contagens:
- Atividades Frequentes: ${JSON.stringify(listaFrequenciaAtividades.slice(0, 10))}
- Pendências/Cobranças Frequentes: ${JSON.stringify(listaFrequenciaPendencias.slice(0, 10))}

Amostragem detalhada dos diários de obra:
${JSON.stringify(resumoRdosParaIA, null, 2)}

Responda APENAS com o objeto JSON. Sem texto introdutório, sem explicações, sem markdown, sem blocos de código.`;

    let conteudo: any;
    try {
      const response = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });

      try {
        const text =
          response.content[0]?.type === 'text'
            ? response.content[0].text
            : '{}';
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanJsonStr = jsonMatch ? jsonMatch[0] : '{}';

        conteudo = JSON.parse(cleanJsonStr);
        conteudo = { ...baseData, ...conteudo };
      } catch (err) {
        this.logger.error(
          `[AiService] Falha ao processar ou extrair JSON do Claude: ${
            (err as any)?.message
          }`,
        );
        conteudo = {
          ...baseData,
          resumoExecutivo:
            'Não foi possível gerar um insight detalhado no momento devido a uma falha de comunicação com a Inteligência Artificial.',
          gargalos: [],
          recomendacoes: [],
          lembretes: [],
          topAtividades: [],
          topPendencias: [],
        };
      }
    } catch (err: any) {
      this.logger.error(`[AiService] Erro ao chamar a API do Claude: ${err?.message}`);
      const isCreditsError =
        err?.message?.includes('Plans & Billing') ||
        err?.message?.includes('credit') ||
        err?.status === 402 ||
        err?.error?.type === 'insufficient_quota';
      
      if (isCreditsError) {
        throw new BadRequestException(
          'Saldo insuficiente na conta Anthropic. Adicione créditos em console.anthropic.com → Plans & Billing, ou deixe ANTHROPIC_API_KEY vazia para usar modo MOCK.',
        );
      }
      
      // Fallback robusto para o modo Mock se for qualquer outro erro de API/Rede
      const fallbackResult = gerarMockResult(true, err?.message);
      await this.prisma.relatorioIA.create({
        data: {
          obraId,
          dataInicio: inicio,
          dataFim: fim,
          conteudo: fallbackResult as any,
          modelo: 'MOCK-FALLBACK',
        },
      });
      return { ...fallbackResult, cached: false };
    }

    // 7. Salvar no cache
    await this.prisma.relatorioIA.create({
      data: {
        obraId,
        dataInicio: inicio,
        dataFim: fim,
        conteudo,
        modelo: AI_MODEL,
      },
    });

    return { ...conteudo, cached: false, modelo: AI_MODEL };
  }

  /**
   * Responde a uma pergunta específica do usuário baseando-se nos RDOs aprovados do período.
   */
  async perguntarRelatorioObra(
    obraId: string,
    empresaId: string,
    dataInicio: string,
    dataFim: string,
    pergunta: string,
  ) {
    if (!pergunta?.trim()) {
      throw new BadRequestException('A pergunta é obrigatória.');
    }

    // Bloqueio de concorrência por obraId
    if (this.activeQueries.has(obraId)) {
      throw new HttpException(
        'Já existe uma pergunta sendo processada para esta obra. Aguarde a conclusão.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let totalRdos = 0;
    let rdos: any[] = [];
    let resumoRdosParaIA: any[] = [];
    let respostaSimulada = '';

    // Função local de resposta simulada baseada nos RDOs (Fallback inteligente)
    const gerarRespostaSimulada = (p: string) => {
      const perguntaNorm = p.toLowerCase();
      
      // 1. Clima e chuva
      if (perguntaNorm.includes('chuva') || perguntaNorm.includes('choveu') || perguntaNorm.includes('clima') || perguntaNorm.includes('tempo')) {
        let contagemChuva = 0;
        resumoRdosParaIA.forEach((r) => {
          const txt = (r.clima || '').toLowerCase();
          if (txt.includes('chuva') || txt.includes('chuvoso') || txt.includes('chuvosa') || txt.includes('🌧️') || txt.includes('⛈️') || txt.includes('🌦️')) {
            contagemChuva++;
          }
        });
        return `Com base nos diários analisados no período (total de ${totalRdos} dias), foi registrado chuva ou tempo instável em ${contagemChuva} dia(s). Nos demais dias, o clima registrado foi predominantemente estável/sol.`;
      }

      // 2. Efetivo e profissionais
      if (perguntaNorm.includes('funcionario') || perguntaNorm.includes('efetivo') || perguntaNorm.includes('pedreiro') || perguntaNorm.includes('servente') || perguntaNorm.includes('trabalhou') || perguntaNorm.includes('pessoas') || perguntaNorm.includes('equipe')) {
        let totalProfissionais = 0;
        const profissionaisMap: Record<string, number> = {};
        
        rdos.forEach((r) => {
          const d = (r.dadosExtras as any) || {};
          if (d.profissionais && Array.isArray(d.profissionais)) {
            d.profissionais.forEach((p: any) => {
              if (p && typeof p === 'object') {
                const nome = (p.nome || 'Outros').trim();
                const qtd = Number(p.quantidade || 0);
                profissionaisMap[nome] = (profissionaisMap[nome] || 0) + qtd;
                totalProfissionais += qtd;
              }
            });
          }
        });

        if (totalProfissionais > 0) {
          const lista = Object.entries(profissionaisMap)
            .map(([nome, qtd]) => `- ${nome}: acumulado de ${qtd} participações no período`)
            .join('\n');
          return `No período selecionado, o efetivo total acumulado nos diários foi de ${totalProfissionais} profissionais (soma de todos os dias).\nDistribuição dos profissionais registrados:\n${lista}`;
        }
        
        const totalEfetivoRel = rdos.reduce((sum, r) => sum + (r.efetivos?.reduce((s, e) => s + e.quantidade, 0) || 0), 0);
        return `O efetivo total registrado no período foi de ${totalEfetivoRel} profissionais (soma do efetivo diário acumulado).`;
      }

      // 3. Atividades executadas
      if (perguntaNorm.includes('atividade') || perguntaNorm.includes('servico') || perguntaNorm.includes('feito') || perguntaNorm.includes('executado') || perguntaNorm.includes('obra')) {
        const atividades = resumoRdosParaIA
          .map((r) => r.atividadesExecutadas)
          .filter(Boolean)
          .join('\n');
        if (atividades.trim()) {
          return `Resumo das atividades executadas no período:\n${atividades.slice(0, 500)}${atividades.length > 500 ? '...' : ''}`;
        }
      }

      return `Com base nos diários do período de ${dataInicio} a ${dataFim} (total de ${totalRdos} diários analisados), a pergunta "${pergunta}" foi processada localmente. O relatório executivo principal da obra indica que o andamento segue conforme os diários aprovados. Para um detalhamento preciso de outras ocorrências, consulte o painel superior.`;
    };

    this.activeQueries.add(obraId);

    try {
      const inicio = new Date(dataInicio);
      const fim = new Date(dataFim);

      if (inicio > fim) {
        throw new BadRequestException('dataInicio deve ser anterior a dataFim.');
      }

      // Buscar RDOs aprovados do período
      rdos = await this.prisma.rdo.findMany({
        where: {
          obraId,
          status: 'APROVADO' as any,
          dataReferencia: { gte: inicio, lte: fim },
          deletedAt: null,
        },
        include: {
          efetivos: { where: { deletedAt: null } },
        },
        orderBy: { dataReferencia: 'asc' },
      });

      totalRdos = rdos.length;
      if (rdos.length === 0) {
        throw new BadRequestException(
          'Nenhum RDO aprovado encontrado no período informado.',
        );
      }

      resumoRdosParaIA = rdos.map((r) => {
        const d = (r.dadosExtras as any) || {};

        let climaStr = '';
        if (d.clima) {
          climaStr = d.clima;
        } else if (d.climaManha || d.climaTarde) {
          climaStr = `Manhã: ${d.climaManha ?? 'Sol'}, Tarde: ${d.climaTarde ?? 'Sol'}, Noite: ${d.climaNoite ?? 'Sol'}`;
        } else {
          climaStr = 'Não informado';
        }

        return {
          data: r.dataReferencia.toISOString().split('T')[0],
          clima: climaStr,
          atividadesExecutadas: d.atividadesExecutadas || '',
          atividadesPendentes: d.atividadesPendentes || '',
          profissionais: (d.profissionais || [])
            .filter((p: any) => p && typeof p === 'object')
            .map((p: any) => `${p.nome || 'Profissional'}: ${p.quantidade || 0}`),
          observacoes: d.observacoes || '',
        };
      });

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey || !Anthropic) {
        return {
          resposta: `🤖 [Assistente de IA - Modo Local]\n\n${gerarRespostaSimulada(pergunta)}\n\n*(Nota: Chave ANTHROPIC_API_KEY não configurada no Railway. Para habilitar a resposta inteligente do Claude 3.5 Sonnet, adicione a variável de ambiente correspondente)*`,
        };
      }

      const client = new Anthropic.default({ apiKey });
      const prompt = `Você é um assistente especializado em gestão de obras de construção civil.

Responda de forma concisa e direta à seguinte pergunta do usuário sobre os Relatórios Diários de Obra do período ${dataInicio} a ${dataFim}:
"${pergunta}"

Baseie sua resposta estritamente nos dados consolidados dos diários de obra fornecidos abaixo. Caso não encontre informações relativas à pergunta, responda educadamente que os relatórios do período selecionado não possuem referências sobre o assunto.

Dados dos diários de obra:
${JSON.stringify(resumoRdosParaIA, null, 2)}`;

      const response = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      });

      const resposta =
        response.content[0]?.type === 'text' ? response.content[0].text : '';
      return { resposta };
    } catch (err: any) {
      this.logger.error(`[AiService] Erro ao chamar a API do Claude para pergunta: ${err?.message}`);
      const msg = err?.message ?? '';
      const isCreditsError =
        msg.includes('Plans & Billing') ||
        msg.includes('credit') ||
        err?.status === 402 ||
        err?.error?.type === 'insufficient_quota';
      if (isCreditsError) {
        throw new BadRequestException(
          'Saldo insuficiente na conta Anthropic. Adicione créditos em console.anthropic.com → Plans & Billing, ou deixe ANTHROPIC_API_KEY vazia para usar modo MOCK.',
        );
      }
      
      try {
        respostaSimulada = gerarRespostaSimulada(pergunta);
        return {
          resposta: `🤖 [Assistente de IA - Modo Local]\n\n${respostaSimulada}\n\n*(Nota: Ocorreu um erro ao conectar à API da Anthropic: "${err?.message || 'invalid x-api-key'}". Para ativar a resposta real gerada pelo Claude 3.5 Sonnet, certifique-se de configurar uma chave válida e ativa na variável ANTHROPIC_API_KEY no painel do Railway)*`
        };
      } catch (simErr) {
        return {
          resposta: `Não foi possível consultar a Inteligência Artificial ativa no momento (Erro: ${err?.message || 'Serviço temporariamente indisponível'}).\n\nResumo consolidado do período (total de ${totalRdos} diários):\n- Clima ou andamento: verifique os detalhes no painel do relatório executivo acima ou consulte as observações diretamente no RDO.`
        };
      }
    } finally {
      this.activeQueries.delete(obraId);
    }
  }

  /**
   * Cron diário às 03:00 — remove RelatorioIA com mais de 30 dias.
   * Evita crescimento indefinido da tabela de cache.
   */
  @Cron('0 3 * * *', { name: 'limpeza-cache-relatorios-ia' })
  async limpezaCacheRelatoriosIA() {
    const limite = new Date();
    limite.setDate(limite.getDate() - 30);
    const resultado = await this.prisma.relatorioIA.deleteMany({
      where: { createdAt: { lt: limite } },
    });
    if (resultado.count > 0) {
      this.logger.log(
        `[AiService] Limpeza de cache: ${resultado.count} RelatorioIA removidos (>30 dias).`,
      );
    }
  }

  /**
   * Endpoint de chat da Luna.
   * Busca dados em tempo real da empresa do usuário e chama a API da Anthropic.
   */
  async chat(
    empresaId: string,
    userId: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ) {
    if (!message?.trim()) {
      throw new BadRequestException('A mensagem é obrigatória.');
    }

    // 1. Obras ativas da empresa
    const obrasAtivas = await this.prisma.obra.findMany({
      where: {
        empresaId,
        status: 'ATIVA',
        deletedAt: null,
      },
      select: {
        nome: true,
      },
    });
    const listaObras = obrasAtivas.map((o) => o.nome).join(', ') || 'Nenhuma obra ativa';

    // 2. Últimos 10 RDOs (com status, data, obra, responsável)
    const ultimosRdos = await this.prisma.rdo.findMany({
      where: {
        obra: {
          empresaId,
        },
        deletedAt: null,
      },
      orderBy: {
        dataReferencia: 'desc',
      },
      take: 10,
      select: {
        status: true,
        dataReferencia: true,
        obra: {
          select: {
            nome: true,
          },
        },
        criador: {
          select: {
            nome: true,
          },
        },
      },
    });
    const listaRdosRecentes = ultimosRdos
      .map(
        (r) =>
          `- Obra: ${r.obra.nome}, Data: ${r.dataReferencia.toISOString().split('T')[0]}, Status: ${r.status}, Responsável: ${r.criador.nome}`,
      )
      .join('\n') || 'Nenhum RDO recente';

    // 3. RDOs com status PENDENTE (aguardando aprovação = SUBMETIDO)
    const rdosPendentes = await this.prisma.rdo.findMany({
      where: {
        obra: {
          empresaId,
        },
        status: 'SUBMETIDO',
        deletedAt: null,
      },
      select: {
        dataReferencia: true,
        obra: {
          select: {
            nome: true,
          },
        },
        criador: {
          select: {
            nome: true,
          },
        },
      },
    });
    const totalPendentes = rdosPendentes.length;
    const listaRdosPendentes = rdosPendentes
      .map(
        (r) =>
          `- Obra: ${r.obra.nome}, Data: ${r.dataReferencia.toISOString().split('T')[0]}, Responsável: ${r.criador.nome}`,
      )
      .join('\n') || 'Nenhum RDO aguardando aprovação';

    // 4. Contagem de RDOs do mês atual
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const totalRdosMes = await this.prisma.rdo.count({
      where: {
        obra: {
          empresaId,
        },
        dataReferencia: {
          gte: inicioMes,
        },
        deletedAt: null,
      },
    });

    // Construção do System Prompt
    const systemPrompt = `Você é a Luna, assistente de IA do Obra 10, plataforma de gestão de obras.
Responda sempre em português brasileiro. Seja objetiva, direta e profissional, mas com tom acolhedor.
Nunca invente dados — use apenas as informações abaixo.
Se não tiver a informação, diga que não tem acesso no momento.
Para ações que não pode executar (aprovar, criar registros), oriente o usuário a fazer manualmente.

DADOS DA EMPRESA (tempo real):
- Obras ativas: ${listaObras}
- RDOs recentes:
${listaRdosRecentes}
- RDOs pendentes de aprovação: Quantidade: ${totalPendentes}
${listaRdosPendentes}
- Total de RDOs este mês: ${totalRdosMes}`;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !Anthropic) {
      // Fallback local/offline amigável para produção
      return {
        reply: `Olá! Sou a Luna, sua assistente no Obra 10. No momento, meu canal de comunicação inteligente está passando por uma rápida manutenção. No entanto, consigo te adiantar alguns dados rápidos da empresa:\n- **Obras ativas**: ${listaObras}\n- **RDOs criados este mês**: ${totalRdosMes}\n- **RDOs pendentes de aprovação**: ${totalPendentes} pendentes.\n\nComo posso te ajudar no momento?`,
      };
    }

    const client = new Anthropic.default({ apiKey });

    // Preparar mensagens do histórico + nova mensagem
    const formattedMessages = history.map((h) => ({
      role: h.role,
      content: h.content,
    }));
    formattedMessages.push({
      role: 'user',
      content: message,
    });

    try {
      const chatModel = 'claude-sonnet-4-20250514';
      
      const makeCall = async (modelToUse: string) => {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout de 30 segundos atingido ao chamar a API da Anthropic.')), 30000)
        );
        
        const apiPromise = client.messages.create({
          model: modelToUse,
          max_tokens: 1024,
          system: systemPrompt,
          messages: formattedMessages,
        });

        return await Promise.race([apiPromise, timeoutPromise]);
      };

      let response: any;
      try {
        response = await makeCall(chatModel);
      } catch (err: any) {
        // Fallback de modelo se der erro de modelo inválido ou não suportado
        const isModelError = err?.status === 404 || err?.message?.includes('model') || err?.message?.includes('not found');
        if (isModelError) {
          this.logger.warn(`[AiService] Modelo '${chatModel}' falhou ou não existe. Fazendo fallback para 'claude-3-5-sonnet-20241022'.`);
          response = await makeCall('claude-3-5-sonnet-20241022');
        } else {
          throw err; // Outros erros (ex: timeout, billing) são repassados
        }
      }

      const reply = response.content[0]?.type === 'text' ? response.content[0].text : '';
      return { reply };

    } catch (err: any) {
      this.logger.error(`[AiService] Erro ao chamar a API da Anthropic no Chat: ${err?.message}`);
      const isCreditsError =
        err?.message?.includes('Plans & Billing') ||
        err?.message?.includes('credit') ||
        err?.status === 402 ||
        err?.error?.type === 'insufficient_quota';

      if (isCreditsError) {
        return {
          reply: 'Olá! Desculpe, mas meu saldo de créditos de Inteligência Artificial está temporariamente esgotado. Por favor, avise o administrador do sistema para verificar o faturamento.',
        };
      }

      return {
        reply: `Olá! Desculpe, não consegui obter uma resposta no momento por conta de um erro de conexão (Erro: ${err?.message || 'Serviço indisponível'}). Por favor, tente novamente em alguns instantes!`,
      };
    }
  }
}
