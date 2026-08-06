/**
 * Garante a interpretação correta de datas de referência (YYYY-MM-DD ou ISO)
 * sem deslocamento por fuso horário (ex: UTC-3 rolando o dia para trás ao usar new Date(isoString)).
 */
export function parseUTCDate(dateInput: string | Date | null | undefined): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;

  const dateStr = String(dateInput);
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    // Cria o objeto Date no meio-dia (12:00:00) horário local.
    // Isso impede completamente que o fuso horário (ex: UTC-3) recue a data em 1 dia.
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
  }

  return new Date(dateInput);
}
