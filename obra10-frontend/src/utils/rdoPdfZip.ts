import JSZip from 'jszip';
import api from '../services/api';

export type RdoPdfItem = {
  id: string;
  label: string;
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_');
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

/**
 * Baixa PDFs individuais de cada RDO e empacota em um único .zip.
 */
export async function downloadRdosPdfZip(opts: {
  obraId: string;
  items: RdoPdfItem[];
  comFotos?: boolean;
  zipName?: string;
  onProgress?: (current: number, total: number) => void;
}): Promise<void> {
  const { obraId, items, comFotos = false, onProgress } = opts;
  if (!items.length) {
    throw new Error('Nenhum diário selecionado para exportar.');
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress?.(i + 1, items.length);

    const params = comFotos ? '?fotos=true' : '';
    const response = await api.get(`/rdos/${item.id}/pdf${params}`, {
      headers: { 'x-obra-id': obraId },
      responseType: 'blob',
      timeout: comFotos ? 120_000 : 60_000,
    });

    let base = sanitizeFilename(item.label || `RDO_${item.id.slice(-6)}`);
    if (!base.toLowerCase().endsWith('.pdf')) base += '.pdf';
    if (comFotos) base = base.replace(/\.pdf$/i, '_ComFotos.pdf');

    let filename = base;
    let n = 2;
    while (usedNames.has(filename.toLowerCase())) {
      filename = base.replace(/\.pdf$/i, `_${n}.pdf`);
      n += 1;
    }
    usedNames.add(filename.toLowerCase());

    zip.file(filename, response.data);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipName =
    opts.zipName ||
    `Relatorios_PDF_${new Date().toISOString().split('T')[0]}${comFotos ? '_ComFotos' : ''}.zip`;
  triggerDownload(zipBlob, zipName);
}
