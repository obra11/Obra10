/**
 * Datas de calendário (input type="date") no fuso de Brasília.
 */

export function formatDataBrasil(value: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export function toInputDateBrasil(value: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

/** Retorna YYYY-MM-DD de “hoje” em Brasília. */
export function hojeBrasilYmd(): string {
  return toInputDateBrasil(new Date());
}

/** Soma/subtrai dias a um YYYY-MM-DD (calendário local simples). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export type PeriodoPreset =
  | 'este_mes'
  | 'mes_anterior'
  | 'ultimos_30'
  | 'ultimos_90'
  | 'ano_atual'
  | 'personalizado';

export function rangePreset(preset: PeriodoPreset): { inicio: string; fim: string } {
  const hoje = hojeBrasilYmd();
  const [y, m] = hoje.split('-').map(Number);

  if (preset === 'este_mes') {
    const inicio = `${y}-${String(m).padStart(2, '0')}-01`;
    return { inicio, fim: hoje };
  }
  if (preset === 'mes_anterior') {
    const firstThis = new Date(y, m - 1, 1);
    const lastPrev = new Date(firstThis.getTime() - 86400000);
    const py = lastPrev.getFullYear();
    const pm = lastPrev.getMonth() + 1;
    const lastDay = lastPrev.getDate();
    return {
      inicio: `${py}-${String(pm).padStart(2, '0')}-01`,
      fim: `${py}-${String(pm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  if (preset === 'ultimos_30') {
    return { inicio: addDaysYmd(hoje, -29), fim: hoje };
  }
  if (preset === 'ultimos_90') {
    return { inicio: addDaysYmd(hoje, -89), fim: hoje };
  }
  if (preset === 'ano_atual') {
    return { inicio: `${y}-01-01`, fim: hoje };
  }
  return { inicio: hoje, fim: hoje };
}
