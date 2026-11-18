import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { ObraContextGuard } from '../../core/guards/obra-context.guard';
import { ModuloGuard } from '../../core/guards/modulo.guard';
import { Modulo } from '../../core/decorators/modulo.decorator';
import { EstoqueService } from './estoque.service';
import { CreateEpiEntregaDto } from './dto/estoque.dto';

@Modulo('EPI', 'SEGURANCA', 'MATERIAIS', 'ESTOQUE')
@UseGuards(JwtAuthGuard, ObraContextGuard, ModuloGuard)
@Controller('epi')
export class EpiController {
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

  @Get('entregas')
  listar(@Req() req: any) {
    return this.estoque.listarEntregas(this.empresaId(req), this.obraId(req));
  }

  @Get('entregas/:id')
  obter(@Req() req: any, @Param('id') id: string) {
    return this.estoque.obterEntrega(this.empresaId(req), this.obraId(req), id);
  }

  @Post('entregas')
  criar(@Req() req: any, @Body() dto: CreateEpiEntregaDto) {
    return this.estoque.criarEntrega(
      this.empresaId(req),
      this.obraId(req),
      this.usuarioId(req),
      dto,
    );
  }
}
