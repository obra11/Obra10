import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('POST /auth/token (MCP Bearer)', () => {
  function makeService() {
    const prisma = { usuario: { findFirst: jest.fn() } };
    const jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt') };
    const svc = new AuthService(
      prisma as any,
      jwt as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return { svc, prisma, jwt };
  }

  it('emite JWT de 7 dias com empresaId do usuário e aponta /mcp', async () => {
    const { svc, prisma, jwt } = makeService();
    prisma.usuario.findFirst.mockResolvedValue({ jwtVersion: 3 });
    jest.spyOn(svc, 'login').mockResolvedValue({
      access_token: 'cookie-token',
      usuario: {
        id: 'u1',
        nome: 'Ana',
        email: 'ana@obra10.app.br',
        empresaId: 'emp-1',
        perfilGlobal: 'GESTOR',
      },
    } as any);

    const out = await svc.emitirTokenMcp('ana@obra10.app.br', 'Senha123');

    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'u1',
        email: 'ana@obra10.app.br',
        empresaId: 'emp-1',
        perfilGlobal: 'GESTOR',
        jwtVersion: 3,
        scope: 'mcp',
      }),
      { expiresIn: '7d' },
    );
    expect(out.token_type).toBe('Bearer');
    expect(out.expires_in).toBe(7 * 24 * 3600);
    expect(out.mcp.url).toBe('https://obra10.app.br/mcp');
    expect(out.usuario.empresaId).toBe('emp-1');
  });

  it('pede empresaId quando o e-mail está em mais de uma empresa', async () => {
    const { svc } = makeService();
    jest.spyOn(svc, 'login').mockResolvedValue({
      precisaEscolherEmpresa: true,
      empresas: [{ id: 'e1' }, { id: 'e2' }],
    } as any);
    await expect(svc.emitirTokenMcp('ana@obra10.app.br', 'Senha123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
