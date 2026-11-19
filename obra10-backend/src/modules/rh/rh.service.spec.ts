import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { lerVisaoLuna } from '../ai/luna-visao';
import * as estoqueStorage from '../estoque/estoque-storage';
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
    alocacaoFuncionario: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'a1' }),
      update: jest.fn().mockResolvedValue({}),
    },
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

describe('RhService.registrarTreinamento', () => {
  it('grava o certificado PDF junto com o treinamento', async () => {
    const create = jest.fn().mockImplementation(async ({ data }: any) => ({
      id: 't1',
      createdAt: new Date('2026-01-01T12:00:00.000Z'),
      assinatura: null,
      ...data,
      funcionario: { id: 'f1', nome: 'João', funcao: 'Pedreiro' },
    }));
    const { rh } = makeSvc({
      funcionario: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'f1',
          empresaId: 'emp-1',
          ativo: true,
          deletedAt: null,
        }),
      },
      treinamentoFuncionario: { create },
    });
    const gravar = jest
      .spyOn(estoqueStorage, 'gravarArquivoEntrada')
      .mockResolvedValue('https://cdn/cert.pdf');
    const pdf = {
      buffer: Buffer.from('%PDF'),
      size: 4,
      mimetype: 'application/pdf',
      originalname: 'nr18.pdf',
    } as Express.Multer.File;
    const treino = await rh.registrarTreinamento(
      'emp-1',
      'user-1',
      {
        funcionarioId: 'f1',
        tipo: 'RECORRENTE',
        nome: 'NR-18',
        dataRealizacao: '2026-01-10',
        validade: '2027-01-10',
        assinatura: `data:image/png;base64,${'A'.repeat(220)}`,
      },
      pdf,
    );
    expect(gravar).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          certificadoUrl: 'https://cdn/cert.pdf',
          certificadoNome: 'nr18.pdf',
          certificadoMime: 'application/pdf',
        }),
      }),
    );
    expect(treino.temCertificado).toBe(true);
    gravar.mockRestore();
  });
});

describe('RhService.dossie', () => {
  it('junta cadastro, treinamentos e exames do funcionário', async () => {
    const validade = new Date('2027-01-10T12:00:00.000Z');
    const { rh, estoque } = makeSvc({
      funcionario: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'f1',
          empresaId: 'emp-1',
          obraId: null,
          nome: 'João da Silva',
          funcao: 'Pedreiro',
          ativo: true,
          cpf: null,
          pis: null,
          salario: null,
        }),
      },
      treinamentoFuncionario: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 't1',
            tipo: 'RECORRENTE',
            nome: 'NR-18',
            dataRealizacao: new Date('2026-01-10T12:00:00.000Z'),
            cargaHoraria: null,
            validade,
            instrutor: null,
            assinatura: null,
            createdAt: validade,
          },
        ]),
      },
      exameFuncionario: { findMany: jest.fn().mockResolvedValue([]) },
      movimentoEstoque: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const dossie = await rh.dossie('emp-1', 'user-1', 'f1');
    expect(estoque.listarLocais).not.toHaveBeenCalled();
    expect(dossie.cadastro.nome).toBe('João da Silva');
    expect(dossie.treinamentos).toHaveLength(1);
    expect(dossie.treinamentos[0].nome).toBe('NR-18');
    expect(dossie.exames).toHaveLength(0);
    expect(dossie.epis).toHaveLength(0);
    expect(dossie.alocacoes).toHaveLength(0);
  });

  it('transfere o funcionário para outra obra e registra o histórico', async () => {
    const updateAloc = jest.fn().mockResolvedValue({});
    const createAloc = jest.fn().mockResolvedValue({ id: 'a2' });
    const pessoa = {
      id: 'f1',
      empresaId: 'emp-1',
      obraId: 'obra-1',
      nome: 'João da Silva',
      funcao: 'Pedreiro',
      ativo: true,
      cpf: null,
      pis: null,
      salario: null,
    };
    const { rh } = makeSvc({
      funcionario: {
        findFirst: jest.fn().mockResolvedValue(pessoa),
        update: jest.fn().mockResolvedValue({ ...pessoa, obraId: 'obra-2' }),
      },
      alocacaoFuncionario: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'a1',
          obraId: 'obra-1',
          dataInicio: new Date('2026-01-10T12:00:00.000Z'),
        }),
        findMany: jest.fn().mockResolvedValue([]),
        create: createAloc,
        update: updateAloc,
      },
      treinamentoFuncionario: { findMany: jest.fn().mockResolvedValue([]) },
      exameFuncionario: { findMany: jest.fn().mockResolvedValue([]) },
      movimentoEstoque: { findMany: jest.fn().mockResolvedValue([]) },
    });
    await rh.alocar('emp-1', 'user-1', 'f1', { obraId: 'obra-2', dataInicio: '2026-11-19' });
    expect(updateAloc).toHaveBeenCalled();
    expect(createAloc).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          empresaId: 'emp-1',
          funcionarioId: 'f1',
          obraId: 'obra-2',
        }),
      }),
    );
  });

  it('recusa relatório sem funcionário', async () => {
    const { rh } = makeSvc();
    await expect(rh.relatorioPessoalPdf('emp-1', 'user-1', '')).rejects.toThrow(/pelo menos um/i);
  });
});
