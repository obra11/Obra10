import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Iniciando restauração do ambiente anterior (Users, Obras, Logos)...');

  // Hardcoded known Empresa (Lunardeli Engenharia) from seed.ts
  const lunardeli = await prisma.empresa.findFirst({
    where: { cnpj: '00.000.000/0001-99' }
  });

  if (!lunardeli) {
    console.error('Empresa Lunardeli não encontrada!');
    return;
  }

  const hash = await bcrypt.hash('Senha123', 10);
  
  // ===================== RESTAURANDO USUÁRIOS =====================
  // Based on the IDs found in uploads:
  // user-1bfa49d5-3a6d-4a22-8b71-c333b3a0ec41
  // user-38af566c-8c17-4698-b09c-8cc9d1cb5a91
  // user-55f952ec-4841-4ebb-861b-2eb2eaf3048b

  const usersToRestore = [
    {
      id: '1bfa49d5-3a6d-4a22-8b71-c333b3a0ec41',
      nome: 'Giliardi',
      email: 'giliardi@lunardeli.com.br',
      fotoUrl: '/uploads/user-1bfa49d5-3a6d-4a22-8b71-c333b3a0ec41-foto-1774613887459-842177468.jpeg'
    },
    {
      id: '38af566c-8c17-4698-b09c-8cc9d1cb5a91',
      nome: 'Marcelo',
      email: 'marcelo@lunardeli.com.br',
      fotoUrl: '/uploads/user-38af566c-8c17-4698-b09c-8cc9d1cb5a91-foto-1774613894235-34013115.jpeg'
    },
    {
      id: '55f952ec-4841-4ebb-861b-2eb2eaf3048b',
      nome: 'Engenheiro Auxiliar',
      email: 'eng_auxiliar@lunardeli.com.br',
      fotoUrl: '/uploads/user-55f952ec-4841-4ebb-861b-2eb2eaf3048b-foto-1774613882375-441403747.jpeg'
    }
  ];

  for (const u of usersToRestore) {
    await prisma.usuario.upsert({
      where: { id: u.id },
      update: { fotoUrl: u.fotoUrl, ativo: true },
      create: {
        id: u.id,
        empresaId: lunardeli.id,
        nome: u.nome,
        email: u.email,
        senhaHash: hash,
        perfilGlobal: 'GESTOR',
        ativo: true,
        fotoUrl: u.fotoUrl
      }
    });
    console.log(`✅ Usuário restaurado: ${u.nome}`);
  }

  // ===================== RESTAURANDO OBRAS =====================
  const obrasToRestore = [
    {
      id: '239570ab-2a71-488f-a54f-50c4b087e573',
      nome: 'Residencial Alphaville',
      imageUrl: '/uploads/239570ab-2a71-488f-a54f-50c4b087e573-cover-1774465444444-428029529.jpg'
    },
    {
      id: '2dbebb5e-9184-4ecb-a43c-810413648bc1',
      nome: 'Condomínio Reserva da Mata',
      imageUrl: '/uploads/2dbebb5e-9184-4ecb-a43c-810413648bc1-cover-1773958121108-373091890.jpg'
    },
    {
      id: '486b1ee4-eb23-40e8-bef4-eb6892361a6f',
      nome: 'Edifício Comercial Torres',
      imageUrl: '/uploads/486b1ee4-eb23-40e8-bef4-eb6892361a6f-cover-1774443595701-855100296.jpg'
    },
    {
      id: '9259d0cc-e1a9-4bfa-889b-ccebb03b696d',
      nome: 'Galpão Logístico Bandeirantes',
      imageUrl: '/uploads/9259d0cc-e1a9-4bfa-889b-ccebb03b696d-cover-1774553864162-95211481.jpeg'
    },
    {
      id: 'e580898b-5d98-490e-a2a2-ae5b7a7bb1cf',
      nome: 'Reforma Hospital São João',
      imageUrl: '/uploads/e580898b-5d98-490e-a2a2-ae5b7a7bb1cf-cover-1774462737334-77492444.jpg'
    },
    {
      id: 'ff281e92-4f92-4703-ae79-257a40c5ce1e',
      nome: 'Loteamento Parque das Águas',
      imageUrl: '/uploads/ff281e92-4f92-4703-ae79-257a40c5ce1e-cover-1774476903550-775317533.jpg'
    }
  ];

  for (const o of obrasToRestore) {
    await prisma.obra.upsert({
      where: { id: o.id },
      update: { imageUrl: o.imageUrl },
      create: {
        id: o.id,
        empresaId: lunardeli.id,
        nome: o.nome,
        status: 'ATIVA',
        imageUrl: o.imageUrl
      }
    });

    console.log(`✅ Obra restaurada: ${o.nome}`);
  }

  // ===================== RESTAURANDO LOGOTIPO EMPRESA =====================
  const logoUrl = '/uploads/8c3762e4-53c4-4cc4-9c43-7c63c353bf06-logo-1773956456777-111202915.png';
  await prisma.empresa.update({
    where: { id: lunardeli.id },
    data: { logoUrl }
  });
  console.log(`✅ Logotipo da empresa LUNARDELI atualizado`);

  console.log('🎉 Restauração concluída com sucesso!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
