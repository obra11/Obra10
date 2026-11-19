import { percentualAtividade, rotuloStatusAtividade } from './rdo-atividade-status';

describe('percentual da atividade em andamento', () => {
  it('aceita 0 a 100 e arredonda', () => {
    expect(percentualAtividade('45')).toBe(45);
    expect(percentualAtividade(45.6)).toBe(46);
    expect(percentualAtividade('')).toBeNull();
    expect(percentualAtividade(150)).toBe(100);
    expect(percentualAtividade(-3)).toBe(0);
  });

  it('mostra o percentual só em andamento', () => {
    expect(rotuloStatusAtividade('em andamento', 40)).toBe('EM ANDAMENTO 40%');
    expect(rotuloStatusAtividade('em andamento')).toBe('EM ANDAMENTO');
    expect(rotuloStatusAtividade('pausado', 40)).toBe('PAUSADO');
    expect(rotuloStatusAtividade('finalizada', 100)).toBe('FINALIZADA');
  });
});
