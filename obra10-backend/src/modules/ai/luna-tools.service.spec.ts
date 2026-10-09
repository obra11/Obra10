import { LunaToolsService, LUNA_TOOL_DEFS } from './luna-tools.service';

const AUTH = {
  userId: 'user-1',
  empresaId: 'emp-1',
  perfilGlobal: 'GESTOR',
};

function makeTools(caps?: Record<string, unknown>) {
  const prisma = {
    usuario: { findUnique: jest.fn() },
    obra: { findMany: jest.fn() },
    rdo: { findMany: jest.fn(), findFirst: jest.fn() },
    alertaObra: { findMany: jest.fn() },
    tenantModulo: { findMany: jest.fn() },
    cobranca: { findMany: jest.fn() },
  };
  prisma.usuario.findUnique.mockResolvedValue({
    perfilGlobal: AUTH.perfilGlobal,
    capabilities: null,
  });
  const capabilities = {
    resolveForUser: jest.fn().mockResolvedValue({
      acessoTodasObras: true,
      gerenciarUsuarios: true,
      gerenciarFinanceiro: true,
      criarEditarRdo: true,
      modulosPadrao: { RDO: 'EDIT' },
      ...caps,
    }),
  };
  const rdoService = {
    findAllByEmpresa: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };
  const obraService = {
    getDashboardPainel: jest.fn().mockResolvedValue({ ok: true }),
    listarColaboradores: jest.fn().mockResolvedValue([]),
  };
  const catalogo = { findAll: jest.fn().mockResolvedValue([]) };
  const acoes = { propor: jest.fn(), confirmar: jest.fn(), cancelar: jest.fn() };
  const svc = new LunaToolsService(
    prisma as any,
    capabilities as any,
    rdoService as any,
    obraService as any,
    catalogo as any,
    acoes as any,
  );
  return { svc, prisma, capabilities, rdoService, obraService, catalogo };
}

describe('Luna tools (empresa, permissão, aliases)', () => {
  it('expõe as tools de leitura do programa, incluindo ajuda, sem perguntar_luna', () => {
    const names = LUNA_TOOL_DEFS.map((t) => t.name);
    for (const n of [
      'listar_obras',
      'painel_obra',
      'ver_obra',
      'listar_relatorios',
      'ver_rdo',
      'agregar_diarios',
      'agregar_clima',
      'agregar_efetivo',
      'agregar_atividades',
      'listar_catalogo',
      'listar_equipe',
      'listar_alertas',
      'ver_plano',
      'ajuda_obra10',
      'listar_efetivo_obra',
      'buscar_no_aplicativo',
      'propor_ajuste',
    ]) {
      expect(names).toContain(n);
    }
    expect(names).not.toContain('perguntar_luna');
  });

  it('listar_obras filtra pela empresa do JWT', async () => {
    const { svc, prisma } = makeTools();
    prisma.obra.findMany.mockResolvedValue([
      { id: 'o1', nome: 'Victoria', endereco: null, status: 'ATIVA' },
    ]);
    const raw = await svc.execute('listar_obras', {}, AUTH);
    const parsed = JSON.parse(raw);
    expect(prisma.obra.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ empresaId: 'emp-1', deletedAt: null }),
      }),
    );
    expect(parsed.obras[0].nome).toBe('Victoria');
  });

  it('agregar_diarios resolve outra obra pelo nome (não fica na tela atual)', async () => {
    const { svc, prisma } = makeTools();
    prisma.obra.findMany.mockResolvedValue([
      { id: 'vic', nome: 'Victoria Residence', endereco: null, status: 'ATIVA' },
      { id: 'out', nome: 'Outra Obra', endereco: null, status: 'ATIVA' },
    ]);
    prisma.rdo.findMany.mockResolvedValue([]);
    await svc.execute(
      'agregar_diarios',
      { obra: 'Outra', pergunta: 'e na outra obra, choveu em agosto?' },
      AUTH,
      'vic',
    );
    const where = prisma.rdo.findMany.mock.calls[0][0].where;
    expect(where.obra.empresaId).toBe('emp-1');
    const ids = where.OR.flatMap((c: any) => c.obraId.in);
    expect(ids).toEqual(['out']);
    expect(ids).not.toContain('vic');
  });

  it('VIEW_APPROVED só agrega RDOs aprovados', async () => {
    const { svc, prisma } = makeTools({
      acessoTodasObras: false,
      criarEditarRdo: false,
      modulosPadrao: { RDO: 'VIEW_APPROVED' },
    });
    prisma.obra.findMany.mockResolvedValue([
      {
        id: 'o1',
        nome: 'Victoria',
        endereco: null,
        status: 'ATIVA',
        userObraRole: [{ permissoes: { RDO: 'VIEW_APPROVED' } }],
      },
    ]);
    prisma.rdo.findMany.mockResolvedValue([]);
    await svc.execute('agregar_clima', { pergunta: 'choveu em agosto' }, AUTH);
    const where = prisma.rdo.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          obraId: { in: ['o1'] },
          status: 'APROVADO',
        }),
      ]),
    );
  });

  it('ajuda_obra10 responde como abrir Relatórios de todas as obras', async () => {
    const { svc } = makeTools();
    const raw = await svc.execute('ajuda_obra10', { tema: 'relatorios' }, AUTH);
    const parsed = JSON.parse(raw);
    expect(parsed.ajuda.toLowerCase()).toContain('/relatorios');
  });

  it('listar_equipe recusa quem não gerencia usuários', async () => {
    const { svc } = makeTools({ gerenciarUsuarios: false });
    const raw = await svc.execute(
      'listar_equipe',
      {},
      { ...AUTH, perfilGlobal: 'COLABORADOR' },
    );
    const parsed = JSON.parse(raw);
    expect(parsed.erro).toMatch(/permissão/i);
  });

  it('ver_obra é alias de painel_obra', async () => {
    const { svc, prisma, obraService } = makeTools();
    prisma.obra.findMany.mockResolvedValue([
      { id: 'o1', nome: 'Victoria', endereco: null, status: 'ATIVA' },
    ]);
    await svc.execute('ver_obra', { obra: 'Victoria' }, AUTH);
    expect(obraService.getDashboardPainel).toHaveBeenCalledWith('o1', 'emp-1');
  });

  it('agregar recusa obra de outra empresa / sem acesso', async () => {
    const { svc, prisma } = makeTools();
    prisma.obra.findMany.mockResolvedValue([
      { id: 'vic', nome: 'Victoria', endereco: null, status: 'ATIVA' },
    ]);
    const parsed = JSON.parse(
      await svc.execute('agregar_diarios', { obra: 'Acme' }, AUTH),
    );
    expect(parsed.erro).toMatch(/não encontrada/i);
    expect(prisma.rdo.findMany).not.toHaveBeenCalled();
  });

  it('perguntar_luna é recusado', async () => {
    const { svc } = makeTools();
    const parsed = JSON.parse(await svc.execute('perguntar_luna', {}, AUTH));
    expect(parsed.erro).toMatch(/não está disponível/i);
  });
});
