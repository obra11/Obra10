/** Nome de obra comparado sem acento, caixa ou pontuação. */

export type ObraDuplicata = {
  id: string;
  empresaId: string;
  nome: string;
  createdAt: Date;
  rdos: number;
  anexos: number;
  funcionarios: number;
  treinamentos: number;
  alocacoes: number;
};

export function normalizarNomeObra(nome: string): string {
  return String(nome || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function conteudoObra(obra: ObraDuplicata): number {
  return (
    obra.rdos +
    obra.anexos +
    obra.funcionarios +
    obra.treinamentos +
    obra.alocacoes
  );
}

/**
 * Duplicatas do mesmo nome na mesma empresa: exclui as vazias quando
 * alguma irmã tem conteúdo; se todas estão vazias, fica a mais antiga.
 */
export function idsDuplicatasVaziasParaExcluir(
  obras: ObraDuplicata[],
): string[] {
  const grupos = new Map<string, ObraDuplicata[]>();
  for (const obra of obras) {
    const chave = normalizarNomeObra(obra.nome);
    if (!chave) continue;
    const grupoChave = `${obra.empresaId}|${chave}`;
    const grupo = grupos.get(grupoChave);
    if (grupo) grupo.push(obra);
    else grupos.set(grupoChave, [obra]);
  }

  const excluir: string[] = [];
  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue;
    const comConteudo = grupo.filter((obra) => conteudoObra(obra) > 0);
    const vazias = grupo.filter((obra) => conteudoObra(obra) === 0);
    if (comConteudo.length >= 1) {
      excluir.push(...vazias.map((obra) => obra.id));
      continue;
    }
    const ordenadas = [...grupo].sort((a, b) => {
      const porData = a.createdAt.getTime() - b.createdAt.getTime();
      return porData !== 0 ? porData : a.id.localeCompare(b.id);
    });
    excluir.push(...ordenadas.slice(1).map((obra) => obra.id));
  }
  return excluir;
}
