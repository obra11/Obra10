require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const p = new PrismaClient({ adapter: new PrismaPg(pool) });

  const users = await p.usuario.findMany({
    where: {
      email: {
        contains: 'lunardeli.com.br',
        mode: 'insensitive'
      }
    },
    include: {
      empresa: true
    }
  });

  console.log('--- USERS FOUND ---');
  for (const u of users) {
    console.log(`ID: ${u.id}`);
    console.log(`Nome: ${u.nome}`);
    console.log(`Email: ${u.email}`);
    console.log(`Ativo: ${u.ativo}`);
    console.log(`DeletedAt: ${u.deletedAt}`);
    console.log(`Empresa ID: ${u.empresaId}`);
    console.log(`Empresa Razao Social: ${u.empresa?.razaoSocial}`);
    console.log(`Empresa Nome Fantasia: ${u.empresa?.nomeFantasia}`);
    console.log('-------------------');
  }

  await p.$disconnect();
}
main().catch(console.error);
