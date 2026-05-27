require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set in environment.');
    process.exit(1);
  }
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  const query = 'SELECT * FROM "empresas";';
  const res = await pool.query(query);
  
  const now = new Date();
  const timestamp = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
    
  const filename = `backup_empresas_pre_encrypt_${timestamp}.json`;
  
  fs.writeFileSync(filename, JSON.stringify(res.rows, null, 2), 'utf8');
  console.log(`SUCCESS: Backup saved to ${filename} with ${res.rows.length} rows.`);
  
  await pool.end();
}
main().catch(console.error);
