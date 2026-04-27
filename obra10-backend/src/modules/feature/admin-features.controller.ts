import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, NotFoundException
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../core/guards/super-admin.guard';
import { FeatureService } from './feature.service';
import { CriarFeatureDto, AtualizarFeatureDto, AtribuirFeatureDto } from './dto/feature.dto';

@Controller('admin/features')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminFeaturesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureService: FeatureService
  ) {}

  @Get()
  async listarFeatures() {
    return this.featureService.listAll();
  }

  @Post()
  async criarFeature(@Body() dto: CriarFeatureDto) {
    return this.prisma.featureFlag.create({
      data: {
        codigo: dto.codigo.toUpperCase().replace(/\s+/g, '_'),
        nome: dto.nome,
        descricao: dto.descricao,
        tipo: dto.tipo || 'MODULO',
        versao: dto.versao || '1.0',
      }
    });
  }

  @Patch(':id')
  async atualizarFeature(@Param('id') id: string, @Body() dto: AtualizarFeatureDto) {
    const feature = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!feature) throw new NotFoundException('Feature não encontrada');

    return this.prisma.featureFlag.update({
      where: { id },
      data: {
        ...(dto.nome && { nome: dto.nome }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.versao && { versao: dto.versao }),
      }
    });
  }

  @Patch(':id/toggle')
  async toggleFeature(@Param('id') id: string) {
    const feature = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!feature) throw new NotFoundException('Feature não encontrada');

    return this.prisma.featureFlag.update({
      where: { id },
      data: { ativo: !feature.ativo }
    });
  }

  @Post(':id/empresas')
  async atribuirEmpresas(@Param('id') featureId: string, @Body() dto: AtribuirFeatureDto) {
    const feature = await this.prisma.featureFlag.findUnique({ where: { id: featureId } });
    if (!feature) throw new NotFoundException('Feature não encontrada');

    const results: any[] = [];
    for (const empresaId of dto.empresaIds) {
      const result = await this.prisma.empresaFeature.upsert({
        where: {
          empresaId_featureId: { empresaId, featureId }
        },
        update: { ativo: true },
        create: { empresaId, featureId, ativo: true }
      });
      results.push(result);
    }

    return results;
  }

  @Delete(':id/empresas/:empresaId')
  async removerEmpresa(@Param('id') featureId: string, @Param('empresaId') empresaId: string) {
    return this.prisma.empresaFeature.update({
      where: {
        empresaId_featureId: { empresaId, featureId }
      },
      data: { ativo: false }
    });
  }
}
