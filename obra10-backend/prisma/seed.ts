import * as dotenv from 'dotenv';
dotenv.config(); // MUST be first — loads DATABASE_URL and SUPER_ADMIN_* before PrismaClient

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

// ===================== CATÁLOGO DE MÓDULOS =====================
// NOTE: CONCRETO migrated from main module → SubModulo of CTRL_TEC
const MODULOS = [
  { slug: 'RDO',          nome: 'Relatório Diário de Obra',          sigla: 'RDO',         grupo: 'Operacional', descricao: 'Apontamento diário de atividades, efetivo e ocorrências.', preco: 49.90, ordemExibicao: 1 },
  { slug: 'PLANEJAMENTO', nome: 'Planejamento e Cronograma',          sigla: 'Planning',    grupo: 'Operacional', descricao: 'Gestão de cronograma físico e progresso de execução.', preco: 29.90, ordemExibicao: 2 },
  { slug: 'FVS',          nome: 'Ficha de Verificação de Serviço',    sigla: 'FVS',         grupo: 'Qualidade',   descricao: 'Checklist de qualidade por frente de serviço.', preco: 39.90, ordemExibicao: 3 },
  { slug: 'PQO',          nome: 'Programa de Qualidade da Obra',      sigla: 'PQO / QMS',   grupo: 'Qualidade',   descricao: 'Não conformidades, indicadores e procedimentos de qualidade.', preco: 29.90, ordemExibicao: 4 },
  { slug: 'CTRL_TEC',     nome: 'Controle Tecnológico',               sigla: 'Lab Control', grupo: 'Qualidade',   descricao: 'Controle de ensaios de concreto, solo, argamassa e pavimentação.', preco: 34.90, ordemExibicao: 5 },
  { slug: 'CLIENTES',     nome: 'Inspeção e Entrega ao Cliente',      sigla: 'Client',      grupo: 'Qualidade',   descricao: 'Vistoria de entrega e assistência técnica pós-obra.', preco: 29.90, ordemExibicao: 6 },
  { slug: 'PROJETOS',     nome: 'Gestão de Projetos e Documentos',    sigla: 'Docs',        grupo: 'Gestão',      descricao: 'Upload e visualização de pranchas PDF e documentos técnicos.', preco: 29.90, ordemExibicao: 7 },
  { slug: 'MATERIAIS',    nome: 'Controle de Materiais e Estoque',    sigla: 'Material',    grupo: 'Gestão',      descricao: 'Requisições, estoque e rastreabilidade de materiais.', preco: 29.90, ordemExibicao: 8 },
  { slug: 'EQUIPAMENTOS', nome: 'Manutenção e Aferição de Equipamentos', sigla: 'HSE/Maint', grupo: 'Gestão',   descricao: 'Manutenção preventiva e calibração de equipamentos.', preco: 29.90, ordemExibicao: 9 },
  { slug: 'MEDICOES',     nome: 'Boletim de Medição',                 sigla: 'BM',          grupo: 'Gestão',      descricao: 'Boletins de medição e faturamento de progresso.', preco: 29.90, ordemExibicao: 10 },
  { slug: 'SEGURANCA',    nome: 'Segurança do Trabalho',              sigla: 'HSE/Safety',  grupo: 'Pessoas',     descricao: 'APR, DDS, registro de acidentes e conformidade HSE.', preco: 29.90, ordemExibicao: 11 },
  { slug: 'TREINAMENTOS', nome: 'Treinamento de Funcionários',        sigla: 'Training',    grupo: 'Pessoas',     descricao: 'Gestão de treinamentos, certificações e competências.', preco: 29.90, ordemExibicao: 12 },
  // Legacy IA module
  { slug: 'IA',           nome: 'Análise por IA (Claude)',            sigla: 'AI',          grupo: 'Operacional', descricao: 'Análise de RDOs e chat contextual com IA.', preco: 59.90, ordemExibicao: 99 },
];

