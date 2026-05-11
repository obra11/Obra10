require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Test1234!', 10);
  
  // Create or find tenant
  let tenant = await prisma.empresa.findFirst({ where: { cnpj: '11222333000181' } });
  if (!tenant) {
    tenant = await prisma.empresa.create({
      data: {
        nomeFantasia: 'Test Company',
        cnpj: '11222333000181',
        plano: 'ILIMITADO',
        status: 'ATIVO'
      }
    });
  }

  // Create or find user
  let user = await prisma.usuario.findUnique({ where: { email: 'testuser123@lunardeli.com.br' } });
  if (!user) {
    user = await prisma.usuario.create({
      data: {
        nome: 'Test User',
        email: 'testuser123@lunardeli.com.br',
        senha: hash,
        perfilGlobal: 'GESTOR',
        tenantId: tenant.id
      }
    });
  }
  console.log('Created test user:', user.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
