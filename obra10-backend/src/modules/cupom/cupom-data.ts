/**
 * Datas de calendário (input type="date") no fuso de Brasília.
 * Evita o bug de "dia seguinte / dia anterior" ao usar `new Date('YYYY-MM-DD')` (UTC).
 */

/** Converte YYYY-MM-DD → instante no início do dia em America/Sao_Paulo. */
export function parseDataBrasilInicioDoDia(yyyyMmDd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!m) throw new Error(`Data inválida: ${yyyyMmDd}`);
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000-03:00`);
}

/** Converte YYYY-MM-DD → instante no fim do dia em America/Sao_Paulo. */
export function parseDataBrasilFimDoDia(yyyyMmDd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!m) throw new Error(`Data inválida: ${yyyyMmDd}`);
  return new Date(`${m[1]}-${m[2]}-${m[3]}T23:59:59.999-03:00`);
}

/** Formata Date/ISO → dd/MM/yyyy no calendário de Brasília. */
export function formatDataBrasil(value: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

/** Formata Date/ISO → YYYY-MM-DD para <input type="date"> no calendário de Brasília. */
export function toInputDateBrasil(value: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
