/** Pacotes de obras — fator sobre o preço cadastrado do módulo (base = ATE_5). */
export type PacoteObras = 'ATE_3' | 'ATE_5' | 'ILIMITADO';

export const PACOTES_OBRAS: Record<
  PacoteObras,
  { limite: number | null; fator: number; label: string; descricao: string }
> = {
  ATE_3: {
    limite: 3,
    fator: 0.8,
    label: 'Até 3 obras',
    descricao: 'Ideal para operações menores',
  },
  ATE_5: {
    limite: 5,
    fator: 1.0,
    label: 'Até 5 obras',
    descricao: 'Pacote padrão — preços cadastrados',
  },
  ILIMITADO: {
    limite: null,
    fator: 1.5,
    label: 'Obras ilimitadas',
    descricao: 'Sem limite de obras ativas',
  },
};

export function resolvePacoteObras(value?: string | null): PacoteObras {
  if (value === 'ATE_3' || value === 'ILIMITADO' || value === 'ATE_5') return value;
  return 'ATE_5';
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
