import {
  idsDuplicatasVaziasParaExcluir,
  normalizarNomeObra,
  type ObraDuplicata,
} from './nome-obra';

function obra(
  partial: Partial<ObraDuplicata> & Pick<ObraDuplicata, 'id' | 'nome'>,
): ObraDuplicata {
  return {
    empresaId: 'estrutural',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    rdos: 0,
    anexos: 0,
    funcionarios: 0,
    treinamentos: 0,
    alocacoes: 0,
    ...partial,
  };
}

describe('normalizarNomeObra', () => {
  it('trata Condominio e Condomínio como o mesmo nome', () => {
    expect(normalizarNomeObra('Condominio Bosque Azul')).toBe(
      'condominio bosque azul',
    );
    expect(normalizarNomeObra('Condomínio bosque azul')).toBe(
      'condominio bosque azul',
    );
  });

  it('ignora espaços e pontuação extra', () => {
    expect(normalizarNomeObra('  Condomínio   Bosque-Azul  ')).toBe(
      'condominio bosque azul',
    );
  });
});

describe('idsDuplicatasVaziasParaExcluir', () => {
  it('apaga a vazia e mantém a que tem RDO', () => {
    const ids = idsDuplicatasVaziasParaExcluir([
      obra({
        id: 'com-rdo',
        nome: 'Condominio Bosque Azul',
        rdos: 4,
        createdAt: new Date('2026-11-01T00:00:00.000Z'),
      }),
      obra({
        id: 'vazia',
        nome: 'Condomínio bosque azul',
        createdAt: new Date('2026-11-27T12:00:00.000Z'),
      }),
    ]);
    expect(ids).toEqual(['vazia']);
  });

  it('se as duas estão vazias, mantém a mais antiga', () => {
    const ids = idsDuplicatasVaziasParaExcluir([
      obra({
        id: 'nova',
        nome: 'Condomínio bosque azul',
        createdAt: new Date('2026-11-27T12:00:00.000Z'),
      }),
      obra({
        id: 'antiga',
        nome: 'Condominio Bosque Azul',
        createdAt: new Date('2026-11-01T00:00:00.000Z'),
      }),
    ]);
    expect(ids).toEqual(['nova']);
  });

  it('não apaga obras de empresas diferentes nem nomes distintos', () => {
    const ids = idsDuplicatasVaziasParaExcluir([
      obra({
        id: 'a',
        empresaId: 'e1',
        nome: 'Bosque Azul',
        rdos: 1,
      }),
      obra({
        id: 'b',
        empresaId: 'e2',
        nome: 'Bosque Azul',
      }),
      obra({ id: 'c', nome: 'Outra Obra' }),
    ]);
    expect(ids).toEqual([]);
  });

  it('não apaga duplicata que também tem conteúdo', () => {
    const ids = idsDuplicatasVaziasParaExcluir([
      obra({ id: 'a', nome: 'Bosque Azul', rdos: 2 }),
      obra({ id: 'b', nome: 'Bosque Azul', anexos: 1 }),
    ]);
    expect(ids).toEqual([]);
  });
});
