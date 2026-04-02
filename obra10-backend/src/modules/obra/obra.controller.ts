import { Controller, Get, Post, Delete, Patch, Body, Param, Req, UnauthorizedException, BadRequestException, ForbiddenException, UseGuards } from '@nestjs/common';
import { ObraService } from './obra.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('obras')
export class ObraController {
  constructor(private readonly obraService: ObraService) {}

  @Get('minhas')
  async getMinhasObras(@Req() req: any) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('Usuário não identificado no escopo global.');
    return this.obraService.listarObrasDoUsuario(userId);
  }

  @Post()
  async criarObra(@Req() req: any, @Body() body: { nome: string; endereco?: string }) {
    const userId = req.user?.sub;
    const empresaId = req.user?.empresaId;
    if (!userId || !empresaId) throw new UnauthorizedException('Sessão inválida.');
    if (!body.nome) throw new BadRequestException('O nome da obra é obrigatório.');
    return this.obraService.criarObra(empresaId, userId, body);
  }

  @Delete(':id')
  async excluirObra(@Req() req: any, @Param('id') id: string) {
    try {
      const empresaId = req.user?.empresaId;
      if (!empresaId) throw new UnauthorizedException('Sessão inválida.');
      return await this.obraService.excluirObra(id, empresaId);
    } catch (err: any) {
      throw new BadRequestException('Erro ao excluir: ' + err.message);
    }
  }

  @Patch(':id')
  async editarObra(@Req() req: any, @Param('id') id: string, @Body() body: { nome?: string; endereco?: string; status?: string }) {
    try {
      const empresaId = req.user?.empresaId;
      if (!empresaId) throw new UnauthorizedException('Sessão inválida.');
      return await this.obraService.editarObra(id, empresaId, body);
    } catch (err: any) {
      throw new BadRequestException('Erro ao editar: ' + err.message);
    }
  }

  // ==================== COLABORADORES DA OBRA (EFETIVO) ====================

  @Get(':id/colaboradores')
  async listarColaboradores(@Param('id') id: string, @Req() req: any) {
    const empresaId = req.user?.empresaId;
    if (!empresaId) throw new UnauthorizedException('Sessão inválida.');
    try {
      return await this.obraService.listarColaboradores(id, empresaId);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Obra não encontrada ou sem acesso.');
    }
  }

  @Post(':id/colaboradores')
  async adicionarColaborador(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    const empresaId = req.user?.empresaId;
    if (req.user?.perfilGlobal !== 'GESTOR') throw new ForbiddenException('Apenas Gestor pode gerenciar efetivo.');
    return this.obraService.adicionarColaborador(id, empresaId, body);
  }

  @Patch(':id/colaboradores/:usuarioId')
  async editarColaborador(@Param('id') id: string, @Param('usuarioId') usuarioId: string, @Req() req: any, @Body() body: any) {
    const empresaId = req.user?.empresaId;
    if (req.user?.perfilGlobal !== 'GESTOR') throw new ForbiddenException('Apenas Gestor pode gerenciar efetivo.');
    return this.obraService.editarColaborador(id, empresaId, usuarioId, body);
  }

  @Delete(':id/colaboradores/:usuarioId')
  async removerColaborador(@Param('id') id: string, @Param('usuarioId') usuarioId: string, @Req() req: any) {
    const empresaId = req.user?.empresaId;
    if (req.user?.perfilGlobal !== 'GESTOR') throw new ForbiddenException('Apenas Gestor pode gerenciar efetivo.');
    return this.obraService.removerColaborador(id, empresaId, usuarioId);
  }
}
