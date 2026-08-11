import {
  detectarConsultaOnline,
  detectarEscopo,
  detectarIntencaoFactual,
  formatarDataISO,
  inferirPeriodo,
  responderFactual,
  type ContextoAgregado,
} from './ai-context.helper';

const AGORA = new Date(2026, 7, 11, 15, 0, 0); // 11/08/2026

function ctxBase(parcial: Partial<ContextoAgregado> = {}): ContextoAgregado {
  return {
    escopo: 'obra',
    obraId: 'obra-1',
    obraNome: 'VICTORIA RESIDENCE',
    dataInicio: '2015-01-01',
    dataFim: '2026-08-11',
    periodoLabel: 'desde o início até hoje',
    totalRdos: 3,
    aprovados: 1,
    submetidos: 0,
    rascunhos: 2,
    rejeitados: 0,
    porStatus: { APROVADO: 1, RASCUNHO: 2 },
    diasChuva: 0,
    datasChuva: [],
    diasSol: 2,
    diasNublado: 1,
    diasOutros: 0,
    mediaEfetivo: 5,
    totalEfetivoAcumulado: 15,
    profissionaisMap: { Pedreiro: 9, Servente: 6 },
    topAtividades: [{ item: 'Alvenaria', count: 2 }],
    topPendencias: [{ item: 'Espera de material', count: 1 }],
    dias: [],
    obrasNomes: ['VICTORIA RESIDENCE'],
    ...parcial,
  };
}

describe('inferirPeriodo', () => {
  it('até hoje = desde o início (não só o dia de hoje)', () => {
    const p = inferirPeriodo(
      'quantos relatórios foram executados até hoje',
      AGORA,
    );
    expect(p.label).toBe('desde o início até hoje');
    expect(formatarDataISO(p.dataInicio)).toBe('2015-01-01');
    expect(formatarDataISO(p.dataFim)).toBe('2026-08-11');
  });

  it('hoje isolado = só o dia atual', () => {
    const p = inferirPeriodo('quantos RDOs hoje', AGORA);
    expect(p.label).toBe('hoje');
    expect(formatarDataISO(p.dataInicio)).toBe('2026-08-11');
  });

  it('desde o início', () => {
    expect(inferirPeriodo('total de diários desde o início', AGORA).label).toBe(
      'desde o início até hoje',
    );
  });

  it('últimos 7 dias', () => {
    const p = inferirPeriodo('chuva nos últimos 7 dias', AGORA);
    expect(p.label).toBe('últimos 7 dias');
    expect(formatarDataISO(p.dataInicio)).toBe('2026-08-05');
  });

  it('este mês', () => {
    expect(inferirPeriodo('efetivo neste mês', AGORA).label).toBe('este mês');
  });

  it('ontem', () => {
    expect(inferirPeriodo('choveu ontem?', AGORA).label).toBe('ontem');
  });
});

describe('detectarIntencaoFactual', () => {
  const casos: Array<[string, string]> = [
    ['quantos relatórios foram executados até hoje', 'status_rdos'],
    ['quantos diários temos no total?', 'status_rdos'],
    ['quantos RDOs aprovados?', 'status_rdos'],
    ['quantos dias de chuva no mês?', 'chuva_clima'],
    ['qual o efetivo médio?', 'efetivo'],
    ['quais atividades foram executadas?', 'atividades'],
    ['há pendências na obra?', 'pendencias'],
    ['quais obras ativas?', 'obras'],
  ];

  it.each(casos)('%s → %s', (pergunta, esperado) => {
    expect(detectarIntencaoFactual(pergunta)).toBe(esperado);
  });
});

describe('detectarEscopo', () => {
  it('com obra ativa e pergunta local → obra', () => {
    expect(detectarEscopo('quantos RDOs até hoje', 'obra-1')).toBe('obra');
  });

  it('pedido consolidado → empresa', () => {
    expect(detectarEscopo('em todas as obras, quantos RDOs?', 'obra-1')).toBe(
      'empresa',
    );
  });
});

describe('detectarConsultaOnline', () => {
  it('detecta pedido explícito', () => {
    expect(detectarConsultaOnline('pesquise online o que é NBR 6118')).toBe(
      true,
    );
    expect(detectarConsultaOnline('busca na web cotação do aço CA-50')).toBe(
      true,
    );
  });

  it('não dispara em pergunta operacional de obra', () => {
    expect(
      detectarConsultaOnline('quantos relatórios foram executados até hoje'),
    ).toBe(false);
  });
});

describe('responderFactual — perguntas comuns', () => {
  it('contagem até hoje', () => {
    const r = responderFactual(
      'status_rdos',
      ctxBase(),
      'quantos relatórios foram executados até hoje',
    );
    expect(r).toContain('Total de diários: 3');
    expect(r).toContain('VICTORIA RESIDENCE');
  });

  it('chuva', () => {
    const r = responderFactual('chuva_clima', ctxBase(), 'quantos dias de chuva?');
    expect(r).toContain('0 dia(s)');
  });

  it('efetivo', () => {
    const r = responderFactual('efetivo', ctxBase(), 'qual o efetivo?');
    expect(r).toContain('Média diária: 5');
    expect(r).toContain('Pedreiro');
  });

  it('sem RDO no período — mensagem clara', () => {
    const r = responderFactual(
      'status_rdos',
      ctxBase({ totalRdos: 0, aprovados: 0, rascunhos: 0 }),
      'quantos RDOs hoje',
    );
    expect(r).toMatch(/Não encontrei diários/);
  });
});
