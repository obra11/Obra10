export function moverObraNaLista<T extends { id: string }>(
  todas: T[],
  visiveis: T[],
  id: string,
  dir: -1 | 1,
): T[] {
  const origem = visiveis.findIndex((o) => o.id === id);
  const alvo = visiveis[origem + dir];
  if (origem < 0 || !alvo) return todas;
  const item = todas.find((o) => o.id === id);
  if (!item) return todas;
  const semItem = todas.filter((o) => o.id !== id);
  const idxAlvo = semItem.findIndex((o) => o.id === alvo.id);
  if (idxAlvo < 0) return todas;
  const insertAt = dir === 1 ? idxAlvo + 1 : idxAlvo;
  const next = [...semItem];
  next.splice(insertAt, 0, item);
  return next;
}

export function inserirObraAntesDe<T extends { id: string }>(
  todas: T[],
  arrastadaId: string,
  alvoId: string,
): T[] {
  if (!arrastadaId || arrastadaId === alvoId) return todas;
  const item = todas.find((o) => o.id === arrastadaId);
  if (!item) return todas;
  const semItem = todas.filter((o) => o.id !== arrastadaId);
  const idxAlvo = semItem.findIndex((o) => o.id === alvoId);
  if (idxAlvo < 0) return todas;
  const next = [...semItem];
  next.splice(idxAlvo, 0, item);
  return next;
}
