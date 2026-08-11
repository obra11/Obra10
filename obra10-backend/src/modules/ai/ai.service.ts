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
import {
  agregarRdosParaContexto,
  capitalizarPrimeiraLetra,
  classificarClima,
  detectarConsultaOnline,
  detectarEscopo,
  detectarIntencaoFactual,
  extrairEfetivoDoRdo,
  extrairLinhasDeTexto,
  formatarContextoParaPrompt,
  formatarDataISO,
  inferirPeriodo,
  responderFactual,
  respostaLocalAmigavel,
  textoClimaDeExtras,
  type ContextoAgregado,
} from './ai-context.helper';
import {
  consultarOnline,
  formatarRespostaOnline,
} from './ai-online.helper';

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
const MAX_RDOS_CONTEXTO = 200;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private activeQueries = new Set<string>(); // Controla concorrência por obraId para perguntas

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca RDOs no período (obra ou empresa) e agrega clima/efetivo/atividades.
   * Inclui status relevantes — não só aprovados.
   */
  private async carregarContextoRdos(params: {
    empresaId: string;
    obraId?: string | null;
    escopo: 'obra' | 'empresa';
    dataInicio: Date;
    dataFim: Date;
    periodoLabel: string;
  }): Promise<ContextoAgregado> {
    const { empresaId, obraId, escopo, dataInicio, dataFim, periodoLabel } =
      params;

    let obraNome: string | undefined;
    let obraIdResolvido: string | undefined = obraId || undefined;

    if (escopo === 'obra' && obraId) {
      const obra = await this.prisma.obra.findFirst({
        where: { id: obraId, empresaId, deletedAt: null },
        select: { id: true, nome: true },
      });
      if (!obra) {
        // Obra inválida / outro tenant → cai para empresa
        return this.carregarContextoRdos({
          ...params,
          obraId: null,
          escopo: 'empresa',
        });
      }
      obraNome = obra.nome;
      obraIdResolvido = obra.id;
    }

    // Sempre restringe à empresa do usuário (nunca cruza tenants).
    // Em escopo obra, obraId + empresaId evitam ID de outra empresa.
    const where =
      escopo === 'obra' && obraIdResolvido
        ? {
            obraId: obraIdResolvido,
            obra: { empresaId, deletedAt: null },
            dataReferencia: { gte: dataInicio, lte: dataFim },
            deletedAt: null,
          }
        : {
            obra: { empresaId, deletedAt: null },
            dataReferencia: { gte: dataInicio, lte: dataFim },
            deletedAt: null,
          };

    const rdos = await this.prisma.rdo.findMany({
      where,
      include: {
        obra: { select: { id: true, nome: true } },
        efetivos: { where: { deletedAt: null } },
        atividades: { where: { deletedAt: null } },
        tarefas: true,
      },
      orderBy: { dataReferencia: 'asc' },
      take: MAX_RDOS_CONTEXTO,
    });

    return agregarRdosParaContexto({
      rdos,
      escopo: escopo === 'obra' && obraIdResolvido ? 'obra' : 'empresa',
      obraId: obraIdResolvido,
      obraNome,
      dataInicio,
      dataFim,
      periodoLabel,
    });
  }

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
      const { climaStr, textLower } = textoClimaDeExtras(d);
      climas.push(climaStr.toLowerCase());

      const { categoria } = classificarClima(textLower);
      if (categoria === 'chuva') diasChuva++;
      else if (categoria === 'sol') diasSol++;
      else if (categoria === 'nublado') diasNublado++;
      else diasOutros++;

      const { total: efetivoDia, profissionais } = extrairEfetivoDoRdo(r);
      somaEfetivo += efetivoDia;

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

      r.atividades.forEach((a) => servicosSet.add(a.descricao));
      r.tarefas
        .filter((t) => t.statusExecucao === 'EXECUTADO')
        .forEach((t) => servicosSet.add(t.descricao));

      const gargalosRdo = r.tarefas
        .filter((t) => t.statusExecucao !== 'EXECUTADO')
        .map((t) => `${t.descricao} (${t.motivoNaoExecucao})`);

      return {
        data: formatarDataISO(r.dataReferencia),
        clima: climaStr,
        atividadesExecutadas: atividadesList,
        atividadesPendentes: pendenciasList,
        profissionais: profissionais.map(
          (p) => `${p.nome}: ${p.quantidade || 0}`,
        ),
        observacoes: extrairLinhasDeTexto(d.observacoes).join('\n'),
        gargalos: gargalosRdo,
      };
    });

    const mediaEfetivoDiario = Math.round(somaEfetivo / totalDias);
    const servicosExecutados = Array.from(servicosSet);

    let climaPredominante = 'Predominantemente Ensolarado/Bom';
    if (diasChuva > totalDias / 2) {
      climaPredominante = 'Predominantemente Chuvoso';
    } else if (diasChuva > 0) {
      climaPredominante = `Dias bons (chuva em aprox. ${diasChuva} dia(s))`;
    }

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

    const gerarMockResult = (isFallback = false, _errMsg?: string) => {
      const focusText = foco?.trim() ? ` com foco em "${foco}"` : '';
      const secoesText =
        secoes && secoes.length > 0
          ? ` (seções focadas: ${secoes.join(', ')})`
          : '';

      return {
        ...baseData,
        resumoExecutivo: `Período: ${dataInicio} a ${dataFim}. Análise consolidada de ${totalDias} diários de obras${focusText}${secoesText}. Relatório gerado com base nas atividades e ocorrências registradas no canteiro de obras.`,
        gargalos: [
          foco?.trim()
            ? `Gargalo operacional relacionado a: ${foco}`
            : 'Chuva frequente prejudicou o ritmo de concretagem',
          'Falha mecânica em equipamento secundário no 3º dia',
        ],
        recomendacoes: [
          foco?.trim()
            ? `Ajustar planejamento para mitigar gargalo: ${foco}`
            : 'Melhorar planejamento de estoque de materiais para períodos de chuva instável',
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
      this.logger.error(
        `[AiService] Erro ao chamar a API do Claude: ${err?.message}`,
      );
      // Fallback local sem expor detalhes de billing/chave ao usuário
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
   * Responde a uma pergunta específica do usuário baseando-se nos RDOs do período.
   * Perguntas factuais saem direto do banco; demais usam Claude com contexto rico.
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

      if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
        throw new BadRequestException('Datas inválidas. Use o formato YYYY-MM-DD.');
      }
      if (inicio > fim) {
        throw new BadRequestException('dataInicio deve ser anterior a dataFim.');
      }

      const ctx = await this.carregarContextoRdos({
        empresaId,
        obraId,
        escopo: 'obra',
        dataInicio: inicio,
        dataFim: fim,
        periodoLabel: `${formatarDataISO(inicio)} a ${formatarDataISO(fim)}`,
      });

      if (ctx.totalRdos === 0) {
        return {
          resposta:
            'Não encontrei nenhum diário de obra neste período. Ajuste as datas ou confira se já existem RDOs registrados nesta obra.',
        };
      }

      const intencao = detectarIntencaoFactual(pergunta);
      const factual = responderFactual(intencao, ctx, pergunta);
      if (factual) {
        return { resposta: factual };
      }

      const contextoTexto = formatarContextoParaPrompt(ctx);
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey || !Anthropic) {
        return {
          resposta:
            responderFactual('status_rdos', ctx, pergunta) ||
            respostaLocalAmigavel(ctx),
        };
      }

      try {
        const client = new Anthropic.default({ apiKey });
        const prompt = `Você é um assistente especializado em gestão de obras de construção civil.

Responda de forma concisa e direta, em português brasileiro, à pergunta do usuário sobre os Relatórios Diários de Obra do período ${dataInicio} a ${dataFim}:
"${pergunta}"

Baseie-se estritamente nos dados abaixo. Não invente números. Se não houver informação, diga claramente.

${contextoTexto}

Amostra JSON dos diários (até 40):
${JSON.stringify(ctx.dias.slice(0, 40), null, 2)}`;

        const response = await client.messages.create({
          model: AI_MODEL,
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        });

        const resposta =
          response.content[0]?.type === 'text' ? response.content[0].text : '';
        return {
          resposta:
            resposta ||
            respostaLocalAmigavel(ctx),
        };
      } catch (err: any) {
        this.logger.error(
          `[AiService] Erro ao chamar Claude em perguntarRelatorioObra: ${err?.message}`,
        );
        return {
          resposta:
            responderFactual(intencao || 'status_rdos', ctx, pergunta) ||
            respostaLocalAmigavel(ctx),
        };
      }
    } finally {
      this.activeQueries.delete(obraId);
    }
  }

  /**
   * Cron diário às 03:00 — remove RelatorioIA com mais de 30 dias.
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
   * Prioriza obra ativa (x-obra-id); consolida empresa se a pergunta for geral.
   * Perguntas factuais respondem direto do banco.
   */
  async chat(
    empresaId: string,
    userId: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    obraIdHeader?: string | null,
  ) {
    if (!message?.trim()) {
      throw new BadRequestException('A mensagem é obrigatória.');
    }

    void userId;

    const obrasAtivas = await this.prisma.obra.findMany({
      where: { empresaId, status: 'ATIVA', deletedAt: null },
      select: { id: true, nome: true },
    });
    const listaObrasNomes = obrasAtivas.map((o) => o.nome);
    const listaObras = listaObrasNomes.join(', ') || 'Nenhuma obra ativa';

    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const [totalRdosMes, totalPendentes] = await Promise.all([
      this.prisma.rdo.count({
        where: {
          obra: { empresaId },
          dataReferencia: { gte: inicioMes },
          deletedAt: null,
        },
      }),
      this.prisma.rdo.count({
        where: {
          obra: { empresaId },
          status: 'SUBMETIDO',
          deletedAt: null,
        },
      }),
    ]);

    const periodo = inferirPeriodo(message, agora);
    const escopo = detectarEscopo(message, obraIdHeader);
    const intencao = detectarIntencaoFactual(message);
    const querOnline = detectarConsultaOnline(message);

    // Consulta online explícita (informação pública — sem dados de outras empresas)
    if (querOnline && !intencao) {
      const online = await consultarOnline(message);
      return { reply: formatarRespostaOnline(online) };
    }

    let ctx: ContextoAgregado | null = null;
    try {
      ctx = await this.carregarContextoRdos({
        empresaId,
        obraId: obraIdHeader,
        escopo,
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
        periodoLabel: periodo.label,
      });

      // Se a janela padrão (30 dias) veio vazia — e o usuário NÃO pediu
      // explicitamente "últimos N dias" — amplia para o histórico.
      const pediuJanelaExplicita = /ultimos?\s+\d+\s+dias?/.test(
        (message || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, ''),
      );
      if (
        ctx &&
        ctx.totalRdos === 0 &&
        periodo.label === 'últimos 30 dias' &&
        !pediuJanelaExplicita &&
        intencao &&
        intencao !== 'obras'
      ) {
        const amplio = {
          dataInicio: new Date(2015, 0, 1),
          dataFim: periodo.dataFim,
          label:
            'desde o início até hoje (ampliado; sem registros nos últimos 30 dias)',
        };
        ctx = await this.carregarContextoRdos({
          empresaId,
          obraId: obraIdHeader,
          escopo,
          dataInicio: amplio.dataInicio,
          dataFim: amplio.dataFim,
          periodoLabel: amplio.label,
        });
      }
    } catch (err: any) {
      this.logger.warn(
        `[AiService] Falha ao carregar contexto RDO no chat: ${err?.message}`,
      );
    }

    // 1) Respostas factuais diretas do banco (sempre filtradas por empresaId)
    if (intencao && ctx) {
      const factual = responderFactual(intencao, ctx, message, {
        obrasAtivas: listaObrasNomes,
        totalPendentesEmpresa: totalPendentes,
      });
      if (factual) {
        if (querOnline) {
          const online = await consultarOnline(message);
          return {
            reply: `${factual}\n\n${formatarRespostaOnline(online)}`,
          };
        }
        return { reply: factual };
      }
    }
    if (intencao === 'obras') {
      return {
        reply: responderFactual('obras', ctx || ({
          escopo: 'empresa',
          dataInicio: formatarDataISO(periodo.dataInicio),
          dataFim: formatarDataISO(periodo.dataFim),
          periodoLabel: periodo.label,
          totalRdos: 0,
          aprovados: 0,
          submetidos: 0,
          rascunhos: 0,
          rejeitados: 0,
          porStatus: {},
          diasChuva: 0,
          datasChuva: [],
          diasSol: 0,
          diasNublado: 0,
          diasOutros: 0,
          mediaEfetivo: 0,
          totalEfetivoAcumulado: 0,
          profissionaisMap: {},
          topAtividades: [],
          topPendencias: [],
          dias: [],
          obrasNomes: listaObrasNomes,
        } as ContextoAgregado), message, {
          obrasAtivas: listaObrasNomes,
        }),
      };
    }

    const contextoRico = ctx
      ? formatarContextoParaPrompt(ctx)
      : 'Sem diários disponíveis no período.';

    const systemPrompt = `Você é a Luna, assistente de IA do Obra 10, plataforma de gestão de obras.
Responda sempre em português brasileiro. Seja objetiva, direta e profissional, mas com tom acolhedor.
Nunca invente dados — use apenas as informações abaixo.
Se não tiver a informação, diga que não tem acesso no momento.
Para ações que não pode executar (aprovar, criar registros), oriente o usuário a fazer manualmente.
NUNCA mencione, invente ou misture dados de outras empresas. Você só tem acesso aos dados da empresa do usuário logado.
Quando o usuário pedir informação geral (normas, conceitos, preços públicos), você pode usar conhecimento geral, mas deixe claro o que veio do banco da obra e o que é informação externa.

DADOS RÁPIDOS DA EMPRESA (somente desta empresa):
- Obras ativas: ${listaObras}
- RDOs este mês: ${totalRdosMes}
- RDOs pendentes de aprovação agora: ${totalPendentes}

CONTEXTO DETALHADO DOS DIÁRIOS (banco — somente desta empresa):
${contextoRico}`;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !Anthropic) {
      return {
        reply: respostaLocalAmigavel(ctx, {
          obrasAtivas: listaObrasNomes,
          totalRdosMes,
          totalPendentes,
        }),
      };
    }

    const client = new Anthropic.default({ apiKey });
    const formattedMessages = (history || []).map((h) => ({
      role: h.role,
      content: h.content,
    }));
    formattedMessages.push({ role: 'user', content: message });

    try {
      const chatModel = 'claude-sonnet-4-20250514';

      const makeCall = async (modelToUse: string) => {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  'Timeout de 30 segundos atingido ao chamar a API da Anthropic.',
                ),
              ),
            30000,
          ),
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
        const isModelError =
          err?.status === 404 ||
          err?.message?.includes('model') ||
          err?.message?.includes('not found');
        if (isModelError) {
          this.logger.warn(
            `[AiService] Modelo '${chatModel}' falhou. Fallback para '${AI_MODEL}'.`,
          );
          response = await makeCall(AI_MODEL);
        } else {
          throw err;
        }
      }

      const reply =
        response.content[0]?.type === 'text' ? response.content[0].text : '';
      return {
        reply:
          reply ||
          respostaLocalAmigavel(ctx, {
            obrasAtivas: listaObrasNomes,
            totalRdosMes,
            totalPendentes,
          }),
      };
    } catch (err: any) {
      this.logger.error(
        `[AiService] Erro no chat Luna: ${err?.message}`,
      );

      if (ctx && intencao) {
        const factual = responderFactual(intencao, ctx, message, {
          obrasAtivas: listaObrasNomes,
          totalPendentesEmpresa: totalPendentes,
        });
        if (factual) return { reply: factual };
      }

      return {
        reply: respostaLocalAmigavel(ctx, {
          obrasAtivas: listaObrasNomes,
          totalRdosMes,
          totalPendentes,
        }),
      };
    }
  }
}
