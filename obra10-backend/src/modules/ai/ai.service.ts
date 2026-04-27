import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
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

    // 4. Consolidar dados localmente
    const totalDias = rdos.length;
    let somaEfetivo = 0;
    const servicosSet = new Set<string>();
    const climas: string[] = [];

    const resumoRdosParaIA = rdos.map((r) => {
      // Extração robusta do clima (suporta versos antigas e novas)
      const d = (r.dadosExtras as any) || {};
      let climaStr = '';
      if (d.clima) {
        climaStr = d.clima;
      } else if (d.climaManha || d.climaTarde) {
        climaStr = `${d.climaManha ?? 'Sol'} / ${d.climaTarde ?? 'Sol'}`;
      } else if (d.condicoesClimaticas) {
        climaStr = d.condicoesClimaticas;
      } else {
        climaStr = 'Não informado';
      }
      climas.push(climaStr.toLowerCase());

      const efetivoDia = r.efetivos.reduce((s, e) => s + e.quantidade, 0);
      somaEfetivo += efetivoDia;

      r.atividades.forEach((a) => servicosSet.add(a.descricao));
      r.tarefas
        .filter((t) => t.statusExecucao === 'EXECUTADO')
        .forEach((t) => servicosSet.add(t.descricao));

      return {
        data: r.dataReferencia.toISOString().split('T')[0],
        clima: climaStr,
        gargalos: r.tarefas
          .filter((t) => t.statusExecucao !== 'EXECUTADO')
          .map((t) => `${t.descricao} (${t.motivoNaoExecucao})`),
        ocorrencias: r.ocorrencias.map((o) => o.descricao),
      };
    });

    const mediaEfetivoDiario = Math.round(somaEfetivo / totalDias);
    const servicosExecutados = Array.from(servicosSet);

    // Identificando clima predominante de forma simplificada
    const textClimas = climas.join(' ');
    const countChuva = (textClimas.match(/chuva|chuvoso|nublado com chuva/g) || []).length;
    let climaPredominante = 'Predominantemente Ensolarado/Bom';
    if (countChuva > totalDias / 2) {
      climaPredominante = 'Predominantemente Chuvoso';
    } else if (countChuva > 0) {
      climaPredominante = `Dias bons (chuva em aprox. ${Math.ceil(countChuva / 2)} dia(s))`;
    }

    const baseData = {
      totalDias,
      mediaEfetivoDiario,
      climaPredominante,
      servicosExecutados,
    };

    // 5. Stub se Anthropic não configurado
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !Anthropic) {
      const mockResult = {
        ...baseData,
        resumoExecutivo: `[MOCK] Período: ${dataInicio} a ${dataFim}. Análise de ${totalDias} diários de obras com foco nos serviços e clima registrados.`,
        gargalos: ['[MOCK] Chuva frequente prejudicou a concretagem', '[MOCK] Falha de maquinário no 3º dia'],
        recomendacoes: ['[MOCK] Melhor planejar materiais para semana chuvosa', '[MOCK] Realizar preventiva nos equipamentos locados'],
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

Analise os eventos de gargalos e ocorrências extraídos de ${totalDias} Relatórios Diários de Obra do período ${dataInicio} a ${dataFim}. 
Gere insights críticos num JSON. NÃO gere markdown ou explicação, SOMENTE o JSON.

Campos solicitados no JSON:
- resumoExecutivo: string (parágrafo resumindo as ocorrências e gargalos do período)
- gargalos: string[] (principais motivos que impediram os serviços, formatados de forma direta)
- recomendacoes: string[] (ações recomendadas em bullet notes)

Amostragem dos eventos:
${JSON.stringify(resumoRdosParaIA, null, 2)}`;

    let conteudo: any;
    try {
      const response = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });
      
      try {
        const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
        // Limpeza de blocos de codigo invisiveis caso o LLM escreva "```json { ... } ```"
        const cleanJsonStr = text.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
        
        conteudo = JSON.parse(cleanJsonStr);
        // Fazer merge dos dados base com a IA
        conteudo = { ...baseData, ...conteudo };
      } catch (err) {
        this.logger.error(`[AiService] Falha ao processar ou extrair JSON do Claude: ${(err as any)?.message}`);
        // Fallback seguro em caso de alucinação JSON
        conteudo = {
          ...baseData,
          resumoExecutivo: 'Não foi possível gerar um insight detalhado no momento devido a uma falha de comunicação com a Inteligência Artificial.',
          gargalos: [],
          recomendacoes: [],
        };
      }
    } catch (err: any) {
      // Handle Anthropic credits/billing errors gracefully
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
