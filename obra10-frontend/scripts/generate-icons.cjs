/**
 * Gera favicons e ícones PWA a partir do logo oficial Obra 10.
 * Uso: node scripts/generate-icons.js
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const SRC = path.resolve(__dirname, '../public/logo-obra10-source.png');
const FALLBACK_SRC = path.resolve(
  process.env.USERPROFILE || '',
  '.cursor/projects/d-ANTYGRAVITY-OBRA-10/assets',
  'c__Users_User_AppData_Roaming_Cursor_User_workspaceStorage_bd60fcbf49460ca3a642c7ba33191d7f_images_image-c2c776ef-5e60-4a83-b412-430fd64f591c.png',
);

const OUT_PUBLIC = path.resolve(__dirname, '../public');
const OUT_BACKEND = path.resolve(__dirname, '../../obra10-backend/client');

const SIZES = [
  { name: 'favicon-16.png', size: 16 },
  { name: 'favicon-32.png', size: 32 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
];

/** SVG fiel ao logo (capacete branco em fundo vermelho #E5192C). */
const SVG_TEMPLATE = (size, rx) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" fill="none">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#E5192C"/>
  <g transform="translate(${size * 0.17}, ${size * 0.18}) scale(${size / 512 * 14})" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M2 18h20"/>
    <path d="M20 18v-8a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v8"/>
    <path d="M9 6h6a1 1 0 0 1 1 1v2H8V7a1 1 0 0 1 1-1Z"/>
  </g>
</svg>
`;

async function main() {
  const source = fs.existsSync(SRC) ? SRC : FALLBACK_SRC;
  if (!fs.existsSync(source)) {
    throw new Error(`Logo fonte não encontrado: ${source}`);
  }
  for (const dir of [OUT_PUBLIC, OUT_BACKEND]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    for (const { name, size } of SIZES) {
      const dest = path.join(dir, name);
      await sharp(source)
        .resize(size, size, { fit: 'cover', position: 'centre' })
        .png({ compressionLevel: 9 })
        .toFile(dest);
      console.log('PNG', dest);
    }
    await sharp(source).png().toFile(path.join(dir, 'logo-obra10.png'));
  }

  // SVGs alinhados ao branding
  const svgs = [
    ['favicon.svg', 512, 96],
    ['icon-192.svg', 192, 36],
    ['icon-512.svg', 512, 96],
  ];
  for (const dir of [OUT_PUBLIC, OUT_BACKEND]) {
    for (const [name, size, rx] of svgs) {
      const p = path.join(dir, name);
      fs.writeFileSync(p, SVG_TEMPLATE(size, rx), 'utf8');
      console.log('SVG', p);
    }
  }

  console.log('Ícones Obra 10 atualizados.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
