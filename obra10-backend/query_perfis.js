const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString: 'postgresql://postgres:lcQwRkZtmuYioMDalLMCALrECEdszTgP@centerbeam.proxy.rlwy.net:19827/railway',
  });
  await c.connect();

  const r = await c.query("SELECT * FROM perfis");
  console.log('=== PERFIS ===');
  console.log(r.rows);

  await c.end();
}

main().catch(console.error);
