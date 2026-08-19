import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Em build (Docker `prisma generate`) o banco pode não existir — usa placeholder.
 * Em runtime (`migrate deploy` / app) DATABASE_URL precisa vir do Railway.
 */
const isBuildOnly =
  process.env.PRISMA_BUILD_PLACEHOLDER === '1' ||
  process.env.npm_lifecycle_event === 'build';

function normalizeDatabaseUrl(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  let u = String(raw).replace(/^\uFEFF/, '').trim();
  if (!u) return undefined;

  // Aspas / backticks colados no Raw Editor
  if (
    (u.startsWith('"') && u.endsWith('"')) ||
    (u.startsWith("'") && u.endsWith("'")) ||
    (u.startsWith('`') && u.endsWith('`'))
  ) {
    u = u.slice(1, -1).trim();
  }

  // Valor mascarado ou referência não resolvida (causa P1013)
  if (
    u.startsWith('***') ||
    u.includes('${{') ||
    u.includes('{{Postgres') ||
    /^\$\{/.test(u)
  ) {
    throw new Error(
      `DATABASE_URL inválida (referência/máscara): começa com "${u.slice(0, 24)}...". ` +
        'No Obra10 → Variables, apague DATABASE_URL e cole a URL real do Postgres começando com postgresql://',
    );
  }

  if (!/^postgres(ql)?:\/\//i.test(u)) {
    throw new Error(
      `DATABASE_URL sem scheme postgres (P1013). Valor começa com "${u.slice(0, 24)}". ` +
        'Cole: postgresql://postgres:SENHA@postgres.railway.internal:5432/railway',
    );
  }

  return u;
}

const databaseUrl =
  normalizeDatabaseUrl(process.env.DATABASE_URL) ||
  normalizeDatabaseUrl(process.env.DATABASE_PRIVATE_URL) ||
  (isBuildOnly ? 'postgresql://build-placeholder:5432/postgres' : undefined);

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL ausente. No Railway (Obra10 → Variables) cole a DATABASE_URL do serviço Postgres (postgresql://...).',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
