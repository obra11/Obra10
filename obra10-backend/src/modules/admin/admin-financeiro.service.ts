import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CobrancaService } from '../cobranca/cobranca.service';
import {
  AtualizarDespesaFinanceiraDto,
  CriarDespesaFinanceiraDto,
} from './dto/admin.dto';
import {
  parseDataBrasilFimDoDia,
  parseDataBrasilInicioDoDia,
  toInputDateBrasil,
} from '../cupom/cupom-data';

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Interpreta YYYY-MM-DD (ou ISO) como início do dia em Brasília. */
function parseInicio(value?: string, fallback?: Date | null) {
  if (!value) return fallback ?? null;
  try {
    return parseDataBrasilInicioDoDia(value.slice(0, 10));
  } catch {
    throw new BadRequestException(`Data inválida: ${value}`);
  }
}

/** Interpreta YYYY-MM-DD (ou ISO) como fim do dia em Brasília. */
function parseFim(value?: string, fallback?: Date | null) {
  if (!value) return fallback ?? null;
  try {
    return parseDataBrasilFimDoDia(value.slice(0, 10));
  } catch {
    throw new BadRequestException(`Data inválida: ${value}`);
  }
}

function toNum(v: Prisma.Decimal | number | null | undefined) {
  return Number(v || 0);
}

function ymd(d: Date) {
  return toInputDateBrasil(d);
}

