import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CapabilitiesService } from '../../core/capabilities/capabilities.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly capabilities: CapabilitiesService,
  ) {}

  async login(email: string, senhaPlana: string, empresaId: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { empresaId_email: { empresaId, email } },
      include: {
        empresa: {
          include: {
            tenantModulos: {
              where: { ativo: true, modulo: { ativo: true } },
              include: { modulo: true },
            },
            cupons: {
              include: { cupom: true },
            },
            _count: {
              select: { cobrancas: true }
            }
          },
        },
      },
    });

    if (!user || user.ativo === false || user.deletedAt) {
      throw new UnauthorizedException(
        'Credenciais inválidas ou usuário inativo.',
      );
    }

    // Conta só libera após confirmação do e-mail (exceto Super Admin)
    if (
      user.perfilGlobal !== 'SUPER_ADMIN' &&
      user.empresa &&
      user.empresa.emailVerificado === false
    ) {
      throw new UnauthorizedException(
        'E-mail ainda não confirmado. Verifique sua caixa de entrada (e o spam) e clique no link de ativação.',
      );
    }

    // --- Bloqueio de conta por tentativas falhas ---
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedException(
        `Conta temporariamente bloqueada. Tente novamente em ${minutesLeft} minuto(s).`,
      );
    }

    const senhaOk = await bcrypt.compare(senhaPlana, user.senhaHash);

    if (!senhaOk) {
      const newAttempts = user.loginAttempts + 1;
      const updateData: any = { loginAttempts: newAttempts };
      if (newAttempts >= LOCKOUT_THRESHOLD) {
        updateData.lockedUntil = new Date(
          Date.now() + LOCKOUT_MINUTES * 60 * 1000,
        );
        this.logger.warn(
          `[LOCKOUT] Conta bloqueada por ${LOCKOUT_MINUTES}min | email=${email} | tentativas=${newAttempts}`,
        );
      }
      await this.prisma.usuario.update({
        where: { id: user.id },
        data: updateData,
      });
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // Login OK — resetar contadores e registrar último login
    await this.prisma.usuario.update({
      where: { id: user.id },
      data: { 
        loginAttempts: 0, 
        lockedUntil: null,
        ultimoLogin: new Date()
      },
    });

    const caps = await this.capabilities.resolveForUser({
      empresaId: user.empresaId,
      perfilGlobal: user.perfilGlobal,
      capabilitiesOverride: user.capabilities,
    });

    const obrasPermitidas = await this.buildObrasPermitidas(
      user.id,
      user.empresaId,
      caps.acessoTodasObras || user.perfilGlobal === 'SUPER_ADMIN',
      caps,
    );

    const payload = {
      sub: user.id,
      email: user.email,
      empresaId: user.empresaId,
      perfilGlobal: user.perfilGlobal,
      jwtVersion: user.jwtVersion,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      usuario: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        empresaId: user.empresaId,
        perfilGlobal: user.perfilGlobal,
        fotoUrl: user.fotoUrl,
        capabilities: caps,
      },
      empresa: {
        ...user.empresa,
        modulos: (user.empresa?.tenantModulos || []).map((tm) => ({
          slug: tm.modulo.slug,
          nome: tm.modulo.nome,
          sigla: tm.modulo.sigla,
          grupo: tm.modulo.grupo,
        })),
        cupons: user.empresa?.cupons || [],
        cobrancasCount: user.empresa?._count?.cobrancas ?? 0,
      },
      obrasPermitidas,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId, ativo: true, deletedAt: null },
      include: {
        empresa: {
          include: {
            tenantModulos: {
              where: { ativo: true, modulo: { ativo: true } },
              include: { modulo: true },
            },
            cupons: {
              where: { ativo: true },
              include: { cupom: true },
            },
            _count: {
              select: { cobrancas: true }
            }
          },
        },
      },
    });

    if (!user)
      throw new UnauthorizedException('Usuário não encontrado ou inativo.');

    const caps = await this.capabilities.resolveForUser({
      empresaId: user.empresaId,
      perfilGlobal: user.perfilGlobal,
      capabilitiesOverride: user.capabilities,
    });

    const obrasPermitidas = await this.buildObrasPermitidas(
      user.id,
      user.empresaId,
      caps.acessoTodasObras || user.perfilGlobal === 'SUPER_ADMIN',
      caps,
    );

    return {
      usuario: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        empresaId: user.empresaId,
        perfilGlobal: user.perfilGlobal,
        fotoUrl: user.fotoUrl,
        capabilities: caps,
      },
      empresa: {
        ...user.empresa,
        modulos: (user.empresa?.tenantModulos || []).map((tm) => ({
          slug: tm.modulo.slug,
          nome: tm.modulo.nome,
          sigla: tm.modulo.sigla,
          grupo: tm.modulo.grupo,
        })),
        cupons: user.empresa?.cupons || [],
        cobrancasCount: user.empresa?._count?.cobrancas ?? 0,
      },
      obrasPermitidas,
    };
  }

  // ==================== SHARED: OBRAS PERMITIDAS ====================

  private async buildObrasPermitidas(
    userId: string,
    empresaId: string,
    acessoTodasObras: boolean,
    caps?: { aprovarRdo?: boolean; criarEditarRdo?: boolean; modulosPadrao?: Record<string, string> },
  ) {
    const isPrivilegiado = acessoTodasObras;
    const obrasBrutas = isPrivilegiado
      ? await this.prisma.obra.findMany({
          where: { empresaId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
        })
      : await this.prisma.obra.findMany({
          where: {
            empresaId,
            deletedAt: null,
            status: { not: 'INATIVA' },
            userObraRole: { some: { usuarioId: userId } },
          },
          include: { userObraRole: { where: { usuarioId: userId } } },
          orderBy: { createdAt: 'asc' },
        });

    return obrasBrutas.map((obra: any) => {
      const permissoesObj = obra.userObraRole?.[0]?.permissoes || {};
      const privilegiadoPerms =
        caps?.modulosPadrao && Object.keys(caps.modulosPadrao).length > 0
          ? caps.modulosPadrao
          : { RDO: caps?.criarEditarRdo ? 'EDIT' : 'VIEW' };
      return {
        id: obra.id,
        nome: obra.nome,
        endereco: obra.endereco,
        status: obra.status,
        imageUrl: obra.imageUrl,
        minhasPermissoes: isPrivilegiado
          ? ['SUPER']
          : Object.keys(permissoesObj),
        permissoes: isPrivilegiado ? privilegiadoPerms : permissoesObj,
      };
    });
  }

  // ==================== RECUPERAÇÃO DE SENHA ====================

  async esqueciSenha(email: string) {
    const user = await this.prisma.usuario.findFirst({
      where: { email, ativo: true },
    });
    if (!user)
      return {
        success: true,
        message: 'Se o e-mail existir, um link foi enviado.',
      };

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 15);

    await this.prisma.usuario.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExp: expires },
    });

    try {
      await this.emailService.enviarResetSenha(user.email, token, user.nome);
    } catch (err: any) {
      this.logger.error(`[RESET SENHA] Falha ao enviar e-mail de reset: ${err.message}`);
    }

    this.logger.warn(
      `[RESET SENHA] Solicitação de reset emitida para userId=${user.id}`,
    );
    return {
      success: true,
      message: 'Se o e-mail existir, um link de recuperação foi enviado.',
    };
  }

  async redefinirSenha(token: string, novaSenha: string) {
    const user = await this.prisma.usuario.findFirst({
      where: {
        resetToken: token,
        resetTokenExp: { gt: new Date() },
      },
    });

    if (!user) throw new BadRequestException('Token inválido ou expirado.');

    const hash = await bcrypt.hash(novaSenha, 10);
    await this.prisma.usuario.update({
      where: { id: user.id },
      data: {
        senhaHash: hash,
        resetToken: null,
        resetTokenExp: null,
        jwtVersion: { increment: 1 }, // Invalidates all existing sessions
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    this.logger.warn(
      `[RESET SENHA] Senha redefinida + sessões invalidadas para userId=${user.id}`,
    );
    return { success: true, message: 'Senha redefinida com segurança!' };
  }

  // ==================== LGPD ====================

  async getMeusDados(userId: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        perfilGlobal: true,
        fotoUrl: true,
        ativo: true,
        createdAt: true,
        updatedAt: true,
        aceitouTermos: true,
        dataAceite: true,
        empresa: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
        userObraRole: {
          select: {
            obra: { select: { id: true, nome: true } },
            perfil: { select: { nomeInterno: true } },
          },
        },
      },
    });
    if (!user) throw new BadRequestException('Usuário não encontrado.');
    return { dadosPessoais: user, exportadoEm: new Date().toISOString() };
  }

  async anonimizarConta(userId: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });
    if (!user) throw new BadRequestException('Usuário não encontrado.');

    const anonId = crypto.randomUUID().slice(0, 8);
    await this.prisma.usuario.update({
      where: { id: userId },
      data: {
        nome: 'Usuário removido',
        email: `removido-${anonId}@deleted.obra10.com`,
        telefone: null,
        fotoUrl: null,
        senhaHash: 'ANONIMIZADO',
        ativo: false,
        resetToken: null,
        resetTokenExp: null,
        jwtVersion: { increment: 1 }, // Invalidate all sessions
      },
    });

    this.logger.warn(`[LGPD] Conta anonimizada: userId=${userId}`);
    return { success: true };
  }
}
