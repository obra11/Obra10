import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TipoEstoqueItem } from '@prisma/client';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { ObraContextGuard } from '../../core/guards/obra-context.guard';
import { ModuloGuard } from '../../core/guards/modulo.guard';
import { Modulo } from '../../core/decorators/modulo.decorator';
import { EstoqueService } from './estoque.service';
import {
  CreateEstoqueItemDto,
  MovimentarEstoqueDto,
  UpdateEstoqueItemDto,
} from './dto/estoque.dto';

@Modulo('MATERIAIS', 'ESTOQUE', 'EPI', 'SEGURANCA')
@UseGuards(JwtAuthGuard, ObraContextGuard, ModuloGuard)
@Controller('estoque')
export class EstoqueController {
  constructor(private readonly estoque: EstoqueService) {}

  private empresaId(req: any) {
    return req.user.empresaId || req.user.empresa_id;
  }

  private usuarioId(req: any) {
    return req.user.sub || req.user.id;
  }

  private obraId(req: any) {
    return req.headers['x-obra-id'] || req.obraRole?.obraId;
  }

  @Get('itens')
  listar(
    @Req() req: any,
    @Query('tipo') tipo?: TipoEstoqueItem,
  ) {
    return this.estoque.listarItens(this.empresaId(req), this.obraId(req), tipo);
  }

  @Post('itens')
  criar(@Req() req: any, @Body() dto: CreateEstoqueItemDto) {
    return this.estoque.criarItem(this.empresaId(req), this.obraId(req), dto);
  }

  @Patch('itens/:id')
  atualizar(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateEstoqueItemDto,
  ) {
    return this.estoque.atualizarItem(
      this.empresaId(req),
      this.obraId(req),
      id,
      dto,
    );
  }

  @Get('itens/:id/movimentos')
  movimentos(@Req() req: any, @Param('id') id: string) {
    return this.estoque.listarMovimentos(
      this.empresaId(req),
      this.obraId(req),
      id,
    );
  }

  @Post('itens/:id/movimentos')
  movimentar(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: MovimentarEstoqueDto,
  ) {
    return this.estoque.movimentar(
      this.empresaId(req),
      this.obraId(req),
      id,
      this.usuarioId(req),
      dto,
    );
  }
}
