/**
 * Falha se uploads/ (ou vídeos grandes) estiverem versionados no Git.
 * Uso: node scripts/check-no-tracked-uploads.cjs
 */
const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

function tracked(pattern) {
  try {
    const out = execSync(`git ls-files -- ${pattern}`, {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    return out ? out.split(/\r?\n/).filter(Boolean) : [];
  } catch {
    return [];
  }
}

const bad = [
  ...tracked('obra10-backend/uploads/**'),
  ...tracked('**/uploads/**/*.mp4'),
  ...tracked('**/uploads/**/*.mov'),
  ...tracked('**/uploads/**/*.webm'),
];

const unique = [...new Set(bad)];

if (unique.length) {
  console.error(
    `[check-no-tracked-uploads] ${unique.length} arquivo(s) de upload ainda no Git:`,
  );
  unique.slice(0, 30).forEach((f) => console.error('  -', f));
  if (unique.length > 30) console.error(`  ... e mais ${unique.length - 30}`);
  console.error(
    'Remova com: git rm -r --cached obra10-backend/uploads && confirme .gitignore',
  );
  process.exit(1);
}

console.log('[check-no-tracked-uploads] OK — nenhum upload versionado.');
