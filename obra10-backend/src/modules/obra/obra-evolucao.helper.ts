export type FotoEvolucaoInput = {
  id: string;
  rdoId: string;
  urlS3: string;
  mimeType?: string | null;
  tipoArquivo?: string | null;
  nomeOriginal?: string | null;
  createdAt: Date;
  criadorNome?: string | null;
};

export type RdoEvolucaoInput = {
  id: string;
  dataReferencia: Date;
  status: string;
  atividades: string[];
};

export type FotoEvolucao = {
  id: string;
  rdoId: string;
  urlS3: string;
  viewUrl: string;
  legenda: string;
  criadorNome: string | null;
  createdAt: string;
};

export type DiaEvolucao = {
  data: string;
  rdoId: string;
  rdoStatus: string;
  atividades: string[];
  fotos: FotoEvolucao[];
};

export type ResumoEvolucao = {
  totalFotos: number;
  totalDiasComFoto: number;
  totalRdos: number;
  primeiraData: string | null;
  ultimaData: string | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Data de referência no calendário (UTC) para agrupar a linha do tempo. */
export function chaveDataISO(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function parseDateOnly(
  value?: string | null,
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return undefined;
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0),
  );
}

export function clampPercentual(
  value?: number | string | null,
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function ehFotoEvolucao(
  mimeType?: string | null,
  tipoArquivo?: string | null,
): boolean {
  const mime = String(mimeType || '').toLowerCase();
  const tipo = String(tipoArquivo || '').toUpperCase();
  if (mime.startsWith('image/')) return true;
  return tipo === 'FOTO_DIARIO' || tipo === 'FOTO' || tipo.startsWith('FOTO_');
}

function resolverViewUrl(urlS3: string): string {
  if (!urlS3) return '';
  if (
    urlS3.startsWith('http://') ||
    urlS3.startsWith('https://') ||
    urlS3.startsWith('/uploads/')
  ) {
    return urlS3;
  }
  return urlS3;
}

function atividadesDoRdo(rdo: RdoEvolucaoInput): string[] {
  return (rdo.atividades || [])
    .map((a) => String(a || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function montarTimelineEvolucao(
  rdos: RdoEvolucaoInput[],
  fotos: FotoEvolucaoInput[],
): { dias: DiaEvolucao[]; resumo: ResumoEvolucao } {
  const rdoPorId = new Map(rdos.map((r) => [r.id, r]));
  const diasMap = new Map<string, DiaEvolucao>();

  const garantirDia = (rdo: RdoEvolucaoInput): DiaEvolucao | null => {
    const data = chaveDataISO(rdo.dataReferencia);
    if (!data) return null;
    const existente = diasMap.get(data);
    if (existente) return existente;
    const dia: DiaEvolucao = {
      data,
      rdoId: rdo.id,
      rdoStatus: rdo.status,
      atividades: atividadesDoRdo(rdo),
      fotos: [],
    };
    diasMap.set(data, dia);
    return dia;
  };

  let totalFotos = 0;
  for (const foto of fotos) {
    if (!ehFotoEvolucao(foto.mimeType, foto.tipoArquivo)) continue;
    const rdo = rdoPorId.get(foto.rdoId);
    if (!rdo) continue;
    const dia = garantirDia(rdo);
    if (!dia) continue;
    dia.fotos.push({
      id: foto.id,
      rdoId: foto.rdoId,
      urlS3: foto.urlS3,
      viewUrl: resolverViewUrl(foto.urlS3),
      legenda: String(foto.nomeOriginal || '').trim(),
      criadorNome: foto.criadorNome || null,
      createdAt: foto.createdAt.toISOString(),
    });
    totalFotos += 1;
  }

  const dias = Array.from(diasMap.values())
    .filter((d) => d.fotos.length > 0)
    .sort((a, b) => b.data.localeCompare(a.data));

  const diasComFoto = dias.filter((d) => d.fotos.length > 0);
  const datasComFoto = diasComFoto.map((d) => d.data).sort();

  return {
    dias,
    resumo: {
      totalFotos,
      totalDiasComFoto: diasComFoto.length,
      totalRdos: rdos.length,
      primeiraData: datasComFoto[0] || null,
      ultimaData: datasComFoto[datasComFoto.length - 1] || null,
    },
  };
}
