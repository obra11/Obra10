const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString: 'postgresql://postgres:lcQwRkZtmuYioMDalLMCALrECEdszTgP@centerbeam.proxy.rlwy.net:19827/railway',
  });
  await c.connect();

  const r = await c.query(
    "SELECT id, nome, status, created_at, deleted_at FROM obras WHERE empresa_id = (SELECT empresa_id FROM usuarios WHERE email = 'tarcisio@lunardeli.com.br') ORDER BY created_at DESC LIMIT 15"
  );
  console.log('=== RECENTS OBRAS ===');
  console.log(r.rows);

  await c.end();
}

main().catch(console.error);
