import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class ExtratoCron {
  private readonly logger = new Logger(ExtratoCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  // Day 5 at 09:00 — monthly statement
  @Cron('0 9 5 * *')
  async handleExtrato() {
    this.logger.log('📊 Enviando extratos mensais...');
    const now = new Date();
    const inicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const fim = new Date(now.getFullYear(), now.getMonth(), 1);

    const tenants = await this.prisma.empresa.findMany({
      where: { ativo: true, email: { not: null }, deletedAt: null },
    });

    for (const empresa of tenants) {
      try {
        const cobrancas = await this.prisma.cobranca.findMany({
          where: {
            empresaId: empresa.id,
            mesReferencia: { gte: inicio, lt: fim },
          },
          select: {
            mesReferencia: true,
            valor: true,
            status: true,
            formaPagamento: true,
          },
        });

        if (cobrancas.length === 0) continue;

        await this.email.enviarExtrataMensal(
          empresa.email!,
          empresa.razaoSocial || empresa.nomeCompleto || 'Empresa',
          cobrancas.map((c) => ({
            mesReferencia: c.mesReferencia,
            valor: Number(c.valor),
            status: c.status,
            formaPagamento: c.formaPagamento,
          })),
        );
        this.logger.log(`📧 Extrato enviado: ${empresa.email}`);
      } catch (err: any) {
        this.logger.error(
          `Erro ao enviar extrato ${empresa.id}: ${err.message}`,
        );
      }
    }
  }
}
