/**
 * Marca Obra 10 — SVG vetorial nítido + PNGs em vermelho sólido #E5192C.
 * Uso: node scripts/generate-icons.cjs
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const OUT_PUBLIC = path.resolve(__dirname, '../public');
const OUT_BACKEND = path.resolve(__dirname, '../../obra10-backend/client');
const RED = '#E5192C';

/**
 * Capacete (estilo Lucide HardHat) em traço branco, fundo vermelho Lunardeli.
 * @param {number} size
 * @param {{ round?: boolean }} opts — round só no SVG de UI; PNG de atalho fica quadrado cheio.
 */
function markSvg(size = 512, opts = { round: true }) {
  const rx = opts.round ? Math.round(size * 0.22) : 0;
  const s = size / 512;
  // Capacete centralizado no canvas 512 → escala proporcional
  const tx = 112 * s;
  const ty = 118 * s;
  const scale = 12 * s;
  const sw = 2.55;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" fill="none">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${RED}"/>
  <g transform="translate(${tx}, ${ty}) scale(${scale})" stroke="#FFFFFF" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M2 18h20"/>
    <path d="M20 18v-8a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v8"/>
    <path d="M9 6h6a1 1 0 0 1 1 1v2H8V7a1 1 0 0 1 1-1Z"/>
  </g>
</svg>
`;
}

const PNG_SIZES = [
  { name: 'favicon-16.png', size: 16 },
  { name: 'favicon-32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'logo-obra10.png', size: 512 },
  { name: 'logo-obra10-source.png', size: 512 },
];

async function writeAll(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // SVGs arredondados para UI / favicon.svg
  fs.writeFileSync(path.join(dir, 'favicon.svg'), markSvg(512, { round: true }), 'utf8');
  fs.writeFileSync(path.join(dir, 'icon-192.svg'), markSvg(192, { round: true }), 'utf8');
  fs.writeFileSync(path.join(dir, 'icon-512.svg'), markSvg(512, { round: true }), 'utf8');
  fs.writeFileSync(path.join(dir, 'obra10-mark.svg'), markSvg(512, { round: true }), 'utf8');

  // PNGs quadrado cheio (sem canto arredondado) → vermelho uniforme no atalho/PWA
  for (const { name, size } of PNG_SIZES) {
    const svg = Buffer.from(markSvg(size, { round: false }));
    await sharp(svg, { density: 384 })
      .resize(size, size, {
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
      })
      .flatten({ background: RED })
      .png({ compressionLevel: 9, palette: false })
      .toFile(path.join(dir, name));
    console.log(path.join(dir, name));
  }
}

(async () => {
  await writeAll(OUT_PUBLIC);
  await writeAll(OUT_BACKEND);
  console.log('OK — marca vetorial (#E5192C) regenerada.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
