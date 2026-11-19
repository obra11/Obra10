import { BadRequestException } from '@nestjs/common';
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

function makeSvc() {
  const estoque = { listarLocais: jest.fn().mockResolvedValue({ locais: [] }) };
  const rh = new RhService({} as any, estoque as any, {} as any);
  return { rh, estoque };
}

describe('RhService.lerFicha', () => {
  beforeEach(() => {
    (lerVisaoLuna as jest.Mock).mockReset();
  });

  it('exige obra da empresa e não grava a foto', async () => {
    const { rh, estoque } = makeSvc();
    await expect(rh.lerFicha('emp-1', 'user-1', [foto])).rejects.toBeInstanceOf(BadRequestException);
    expect(estoque.listarLocais).not.toHaveBeenCalled();

    (lerVisaoLuna as jest.Mock).mockResolvedValue(JSON.stringify({
      nome: 'João da Silva',
      cpf: '11144477735',
      sexo: 'Masculino',
    }));
    const lida = await rh.lerFicha('emp-1', 'user-1', [foto], 'obra-1');
    expect(estoque.listarLocais).toHaveBeenCalledWith('emp-1', 'user-1', 'obra-1');
    expect(lida.ficha.nome).toBe('João da Silva');
    expect(lida.ficha.cpf).toBe('111.444.777-35');
    expect(lida.preenchidos).toContain('nome');
  });

  it('explica quando a Luna não está configurada', async () => {
    const { rh } = makeSvc();
    (lerVisaoLuna as jest.Mock).mockRejectedValue(new Error('SEM_CHAVE'));
    await expect(rh.lerFicha('emp-1', 'user-1', [foto], 'obra-1')).rejects.toThrow(
      /não está disponível/i,
    );
  });
});
