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
  ForbiddenException,
} from '@nestjs/common';
import { SuporteService } from './suporte.service';
import {
  CreateChamadoDto,
  CreateMensagemChamadoDto,
  UpdateChamadoDto,
} from './dto/chamado.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PerfilGlobal } from '@prisma/client';

@Controller('suporte')
@UseGuards(JwtAuthGuard)
export class SuporteController {
  constructor(private readonly suporteService: SuporteService) {}

  @Post('chamados')
  async criar(@Req() req: any, @Body() dto: CreateChamadoDto) {
    const empresaId = req.user.empresaId || req.user.empresa_id;
    const usuarioId = req.user.sub;
    return this.suporteService.criar(empresaId, usuarioId, dto);
  }

  @Get('chamados')
  async listar(@Req() req: any) {
    const empresaId = req.user.empresaId || req.user.empresa_id;
    const usuarioId = req.user.sub;
    const perfilGlobal = req.user.perfilGlobal;
    return this.suporteService.listar(empresaId, usuarioId, perfilGlobal);
  }

  /** Super Admin — lista global (filtro opcional por status). */
  @Get('admin/chamados')
  async listarAdmin(@Req() req: any, @Query('status') status?: string) {
    if (req.user.perfilGlobal !== PerfilGlobal.SUPER_ADMIN) {
      throw new ForbiddenException('Acesso restrito ao Super Admin.');
    }
    return this.suporteService.listarAdmin(status);
  }

  @Get('chamados/:id')
  async detalhe(@Req() req: any, @Param('id') id: string) {
    const empresaId = req.user.empresaId || req.user.empresa_id;
    const usuarioId = req.user.sub;
    const perfilGlobal = req.user.perfilGlobal;
    return this.suporteService.detalhe(id, empresaId, usuarioId, perfilGlobal);
  }

  @Patch('chamados/:id')
  async atualizar(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateChamadoDto,
  ) {
    const empresaId = req.user.empresaId || req.user.empresa_id;
    const usuarioId = req.user.sub;
    const perfilGlobal = req.user.perfilGlobal;
    return this.suporteService.atualizar(
      id,
      empresaId,
      usuarioId,
      perfilGlobal,
      dto,
    );
  }

  @Post('chamados/:id/mensagens')
  async adicionarMensagem(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CreateMensagemChamadoDto,
  ) {
    const empresaId = req.user.empresaId || req.user.empresa_id;
    const usuarioId = req.user.sub;
    const perfilGlobal = req.user.perfilGlobal;
    return this.suporteService.adicionarMensagem(
      id,
      empresaId,
      usuarioId,
      perfilGlobal,
      dto,
    );
  }
}
