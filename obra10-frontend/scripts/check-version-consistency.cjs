/**
 * Verifica consistência de versão (local ou produção).
 * Uso:
 *   node scripts/check-version-consistency.cjs
 *   node scripts/check-version-consistency.cjs https://obra10.app.br
 *   node scripts/check-version-consistency.cjs --local
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const localOnly = args.includes('--local');
const baseUrl = args.find((a) => a.startsWith('http')) || null;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function extract(re, text, label) {
  const m = text.match(re);
  if (!m) throw new Error(`Não encontrou ${label}`);
  return m[1];
}

function checkLocal() {
  const meta = readJson(path.join(root, 'src', 'appVersion.json'));
  const versionJson = readJson(path.join(root, 'public', 'version.json'));
  const sw = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const cacheName = extract(/const CACHE_NAME = ['"]([^'"]+)['"]/, sw, 'CACHE_NAME');
  const build = extract(/var BUILD = '([^']+)'/, html, 'BUILD');
  const swQuery = extract(/\/sw\.js\?v=([^'"]+)/, html, 'sw.js?v');

  const errors = [];
  if (meta.version !== versionJson.version) errors.push('version.json.version != appVersion.json');
  if (meta.buildId !== versionJson.buildId) errors.push('version.json.buildId != appVersion.json');
  if (cacheName !== `obra10-v${meta.version}`) errors.push(`CACHE_NAME=${cacheName}, esperado obra10-v${meta.version}`);
  if (build !== meta.buildId) errors.push(`index BUILD=${build}, esperado ${meta.buildId}`);
  if (swQuery !== meta.version) errors.push(`sw.js?v=${swQuery}, esperado ${meta.version}`);

  return { ok: errors.length === 0, errors, meta, cacheName, build, swQuery };
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error(`timeout ${url}`));
    });
  });
}

async function checkRemote(base) {
  const bust = `?_=${Date.now()}`;
  const [health, version, versionJson, html, sw] = await Promise.all([
    fetchText(`${base}/health${bust}`),
    fetchText(`${base}/version${bust}`),
    fetchText(`${base}/version.json${bust}`),
    fetchText(`${base}/${bust}`),
    fetchText(`${base}/sw.js${bust}`),
  ]);

  const errors = [];
  let vApi;
  let vFile;
  let build;
  let cacheName;
  try {
    vApi = JSON.parse(version.body);
    vFile = JSON.parse(versionJson.body);
    const healthJson = JSON.parse(health.body);
    build = extract(/var BUILD = '([^']+)'/, html.body, 'BUILD no HTML');
    cacheName = extract(/const CACHE_NAME = ['"]([^'"]+)['"]/, sw.body, 'CACHE_NAME');

    if (!vApi.buildId || vApi.buildId === 'unknown') errors.push('/version buildId inválido');
    if (vApi.buildId !== vFile.buildId) errors.push('/version.buildId != /version.json.buildId');
    if (healthJson.app?.buildId !== vApi.buildId) errors.push('/health.app.buildId != /version.buildId');
    if (build !== vApi.buildId) errors.push(`HTML BUILD=${build} != /version ${vApi.buildId}`);
    if (cacheName !== `obra10-v${vApi.version}`) {
      errors.push(`sw CACHE_NAME=${cacheName}, esperado obra10-v${vApi.version}`);
    }
    const cc = String(html.headers['cache-control'] || '');
    if (cc && !/no-store|no-cache/i.test(cc)) {
      errors.push(`index.html Cache-Control fraco: ${cc}`);
    }
  } catch (e) {
    errors.push(e.message || String(e));
  }

  return {
    ok: errors.length === 0,
    errors,
    snapshot: {
      health: health.status,
      api: vApi?.api,
      version: vApi?.version,
      buildId: vApi?.buildId,
      htmlBuild: build,
      cacheName,
    },
  };
}

async function main() {
  console.log('=== check local ===');
  const local = checkLocal();
  if (local.ok) {
    console.log(`OK local ${local.meta.version} / ${local.meta.buildId}`);
  } else {
    console.log('FALHOU local:');
    local.errors.forEach((e) => console.log(' -', e));
  }

  if (localOnly) {
    process.exit(local.ok ? 0 : 1);
  }

  const base = baseUrl || 'https://obra10.app.br';
  console.log(`\n=== check remote ${base} ===`);
  const remote = await checkRemote(base);
  if (remote.ok) {
    console.log('OK remoto', remote.snapshot);
  } else {
    console.log('FALHOU remoto', remote.snapshot || '');
    remote.errors.forEach((e) => console.log(' -', e));
  }

  process.exit(local.ok && remote.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
