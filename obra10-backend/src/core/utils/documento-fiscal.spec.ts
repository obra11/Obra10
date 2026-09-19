import {
  documentoFiscalValido,
  erroAsaasSemDocumento,
  normalizarDocumentoFiscal,
  validarCNPJ,
  validarCPF,
} from './documento-fiscal';

describe('documento-fiscal', () => {
  it('aceita CPF válido com máscara', () => {
    expect(validarCPF('037.938.398-50')).toBe(true);
    expect(documentoFiscalValido('037.938.398-50')).toBe(true);
  });

  it('remove o zero extra digitado no CPF da tela de cadastro', () => {
    expect(normalizarDocumentoFiscal('003793839850')).toBe('03793839850');
    expect(documentoFiscalValido('003793839850')).toBe(true);
  });

  it('remove dois zeros extras se o restante for um CPF válido', () => {
    expect(normalizarDocumentoFiscal('0003793839850')).toBe('03793839850');
  });

  it('não altera CPF ou CNPJ já no tamanho certo', () => {
    expect(normalizarDocumentoFiscal('03793839850')).toBe('03793839850');
    expect(normalizarDocumentoFiscal('11.222.333/0001-81')).toBe('11222333000181');
  });

  it('rejeita documento com dígitos repetidos', () => {
    expect(validarCPF('11111111111')).toBe(false);
    expect(validarCNPJ('00000000000000')).toBe(false);
    expect(documentoFiscalValido('11111111111')).toBe(false);
  });

  it('reconhece o erro da Asaas quando o cliente não tem documento', () => {
    expect(
      erroAsaasSemDocumento(
        'Para criar esta cobrança é necessário preencher o CPF ou CNPJ do cliente.',
      ),
    ).toBe(true);
    expect(erroAsaasSemDocumento('Saldo insuficiente')).toBe(false);
  });
});
