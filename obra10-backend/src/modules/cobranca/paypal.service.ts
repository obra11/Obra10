import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly secret: string;
  private readonly mockMode: boolean;

  constructor() {
    const env = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
    this.baseUrl =
      env === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
        
    this.clientId = process.env.PAYPAL_CLIENT_ID || '';
    this.secret = process.env.PAYPAL_SECRET || '';
    this.mockMode = !this.clientId || !this.secret;
    
    if (this.mockMode) {
      this.logger.warn(
        'PAYPAL_CLIENT_ID ou SECRET não configuradas — rotas PayPal recusam pagamento.',
      );
    }
  }

  private assertConfigured() {
    if (this.mockMode) {
      throw new ServiceUnavailableException(
        'Pagamento PayPal não está configurado. Use PIX ou cartão.',
      );
    }
  }

  private async getAccessToken(): Promise<string> {
    this.assertConfigured();

    const auth = Buffer.from(`${this.clientId}:${this.secret}`).toString('base64');
    
    const { data } = await axios.post(
      `${this.baseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return data.access_token;
  }

  /**
   * Cria uma Order (Pedido) no PayPal
   * Retorna o OrderID que o Frontend precisa para renderizar o botão
   */
  async createOrder(valor: number, cobrancaId: string): Promise<{ orderId: string }> {
    this.assertConfigured();

    const token = await this.getAccessToken();

    const { data } = await axios.post(
      `${this.baseUrl}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: cobrancaId,
            description: `Assinatura Obra 10`,
            amount: {
              currency_code: 'BRL',
              value: valor.toFixed(2),
            },
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return { orderId: data.id };
  }

  /**
   * Captura (Efetiva) o pagamento após a aprovação do usuário
   */
  async captureOrder(orderId: string): Promise<{ status: string }> {
    this.assertConfigured();

    const token = await this.getAccessToken();

    const { data } = await axios.post(
      `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return { status: data.status }; // 'COMPLETED'
  }
}
