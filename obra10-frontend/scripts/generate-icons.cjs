/**
 * Gera favicons e ícones PWA a partir do logo oficial Obra 10 (PNG).
 * Uso: node scripts/generate-icons.cjs
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
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
];

function svgFromPngBase64(b64, size) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <image width="${size}" height="${size}" href="data:image/png;base64,${b64}" xlink:href="data:image/png;base64,${b64}"/>
</svg>
`;
}

async function main() {
  const source = fs.existsSync(SRC) ? SRC : FALLBACK_SRC;
  if (!fs.existsSync(source)) {
    throw new Error(`Logo fonte não encontrado: ${source}`);
  }

  // PNG master 512 para embutir no SVG (mesma arte do atalho)
  const master512 = await sharp(source)
    .resize(512, 512, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();
  const b64 = master512.toString('base64');

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

    // SVGs = PNG embutido (idêntico ao logo oficial — sem traço Lucide)
    const svgs = [
      ['favicon.svg', 512],
      ['icon-192.svg', 192],
      ['icon-512.svg', 512],
    ];
    for (const [name, size] of svgs) {
      const buf =
        size === 512
          ? master512
          : await sharp(source)
              .resize(size, size, { fit: 'cover', position: 'centre' })
              .png()
              .toBuffer();
      const p = path.join(dir, name);
      fs.writeFileSync(p, svgFromPngBase64(buf.toString('base64'), size), 'utf8');
      console.log('SVG', p);
    }
  }

  // Também grava um SVG “marca” no public (para <img>)
  fs.writeFileSync(
    path.join(OUT_PUBLIC, 'obra10-mark.svg'),
    svgFromPngBase64(b64, 512),
    'utf8',
  );

  console.log('Ícones Obra 10 atualizados a partir do logo oficial.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
