import { PerfilGlobal, TipoPapelEmpresa } from '@prisma/client';

/** Flags de capacidade resolvidas por papel / usuário. */
export interface RoleCapabilities {
  gerenciarUsuarios: boolean;
  gerenciarEmpresa: boolean;
  gerenciarFinanceiro: boolean;
  gerenciarCatalogo: boolean;
  criarObra: boolean;
  editarObra: boolean;
  excluirObra: boolean;
  acessoTodasObras: boolean;
  aprovarRdo: boolean;
  criarEditarRdo: boolean;
  verTodosRdos: boolean;
  verSoAprovados: boolean;
  verParcialAprovados: boolean;
  /** Níveis padrão por módulo (slug → VIEW | EDIT | VIEW_APPROVED | …) */
  modulosPadrao: Record<string, string>;
}

export const EMPTY_CAPABILITIES: RoleCapabilities = {
  gerenciarUsuarios: false,
  gerenciarEmpresa: false,
  gerenciarFinanceiro: false,
  gerenciarCatalogo: false,
  criarObra: false,
  editarObra: false,
  excluirObra: false,
  acessoTodasObras: false,
  aprovarRdo: false,
  criarEditarRdo: false,
  verTodosRdos: false,
  verSoAprovados: false,
  verParcialAprovados: false,
  modulosPadrao: {},
};

export const SUPER_ADMIN_CAPABILITIES: RoleCapabilities = {
  ...EMPTY_CAPABILITIES,
  gerenciarUsuarios: true,
  gerenciarEmpresa: true,
  gerenciarFinanceiro: true,
  gerenciarCatalogo: true,
  criarObra: true,
  editarObra: true,
  excluirObra: true,
  acessoTodasObras: true,
  aprovarRdo: true,
  criarEditarRdo: true,
  verTodosRdos: true,
  verSoAprovados: false,
  verParcialAprovados: false,
  modulosPadrao: {},
};

export const DEFAULT_CAPABILITIES_BY_TIPO: Record<
  TipoPapelEmpresa,
  RoleCapabilities
> = {
  GESTOR: {
    gerenciarUsuarios: true,
    gerenciarEmpresa: true,
    gerenciarFinanceiro: true,
    gerenciarCatalogo: true,
    criarObra: true,
    editarObra: true,
    excluirObra: true,
    acessoTodasObras: true,
    aprovarRdo: true,
    criarEditarRdo: true,
    verTodosRdos: true,
    verSoAprovados: false,
    verParcialAprovados: false,
    modulosPadrao: { RDO: 'EDIT', FVS: 'EDIT', PROJETOS: 'EDIT', CONCRETO: 'EDIT', IA: 'EDIT' },
  },
  COLABORADOR: {
    gerenciarUsuarios: false,
    gerenciarEmpresa: false,
    gerenciarFinanceiro: false,
    gerenciarCatalogo: false,
    criarObra: false,
    editarObra: false,
    excluirObra: false,
    acessoTodasObras: false,
    aprovarRdo: false,
    criarEditarRdo: true,
    verTodosRdos: true,
    verSoAprovados: false,
    verParcialAprovados: false,
    modulosPadrao: { RDO: 'EDIT' },
  },
  EXTERNO: {
    gerenciarUsuarios: false,
    gerenciarEmpresa: false,
    gerenciarFinanceiro: false,
    gerenciarCatalogo: false,
    criarObra: false,
    editarObra: false,
    excluirObra: false,
    acessoTodasObras: false,
    aprovarRdo: false,
    criarEditarRdo: false,
    verTodosRdos: false,
    verSoAprovados: true,
    verParcialAprovados: false,
    modulosPadrao: { RDO: 'VIEW_APPROVED' },
  },
  PERSONALIZADO: {
    ...EMPTY_CAPABILITIES,
  },
};

export const PAPEL_NOME_PADRAO: Record<TipoPapelEmpresa, string> = {
  GESTOR: 'Gestor',
  COLABORADOR: 'Colaborador',
  EXTERNO: 'Usuário externo',
  PERSONALIZADO: 'Personalizado',
};

