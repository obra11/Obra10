import {
  dataPagamentoAsaas,
  isAsaasPago,
  motivoEncerrarFatura,
  resumoPagamentoEmpresa,
} from './cobranca-fatura';

describe('motivoEncerrarFatura', () => {
  it('tira da Asaas a fatura já bonificada ou quitada por cupom', () => {
    expect(
      motivoEncerrarFatura({
        status: 'PAGO',
        formaPagamento: 'BONIFICACAO',
        empresaAtiva: true,
        cupomCobreTudo: false,
      }),
    ).toBe('cortesia');
    expect(
      motivoEncerrarFatura({
        status: 'PAGO',
        formaPagamento: 'CUPOM',
        empresaAtiva: true,
        cupomCobreTudo: false,
      }),
    ).toBe('cortesia');
  });

  it('cancela cobrança em aberto de empresa bloqueada', () => {
    expect(
      motivoEncerrarFatura({
        status: 'VENCIDO',
        formaPagamento: 'PIX',
        empresaAtiva: false,
        cupomCobreTudo: false,
      }),
    ).toBe('bloqueio');
  });

  it('cancela cobrança em aberto coberta por cupom integral', () => {
    expect(
      motivoEncerrarFatura({
        status: 'PENDENTE',
        formaPagamento: 'PIX',
        empresaAtiva: true,
        cupomCobreTudo: true,
      }),
    ).toBe('cupom');
  });

  it('mantém cobrança real de empresa ativa sem cupom integral', () => {
    expect(
      motivoEncerrarFatura({
        status: 'VENCIDO',
        formaPagamento: 'PIX',
        empresaAtiva: true,
        cupomCobreTudo: false,
      }),
    ).toBeNull();
    expect(
      motivoEncerrarFatura({
        status: 'PAGO',
        formaPagamento: 'PIX',
        empresaAtiva: true,
        cupomCobreTudo: false,
      }),
    ).toBeNull();
  });
});

describe('depósito Asaas', () => {
  it('reconhece PIX/cartão já creditado na Asaas', () => {
    expect(isAsaasPago('RECEIVED')).toBe(true);
    expect(isAsaasPago('CONFIRMED')).toBe(true);
    expect(isAsaasPago('PENDING')).toBe(false);
  });

  it('usa a data do PIX em Brasília, não o instante do webhook', () => {
    const d = dataPagamentoAsaas({ clientPaymentDate: '2026-11-18' });
    expect(d?.toISOString()).toBe('2026-11-18T15:00:00.000Z');
  });

  it('mostra o depósito pago mesmo com fatura nova pendente', () => {
    const r = resumoPagamentoEmpresa([
      { status: 'PENDENTE', valor: 99, formaPagamento: 'PIX' },
      {
        status: 'PAGO',
        valor: 99,
        formaPagamento: 'PIX',
        dataPagamento: new Date('2026-11-10T15:00:00.000Z'),
      },
    ]);
    expect(r.statusPagamento).toBe('PENDENTE');
    expect(r.temPendencia).toBe(true);
    expect(r.ultimoPagamento?.valor).toBe(99);
  });
});
