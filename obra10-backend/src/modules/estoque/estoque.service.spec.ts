import { BadRequestException } from '@nestjs/common';
import { TipoEstoqueItem, TipoMovimentoEstoque } from '@prisma/client';
import { EstoqueService } from './estoque.service';

describe('EstoqueService isolamento', () => {
  const prisma: any = {
    obra: { findFirst: jest.fn() },
    estoqueItem: {
      count: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const service = new EstoqueService(prisma);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('não lista estoque de outra empresa', async () => {
    prisma.obra.findFirst.mockResolvedValue(null);
    await expect(
      service.listarItens('emp-a', 'obra-b', TipoEstoqueItem.MATERIAL),
    ).rejects.toThrow('Obra não encontrada');
    expect(prisma.estoqueItem.findMany).not.toHaveBeenCalled();
  });

  it('recusa saída com quantidade inválida', async () => {
    prisma.estoqueItem.findFirst.mockResolvedValue({
      id: 'i1',
      empresaId: 'emp-a',
      obraId: 'obra-a',
      ativo: true,
      saldo: 10,
      unidade: 'un',
    });
    prisma.$transaction = async (fn: any) => fn(prisma);

    await expect(
      service.movimentar('emp-a', 'obra-a', 'i1', 'u1', {
        tipo: TipoMovimentoEstoque.SAIDA,
        quantidade: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
