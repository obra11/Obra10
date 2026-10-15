import { BadRequestException } from '@nestjs/common';
import { ObraService } from './obra.service';

describe('ObraService nomes duplicados e exclusão', () => {
  function makeService() {
    const prisma: any = {
      empresa: { findUnique: jest.fn() },
      obra: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      perfil: { findUnique: jest.fn(), create: jest.fn() },
      userObraRole: { create: jest.fn() },
      usuario: { findUnique: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    };
    const email = { enviarConfirmacaoExcluirObra: jest.fn().mockResolvedValue(undefined) };
    const svc = new ObraService(prisma, email as any, {} as any);
    return { svc, prisma, email };
  }

  it('recusa cadastrar outra obra com o mesmo nome na empresa', async () => {
    const { svc, prisma } = makeService();
    prisma.empresa.findUnique.mockResolvedValue({ limiteObras: 5 });
    prisma.obra.count.mockResolvedValue(1);
    prisma.perfil.findUnique.mockResolvedValue({ id: 1, nomeInterno: 'ENGENHEIRO' });
    prisma.obra.findFirst.mockResolvedValue({ id: 'obra-1', nome: 'Gramal Theory' });

    await expect(
      svc.criarObra('emp-1', 'user-1', { nome: '  gramal theory  ' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.obra.create).not.toHaveBeenCalled();
  });

  it('permite reusar o nome depois que a obra anterior foi excluída', async () => {
    const { svc, prisma } = makeService();
    prisma.empresa.findUnique.mockResolvedValue({ limiteObras: 5 });
    prisma.obra.count.mockResolvedValue(0);
    prisma.perfil.findUnique.mockResolvedValue({ id: 1, nomeInterno: 'ENGENHEIRO' });
    prisma.obra.findFirst.mockResolvedValue(null);
    prisma.obra.create.mockResolvedValue({
      id: 'obra-nova',
      nome: 'Gramal Theory',
      empresaId: 'emp-1',
    });
    prisma.userObraRole.create.mockResolvedValue({ id: 'role-1' });

    const obra = await svc.criarObra('emp-1', 'user-1', {
      nome: 'Gramal Theory',
      endereco: 'Rua A',
    });

    expect(obra.id).toBe('obra-nova');
    expect(prisma.obra.create).toHaveBeenCalledWith({
      data: {
        empresaId: 'emp-1',
        nome: 'Gramal Theory',
        endereco: 'Rua A',
        status: 'ATIVA',
      },
    });
  });

  it('faz soft-delete e não reaparece como ativa', async () => {
    const { svc, prisma, email } = makeService();
    prisma.obra.findFirst.mockResolvedValue({
      id: 'obra-1',
      empresaId: 'emp-1',
      nome: 'Gramal Theory',
      deletedAt: null,
    });
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'gestor@estrutural.com',
      nome: 'Gestor',
    });
    prisma.obra.update.mockResolvedValue({
      id: 'obra-1',
      status: 'EXCLUIDA',
      deletedAt: new Date(),
    });

    await svc.excluirObra('obra-1', 'emp-1', 'user-1');

    expect(prisma.obra.findFirst).toHaveBeenCalledWith({
      where: { id: 'obra-1', empresaId: 'emp-1', deletedAt: null },
    });
    expect(prisma.obra.update).toHaveBeenCalledWith({
      where: { id: 'obra-1' },
      data: { deletedAt: expect.any(Date), status: 'EXCLUIDA' },
    });
    expect(email.enviarConfirmacaoExcluirObra).toHaveBeenCalled();
  });

  it('diz que a obra já foi excluída em vez de falhar de forma opaca', async () => {
    const { svc, prisma } = makeService();
    prisma.obra.findFirst.mockResolvedValue(null);

    await expect(svc.excluirObra('obra-1', 'emp-1', 'user-1')).rejects.toThrow(
      /já foi excluída/i,
    );
    expect(prisma.obra.update).not.toHaveBeenCalled();
  });
});
