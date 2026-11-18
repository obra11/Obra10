import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EstoqueService } from './estoque.service';
import { EstoqueController } from './estoque.controller';
import { EpiController } from './epi.controller';

@Module({
  imports: [PrismaModule],
  controllers: [EstoqueController, EpiController],
  providers: [EstoqueService],
  exports: [EstoqueService],
})
export class EstoqueModule {}
