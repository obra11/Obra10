const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function main() {
  const passwordToSet = 'Lunardeli20011978$';
  const hash = await bcrypt.hash(passwordToSet, 12);

  const client = new Client({
    connectionString: "postgresql://postgres:lcQwRkZtmuYioMDalLMCALrECEdszTgP@centerbeam.proxy.rlwy.net:19827/railway",
  });
  await client.connect();

  const res = await client.query(
    `UPDATE usuarios SET senha_hash = $1, login_attempts = 0, locked_until = NULL WHERE email = 'superadmin@obra10.com' RETURNING id, email, perfil_global`,
    [hash]
  );

  console.log('=== UPDATE SUPERADMIN RESULT ===');
  console.log(res.rows);

  // Test bcrypt compare
  const isMatch = await bcrypt.compare(passwordToSet, hash);
  console.log('Password test comparison match:', isMatch);

  await client.end();
}

main().catch(console.error);
