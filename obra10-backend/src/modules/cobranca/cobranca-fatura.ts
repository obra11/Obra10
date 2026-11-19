const ABERTA = new Set(['PENDENTE', 'VENCIDO', 'OVERDUE']);

export const ASAAS_STATUS_PAGO = new Set([
  'RECEIVED',
  'CONFIRMED',
  'RECEIVED_IN_CASH',
  'DUNNING_RECEIVED',
]);

export function isAsaasPago(status?: string | null) {
  return ASAAS_STATUS_PAGO.has(String(status || '').toUpperCase());
}

/** Data em que o PIX/cartão caiu na Asaas (calendário de Brasília). */
export function dataPagamentoAsaas(payment?: {
  clientPaymentDate?: string | null;
  paymentDate?: string | null;
  confirmedDate?: string | null;
} | null): Date | null {
  const raw =
    payment?.clientPaymentDate ||
    payment?.paymentDate ||
    payment?.confirmedDate ||
    '';
  const ymd = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return new Date(`${ymd}T12:00:00.000-03:00`);
}

export function resumoPagamentoEmpresa(
  cobrancas: Array<{
    status: string;
    valor?: unknown;
    dataPagamento?: Date | string | null;
    formaPagamento?: string | null;
  }>,
) {
  const aberta = cobrancas.find((c) => ABERTA.has(c.status));
  const pago = cobrancas.find(
    (c) =>
      c.status === 'PAGO' &&
      c.formaPagamento !== 'BONIFICACAO' &&
      c.formaPagamento !== 'CUPOM',
  );
  return {
    statusPagamento:
      aberta?.status || pago?.status || cobrancas[0]?.status || 'SEM COBRANCA',
    temPendencia: !!aberta,
    ultimoPagamento: pago
      ? {
          valor: Number(pago.valor || 0),
          dataPagamento: pago.dataPagamento || null,
          formaPagamento: pago.formaPagamento || null,
        }
      : null,
  };
}

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
