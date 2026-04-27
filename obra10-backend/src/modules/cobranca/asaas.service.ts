import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly mockMode: boolean;

  constructor() {
    const env = process.env.ASAAS_ENVIRONMENT || 'sandbox';
    this.baseUrl =
      env === 'production'
        ? 'https://api.asaas.com/v3'
        : 'https://sandbox.asaas.com/api/v3';
    this.apiKey = process.env.ASAAS_API_KEY || '';
    this.mockMode = !this.apiKey;
    if (this.mockMode) {
      this.logger.warn('ASAAS_API_KEY não configurada — operando em modo MOCK');
    }
  }

  private get headers() {
    return { access_token: this.apiKey, 'Content-Type': 'application/json' };
  }

  async criarClienteAsaas(empresa: {
    cpfCnpj: string;
    razaoSocial?: string;
    nomeCompleto?: string;
    email: string;
    telefone?: string;
  }): Promise<string> {
    if (this.mockMode) {
      const mock = `mock-customer-${Date.now()}`;
      this.logger.log(`[MOCK ASAAS] criarClienteAsaas → ${mock}`);
      return mock;
    }
    const { data } = await axios.post(
      `${this.baseUrl}/customers`,
      {
        name: empresa.razaoSocial || empresa.nomeCompleto,
        cpfCnpj: empresa.cpfCnpj,
        email: empresa.email,
        phone: empresa.telefone,
      },
      { headers: this.headers },
    );
    return data.id;
  }

  async gerarCobrancaPix(dto: {
    idAsaasCliente: string;
    valor: number;
    vencimento: string; // YYYY-MM-DD
    descricao?: string;
  }): Promise<{
    id: string;
    linkPagamento: string;
    qrCode: string;
    qrCodeBase64: string;
  }> {
    if (this.mockMode) {
      const mock = {
        id: `mock-payment-${Date.now()}`,
        linkPagamento: 'https://sandbox.asaas.com/mock-link',
        qrCode:
          '00020126580014BR.GOV.BCB.PIX0136mock-key520400005303986540510.005802BR5913OBRA10MOCK6009SAO PAULO62070503***6304ABCD',
        qrCodeBase64:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      };
      this.logger.log(
        `[MOCK ASAAS] gerarCobrancaPix → ${JSON.stringify(mock)}`,
      );
      return mock;
    }
    const { data } = await axios.post(
      `${this.baseUrl}/payments`,
      {
        customer: dto.idAsaasCliente,
        billingType: 'PIX',
        value: dto.valor,
        dueDate: dto.vencimento,
        description: dto.descricao || 'OBRA 10 — Módulos contratados',
      },
      { headers: this.headers },
    );

    const { data: pixData } = await axios.get(
      `${this.baseUrl}/payments/${data.id}/pixQrCode`,
      { headers: this.headers },
    );
    return {
      id: data.id,
      linkPagamento: data.invoiceUrl,
      qrCode: pixData.payload,
      qrCodeBase64: pixData.encodedImage,
    };
  }

  async cobrarCartaoRecorrente(dto: {
    idAsaasCliente: string;
    tokenCartao: string;
    valor: number;
    descricao?: string;
  }): Promise<{ id: string; status: string }> {
    if (this.mockMode) {
      const mock = { id: `mock-card-${Date.now()}`, status: 'CONFIRMED' };
      this.logger.log(
        `[MOCK ASAAS] cobrarCartaoRecorrente → ${JSON.stringify(mock)}`,
      );
      return mock;
    }
    const { data } = await axios.post(
      `${this.baseUrl}/payments`,
      {
        customer: dto.idAsaasCliente,
        billingType: 'CREDIT_CARD',
        value: dto.valor,
        dueDate: new Date().toISOString().split('T')[0],
        description: dto.descricao || 'OBRA 10 — Cobrança mensal',
        creditCardToken: dto.tokenCartao,
      },
      { headers: this.headers },
    );
    return { id: data.id, status: data.status };
  }

  async buscarStatusPagamento(idAsaas: string): Promise<string> {
    if (this.mockMode) {
      this.logger.log(`[MOCK ASAAS] buscarStatusPagamento → PENDING`);
      return 'PENDING';
    }
    const { data } = await axios.get(`${this.baseUrl}/payments/${idAsaas}`, {
      headers: this.headers,
    });
    return data.status;
  }
}
