import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TokenExpiryCron {
  private readonly logger = new Logger(TokenExpiryCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async clearExpiredTokens() {
    const expiry = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await this.prisma.empresa.updateMany({
      where: {
        tokenVerificacao: { not: null },
        tokenVerificacaoExp: { lt: expiry },
      },
      data: { tokenVerificacao: null, tokenVerificacaoExp: null },
    });
    if (result.count > 0) {
      this.logger.log(
        `🧹 ${result.count} token(s) de verificação expirado(s) limpos.`,
      );
    }
  }
}
