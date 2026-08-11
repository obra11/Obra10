import { Controller, Get, Patch, Post, Delete, Param, Body, UseGuards, NotFoundException, BadRequestException, ConflictException, ForbiddenException, Req } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../core/services/crypto.service';
import { SuperAdminGuard } from '../../core/guards/super-admin.guard';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { AtualizarEmpresaAdminDto, ModulosEmpresaAdminDto, CriarEmpresaAdminDto, ConfirmarPagamentoManualAdminDto } from './dto/admin.dto';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../email/email.service';
import { CobrancaService } from '../cobranca/cobranca.service';
import {
  DEFAULT_CAPABILITIES_BY_TIPO,
  PAPEL_NOME_PADRAO,
  PAPEIS_COM_DEFAULT_EDITAVEL,
} from '../../core/capabilities/role-capabilities';

@Controller('admin/empresas')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminEmpresasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly emailService: EmailService,
    private readonly cobrancaService: CobrancaService,
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
        statusPagamento: emp.cobrancas[0]?.status || 'SEM COBRANCA',
        logoUrl: emp.logoUrl
      };
    });
  }

  @Post()
  async criarEmpresa(@Body() dto: CriarEmpresaAdminDto) {
    // Verificar se documento já existe
    const docLimpo = dto.documento.replace(/\D/g, '');
    
    // Verificar duplicidade de documento (decrypted comparison in-memory since columns are encrypted using random IVs)
    const todasEmpresas = await this.prisma.empresa.findMany({
      select: { id: true, cpfCnpj: true, cnpj: true }
    });
    const docExiste = todasEmpresas.some(emp => {
      const decCpfCnpj = emp.cpfCnpj ? this.cryptoService.decrypt(emp.cpfCnpj) : null;
      const decCnpj = emp.cnpj ? this.cryptoService.decrypt(emp.cnpj) : null;
      return decCpfCnpj === docLimpo || decCnpj === docLimpo;
    });
    if (docExiste) {
      throw new ConflictException('Já existe uma empresa cadastrada com este CPF/CNPJ.');
    }

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

      for (const tipo of ['GESTOR', 'COLABORADOR', 'EXTERNO', 'PERSONALIZADO'] as const) {
        const caps = DEFAULT_CAPABILITIES_BY_TIPO[tipo];
        await tx.papelEmpresa.create({
          data: {
            empresaId: empresa.id,
            tipo,
            nome: PAPEL_NOME_PADRAO[tipo],
            capabilities: caps as any,
            permissoesPadrao: caps.modulosPadrao as any,
            editavel: PAPEIS_COM_DEFAULT_EDITAVEL.includes(tipo),
          },
        });
      }

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
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId }
    });
    if (!empresa) throw new NotFoundException('Empresa não encontrada.');

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

    // Buscar gestores da empresa
    const gestores = await this.prisma.usuario.findMany({
      where: {
        empresaId,
        perfilGlobal: 'GESTOR',
        ativo: true,
        deletedAt: null
      }
    });

    // Enviar e-mail para todos os gestores
    for (const cobranca of cobrancasPendentes) {
      const dataVencimentoStr = cobranca.dataVencimento.toLocaleDateString('pt-BR');
      for (const gestor of gestores) {
        try {
          await this.emailService.enviarAvisoCobrancaPendente(
            gestor.email,
            gestor.nome,
            empresa.nomeFantasia || empresa.razaoSocial || 'Empresa',
            Number(cobranca.valor),
            dataVencimentoStr,
            cobranca.linkPagamento
          );
        } catch (err: any) {
          console.error(`Falha ao notificar gestor ${gestor.email}: ${err.message}`);
        }
      }
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
    const cobrancasPendentes = await this.prisma.cobranca.findMany({
      where: {
        status: { in: ['PENDENTE', 'VENCIDO', 'OVERDUE'] },
        notificadoEm: null
      },
      include: {
        empresa: {
          include: {
            usuarios: {
              where: { perfilGlobal: 'GESTOR', ativo: true, deletedAt: null }
            }
          }
        }
      }
    });

    if (cobrancasPendentes.length === 0) {
      return { message: 'Nenhuma cobrança pendente para notificar.', total: 0 };
    }

    // Enviar e-mail para os gestores de cada cobrança
    for (const cobranca of cobrancasPendentes) {
      const dataVencimentoStr = cobranca.dataVencimento.toLocaleDateString('pt-BR');
      const empresa = cobranca.empresa;
      const gestores = empresa.usuarios;

      for (const gestor of gestores) {
        try {
          await this.emailService.enviarAvisoCobrancaPendente(
            gestor.email,
            gestor.nome,
            empresa.nomeFantasia || empresa.razaoSocial || 'Empresa',
            Number(cobranca.valor),
            dataVencimentoStr,
            cobranca.linkPagamento
          );
        } catch (err: any) {
          console.error(`Falha ao notificar gestor ${gestor.email} no envio em lote: ${err.message}`);
        }
      }
    }

    // Marcar todas como notificadas
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

  @Post(':id/cobrancas/:cobrancaId/confirmar-manual')
  async confirmarPagamentoManual(
    @Param('id') empresaId: string,
    @Param('cobrancaId') cobrancaId: string,
    @Body() dto: ConfirmarPagamentoManualAdminDto,
    @Req() req: any
  ) {
    const adminUser = req.user;
    if (!adminUser) throw new ForbiddenException('Usuário não autenticado.');

    // Validar senha do Super Admin
    const usuarioBanco = await this.prisma.usuario.findUnique({
      where: { id: adminUser.sub },
      select: { senhaHash: true },
    });
    if (!usuarioBanco) throw new ForbiddenException('Usuário não encontrado.');

    const senhaOk = await bcrypt.compare(dto.senha, usuarioBanco.senhaHash);
    if (!senhaOk) {
      throw new ForbiddenException('Senha de administrador incorreta.');
    }

    // Validar se cobrança pertence à empresa
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { id: cobrancaId }
    });
    if (!cobranca) throw new NotFoundException('Cobrança não encontrada.');
    if (cobranca.empresaId !== empresaId) {
      throw new BadRequestException('A cobrança não pertence à empresa informada.');
    }

    return this.cobrancaService.confirmarPagamentoManualAdmin(cobrancaId, adminUser.sub);
  }
}
