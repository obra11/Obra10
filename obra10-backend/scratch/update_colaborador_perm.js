require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const obraId = 'a79cd7a9-90d8-4663-b98e-c23fd78cecab';

  // Update Giliardi
  const giliardi = await prisma.usuario.findFirst({ where: { email: 'giliardi@lunardeli.com.br' } });
  if (giliardi) {
    await prisma.userObraRole.updateMany({
      where: { usuarioId: giliardi.id, obraId },
      data: { permissoes: { RDO: 'EDIT' } }
    });
    console.log(`Updated Giliardi (ID: ${giliardi.id}) permissions to EDIT`);
  }

  // Update Jeferson
  const jeferson = await prisma.usuario.findFirst({ where: { email: 'kesselerjeferson@gmail.com' } });
  if (jeferson) {
    await prisma.userObraRole.updateMany({
      where: { usuarioId: jeferson.id, obraId },
      data: { permissoes: { RDO: 'EDIT' } }
    });
    console.log(`Updated Jeferson (ID: ${jeferson.id}) permissions to EDIT`);
  }

  await prisma.$disconnect();
}
main().catch(console.error);
