/** Limites alinhados ao backend (upload RDO = 50 MB). */
export const MAX_RDO_MEDIA_BYTES = 50 * 1024 * 1024;
/** Acima disso, em online, não duplicamos o vídeo no IndexedDB (só memória + upload). */
export const LARGE_VIDEO_SKIP_IDB_BYTES = 12 * 1024 * 1024;
/** Fotos/anexos no endpoint de imagem: 15 MB. */
export const MAX_IMAGE_UPLOAD_BYTES = 15 * 1024 * 1024;

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export type MediaSizeCheck =
  | { ok: true }
  | { ok: false; message: string };

export function checkMediaFileSize(
  file: File,
  tipo: 'foto' | 'video' | 'anexo',
): MediaSizeCheck {
  const max =
    tipo === 'foto' ? MAX_IMAGE_UPLOAD_BYTES : MAX_RDO_MEDIA_BYTES;
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