// ===================== SUBMÓDULOS =====================
const SUBMODULOS: { moduloSlug: string; slug: string; nome: string; descricao?: string }[] = [
  // CTRL_TEC — absorbe o CONCRETO que era módulo pai
  { moduloSlug: 'CTRL_TEC', slug: 'CONCRETO',    nome: 'Controle de Concreto',         descricao: 'Traço, slump, corpos de prova e laudos.' },
  { moduloSlug: 'CTRL_TEC', slug: 'SOLO',         nome: 'Controle de Solo',             descricao: 'Compactação, ensaios Proctor e grau de compactação.' },
  { moduloSlug: 'CTRL_TEC', slug: 'ARGAMASSA',    nome: 'Controle de Argamassa',        descricao: 'Resistência à compressão e consistência.' },
  { moduloSlug: 'CTRL_TEC', slug: 'ASFALTO',      nome: 'Controle de Pavimentação',     descricao: 'Granulometria, CBR e ensaios de compactação.' },
  // PQO
  { moduloSlug: 'PQO', slug: 'NCR',              nome: 'Não Conformidades',            descricao: 'Abertura, tratamento e encerramento de NCRs.' },
  { moduloSlug: 'PQO', slug: 'INDICADORES',      nome: 'Indicadores de Qualidade',     descricao: 'KPIs e dashboards de qualidade da obra.' },
  { moduloSlug: 'PQO', slug: 'PROCEDIMENTOS',    nome: 'Procedimentos e Normas',       descricao: 'Repositório de procedimentos operacionais.' },
  // EQUIPAMENTOS
  { moduloSlug: 'EQUIPAMENTOS', slug: 'AFERICAO',    nome: 'Aferição e Calibração',    descricao: 'Controle de calibração e certificados de equipamentos.' },
  { moduloSlug: 'EQUIPAMENTOS', slug: 'MANUTENCAO',  nome: 'Manutenção Preventiva e Corretiva', descricao: 'Ordem de serviço, histórico e plano de manutenção.' },
  // SEGURANCA
  { moduloSlug: 'SEGURANCA', slug: 'APR',        nome: 'Análise Preliminar de Risco',  descricao: 'Identificação e mitigação de riscos por tarefa.' },
  { moduloSlug: 'SEGURANCA', slug: 'DDS',        nome: 'Diálogo Diário de Segurança',  descricao: 'Registro de DDS e presenças.' },
  { moduloSlug: 'SEGURANCA', slug: 'ACIDENTES',  nome: 'Registro de Acidentes',        descricao: 'Acidentes, incidentes e quase-acidentes com investigação.' },
  // CLIENTES
  { moduloSlug: 'CLIENTES', slug: 'VISTORIA',    nome: 'Vistoria de Entrega',          descricao: 'Checklist de entrega de unidade ao cliente.' },
  { moduloSlug: 'CLIENTES', slug: 'ASSISTENCIA', nome: 'Assistência Técnica Pós-Entrega', descricao: 'Chamados e atendimentos pós-entrega.' },
];

// ===================== INTEGRAÇÕES ENTRE MÓDULOS =====================
const INTEGRACOES = [
  { moduloOrigem: 'RDO',         moduloDestino: 'PLANEJAMENTO', evento: 'RDO_FECHADO',       descricao: 'RDO aprovado atualiza execução real no cronograma' },
  { moduloOrigem: 'RDO',         moduloDestino: 'EQUIPAMENTOS', evento: 'RDO_FECHADO',       descricao: 'RDO aprovado registra horas de uso de equipamentos' },
  { moduloOrigem: 'EQUIPAMENTOS', moduloDestino: 'RDO',         evento: 'AFERICAO_VENCENDO', descricao: 'Aferição próxima do vencimento gera alerta no banner do RDO' },
  { moduloOrigem: 'FVS',         moduloDestino: 'PQO',          evento: 'FVS_REPROVADO',     descricao: 'FVS reprovado abre automaticamente NCR no PQO' },
  { moduloOrigem: 'CTRL_TEC',    moduloDestino: 'PQO',          evento: 'ENSAIO_REPROVADO',  descricao: 'Resultado de ensaio fora do limite abre NCR automaticamente' },
  { moduloOrigem: 'CLIENTES',    moduloDestino: 'CLIENTES',     evento: 'VISTORIA_APROVADA', descricao: 'Vistoria aprovada libera processo de entrega formal ao cliente' },
];