/** Papéis editáveis nos defaults da empresa (PERSONALIZADO não tem preset forte). */
export const PAPEIS_COM_DEFAULT_EDITAVEL: TipoPapelEmpresa[] = [
  'GESTOR',
  'COLABORADOR',
  'EXTERNO',
];

export function perfilGlobalToTipoPapel(
  perfil: PerfilGlobal | string,
): TipoPapelEmpresa | null {
  switch (perfil) {
    case 'GESTOR':
      return 'GESTOR';
    case 'USER':
      return 'COLABORADOR';
    case 'EXTERNO':
      return 'EXTERNO';
    case 'PERSONALIZADO':
      return 'PERSONALIZADO';
    default:
      return null;
  }
}

export function tipoPapelToPerfilGlobal(
  tipo: TipoPapelEmpresa | string,
): PerfilGlobal {
  switch (tipo) {
    case 'GESTOR':
      return 'GESTOR';
    case 'COLABORADOR':
      return 'USER';
    case 'EXTERNO':
      return 'EXTERNO';
    case 'PERSONALIZADO':
      return 'PERSONALIZADO';
    default:
      return 'USER';
  }
}

export function mergeCapabilities(
  base: Partial<RoleCapabilities> | null | undefined,
  overlay?: Partial<RoleCapabilities> | null,
): RoleCapabilities {
  const merged: RoleCapabilities = {
    ...EMPTY_CAPABILITIES,
    ...(base || {}),
    modulosPadrao: {
      ...(base?.modulosPadrao || {}),
    },
  };
  if (overlay) {
    Object.assign(merged, overlay);
    if (overlay.modulosPadrao) {
      merged.modulosPadrao = {
        ...merged.modulosPadrao,
        ...overlay.modulosPadrao,
      };
    }
  }
  return merged;
}

export function normalizeCapabilities(
  raw: unknown,
  fallback: RoleCapabilities = EMPTY_CAPABILITIES,
): RoleCapabilities {
  if (!raw || typeof raw !== 'object') {
    return { ...fallback, modulosPadrao: { ...fallback.modulosPadrao } };
  }
  const obj = raw as Record<string, unknown>;
  return mergeCapabilities(fallback, {
    gerenciarUsuarios: boolOr(obj.gerenciarUsuarios, fallback.gerenciarUsuarios),
    gerenciarEmpresa: boolOr(obj.gerenciarEmpresa, fallback.gerenciarEmpresa),
    gerenciarFinanceiro: boolOr(
      obj.gerenciarFinanceiro,
      fallback.gerenciarFinanceiro,
    ),
    gerenciarCatalogo: boolOr(obj.gerenciarCatalogo, fallback.gerenciarCatalogo),
    criarObra: boolOr(obj.criarObra, fallback.criarObra),
    editarObra: boolOr(obj.editarObra, fallback.editarObra),
    excluirObra: boolOr(obj.excluirObra, fallback.excluirObra),
    acessoTodasObras: boolOr(obj.acessoTodasObras, fallback.acessoTodasObras),
    aprovarRdo: boolOr(obj.aprovarRdo, fallback.aprovarRdo),
    criarEditarRdo: boolOr(obj.criarEditarRdo, fallback.criarEditarRdo),
    verTodosRdos: boolOr(obj.verTodosRdos, fallback.verTodosRdos),
    verSoAprovados: boolOr(obj.verSoAprovados, fallback.verSoAprovados),
    verParcialAprovados: boolOr(
      obj.verParcialAprovados,
      fallback.verParcialAprovados,
    ),
    modulosPadrao:
      obj.modulosPadrao && typeof obj.modulosPadrao === 'object'
        ? (obj.modulosPadrao as Record<string, string>)
        : fallback.modulosPadrao,
  });
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Defaults fortes de GESTOR legado quando template ainda não existe. */
export function legacyGestorCapabilities(): RoleCapabilities {
  return { ...DEFAULT_CAPABILITIES_BY_TIPO.GESTOR };
}
