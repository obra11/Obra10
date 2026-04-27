import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantExpiryCron {
  private readonly logger = new Logger(TenantExpiryCron.name);

  constructor(private readonly prisma: PrismaService) {}

  // Runs daily at 02:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleModuleExpiry() {
    this.logger.log('⏱ Running module expiry check...');

    const expiredModules = await this.prisma.tenantModulo.findMany({
      where: {
        ativo: true,
        expiresAt: { lt: new Date() },
      },
      include: { empresa: true, modulo: true },
    });

    if (expiredModules.length === 0) {
      this.logger.log('✅ No expired modules found.');
      return;
    }

    for (const tm of expiredModules) {
      await this.prisma.$transaction([
        this.prisma.tenantModulo.update({
          where: { id: tm.id },
          data: { ativo: false },
        }),
        this.prisma.auditLog.create({
          data: {
            empresaId: tm.empresaId,
            usuarioId: tm.empresaId, // System action — no user
            tabelaAfetada: 'tenant_modulos',
            registroId: tm.id,
            acao: 'SOFT_DELETE',
            cargaAntiga: JSON.stringify({
              ativo: true,
              expiresAt: tm.expiresAt,
            }),
            cargaNova: JSON.stringify({
              ativo: false,
              motivo: 'MODULE_EXPIRED',
              slug: tm.modulo.slug,
              empresa: tm.empresa.razaoSocial,
              expiredAt: tm.expiresAt,
            }),
          },
        }),
      ]);

      this.logger.warn(
        `🔴 Module "${tm.modulo.slug}" expired for "${tm.empresa.razaoSocial}" — deactivated.`,
      );
    }

    this.logger.log(
      `✅ ${expiredModules.length} expired module(s) deactivated.`,
    );
  }
}
