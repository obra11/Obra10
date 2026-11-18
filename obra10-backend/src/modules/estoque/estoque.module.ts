import { Module } from '@nestjs/common';
import { EstoqueController } from './estoque.controller';
import { EstoqueService } from './estoque.service';
import { ExtracaoDocumentoService } from './extracao-documento.service';

@Module({
  controllers: [EstoqueController],
  providers: [EstoqueService, ExtracaoDocumentoService],
  exports: [EstoqueService],
})
export class EstoqueModule {}