async function main() {
  console.log('🌱 Iniciando Setup do Catálogo de Módulos v2...\n');

  // ===================== EMPRESA DEMO =====================
  const empresa = await prisma.empresa.upsert({
    where: { cnpj: '11.222.333/0001-44' },
    update: { emailVerificado: true },
    create: {
      cnpj: '11.222.333/0001-44',
      razaoSocial: 'Acme Construtora MVP',
      tipoPessoa: 'JURIDICA',
      plano: 'PRO',
      limiteUsuarios: 20,
      ativo: true,
      emailVerificado: true,
    },
  });
  console.log(`🏢 Empresa: ${empresa.razaoSocial} (ID: ${empresa.id})`);

  // ===================== MÓDULOS DO CATÁLOGO =====================
  console.log('\n📦 Populando catálogo de módulos...');
  const modulosMap: Record<string, string> = {};
  for (const m of MODULOS) {
    const modulo = await (prisma as any).modulo.upsert({
      where: { slug: m.slug },
      update: { preco: m.preco, nome: m.nome, descricao: m.descricao },
      create: { slug: m.slug, nome: m.nome, descricao: m.descricao, sigla: m.sigla, grupo: m.grupo, ordemExibicao: m.ordemExibicao, preco: m.preco, versao: '1.0.0', dependencias: [] },
    });
    modulosMap[m.slug] = modulo.id;
    console.log(`  ✅ ${m.slug.padEnd(16)} | ${m.grupo.padEnd(12)} | R$ ${m.preco.toFixed(2)}`);
  }

  // ===================== SUBMÓDULOS =====================
  console.log('\n🔧 Populando submódulos...');
  for (const s of SUBMODULOS) {
    const moduloId = modulosMap[s.moduloSlug];
    if (!moduloId) { console.log(`  ⚠️  Módulo pai não encontrado: ${s.moduloSlug}`); continue; }
    await (prisma as any).subModulo.upsert({
      where: { moduloId_slug: { moduloId, slug: s.slug } },
      update: { nome: s.nome, descricao: s.descricao },
      create: { moduloId, slug: s.slug, nome: s.nome, descricao: s.descricao },
    });
    console.log(`  ✅ ${s.moduloSlug}.${s.slug}: ${s.nome}`);
  }

  // ===================== INTEGRAÇÕES =====================
  console.log('\n🔗 Populando integrações entre módulos...');
  // Delete all and re-insert for idempotency (no unique constraint on event combo)
  await (prisma as any).integracaoModulo.deleteMany({});
  await (prisma as any).integracaoModulo.createMany({ data: INTEGRACOES.map(i => ({ ...i, ativo: true })) });
  for (const i of INTEGRACOES) {
    console.log(`  ✅ ${i.moduloOrigem} → ${i.moduloDestino} [${i.evento}]`);
  }


  // ===================== OBRAS DEMO =====================
  const obraId = 'd290f1ee-6c54-4b01-90e6-d701748f0851';
  await prisma.obra.upsert({
    where: { id: obraId },
    update: {},
    create: { id: obraId, empresaId: empresa.id, nome: 'Residencial MVP Lumière', status: 'ATIVA' },
  });

  await prisma.obra.upsert({
    where: { id: 'bbb22222-2222-4222-a222-222222222222' },
    update: {},
    create: { id: 'bbb22222-2222-4222-a222-222222222222', empresaId: empresa.id, nome: 'Complexo Comercial Delta', endereco: 'Rua do Comércio, 404', status: 'ATIVA' },
  });

  // ===================== USUÁRIOS DEMO =====================
  const hashSenha = await bcrypt.hash('Senha123', 10);

  const engUser = await prisma.usuario.upsert({
    where: { empresaId_email: { empresaId: empresa.id, email: 'engenheiro@acme.com' } },
    update: {},
    create: { empresaId: empresa.id, nome: 'Carlos Engenheiro', email: 'engenheiro@acme.com', senhaHash: hashSenha, perfilGlobal: 'GESTOR', ativo: true },
  });

  const diretorUser = await prisma.usuario.upsert({
    where: { empresaId_email: { empresaId: empresa.id, email: 'diretor@acme.com' } },
    update: {},
    create: { empresaId: empresa.id, nome: 'Diretor Executivo', email: 'diretor@acme.com', senhaHash: hashSenha, perfilGlobal: 'GESTOR', ativo: true },
  });

  // ===================== ATIVAR MÓDULOS NO TENANT DEMO =====================
  // ===================== ATIVAR MÓDULOS NO TENANT DEMO =====================
  const allSlugs = MODULOS.map(m => m.slug);
  for (const slug of allSlugs) {
    await prisma.tenantModulo.upsert({
      where: { empresaId_moduloId: { empresaId: empresa.id, moduloId: modulosMap[slug] } },
      update: { ativo: true },
      create: { empresaId: empresa.id, moduloId: modulosMap[slug], ativo: true },
    });
  }

  for (const usuario of [engUser, diretorUser]) {
    for (const slug of allSlugs) {
      await prisma.usuarioModulo.upsert({
        where: { usuarioId_moduloId: { usuarioId: usuario.id, moduloId: modulosMap[slug] } },
        update: {},
        create: { usuarioId: usuario.id, moduloId: modulosMap[slug] },
      });
    }
  }

  // ===================== SUPER ADMIN =====================
  const superEmail = process.env.SUPER_ADMIN_EMAIL;
  const superSenha = process.env.SUPER_ADMIN_SENHA;
  if (superEmail && superSenha) {
    const superHash = await bcrypt.hash(superSenha, 12);
    await prisma.usuario.upsert({
      where: { empresaId_email: { empresaId: empresa.id, email: superEmail } },
      update: {},
      create: { empresaId: empresa.id, nome: 'Super Admin', email: superEmail, senhaHash: superHash, perfilGlobal: 'SUPER_ADMIN', ativo: true },
    });
    console.log(`\n🔑 Super Admin criado/verificado: ${superEmail}`);
  }


  // ===================== LUNARDELI ENGENHARIA (Usuário Tarcisio) =====================
  console.log('\n🏗️  Criando empresa Lunardeli e usuário Tarcisio...');
  const hashTarcisio = await bcrypt.hash('Senha123', 10);
  const empresaLunardeli = await prisma.empresa.upsert({
    where: { cnpj: '00.000.000/0001-99' },
    update: { ativo: true, emailVerificado: true },
    create: {
      cnpj: '00.000.000/0001-99',
      razaoSocial: 'LUNARDELI ENGENHARIA',
      tipoPessoa: 'JURIDICA',
      plano: 'PRO',
      limiteUsuarios: 20,
      ativo: true,
      emailVerificado: true,
    },
  });

  const tarcisioUser = await prisma.usuario.upsert({
    where: { empresaId_email: { empresaId: empresaLunardeli.id, email: 'tarcisio@lunardeli.com.br' } },
    update: { senhaHash: hashTarcisio, ativo: true, deletedAt: null },
    create: {
      empresaId: empresaLunardeli.id,
      nome: 'Tarcisio Lunardeli',
      email: 'tarcisio@lunardeli.com.br',
      senhaHash: hashTarcisio,
      perfilGlobal: 'GESTOR',
      ativo: true,
    },
  });

  // Ativar todos os módulos para a LUNARDELI também
  for (const slug of allSlugs) {
    await prisma.tenantModulo.upsert({
      where: { empresaId_moduloId: { empresaId: empresaLunardeli.id, moduloId: modulosMap[slug] } },
      update: { ativo: true },
      create: { empresaId: empresaLunardeli.id, moduloId: modulosMap[slug], ativo: true },
    });
    await prisma.usuarioModulo.upsert({
      where: { usuarioId_moduloId: { usuarioId: tarcisioUser.id, moduloId: modulosMap[slug] } },
      update: {},
      create: { usuarioId: tarcisioUser.id, moduloId: modulosMap[slug] },
    });
  }

  // Criar uma obra para o Tarcisio
  const obraLunardeli = await prisma.obra.upsert({
    where: { id: 'ccc33333-3333-4333-a333-333333333333' },
    update: {},
    create: {
      id: 'ccc33333-3333-4333-a333-333333333333',
      empresaId: empresaLunardeli.id,
      nome: 'Residencial Lunardeli Alpha',
      status: 'ATIVA',
    },
  });

  console.log(`   ✅ LUNARDELI: ${empresaLunardeli.razaoSocial} (ID: ${empresaLunardeli.id})`);
  console.log(`   ✅ Tarcisio: ${tarcisioUser.email} / Senha123`);

  // ===================== RESTAURANDO DADOS APAGADOS (USUÁRIOS E IMAGENS) =====================
  console.log('\n🌟 Restaurando usuários extras e obras com imagens do ambiente anterior...');

  const usersToRestore = [
    {
      id: '1bfa49d5-3a6d-4a22-8b71-c333b3a0ec41',
      nome: 'Giliardi',
      email: 'giliardi@lunardeli.com.br',
      perfilGlobal: 'USER',
      fotoUrl: '/uploads/user-1bfa49d5-3a6d-4a22-8b71-c333b3a0ec41-foto-1774613887459-842177468.jpeg'
    },
    {
      id: '38af566c-8c17-4698-b09c-8cc9d1cb5a91',
      nome: 'Marcelo',
      email: 'marcelo@lunardeli.com.br',
      perfilGlobal: 'USER',
      fotoUrl: '/uploads/user-38af566c-8c17-4698-b09c-8cc9d1cb5a91-foto-1774613894235-34013115.jpeg'
    },
    {
      id: '55f952ec-4841-4ebb-861b-2eb2eaf3048b',
      nome: 'Engenheiro Auxiliar',
      email: 'eng_auxiliar@lunardeli.com.br',
      perfilGlobal: 'GESTOR',
      fotoUrl: '/uploads/user-55f952ec-4841-4ebb-861b-2eb2eaf3048b-foto-1774613882375-441403747.jpeg'
    }
  ];

  for (const u of usersToRestore) {
    await prisma.usuario.upsert({
      where: { id: u.id },
      update: { fotoUrl: u.fotoUrl, ativo: true, perfilGlobal: u.perfilGlobal as any },
      create: {
        id: u.id,
        empresaId: empresaLunardeli.id,
        nome: u.nome,
        email: u.email,
        senhaHash: hashTarcisio,
        perfilGlobal: u.perfilGlobal as any,
        ativo: true,
        fotoUrl: u.fotoUrl
      }
    });
    console.log(`   ✅ Restauração: Usuário ${u.nome} garantido.`);
  }

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
      update: { imageUrl: o.imageUrl, status: 'ATIVA' },
      create: {
        id: o.id,
        empresaId: empresaLunardeli.id,
        nome: o.nome,
        status: 'ATIVA',
        imageUrl: o.imageUrl
      }
    });
    console.log(`   ✅ Restauração: Obra ${o.nome} com capa restaurada.`);
  }

  // Restore Logo if available for Lunardeli
  const logoUrl = '/uploads/8c3762e4-53c4-4cc4-9c43-7c63c353bf06-logo-1773956456777-111202915.png';
  await prisma.empresa.update({
    where: { id: empresaLunardeli.id },
    data: { logoUrl }
  });
  console.log(`   ✅ Restauração: Logotipo da Lunardeli Engenharia reintegrado.\n`);


  // ===================== CUPOM BETA50 =====================
  console.log('\n🎟️  Criando cupom BETA50...');
  await (prisma as any).cupomDesconto.upsert({
    where: { codigo: 'BETA50' },
    update: {},
    create: {
      codigo: 'BETA50',
      tipo: 'DESCONTO_PERCENTUAL',
      valor: 50,
      duracaoMeses: null,     // sem expiração por meses
      usosMaximos: null,      // sem limite de usos
      expiraEm: null,         // sem data de expiração
      ativo: true,
    },
  });
  console.log('   ✅ Cupom BETA50: 50% de desconto, sem limite de usos, sem expiração.');

  console.log('\n✅ Seed finalizado com sucesso!');
  console.log(`\n📊 Resumo:`);
  console.log(`   ${MODULOS.length} módulos no catálogo`);
  console.log(`   ${SUBMODULOS.length} submódulos`);
  console.log(`   ${INTEGRACOES.length} integrações registradas`);
  console.log(`   CONCRETO: migrado de módulo principal → SubModulo de CTRL_TEC`);
  console.log(`\n🎯 ID DA EMPRESA ACME: ${empresa.id}`);
  console.log('📋 Credenciais demo:');
  console.log('   engenheiro@acme.com / Senha123 (GESTOR)');
  console.log('   diretor@acme.com   / Senha123 (GESTOR)');
  console.log('   tarcisio@lunardeli.com.br / Senha123 (GESTOR - LUNARDELI)');
  if (superEmail) console.log(`   ${superEmail} / [conforme .env] (SUPER_ADMIN)`);

  console.log(`\n📊 Resumo:`);
  console.log(`   ${MODULOS.length} módulos no catálogo`);
  console.log(`   ${SUBMODULOS.length} submódulos`);
  console.log(`   ${INTEGRACOES.length} integrações registradas`);
  console.log(`   CONCRETO: migrado de módulo principal → SubModulo de CTRL_TEC`);
  console.log(`\n🎯 ID DA EMPRESA: ${empresa.id}`);
  console.log('📋 Credenciais demo:');
  console.log('   engenheiro@acme.com / Senha123 (GESTOR)');
  console.log('   diretor@acme.com   / Senha123 (GESTOR)');
  if (superEmail) console.log(`   ${superEmail} / [conforme .env] (SUPER_ADMIN)`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
