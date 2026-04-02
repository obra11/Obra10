import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

// Lazy-load Anthropic to avoid crash when API key not set
let Anthropic: any;
try { Anthropic = require('@anthropic-ai/sdk'); } catch { Anthropic = null; }

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
  async gerarRelatorioObra(obraId: string, empresaId: string, dataInicio: string, dataFim: string) {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    if (inicio > fim) throw new BadRequestException('dataInicio deve ser anterior a dataFim.');

    // 1. Verificar cache (último relatório para mesmo período nas últimas 24h)
    const vintEquatroHAtras = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000);
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
      return { ...cached.conteudo as object, cached: true, cachedAt: cached.createdAt };
    }

    // 2. Rate limiting: máx 3 geracoes por obra hoje
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    const totalHoje = await this.prisma.relatorioIA.count({
      where: { obraId, createdAt: { gte: inicioDia } },
    });
    if (totalHoje >= MAX_CHAMADAS_DIA) {
      throw new ForbiddenException(`Limite de ${MAX_CHAMADAS_DIA} relatórios por dia atingido para esta obra. Tente novamente amanhã ou use o relatório em cache.`);
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
      throw new BadRequestException('Nenhum RDO aprovado encontrado no período informado.');
    }

    // 4. Consolidar dados para o prompt
    const resumoRdos = rdos.map(r => ({
      data: r.dataReferencia.toISOString().split('T')[0],
      clima: `${(r.dadosExtras as any)?.climaManha ?? '-'} / ${(r.dadosExtras as any)?.climaTarde ?? '-'}`,
      terreno: (r.dadosExtras as any)?.condicaoTerreno ?? '-',
      efetivo: r.efetivos.reduce((s, e) => s + e.quantidade, 0),
      atividades: r.atividades.map(a => a.descricao),
      tarefas: r.tarefas.map(t => ({
        desc: t.descricao,
        status: t.statusExecucao,
        motivo: t.motivoNaoExecucao ?? null,
        horas: t.horasExecutadas ?? null,
      })),
      ocorrencias: r.ocorrencias.map(o => ({ tipo: o.tipoOcorrencia, desc: o.descricao, horas: o.horasPerdidas ?? null })),
    }));

    // 5. Stub se Anthropic não configurado
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !Anthropic) {
      const mockResult = {
        resumoExecutivo: `[MOCK] Período: ${dataInicio} a ${dataFim}. ${rdos.length} RDOs aprovados consolidados.`,
        gargalos: ['[MOCK] Configure ANTHROPIC_API_KEY para relatório real.'],
        pontosPendentes: [],
        horasPorFuncao: {},
        recomendacoes: [],
        totalDias: rdos.length,
        modelo: 'MOCK',
        cached: false,
      };
      await this.prisma.relatorioIA.create({
        data: { obraId, dataInicio: inicio, dataFim: fim, conteudo: mockResult as any, modelo: 'MOCK' },
      });
      return mockResult;
    }

    // 6. Chamar Claude Sonnet
    const client = new Anthropic.default({ apiKey });
    const prompt = `Você é um assistente especializado em gestão de obras de construção civil.

Analise os dados abaixo de ${rdos.length} Relatórios Diários de Obra (RDOs) aprovados do período ${dataInicio} a ${dataFim} e gere um relatório executivo estruturado em JSON com os campos:
- resumoExecutivo: string (parágrafo resumindo o período)
- gargalos: string[] (principais motivos de não execução, ordenados por frequência)
- pontosPendentes: string[] (itens críticos não executados que precisam de atenção)
- horasPorFuncao: Record<string, number> (horas trabalhadas por tipo de função/cargo)
- recomendacoes: string[] (ações recomendadas para melhoria)
- totalDias: number

Dados dos RDOs:
${JSON.stringify(resumoRdos, null, 2)}

Responda APENAS com o JSON válido, sem markdown, sem explicações extras.`;

    let conteudo: any;
    try {
      const response = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });
      try {
        const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
        conteudo = JSON.parse(text);
      } catch {
        conteudo = { resumoExecutivo: 'Erro ao parsear resposta da IA.', gargalos: [], pontosPendentes: [], horasPorFuncao: {}, recomendacoes: [], totalDias: rdos.length };
      }
    } catch (err: any) {
      // Handle Anthropic credits/billing errors gracefully
      const msg = err?.message ?? '';
      const isCreditsError = msg.includes('Plans & Billing') || msg.includes('credit') || err?.status === 402 || err?.error?.type === 'insufficient_quota';
      if (isCreditsError) {
        throw new BadRequestException('Saldo insuficiente na conta Anthropic. Adicione créditos em console.anthropic.com → Plans & Billing, ou deixe ANTHROPIC_API_KEY vazia para usar modo MOCK.');
      }
      throw err;
    }

    // 7. Salvar no cache
    await this.prisma.relatorioIA.create({
      data: { obraId, dataInicio: inicio, dataFim: fim, conteudo, modelo: AI_MODEL },
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
      this.logger.log(`[AiService] Limpeza de cache: ${resultado.count} RelatorioIA removidos (>30 dias).`);
    }
  }
}
