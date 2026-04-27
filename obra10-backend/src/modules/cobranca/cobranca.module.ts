import { Module } from '@nestjs/common';
import { CobrancaService } from './cobranca.service';
import { CobrancaController } from './cobranca.controller';
import { CobrancaCron } from './cobranca.cron';
import { ExtratoCron } from './extrato.cron';
import { TokenExpiryCron } from './token-expiry.cron';
import { AsaasService } from './asaas.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { CupomModule } from '../cupom/cupom.module';

@Module({
  imports: [PrismaModule, EmailModule, CupomModule],
  providers: [
    CobrancaService,
    AsaasService,
    CobrancaCron,
    ExtratoCron,
    TokenExpiryCron,
  ],
  controllers: [CobrancaController],
  exports: [CobrancaService, AsaasService],
})
export class CobrancaModule {}
