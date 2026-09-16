import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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

const WEBHOOK_EVENTS = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'] as const;

/** Railway trata `$aact_...` como interpolação; a chave pode chegar com `$$`, espaço ou sem `$`. */
function sanitizeAsaasApiKey(raw: string): string {
  let key = String(raw || '').trim().replace(/[\s\r\n]+/g, '');
  while (key.startsWith('$$')) key = key.slice(1);
  if (/^aact_(prod|hmlg)_/i.test(key)) key = `$${key}`;
  return key;
}

@Injectable()
export class AsaasService implements OnModuleInit {
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
    this.apiKey = sanitizeAsaasApiKey(process.env.ASAAS_API_KEY || '');
    this.mockMode = !this.apiKey;
    if (this.mockMode) {
      this.logger.warn('ASAAS_API_KEY não configurada — operando em modo MOCK');
    } else {
      const prefix = this.apiKey.slice(0, 12);
      this.logger.log(
        `Asaas ${env} chave ${prefix}… len=${this.apiKey.length}`,
      );
    }
  }

  get configured(): boolean {
    return !this.mockMode;
  }

  get environment(): string {
    return process.env.ASAAS_ENVIRONMENT || 'sandbox';
  }

  webhookUrl(): string {
    const explicit = (process.env.ASAAS_WEBHOOK_URL || '').trim();
    if (explicit) return explicit.replace(/\/$/, '');
    const origin = (
      process.env.APP_URL ||
      process.env.FRONTEND_URL ||
      'https://obra10.app.br'
    ).replace(/\/$/, '');
    return `${origin}/cobrancas/webhook/asaas`;
  }

  async onModuleInit() {
    await this.ensureWebhook();
  }

  private get headers() {
    return {
      access_token: this.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'Obra10/2.9.26 (https://obra10.app.br)',
    };
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

  /**
   * Cadastra ou atualiza o webhook de pagamento na conta Asaas
   * (PAYMENT_RECEIVED / PAYMENT_CONFIRMED → POST /cobrancas/webhook/asaas).
   */
  async ensureWebhook(): Promise<{ ok: boolean; action: string; url: string; id?: string; error?: string }> {
    const url = this.webhookUrl();
    const token = (process.env.ASAAS_WEBHOOK_TOKEN || '').trim();
    if (this.mockMode) {
      return { ok: false, action: 'skipped_mock', url, error: 'ASAAS_API_KEY ausente' };
    }
    if (token.length < 32) {
      this.logger.warn(
        'ASAAS_WEBHOOK_TOKEN ausente ou com menos de 32 caracteres — webhook não cadastrado.',
      );
      return { ok: false, action: 'skipped_token', url, error: 'ASAAS_WEBHOOK_TOKEN curto ou vazio' };
    }

    const payload = {
      name: 'Obra 10 financeiro',
      url,
      enabled: true,
      interrupted: false,
      authToken: token,
      sendType: 'SEQUENTIALLY' as const,
      events: [...WEBHOOK_EVENTS],
    };

    try {
      const { data } = await axios.get(`${this.baseUrl}/webhooks`, {
        headers: this.headers,
      });
      const list: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      const existing = list.find(
        (w) => String(w?.url || '').replace(/\/$/, '') === url,
      );
      if (existing?.id) {
        await axios.put(`${this.baseUrl}/webhooks/${existing.id}`, payload, {
          headers: this.headers,
        });
        this.logger.log(`Webhook Asaas atualizado (${existing.id}) → ${url}`);
        return { ok: true, action: 'updated', url, id: existing.id };
      }
      const created = await axios.post(`${this.baseUrl}/webhooks`, payload, {
        headers: this.headers,
      });
      this.logger.log(`Webhook Asaas criado (${created.data?.id}) → ${url}`);
      return { ok: true, action: 'created', url, id: created.data?.id };
    } catch (err: any) {
      const detail =
        err?.response?.data?.errors ||
        err?.response?.data ||
        err?.message ||
        err;
      this.logger.error(`Falha ao garantir webhook Asaas: ${JSON.stringify(detail)}`);
      return {
        ok: false,
        action: 'error',
        url,
        error: typeof detail === 'string' ? detail : JSON.stringify(detail),
      };
    }
  }

  async pingConta(): Promise<{ ok: boolean; name?: string; email?: string; error?: string }> {
    if (this.mockMode) return { ok: false, error: 'ASAAS_API_KEY ausente (MOCK)' };
    try {
      const { data } = await axios.get(`${this.baseUrl}/myAccount`, {
        headers: this.headers,
      });
      return {
        ok: true,
        name: data?.name || data?.person?.name,
        email: data?.email || data?.loginEmail,
      };
    } catch (err: any) {
      const msg =
        err?.response?.data?.errors?.[0]?.description ||
        err?.response?.status ||
        err?.message;
      return { ok: false, error: String(msg) };
    }
  }
}
