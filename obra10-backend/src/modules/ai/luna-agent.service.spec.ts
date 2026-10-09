import { buildLunaSystemPrompt, LUNA_SYSTEM_PROMPT } from './luna-agent.service';

describe('Luna assessora (persona + escopo empresa)', () => {
  it('define assessora com tools, empresa inteira e ajuda_obra10', () => {
    expect(LUNA_SYSTEM_PROMPT).toMatch(/assessora/i);
    expect(LUNA_SYSTEM_PROMPT).toContain('EMPRESA INTEIRA');
    expect(LUNA_SYSTEM_PROMPT).toContain('ajuda_obra10');
    expect(LUNA_SYSTEM_PROMPT).toMatch(/não limite|não uma prisão|listar_obras/i);
    expect(LUNA_SYSTEM_PROMPT).toMatch(/propor_ajuste/);
    expect(LUNA_SYSTEM_PROMPT).toMatch(/não grava nada sozinha/i);
    expect(LUNA_SYSTEM_PROMPT).toContain('buscar_no_aplicativo');
  });

  it('trata a obra do header só como tela atual', () => {
    const prompt = buildLunaSystemPrompt('obra-victoria');
    expect(prompt).toContain('obra-victoria');
    expect(prompt).toMatch(/não limite a busca/i);
    expect(prompt).toMatch(/Hoje \(UTC\): \d{4}-\d{2}-\d{2}/);
  });

  it('sem header, pede consulta da empresa', () => {
    const prompt = buildLunaSystemPrompt(null);
    expect(prompt).toMatch(/não está dentro de uma obra/i);
  });
});
