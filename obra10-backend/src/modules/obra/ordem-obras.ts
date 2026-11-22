export function mesclarOrdemObras(
  atual: string[],
  novaSubset: string[],
): string[] {
  const unique = [...new Set((novaSubset || []).filter(Boolean))];
  const atualSet = new Set(atual);
  const validas = unique.filter((id) => atualSet.has(id));
  const submitted = new Set(validas);
  const merged: string[] = [];
  let u = 0;
  for (const id of atual) {
    if (submitted.has(id)) merged.push(validas[u++]);
    else merged.push(id);
  }
  return merged;
}
