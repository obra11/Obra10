import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EstoqueService } from './estoque.service';

function docVinculado() {
  return {
    id: 'd1',
    empresaId: 'emp-1',
    status: 'EM_CONFERENCIA',
    localId: 'loc-1',
    obraId: null,
    recebedorId: 'user-1',
    criadorId: 'user-1',
    fornecedorCnpj: '11222333000181',
    fornecedorRazao: 'Loja do Cimento',
    fornecedorIe: null,
    fornecedorTelefone: null,
    fornecedorEmail: null,
    fornecedorId: null,
    itens: [
      {
        id: 'i1',
        status: 'VINCULADO',
        insumoId: 'ins-1',
        quantidade: new Prisma.Decimal(2),
        descricaoOriginal: 'Cimento CP-II 50kg',
        descricaoNormalizada: 'cimento cp ii 50 kg',
        ean: null,
        unidade: 'sc',
      },
    ],
  };
}

function makeSvc() {
  const tx = {
    documentoEntrada: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
    },
    fornecedor: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'forn-1' }),
      update: jest.fn(),
    },
    catalogoInsumo: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'ins-1',
        ean: null,
        codigoBarras: 'O10JAEXISTE',
      }),
      create: jest.fn().mockResolvedValue({ id: 'ins-novo' }),
      update: jest.fn(),
    },
    insumoAlias: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
    saldoEstoque: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
    movimentoEstoque: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    documentoEntrada: { findFirst: jest.fn() },
    localEstoque: { findFirst: jest.fn() },
    catalogoInsumo: { findFirst: jest.fn() },
    usuario: { findFirst: jest.fn() },
    obra: { findFirst: jest.fn() },
    userObraRole: { findUnique: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const capabilities = { resolveForUser: jest.fn() };
  const extracao = { extrair: jest.fn() };
  const svc = new EstoqueService(prisma as any, capabilities as any, extracao as any);
  return { svc, prisma, tx, capabilities };
}

