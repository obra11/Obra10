import { Controller, Get, Patch, Post, Delete, Param, Body, UseGuards, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../core/services/crypto.service';
import { SuperAdminGuard } from '../../core/guards/super-admin.guard';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { AtualizarEmpresaAdminDto, ModulosEmpresaAdminDto, CriarEmpresaAdminDto } from './dto/admin.dto';
import * as bcrypt from 'bcrypt';

@Controller('admin/empresas')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminEmpresasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService
  ) {}

  @Get()
  async getEmpresas() {
    const empresas = await this.prisma.empresa.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: { obras: true, usuarios: true, tenantModulos: true }
        },
        cobrancas: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return empresas.map(emp => {
      let documentoStr = emp.cpfCnpj ? this.cryptoService.decrypt(emp.cpfCnpj) : null;
      if (!documentoStr && emp.cnpj) documentoStr = this.cryptoService.decrypt(emp.cnpj);

      return {
        id: emp.id,
        razaoSocial: emp.razaoSocial,
        nomeFantasia: emp.nomeFantasia,
        cnpj: documentoStr,
        plano: emp.plano,
        ativo: emp.ativo,
        createdAt: emp.createdAt,
        totalObras: emp._count.obras,
        totalUsuarios: emp._count.usuarios,
        totalModulos: emp._count.tenantModulos,
        statusPagamento: emp.cobrancas[0]?.status || 'SEM COBRANCA'
      };
    });
  }

  @Post()
  async criarEmpresa(@Body() dto: CriarEmpresaAdminDto) {
    // Verificar se documento já existe
    const docLimpo = dto.documento.replace(/\D/g, '');
    const docEncriptado = this.cryptoService.encrypt(docLimpo);

    // Verificar duplicidade de email do gestor
    const gestorExistente = await this.prisma.usuario.findFirst({
      where: { email: dto.gestorEmail, deletedAt: null }
    });
    if (gestorExistente) {
      throw new ConflictException(`Já existe um usuário com o email ${dto.gestorEmail} no sistema.`);
    }

    const senhaHash = await bcrypt.hash(dto.gestorSenha, 10);

    // Transação: cria empresa + gestor
    const result = await this.prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: {
          razaoSocial: dto.razaoSocial,
          nomeFantasia: dto.nomeFantasia || dto.razaoSocial,
          cpfCnpj: docEncriptado,
          tipoPessoa: dto.tipoPessoa,
          plano: dto.plano || 'BASICO',
          telefone: dto.telefone,
          email: dto.email,
          ativo: true,
        }
      });

      const gestor = await tx.usuario.create({
        data: {
          empresaId: empresa.id,
          nome: dto.gestorNome,
          email: dto.gestorEmail,
          senhaHash,
          telefone: dto.gestorTelefone,
          perfilGlobal: 'GESTOR',
          ativo: true,
        }
      });

      // Ativar todos os módulos para a nova empresa
      const modulos = await tx.modulo.findMany({ where: { ativo: true } });
      for (const mod of modulos) {
        await tx.tenantModulo.create({
          data: {
            empresaId: empresa.id,
            moduloId: mod.id,
            ativo: true,
          }
        });
      }

      return { empresa, gestor: { id: gestor.id, nome: gestor.nome, email: gestor.email } };
    });

    return result;
  }

  @Get(':id')
  async getEmpresa(@Param('id') id: string) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id },
      include: {
        usuarios: true,
        obras: true,
        tenantModulos: {
          include: { modulo: true }
        },
        cupons: {
          include: { cupom: true }
        },
        cobrancas: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    return {
      ...empresa,
      cnpj: empresa.cnpj ? this.cryptoService.decrypt(empresa.cnpj) : null,
      cpfCnpj: empresa.cpfCnpj ? this.cryptoService.decrypt(empresa.cpfCnpj) : null,
    };
  }

  @Get(':id/cobrancas')
  async getCobrancas(@Param('id') id: string) {
    return this.prisma.cobranca.findMany({
      where: { empresaId: id },
      orderBy: { dataVencimento: 'desc' }
    });
  }

  @Get(':id/audit')
  async getAuditLogs(@Param('id') id: string) {
    return this.prisma.auditLog.findMany({
      where: { empresaId: id },
      include: {
        usuario: { select: { nome: true, email: true, perfilGlobal: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200 // Limit for safety
    });
  }

  @Patch(':id')
  async updateEmpresa(@Param('id') id: string, @Body() dto: AtualizarEmpresaAdminDto) {
    return this.prisma.empresa.update({
      where: { id },
      data: dto
    });
  }

  @Post(':id/modulos')
  async ativarModulos(@Param('id') id: string, @Body() dto: ModulosEmpresaAdminDto) {
    const empresa = await this.prisma.empresa.findUnique({ where: { id } });
    if (!empresa) throw new NotFoundException('Empresa não encontrada');

    // Módulos que queremos ativar:
    const modulosNoDb = await this.prisma.modulo.findMany({
      where: { slug: { in: dto.modulos } }
    });

    if (modulosNoDb.length !== dto.modulos.length) {
      throw new BadRequestException('Um ou mais módulos não encontrados no sistema.');
    }

    const novasAtivacoes: any[] = [];
    for (const modulo of modulosNoDb) {
      const ativacao = await this.prisma.tenantModulo.upsert({
        where: {
          empresaId_moduloId: {
            empresaId: id,
            moduloId: modulo.id
          }
        },
        update: { ativo: true },
        create: {
          empresaId: id,
          moduloId: modulo.id,
          ativo: true
        }
      });
      novasAtivacoes.push(ativacao);
    }

    return novasAtivacoes;
  }

  @Delete(':id/modulos/:moduloSlug')
  async desativarModulo(@Param('id') id: string, @Param('moduloSlug') moduloSlug: string) {
    const modulo = await this.prisma.modulo.findUnique({ where: { slug: moduloSlug } });
    if (!modulo) throw new NotFoundException('Módulo não encontrado');

    return this.prisma.tenantModulo.update({
      where: {
        empresaId_moduloId: {
          empresaId: id,
          moduloId: modulo.id
        }
      },
      data: { ativo: false }
    });
  }

  @Patch(':id/bloquear')
  async toggleBloqueio(@Param('id') id: string) {
    const empresa = await this.prisma.empresa.findUnique({ where: { id } });
    if (!empresa) throw new NotFoundException('Empresa não encontrada');

    return this.prisma.empresa.update({
      where: { id },
      data: { ativo: !empresa.ativo }
    });
  }

  @Post(':id/avisar-gestor')
  async avisarGestor(@Param('id') empresaId: string) {
    // Buscar cobranças pendentes/vencidas não notificadas
    const cobrancasPendentes = await this.prisma.cobranca.findMany({
      where: {
        empresaId,
        status: { in: ['PENDENTE', 'VENCIDO', 'OVERDUE'] },
        notificadoEm: null
      }
    });

    if (cobrancasPendentes.length === 0) {
      throw new BadRequestException('Não há cobranças pendentes para notificar.');
    }

    // Marcar todas como notificadas (inclui re-notificação)
    await this.prisma.cobranca.updateMany({
      where: {
        empresaId,
        status: { in: ['PENDENTE', 'VENCIDO', 'OVERDUE'] }
      },
      data: { notificadoEm: new Date() }
    });

    return { 
      message: `Gestor notificado! ${cobrancasPendentes.length} cobrança(s) pendente(s).`,
      total: cobrancasPendentes.length
    };
  }

  @Post('avisar-todos')
  async avisarTodos() {
    // Buscar todas as cobranças pendentes/vencidas de TODAS as empresas
    const result = await this.prisma.cobranca.updateMany({
      where: {
        status: { in: ['PENDENTE', 'VENCIDO', 'OVERDUE'] }
      },
      data: { notificadoEm: new Date() }
    });

    return { 
      message: `Avisos enviados! ${result.count} cobrança(s) de todas as empresas foram marcadas.`,
      total: result.count
    };
  }
}
