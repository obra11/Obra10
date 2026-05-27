require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  const query = `
    SELECT id, cnpj, "cpf_cnpj", "razao_social"
    FROM "empresas";
  `;
  
  const res = await pool.query(query);
  console.log('Raw Database Rows in empresas:');
  console.log(JSON.stringify(res.rows, null, 2));
  
  await pool.end();
}
main().catch(console.error);
