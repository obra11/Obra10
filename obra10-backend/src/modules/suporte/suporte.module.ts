import { Module } from '@nestjs/common';
import { SuporteService } from './suporte.service';
import { SuporteController } from './suporte.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SuporteController],
  providers: [SuporteService],
  exports: [SuporteService],
})
export class SuporteModule {}
