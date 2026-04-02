import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { TenantExpiryCron } from './tenant-expiry.cron';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { CobrancaModule } from '../cobranca/cobranca.module';

@Module({
  imports: [PrismaModule, EmailModule, CobrancaModule],
  providers: [TenantService, TenantExpiryCron],
  controllers: [TenantController],
  exports: [TenantService],
})
export class TenantModule {}
