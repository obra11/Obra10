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
import { CapabilitiesService } from '../../core/capabilities/capabilities.service';
import {
  CreateUsuarioDto,
  UpdateUsuarioDto,
  SetModulosDto,
  UpdatePerfilDto,
  UpdatePapelEmpresaDto,
} from './dto/usuarios.dto';

@UseGuards(JwtAuthGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly capabilities: CapabilitiesService,
  ) {}

  @Get()
  async listar(@Req() req: any) {
    await this.assertPodeGerenciarUsuarios(req);
    return this.usuariosService.findAllByEmpresa(req.user.empresaId);
  }

  @Get('papeis')
  async listarPapeis(@Req() req: any) {
    await this.assertPodeGerenciarUsuarios(req);
    return this.usuariosService.listPapeis(req.user.empresaId);
  }

  @Patch('papeis/:tipo')
  async atualizarPapel(
    @Param('tipo') tipo: string,
    @Body() dto: UpdatePapelEmpresaDto,
    @Req() req: any,
  ) {
    await this.assertPodeGerenciarUsuarios(req);
    return this.usuariosService.updatePapel(req.user.empresaId, tipo, dto);
  }

  @Post()
  async criar(@Body() dto: CreateUsuarioDto, @Req() req: any) {
    await this.assertPodeGerenciarUsuarios(req);
    return this.usuariosService.create(req.user.empresaId, dto);
  }

  @Patch('perfil')
  async atualizarPerfil(@Req() req: any, @Body() dto: UpdatePerfilDto) {
    const userId = req.user?.sub;
    return this.usuariosService.updatePerfil(userId, dto);
  }

  @Patch(':id')
  async atualizar(
    @Param('id') id: string,
    @Body() dto: UpdateUsuarioDto,
    @Req() req: any,
  ) {
    await this.assertPodeGerenciarUsuarios(req);
    return this.usuariosService.update(req.user.empresaId, id, dto);
  }

  @Patch(':id/modulos')
  async setModulos(
    @Param('id') id: string,
    @Body() dto: SetModulosDto,
    @Req() req: any,
  ) {
    await this.assertPodeGerenciarUsuarios(req);
    return this.usuariosService.setModulos(req.user.empresaId, id, dto.modulos);
  }

  @Delete(':id')
  async remover(@Param('id') id: string, @Req() req: any) {
    await this.assertPodeGerenciarUsuarios(req);
    return this.usuariosService.softDelete(req.user.empresaId, id);
  }

  private async assertPodeGerenciarUsuarios(req: any) {
    const perfil = req.user?.perfilGlobal;
    if (perfil === 'SUPER_ADMIN') return;

    const userId = req.user?.sub;
    const pode = await this.capabilities.hasCapability(
      userId,
      'gerenciarUsuarios',
    );
    if (!pode) {
      throw new ForbiddenException(
        'Você não tem permissão para gerenciar usuários.',
      );
    }
  }
}
