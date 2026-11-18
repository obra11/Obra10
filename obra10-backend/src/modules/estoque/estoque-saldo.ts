import { TipoMovimentoEstoque } from '@prisma/client';

const ROUND = 1000;

export function arredondarQtd(n: number): number {
  return Math.round(n * ROUND) / ROUND;
}

export function proximoSaldo(
  saldoAtual: number,
  tipo: TipoMovimentoEstoque | string,
  quantidade: number,
): number {
  const atual = Number(saldoAtual) || 0;
  const q = Math.abs(Number(quantidade) || 0);
  if (tipo === TipoMovimentoEstoque.ENTRADA || tipo === 'ENTRADA') {
    return arredondarQtd(atual + q);
  }
  if (
    tipo === TipoMovimentoEstoque.SAIDA ||
    tipo === 'SAIDA' ||
    tipo === TipoMovimentoEstoque.ENTREGA_EPI ||
    tipo === 'ENTREGA_EPI'
  ) {
    return arredondarQtd(atual - q);
  }
  if (tipo === TipoMovimentoEstoque.AJUSTE || tipo === 'AJUSTE') {
    return arredondarQtd(Number(quantidade) || 0);
  }
  throw new Error(`Tipo de movimento inválido: ${tipo}`);
}
