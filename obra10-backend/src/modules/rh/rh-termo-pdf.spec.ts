import { gerarPdfTermoEpi } from './rh-termo-pdf';

describe('PDF do termo de EPI', () => {
  it('gera um PDF com o nome de quem recebeu', async () => {
    const buffer = await gerarPdfTermoEpi({
      empresa: 'Lunardeli',
      local: 'Almoxarifado — Obra Centro',
      funcionario: 'Joao da Silva',
      funcao: 'Pedreiro',
      epi: 'Capacete',
      unidade: 'un',
      quantidade: 1,
      dataRecebimento: '2026-11-19',
      validadeEpi: '2027-11-19',
      ca: '12345',
      assinatura: null,
    });
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(400);
  });
});
