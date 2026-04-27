import { Controller, Get, Post, Patch, Param, Body, UseGuards, NotFoundException, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SuperAdminGuard } from '../../core/guards/super-admin.guard';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CriarUsuarioAdminDto, AtualizarUsuarioAdminDto } from './dto/admin.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Controller('admin/usuarios')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminUsuariosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getUsuarios(@Query('empresaId') empresaId?: string) {
    const where = empresaId ? { empresaId, deletedAt: null } : { deletedAt: null };
    return this.prisma.usuario.findMany({
      where,
      include: {
        empresa: { select: { razaoSocial: true, nomeFantasia: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200 // Limite de resguardo por performance na grid crua
    });
  }

  @Get(':id')
  async getUsuario(@Param('id') id: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id },
      include: {
        empresa: true
      }
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  @Patch(':id')
  async updateUsuario(@Param('id') id: string, @Body() dto: AtualizarUsuarioAdminDto) {
    return this.prisma.usuario.update({
      where: { id },
      data: dto
    });
  }

  @Patch(':id/bloquear')
  async toggleBloqueio(@Param('id') id: string) {
    const user = await this.prisma.usuario.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    return this.prisma.usuario.update({
      where: { id },
      data: { ativo: !user.ativo }
    });
  }

  @Patch(':id/reset-senha')
  async resetSenha(@Param('id') id: string) {
    const user = await this.prisma.usuario.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    // Gera senha de 8 caracteres alfanuméricos
    const senhaAleatoria = crypto.randomBytes(4).toString('hex');
    const senhaHash = await bcrypt.hash(senhaAleatoria, 10);

    await this.prisma.usuario.update({
      where: { id },
      data: { senhaHash }
    });

    return { 
      message: 'Senha resetada com sucesso. Copie a senha temporária abaixo e envie ao usuário.',
      novaSenhaTemporaria: senhaAleatoria 
    };
  }
}

// Controller separado para criar usuário em empresa específica
@Controller('admin/empresas')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminUsuariosEmpresaController {
  constructor(private readonly prisma: PrismaService) {}

  @Post(':empresaId/usuarios')
  async criarUsuario(
    @Param('empresaId') empresaId: string, 
    @Body() dto: CriarUsuarioAdminDto
  ) {
    const empresa = await this.prisma.empresa.findUnique({ where: { id: empresaId } });
    if (!empresa) throw new NotFoundException('Empresa não encontrada');

    const senhaAleatoria = crypto.randomBytes(4).toString('hex');
    const senhaHash = await bcrypt.hash(senhaAleatoria, 10);

    const novoUsuario = await this.prisma.usuario.create({
      data: {
        empresaId,
        nome: dto.nome,
        email: dto.email,
        senhaHash,
        perfilGlobal: dto.perfilGlobal || 'USER'
      }
    });

    return {
      usuario: novoUsuario,
      senhaTemporaria: senhaAleatoria
    };
  }
}
