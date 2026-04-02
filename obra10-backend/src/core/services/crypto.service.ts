import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * CryptoService — AES-256-GCM encryption for PII fields (CPF, phone, etc.).
 *
 * Format: base64(iv + authTag + ciphertext)
 * Key: 32 bytes hex from ENCRYPTION_KEY env var.
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly key: Buffer | null;

  constructor() {
    const envKey = process.env.ENCRYPTION_KEY;
    if (envKey && envKey.length === 64) {
      this.key = Buffer.from(envKey, 'hex');
    } else {
      this.key = null;
      this.logger.warn(
        'ENCRYPTION_KEY não configurada ou inválida (precisa de 64 caracteres hex). ' +
        'Campos sensíveis serão armazenados SEM criptografia.',
      );
    }
  }

  /** Returns true if encryption is configured and operational. */
  isEnabled(): boolean {
    return this.key !== null;
  }

  /** Encrypts a plaintext value. Returns base64 string. If key not set, returns plaintext. */
  encrypt(plaintext: string): string {
    if (!this.key || !plaintext) return plaintext;

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Pack: iv (16) + authTag (16) + ciphertext
    const packed = Buffer.concat([iv, authTag, encrypted]);
    return packed.toString('base64');
  }

  /** Decrypts a base64-encoded ciphertext. If decryption fails (plain text), returns as-is. */
  decrypt(ciphertext: string): string {
    if (!this.key || !ciphertext) return ciphertext;

    try {
      const packed = Buffer.from(ciphertext, 'base64');
      if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
        // Too short to be encrypted — probably plaintext from before encryption was enabled
        return ciphertext;
      }

      const iv = packed.subarray(0, IV_LENGTH);
      const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const encrypted = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8');
    } catch {
      // If decryption fails, it's likely plaintext (legacy data)
      return ciphertext;
    }
  }

  /** Encrypts a value only if it's not already encrypted (idempotent). */
  encryptIfNeeded(value: string): string {
    if (!this.key || !value) return value;
    // Try to decrypt — if it succeeds and looks like the original, it's already encrypted
    const decrypted = this.decrypt(value);
    if (decrypted !== value) return value; // Already encrypted
    return this.encrypt(value);
  }
}
