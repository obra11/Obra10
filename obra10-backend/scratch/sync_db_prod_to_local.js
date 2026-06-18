const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// URLs de conexão
const prodDbUrl = 'postgresql://postgres:lcQwRkZtmuYioMDalLMCALrECEdszTgP@centerbeam.proxy.rlwy.net:19827/railway';
const localDbUrl = 'postgresql://postgres:Lunardeli14$@localhost:5432/obra10_local';

// Caminhos dos executáveis do PostgreSQL no Windows
const pgDumpPath = '"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe"';
const psqlPath = '"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe"';

const tempDumpFile = path.join(__dirname, 'prod_backup.sql');

async function sync() {
  console.log('📥 1. Fazendo o download dos dados reais do servidor web (Railway)...');
  console.log('Isso pode levar alguns segundos, por favor aguarde...');
  
  try {
    // pg_dump copia o banco da web para um arquivo temporário local
    const dumpCmd = `${pgDumpPath} --clean --no-owner --no-privileges -d "${prodDbUrl}" -f "${tempDumpFile}"`;
    execSync(dumpCmd, { stdio: 'inherit' });
    console.log('✅ Cópia dos dados da Web baixada com sucesso!');
  } catch (err) {
    console.error('❌ Falha ao fazer o download do banco de dados de produção:', err.message);
    cleanup();
    process.exit(1);
  }

  console.log('\n📤 2. Restaurando os dados reais no seu banco de dados local (computador)...');
  try {
    // psql executa o arquivo de backup no banco de dados local
    const restoreCmd = `${psqlPath} -d "${localDbUrl}" -f "${tempDumpFile}"`;
    execSync(restoreCmd, { stdio: 'inherit' });
    console.log('✅ Restauração local concluída com sucesso!');
  } catch (err) {
    console.error('❌ Falha ao restaurar os dados no banco de dados local:', err.message);
    cleanup();
    process.exit(1);
  }

  cleanup();
  console.log('\n=======================================================');
  console.log('🎉 SUCESSO! Banco de dados local sincronizado com a Web!');
  console.log('Agora você pode logar localmente com os mesmos e-mails');
  console.log('e senhas do site real (tarcisio@lunardeli.com.br / Lunardeli20011978$)');
  console.log('=======================================================');
}

function cleanup() {
  if (fs.existsSync(tempDumpFile)) {
    try {
      fs.unlinkSync(tempDumpFile);
    } catch (err) {
      // ignore
    }
  }
}

sync().catch(err => {
  console.error('Erro inesperado:', err);
  cleanup();
});
