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
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const capabilities = { resolveForUser: jest.fn() };
  const extracao = { extrair: jest.fn() };
  const svc = new EstoqueService(prisma as any, capabilities as any, extracao as any);
  return { svc, prisma, tx };
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
    });
    tx.saldoEstoque.findFirst.mockResolvedValue({
      id: 's1',
      quantidade: new Prisma.Decimal(1),
    });
    await expect(
      svc.saida('emp-1', 'user-1', { localId: 'loc-1', codigo: 'O10ABC', quantidade: 5 }),
    ).rejects.toThrow(/insuficiente/i);
  });
});
