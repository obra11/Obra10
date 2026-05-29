import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { AnexosService } from './anexos.service';
import { ObraContextGuard } from '../../core/guards/obra-context.guard';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { SolicitarUploadDto } from './dto/anexos.dto';

@UseGuards(JwtAuthGuard, ObraContextGuard)
@Controller('anexos')
export class AnexosController {
  constructor(private readonly anexosService: AnexosService) {}

  @Post('solicitar-upload')
  async solicitarUpload(@Body() dto: SolicitarUploadDto, @Req() req: any) {
    const obraId = req.headers['x-obra-id'];
    const criadorId = req.user?.sub || 'dev-id';
    return this.anexosService.criarPresignedUpload(obraId, criadorId, dto);
  }

  @Get('origem/:origemAnexo/:attachableId')
  async listarAnexos(
    @Param('origemAnexo') origem: string,
    @Param('attachableId') attachableId: string,
    @Req() req: any,
  ) {
    const obraId = req.headers['x-obra-id'];
    return this.anexosService.listarDaOrigem(obraId, origem, attachableId);
  }

  @Get('obra')
  async listarDaObra(@Req() req: any) {
    const obraId = req.headers['x-obra-id'];
    return this.anexosService.listarDaObra(obraId);
  }

  @Get(':id/visualizar')
  async visualizarSeguro(@Param('id') id: string, @Req() req: any) {
    const obraId = req.headers['x-obra-id'];
    return this.anexosService.gerarViewerUrlSegura(id, obraId);
  }

  @Delete(':id')
  async deletarAnexo(@Param('id') id: string, @Req() req: any) {
    const obraId = req.headers['x-obra-id'];
    return this.anexosService.deletar(id, obraId);
  }
}
