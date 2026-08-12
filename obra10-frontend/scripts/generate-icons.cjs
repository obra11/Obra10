/**
 * Logo Obra 10 — arte fornecida pelo usuário (exata).
 * Vermelho da arte: #CE1628
 * Ícone: PNG oficial do usuário, centrado (sem moldura inventada).
 * Lockup: ícone + OBRA 10 como no banner.
 * Uso: node scripts/generate-icons.cjs
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const OUT_PUBLIC = path.resolve(__dirname, '../public');
const OUT_BACKEND = path.resolve(__dirname, '../../obra10-backend/client');
const RED = '#CE1628';
const RED_RGB = { r: 206, g: 22, b: 40 };

const USER_ICON = path.resolve(__dirname, '../public/logo-obra10-user.png');
const USER_ASSET = path.resolve(
  process.env.USERPROFILE || '',
  '.cursor/projects/d-ANTYGRAVITY-OBRA-10/assets',
  'c__Users_User_AppData_Roaming_Cursor_User_workspaceStorage_bd60fcbf49460ca3a642c7ba33191d7f_images_LOGO-99e23749-c61f-4338-8bcd-bcfe2d68a84c.png',
);
const BANNER_ASSET = path.resolve(
  process.env.USERPROFILE || '',
  '.cursor/projects/d-ANTYGRAVITY-OBRA-10/assets',
  'c__Users_User_AppData_Roaming_Cursor_User_workspaceStorage_bd60fcbf49460ca3a642c7ba33191d7f_images_image-bab41724-432c-4b95-9309-b086cebba464.png',
);

async function buildMasterIcon(size) {
  // Capacete do usuário em quadrado vermelho #CE1628 (mesmo vermelho da arte)
  // Menos padding → capacete mais presente (proporcional ao wordmark)
  const pad = Math.round(size * 0.06);
  const inner = size - pad * 2;
  const hat = await sharp(USER_ICON)
    .resize(inner, inner, {
      fit: 'contain',
      background: { ...RED_RGB, alpha: 1 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: RED_RGB,
    },
  })
    .composite([{ input: hat, left: pad, top: pad }])
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
}

function svgFromPng(b64, size) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <image width="${size}" height="${size}" href="data:image/png;base64,${b64}" xlink:href="data:image/png;base64,${b64}"/>
</svg>
`;
}

async function buildWordmarkPng() {
  // Lockup 640×160: tile ~altura do banner (como na arte) + OBRA 10
  const W = 640;
  const H = 160;
  const tile = 128;
  const tileX = 16;
  const tileY = 16;
  const iconPad = 10;

  const iconInner = tile - iconPad * 2;
  const hat = await sharp(USER_ICON)
    .resize(iconInner, iconInner, {
      fit: 'contain',
      background: { ...RED_RGB, alpha: 1 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  // Tile com cantos arredondados via SVG mask
  const tileSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}">
  <rect width="${tile}" height="${tile}" rx="24" fill="${RED}"/>
</svg>`);

  const tilePng = await sharp(tileSvg)
    .composite([{ input: hat, left: iconPad, top: iconPad }])
    .png()
    .toBuffer();

  // Texto via SVG
  const textSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${RED}"/>
  <text x="160" y="108" fill="#FFFFFF" font-family="Inter, Arial Black, Arial, sans-serif" font-size="72" font-weight="800" letter-spacing="-1.5">OBRA 10</text>
</svg>`);

  return sharp(textSvg)
    .composite([{ input: tilePng, left: tileX, top: tileY }])
    .png()
    .toBuffer();
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

async function writeAll(dir, master512, wordmark) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const b64 = master512.toString('base64');
  fs.writeFileSync(path.join(dir, 'favicon.svg'), svgFromPng(b64, 512), 'utf8');
  fs.writeFileSync(path.join(dir, 'icon-192.svg'), svgFromPng(b64, 512), 'utf8');
  fs.writeFileSync(path.join(dir, 'icon-512.svg'), svgFromPng(b64, 512), 'utf8');
  fs.writeFileSync(path.join(dir, 'obra10-mark.svg'), svgFromPng(b64, 512), 'utf8');

  for (const { name, size } of PNG_SIZES) {
    const buf = size === 512 ? master512 : await buildMasterIcon(size);
    await sharp(buf).toFile(path.join(dir, name));
    console.log(path.join(dir, name));
  }

  await sharp(wordmark).toFile(path.join(dir, 'obra10-wordmark.png'));
  // SVG wordmark = PNG embutido (fiel ao lockup)
  const wmB64 = wordmark.toString('base64');
  fs.writeFileSync(
    path.join(dir, 'obra10-wordmark.svg'),
    `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 640 160" width="640" height="160">
  <image width="640" height="160" href="data:image/png;base64,${wmB64}" xlink:href="data:image/png;base64,${wmB64}"/>
</svg>
`,
    'utf8',
  );

  if (fs.existsSync(USER_ICON)) {
    fs.copyFileSync(USER_ICON, path.join(dir, 'logo-obra10-user.png'));
  }
}

(async () => {
  if (fs.existsSync(USER_ASSET)) fs.copyFileSync(USER_ASSET, USER_ICON);
  if (fs.existsSync(BANNER_ASSET)) {
    fs.copyFileSync(BANNER_ASSET, path.resolve(__dirname, '../public/brand-lockup-ref.png'));
  }
  if (!fs.existsSync(USER_ICON)) throw new Error('logo-obra10-user.png ausente');

  const master512 = await buildMasterIcon(512);
  const wordmark = await buildWordmarkPng();
  await writeAll(OUT_PUBLIC, master512, wordmark);
  await writeAll(OUT_BACKEND, master512, wordmark);
  console.log('OK — logo EXATA do usuário aplicada (#CE1628).');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
