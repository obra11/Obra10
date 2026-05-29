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

const AI_MODEL = 'claude-sonnet-4-20250514';
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
          (sum: number, p: any) => sum + Number(p.quantidade || 0),
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
        profissionais: (d.profissionais || []).map(
          (p: any) => `${p.nome}: ${p.quantidade}`,
        ),
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

    // 5. Stub se Anthropic não configurado
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !Anthropic) {
      const mockResult = {
        ...baseData,
        resumoExecutivo: `[MOCK] Período: ${dataInicio} a ${dataFim}. Análise de ${totalDias} diários de obras com foco nos serviços e clima registrados.`,
        gargalos: [
          '[MOCK] Chuva frequente prejudicou a concretagem',
          '[MOCK] Falha de maquinário no 3º dia',
        ],
        recomendacoes: [
          '[MOCK] Melhor planejar materiais para semana chuvosa',
          '[MOCK] Realizar preventiva nos equipamentos locados',
        ],
        lembretes: [
          '[MOCK] Acompanhar a liberação da fôrma do 2º pavimento',
          '[MOCK] Cobrar entrega do fornecedor de impermeabilizante',
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
        modelo: 'MOCK',
        cached: false,
      };

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
    const prompt = `Você é um assistente especializado em gestão de obras de construção civil.

Analise as atividades, pendências, gargalos e observações de ${totalDias} Relatórios Diários de Obra do período ${dataInicio} a ${dataFim}.
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
        
        // Extração robusta do objeto JSON usando regex
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanJsonStr = jsonMatch ? jsonMatch[0] : '{}';

        conteudo = JSON.parse(cleanJsonStr);
        // Fazer merge dos dados base com a IA
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
      throw err;
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

    this.activeQueries.add(obraId);

    try {
      const inicio = new Date(dataInicio);
      const fim = new Date(dataFim);

      if (inicio > fim) {
        throw new BadRequestException('dataInicio deve ser anterior a dataFim.');
      }

      // Buscar RDOs aprovados do período
      const rdos = await this.prisma.rdo.findMany({
        where: {
          obraId,
          status: 'APROVADO' as any,
          dataReferencia: { gte: inicio, lte: fim },
          deletedAt: null,
        },
        orderBy: { dataReferencia: 'asc' },
      });

      if (rdos.length === 0) {
        throw new BadRequestException(
          'Nenhum RDO aprovado encontrado no período informado.',
        );
      }

      const resumoRdosParaIA = rdos.map((r) => {
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
          profissionais: (d.profissionais || []).map(
            (p: any) => `${p.nome}: ${p.quantidade}`,
          ),
          observacoes: d.observacoes || '',
        };
      });

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey || !Anthropic) {
        return {
          resposta: `[MOCK] Resposta para a pergunta "${pergunta}" com base nos diários do período de ${dataInicio} a ${dataFim}. (Modo MOCK ativo: ANTHROPIC_API_KEY não configurada)`,
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
      throw err;
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
}
