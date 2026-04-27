import { Controller, Get, Patch, Param, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SuperAdminGuard } from '../../core/guards/super-admin.guard';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { AtualizarModuloAdminDto } from './dto/admin.dto';

@Controller('admin/modulos')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminModulosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getModulos() {
    return this.prisma.modulo.findMany({
      include: {
        _count: {
          select: { tenantModulos: true }
        }
      },
      orderBy: { grupo: 'asc' }
    });
  }

  @Patch(':id')
  async updateModulo(@Param('id') id: string, @Body() dto: AtualizarModuloAdminDto) {
    const modulo = await this.prisma.modulo.findUnique({ where: { id } });
    if (!modulo) throw new NotFoundException('Módulo não encontrado');

    return this.prisma.modulo.update({
      where: { id },
      data: dto
    });
  }
}
