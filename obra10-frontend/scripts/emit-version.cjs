/**
 * Copia src/appVersion.json → public/version.json (vai para dist/client).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'src', 'appVersion.json');
const destPublic = path.join(root, 'public', 'version.json');

if (!fs.existsSync(src)) {
  console.error('src/appVersion.json não encontrado');
  process.exit(1);
}

fs.mkdirSync(path.dirname(destPublic), { recursive: true });
fs.copyFileSync(src, destPublic);
console.log('📦 appVersion.json → public/version.json');
