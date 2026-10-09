import { LunaAcoesService } from './luna-acoes.service';

const AUTH = { userId: 'user-1', empresaId: 'emp-1', perfilGlobal: 'GESTOR' };

function makeAcoes() {
  const prisma = {
    usuario: { findUnique: jest.fn().mockResolvedValue({ perfilGlobal: 'GESTOR', capabilities: null }) },
    rdo: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'r1',
        obraId: 'o1',
        status: 'RASCUNHO',
        dataReferencia: new Date('2026-03-12T12:00:00.000Z'),
        dadosExtras: { observacoes: '' },
        obra: { nome: 'Victoria' },
      }),
    },
    userObraRole: {
      findFirst: jest.fn().mockResolvedValue({ permissoes: { RDO: 'EDIT' } }),
    },
  };
  const capabilities = {
    resolveForUser: jest.fn().mockResolvedValue({
      criarEditarRdo: true,
      aprovarRdo: true,
      gerenciarCatalogo: true,
      gerenciarUsuarios: true,
      acessoTodasObras: true,
    }),
  };
  const rdo = {
    addAtividade: jest.fn().mockResolvedValue({ id: 'a1' }),
    saveRascunho: jest.fn(),
    submeter: jest.fn(),
    aprovar: jest.fn(),
    rejeitar: jest.fn(),
  };
  const catalogo = { create: jest.fn(), update: jest.fn() };
  const usuarios = { create: jest.fn(), update: jest.fn(), updatePapel: jest.fn() };
  const svc = new LunaAcoesService(
    prisma as any,
    capabilities as any,
    rdo as any,
    catalogo as any,
    usuarios as any,
  );
  return { svc, rdo, prisma };
}

describe('ajustes da Luna', () => {
  it('propor não grava; confirmar grava a atividade', async () => {
    const { svc, rdo } = makeAcoes();
    const previa = await svc.propor(AUTH, {
      tipo: 'rdo_rascunho',
      rdo_id: 'r1',
      atividade: 'Concretagem da laje',
    });
    expect(previa.gravado).toBe(false);
    expect(previa.pendente).toBe(true);
    expect(previa.id).toBeTruthy();
    expect(rdo.addAtividade).not.toHaveBeenCalled();
    expect(rdo.saveRascunho).not.toHaveBeenCalled();

    const feito = await svc.confirmar(AUTH, previa.id as string);
    expect(feito.gravado).toBe(true);
    expect(rdo.addAtividade).toHaveBeenCalledWith('r1', 'o1', 'user-1', {
      descricao: 'Concretagem da laje',
    });
  });

  it('recusa diário de outra empresa', async () => {
    const { svc, prisma, rdo } = makeAcoes();
    prisma.rdo.findFirst.mockResolvedValue(null);
    await expect(
      svc.propor(AUTH, { tipo: 'rdo_rascunho', rdo_id: 'de-outra', atividade: 'x' }),
    ).rejects.toThrow(/empresa/);
    expect(rdo.addAtividade).not.toHaveBeenCalled();
  });
});
