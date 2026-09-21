const FORBIDDEN_JWT_SECRETS = new Set(['obra10-mvp-secret-key-12345']);

export class SecurityEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityEnvError';
  }
}

export function resolveJwtSecret(): string {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (!secret) {
    throw new SecurityEnvError(
      'JWT_SECRET não configurada. Defina uma chave aleatória com no mínimo 32 caracteres.',
    );
  }
  if (FORBIDDEN_JWT_SECRETS.has(secret)) {
    throw new SecurityEnvError(
      'JWT_SECRET não pode ser o default público do repositório. Rotacione a chave.',
    );
  }
  if (secret.length < 16) {
    throw new SecurityEnvError('JWT_SECRET deve ter no mínimo 16 caracteres.');
  }
  if (secret.length < 32) {
    console.warn(
      '[security] JWT_SECRET tem menos de 32 caracteres. Gere uma chave mais longa e rotacione.',
    );
  }
  return secret;
}

export function assertEncryptionKeyForProduction(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const key = (process.env.ENCRYPTION_KEY || '').trim();
  if (!key) {
    throw new SecurityEnvError(
      'ENCRYPTION_KEY obrigatória em produção. Use 64 caracteres hexadecimais (AES-256).',
    );
  }
}

export function assertSecurityEnv(): void {
  resolveJwtSecret();
  assertEncryptionKeyForProduction();
}
