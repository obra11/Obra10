const fs = require('fs');
const path = require('path');

// Load .env manually
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    for (const line of envConfig.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        value = value.trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    }
  }
} catch (e) {
  console.error("Error loading .env", e);
}

const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const rdos = await prisma.rdo.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      dataReferencia: true,
      status: true,
      dadosExtras: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(rdos, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
