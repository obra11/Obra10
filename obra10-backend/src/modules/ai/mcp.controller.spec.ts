import { McpController, MCP_PROTOCOL } from './mcp.controller';
import { LUNA_TOOL_DEFS } from './luna-tools.service';

function mockRes() {
  const res: any = {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    setHeader(k: string, v: string) {
      this.headers[k.toLowerCase()] = v;
      return this;
    },
    status(n: number) {
      this.statusCode = n;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
  return res;
}

describe('MCP HTTP', () => {
  const tools = {
    execute: jest.fn().mockResolvedValue('{"ajuda":"/relatorios"}'),
  };
  const ctrl = new McpController(tools as any);
  const user = { sub: 'u1', empresaId: 'e1', perfilGlobal: 'GESTOR' };

  it('initialize devolve protocolo e instructions, sem perguntar_luna', async () => {
    const res = mockRes();
    await ctrl.handle(
      {
        user,
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: MCP_PROTOCOL },
        },
        headers: {},
      } as any,
      res,
    );
    expect(res.body.result.protocolVersion).toBe(MCP_PROTOCOL);
    expect(res.body.result.instructions).toMatch(/ajuda_obra10/);
    expect(res.body.result.instructions).toMatch(/Sem perguntar_luna/);
    expect(res.headers['mcp-protocol-version']).toBe(MCP_PROTOCOL);
  });

  it('tools/list inclui ajuda e as tools de leitura, sem perguntar_luna', async () => {
    const res = mockRes();
    await ctrl.handle(
      {
        user,
        body: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
        headers: {},
      } as any,
      res,
    );
    const names = res.body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(LUNA_TOOL_DEFS.map((t) => t.name));
    expect(names).toContain('ajuda_obra10');
    expect(names).toContain('listar_obras');
    expect(names).not.toContain('perguntar_luna');
  });

  it('tools/call executa a tool autenticada pelo JWT', async () => {
    const res = mockRes();
    await ctrl.handle(
      {
        user,
        body: {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'ajuda_obra10', arguments: { tema: 'relatorios' } },
        },
        headers: {},
      } as any,
      res,
    );
    expect(tools.execute).toHaveBeenCalledWith(
      'ajuda_obra10',
      { tema: 'relatorios' },
      { userId: 'u1', empresaId: 'e1', perfilGlobal: 'GESTOR' },
    );
    expect(res.body.result.content[0].text).toContain('/relatorios');
  });

  it('recusa perguntar_luna no MCP', async () => {
    const res = mockRes();
    await ctrl.handle(
      {
        user,
        body: {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: { name: 'perguntar_luna', arguments: {} },
        },
        headers: {},
      } as any,
      res,
    );
    expect(res.body.error.message).toMatch(/indisponível/i);
  });
});
