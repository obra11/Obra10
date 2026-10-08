import { buscarAjuda, AJUDA_OBRA10 } from './luna-ajuda';

describe('ajuda_obra10', () => {
  it('devolve o mapa completo sem tema', () => {
    const texto = buscarAjuda();
    expect(texto).toContain('/relatorios');
    expect(texto).toContain('/dashboard');
    expect(texto).toContain('Relatório do dia');
    expect(texto).toContain('com fotos');
    expect(texto).toContain('/gestor/usuarios');
  });

  it('explica Relatórios de todas as obras', () => {
    const texto = buscarAjuda('relatorios');
    expect(texto.toLowerCase()).toContain('/relatorios');
    expect(texto.toLowerCase()).toMatch(/todas as obras|lista cronológica/);
  });

  it('explica criar e aprovar RDO', () => {
    const texto = buscarAjuda('rdo');
    expect(texto).toMatch(/Submeter/i);
    expect(texto).toMatch(/Aprovar/i);
    expect(texto).toMatch(/seções/i);
  });

  it('explica PDF com fotos', () => {
    const texto = buscarAjuda('pdf');
    expect(texto.toLowerCase()).toContain('fotos');
  });

  it('inclui conexão MCP para ChatGPT / Claude / Gemini', () => {
    expect(AJUDA_OBRA10).toContain('https://obra10.app.br/mcp');
    expect(AJUDA_OBRA10).toContain('/auth/token');
    expect(AJUDA_OBRA10).toMatch(/ChatGPT/);
    expect(AJUDA_OBRA10).toMatch(/Claude/);
    expect(AJUDA_OBRA10).toMatch(/Gemini/);
  });
});
