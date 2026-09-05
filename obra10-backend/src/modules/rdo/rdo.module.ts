import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RdoService } from './rdo.service';
import { RdoController } from './rdo.controller';
import { RdoEmpresaController } from './rdo-empresa.controller';
import { AlertaCron } from './alerta.cron';
import { AlertaController } from './alerta.controller';
import { PdfService } from './pdf.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [ScheduleModule, EmailModule],
  controllers: [RdoEmpresaController, RdoController, AlertaController],
  providers: [RdoService, AlertaCron, PdfService],
  exports: [RdoService],
})
export class RdoModule {}
