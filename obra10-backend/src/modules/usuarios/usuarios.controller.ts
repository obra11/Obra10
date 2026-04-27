import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import {
  CreateUsuarioDto,
  UpdateUsuarioDto,
  SetModulosDto,
} from './dto/usuarios.dto';

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
  async criar(@Body() dto: CreateUsuarioDto, @Req() req: any) {
    this.assertGestorOuAdmin(req);
    return this.usuariosService.create(req.user.empresaId, dto);
  }

  @Patch(':id')
  async atualizar(
    @Param('id') id: string,
    @Body() dto: UpdateUsuarioDto,
    @Req() req: any,
  ) {
    this.assertGestorOuAdmin(req);
    return this.usuariosService.update(req.user.empresaId, id, dto);
  }

  @Patch(':id/modulos')
  async setModulos(
    @Param('id') id: string,
    @Body() dto: SetModulosDto,
    @Req() req: any,
  ) {
    this.assertGestorOuAdmin(req);
    return this.usuariosService.setModulos(req.user.empresaId, id, dto.modulos);
  }

  @Delete(':id')
  async remover(@Param('id') id: string, @Req() req: any) {
    this.assertGestorOuAdmin(req);
    return this.usuariosService.softDelete(req.user.empresaId, id);
  }

  private assertGestorOuAdmin(req: any) {
    const perfil = req.user?.perfilGlobal;
    if (perfil !== 'SUPER_ADMIN' && perfil !== 'GESTOR') {
      throw new ForbiddenException(
        'Apenas Gestores e Super Admins podem gerenciar usuários.',
      );
    }
  }
}
