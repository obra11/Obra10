export type TipoRelatorio = 'DIA' | 'PERIODO';

export function tipoDeExtras(extras: any, rdo?: any): TipoRelatorio {
  const raw = String(extras?.tipoRelatorio || rdo?.tipoRelatorio || 'DIA').toUpperCase();
  return raw === 'PERIODO' ? 'PERIODO' : 'DIA';
}

export function rotuloTipoRelatorio(tipo: TipoRelatorio): string {
  return tipo === 'PERIODO' ? 'relatório de período' : 'relatório do dia';
}

export function tituloTipoRelatorio(tipo: TipoRelatorio | null): string {
  if (tipo === 'PERIODO') return 'Relatório de período';
  if (tipo === 'DIA') return 'Diário de Obra';
  return 'Novo relatório';
}

/**
 * Ask day vs period whenever the type is still unset.
 * New RDO must not auto-fill DIA from a leftover local draft — that hid the period option.
 */
export function devePedirTipoRelatorio(opts: {
  initLoading: boolean;
  tipoRelatorio: TipoRelatorio | null;
}): boolean {
  return !opts.initLoading && opts.tipoRelatorio === null;
}

export function devePersistirRascunhoLocal(opts: {
  tipoRelatorio: TipoRelatorio | null;
  status: string;
  isReadOnly: boolean;
}): boolean {
  return Boolean(opts.tipoRelatorio) && opts.status === 'rascunho' && !opts.isReadOnly;
}
