/**
 * Fonte única: src/appVersion.json
 * Atualiza public/version.json, public/sw.js (CACHE_NAME) e index.html (BUILD + sw.js?v=).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const metaPath = path.join(root, 'src', 'appVersion.json');
const publicVersion = path.join(root, 'public', 'version.json');
const swPath = path.join(root, 'public', 'sw.js');
const htmlPath = path.join(root, 'index.html');

if (!fs.existsSync(metaPath)) {
  console.error('src/appVersion.json não encontrado');
  process.exit(1);
}

const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const { version, buildId } = meta;
if (!version || !buildId) {
  console.error('appVersion.json precisa de version e buildId');
  process.exit(1);
}

fs.mkdirSync(path.dirname(publicVersion), { recursive: true });
fs.writeFileSync(publicVersion, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
console.log(`📦 version.json → ${version} (${buildId})`);

let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(
  /const CACHE_NAME = ['"]obra10-v[^'"]+['"]/,
  `const CACHE_NAME = 'obra10-v${version}'`,
);
fs.writeFileSync(swPath, sw, 'utf8');
console.log(`📦 sw.js CACHE_NAME → obra10-v${version}`);

let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(/var BUILD = '[^']+'/, `var BUILD = '${buildId}'`);
html = html.replace(/\/sw\.js\?v=[^'"]+/g, `/sw.js?v=${version}`);
html = html.replace(/favicon-32\.png\?v=[^"']+/g, `favicon-32.png?v=${version}`);
html = html.replace(/favicon-16\.png\?v=[^"']+/g, `favicon-16.png?v=${version}`);
html = html.replace(/favicon\.svg\?v=[^"']+/g, `favicon.svg?v=${version}`);
html = html.replace(/apple-touch-icon\.png\?v=[^"']+/g, `apple-touch-icon.png?v=${version}`);
html = html.replace(/icon-192\.png\?v=[^"']+/g, `icon-192.png?v=${version}`);
fs.writeFileSync(htmlPath, html, 'utf8');
console.log(`📦 index.html BUILD → ${buildId}`);
