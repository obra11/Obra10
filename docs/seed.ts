import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando Setup da Obra 10 MVP...');

  const perfis = [
    { id: 1, nomeInterno: 'VIEWER' },
    { id: 2, nomeInterno: 'FIELD' },
    { id: 3, nomeInterno: 'MANAGER' },
    { id: 4, nomeInterno: 'ADMIN' },
  ];

  for (const p of perfis) {
    await prisma.perfil.upsert({
      where: { id: p.id },
      update: {},
      create: { id: p.id, nomeInterno: p.nomeInterno },
    });
  }
  console.log('✅ Perfis Padrão carregados.');

  const empresa = await prisma.empresa.upsert({
    where: { cnpj: '11.222.333/0001-44' },
    update: {},
    create: {
      cnpj: '11.222.333/0001-44',
      razaoSocial: 'Acme Construtora S.A.',
    },
  });
  console.log(`🏢 Empresa criada: ${empresa.razaoSocial}`);

  const obraId = 'd290f1ee-6c54-4b01-90e6-d701748f0851'; 
  const obra = await prisma.obra.upsert({
    where: { id: obraId },
    update: {},
    create: {
      id: obraId,
      empresaId: empresa.id,
      nome: 'Residencial Lumière',
      status: 'ATIVA'
    },
  });
  console.log(`🏗️ Obra criada: ${obra.nome}`);

  const hashSenha = await bcrypt.hash('Senha123', 10);

  // FIXED: Prisma Upsert Compound Unique Key para Email Multi-Tenant
  const engUser = await prisma.usuario.upsert({
    where: { empresaId_email: { empresaId: empresa.id, email: 'engenheiro@acme.com' } },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: 'Carlos Engenheiro',
      email: 'engenheiro@acme.com',
      senhaHash: hashSenha,
      ativo: true,
    },
  });

  const mestreUser = await prisma.usuario.upsert({
    where: { empresaId_email: { empresaId: empresa.id, email: 'mestre@acme.com' } },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: 'José Mestre das Obras',
      email: 'mestre@acme.com',
      senhaHash: hashSenha,
      ativo: true,
    },
  });

  await prisma.userObraRole.upsert({
    where: { usuarioId_obraId: { usuarioId: engUser.id, obraId: obra.id } },
    update: {},
    create: {
      usuarioId: engUser.id,
      obraId: obra.id,
      perfilId: 3, // MANAGER
    },
  });

  await prisma.userObraRole.upsert({
    where: { usuarioId_obraId: { usuarioId: mestreUser.id, obraId: obra.id } },
    update: {},
    create: {
      usuarioId: mestreUser.id,
      obraId: obra.id,
      perfilId: 2, // FIELD
    },
  });

  console.log('🔑 Vínculos Injetados.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🚪 Fim do Seed.');
  });
