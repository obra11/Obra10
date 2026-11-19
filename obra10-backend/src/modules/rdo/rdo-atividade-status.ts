export function percentualAtividade(valor: unknown): number | null {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.').trim());
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function rotuloStatusAtividade(status: unknown, percentual?: unknown): string {
  const bruto = String(status || 'em andamento').trim().toLowerCase();
  if (bruto === 'em andamento') {
    const pct = percentualAtividade(percentual);
    return pct == null ? 'EM ANDAMENTO' : `EM ANDAMENTO ${pct}%`;
  }
  if (bruto === 'pausado') return 'PAUSADO';
  if (bruto === 'finalizada' || bruto === 'finalizado' || bruto === 'concluido') return 'FINALIZADA';
  return bruto.toUpperCase();
}
