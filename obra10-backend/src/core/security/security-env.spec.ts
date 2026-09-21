import { resolveJwtSecret, SecurityEnvError } from './security-env';

describe('resolveJwtSecret', () => {
  const original = process.env.JWT_SECRET;

  afterEach(() => {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  });

  it('rejeita ausente', () => {
    delete process.env.JWT_SECRET;
    expect(() => resolveJwtSecret()).toThrow(SecurityEnvError);
  });

  it('rejeita o default público', () => {
    process.env.JWT_SECRET = 'obra10-mvp-secret-key-12345';
    expect(() => resolveJwtSecret()).toThrow(/default público/);
  });

  it('aceita chave longa', () => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    expect(resolveJwtSecret()).toHaveLength(32);
  });
});
