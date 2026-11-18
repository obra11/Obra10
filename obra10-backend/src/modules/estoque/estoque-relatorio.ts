import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizarDescricao } from './estoque-match';

export type FiltroRelatorio = {
  localId: string;
  movimento?: string;
  de?: string;
  ate?: string;
  retiradoPor?: string;
  fornecedor?: string;
  insumoId?: string;
  tipoInsumo?: string;
  categoria?: string;
};

function dia(valor: string | undefined, fim: boolean) {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;
  return new Date(`${valor}T${fim ? '23:59:59.999' : '00:00:00.000'}-03:00`);
}

function itensDaEntrada<T extends { insumoId: string | null; descricaoOriginal: string }>(
  itens: T[],
  insumoId: string,
  nome: string,
) {
  const porId = itens.filter((item) => item.insumoId === insumoId);
  if (porId.length) return porId;
  const alvo = normalizarDescricao(nome);
  return itens.filter(
    (item) => !item.insumoId && normalizarDescricao(item.descricaoOriginal || '') === alvo,
  );
}

function valorLinha(item: {
  valorTotal: Prisma.Decimal | null;
  valorUnitario: Prisma.Decimal | null;
  quantidade: Prisma.Decimal;
}) {
  if (item.valorTotal != null) return Number(item.valorTotal);
  if (item.valorUnitario != null) return Number(item.valorUnitario) * Number(item.quantidade);
  return 0;
}

