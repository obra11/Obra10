/**
 * Logo oficial Obra 10 (referência do usuário):
 * capacete branco em outline (cúpula + crista + aba) em vermelho.
 * Uso: node scripts/generate-icons.cjs
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const OUT_PUBLIC = path.resolve(__dirname, '../public');
const OUT_BACKEND = path.resolve(__dirname, '../../obra10-backend/client');
// Vermelho da marca Lunardeli (UI). O PNG enviado era ~#CE1628 por compressão.
const RED = '#E5192C';

/**
 * Capacete estilo da logo enviada: aba + cúpula arredondada + crista no topo.
 * NÃO é o Lucide (caixa). É o outline de capacete de obra.
 */
function markSvg(size = 512, { round = true } = {}) {
  const rx = round ? Math.round(size * 0.18) : 0;
  // viewBox 0 0 100 100 — traço ~7.5
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" fill="none">
  <rect width="100" height="100" rx="${round ? 18 : 0}" fill="${RED}"/>
  <g
    stroke="#FFFFFF"
    stroke-width="7.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  >
    <!-- aba -->
    <path d="M18 70 H82"/>
    <!-- cúpula -->
    <path d="M26 70 V54 C26 38 36 29 50 29 C64 29 74 38 74 54 V70"/>
    <!-- crista -->
    <path d="M41 29 V21 C41 15.5 45 12.5 50 12.5 C55 12.5 59 15.5 59 21 V29"/>
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
];

async function writeAll(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, 'favicon.svg'), markSvg(512, { round: true }), 'utf8');
  fs.writeFileSync(path.join(dir, 'icon-192.svg'), markSvg(192, { round: true }), 'utf8');
  fs.writeFileSync(path.join(dir, 'icon-512.svg'), markSvg(512, { round: true }), 'utf8');
  fs.writeFileSync(path.join(dir, 'obra10-mark.svg'), markSvg(512, { round: true }), 'utf8');
  fs.writeFileSync(path.join(dir, 'obra10-wordmark.svg'), markSvg(512, { round: true }), 'utf8');

  // Master PNG 512 a partir do SVG (nítido)
  const master = await sharp(Buffer.from(markSvg(512, { round: false })), { density: 384 })
    .resize(512, 512, { fit: 'fill' })
    .flatten({ background: RED })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

  await sharp(master).toFile(path.join(dir, 'logo-obra10-source.png'));

  for (const { name, size } of PNG_SIZES) {
    await sharp(Buffer.from(markSvg(size, { round: false })), { density: 384 })
      .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .flatten({ background: RED })
      .png({ compressionLevel: 9, palette: false })
      .toFile(path.join(dir, name));
    console.log(path.join(dir, name));
  }
}

(async () => {
  // Guarda o PNG original do usuário como referência
  const userSrc = path.resolve(__dirname, '../public/logo-obra10-user.png');
  const asset = path.resolve(
    process.env.USERPROFILE || '',
    '.cursor/projects/d-ANTYGRAVITY-OBRA-10/assets',
    'c__Users_User_AppData_Roaming_Cursor_User_workspaceStorage_bd60fcbf49460ca3a642c7ba33191d7f_images_LOGO-99e23749-c61f-4338-8bcd-bcfe2d68a84c.png',
  );
  if (fs.existsSync(asset)) {
    fs.copyFileSync(asset, userSrc);
    fs.copyFileSync(asset, path.join(OUT_BACKEND, 'logo-obra10-user.png'));
  }

  await writeAll(OUT_PUBLIC);
  await writeAll(OUT_BACKEND);
  console.log('OK — logo do usuário (capacete outline) aplicada.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
