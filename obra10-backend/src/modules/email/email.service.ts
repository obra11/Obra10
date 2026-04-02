import { Injectable, Logger } from '@nestjs/common';

// Conditional mock for Resend when API key not set
let ResendClass: any;
try { ResendClass = require('resend').Resend; } catch { ResendClass = null; }

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: any;
  private readonly from: string;
  private readonly appUrl: string;
  private readonly mockMode: boolean;

  constructor() {
    this.from = process.env.EMAIL_FROM || 'noreply@obra10.com.br';
    this.appUrl = process.env.APP_URL || 'http://localhost:5173';
    const apiKey = process.env.RESEND_API_KEY;
    this.mockMode = !apiKey || apiKey === '';
    if (!this.mockMode && ResendClass) {
      this.resend = new ResendClass(apiKey);
    }
  }

  private async send(to: string, subject: string, html: string) {
    if (this.mockMode) {
      this.logger.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`);
      this.logger.log(`[MOCK EMAIL] Preview: ${html.replace(/<[^>]+>/g, '').slice(0, 200)}`);
      return { id: 'mock-email-id' };
    }
    return this.resend.emails.send({ from: this.from, to, subject, html });
  }

  async enviarVerificacaoEmail(email: string, token: string, nomeEmpresa: string) {
    const link = `${this.appUrl}/verificar-email?token=${token}`;
    await this.send(email, '✅ Verifique seu e-mail — OBRA 10', `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#dc2626">Bem-vindo ao OBRA 10!</h2>
        <p>Olá, <strong>${nomeEmpresa}</strong>!</p>
        <p>Clique no botão abaixo para verificar seu e-mail e ativar sua conta:</p>
        <a href="${link}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
          Verificar E-mail
        </a>
        <p style="color:#6b7280;font-size:12px">Este link expira em 24 horas. Se você não criou uma conta, ignore este e-mail.</p>
        <p style="color:#6b7280;font-size:12px">Ou copie: ${link}</p>
      </div>
    `);
  }

  async enviarBoasVindas(email: string, nomeEmpresa: string) {
    await this.send(email, '🎉 Conta ativa — OBRA 10', `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#dc2626">Conta verificada com sucesso!</h2>
        <p>Olá, <strong>${nomeEmpresa}</strong>!</p>
        <p>Seu e-mail foi verificado. Agora escolha os módulos que deseja contratar e comece a usar o OBRA 10.</p>
        <a href="${this.appUrl}/contratacao" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
          Escolher Módulos
        </a>
      </div>
    `);
  }

  async enviarLinkPix(email: string, nomeEmpresa: string, valor: number, linkPagamento: string, qrCode?: string) {
    await this.send(email, '💳 Seu PIX para ativar os módulos — OBRA 10', `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#dc2626">Pagamento via PIX</h2>
        <p>Olá, <strong>${nomeEmpresa}</strong>!</p>
        <p>Valor: <strong>R$ ${valor.toFixed(2)}</strong></p>
        ${qrCode ? `<img src="${qrCode}" alt="QR Code PIX" style="max-width:200px;margin:16px 0" />` : ''}
        <p>Ou use o link de pagamento:</p>
        <a href="${linkPagamento}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
          Pagar via PIX
        </a>
        <p style="color:#6b7280;font-size:12px">Após o pagamento, seus módulos serão ativados automaticamente em até 2 minutos.</p>
      </div>
    `);
  }

  async enviarConfirmacaoPagamento(email: string, nomeEmpresa: string, valor: number) {
    await this.send(email, '✅ Pagamento confirmado — OBRA 10', `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#16a34a">Pagamento confirmado!</h2>
        <p>Olá, <strong>${nomeEmpresa}</strong>!</p>
        <p>Recebemos seu pagamento de <strong>R$ ${valor.toFixed(2)}</strong>. Seus módulos estão ativos!</p>
        <a href="${this.appUrl}/dashboard" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
          Acessar OBRA 10
        </a>
      </div>
    `);
  }

  async enviarAvisoSuspensao(email: string, nomeEmpresa: string, diasVencido: number) {
    await this.send(email, '⚠️ Conta suspensa por inadimplência — OBRA 10', `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#f59e0b">Conta suspensa</h2>
        <p>Olá, <strong>${nomeEmpresa}</strong>!</p>
        <p>Sua conta foi suspensa após <strong>${diasVencido} dias</strong> de inadimplência.</p>
        <p>Para reativar, efetue o pagamento da cobrança pendente:</p>
        <a href="${this.appUrl}/gestor/financeiro" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
          Regularizar Pagamento
        </a>
      </div>
    `);
  }

  async enviarExtrataMensal(
    email: string,
    nomeEmpresa: string,
    cobrancas: Array<{ mesReferencia: Date; valor: number; status: string; formaPagamento: string }>,
  ) {
    const rows = cobrancas.map(c => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb">${c.mesReferencia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb">R$ ${c.valor.toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb">${c.formaPagamento}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;color:${c.status === 'PAGO' ? '#16a34a' : c.status === 'VENCIDO' ? '#dc2626' : '#f59e0b'}">${c.status}</td>
      </tr>
    `).join('');

    const total = cobrancas.reduce((s, c) => s + c.valor, 0);
    await this.send(email, `📊 Extrato mensal — OBRA 10`, `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#dc2626">Extrato Mensal — ${nomeEmpresa}</h2>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f3f4f6">
            <th style="padding:8px;text-align:left">Mês</th>
            <th style="padding:8px;text-align:left">Valor</th>
            <th style="padding:8px;text-align:left">Forma</th>
            <th style="padding:8px;text-align:left">Status</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr>
            <td colspan="3" style="padding:8px;font-weight:bold">Total</td>
            <td style="padding:8px;font-weight:bold">R$ ${total.toFixed(2)}</td>
          </tr></tfoot>
        </table>
      </div>
    `);
  }

  /** Notifica o criador do RDO que seu RDO foi rejeitado com o motivo. */
  async sendRejeicaoRdo(email: string, nomeUsuario: string, dataReferencia: string, motivo: string) {
    await this.send(email, '❌ RDO Rejeitado — OBRA 10', `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#dc2626">RDO Rejeitado</h2>
        <p>Olá, <strong>${nomeUsuario}</strong>!</p>
        <p>O RDO de <strong>${dataReferencia}</strong> foi <strong style="color:#dc2626">rejeitado</strong> pelo gestor da obra.</p>
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;margin:16px 0">
          <p style="margin:0;font-weight:bold">Motivo da rejeição:</p>
          <p style="margin:8px 0 0">${motivo}</p>
        </div>
        <p>Por favor, acesse o OBRA 10, revise as pendências e reabra o RDO para correção.</p>
        <a href="${this.appUrl}/dashboard" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
          Acessar OBRA 10
        </a>
      </div>
    `);
  }

  /** E-mail genérico para notificações de cron (alertas, lembretes). */
  async sendGenerico(email: string, nomeUsuario: string, assunto: string, corpoHtml: string) {
    await this.send(email, assunto, `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#dc2626">OBRA 10</h2>
        <p>Olá, <strong>${nomeUsuario}</strong>!</p>
        ${corpoHtml}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#9ca3af;font-size:12px">Esta é uma notificação automática do OBRA 10. Não responda este e-mail.</p>
      </div>
    `);
  }

  /** Notifica o aprovador que existe um RDO aguardando revisão. */
  async sendAprovacaoRdoPendente(
    emailAprovador: string,
    nomeAprovador: string,
    nomeCriador: string,
    nomeObra: string,
    dataReferencia: string,
    obraId: string,
    rdoId: string,
  ) {
    const link = `${this.appUrl}/obras/${obraId}/rdos/${rdoId}`;
    await this.send(emailAprovador, `📋 RDO aguardando sua aprovação — ${nomeObra}`, `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#dc2626">RDO Pendente de Aprovação</h2>
        <p>Olá, <strong>${nomeAprovador}</strong>!</p>
        <p><strong>${nomeCriador}</strong> submeteu um Diário de Obra referente a <strong>${dataReferencia}</strong> na obra <strong>${nomeObra}</strong> e aguarda a sua revisão.</p>
        <a href="${link}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
          Revisar RDO
        </a>
        <p style="color:#6b7280;font-size:12px">Caso não consiga clicar no botão, copie o link: ${link}</p>
      </div>
    `);
  }
}
