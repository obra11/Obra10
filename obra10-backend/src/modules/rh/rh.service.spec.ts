import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { lerVisaoLuna } from '../ai/luna-visao';
import { RhService } from './rh.service';

jest.mock('../ai/luna-visao', () => ({
  lerNotaLuna: jest.fn(),
  lerVisaoLuna: jest.fn(),
}));

const foto = {
  buffer: Buffer.from('abc'),
  size: 3,
  mimetype: 'image/jpeg',
  originalname: 'ficha.jpg',
} as Express.Multer.File;

function makeSvc(extraPrisma: Record<string, unknown> = {}) {
  const estoque = { listarLocais: jest.fn().mockResolvedValue({ locais: [] }) };
  const capabilities = {
    resolveForUser: jest.fn().mockResolvedValue({ acessoTodasObras: true, gerenciarUsuarios: true }),
  };
  const prisma = {
    usuario: { findFirst: jest.fn().mockResolvedValue({ perfilGlobal: 'GESTOR', capabilities: {} }) },
    obra: { findFirst: jest.fn().mockImplementation(async ({ where }: any) => (where?.id ? { id: where.id } : null)) },
    funcionario: { findFirst: jest.fn().mockResolvedValue(null) },
    ...extraPrisma,
  };
  const crypto = {
    encrypt: (s: string) => `enc:${s}`,
    decrypt: (s: string) => String(s).replace(/^enc:/, ''),
  };
  const rh = new RhService(prisma as any, estoque as any, crypto as any, capabilities as any);
  return { rh, estoque, prisma, capabilities };
}

describe('RhService.lerFicha', () => {
  beforeEach(() => {
    (lerVisaoLuna as jest.Mock).mockReset();
  });

  it('lê a ficha no RH da empresa sem gravar a foto', async () => {
    const { rh, estoque } = makeSvc();
    (lerVisaoLuna as jest.Mock).mockResolvedValue(JSON.stringify({
      nome: 'João da Silva',
      cpf: '11144477735',
      sexo: 'Masculino',
    }));
    const lida = await rh.lerFicha('emp-1', 'user-1', [foto]);
    expect(estoque.listarLocais).not.toHaveBeenCalled();
    expect(lida.ficha.nome).toBe('João da Silva');
    expect(lida.ficha.cpf).toBe('111.444.777-35');
    expect(lida.preenchidos).toContain('nome');
  });

  it('confere a obra quando a leitura vem do canteiro', async () => {
    const { rh, estoque } = makeSvc();
    (lerVisaoLuna as jest.Mock).mockResolvedValue(JSON.stringify({
      nome: 'João da Silva',
      cpf: '11144477735',
    }));
    await rh.lerFicha('emp-1', 'user-1', [foto], 'obra-1');
    expect(estoque.listarLocais).toHaveBeenCalledWith('emp-1', 'user-1', 'obra-1');
  });

  it('explica quando a Luna não está configurada', async () => {
    const { rh } = makeSvc();
    (lerVisaoLuna as jest.Mock).mockRejectedValue(new Error('SEM_CHAVE'));
    await expect(rh.lerFicha('emp-1', 'user-1', [foto], 'obra-1')).rejects.toThrow(
      /não está disponível/i,
    );
  });
});

describe('RhService.criar', () => {
  it('cadastra a ficha só com nome completo e CPF, sem obra', async () => {
    const create = jest.fn().mockImplementation(async ({ data }: any) => ({
      id: 'f1',
      ativo: true,
      ...data,
    }));
    const { rh, estoque, prisma } = makeSvc({
      funcionario: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
    });
    const ficha = await rh.criar('emp-1', 'user-1', {
      nome: 'João da Silva',
      cpf: '111.444.777-35',
    });
    expect(estoque.listarLocais).not.toHaveBeenCalled();
    expect(prisma.usuario.findFirst).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          empresaId: 'emp-1',
          obraId: null,
          nome: 'João da Silva',
          funcao: '',
          cpfHash: expect.any(String),
        }),
      }),
    );
    expect(ficha.nome).toBe('João da Silva');
    expect(ficha.cpf).toBe('111.444.777-35');
    expect(ficha.obraId).toBeNull();
  });

  it('ainda cadastra lotado na obra quando a ficha vem do canteiro', async () => {
    const create = jest.fn().mockImplementation(async ({ data }: any) => ({
      id: 'f1',
      ativo: true,
      ...data,
    }));
    const { rh, estoque } = makeSvc({
      funcionario: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
    });
    const ficha = await rh.criar('emp-1', 'user-1', {
      obraId: 'obra-1',
      nome: 'João da Silva',
      cpf: '111.444.777-35',
    });
    expect(estoque.listarLocais).toHaveBeenCalledWith('emp-1', 'user-1', 'obra-1');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          empresaId: 'emp-1',
          obraId: 'obra-1',
        }),
      }),
    );
    expect(ficha.obraId).toBe('obra-1');
  });

  it('recusa cadastro sem CPF', async () => {
    const { rh } = makeSvc();
    await expect(
      rh.criar('emp-1', 'user-1', { nome: 'João da Silva' }),
    ).rejects.toThrow(/CPF/i);
  });
});

