import { motivoEncerrarFatura } from './cobranca-fatura';

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
