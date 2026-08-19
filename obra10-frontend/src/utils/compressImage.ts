import {
  IMAGE_COMPRESS_MAX_EDGE,
  IMAGE_COMPRESS_QUALITY,
  formatBytes,
} from './mediaLimits';

/**
 * Redimensiona/comprime foto no aparelho (canvas) antes de IndexedDB/upload.
 * Se falhar (ex.: HEIC sem decoder), devolve o arquivo original.
 */
export async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
    return file;
  }
  // GIF animado / HEIC: não forçar canvas
  if (/image\/gif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const maxEdge = Math.max(width, height);
    const scale =
      maxEdge > IMAGE_COMPRESS_MAX_EDGE ? IMAGE_COMPRESS_MAX_EDGE / maxEdge : 1;
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', IMAGE_COMPRESS_QUALITY),
    );
    if (!blob || blob.size === 0) return file;

    // Só troca se realmente encolheu (ou ficou razoável)
    if (blob.size >= file.size * 0.98 && scale === 1) return file;

    const base = (file.name || 'foto').replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } catch (err) {
    console.warn('compressImageFile falhou, usando original:', err);
    return file;
  }
}

export async function compressImageFiles(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) {
    const compressed = await compressImageFile(f);
    if (compressed.size !== f.size) {
      console.debug(
        `[compress] ${f.name} ${formatBytes(f.size)} → ${formatBytes(compressed.size)}`,
      );
    }
    out.push(compressed);
  }
  return out;
}
