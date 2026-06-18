const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Lista de senhas comuns para testar conexão local
const passwords = ['Lunardeli14$', 'postgres', 'admin', 'root', '', '123456', 'lcQwRkZtmuYioMDalLMCALrECEdszTgP'];
const dbName = 'obra10_local';
const username = 'postgres';
const host = 'localhost';
const port = 5432;

async function setup() {
  let connectedClient = null;
  let workingPassword = null;

  console.log('🔍 Tentando conectar ao PostgreSQL local...');
  
  for (const pwd of passwords) {
    console.log(`Testando conexão com a senha: "${pwd}"...`);
    const client = new Client({
      host,
      port,
      user: username,
      password: pwd,
      database: 'postgres', // Conecta ao banco padrão do sistema primeiro
    });
    
    try {
      await client.connect();
      connectedClient = client;
      workingPassword = pwd;
      console.log(`✅ Conectado com sucesso usando a senha: "${pwd}"`);
      break;
    } catch (err) {
      // Falhou com essa senha, tenta a próxima
    }
  }

  if (!connectedClient) {
    console.error('\n❌ Não foi possível conectar ao PostgreSQL local com as senhas comuns.');
    console.error('Por favor, verifique a senha definida para o usuário "postgres" na instalação local.');
    process.exit(1);
  }

  // Criar o banco de dados se não existir
  try {
    const res = await connectedClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    if (res.rowCount === 0) {
      console.log(`🆕 Criando o banco de dados local "${dbName}"...`);
      await connectedClient.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Banco de dados "${dbName}" criado com sucesso!`);
    } else {
      console.log(`ℹ️ Banco de dados local "${dbName}" já existe.`);
    }
  } catch (err) {
    console.error('❌ Erro ao verificar ou criar o banco de dados:', err.message);
    await connectedClient.end();
    process.exit(1);
  }

  await connectedClient.end();

  // Atualizar o arquivo .env
  const envPath = path.join(__dirname, '..', '.env');
  const localDbUrl = `postgresql://${username}:${workingPassword}@${host}:${port}/${dbName}`;
  
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const databaseUrlRegex = /^DATABASE_URL=.*$/m;
  const newDatabaseLine = `DATABASE_URL="${localDbUrl}"`;

  if (databaseUrlRegex.test(envContent)) {
    envContent = envContent.replace(databaseUrlRegex, newDatabaseLine);
  } else {
    envContent += `\n${newDatabaseLine}\n`;
  }

  // Garantir a chave de criptografia de dados extras
  if (!envContent.includes('ENCRYPTION_KEY=')) {
    envContent += `\nENCRYPTION_KEY="662df79e4ebedf814c0fcad9c41b1e0c3082179e3f591f0369878b15620afaf0"\n`;
  }

  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('📝 Arquivo .env local configurado e salvo com sucesso!');

  // Inicializar o banco de dados com a estrutura do Prisma
  console.log('🔄 Sincronizando tabelas com o banco local via Prisma...');
  try {
    execSync('npx prisma db push', { 
      cwd: path.join(__dirname, '..'), 
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: localDbUrl
      }
    });
    console.log('\n=======================================================');
    console.log('🎉 SUCESSO! O banco de dados local está configurado e pronto!');
    console.log('=======================================================');
  } catch (err) {
    console.error('❌ Falha ao sincronizar o banco com Prisma:', err.message);
    process.exit(1);
  }
}

setup().catch(err => {
  console.error('Erro inesperado:', err);
});
