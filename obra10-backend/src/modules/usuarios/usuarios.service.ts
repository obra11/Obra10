import {
  Injectable, BadRequestException, NotFoundException,
  ForbiddenException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByEmpresa(empresaId: string) {
    return this.prisma.usuario.findMany({
      where: { empresaId, deletedAt: null },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        perfilGlobal: true,
        ativo: true,
        createdAt: true,
        fotoUrl: true,
        usuarioModulos: {
          include: { modulo: { select: { slug: true, nome: true } } },
        },
        userObraRole: {
          include: { obra: { select: { id: true, nome: true, status: true } } }
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(empresaId: string, dto: any) {
    const { nome, email, senha, perfilGlobal, telefone } = dto;
    if (!nome || !email || !senha) {
      throw new BadRequestException('nome, email e senha são obrigatórios.');
    }

    // Validate limiteUsuarios
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      include: { _count: { select: { usuarios: { where: { deletedAt: null } } } } },
    });
    if (!empresa) throw new NotFoundException('Empresa não encontrada.');

    if (empresa._count.usuarios >= empresa.limiteUsuarios) {
      throw new ForbiddenException(
        `Limite de ${empresa.limiteUsuarios} usuários do plano ${empresa.plano} atingido. Faça upgrade para adicionar mais usuários.`,
      );
    }

    // Check email uniqueness within tenant (including soft-deleted ones)
    const existenteAtivo = await this.prisma.usuario.findFirst({
      where: { empresaId, email, deletedAt: null },
    });
    if (existenteAtivo) throw new ConflictException(`E-mail "${email}" já está em uso nesta empresa.`);

    const usuarioDeletado = await this.prisma.usuario.findFirst({
      where: { empresaId, email, deletedAt: { not: null } },
    });

    const senhaHash = await bcrypt.hash(senha, 12);
    
    // Auto-assign active tenant modules
    const tenantModulosAtivos = await this.prisma.tenantModulo.findMany({
      where: {
        empresaId,
        ativo: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { moduloId: true }
    });

    if (usuarioDeletado) {
      // Re-ativa o usuário ao invés de criar um novo e gerar erro de unique constraint
      return this.prisma.usuario.update({
        where: { id: usuarioDeletado.id },
        data: {
          nome,
          senhaHash,
          telefone,
          perfilGlobal: perfilGlobal ?? 'USER',
          ativo: true,
          deletedAt: null,
          usuarioModulos: {
            deleteMany: {},
            create: tenantModulosAtivos.map(m => ({ moduloId: m.moduloId }))
          }
        },
        select: { id: true, nome: true, email: true, perfilGlobal: true, createdAt: true, fotoUrl: true },
      });
    }

    return this.prisma.usuario.create({
      data: {
        empresaId,
        nome,
        email,
        senhaHash,
        telefone,
        perfilGlobal: perfilGlobal ?? 'USER',
        ativo: true,
        usuarioModulos: {
          create: tenantModulosAtivos.map(m => ({ moduloId: m.moduloId }))
        }
      },
      select: { id: true, nome: true, email: true, perfilGlobal: true, createdAt: true, fotoUrl: true },
    });
  }

  async update(empresaId: string, id: string, dto: any) {
    const { nome, email, perfilGlobal, telefone } = dto;
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, empresaId, deletedAt: null },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado.');

    if (email && email !== usuario.email) {
      const existente = await this.prisma.usuario.findFirst({
        where: { empresaId, email, deletedAt: null, id: { not: id } },
      });
      if (existente) throw new ConflictException(`E-mail "${email}" já está em uso nesta empresa.`);
    }

    // Se o perfil mudar de GESTOR para USER e a empresa só tiver 1 gestor, isso pode causar problema, mas vamos simplificar por agora.
    return this.prisma.usuario.update({
      where: { id },
      data: {
        ...(nome && { nome }),
        ...(email && { email }),
        ...(perfilGlobal && { perfilGlobal }),
        ...(telefone !== undefined && { telefone }),
      },
      select: { id: true, nome: true, email: true, perfilGlobal: true, createdAt: true, fotoUrl: true },
    });
  }

  async setModulos(empresaId: string, usuarioId: string, moduloSlugs: string[]) {
    // Confirm user belongs to this tenant
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, empresaId, deletedAt: null },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado nesta empresa.');

    // Get modules contracted by the tenant
    const tenantModulosAtivos = await this.prisma.tenantModulo.findMany({
      where: {
        empresaId,
        ativo: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { modulo: true },
    });

    const slugsPermitidos = tenantModulosAtivos.map((tm) => tm.modulo.slug);
    const slugsInvalidos = moduloSlugs.filter((s) => !slugsPermitidos.includes(s));
    if (slugsInvalidos.length > 0) {
      throw new ForbiddenException(
        `Os módulos [${slugsInvalidos.join(', ')}] não estão contratados pelo seu plano.`,
      );
    }

    // Replace all user modules atomically
    const modulosIds = tenantModulosAtivos
      .filter((tm) => moduloSlugs.includes(tm.modulo.slug))
      .map((tm) => tm.moduloId);

    // Fetch user's current obra roles to strip revoked modules
    const roles = await this.prisma.userObraRole.findMany({ where: { usuarioId } });
    const roleUpdates = roles.map(role => {
      const permissoesObj = (role.permissoes as any) || {};
      const newPermissoesObj: Record<string, string> = {};
      for (const key of Object.keys(permissoesObj)) {
        if (moduloSlugs.includes(key)) {
          newPermissoesObj[key] = permissoesObj[key];
        }
      }
      return this.prisma.userObraRole.update({
        where: { id: role.id },
        data: { permissoes: newPermissoesObj }
      });
    });

    await this.prisma.$transaction([
      this.prisma.usuarioModulo.deleteMany({ where: { usuarioId } }),
      ...modulosIds.map((moduloId) =>
        this.prisma.usuarioModulo.create({ data: { usuarioId, moduloId } }),
      ),
      ...roleUpdates
    ]);

    return { usuarioId, modulosAtivos: moduloSlugs };
  }

  async softDelete(empresaId: string, usuarioId: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, empresaId, deletedAt: null },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado.');

    // Bump jwtVersion to revoke existing sessions
    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        deletedAt: new Date(),
        ativo: false,
        jwtVersion: { increment: 1 },
      },
      select: { id: true, nome: true, deletedAt: true },
    });
  }
}
