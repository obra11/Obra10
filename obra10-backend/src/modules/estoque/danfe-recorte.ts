import jpeg from 'jpeg-js';

type Foto = { width: number; height: number; data: Uint8Array };

export function recortesDanfe(buffer: Buffer): { chave: Buffer; emitente: Buffer } | null {
  let foto: Foto;
  try {
    foto = jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 128 });
  } catch {
    return null;
  }
  if (!foto?.width || !foto?.height) return null;
  return {
    chave: cortar(foto, 0.4, 0.05, 0.58, 0.17),
    emitente: cortar(foto, 0, 0.22, 0.75, 0.12),
  };
}

function cortar(foto: Foto, xRel: number, yRel: number, wRel: number, hRel: number): Buffer {
  const escala = 2;
  const x0 = Math.max(0, Math.floor(foto.width * xRel));
  const y0 = Math.max(0, Math.floor(foto.height * yRel));
  const w = Math.max(1, Math.min(foto.width - x0, Math.floor(foto.width * wRel)));
  const h = Math.max(1, Math.min(foto.height - y0, Math.floor(foto.height * hRel)));
  const sw = w * escala;
  const sh = h * escala;
  const data = Buffer.alloc(sw * sh * 4);
  for (let y = 0; y < sh; y++) {
    const sy = y0 + Math.min(h - 1, Math.floor(y / escala));
    for (let x = 0; x < sw; x++) {
      const sx = x0 + Math.min(w - 1, Math.floor(x / escala));
      const origem = (sy * foto.width + sx) * 4;
      const destino = (y * sw + x) * 4;
      data[destino] = foto.data[origem];
      data[destino + 1] = foto.data[origem + 1];
      data[destino + 2] = foto.data[origem + 2];
      data[destino + 3] = 255;
    }
  }
  return Buffer.from(jpeg.encode({ data, width: sw, height: sh }, 90).data);
}