describe('EstoqueService', () => {
  it('não abre documento de outra empresa', async () => {
    const { svc, prisma } = makeSvc();
    prisma.documentoEntrada.findFirst.mockResolvedValue(null);
    await expect(svc.obterEntrada('emp-1', 'user-1', 'de-outra')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.documentoEntrada.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'de-outra', empresaId: 'emp-1' }),
      }),
    );
  });

  it('confirma uma vez: grava apelido, saldo e movimento de entrada', async () => {
    const { svc, prisma, tx } = makeSvc();
    prisma.documentoEntrada.findFirst.mockResolvedValue(docVinculado());
    prisma.localEstoque.findFirst.mockResolvedValue({
      id: 'loc-1',
      empresaId: 'emp-1',
      obraId: null,
      tipo: 'DEPOSITO_CENTRAL',
      nome: 'Depósito central',
      codigo: 'CENTRAL',
      ativo: true,
    });
    prisma.usuario.findFirst.mockResolvedValue({
      id: 'user-1',
      perfilGlobal: 'GESTOR',
      capabilities: null,
    });

    await svc.confirmar('emp-1', 'user-1', 'd1');

    expect(tx.insumoAlias.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          empresaId: 'emp-1',
          insumoId: 'ins-1',
          descricaoNormalizada: 'cimento cp ii 50 kg',
        }),
      }),
    );
    expect(tx.saldoEstoque.create).toHaveBeenCalledTimes(1);
    expect(tx.saldoEstoque.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          empresaId: 'emp-1',
          localId: 'loc-1',
          insumoId: 'ins-1',
        }),
      }),
    );
    expect(tx.movimentoEstoque.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'ENTRADA',
          empresaId: 'emp-1',
          documentoId: 'd1',
        }),
      }),
    );

    tx.documentoEntrada.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.confirmar('emp-1', 'user-1', 'd1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.saldoEstoque.create).toHaveBeenCalledTimes(1);
  });

  it('saída de outra empresa não acha o local e saldo curto é recusado', async () => {
    const { svc, prisma, tx } = makeSvc();
    prisma.localEstoque.findFirst.mockResolvedValue(null);
    await expect(
      svc.saida('emp-1', 'user-1', { localId: 'loc-x', codigo: 'O10ABC', quantidade: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.localEstoque.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'loc-x', empresaId: 'emp-1' }),
      }),
    );

    prisma.localEstoque.findFirst.mockResolvedValue({
      id: 'loc-1',
      empresaId: 'emp-1',
      obraId: null,
      tipo: 'DEPOSITO_CENTRAL',
      nome: 'Depósito central',
      codigo: 'CENTRAL',
      ativo: true,
    });
    prisma.catalogoInsumo.findFirst.mockResolvedValue({
      id: 'ins-1',
      nome: 'Cimento',
      codigoBarras: 'O10ABC',
      tipo: 'MATERIAL',
    });
    tx.saldoEstoque.findFirst.mockResolvedValue({
      id: 's1',
      quantidade: new Prisma.Decimal(1),
    });
    await expect(
      svc.saida('emp-1', 'user-1', { localId: 'loc-1', codigo: 'O10ABC', quantidade: 5 }),
    ).rejects.toThrow(/insuficiente/i);
  });

  it('transfere do almoxarifado da obra para o depósito central', async () => {
    const { svc, prisma, tx, capabilities } = makeSvc();
    const origem = {
      id: 'loc-a',
      empresaId: 'emp-1',
      obraId: 'obra-a',
      tipo: 'ALMOXARIFADO',
      nome: 'Almoxarifado — Obra A',
      codigo: 'obra-a',
      ativo: true,
    };
    const central = {
      id: 'loc-central',
      empresaId: 'emp-1',
      obraId: null,
      tipo: 'DEPOSITO_CENTRAL',
      nome: 'Depósito central',
      codigo: 'CENTRAL',
      ativo: true,
    };
    prisma.localEstoque.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.id === 'loc-a') return origem;
      if (where.id === 'loc-central') return central;
      return null;
    });
    prisma.obra.findFirst.mockResolvedValue({ id: 'obra-a' });
    prisma.usuario.findFirst.mockResolvedValue({
      id: 'user-1',
      perfilGlobal: 'ENCARREGADO',
      capabilities: null,
    });
    capabilities.resolveForUser.mockResolvedValue({
      acessoTodasObras: false,
      modulosPadrao: { MATERIAIS: 'EDIT' },
    });
    prisma.userObraRole.findUnique.mockResolvedValue({
      permissoes: { MATERIAIS: 'EDIT' },
    });
    prisma.catalogoInsumo.findFirst.mockResolvedValue({ id: 'ins-1', nome: 'Cimento' });
    tx.saldoEstoque.findFirst.mockResolvedValue({ id: 's1', quantidade: new Prisma.Decimal(8) });
    tx.saldoEstoque.findUnique.mockResolvedValue(null);

    await svc.transferir('emp-1', 'user-1', {
      origemLocalId: 'loc-a',
      destinoLocalId: 'loc-central',
      insumoId: 'ins-1',
      quantidade: 2,
    });

    expect(tx.movimentoEstoque.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'TRANSFERENCIA',
          localOrigemId: 'loc-a',
          localDestinoId: 'loc-central',
        }),
      }),
    );
  });

  it('transfere do almoxarifado da obra para outra obra sem exigir escrita no destino', async () => {
    const { svc, prisma, tx, capabilities } = makeSvc();
    const origem = {
      id: 'loc-a',
      empresaId: 'emp-1',
      obraId: 'obra-a',
      tipo: 'ALMOXARIFADO',
      nome: 'Almoxarifado — Obra A',
      codigo: 'obra-a',
      ativo: true,
    };
    const dest = {
      id: 'loc-b',
      empresaId: 'emp-1',
      obraId: 'obra-b',
      tipo: 'ALMOXARIFADO',
      nome: 'Almoxarifado — Obra B',
      codigo: 'obra-b',
      ativo: true,
    };
    prisma.localEstoque.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.id === 'loc-a') return origem;
      if (where.id === 'loc-b') return dest;
      if (where.codigo === 'obra-b') return dest;
      return null;
    });
    prisma.obra.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.id === 'obra-a' || where.id === 'obra-b') return { id: where.id };
      return null;
    });
    prisma.usuario.findFirst.mockResolvedValue({
      id: 'user-1',
      perfilGlobal: 'ENCARREGADO',
      capabilities: null,
    });
    capabilities.resolveForUser.mockResolvedValue({
      acessoTodasObras: false,
      modulosPadrao: {},
    });
    prisma.userObraRole.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.usuarioId_obraId.obraId === 'obra-a') {
        return { permissoes: { MATERIAIS: 'EDIT' } };
      }
      return null;
    });
    prisma.catalogoInsumo.findFirst.mockResolvedValue({ id: 'ins-1', nome: 'Cimento' });
    tx.saldoEstoque.findFirst.mockResolvedValue({ id: 's1', quantidade: new Prisma.Decimal(10) });
    tx.saldoEstoque.findUnique.mockResolvedValue(null);

    await svc.transferir('emp-1', 'user-1', {
      origemLocalId: 'loc-a',
      obraDestinoId: 'obra-b',
      insumoId: 'ins-1',
      quantidade: 3,
    });

    expect(tx.saldoEstoque.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          empresaId: 'emp-1',
          localId: 'loc-b',
          insumoId: 'ins-1',
        }),
      }),
    );
    expect(tx.movimentoEstoque.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'TRANSFERENCIA',
          localOrigemId: 'loc-a',
          localDestinoId: 'loc-b',
        }),
      }),
    );
  });

  it('não transfere para a própria origem nem para obra inexistente', async () => {
    const { svc, prisma, capabilities } = makeSvc();
    const origem = {
      id: 'loc-a',
      empresaId: 'emp-1',
      obraId: 'obra-a',
      tipo: 'ALMOXARIFADO',
      nome: 'Almoxarifado — Obra A',
      codigo: 'obra-a',
      ativo: true,
    };
    prisma.localEstoque.findFirst.mockResolvedValue(origem);
    prisma.obra.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.id === 'obra-a') return { id: 'obra-a' };
      return null;
    });
    prisma.usuario.findFirst.mockResolvedValue({
      id: 'user-1',
      perfilGlobal: 'ENCARREGADO',
      capabilities: null,
    });
    capabilities.resolveForUser.mockResolvedValue({
      acessoTodasObras: false,
      modulosPadrao: { MATERIAIS: 'EDIT' },
    });
    prisma.userObraRole.findUnique.mockResolvedValue({
      permissoes: { MATERIAIS: 'EDIT' },
    });

    await expect(
      svc.transferir('emp-1', 'user-1', {
        origemLocalId: 'loc-a',
        destinoLocalId: 'loc-a',
        insumoId: 'ins-1',
        quantidade: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      svc.transferir('emp-1', 'user-1', {
        origemLocalId: 'loc-a',
        obraDestinoId: 'obra-x',
        insumoId: 'ins-1',
        quantidade: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.obra.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'obra-x', empresaId: 'emp-1' }),
      }),
    );
  });
});