function agingBucket(dataVencimento: Date, agora: Date) {
  const dias = Math.floor(
    (startOfDay(agora).getTime() - startOfDay(dataVencimento).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  if (dias <= 0) return 'em_dia';
  if (dias <= 7) return '1_7';
  if (dias <= 30) return '8_30';
  return '30_mais';
}

@Injectable()
export class AdminFinanceiroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cobrancaService: CobrancaService,
  ) {}

  async getResumo(inicioStr?: string, fimStr?: string) {
    const agora = new Date();
    const hojeYmd = toInputDateBrasil(agora);
    const [yy, mm] = hojeYmd.split('-');
    const inicio = parseInicio(
      inicioStr,
      parseDataBrasilInicioDoDia(`${yy}-${mm}-01`),
    )!;
    const fim = parseFim(fimStr, parseDataBrasilFimDoDia(hojeYmd))!;

    const pagoWhere = {
      status: 'PAGO' as const,
      dataPagamento: { gte: inicio, lte: fim },
      NOT: { formaPagamento: 'BONIFICACAO' },
    };

    const [recebidoAgg, liquidoRows, bonificadoAgg, aReceberAgg, vencidoAgg, saidasAgg] =
      await Promise.all([
        this.prisma.cobranca.aggregate({
          _sum: { valor: true },
          _count: true,
          where: pagoWhere,
        }),
        this.prisma.cobranca.findMany({
          where: pagoWhere,
          select: { valor: true, valorLiquido: true, taxaAsaas: true },
        }),
        this.prisma.cobranca.aggregate({
          _sum: { valor: true },
          _count: true,
          where: {
            status: 'PAGO',
            dataPagamento: { gte: inicio, lte: fim },
            formaPagamento: 'BONIFICACAO',
          },
        }),
        this.prisma.cobranca.aggregate({
          _sum: { valor: true },
          _count: true,
          where: { status: 'PENDENTE' },
        }),
        this.prisma.cobranca.aggregate({
          _sum: { valor: true },
          _count: true,
          where: { status: 'VENCIDO' },
        }),
        this.prisma.despesaFinanceira.aggregate({
          _sum: { valor: true },
          _count: true,
          where: { data: { gte: inicio, lte: fim } },
        }),
      ]);

    const recebido = toNum(recebidoAgg._sum.valor);
    let recebidoLiquido = 0;
    let taxasAsaas = 0;
    for (const row of liquidoRows) {
      const bruto = toNum(row.valor);
      const liquido = row.valorLiquido != null ? toNum(row.valorLiquido) : bruto;
      const taxa =
        row.taxaAsaas != null ? toNum(row.taxaAsaas) : Math.max(0, bruto - liquido);
      recebidoLiquido += liquido;
      taxasAsaas += taxa;
    }

    const bonificado = toNum(bonificadoAgg._sum.valor);
    const aReceber = toNum(aReceberAgg._sum.valor);
    const vencido = toNum(vencidoAgg._sum.valor);
    const saidas = toNum(saidasAgg._sum.valor);

    return {
      periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
      recebido,
      recebidoCount: recebidoAgg._count,
      recebidoLiquido: Math.round(recebidoLiquido * 100) / 100,
      taxasAsaas: Math.round(taxasAsaas * 100) / 100,
      bonificado,
      bonificadoCount: bonificadoAgg._count,
      aReceber,
      aReceberCount: aReceberAgg._count,
      vencido,
      vencidoCount: vencidoAgg._count,
      saidas,
      saidasCount: saidasAgg._count,
      saldoLiquido: Math.round((recebidoLiquido - saidas) * 100) / 100,
      saldoBruto: Math.round((recebido - saidas) * 100) / 100,
    };
  }

  async listarRecebimentos(query: {
    status?: string;
    formaPagamento?: string;
    empresaId?: string;
    inicio?: string;
    fim?: string;
    periodoCampo?: 'vencimento' | 'pagamento';
    page?: string;
    pageSize?: string;
  }) {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));
    const periodoCampo = query.periodoCampo === 'pagamento' ? 'pagamento' : 'vencimento';
    const inicio = parseInicio(query.inicio);
    const fim = parseFim(query.fim);

    const where: Prisma.CobrancaWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.formaPagamento) where.formaPagamento = query.formaPagamento;
    if (query.empresaId) where.empresaId = query.empresaId;

    if (inicio || fim) {
      const range: Prisma.DateTimeFilter = {};
      if (inicio) range.gte = inicio;
      if (fim) range.lte = fim;
      if (periodoCampo === 'pagamento') where.dataPagamento = range;
      else where.dataVencimento = range;
    }

    const [total, items] = await Promise.all([
      this.prisma.cobranca.count({ where }),
      this.prisma.cobranca.findMany({
        where,
        include: {
          empresa: {
            select: {
              id: true,
              razaoSocial: true,
              nomeFantasia: true,
              nomeCompleto: true,
            },
          },
        },
        orderBy: { dataVencimento: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const agora = new Date();
    const aging = { em_dia: 0, '1_7': 0, '8_30': 0, '30_mais': 0 };
    const openStatuses = ['PENDENTE', 'VENCIDO', 'OVERDUE'];
    const openWhere: Prisma.CobrancaWhereInput = {
      status: { in: openStatuses },
      ...(query.empresaId ? { empresaId: query.empresaId } : {}),
    };
    const open = await this.prisma.cobranca.findMany({
      where: openWhere,
      select: { dataVencimento: true, valor: true, status: true },
    });
    for (const c of open) {
      const bucket = agingBucket(c.dataVencimento, agora);
      aging[bucket] += toNum(c.valor);
    }

    return {
      total,
      page,
      pageSize,
      aging,
      items: items.map((c) => ({
        id: c.id,
        empresaId: c.empresaId,
        empresaNome:
          c.empresa.nomeFantasia ||
          c.empresa.razaoSocial ||
          c.empresa.nomeCompleto ||
          'Empresa',
        valor: toNum(c.valor),
        valorLiquido: c.valorLiquido != null ? toNum(c.valorLiquido) : null,
        taxaAsaas: c.taxaAsaas != null ? toNum(c.taxaAsaas) : null,
        status: c.status,
        formaPagamento: c.formaPagamento,
        mesReferencia: c.mesReferencia,
        dataVencimento: c.dataVencimento,
        dataPagamento: c.dataPagamento,
        idNotaAsaas: c.idNotaAsaas,
        statusNota: c.statusNota,
        notaPdfUrl: c.notaPdfUrl,
        notaXmlUrl: c.notaXmlUrl,
        aging:
          openStatuses.includes(c.status)
            ? agingBucket(c.dataVencimento, agora)
            : null,
      })),
    };
  }

  async getFluxoCaixa(inicioStr?: string, fimStr?: string, granularidade: 'dia' | 'mes' = 'dia') {
    const agora = new Date();
    const defaultInicio = new Date(agora.getFullYear(), agora.getMonth() - 2, 1);
    const inicio = parseInicio(
      inicioStr,
      parseDataBrasilInicioDoDia(toInputDateBrasil(defaultInicio)),
    )!;
    const fim = parseFim(fimStr, parseDataBrasilFimDoDia(toInputDateBrasil(agora)))!;

    const [pagos, despesas] = await Promise.all([
      this.prisma.cobranca.findMany({
        where: {
          status: 'PAGO',
          dataPagamento: { gte: inicio, lte: fim },
          NOT: { formaPagamento: 'BONIFICACAO' },
        },
        select: { valor: true, valorLiquido: true, dataPagamento: true },
      }),
      this.prisma.despesaFinanceira.findMany({
        where: { data: { gte: inicio, lte: fim } },
        select: { valor: true, data: true },
      }),
    ]);

    const map = new Map<string, { periodo: string; entradas: number; saidas: number }>();

    const keyFor = (d: Date) => {
      if (granularidade === 'mes') {
        const parts = toInputDateBrasil(d).split('-');
        return `${parts[0]}-${parts[1]}`;
      }
      return ymd(d);
    };

    for (const p of pagos) {
      if (!p.dataPagamento) continue;
      const k = keyFor(p.dataPagamento);
      const row = map.get(k) || { periodo: k, entradas: 0, saidas: 0 };
      row.entradas += p.valorLiquido != null ? toNum(p.valorLiquido) : toNum(p.valor);
      map.set(k, row);
    }
    for (const d of despesas) {
      const k = keyFor(d.data);
      const row = map.get(k) || { periodo: k, entradas: 0, saidas: 0 };
      row.saidas += toNum(d.valor);
      map.set(k, row);
    }

    const serie = Array.from(map.values()).sort((a, b) =>
      a.periodo.localeCompare(b.periodo),
    );
    let acumulado = 0;
    return {
      periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
      granularidade,
      serie: serie.map((s) => {
        const liquido = s.entradas - s.saidas;
        acumulado += liquido;
        return { ...s, liquido, saldoAcumulado: acumulado };
      }),
    };
  }

  async getProjecao(dias = 90) {
    const horizonte = [30, 90].includes(dias) ? dias : 90;
    const agora = startOfDay(new Date());
    const fim = endOfDay(
      new Date(agora.getTime() + horizonte * 24 * 60 * 60 * 1000),
    );

    const [cobrancas, despesasRecorrentes, despesasAgendadas] = await Promise.all([
      this.prisma.cobranca.findMany({
        where: {
          status: { in: ['PENDENTE', 'VENCIDO'] },
          dataVencimento: { lte: fim },
        },
        include: {
          empresa: {
            select: { nomeFantasia: true, razaoSocial: true, nomeCompleto: true },
          },
        },
        orderBy: { dataVencimento: 'asc' },
      }),
      this.prisma.despesaFinanceira.findMany({
        where: { recorrente: true },
      }),
      this.prisma.despesaFinanceira.findMany({
        where: {
          recorrente: false,
          data: { gte: agora, lte: fim },
        },
      }),
    ]);

    type Evento = {
      data: string;
      tipo: 'entrada' | 'saida';
      descricao: string;
      valor: number;
      origem: string;
    };

    const eventos: Evento[] = [];

    for (const c of cobrancas) {
      eventos.push({
        data: ymd(c.dataVencimento),
        tipo: 'entrada',
        descricao:
          c.empresa.nomeFantasia ||
          c.empresa.razaoSocial ||
          c.empresa.nomeCompleto ||
          'Recebimento',
        valor: toNum(c.valor),
        origem: `cobranca:${c.id}`,
      });
    }

    for (const d of despesasAgendadas) {
      eventos.push({
        data: ymd(d.data),
        tipo: 'saida',
        descricao: d.descricao,
        valor: toNum(d.valor),
        origem: `despesa:${d.id}`,
      });
    }

    for (const d of despesasRecorrentes) {
      let cursor = new Date(agora.getFullYear(), agora.getMonth(), d.data.getDate());
      if (cursor < agora) {
        cursor = new Date(agora.getFullYear(), agora.getMonth() + 1, d.data.getDate());
      }
      while (cursor <= fim) {
        eventos.push({
          data: ymd(cursor),
          tipo: 'saida',
          descricao: `${d.descricao} (recorrente)`,
          valor: toNum(d.valor),
          origem: `despesa-rec:${d.id}:${ymd(cursor)}`,
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, d.data.getDate());
      }
    }

    eventos.sort((a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo));

    const porDia = new Map<string, { data: string; entradas: number; saidas: number }>();
    for (const e of eventos) {
      const row = porDia.get(e.data) || { data: e.data, entradas: 0, saidas: 0 };
      if (e.tipo === 'entrada') row.entradas += e.valor;
      else row.saidas += e.valor;
      porDia.set(e.data, row);
    }

    const serie = Array.from(porDia.values()).sort((a, b) => a.data.localeCompare(b.data));
    let acumulado = 0;
    const serieComSaldo = serie.map((s) => {
      const liquido = s.entradas - s.saidas;
      acumulado += liquido;
      return { ...s, liquido, saldoAcumulado: acumulado };
    });

    const totalEntradas = eventos
      .filter((e) => e.tipo === 'entrada')
      .reduce((s, e) => s + e.valor, 0);
    const totalSaidas = eventos
      .filter((e) => e.tipo === 'saida')
      .reduce((s, e) => s + e.valor, 0);

    return {
      horizonteDias: horizonte,
      totalEntradasEsperadas: totalEntradas,
      totalSaidasPrevistas: totalSaidas,
      saldoProjetado: totalEntradas - totalSaidas,
      serie: serieComSaldo,
      eventos,
    };
  }

  async listarDespesas(inicioStr?: string, fimStr?: string) {
    const where: Prisma.DespesaFinanceiraWhereInput = {};
    const inicio = parseInicio(inicioStr);
    const fim = parseFim(fimStr);
    if (inicio || fim) {
      where.data = {};
      if (inicio) where.data.gte = inicio;
      if (fim) where.data.lte = fim;
    }
    const items = await this.prisma.despesaFinanceira.findMany({
      where,
      orderBy: { data: 'desc' },
    });
    return items.map((d) => ({
      ...d,
      valor: toNum(d.valor),
    }));
  }

  async sincronizarAsaas() {
    return this.cobrancaService.sincronizarAsaasFinanceiro(80);
  }

  async criarDespesa(dto: CriarDespesaFinanceiraDto, createdBy?: string) {
    const dataStr = dto.data.slice(0, 10);
    const created = await this.prisma.despesaFinanceira.create({
      data: {
        descricao: dto.descricao.trim(),
        valor: dto.valor,
        data: parseDataBrasilInicioDoDia(dataStr),
        categoria: (dto.categoria || 'outro').trim().toLowerCase(),
        recorrente: !!dto.recorrente,
        observacao: dto.observacao?.trim() || null,
        createdBy: createdBy || null,
      },
    });
    return { ...created, valor: toNum(created.valor) };
  }

  async atualizarDespesa(id: string, dto: AtualizarDespesaFinanceiraDto) {
    const existing = await this.prisma.despesaFinanceira.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Despesa não encontrada.');

    const updated = await this.prisma.despesaFinanceira.update({
      where: { id },
      data: {
        ...(dto.descricao !== undefined ? { descricao: dto.descricao.trim() } : {}),
        ...(dto.valor !== undefined ? { valor: dto.valor } : {}),
        ...(dto.data !== undefined
          ? { data: parseDataBrasilInicioDoDia(dto.data.slice(0, 10)) }
          : {}),
        ...(dto.categoria !== undefined
          ? { categoria: dto.categoria.trim().toLowerCase() }
          : {}),
        ...(dto.recorrente !== undefined ? { recorrente: dto.recorrente } : {}),
        ...(dto.observacao !== undefined
          ? { observacao: dto.observacao?.trim() || null }
          : {}),
      },
    });
    return { ...updated, valor: toNum(updated.valor) };
  }

  async excluirDespesa(id: string) {
    const existing = await this.prisma.despesaFinanceira.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Despesa não encontrada.');
    await this.prisma.despesaFinanceira.delete({ where: { id } });
    return { success: true };
  }
}
