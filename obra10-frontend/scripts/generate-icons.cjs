/**
 * Restaura o primeiro logotipo Obra 10 (capacete preenchido + OBRA 10).
 * Fonte: commit anterior a 6d1c7c9 (helmet outline).
 * Uso: node scripts/generate-icons.cjs
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const OUT_PUBLIC = path.resolve(__dirname, '../public');
const OUT_BACKEND = path.resolve(__dirname, '../../obra10-backend/client');
const RED = '#E5192C';

/** Ícone completo original: capacete + OBRA / 10 */
function appIconSvg(size = 512) {
  const s = size / 512;
  const tx = 80 * s;
  const ty = 100 * s;
  const sx = s;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" fill="none">
  <rect width="${size}" height="${size}" rx="${96 * s}" fill="${RED}"/>
  <g transform="translate(${tx}, ${ty}) scale(${sx})">
    <path d="M176 0C96 0 32 64 32 144v16H0v48h32v16c0 16 8 24 24 24h240c16 0 24-8 24-24v-16h32v-48h-32v-16C320 64 256 0 176 0z" fill="#FFFFFF" fill-opacity="0.95"/>
    <path d="M176 32c-60 0-112 52-112 112v16h224v-16c0-60-52-112-112-112z" fill="${RED}"/>
    <text x="176" y="290" text-anchor="middle" font-family="Inter, Arial Black, Arial, sans-serif" font-weight="900" font-size="72" fill="#FFFFFF" letter-spacing="-2">OBRA</text>
    <text x="176" y="340" text-anchor="middle" font-family="Inter, Arial Black, Arial, sans-serif" font-weight="900" font-size="52" fill="#FFFFFF" fill-opacity="0.9" letter-spacing="8">10</text>
  </g>
</svg>
`;
}

/**
 * Só o capacete (para UI ao lado do wordmark "OBRA 10").
 * Mesmo traço preenchido do primeiro logo.
 */
function markOnlySvg(size = 512) {
  const s = size / 512;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" fill="none">
  <rect width="${size}" height="${size}" rx="${96 * s}" fill="${RED}"/>
  <g transform="translate(${96 * s}, ${136 * s}) scale(${s})">
    <path d="M176 0C96 0 32 64 32 144v16H0v48h32v16c0 16 8 24 24 24h240c16 0 24-8 24-24v-16h32v-48h-32v-16C320 64 256 0 176 0z" fill="#FFFFFF" fill-opacity="0.95"/>
    <path d="M176 32c-60 0-112 52-112 112v16h224v-16c0-60-52-112-112-112z" fill="${RED}"/>
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

  const fav = appIconSvg(512);
  fs.writeFileSync(path.join(dir, 'favicon.svg'), fav, 'utf8');
  fs.writeFileSync(path.join(dir, 'icon-192.svg'), appIconSvg(192), 'utf8');
  fs.writeFileSync(path.join(dir, 'icon-512.svg'), appIconSvg(512), 'utf8');
  fs.writeFileSync(path.join(dir, 'obra10-mark.svg'), markOnlySvg(512), 'utf8');
  fs.writeFileSync(path.join(dir, 'obra10-wordmark.svg'), fav, 'utf8');

  for (const { name, size } of PNG_SIZES) {
    const svg = Buffer.from(appIconSvg(size));
    await sharp(svg, { density: 300 })
      .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .flatten({ background: RED })
      .png({ compressionLevel: 9, palette: false })
      .toFile(path.join(dir, name));
    console.log(path.join(dir, name));
  }

  await sharp(Buffer.from(markOnlySvg(512)), { density: 300 })
    .resize(512, 512, { fit: 'contain', background: RED })
    .flatten({ background: RED })
    .png()
    .toFile(path.join(dir, 'obra10-wordmark.png'));
}

(async () => {
  await writeAll(OUT_PUBLIC);
  await writeAll(OUT_BACKEND);
  console.log('OK — primeiro logo Obra 10 (capacete preenchido) restaurado.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