describe('RhService.avisos e exames', () => {
  const validadeVencida = new Date('2020-01-15T12:00:00.000Z');

  it('agrupa exame e treinamento atrasados no RH da empresa', async () => {
    const { rh, estoque } = makeSvc({
      treinamentoFuncionario: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 't1',
            tipo: 'RECORRENTE',
            nome: 'NR-18',
            dataRealizacao: validadeVencida,
            cargaHoraria: null,
            validade: validadeVencida,
            instrutor: null,
            assinatura: null,
            createdAt: validadeVencida,
            funcionario: { id: 'f1', nome: 'João', funcao: 'Pedreiro', ativo: true },
          },
        ]),
      },
      exameFuncionario: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'e1',
            tipo: 'PERIODICO',
            nome: 'ASO',
            dataRealizacao: validadeVencida,
            validade: validadeVencida,
            resultado: 'APTO',
            clinica: null,
            observacao: null,
            createdAt: validadeVencida,
            funcionario: { id: 'f1', nome: 'João', funcao: 'Pedreiro', ativo: true },
          },
        ]),
      },
    });
    const avisos = await rh.avisos('emp-1', 'user-1');
    expect(estoque.listarLocais).not.toHaveBeenCalled();
    expect(avisos.vencidos).toBe(2);
    expect(avisos.examesVencidos).toBe(1);
    expect(avisos.treinamentosVencidos).toBe(1);
    expect(avisos.itens.map((item: { especie: string }) => item.especie).sort()).toEqual(['EXAME', 'TREINAMENTO']);
  });

  it('não abre o RH da empresa para quem só tem a obra', async () => {
    const { rh } = makeSvc({
      usuario: { findFirst: jest.fn().mockResolvedValue({ perfilGlobal: 'COLABORADOR', capabilities: {} }) },
    });
    rh['capabilities'].resolveForUser = jest.fn().mockResolvedValue({
      acessoTodasObras: false,
      gerenciarUsuarios: false,
    });
    await expect(rh.avisos('emp-1', 'user-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('registra exame no cadastro da empresa', async () => {
    const create = jest.fn().mockImplementation(async ({ data, include }: any) => ({
      id: 'e1',
      createdAt: new Date('2026-01-01T12:00:00.000Z'),
      clinica: null,
      observacao: null,
      resultado: data.resultado,
      ...data,
      funcionario: { id: 'f1', nome: 'João', funcao: 'Pedreiro' },
      include,
    }));
    const { rh, estoque } = makeSvc({
      funcionario: {
        findFirst: jest.fn().mockResolvedValue({ id: 'f1', empresaId: 'emp-1', ativo: true, deletedAt: null }),
      },
      exameFuncionario: { create },
    });
    const exame = await rh.registrarExame('emp-1', 'user-1', {
      funcionarioId: 'f1',
      tipo: 'PERIODICO',
      nome: 'ASO',
      dataRealizacao: '2026-01-10',
      validade: '2027-01-10',
      resultado: 'APTO',
    });
    expect(estoque.listarLocais).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        empresaId: 'emp-1',
        funcionarioId: 'f1',
        tipo: 'PERIODICO',
        nome: 'ASO',
        resultado: 'APTO',
      }),
    }));
    expect(exame.nome).toBe('ASO');
    expect(exame.situacao).toBe('VIGENTE');
  });
});
