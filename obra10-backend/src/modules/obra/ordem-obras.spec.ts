import { mesclarOrdemObras } from './ordem-obras';

describe('mesclarOrdemObras', () => {
  it('substitui só o subconjunto reordenado, mantendo as demais no lugar', () => {
    expect(mesclarOrdemObras(['a', 'b', 'c', 'd'], ['c', 'a'])).toEqual([
      'c',
      'b',
      'a',
      'd',
    ]);
  });

  it('aceita a lista completa na nova ordem', () => {
    expect(mesclarOrdemObras(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('ignora ids que não existem na empresa', () => {
    expect(mesclarOrdemObras(['a', 'b'], ['x', 'b', 'a'])).toEqual(['b', 'a']);
  });
});
