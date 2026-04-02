import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Req, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  async listar(@Req() req: any) {
    this.assertGestorOuAdmin(req);
    return this.usuariosService.findAllByEmpresa(req.user.empresaId);
  }

  @Post()
  async criar(@Body() body: any, @Req() req: any) {
    this.assertGestorOuAdmin(req);
    return this.usuariosService.create(req.user.empresaId, body);
  }

  @Patch(':id')
  async atualizar(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    this.assertGestorOuAdmin(req);
    return this.usuariosService.update(req.user.empresaId, id, body);
  }

  @Patch(':id/modulos')
  async setModulos(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    this.assertGestorOuAdmin(req);
    return this.usuariosService.setModulos(req.user.empresaId, id, body.modulos); // string[]
  }

  @Delete(':id')
  async remover(@Param('id') id: string, @Req() req: any) {
    this.assertGestorOuAdmin(req);
    return this.usuariosService.softDelete(req.user.empresaId, id);
  }

  private assertGestorOuAdmin(req: any) {
    const perfil = req.user?.perfilGlobal;
    if (perfil !== 'SUPER_ADMIN' && perfil !== 'GESTOR') {
      throw new ForbiddenException('Apenas Gestores e Super Admins podem gerenciar usuários.');
    }
  }
}
