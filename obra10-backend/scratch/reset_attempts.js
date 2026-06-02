require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const p = new PrismaClient({ adapter: new PrismaPg(pool) });

  await p.usuario.updateMany({
    where: { email: 'superadmin@obra10.com' },
    data: {
      loginAttempts: 0,
      lockedUntil: null
    }
  });

  console.log('Attempts reset to 0 for superadmin@obra10.com');
  await p.$disconnect();
}
main().catch(console.error);
