const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const SRC = path.resolve(__dirname, '../public/logo-obra10-source.png');
const OUTS = [
  path.resolve(__dirname, '../public'),
  path.resolve(__dirname, '../../obra10-backend/client'),
];

const SIZES = [
  [16, 'favicon-16.png'],
  [32, 'favicon-32.png'],
  [180, 'apple-touch-icon.png'],
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
];

function svgEmbed(size, b64) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">` +
    `<image width="${size}" height="${size}" href="data:image/png;base64,${b64}" xlink:href="data:image/png;base64,${b64}"/>` +
    '</svg>\n'
  );
}

(async () => {
  if (!fs.existsSync(SRC)) throw new Error('Missing ' + SRC);
  const master = await sharp(SRC).resize(512, 512, { fit: 'cover' }).png().toBuffer();

  for (const dir of OUTS) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await sharp(master).toFile(path.join(dir, 'logo-obra10.png'));
    const srcOut = path.join(dir, 'logo-obra10-source.png');
    if (path.resolve(srcOut) !== path.resolve(SRC)) {
      await sharp(SRC).png().toFile(srcOut);
    }

    for (const [sz, name] of SIZES) {
      await sharp(SRC).resize(sz, sz, { fit: 'cover' }).png().toFile(path.join(dir, name));
      console.log(path.join(dir, name));
    }

    for (const [name, sz] of [
      ['favicon.svg', 512],
      ['icon-192.svg', 192],
      ['icon-512.svg', 512],
      ['obra10-mark.svg', 512],
    ]) {
      const buf =
        sz === 512
          ? master
          : await sharp(SRC).resize(sz, sz, { fit: 'cover' }).png().toBuffer();
      fs.writeFileSync(path.join(dir, name), svgEmbed(sz, buf.toString('base64')));
    }
  }
  console.log('OK — marca interna aplicada.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
