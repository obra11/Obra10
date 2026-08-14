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

export const PLAN_LIMITS: Record<PlanoNome, number> = {
  BASICO: 5,
  PRO: 20,
  ENTERPRISE: 100,
};

export function resolvePacoteObras(value?: string | null): PacoteObras {
  if (value === 'ATE_3' || value === 'ILIMITADO' || value === 'ATE_5') return value;
  return 'ATE_5';
}

export function resolvePlano(value?: string | null): PlanoNome {
  if (value === 'BASICO' || value === 'PRO' || value === 'ENTERPRISE') return value;
  return 'PRO';
}

export function pacoteDoPlano(plano?: string | null): PacoteObras {
  return PLANO_PARA_PACOTE[resolvePlano(plano)];
}

export function planoDoPacote(pacote?: string | null): PlanoNome {
  return PACOTES_OBRAS[resolvePacoteObras(pacote)].plano;
}

export function limiteObrasDoPacote(pacote: PacoteObras): number | null {
  return PACOTES_OBRAS[pacote].limite;
}

export function fatorPrecoPacote(pacote: PacoteObras): number {
  return PACOTES_OBRAS[pacote].fator;
}

/** Arredonda para 2 casas (centavos). */
export function precoComPacote(
  precoBase: number,
  pacote: PacoteObras,
): number {
  const fator = fatorPrecoPacote(pacote);
  return Math.round(Number(precoBase) * fator * 100) / 100;
}
