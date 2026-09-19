import { BadRequestException } from '@nestjs/common';
import { AsaasService } from './asaas.service';

describe('AsaasService.garantirClienteAsaas', () => {
  const previousKey = process.env.ASAAS_API_KEY;

  beforeEach(() => {
    delete process.env.ASAAS_API_KEY;
  });

  afterAll(() => {
    if (previousKey === undefined) delete process.env.ASAAS_API_KEY;
    else process.env.ASAAS_API_KEY = previousKey;
  });

  it('aceita CPF com zero extra e reusa o cliente mock', async () => {
    const svc = new AsaasService();
    const id = await svc.garantirClienteAsaas('mock-customer-1', {
      cpfCnpj: '003793839850',
      email: 'teste@obra10.app.br',
      nomeCompleto: 'Empresa teste',
    });
    expect(id).toBe('mock-customer-1');
  });

  it('recusa documento que não vira CPF ou CNPJ válido', async () => {
    const svc = new AsaasService();
    await expect(
      svc.garantirClienteAsaas('', {
        cpfCnpj: '123',
        email: 'teste@obra10.app.br',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
