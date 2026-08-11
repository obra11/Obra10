/**
 * Persiste mídia capturada pela câmera no aparelho (Downloads/Galeria/Arquivos),
 * como cópia de segurança além do upload no RDO.
 *
 * Limitações do navegador:
 * - Android: costuma ir para Downloads (visível na Galeria).
 * - iOS: tenta Share Sheet (Salvar Imagem/Vídeo); se cancelado, faz download para Arquivos.
 */

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function extensionFor(file: File, kind: 'image' | 'video'): string {
  const fromName = file.name?.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/i.test(fromName)) return fromName;

  const mime = (file.type || '').toLowerCase();
  if (kind === 'image') {
    if (mime.includes('png')) return 'png';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('heic') || mime.includes('heif')) return 'heic';
    return 'jpg';
  }
  if (mime.includes('quicktime') || mime.includes('mov')) return 'mov';
  if (mime.includes('webm')) return 'webm';
  return 'mp4';
}

function buildFilename(file: File, kind: 'image' | 'video'): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, '')
    .replace('T', '_');
  const ext = extensionFor(file, kind);
  return `OBRA10_${kind === 'image' ? 'foto' : 'video'}_${stamp}.${ext}`;
}

function triggerDownload(file: File, filename: string) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export type PersistMediaResult = 'shared' | 'downloaded' | 'skipped' | 'failed';

/**
 * Salva no aparelho uma cópia do arquivo capturado pela câmera.
 */
export async function persistCapturedMediaToDevice(
  file: File,
  kind: 'image' | 'video',
): Promise<PersistMediaResult> {
  if (!file || file.size === 0) return 'skipped';

  const filename = buildFilename(file, kind);
  const mime =
    file.type || (kind === 'image' ? 'image/jpeg' : 'video/mp4');
  const named = new File([file], filename, { type: mime });

  // iOS: Share Sheet permite "Salvar Imagem/Vídeo" na Galeria (Photos).
  if (isIOSDevice() && typeof navigator.share === 'function') {
    try {
      const canShareFiles =
        typeof navigator.canShare === 'function'
          ? navigator.canShare({ files: [named] })
          : true;
      if (canShareFiles) {
        await navigator.share({
          files: [named],
          title: filename,
          text: 'Salve na Galeria para não perder esta mídia do RDO.',
        });
        return 'shared';
      }
    } catch (err: any) {
      // Usuário cancelou o share — ainda tenta download como backup.
      if (err?.name === 'AbortError') {
        try {
          triggerDownload(named, filename);
          return 'downloaded';
        } catch {
          return 'failed';
        }
      }
    }
  }

  try {
    triggerDownload(named, filename);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

export async function persistCapturedMediaList(
  files: File[],
  kind: 'image' | 'video',
): Promise<PersistMediaResult> {
  let last: PersistMediaResult = 'skipped';
  for (const file of files) {
    last = await persistCapturedMediaToDevice(file, kind);
  }
  return last;
}
