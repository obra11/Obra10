import { Module } from '@nestjs/common';
import { CupomService } from './cupom.service';
import { CupomController } from './cupom.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CupomService],
  controllers: [CupomController],
  exports: [CupomService],
})
export class CupomModule {}
