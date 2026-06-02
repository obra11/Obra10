require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const p = new PrismaClient({ adapter: new PrismaPg(pool) });

  console.log('=== RDOs por Criador ===');
  const summary = await p.rdo.groupBy({
    by: ['criadorId'],
    where: { deletedAt: null },
    _count: { id: true }
  });

  for (const item of summary) {
    const user = await p.usuario.findUnique({
      where: { id: item.criadorId },
      select: { nome: true, email: true }
    });
    console.log(`Nome: ${user?.nome} (${user?.email}) - Qtd: ${item._count.id}`);
  }

  await p.$disconnect();
}
main().catch(console.error);
