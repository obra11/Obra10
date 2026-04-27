import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CobrancaService } from './cobranca.service';
import { AsaasService } from './asaas.service';
import { EmailService } from '../email/email.service';
import { CupomService } from '../cupom/cupom.service';

@Injectable()
export class CobrancaCron {
  private readonly logger = new Logger(CobrancaCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cobrancaService: CobrancaService,
    private readonly asaas: AsaasService,
    private readonly email: EmailService,
    private readonly cupomService: CupomService,
  ) {}

  // Day 1 at 08:00 — generate monthly charges
  @Cron('0 8 1 * *')
  async handleMonthlyBilling() {
    this.logger.log('💳 Iniciando cobrança mensal automática...');
    const now = new Date();
    const mesRef = new Date(now.getFullYear(), now.getMonth(), 1);
    const anoMes = mesRef.toISOString().slice(0, 7);

    const tenants = await this.prisma.empresa.findMany({
      where: { ativo: true, suspensa: false, deletedAt: null },
      include: {
        tenantModulos: { where: { ativo: true }, include: { modulo: true } },
        cartaoSalvo: true,
      },
    });

    for (const empresa of tenants) {
      try {
        const idempotencyKey = `${empresa.id}-${anoMes}`;

        // Idempotency: skip if already charged this month
        const existente = await this.prisma.cobranca.findUnique({
          where: { idempotencyKey },
        });
        if (existente) {
          await this.prisma.auditLog.create({
            data: {
              empresaId: empresa.id,
              usuarioId: empresa.id,
              tabelaAfetada: 'cobrancas',
              registroId: existente.id,
              acao: 'COBRANCA_DUPLICADA_IGNORADA',
              cargaNova: JSON.stringify({
                idempotencyKey,
                motivo: 'Cobrança já existe para este mês',
              }),
            },
          });
          this.logger.log(
            `⏭ ${empresa.razaoSocial || empresa.nomeCompleto} — cobrança já existe para ${anoMes}`,
          );
          continue;
        }

        // Calculate base total from active modules
        const valorBase = empresa.tenantModulos.reduce((sum, tm) => {
          return sum + Number(tm.modulo.preco);
        }, 0);

        // Apply coupon discount if active
        const desconto = await this.cupomService.calcularDesconto(
          empresa.id,
          valorBase,
        );
        const valor = desconto.valorFinal;

        const vencimento = new Date(now.getFullYear(), now.getMonth() + 1, 5);

        // If coupon grants full gratuity, skip Asaas entirely
        if (desconto.pularAsaas) {
          // Create a R$0 paid record for bookkeeping
          await this.prisma.cobranca.create({
            data: {
              empresaId: empresa.id,
              valor: 0,
              status: 'PAGO',
              formaPagamento: 'CUPOM',
              mesReferencia: mesRef,
              dataVencimento: vencimento,
              dataPagamento: new Date(),
              idempotencyKey,
            },
          });
          // Increment month usage and auto-expire if needed
          await this.cupomService.incrementarMesEExpirar(empresa.id);
          this.logger.log(
            `🎟️ ${empresa.razaoSocial || empresa.id} — mês grátis via cupom ${desconto.cupomAplicado}`,
          );
          continue;
        }

        if (valor <= 0) {
          this.logger.log(
            `⚪ ${empresa.razaoSocial || empresa.id} — valor zero, cobrança ignorada`,
          );
          continue;
        }

        let idAsaasCliente = empresa.idAsaas;
        if (!idAsaasCliente) {
          idAsaasCliente = await this.asaas.criarClienteAsaas({
            cpfCnpj: empresa.cpfCnpj || empresa.cnpj || '',
            razaoSocial: empresa.razaoSocial || undefined,
            nomeCompleto: empresa.nomeCompleto || undefined,
            email: empresa.email || '',
          });
          await this.prisma.empresa.update({
            where: { id: empresa.id },
            data: { idAsaas: idAsaasCliente },
          });
        }

        if (empresa.cartaoSalvo) {
          // Charge card automatically
          const result = await this.asaas.cobrarCartaoRecorrente({
            idAsaasCliente,
            tokenCartao: empresa.cartaoSalvo.tokenAsaas,
            valor,
          });
          await this.prisma.cobranca.create({
            data: {
              empresaId: empresa.id,
              valor,
              status: result.status === 'CONFIRMED' ? 'PAGO' : 'PENDENTE',
              formaPagamento: 'CARTAO',
              mesReferencia: mesRef,
              dataVencimento: vencimento,
              dataPagamento: result.status === 'CONFIRMED' ? new Date() : null,
              idAsaas: result.id,
              idempotencyKey,
            },
          });
          if (result.status === 'CONFIRMED' && empresa.email) {
            await this.email.enviarConfirmacaoPagamento(
              empresa.email,
              empresa.razaoSocial || empresa.nomeCompleto || 'Empresa',
              valor,
            );
          }
        } else {
          // Generate PIX + send email
          const pix = await this.asaas.gerarCobrancaPix({
            idAsaasCliente,
            valor,
            vencimento: vencimento.toISOString().split('T')[0],
          });
          await this.prisma.cobranca.create({
            data: {
              empresaId: empresa.id,
              valor,
              status: 'PENDENTE',
              formaPagamento: 'PIX',
              mesReferencia: mesRef,
              dataVencimento: vencimento,
              linkPagamento: pix.linkPagamento,
              qrCode: pix.qrCode,
              qrCodeBase64: pix.qrCodeBase64,
              idAsaas: pix.id,
              idempotencyKey,
            },
          });
          if (empresa.email) {
            await this.email.enviarLinkPix(
              empresa.email,
              empresa.razaoSocial || empresa.nomeCompleto || 'Empresa',
              valor,
              pix.linkPagamento,
              pix.qrCodeBase64,
            );
          }
        }

        // Increment coupon usage for non-free months too (for duracaoMeses tracking)
        if (desconto.cupomAplicado) {
          await this.cupomService.incrementarMesEExpirar(empresa.id);
        }

        this.logger.log(
          `✅ Cobrança gerada: ${empresa.razaoSocial || empresa.id} — R$ ${valor}`,
        );
      } catch (err: any) {
        this.logger.error(`❌ Erro ao cobrar ${empresa.id}: ${err.message}`);
      }
    }

    // Check delinquency: VENCIDO > 5 days → suspensa
    await this.handleDelinquency();
    this.logger.log('✅ Cobrança mensal concluída.');
  }

