import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AnexosService } from './anexos.service';
import { ObraContextGuard } from '../../core/guards/obra-context.guard';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';


@UseGuards(JwtAuthGuard, ObraContextGuard)
@Controller('anexos')
export class AnexosController {
  constructor(private readonly anexosService: AnexosService) {}

  @Post('solicitar-upload')
  async solicitarUpload(@Body() body: any, @Req() req: any) {
    const obraId = req.headers['x-obra-id'];
    const criadorId = req.user?.sub || 'dev-id';
    return this.anexosService.criarPresignedUpload(obraId, criadorId, body);
  }

  @Get('origem/:origemAnexo/:attachableId')
  async listarAnexos(
    @Param('origemAnexo') origem: string, 
    @Param('attachableId') attachableId: string, 
    @Req() req: any
  ) {
    const obraId = req.headers['x-obra-id'];
    return this.anexosService.listarDaOrigem(obraId, origem, attachableId);
  }

  @Get(':id/visualizar')
  async visualizarSeguro(@Param('id') id: string, @Req() req: any) {
    const obraId = req.headers['x-obra-id'];
    return this.anexosService.gerarViewerUrlSegura(id, obraId);
  }
}
