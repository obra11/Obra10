/**
 * Primeiro logo de capacete em outline limpo (commit 6d1c7c9).
 * Capacete Lucide branco em #E5192C — sem moldura, sem texto no ícone.
 * Uso: node scripts/generate-icons.cjs
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const OUT_PUBLIC = path.resolve(__dirname, '../public');
const OUT_BACKEND = path.resolve(__dirname, '../../obra10-backend/client');
const RED = '#E5192C';

/** Exato do favicon histórico 6d1c7c9, escalável. */
function markSvg(size = 512) {
  const s = size / 512;
  const rx = 96 * s;
  const tx = 88 * s;
  const ty = 88 * s;
  const scale = 14 * s;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" fill="none">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${RED}"/>
  <g transform="translate(${tx}, ${ty}) scale(${scale})" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M2 18h20"/>
    <path d="M20 18v-8a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v8"/>
    <path d="M9 6h6a1 1 0 0 1 1 1v2H8V7a1 1 0 0 1 1-1Z"/>
  </g>
</svg>
`;
}

/** PNG de atalho: quadrado cheio (sem rx) para vermelho uniforme no OS. */
function markSvgFlat(size = 512) {
  return markSvg(size).replace(/rx="[^"]*"/, 'rx="0"');
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

  fs.writeFileSync(path.join(dir, 'favicon.svg'), markSvg(512), 'utf8');
  fs.writeFileSync(path.join(dir, 'icon-192.svg'), markSvg(192), 'utf8');
  fs.writeFileSync(path.join(dir, 'icon-512.svg'), markSvg(512), 'utf8');
  fs.writeFileSync(path.join(dir, 'obra10-mark.svg'), markSvg(512), 'utf8');
  fs.writeFileSync(path.join(dir, 'obra10-wordmark.svg'), markSvg(512), 'utf8');

  for (const { name, size } of PNG_SIZES) {
    await sharp(Buffer.from(markSvgFlat(size)), { density: 384 })
      .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .flatten({ background: RED })
      .png({ compressionLevel: 9, palette: false })
      .toFile(path.join(dir, name));
    console.log(path.join(dir, name));
  }
}

(async () => {
  await writeAll(OUT_PUBLIC);
  await writeAll(OUT_BACKEND);
  console.log('OK — outline histórico 6d1c7c9 restaurado.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