  async handleDelinquency() {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const vencidas = await this.prisma.cobranca.findMany({
      where: {
        status: 'VENCIDO',
        dataVencimento: { lt: fiveDaysAgo },
        empresa: { suspensa: false },
      },
      include: { empresa: true },
    });

    for (const c of vencidas) {
      const novoDias = c.empresa.diasInadimplente + 1;
      await this.prisma.empresa.update({
        where: { id: c.empresaId },
        data: { suspensa: true, diasInadimplente: novoDias },
      });
      if (c.empresa.email) {
        await this.email.enviarAvisoSuspensao(
          c.empresa.email,
          c.empresa.razaoSocial || c.empresa.nomeCompleto || 'Empresa',
          novoDias,
        );
      }
      this.logger.warn(
        `🔴 Empresa ${c.empresaId} suspensa por inadimplência (${novoDias} dias)`,
      );
    }
  }

  // Reprocess failed webhooks — runs hourly
  @Cron('0 * * * *')
  async retryFailedWebhooks() {
    const failed = await this.prisma.webhookEvent.findMany({
      where: { processado: false, tentativas: { lt: 3 } },
    });
    for (const ev of failed) {
      try {
        const payload = ev.payload as any;
        if (
          payload?.event === 'PAYMENT_RECEIVED' ||
          payload?.event === 'PAYMENT_CONFIRMED'
        ) {
          await this.cobrancaService.confirmarPagamento(payload?.payment?.id);
        }
        await this.prisma.webhookEvent.update({
          where: { id: ev.id },
          data: { processado: true, erro: null },
        });
        this.logger.log(`♻️ Webhook reprocessado: ${ev.idAsaas}`);
      } catch (err: any) {
        await this.prisma.webhookEvent.update({
          where: { id: ev.id },
          data: { tentativas: { increment: 1 }, erro: err.message },
        });
      }
    }
  }
}
