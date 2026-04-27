import { Controller, Get, Post, Patch, Param, Body, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SuperAdminGuard } from '../../core/guards/super-admin.guard';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CriarCupomAdminDto, AtualizarCupomAdminDto, EnviarCupomAdminDto } from './dto/admin.dto';

@Controller('admin/cupons')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminCuponsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getCupons() {
    return this.prisma.cupomDesconto.findMany({
      orderBy: { codigo: 'asc' }
    });
  }

  @Post()
  async createCupom(@Body() dto: CriarCupomAdminDto) {
    const existe = await this.prisma.cupomDesconto.findUnique({
      where: { codigo: dto.codigo.toUpperCase() }
    });
    
    if (existe) {
      throw new BadRequestException('Já existe um cupom com este código.');
    }

    return this.prisma.cupomDesconto.create({
      data: {
        codigo: dto.codigo.toUpperCase(),
        tipo: dto.tipo,
        valor: dto.valor ? dto.valor : null,
        mesesGratuitos: dto.mesesGratuitos ? dto.mesesGratuitos : null,
        duracaoMeses: dto.duracaoMeses ? dto.duracaoMeses : null,
        usosMaximos: dto.usosMaximos ? dto.usosMaximos : null,
        expiraEm: dto.expiraEm ? new Date(dto.expiraEm) : null,
        ativo: true
      }
    });
  }

  @Patch(':id')
  async updateCupom(@Param('id') id: string, @Body() dto: AtualizarCupomAdminDto) {
    return this.prisma.cupomDesconto.update({
      where: { id },
      data: {
        valor: dto.valor,
        duracaoMeses: dto.duracaoMeses,
        usosMaximos: dto.usosMaximos,
        expiraEm: dto.expiraEm ? new Date(dto.expiraEm) : null,
      }
    });
  }

  @Patch(':id/toggle')
  async toggleCupom(@Param('id') id: string) {
    const cupom = await this.prisma.cupomDesconto.findUnique({ where: { id } });
    if (!cupom) throw new NotFoundException('Cupom não encontrado');

    return this.prisma.cupomDesconto.update({
      where: { id },
      data: { ativo: !cupom.ativo }
    });
  }

  @Post('enviar')
  async enviarCupom(@Body() dto: EnviarCupomAdminDto) {
    const limpo = dto.empresaId.replace(/\D/g, '');

    let empresa: any = null;
    
    // First try by ID if it looks like a UUID
    if (dto.empresaId.length > 20) {
      empresa = await this.prisma.empresa.findUnique({ where: { id: dto.empresaId } });
    }
    
    // Then try by CNPJ or CPF
    if (!empresa) {
      empresa = await this.prisma.empresa.findFirst({
        where: {
          OR: [
            { cnpj: dto.empresaId },
            { cnpj: limpo },
            { cpfCnpj: dto.empresaId },
            { cpfCnpj: limpo }
          ]
        }
      });
    }

    if (!empresa) throw new NotFoundException('Empresa não encontrada com este ID, CNPJ ou CPF.');

    const cupom = await this.prisma.cupomDesconto.findUnique({ where: { id: dto.cupomId } });
    if (!cupom) throw new NotFoundException('Cupom não encontrado');

    const vinculoExistente = await this.prisma.empresaCupom.findUnique({
      where: {
        empresaId_cupomId: {
          empresaId: empresa.id,
          cupomId: dto.cupomId
        }
      }
    });

    if (!vinculoExistente) {
      await this.prisma.empresaCupom.create({
        data: {
          empresaId: empresa.id,
          cupomId: dto.cupomId,
          ativo: true,
          mesesUsados: 0
        }
      });
    }

    return { message: 'Cupom vinculado à conta e notificado à empresa (simulação).' };
  }
}
