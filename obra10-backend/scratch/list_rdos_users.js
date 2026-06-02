require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const p = new PrismaClient({ adapter: new PrismaPg(pool) });

  console.log('=== USUÁRIOS ===');
  const users = await p.usuario.findMany({
    select: { id: true, nome: true, email: true, perfilGlobal: true }
  });
  console.log(JSON.stringify(users, null, 2));

  console.log('\n=== RDOS ===');
  const rdos = await p.rdo.findMany({
    where: { deletedAt: null },
    include: {
      criador: { select: { id: true, nome: true, email: true } },
      obra: { select: { id: true, nome: true } }
    },
    orderBy: { dataReferencia: 'asc' }
  });
  console.log(JSON.stringify(rdos.map(r => ({
    id: r.id,
    dataReferencia: r.dataReferencia,
    status: r.status,
    criador: r.criador,
    obra: r.obra
  })), null, 2));

  await p.$disconnect();
}
main().catch(console.error);
