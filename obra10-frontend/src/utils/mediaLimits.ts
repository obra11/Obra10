/** Limites de mídia do RDO — alinhados ao backend (`upload.controller`).
 * Teto prático ~100 MB: Cloudflare (obra10.app.br) rejeita corpos maiores no plano atual.
 * Para ir além (ex.: 200 MB), o próximo passo é upload direto ao R2 (URL pré-assinada).
 */

/** Vídeos no canteiro (mp4/mov) — 2× o limite antigo de 50 MB. */
export const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;
/** PDFs e demais anexos. */
export const MAX_ANEXO_UPLOAD_BYTES = 100 * 1024 * 1024;
/** Fotos (já comprimidas no aparelho). */
export const MAX_IMAGE_UPLOAD_BYTES = 15 * 1024 * 1024;
/** Teto do endpoint único de upload RDO (deve cobrir o maior tipo). */
export const MAX_RDO_MEDIA_BYTES = MAX_VIDEO_UPLOAD_BYTES;

/** Acima disso, em online, não duplicamos o vídeo no IndexedDB (só memória + upload). */
export const LARGE_VIDEO_SKIP_IDB_BYTES = 20 * 1024 * 1024;
/** Lado maior da foto após compressão no aparelho. */
export const IMAGE_COMPRESS_MAX_EDGE = 1920;
/** Qualidade JPEG da compressão (0–1). */
export const IMAGE_COMPRESS_QUALITY = 0.78;
/** Anexos offline órfãos mais velhos que isto são apagados. */
export const OFFLINE_ATTACHMENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export type MediaSizeCheck =
  | { ok: true }
  | { ok: false; message: string };

export function maxBytesForMediaTipo(tipo: 'foto' | 'video' | 'anexo'): number {
  if (tipo === 'foto') return MAX_IMAGE_UPLOAD_BYTES;
  if (tipo === 'video') return MAX_VIDEO_UPLOAD_BYTES;
  return MAX_ANEXO_UPLOAD_BYTES;
}

export function checkMediaFileSize(
  file: File,
  tipo: 'foto' | 'video' | 'anexo',
): MediaSizeCheck {
  const max = maxBytesForMediaTipo(tipo);
  if (file.size > max) {
    return {
      ok: false,
      message: `${tipo === 'video' ? 'Vídeo' : tipo === 'foto' ? 'Foto' : 'Arquivo'} muito grande (${formatBytes(file.size)}). Máximo: ${formatBytes(max)}.`,
    };
  }
  return { ok: true };
}

/** true = gravar no IndexedDB; false = só manter em memória (upload direto). */
export function shouldPersistVideoToIdb(file: File, online: boolean): boolean {
  if (!online) return true;
  return file.size <= LARGE_VIDEO_SKIP_IDB_BYTES;
}

export async function estimateIdbFreeBytes(): Promise<number | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { quota, usage } = await navigator.storage.estimate();
    if (quota == null || usage == null) return null;
    return Math.max(0, quota - usage);
  } catch {
    return null;
  }
}
