import { normalizarDescricao, similaridade, sugerirInsumos } from './estoque-match';

const CIMENTO = { id: 'ins-cimento', nome: 'Cimento Portland CP-II', ean: '7891000000001' };
const AREIA = { id: 'ins-areia', nome: 'Areia Média', ean: null };
const DETERGENTE = { id: 'ins-det', nome: 'Detergente neutro', ean: null };

describe('normalizarDescricao', () => {
  it('iguala variações de pontuação, acento e unidade colada', () => {
    expect(normalizarDescricao('Cimento CP-II 50kg')).toBe(
      normalizarDescricao('Cimento CP II 50 kg'),
    );
  });
});

describe('sugerirInsumos', () => {
  const insumos = [CIMENTO, AREIA, DETERGENTE];

  it('aponta o mesmo item quando o EAN já está no cadastro', () => {
    const candidatos = sugerirInsumos({
      descricao: 'CIM PORTLAND 50KG LOJA B',
      ean: '7891000000001',
      insumos,
      aliases: [],
    });
    expect(candidatos[0]).toMatchObject({
      insumoId: 'ins-cimento',
      motivo: 'EAN',
      score: 1,
    });
  });

  it('reconhece apelido gravado mesmo com o texto um pouco diferente', () => {
    const norm = normalizarDescricao('Cimento CP-II 50 kg');
    const candidatos = sugerirInsumos({
      descricao: 'Cimento CP-II 50kg',
      insumos,
      aliases: [{ insumoId: 'ins-cimento', descricaoNormalizada: norm }],
    });
    expect(candidatos[0]).toMatchObject({
      insumoId: 'ins-cimento',
      motivo: 'ALIAS',
    });
  });

  it('sugere o item parecido entre fornecedores e não vincula sozinho', () => {
    const candidatos = sugerirInsumos({
      descricao: 'cim portland II saco',
      insumos,
      aliases: [],
    });
    expect(candidatos[0]?.insumoId).toBe('ins-cimento');
    expect(candidatos[0]?.motivo).toBe('SIMILAR');
    expect(candidatos[0]?.score).toBeGreaterThanOrEqual(0.72);
    expect(similaridade('cim portland II saco', CIMENTO.nome)).toBeGreaterThanOrEqual(0.72);
  });

  it('não sugere item de outra família', () => {
    const candidatos = sugerirInsumos({
      descricao: 'Tijolo cerâmico 6 furos',
      insumos,
      aliases: [],
    });
    expect(candidatos.find((c) => c.insumoId === 'ins-cimento')).toBeUndefined();
  });

  it('a segunda nota com a mesma descrição cai no apelido do insumo já escolhido', () => {
    const primeira = 'Cimento CP-II 50kg Fornecedor A';
    const alias = normalizarDescricao(primeira);
    const candidatos = sugerirInsumos({
      descricao: 'Cimento CP-II 50kg Fornecedor A',
      insumos,
      aliases: [{ insumoId: 'ins-cimento', descricaoNormalizada: alias }],
    });
    expect(candidatos[0]).toMatchObject({ insumoId: 'ins-cimento', motivo: 'ALIAS' });
  });
});
