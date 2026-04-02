import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, senhaPlana: string, empresaId: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { empresaId_email: { empresaId, email } },
      include: {
        empresa: {
          include: {
            tenantModulos: {
              where: { ativo: true },
              include: { modulo: true },
            },
          },
        },
      },
    });

    if (!user || user.ativo === false || user.deletedAt) {
      throw new UnauthorizedException('Credenciais inválidas ou usuário inativo.');
    }

    const senhaOk = await bcrypt.compare(senhaPlana, user.senhaHash);
    if (!senhaOk) throw new UnauthorizedException('Credenciais inválidas.');

    const obrasPermitidas = await this.buildObrasPermitidas(user.id, user.empresaId, user.perfilGlobal);

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
      },
      empresa: {
        ...user.empresa,
        modulos: (user.empresa?.tenantModulos || []).map((tm) => ({
          slug: tm.modulo.slug,
          nome: tm.modulo.nome,
          sigla: tm.modulo.sigla,
          grupo: tm.modulo.grupo,
        })),
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
              where: { ativo: true },
              include: { modulo: true },
            },
          },
        },
      },
    });

    if (!user) throw new UnauthorizedException('Usuário não encontrado ou inativo.');

    const obrasPermitidas = await this.buildObrasPermitidas(user.id, user.empresaId, user.perfilGlobal);

    return {
      usuario: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        empresaId: user.empresaId,
        perfilGlobal: user.perfilGlobal,
        fotoUrl: user.fotoUrl,
      },
      empresa: {
        ...user.empresa,
        modulos: (user.empresa?.tenantModulos || []).map((tm) => ({
          slug: tm.modulo.slug,
          nome: tm.modulo.nome,
          sigla: tm.modulo.sigla,
          grupo: tm.modulo.grupo,
        })),
      },
      obrasPermitidas,
    };
  }

  // ==================== SHARED: OBRAS PERMITIDAS ====================

  private async buildObrasPermitidas(userId: string, empresaId: string, perfilGlobal: string) {
    const isPrivilegiado = perfilGlobal === 'SUPER_ADMIN' || perfilGlobal === 'GESTOR';
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
      return {
        id: obra.id,
        nome: obra.nome,
        endereco: obra.endereco,
        status: obra.status,
        imageUrl: obra.imageUrl,
        minhasPermissoes: isPrivilegiado ? ['SUPER'] : Object.keys(permissoesObj),
      };
    });
  }

  // ==================== RECUPERAÇÃO DE SENHA ====================

  async esqueciSenha(email: string) {
    const user = await this.prisma.usuario.findFirst({ where: { email, ativo: true } });
    if (!user) return { success: true, message: 'Se o e-mail existir, um link foi enviado.' };

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 15);

    await this.prisma.usuario.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExp: expires },
    });

    this.logger.warn(`[RESET SENHA] Solicitação de reset emitida para userId=${user.id}`);
    return { success: true, message: 'Se o e-mail existir, um link de recuperação foi enviado.' };
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
      data: { senhaHash: hash, resetToken: null, resetTokenExp: null },
    });

    this.logger.warn(`[RESET SENHA] Senha redefinida com sucesso para userId=${user.id}`);
    return { success: true, message: 'Senha redefinida com segurança!' };
  }
}

