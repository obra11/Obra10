import { selecionarTrechos } from './luna-busca';

describe('buscar no aplicativo', () => {
  const consulta = 'quando foi concretada a laje do terceiro pavimento';
  const victoria = {
    empresaId: 'emp-1',
    obraId: 'o1',
    obraNome: 'Victoria',
    data: '2026-03-12',
    status: 'APROVADO',
    rdoId: 'r1',
    origem: 'atividade',
    texto: 'Concretagem da laje do terceiro pavimento',
  };
  const outraEmpresa = {
    ...victoria,
    empresaId: 'emp-2',
    obraId: 'o9',
    obraNome: 'Acme',
    data: '2026-01-02',
    rdoId: 'r9',
  };

  it('acha a laje na obra certa e esconde a outra empresa', () => {
    const out = selecionarTrechos(consulta, 'emp-1', [outraEmpresa, victoria]);
    expect(out.achados).toHaveLength(1);
    expect(out.achados[0].obra).toBe('Victoria');
    expect(out.achados[0].data).toBe('2026-03-12');
    expect(out.achados[0].trecho).toMatch(/terceiro pavimento/i);
  });

  it('não devolve trecho de outra empresa mesmo com o mesmo texto', () => {
    const out = selecionarTrechos(consulta, 'emp-1', [outraEmpresa]);
    expect(out.achados).toHaveLength(0);
  });
});
