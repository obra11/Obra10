import JSZip from 'jszip';
import api from '../services/api';

export type FotoZipItem = {
  id: string;
  nomeOriginal: string;
};

function sanitizeFilename(name: string): string {
  const base = (name || 'foto').replace(/[/\\?%*:|"<>]/g, '_').trim();
  return base || 'foto';
}

function uniqueName(name: string, used: Set<string>): string {
  const sanitized = sanitizeFilename(name);
  const dot = sanitized.lastIndexOf('.');
  const stem = dot > 0 ? sanitized.slice(0, dot) : sanitized;
  const ext = dot > 0 ? sanitized.slice(dot) : '';
  let candidate = sanitized;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${stem}_${n}${ext}`;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadAnexoArquivo(opts: {
  obraId: string;
  id: string;
  nomeOriginal: string;
}): Promise<void> {
  const response = await api.get(`/anexos/${opts.id}/arquivo`, {
    headers: { 'x-obra-id': opts.obraId },
    responseType: 'blob',
    timeout: 120_000,
  });
  triggerDownload(
    response.data,
    sanitizeFilename(opts.nomeOriginal || `foto_${opts.id.slice(-6)}.jpg`),
  );
}

export async function downloadFotosZip(opts: {
  obraId: string;
  items: FotoZipItem[];
  zipName?: string;
  onProgress?: (current: number, total: number) => void;
}): Promise<void> {
  const { obraId, items, onProgress } = opts;
  if (!items.length) {
    throw new Error('Selecione ao menos uma foto.');
  }

  const zip = new JSZip();
  const used = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress?.(i + 1, items.length);

    const response = await api.get(`/anexos/${item.id}/arquivo`, {
      headers: { 'x-obra-id': obraId },
      responseType: 'blob',
      timeout: 120_000,
    });

    zip.file(uniqueName(item.nomeOriginal || `foto_${item.id.slice(-6)}.jpg`, used), response.data);
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  const zipName =
    opts.zipName || `Fotos_Obra_${new Date().toISOString().split('T')[0]}.zip`;
  triggerDownload(zipBlob, zipName);
}
