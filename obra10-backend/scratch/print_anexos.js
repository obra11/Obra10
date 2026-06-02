require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const p = new PrismaClient({ adapter: new PrismaPg(pool) });

  const count = await p.anexo.count();
  console.log(`Total attachments: ${count}`);

  const sample = await p.anexo.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  });

  console.log('--- SAMPLE ATTACHMENTS ---');
  console.log(JSON.stringify(sample, null, 2));

  // Let's run a query directly to check database columns on "anexos" table
  const columnsRes = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'anexos'
  `);
  console.log('--- DATABASE COLUMNS FOR table "anexos" ---');
  console.log(columnsRes.rows);

  await p.$disconnect();
  await pool.end();
}
main().catch(console.error);
