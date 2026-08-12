/**
 * Marca Obra 10 — SVG vetorial nítido alinhado ao brand (moldura branca + capacete).
 * Vermelho oficial: #E5192C
 * Uso: node scripts/generate-icons.cjs
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const OUT_PUBLIC = path.resolve(__dirname, '../public');
const OUT_BACKEND = path.resolve(__dirname, '../../obra10-backend/client');
const RED = '#E5192C';

/**
 * Ícone: capacete branco dentro de quadrado arredondado com moldura branca.
 * @param {number} size
 * @param {{ outerRound?: boolean }} opts
 *   outerRound: arredonda o fundo do SVG (UI). PNG de atalho usa false (quadrado cheio).
 */
function markSvg(size = 512, opts = { outerRound: true }) {
  const outerRx = opts.outerRound ? Math.round(size * 0.22) : 0;
  const pad = size * 0.09;
  const frameRx = size * 0.18;
  const frameStroke = Math.max(2, size * 0.045);

  // Capacete (Lucide HardHat) centralizado na área interna
  const inner = size - pad * 2;
  const hatScale = (inner * 0.52) / 24;
  const hatTx = pad + (inner - 24 * hatScale) / 2;
  const hatTy = pad + (inner - 24 * hatScale) / 2 - size * 0.01;
  const hatSw = 2.45;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" fill="none">
  <rect width="${size}" height="${size}" rx="${outerRx}" fill="${RED}"/>
  <rect x="${pad}" y="${pad}" width="${size - pad * 2}" height="${size - pad * 2}" rx="${frameRx}" fill="none" stroke="#FFFFFF" stroke-width="${frameStroke}"/>
  <g transform="translate(${hatTx}, ${hatTy}) scale(${hatScale})" stroke="#FFFFFF" stroke-width="${hatSw}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M2 18h20"/>
    <path d="M20 18v-8a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v8"/>
    <path d="M9 6h6a1 1 0 0 1 1 1v2H8V7a1 1 0 0 1 1-1Z"/>
  </g>
</svg>
`;
}

/** Wordmark completo: ícone + OBRA 10 (como no brand). */
function wordmarkSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 160" width="560" height="160" fill="none">
  <rect width="560" height="160" fill="${RED}"/>
  <!-- mark -->
  <rect x="16" y="16" width="128" height="128" rx="28" fill="${RED}"/>
  <rect x="28" y="28" width="104" height="104" rx="22" fill="none" stroke="#FFFFFF" stroke-width="6"/>
  <g transform="translate(48, 50) scale(3.7)" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M2 18h20"/>
    <path d="M20 18v-8a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v8"/>
    <path d="M9 6h6a1 1 0 0 1 1 1v2H8V7a1 1 0 0 1 1-1Z"/>
  </g>
  <!-- wordmark -->
  <text x="168" y="108" fill="#FFFFFF" font-family="Inter, Arial Black, Arial, sans-serif" font-size="72" font-weight="800" letter-spacing="-1.5">OBRA 10</text>
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

  fs.writeFileSync(path.join(dir, 'favicon.svg'), markSvg(512, { outerRound: true }), 'utf8');
  fs.writeFileSync(path.join(dir, 'icon-192.svg'), markSvg(192, { outerRound: true }), 'utf8');
  fs.writeFileSync(path.join(dir, 'icon-512.svg'), markSvg(512, { outerRound: true }), 'utf8');
  fs.writeFileSync(path.join(dir, 'obra10-mark.svg'), markSvg(512, { outerRound: true }), 'utf8');
  fs.writeFileSync(path.join(dir, 'obra10-wordmark.svg'), wordmarkSvg(), 'utf8');

  for (const { name, size } of PNG_SIZES) {
    // Atalho/PWA: moldura branca + fundo vermelho cheio (sem canto externo)
    const svg = Buffer.from(markSvg(size, { outerRound: false }));
    await sharp(svg, { density: 384 })
      .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .flatten({ background: RED })
      .png({ compressionLevel: 9, palette: false })
      .toFile(path.join(dir, name));
    console.log(path.join(dir, name));
  }

  await sharp(Buffer.from(wordmarkSvg()), { density: 300 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(dir, 'obra10-wordmark.png'));
}

(async () => {
  await writeAll(OUT_PUBLIC);
  await writeAll(OUT_BACKEND);
  console.log('OK — marca com moldura branca (#E5192C).');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
