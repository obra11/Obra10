import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export type AsaasPaymentInfo = {
  id: string;
  status: string;
  value: number;
  netValue: number | null;
  invoiceUrl?: string;
};

export type AsaasInvoiceInfo = {
  id: string;
  status: string;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  payment?: string | null;
};

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

  get nfEnabled(): boolean {
    return (
      !this.mockMode &&
      (process.env.ASAAS_NF_ENABLED || '').toLowerCase() === 'true'
    );
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
    const info = await this.buscarPagamento(idAsaas);
    return info?.status || 'PENDING';
  }

  async buscarPagamento(idAsaas: string): Promise<AsaasPaymentInfo | null> {
    if (this.mockMode) {
      this.logger.log(`[MOCK ASAAS] buscarPagamento → mock net`);
      return {
        id: idAsaas,
        status: 'RECEIVED',
        value: 0,
        netValue: 0,
      };
    }
    try {
      const { data } = await axios.get(`${this.baseUrl}/payments/${idAsaas}`, {
        headers: this.headers,
      });
      const value = Number(data.value || 0);
      const net =
        data.netValue != null && data.netValue !== ''
          ? Number(data.netValue)
          : null;
      return {
        id: data.id,
        status: data.status,
        value,
        netValue: net != null && !Number.isNaN(net) ? net : null,
        invoiceUrl: data.invoiceUrl,
      };
    } catch (err: any) {
      this.logger.warn(
        `Falha ao buscar payment ${idAsaas}: ${err?.message || err}`,
      );
      return null;
    }
  }

  /**
   * Agenda NFS-e atrelada a um payment Asaas.
   * Requer ASAAS_NF_ENABLED=true e serviço municipal configurado.
   */
  async agendarNotaFiscal(dto: {
    paymentId: string;
    valor: number;
    serviceDescription?: string;
  }): Promise<AsaasInvoiceInfo | null> {
    if (!this.nfEnabled) return null;

    const municipalServiceId = process.env.ASAAS_MUNICIPAL_SERVICE_ID || '';
    const municipalServiceCode = process.env.ASAAS_MUNICIPAL_SERVICE_CODE || '';
    const municipalServiceName =
      process.env.ASAAS_MUNICIPAL_SERVICE_NAME || 'Serviços de tecnologia';
    const observations =
      process.env.ASAAS_NF_OBSERVATIONS ||
      'Licença de uso de software Obra 10';
    const serviceDescription =
      dto.serviceDescription ||
      process.env.ASAAS_NF_SERVICE_DESCRIPTION ||
      'Assinatura Obra 10 — módulos contratados';

    if (!municipalServiceId && !municipalServiceCode) {
      this.logger.warn(
        'ASAAS_NF_ENABLED mas falta ASAAS_MUNICIPAL_SERVICE_ID ou CODE — NF não agendada.',
      );
      return null;
    }

    const effectiveDate = new Date().toISOString().slice(0, 10);
    const body: Record<string, unknown> = {
      payment: dto.paymentId,
      serviceDescription,
      observations,
      value: dto.valor,
      deductions: 0,
      effectiveDate,
      municipalServiceName,
    };
    if (municipalServiceId) body.municipalServiceId = municipalServiceId;
    if (municipalServiceCode) body.municipalServiceCode = municipalServiceCode;

    try {
      const { data } = await axios.post(`${this.baseUrl}/invoices`, body, {
        headers: this.headers,
      });
      return {
        id: data.id,
        status: data.status,
        pdfUrl: data.pdfUrl || null,
        xmlUrl: data.xmlUrl || null,
        payment: data.payment || dto.paymentId,
      };
    } catch (err: any) {
      const detail =
        err?.response?.data?.errors ||
        err?.response?.data ||
        err?.message ||
        err;
      this.logger.error(
        `Falha ao agendar NF para payment ${dto.paymentId}: ${JSON.stringify(detail)}`,
      );
      return null;
    }
  }

  async buscarNotaFiscal(idNota: string): Promise<AsaasInvoiceInfo | null> {
    if (this.mockMode) return null;
    try {
      const { data } = await axios.get(`${this.baseUrl}/invoices/${idNota}`, {
        headers: this.headers,
      });
      return {
        id: data.id,
        status: data.status,
        pdfUrl: data.pdfUrl || null,
        xmlUrl: data.xmlUrl || null,
        payment: data.payment || null,
      };
    } catch (err: any) {
      this.logger.warn(`Falha ao buscar invoice ${idNota}: ${err?.message}`);
      return null;
    }
  }
}
