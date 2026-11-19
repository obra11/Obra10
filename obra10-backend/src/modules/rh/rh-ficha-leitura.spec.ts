import { jsonDaLuna, parsearFichaExtraida } from './rh-ficha-leitura';

describe('leitura da ficha', () => {
  it('preenche o que está legível e descarta CPF inválido', () => {
    const { ficha, preenchidos } = parsearFichaExtraida({
      nome: 'João da Silva',
      cpf: '111.444.777-35',
      dataNascimento: '12/03/1990',
      sexo: 'Masculino',
      nomeMae: 'Maria da Silva',
      cep: '01310-100',
      logradouro: 'Av. Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'sp',
      funcao: 'Pedreiro',
      dataAdmissao: '2024-01-15',
      tipoContrato: 'clt',
      salario: '2.500,00',
      pis: '123',
    });

    expect(ficha.nome).toBe('João da Silva');
    expect(ficha.cpf).toBe('111.444.777-35');
    expect(ficha.dataNascimento).toBe('1990-03-12');
    expect(ficha.sexo).toBe('MASCULINO');
    expect(ficha.cep).toBe('01310-100');
    expect(ficha.uf).toBe('SP');
    expect(ficha.tipoContrato).toBe('CLT');
    expect(ficha.salario).toBe('2500.00');
    expect(ficha.pis).toBe('');
    expect(preenchidos).toContain('nome');
    expect(preenchidos).not.toContain('pis');
  });

  it('não inventa campo vazio nem data impossível', () => {
    const { ficha, preenchidos } = parsearFichaExtraida({
      nome: 'A',
      dataNascimento: '99/99/9999',
      email: 'nao-e-email',
      sexo: 'desconhecido',
    });
    expect(ficha.nome).toBe('');
    expect(ficha.dataNascimento).toBe('');
    expect(ficha.email).toBe('');
    expect(ficha.sexo).toBe('');
    expect(preenchidos).toEqual([]);
  });

  it('lê JSON solto da Luna', () => {
    const bruto = jsonDaLuna('Olha: {"nome":"Ana Souza","sexo":"FEMININO"} fim');
    const { ficha } = parsearFichaExtraida(bruto);
    expect(ficha.nome).toBe('Ana Souza');
    expect(ficha.sexo).toBe('FEMININO');
  });
});
