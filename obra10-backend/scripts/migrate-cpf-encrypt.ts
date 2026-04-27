/**
 * migrate-cpf-encrypt.ts
 *
 * One-shot migration script to encrypt legacy plaintext CPF/CNPJ values
 * stored in the `empresas` table. Safe to run multiple times (idempotent).
 *
 * Usage:
 *   npx ts-node scripts/migrate-cpf-encrypt.ts
 *   npx ts-node scripts/migrate-cpf-encrypt.ts --dry-run
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

// ── Config ────────────────────────────────────────────────────────────
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const envKey = process.env.ENCRYPTION_KEY;
if (!envKey || envKey.length !== 64) {
  console.error('❌  ENCRYPTION_KEY não configurada ou inválida (precisa de 64 hex chars).');
  console.error('    Defina no .env e tente novamente.');
  process.exit(1);
}
const KEY = Buffer.from(envKey, 'hex');

const DRY_RUN = process.argv.includes('--dry-run');

// ── Helpers ───────────────────────────────────────────────────────────

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function tryDecrypt(ciphertext: string): string | null {
  try {
    const packed = Buffer.from(ciphertext, 'base64');
    if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) return null;
    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Returns true if the value looks like plaintext CPF/CNPJ
 * (i.e., it's NOT already encrypted base64).
 */
function isPlaintext(value: string): boolean {
  // If tryDecrypt succeeds, the value is already encrypted
  const dec = tryDecrypt(value);
  if (dec !== null) return false;
  // If it's digits only (optionally with dots/dashes), it's plaintext
  if (/^[\d.\-\/]+$/.test(value)) return true;
  // Otherwise assume plaintext if it can't be decrypted
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();
  console.log(`\n🔐  Migração de CPF/CNPJ — Criptografia AES-256-GCM`);
  console.log(`    Modo: ${DRY_RUN ? '🟡 DRY-RUN (nenhuma alteração será feita)' : '🟢 PRODUÇÃO'}\n`);

  try {
    const empresas = await prisma.empresa.findMany({
      select: { id: true, cnpj: true, cpfCnpj: true, razaoSocial: true },
    });

    console.log(`📋  Total de empresas encontradas: ${empresas.length}\n`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const emp of empresas) {
      const updates: Record<string, string> = {};

      // Check cnpj field
      if (emp.cnpj && isPlaintext(emp.cnpj)) {
        updates['cnpj'] = encrypt(emp.cnpj);
      }

      // Check cpfCnpj field
      if (emp.cpfCnpj && isPlaintext(emp.cpfCnpj)) {
        updates['cpfCnpj'] = encrypt(emp.cpfCnpj);
      }

      if (Object.keys(updates).length === 0) {
        skipped++;
        continue;
      }

      const fields = Object.keys(updates).join(', ');
      const display = emp.razaoSocial || emp.id.slice(0, 8);

      if (DRY_RUN) {
        console.log(`  🔍 [DRY-RUN] Empresa "${display}" — migraria campos: ${fields}`);
        migrated++;
        continue;
      }

      try {
        await prisma.empresa.update({
          where: { id: emp.id },
          data: updates,
        });
        console.log(`  ✅ Empresa "${display}" — campos criptografados: ${fields}`);
        migrated++;
      } catch (err: any) {
        console.error(`  ❌ Empresa "${display}" — ERRO: ${err.message}`);
        errors++;
      }
    }

    console.log(`\n────────────────────────────────────────────`);
    console.log(`  Migrados:  ${migrated}`);
    console.log(`  Ignorados: ${skipped} (já criptografados ou null)`);
    console.log(`  Erros:     ${errors}`);
    console.log(`────────────────────────────────────────────\n`);

    if (DRY_RUN && migrated > 0) {
      console.log('⚠️  Execute sem --dry-run para aplicar as alterações.\n');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Falha fatal:', err);
  process.exit(1);
});
