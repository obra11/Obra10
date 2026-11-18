export const LIMIAR_SIMILARIDADE = 0.72;

const ABREVIACOES: Record<string, string> = {
  cim: 'cimento',
  port: 'portland',
  arg: 'argamassa',
  brit: 'brita',
  det: 'detergente',
  desinf: 'desinfetante',
  hig: 'higienico',
  sanit: 'sanitaria',
};

const STOP = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'para',
  'com',
  'em',
  'e',
  'a',
  'o',
  'por',
  'ao',
  'um',
  'uma',
]);

const LIMPEZA = [
  'detergente',
  'desinfetante',
  'sabao',
  'agua sanitaria',
  'papel higienico',
  'alcool',
  'vassoura',
  'rodo',
  'pano',
  'limpa vidro',
  'limpa piso',
  'desengordurante',
  'cloro',
  'amaciante',
  'esponja',
  'saco de lixo',
  'odorizador',
  'multiuso',
  'flanela',
  'sabonete',
];

export type MotivoMatch = 'EAN' | 'ALIAS' | 'SIMILAR';

export interface CandidatoMatch {
  insumoId: string;
  nome: string;
  score: number;
  motivo: MotivoMatch;
}

export function normalizarDescricao(input: string): string {
  const bruto = (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .toLowerCase()
    .replace(/n[º°]\s*/g, ' ')
    .replace(/(\d+)\s*(kg|g|mg|l|ml|m2|m3|un|cx|sc|cm|mm|m)\b/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return bruto
    .split(' ')
    .filter(Boolean)
    .map((t) => ABREVIACOES[t] || t)
    .join(' ');
}

function tokens(texto: string): string[] {
  return normalizarDescricao(texto)
    .split(' ')
    .filter((t) => t && !STOP.has(t));
}

function tokenCompativel(a: string, b: string): boolean {
  if (a === b) return true;
  const [curto, longo] = a.length <= b.length ? [a, b] : [b, a];
  if (curto.length < 3) return false;
  return longo.startsWith(curto);
}

/** Coeficiente de Dice com prefixo (cim ≈ cimento). */
export function similaridade(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const usados = new Set<number>();
  let inter = 0;
  for (const x of ta) {
    const idx = tb.findIndex((y, i) => !usados.has(i) && tokenCompativel(x, y));
    if (idx >= 0) {
      usados.add(idx);
      inter++;
    }
  }
  return (2 * inter) / (ta.length + tb.length);
}

export function somenteDigitos(valor?: string | null): string {
  return (valor || '').replace(/\D/g, '');
}

export function inferirCategoria(descricao: string): 'CONSTRUCAO' | 'LIMPEZA' | 'OUTRO' {
  const n = normalizarDescricao(descricao);
  if (!n) return 'OUTRO';
  if (LIMPEZA.some((k) => n.includes(k))) return 'LIMPEZA';
  return 'CONSTRUCAO';
}

export function sugerirInsumos(args: {
  descricao: string;
  ean?: string | null;
  insumos: { id: string; nome: string; ean?: string | null }[];
  aliases: { insumoId: string; descricaoNormalizada: string }[];
}): CandidatoMatch[] {
  const norm = normalizarDescricao(args.descricao);
  const ean = somenteDigitos(args.ean);
  const nomePorId = new Map(args.insumos.map((i) => [i.id, i.nome]));
  const out: CandidatoMatch[] = [];

  const jaTem = (id: string) => out.some((c) => c.insumoId === id);

  if (ean.length >= 8) {
    const hit = args.insumos.find((i) => somenteDigitos(i.ean) === ean);
    if (hit) {
      out.push({ insumoId: hit.id, nome: hit.nome, score: 1, motivo: 'EAN' });
    }
  }

  const aliasHit = args.aliases.find((a) => a.descricaoNormalizada === norm);
  if (aliasHit && !jaTem(aliasHit.insumoId)) {
    out.push({
      insumoId: aliasHit.insumoId,
      nome: nomePorId.get(aliasHit.insumoId) || norm,
      score: 0.99,
      motivo: 'ALIAS',
    });
  }

  const nomeExato = args.insumos.find((i) => normalizarDescricao(i.nome) === norm);
  if (nomeExato && !jaTem(nomeExato.id)) {
    out.push({
      insumoId: nomeExato.id,
      nome: nomeExato.nome,
      score: 0.99,
      motivo: 'ALIAS',
    });
  }

  const pontuados: { id: string; nome: string; score: number }[] = [];
  for (const insumo of args.insumos) {
    const score = similaridade(args.descricao, insumo.nome);
    if (score >= LIMIAR_SIMILARIDADE) {
      pontuados.push({ id: insumo.id, nome: insumo.nome, score });
    }
  }
  for (const alias of args.aliases) {
    const score = similaridade(norm, alias.descricaoNormalizada);
    if (score < LIMIAR_SIMILARIDADE) continue;
    const nome = nomePorId.get(alias.insumoId);
    if (!nome) continue;
    const atual = pontuados.find((p) => p.id === alias.insumoId);
    if (!atual) pontuados.push({ id: alias.insumoId, nome, score });
    else if (score > atual.score) atual.score = score;
  }

  pontuados.sort((a, b) => b.score - a.score);
  for (const item of pontuados) {
    if (out.length >= 3) break;
    if (jaTem(item.id)) continue;
    out.push({
      insumoId: item.id,
      nome: item.nome,
      score: Math.round(item.score * 100) / 100,
      motivo: 'SIMILAR',
    });
  }

  return out.slice(0, 3);
}
