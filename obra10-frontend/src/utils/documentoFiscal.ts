export function apenasDigitos(raw: string | null | undefined): string {
  return String(raw || '').replace(/\D/g, '');
}

export function validarCPF(cpf: string): boolean {
  const d = apenasDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +d[i] * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== +d[9]) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += +d[i] * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === +d[10];
}

export function validarCNPJ(cnpj: string): boolean {
  const d = apenasDigitos(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (n: string, weights: number[]) =>
    11 -
    (n
      .split('')
      .slice(0, weights.length)
      .reduce((s, c, i) => s + +c * weights[i], 0) %
      11);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(d, w1) >= 10 ? 0 : calc(d, w1);
  const d2 = calc(d, w2) >= 10 ? 0 : calc(d, w2);
  return +d[12] === d1 && +d[13] === d2;
}

export function normalizarDocumentoFiscal(raw: string | null | undefined): string {
  let d = apenasDigitos(raw);
  if (d.length === 11 || d.length === 14) return d;
  while (d.length > 11 && d.length < 14 && d.startsWith('0')) {
    const next = d.slice(1);
    if (validarCPF(next) || validarCNPJ(next)) return next;
    d = next;
  }
  return d;
}

export function documentoFiscalValido(raw: string | null | undefined): boolean {
  const d = normalizarDocumentoFiscal(raw);
  if (d.length === 11) return validarCPF(d);
  if (d.length === 14) return validarCNPJ(d);
  return false;
}

export function formatarDocumentoFiscal(raw: string | null | undefined): string {
  const d = normalizarDocumentoFiscal(raw);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  }
  return d
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function mascaraDocumentoFiscal(raw: string): string {
  const digits = apenasDigitos(raw).slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}
