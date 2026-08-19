import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma, TipoPapelEmpresa } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CapabilitiesService } from '../../core/capabilities/capabilities.service';
import {
  DEFAULT_CAPABILITIES_BY_TIPO,
  normalizeCapabilities,
  perfilGlobalToTipoPapel,
  RoleCapabilities,
} from '../../core/capabilities/role-capabilities';
import { perfilGlobalToObraNomeInterno } from '../../core/capabilities/obra-perfil';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly capabilities: CapabilitiesService,
    private readonly email: EmailService,
  ) {}

  async findAllByEmpresa(empresaId: string) {
    await this.capabilities.ensurePapeisEmpresa(empresaId);
    const usuarios = await this.prisma.usuario.findMany({
      where: { empresaId, deletedAt: null },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        perfilGlobal: true,
        capabilities: true,
        ativo: true,
        createdAt: true,
        fotoUrl: true,
        usuarioModulos: {
          include: { modulo: { select: { slug: true, nome: true } } },
        },
        userObraRole: {
          include: { obra: { select: { id: true, nome: true, status: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      usuarios.map(async (u) => ({
        ...u,
        capabilitiesEfetivas: await this.capabilities.resolveForUser({
          empresaId,
          perfilGlobal: u.perfilGlobal,
          capabilitiesOverride: u.capabilities,
        }),
      })),
    );
  }

  async listPapeis(empresaId: string) {
    return this.capabilities.listPapeis(empresaId);
  }

  async updatePapel(
    empresaId: string,
    tipo: string,
    dto: {
      nome?: string;
      capabilities?: Partial<RoleCapabilities>;
      permissoesPadrao?: Record<string, string>;
    },
  ) {
    const tiposValidos: TipoPapelEmpresa[] = [
      'GESTOR',
      'COLABORADOR',
      'EXTERNO',
      'PERSONALIZADO',
    ];
    if (!tiposValidos.includes(tipo as TipoPapelEmpresa)) {
      throw new BadRequestException('Tipo de papel inválido.');
    }
    return this.capabilities.updatePapel(
      empresaId,
      tipo as TipoPapelEmpresa,
      dto,
    );
  }

  async create(empresaId: string, dto: any) {
    const {
      nome,
      email,
      senha,
      perfilGlobal,
      telefone,
      capabilities,
      permissoesObras,
    } = dto;
    if (!nome || !email || !senha) {
      throw new BadRequestException('nome, email e senha são obrigatórios.');
    }

    await this.capabilities.ensurePapeisEmpresa(empresaId);

    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      include: {
        _count: { select: { usuarios: { where: { deletedAt: null } } } },
      },
    });
    if (!empresa) throw new NotFoundException('Empresa não encontrada.');

    if (empresa._count.usuarios >= empresa.limiteUsuarios) {
      throw new ForbiddenException(
        `Limite de ${empresa.limiteUsuarios} usuários do plano ${empresa.plano} atingido. Faça upgrade para adicionar mais usuários.`,
      );
    }

    const existenteAtivo = await this.prisma.usuario.findFirst({
      where: { empresaId, email, deletedAt: null },
    });
    if (existenteAtivo)
      throw new ConflictException(
        `E-mail "${email}" já está em uso nesta empresa.`,
      );

    const usuarioDeletado = await this.prisma.usuario.findFirst({
      where: { empresaId, email, deletedAt: { not: null } },
    });

    const senhaHash = await bcrypt.hash(senha, 12);
    const perfil = (perfilGlobal ?? 'USER') as string;
    this.assertPerfilEmpresa(perfil);

    if (perfil === 'PERSONALIZADO' && !capabilities) {
      throw new BadRequestException(
        'Função Personalizado exige configuração de permissões (capabilities).',
      );
    }

    const capsToStore = await this.resolveCapabilitiesToStore(
      empresaId,
      perfil,
      capabilities,
    );

    const tenantModulosAtivos = await this.prisma.tenantModulo.findMany({
      where: {
        empresaId,
        ativo: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { modulo: { select: { slug: true } } },
    });

    const moduloSlugsFromCaps = Object.keys(capsToStore.modulosPadrao || {});
    const modulosParaCriar = tenantModulosAtivos.filter(
      (m) =>
        moduloSlugsFromCaps.length === 0 ||
        moduloSlugsFromCaps.includes(m.modulo.slug) ||
        perfil === 'GESTOR',
    );

    let usuarioId: string;

    if (usuarioDeletado) {
      const updated = await this.prisma.usuario.update({
        where: { id: usuarioDeletado.id },
        data: {
          nome,
          senhaHash,
          telefone,
          perfilGlobal: perfil as any,
          capabilities: capsToStore as unknown as Prisma.InputJsonValue,
          ativo: true,
          deletedAt: null,
          usuarioModulos: {
            deleteMany: {},
            create: modulosParaCriar.map((m) => ({ moduloId: m.moduloId })),
          },
        },
        select: {
          id: true,
          nome: true,
          email: true,
          perfilGlobal: true,
          capabilities: true,
          createdAt: true,
          fotoUrl: true,
        },
      });
      usuarioId = updated.id;
      await this.applyPermissoesTemplate(
        empresaId,
        usuarioId,
        perfil,
        capsToStore,
        permissoesObras,
      );
      await this.enviarConviteSeguro({
        email,
        nome,
        senha,
        empresaId,
      });
      return updated;
    }

    const created = await this.prisma.usuario.create({
      data: {
        empresaId,
        nome,
        email,
        senhaHash,
        telefone,
        perfilGlobal: perfil as any,
        capabilities: capsToStore as unknown as Prisma.InputJsonValue,
        ativo: true,
        usuarioModulos: {
          create: modulosParaCriar.map((m) => ({ moduloId: m.moduloId })),
        },
      },
      select: {
        id: true,
        nome: true,
        email: true,
        perfilGlobal: true,
        capabilities: true,
        createdAt: true,
        fotoUrl: true,
      },
    });

    await this.applyPermissoesTemplate(
      empresaId,
      created.id,
      perfil,
      capsToStore,
      permissoesObras,
    );

    await this.enviarConviteSeguro({
      email,
      nome,
      senha,
      empresaId,
    });

    return created;
  }

  /**
   * Gera nova senha temporária e reenvia o e-mail de acesso ao colaborador.
   */
  async reenviarConvite(empresaId: string, usuarioId: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, empresaId, deletedAt: null },
      select: { id: true, nome: true, email: true },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado.');

    const senhaTemporaria = this.gerarSenhaTemporaria();
    const senhaHash = await bcrypt.hash(senhaTemporaria, 12);
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { senhaHash },
    });

    await this.enviarConviteSeguro({
      email: usuario.email,
      nome: usuario.nome,
      senha: senhaTemporaria,
      empresaId,
    });

    return {
      mensagem: `E-mail de acesso reenviado para ${usuario.email}.`,
      email: usuario.email,
    };
  }

  private gerarSenhaTemporaria(): string {
    // Fácil de digitar no celular, sem caracteres ambíguos
    return crypto.randomBytes(5).toString('hex'); // 10 chars hex
  }

  private async enviarConviteSeguro(params: {
    email: string;
    nome: string;
    senha: string;
    empresaId: string;
  }) {
    try {
      const empresa = await this.prisma.empresa.findUnique({
        where: { id: params.empresaId },
        select: { razaoSocial: true, nomeCompleto: true, nomeFantasia: true },
      });
      const nomeEmpresa =
        empresa?.nomeFantasia ||
        empresa?.razaoSocial ||
        empresa?.nomeCompleto ||
        'sua empresa';

      const obras = await this.prisma.userObraRole.findMany({
        where: {
          usuario: { email: params.email, empresaId: params.empresaId },
          obra: { deletedAt: null },
        },
        include: { obra: { select: { nome: true } } },
        take: 10,
      });

      await this.email.enviarConviteUsuario({
        email: params.email,
        nomeUsuario: params.nome,
        senhaTemporaria: params.senha,
        nomeEmpresa,
        obrasNomes: obras.map((o) => o.obra.nome).filter(Boolean),
      });
    } catch (err: any) {
      this.logger.error(
        `Falha ao enviar convite para ${params.email}: ${err?.message || err}`,
      );
    }
  }

  async update(empresaId: string, id: string, dto: any) {
    const {
      nome,
      email,
      perfilGlobal,
      telefone,
      capabilities,
      permissoesObras,
    } = dto;
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, empresaId, deletedAt: null },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado.');

    if (email && email !== usuario.email) {
      const existente = await this.prisma.usuario.findFirst({
        where: { empresaId, email, deletedAt: null, id: { not: id } },
      });
      if (existente)
        throw new ConflictException(
          `E-mail "${email}" já está em uso nesta empresa.`,
        );
    }

    const perfil = (perfilGlobal ?? usuario.perfilGlobal) as string;
    if (perfilGlobal) this.assertPerfilEmpresa(perfil);

    if (perfil === 'PERSONALIZADO' && capabilities === undefined && !usuario.capabilities) {
      throw new BadRequestException(
        'Função Personalizado exige configuração de permissões (capabilities).',
      );
    }

    let capsToStore: RoleCapabilities | undefined;
    if (perfilGlobal || capabilities !== undefined) {
      capsToStore = await this.resolveCapabilitiesToStore(
        empresaId,
        perfil,
        capabilities !== undefined ? capabilities : usuario.capabilities,
      );
    }

    const updated = await this.prisma.usuario.update({
      where: { id },
      data: {
        ...(nome && { nome }),
        ...(email && { email }),
        ...(perfilGlobal && { perfilGlobal: perfilGlobal as any }),
        ...(telefone !== undefined && { telefone }),
        ...(capsToStore && {
          capabilities: capsToStore as unknown as Prisma.InputJsonValue,
        }),
      },
      select: {
        id: true,
        nome: true,
        email: true,
        perfilGlobal: true,
        capabilities: true,
        createdAt: true,
        fotoUrl: true,
      },
    });

    if (capsToStore && (perfilGlobal || permissoesObras || capabilities !== undefined)) {
      await this.applyPermissoesTemplate(
        empresaId,
        id,
        perfil,
        capsToStore,
        permissoesObras,
      );

      // Atualiza módulos globais conforme template
      const tenantModulosAtivos = await this.prisma.tenantModulo.findMany({
        where: {
          empresaId,
          ativo: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: { modulo: { select: { slug: true } } },
      });
      const moduloSlugsFromCaps = Object.keys(capsToStore.modulosPadrao || {});
      const modulosParaCriar = tenantModulosAtivos.filter(
        (m) =>
          moduloSlugsFromCaps.length === 0 ||
          moduloSlugsFromCaps.includes(m.modulo.slug) ||
          perfil === 'GESTOR',
      );
      await this.prisma.$transaction([
        this.prisma.usuarioModulo.deleteMany({ where: { usuarioId: id } }),
        ...modulosParaCriar.map((m) =>
          this.prisma.usuarioModulo.create({
            data: { usuarioId: id, moduloId: m.moduloId },
          }),
        ),
      ]);
    }

    return updated;
  }

  async setModulos(
    empresaId: string,
    usuarioId: string,
    moduloSlugs: string[],
  ) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, empresaId, deletedAt: null },
    });
    if (!usuario)
      throw new NotFoundException('Usuário não encontrado nesta empresa.');

    const tenantModulosAtivos = await this.prisma.tenantModulo.findMany({
      where: {
        empresaId,
        ativo: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { modulo: true },
    });

    const slugsPermitidos = tenantModulosAtivos.map((tm) => tm.modulo.slug);
    const slugsInvalidos = moduloSlugs.filter(
      (s) => !slugsPermitidos.includes(s),
    );
    if (slugsInvalidos.length > 0) {
      throw new ForbiddenException(
        `Os módulos [${slugsInvalidos.join(', ')}] não estão contratados pelo seu plano.`,
      );
    }

    const modulosIds = tenantModulosAtivos
      .filter((tm) => moduloSlugs.includes(tm.modulo.slug))
      .map((tm) => tm.moduloId);

    const roles = await this.prisma.userObraRole.findMany({
      where: { usuarioId },
    });
    const roleUpdates = roles.map((role) => {
      const permissoesObj = (role.permissoes as any) || {};
      const newPermissoesObj: Record<string, string> = {};
      for (const key of Object.keys(permissoesObj)) {
        if (moduloSlugs.includes(key)) {
          newPermissoesObj[key] = permissoesObj[key];
        }
      }
      return this.prisma.userObraRole.update({
        where: { id: role.id },
        data: { permissoes: newPermissoesObj },
      });
    });

    await this.prisma.$transaction([
      this.prisma.usuarioModulo.deleteMany({ where: { usuarioId } }),
      ...modulosIds.map((moduloId) =>
        this.prisma.usuarioModulo.create({ data: { usuarioId, moduloId } }),
      ),
      ...roleUpdates,
    ]);

    return { usuarioId, modulosAtivos: moduloSlugs };
  }

  async softDelete(empresaId: string, usuarioId: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, empresaId, deletedAt: null },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado.');

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

  async updatePerfil(userId: string, dto: any) {
    const { nome, telefone, fotoUrl, novaSenha, senhaAtual } = dto;
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId, deletedAt: null },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado.');

    const updateData: any = {};
    if (nome) updateData.nome = nome;
    if (telefone !== undefined) updateData.telefone = telefone;
    if (fotoUrl !== undefined) updateData.fotoUrl = fotoUrl;

    if (novaSenha) {
      if (!senhaAtual) {
        throw new BadRequestException(
          'Para alterar a senha, você deve fornecer a senha atual.',
        );
      }
      const senhaOk = await bcrypt.compare(senhaAtual, usuario.senhaHash);
      if (!senhaOk) {
        throw new BadRequestException('Senha atual incorreta.');
      }
      updateData.senhaHash = await bcrypt.hash(novaSenha, 12);
      updateData.jwtVersion = { increment: 1 };
    }

    return this.prisma.usuario.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        fotoUrl: true,
        perfilGlobal: true,
      },
    });
  }

  private assertPerfilEmpresa(perfil: string) {
    const ok = ['GESTOR', 'USER', 'EXTERNO', 'PERSONALIZADO'].includes(perfil);
    if (!ok) {
      throw new BadRequestException(
        'perfilGlobal deve ser GESTOR, USER, EXTERNO ou PERSONALIZADO.',
      );
    }
  }

  private async resolveCapabilitiesToStore(
    empresaId: string,
    perfil: string,
    override?: unknown,
  ): Promise<RoleCapabilities> {
    const tipo = perfilGlobalToTipoPapel(perfil);
    const papelDefaults = tipo
      ? DEFAULT_CAPABILITIES_BY_TIPO[tipo]
      : DEFAULT_CAPABILITIES_BY_TIPO.COLABORADOR;

    const fromPapel = await this.capabilities.resolveForUser({
      empresaId,
      perfilGlobal: perfil,
    });

    if (perfil === 'PERSONALIZADO') {
      return normalizeCapabilities(override, papelDefaults);
    }

    // Para papéis padrão, persiste o template atual (override opcional do gestor)
    if (override) {
      return normalizeCapabilities(override, fromPapel);
    }
    return fromPapel;
  }

  /**
   * Aplica permissoesPadrao do papel nas obras já vinculadas,
   * ou permissoesObras explícitas (PERSONALIZADO).
   */
  private async applyPermissoesTemplate(
    empresaId: string,
    usuarioId: string,
    perfil: string,
    caps: RoleCapabilities,
    permissoesObras?: Record<string, Record<string, string>>,
  ) {
    if (caps.acessoTodasObras && perfil === 'GESTOR') {
      // Gestor com acesso total não precisa de vínculos explícitos
      return;
    }

    const roles = await this.prisma.userObraRole.findMany({
      where: { usuarioId },
    });

    const permissoesPadrao =
      caps.modulosPadrao && Object.keys(caps.modulosPadrao).length > 0
        ? caps.modulosPadrao
        : {};

    if (permissoesObras && Object.keys(permissoesObras).length > 0) {
      const nomeInterno = perfilGlobalToObraNomeInterno(perfil);
      let perfilObra = await this.prisma.perfil.findUnique({
        where: { nomeInterno },
      });
      if (!perfilObra) {
        try {
          perfilObra = await this.prisma.perfil.create({
            data: { nomeInterno },
          });
        } catch {
          await this.prisma.$executeRawUnsafe(
            `SELECT setval('perfis_id_seq', COALESCE((SELECT MAX(id)+1 FROM perfis), 1), false);`,
          );
          perfilObra = await this.prisma.perfil.create({
            data: { nomeInterno },
          });
        }
      }
      const perfilId = perfilObra.id;

      for (const [obraId, permissoes] of Object.entries(permissoesObras)) {
        const obra = await this.prisma.obra.findFirst({
          where: { id: obraId, empresaId, deletedAt: null },
        });
        if (!obra) continue;

        await this.prisma.userObraRole.upsert({
          where: { usuarioId_obraId: { usuarioId, obraId } },
          create: {
            usuarioId,
            obraId,
            perfilId,
            permissoes: permissoes as Prisma.InputJsonValue,
          },
          update: {
            perfilId,
            permissoes: permissoes as Prisma.InputJsonValue,
          },
        });
      }
      return;
    }

    // Atualiza vínculos existentes com o template do papel + perfil alinhado ao cadastro
    if (roles.length === 0) return;

    const nomeInterno = perfilGlobalToObraNomeInterno(perfil);
    let perfilObra = await this.prisma.perfil.findUnique({
      where: { nomeInterno },
    });
    if (!perfilObra) {
      try {
        perfilObra = await this.prisma.perfil.create({
          data: { nomeInterno },
        });
      } catch {
        await this.prisma.$executeRawUnsafe(
          `SELECT setval('perfis_id_seq', COALESCE((SELECT MAX(id)+1 FROM perfis), 1), false);`,
        );
        perfilObra = await this.prisma.perfil.create({
          data: { nomeInterno },
        });
      }
    }

    await Promise.all(
      roles.map((role) =>
        this.prisma.userObraRole.update({
          where: { id: role.id },
          data: {
            perfilId: perfilObra!.id,
            ...(Object.keys(permissoesPadrao).length > 0
              ? {
                  permissoes:
                    permissoesPadrao as unknown as Prisma.InputJsonValue,
                }
              : {}),
          },
        }),
      ),
    );
  }
}
