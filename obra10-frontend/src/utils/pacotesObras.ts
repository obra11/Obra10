/** Pacotes de obras — fator sobre o preço cadastrado do módulo (base = ATE_5 / PRO). */
export type PacoteObras = 'ATE_3' | 'ATE_5' | 'ILIMITADO';
export type PlanoNome = 'BASICO' | 'PRO' | 'ENTERPRISE';

export const PACOTES_OBRAS: Record<
  PacoteObras,
  { limite: number | null; fator: number; label: string; descricao: string; plano: PlanoNome }
> = {
  ATE_3: {
    limite: 3,
    fator: 0.8,
    label: 'Até 3 obras',
    descricao: 'Ideal para operações menores',
    plano: 'BASICO',
  },
  ATE_5: {
    limite: 5,
    fator: 1.0,
    label: 'Até 5 obras',
    descricao: 'Pacote padrão — preços cadastrados',
    plano: 'PRO',
  },
  ILIMITADO: {
    limite: null,
    fator: 1.5,
    label: 'Obras ilimitadas',
    descricao: 'Sem limite de obras ativas',
    plano: 'ENTERPRISE',
  },
};

/** Básico / Pro / Enterprise → pacote de obras */
export const PLANO_PARA_PACOTE: Record<PlanoNome, PacoteObras> = {
  BASICO: 'ATE_3',
  PRO: 'ATE_5',
  ENTERPRISE: 'ILIMITADO',
};

export const PLANOS: Record<
  PlanoNome,
  { label: string; pacote: PacoteObras; limiteUsuarios: number | null }
> = {
  BASICO: { label: 'Básico', pacote: 'ATE_3', limiteUsuarios: 5 },
  PRO: { label: 'Pro', pacote: 'ATE_5', limiteUsuarios: 20 },
  ENTERPRISE: { label: 'Enterprise', pacote: 'ILIMITADO', limiteUsuarios: null },
};

export const PLANO_KEYS = Object.keys(PLANOS) as PlanoNome[];

export const PACOTE_KEYS = Object.keys(PACOTES_OBRAS) as PacoteObras[];

export function resolvePacoteObras(value?: string | null): PacoteObras {
  if (value === 'ATE_3' || value === 'ILIMITADO' || value === 'ATE_5') return value;
  return 'ATE_5';
}

export function resolvePlano(value?: string | null): PlanoNome {
  if (value === 'BASICO' || value === 'PRO' || value === 'ENTERPRISE') return value;
  return 'PRO';
}

export function planoDoPacote(pacote?: string | null): PlanoNome {
  return PACOTES_OBRAS[resolvePacoteObras(pacote)].plano;
}

export function pacoteDoPlano(plano?: string | null): PacoteObras {
  return PLANO_PARA_PACOTE[resolvePlano(plano)];
}

export function precoComPacote(precoBase: number, pacote: PacoteObras): number {
  const fator = PACOTES_OBRAS[pacote].fator;
  return Math.round(Number(precoBase) * fator * 100) / 100;
}

export function labelPacote(pacote?: string | null): string {
  return PACOTES_OBRAS[resolvePacoteObras(pacote)].label;
}

export function labelPlano(plano?: string | null): string {
  return PLANOS[resolvePlano(plano)].label;
}

/** Texto curto de limite de usuários do plano (null = ilimitado). */
export function labelUsuariosPlano(plano?: string | null): string {
  const limite = PLANOS[resolvePlano(plano)].limiteUsuarios;
  return limite == null ? 'Usuários ilimitados' : `Até ${limite} usuários`;
}

/** Resumo obras + usuários para cards de plano. */
export function resumoPlano(plano?: string | null): string {
  const p = resolvePlano(plano);
  const obras = PACOTES_OBRAS[PLANOS[p].pacote].label;
  if (p === 'ENTERPRISE') return 'Obras ilimitadas · Usuários ilimitados';
  return `${obras} · ${labelUsuariosPlano(p)}`;
}
