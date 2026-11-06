const ABERTA = new Set(['PENDENTE', 'VENCIDO', 'OVERDUE']);

/** Decide se a fatura da Asaas deve ser removida. */
export function motivoEncerrarFatura(input: {
  status: string;
  formaPagamento: string;
  empresaAtiva: boolean;
  cupomCobreTudo: boolean;
}): 'cortesia' | 'bloqueio' | 'cupom' | null {
  if (
    input.status === 'PAGO' &&
    (input.formaPagamento === 'BONIFICACAO' || input.formaPagamento === 'CUPOM')
  ) {
    return 'cortesia';
  }
  if (!ABERTA.has(input.status)) return null;
  if (!input.empresaAtiva) return 'bloqueio';
  if (input.cupomCobreTudo) return 'cupom';
  return null;
}
