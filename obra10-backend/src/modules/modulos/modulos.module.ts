import { Module } from '@nestjs/common';
import { ModulosController } from './modulos.controller';
import { ModulosService } from './modulos.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [ModulosController],
  providers: [ModulosService, PrismaService],
  exports: [ModulosService],
})
export class ModulosModule {}
