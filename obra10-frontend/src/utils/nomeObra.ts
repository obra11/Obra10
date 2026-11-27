/** Nome de obra comparado sem acento, caixa ou pontuação. */
export function normalizarNomeObra(nome: string): string {
  return String(nome || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function obraComMesmoNome<T extends { nome: string }>(
  obras: T[],
  nome: string,
): T | undefined {
  const chave = normalizarNomeObra(nome);
  if (!chave) return undefined;
  return obras.find((obra) => normalizarNomeObra(obra.nome) === chave);
}
