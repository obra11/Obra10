import { Injectable } from '@nestjs/common';
import { PerfilGlobal, Prisma, TipoPapelEmpresa } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_CAPABILITIES_BY_TIPO,
  EMPTY_CAPABILITIES,
  PAPEL_NOME_PADRAO,
  PAPEIS_COM_DEFAULT_EDITAVEL,
  RoleCapabilities,
  SUPER_ADMIN_CAPABILITIES,
  legacyGestorCapabilities,
  mergeCapabilities,
  normalizeCapabilities,
  perfilGlobalToTipoPapel,
} from './role-capabilities';

@Injectable()
export class CapabilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Garante os 4 papéis padrão da empresa (idempotente). */
  async ensurePapeisEmpresa(
    empresaId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || this.prisma;
    const existentes = await db.papelEmpresa.findMany({
      where: { empresaId },
      select: { tipo: true },
    });
    const tiposExistentes = new Set(existentes.map((p) => p.tipo));
    const tipos: TipoPapelEmpresa[] = [
      'GESTOR',
      'COLABORADOR',
      'EXTERNO',
      'PERSONALIZADO',
    ];

    for (const tipo of tipos) {
      if (tiposExistentes.has(tipo)) continue;
      const caps = DEFAULT_CAPABILITIES_BY_TIPO[tipo];
      await db.papelEmpresa.create({
        data: {
          empresaId,
          tipo,
          nome: PAPEL_NOME_PADRAO[tipo],
          capabilities: caps as unknown as Prisma.InputJsonValue,
          permissoesPadrao: caps.modulosPadrao as unknown as Prisma.InputJsonValue,
          editavel: PAPEIS_COM_DEFAULT_EDITAVEL.includes(tipo),
        },
      });
    }
  }

  async listPapeis(empresaId: string) {
    await this.ensurePapeisEmpresa(empresaId);
    return this.prisma.papelEmpresa.findMany({
      where: { empresaId },
      orderBy: { tipo: 'asc' },
    });
  }

  async updatePapel(
    empresaId: string,
    tipo: TipoPapelEmpresa,
    data: {
      nome?: string;
      capabilities?: Partial<RoleCapabilities>;
      permissoesPadrao?: Record<string, string>;
    },
  ) {
    await this.ensurePapeisEmpresa(empresaId);
    const papel = await this.prisma.papelEmpresa.findUnique({
      where: { empresaId_tipo: { empresaId, tipo } },
    });
    if (!papel) throw new Error('Papel não encontrado.');

    const fallback = DEFAULT_CAPABILITIES_BY_TIPO[tipo];
    const current = normalizeCapabilities(papel.capabilities, fallback);
    const nextCaps = data.capabilities
      ? mergeCapabilities(current, data.capabilities)
      : current;
    const nextPermissoes =
      data.permissoesPadrao ??
      nextCaps.modulosPadrao ??
      (papel.permissoesPadrao as Record<string, string>) ??
      {};

    if (data.capabilities && !data.permissoesPadrao) {
      nextCaps.modulosPadrao = {
        ...nextCaps.modulosPadrao,
        ...nextPermissoes,
      };
    }

    return this.prisma.papelEmpresa.update({
      where: { id: papel.id },
      data: {
        ...(data.nome && { nome: data.nome }),
        capabilities: nextCaps as unknown as Prisma.InputJsonValue,
        permissoesPadrao: (data.capabilities
          ? nextCaps.modulosPadrao
          : nextPermissoes) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Resolve capabilities efetivas do usuário.
   * Ordem: SUPER_ADMIN → override no usuário → PapelEmpresa → defaults por perfil
   * (GESTOR legado sem template = defaults fortes).
   */
  async resolveForUser(params: {
    empresaId: string;
    perfilGlobal: PerfilGlobal | string;
    capabilitiesOverride?: unknown;
  }): Promise<RoleCapabilities> {
    const { empresaId, perfilGlobal, capabilitiesOverride } = params;

    if (perfilGlobal === 'SUPER_ADMIN') {
      return { ...SUPER_ADMIN_CAPABILITIES };
    }

    const tipo = perfilGlobalToTipoPapel(perfilGlobal);
    if (!tipo) {
      return normalizeCapabilities(capabilitiesOverride);
    }

    let papelCaps: RoleCapabilities | null = null;
    try {
      const papel = await this.prisma.papelEmpresa.findUnique({
        where: { empresaId_tipo: { empresaId, tipo } },
      });
      if (papel) {
        papelCaps = normalizeCapabilities(
          papel.capabilities,
          DEFAULT_CAPABILITIES_BY_TIPO[tipo],
        );
      }
    } catch {
      papelCaps = null;
    }

    if (!papelCaps) {
      if (perfilGlobal === 'GESTOR') {
        papelCaps = legacyGestorCapabilities();
      } else {
        papelCaps = { ...DEFAULT_CAPABILITIES_BY_TIPO[tipo] };
      }
    }

    if (capabilitiesOverride) {
      return mergeCapabilities(
        papelCaps,
        normalizeCapabilities(capabilitiesOverride, papelCaps),
      );
    }

    return papelCaps;
  }

  async resolveByUserId(userId: string): Promise<RoleCapabilities> {
    const user = await this.prisma.usuario.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        empresaId: true,
        perfilGlobal: true,
        capabilities: true,
      },
    });
    if (!user) return { ...EMPTY_CAPABILITIES };
    return this.resolveForUser({
      empresaId: user.empresaId,
      perfilGlobal: user.perfilGlobal,
      capabilitiesOverride: user.capabilities,
    });
  }

  async hasCapability(
    userId: string,
    key: keyof RoleCapabilities,
  ): Promise<boolean> {
    if (key === 'modulosPadrao') return false;
    const caps = await this.resolveByUserId(userId);
    return Boolean(caps[key]);
  }
}
