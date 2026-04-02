import { Module } from '@nestjs/common';
import { AnexosService } from './anexos.service';
import { AnexosController } from './anexos.controller';

@Module({
  controllers: [AnexosController],
  providers: [AnexosService],
})
export class AnexosModule {}
