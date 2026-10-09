export type RegistroBusca = {
  empresaId: string;
  obraId: string;
  obraNome: string;
  data?: string | null;
  status?: string | null;
  rdoId?: string | null;
  origem: string;
  texto: string;
};

const STOP = new Set([
  'quando',
  'onde',
  'como',
  'qual',
  'quais',
  'para',
  'pela',
  'pelo',
  'com',
  'sem',
  'uma',
  'uns',
  'das',
  'dos',
  'que',
  'foi',
  'foram',
  'esta',
  'este',
  'essa',
  'esse',
  'nao',
  'mais',
  'sobre',
  'entre',
]);

export function fold(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/º/g, 'o');
}

export function termosDeBusca(consulta: string): string[] {
  const words = fold(consulta)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOP.has(word));
  return [...new Set(words.map((word) => (word.length >= 7 ? word.slice(0, 6) : word)))];
}

function casa(texto: string, termos: string[]): boolean {
  const found = termos.filter((termo) => texto.includes(termo));
  const minimo = Math.min(2, termos.length);
  return found.length >= minimo;
}

export function selecionarTrechos(
  consulta: string,
  empresaId: string,
  registros: RegistroBusca[],
  limite = 20,
) {
  const termos = termosDeBusca(consulta);
  const vistos = new Set<string>();
  const achados: Array<{
    obra: string;
    obra_id: string;
    data: string | null;
    status: string | null;
    rdo_id: string | null;
    origem: string;
    trecho: string;
  }> = [];

  for (const registro of registros) {
    if (registro.empresaId !== empresaId) continue;
    const texto = fold(registro.texto || '');
    if (!termos.length || !casa(texto, termos)) continue;
    const chave = `${registro.origem}:${registro.rdoId || registro.obraId}:${fold(registro.texto).slice(0, 80)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    achados.push({
      obra: registro.obraNome,
      obra_id: registro.obraId,
      data: registro.data || null,
      status: registro.status || null,
      rdo_id: registro.rdoId || null,
      origem: registro.origem,
      trecho: String(registro.texto || '').replace(/\s+/g, ' ').trim().slice(0, 240),
    });
    if (achados.length >= limite) break;
  }

  return { consulta, termos, total: achados.length, achados };
}
