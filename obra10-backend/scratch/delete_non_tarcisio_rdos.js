require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const p = new PrismaClient({ adapter: new PrismaPg(pool) });

  // 1. Encontrar o usuário Tarcisio
  const tarcisio = await p.usuario.findFirst({
    where: { email: 'tarcisio@lunardeli.com.br' }
  });

  if (!tarcisio) {
    console.error('Usuário tarcisio@lunardeli.com.br não encontrado.');
    await pool.end();
    return;
  }

  console.log(`ID do Tarcísio: ${tarcisio.id}`);

  // 2. Buscar RDOs ativos que não pertençam ao Tarcísio
  const rdosParaDeletar = await p.rdo.findMany({
    where: {
      criadorId: { not: tarcisio.id },
      deletedAt: null
    },
    select: {
      id: true,
      dataReferencia: true,
      criadorId: true
    }
  });

  if (rdosParaDeletar.length === 0) {
    console.log('Nenhum RDO de teste (não pertencente ao Tarcísio) encontrado para deletar.');
    await p.$disconnect();
    await pool.end();
    return;
  }

  const ids = rdosParaDeletar.map(r => r.id);
  console.log(`Encontrados ${ids.length} RDOs para soft-deletar:`, ids);

  const now = new Date();

  // 3. Soft-deletar Atividades associadas
  const resAtividades = await p.rdoAtividade.updateMany({
    where: { rdoId: { in: ids }, deletedAt: null },
    data: { deletedAt: now }
  });
  console.log(`Soft-deletadas ${resAtividades.count} atividades.`);

  // 4. Soft-deletar Efetivos associados
  const resEfetivos = await p.rdoEfetivo.updateMany({
    where: { rdoId: { in: ids }, deletedAt: null },
    data: { deletedAt: now }
  });
  console.log(`Soft-deletados ${resEfetivos.count} efetivos.`);

  // 5. Soft-deletar Ocorrências associadas
  const resOcorrencias = await p.rdoOcorrencia.updateMany({
    where: { rdoId: { in: ids }, deletedAt: null },
    data: { deletedAt: now }
  });
  console.log(`Soft-deletadas ${resOcorrencias.count} ocorrências.`);

  // 6. Soft-deletar Anexos associados (origem RDO)
  const resAnexos = await p.anexo.updateMany({
    where: { attachableId: { in: ids }, origem: 'RDO', deletedAt: null },
    data: { deletedAt: now }
  });
  console.log(`Soft-deletados ${resAnexos.count} anexos.`);

  // 7. Soft-deletar os RDOs propriamente ditos
  const result = await p.rdo.updateMany({
    where: {
      id: { in: ids }
    },
    data: {
      deletedAt: now
    }
  });

  console.log(`Soft-deletados ${result.count} RDOs.`);

  await p.$disconnect();
  await pool.end();
}
main().catch(console.error);

