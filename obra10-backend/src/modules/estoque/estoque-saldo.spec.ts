import { proximoSaldo } from './estoque-saldo';

describe('proximoSaldo', () => {
  it('soma entrada e desconta saída', () => {
    expect(proximoSaldo(10, 'ENTRADA', 2.5)).toBe(12.5);
    expect(proximoSaldo(12.5, 'SAIDA', 2.5)).toBe(10);
  });

  it('entrega de EPI baixa o estoque', () => {
    expect(proximoSaldo(8, 'ENTREGA_EPI', 2)).toBe(6);
  });

  it('ajuste define o saldo absoluto', () => {
    expect(proximoSaldo(40, 'AJUSTE', 12)).toBe(12);
  });
});
