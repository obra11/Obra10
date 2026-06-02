require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const p = new PrismaClient({ adapter: new PrismaPg(pool) });

  const hash = await bcrypt.hash('Lunardeli20011978$', 12);

  await p.usuario.updateMany({
    where: { email: 'superadmin@obra10.com' },
    data: {
      senhaHash: hash,
      loginAttempts: 0,
      lockedUntil: null
    }
  });

  console.log('Superadmin password updated to Lunardeli20011978$ successfully');
  await p.$disconnect();
}
main().catch(console.error);