export async function montarRelatorio(
  prisma: PrismaService,
  empresaId: string,
  filtro: FiltroRelatorio,
) {
  const movimento =
    filtro.movimento === 'SAIDA' || filtro.movimento === 'ENTRADA' ? filtro.movimento : 'AMBOS';
  const tipoInsumo = ['MATERIAL', 'MAO_DE_OBRA', 'EQUIPAMENTO', 'EPI'].includes(filtro.tipoInsumo || '')
    ? filtro.tipoInsumo
    : undefined;
  const categoria = ['CONSTRUCAO', 'LIMPEZA', 'OUTRO'].includes(filtro.categoria || '')
    ? filtro.categoria
    : undefined;
  const de = dia(filtro.de, false);
  const ate = dia(filtro.ate, true);

  const movimentos = await prisma.movimentoEstoque.findMany({
    where: {
      empresaId,
      tipo: { in: ['ENTRADA', 'SAIDA'] },
      OR: [{ localOrigemId: filtro.localId }, { localDestinoId: filtro.localId }],
      ...(de || ate
        ? { createdAt: { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } }
        : {}),
      ...(filtro.insumoId ? { insumoId: filtro.insumoId } : {}),
      ...(filtro.retiradoPor?.trim()
        ? { retiradoPor: { contains: filtro.retiradoPor.trim(), mode: 'insensitive' as const } }
        : {}),
      ...(tipoInsumo || categoria
        ? {
            insumo: {
              ...(tipoInsumo ? { tipo: tipoInsumo as 'MATERIAL' | 'MAO_DE_OBRA' | 'EQUIPAMENTO' | 'EPI' } : {}),
              ...(categoria ? { categoria: categoria as 'CONSTRUCAO' | 'LIMPEZA' | 'OUTRO' } : {}),
            },
          }
        : {}),
      ...(filtro.fornecedor?.trim()
        ? {
            documento: {
              fornecedorRazao: { contains: filtro.fornecedor.trim(), mode: 'insensitive' as const },
            },
          }
        : {}),
    },
    include: {
      insumo: { select: { id: true, nome: true, unidade: true, tipo: true, categoria: true } },
      documento: {
        select: {
          numero: true,
          fornecedorRazao: true,
          itens: {
            select: {
              insumoId: true,
              descricaoOriginal: true,
              quantidade: true,
              valorUnitario: true,
              valorTotal: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 400,
  });

  const ids = [...new Set(movimentos.map((mov) => mov.insumoId))];
  const nomes = new Map(
    movimentos.map((mov) => [normalizarDescricao(mov.insumo.nome), mov.insumoId]),
  );
  const normas = [...nomes.keys()].filter(Boolean);
  const custos = ids.length
    ? await prisma.documentoEntradaItem.findMany({
        where: {
          empresaId,
          documento: { status: 'CONFIRMADA' },
          OR: [
            { insumoId: { in: ids } },
            ...(normas.length ? [{ insumoId: null, descricaoNormalizada: { in: normas } }] : []),
          ],
        },
        select: {
          insumoId: true,
          descricaoOriginal: true,
          descricaoNormalizada: true,
          quantidade: true,
          valorUnitario: true,
          valorTotal: true,
        },
      })
    : [];
  const acum = new Map<string, { valor: number; qtd: number }>();
  for (const item of custos) {
    const insumoId =
      item.insumoId ||
      nomes.get(item.descricaoNormalizada || normalizarDescricao(item.descricaoOriginal || ''));
    if (!insumoId) continue;
    const atual = acum.get(insumoId) || { valor: 0, qtd: 0 };
    atual.valor += valorLinha(item);
    atual.qtd += Number(item.quantidade);
    acum.set(insumoId, atual);
  }
  const custoMedio = (id: string) => {
    const item = acum.get(id);
    if (!item || item.qtd <= 0) return 0;
    return item.valor / item.qtd;
  };

  const linhas = movimentos.map((mov) => {
    const quantidade = Number(mov.quantidade);
    const daNota = itensDaEntrada(mov.documento?.itens || [], mov.insumoId, mov.insumo.nome);
    const valorNota = daNota.reduce((soma, item) => soma + valorLinha(item), 0);
    const valor =
      mov.tipo === 'ENTRADA' && valorNota > 0
        ? valorNota
        : quantidade * custoMedio(mov.insumoId);
    return {
      id: mov.id,
      data: mov.createdAt,
      tipo: mov.tipo,
      insumoId: mov.insumo.id,
      nome: mov.insumo.nome,
      unidade: mov.insumo.unidade,
      tipoInsumo: mov.insumo.tipo,
      categoria: mov.insumo.categoria,
      quantidade,
      valor: Math.round(valor * 100) / 100,
      fornecedor: mov.documento?.fornecedorRazao || null,
      numero: mov.documento?.numero || null,
      retiradoPor: mov.retiradoPor,
      motivo: mov.motivo,
    };
  });

  const porMes = mesesDoRelatorio(linhas, de, ate);
  const linhasDoFiltro = movimento === 'AMBOS' ? linhas : linhas.filter((linha) => linha.tipo === movimento);

  const porInsumo = new Map<string, { nome: string; tipoInsumo: string; valor: number; quantidade: number }>();
  for (const linha of linhasDoFiltro) {
    const atual = porInsumo.get(linha.insumoId) || {
      nome: linha.nome,
      tipoInsumo: linha.tipoInsumo,
      valor: 0,
      quantidade: 0,
    };
    atual.valor += linha.valor;
    atual.quantidade += linha.quantidade;
    porInsumo.set(linha.insumoId, atual);
  }
  const curva = [...porInsumo.entries()]
    .map(([insumoId, item]) => ({
      insumoId,
      nome: item.nome,
      tipoInsumo: item.tipoInsumo,
      quantidade: item.quantidade,
      valor: Math.round(item.valor * 100) / 100,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 12);

  const somar = (tipo: string) =>
    Math.round(linhasDoFiltro.filter((linha) => linha.tipo === tipo).reduce((soma, linha) => soma + linha.valor, 0) * 100) / 100;

  return {
    linhas: linhasDoFiltro,
    curva,
    porMes,
    totais: {
      entradas: somar('ENTRADA'),
      saidas: somar('SAIDA'),
    },
  };
}

const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function chaveMes(data: Date) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(data);
  const ano = partes.find((parte) => parte.type === 'year')?.value || '0000';
  const mes = partes.find((parte) => parte.type === 'month')?.value || '01';
  return `${ano}-${mes}`;
}

function rotuloMes(chave: string) {
  const [ano, mes] = chave.split('-');
  return `${NOMES_MES[Number(mes) - 1] || mes}/${ano}`;
}

function sequenciaMeses(inicio: string, fim: string) {
  const lista: string[] = [];
  let [ano, mes] = inicio.split('-').map(Number);
  const [anoFim, mesFim] = fim.split('-').map(Number);
  let guarda = 0;
  while ((ano < anoFim || (ano === anoFim && mes <= mesFim)) && guarda < 36) {
    lista.push(`${ano}-${String(mes).padStart(2, '0')}`);
    mes += 1;
    if (mes === 13) {
      mes = 1;
      ano += 1;
    }
    guarda += 1;
  }
  return lista;
}

function mesesDoRelatorio(
  linhas: { data: Date; tipo: string; valor: number }[],
  de: Date | undefined,
  ate: Date | undefined,
) {
  const chaves = linhas.map((linha) => chaveMes(new Date(linha.data))).sort();
  const inicio = de ? chaveMes(de) : chaves[0];
  const fim = ate ? chaveMes(ate) : chaves[chaves.length - 1];
  const meses = inicio && fim ? sequenciaMeses(inicio, fim) : [];
  return meses.map((mes) => {
    const doMes = linhas.filter((linha) => chaveMes(new Date(linha.data)) === mes);
    const somar = (tipo: string) =>
      Math.round(doMes.filter((linha) => linha.tipo === tipo).reduce((soma, linha) => soma + linha.valor, 0) * 100) / 100;
    return { mes, rotulo: rotuloMes(mes), entradas: somar('ENTRADA'), saidas: somar('SAIDA') };
  });
}
