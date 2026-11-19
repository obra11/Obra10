import { gerarPdfDossie } from './rh-dossie-pdf';

describe('PDF do dossiê de pessoal', () => {
  it('gera um PDF formal com cadastro, treinamento e exame', async () => {
    const buffer = await gerarPdfDossie({
      empresa: 'Estrutural',
      documento: '12.345.678/0001-90',
      emitidoEm: '19/11/2026 13:00',
      pessoas: [
        {
          nome: 'Joao da Silva',
          funcao: 'Pedreiro',
          ativo: true,
          cpf: '111.444.777-35',
          dataAdmissao: '2024-02-01',
          tipoContrato: 'CLT',
          obraNome: 'Condominio gramado',
          treinamentos: [
            {
              nome: 'NR-18',
              tipo: 'RECORRENTE',
              dataRealizacao: '2026-01-10',
              validade: '2027-01-10',
              situacao: 'VIGENTE',
              cargaHoraria: 8,
            },
          ],
          exames: [
            {
              nome: 'ASO',
              tipo: 'PERIODICO',
              dataRealizacao: '2026-01-05',
              validade: '2027-01-05',
              situacao: 'VIGENTE',
              resultado: 'APTO',
            },
          ],
          epis: [
            {
              nome: 'Capacete',
              quantidade: '1',
              dataRecebimento: '2026-01-12',
              validadeEpi: '2027-01-12',
              ca: '12345',
              situacao: 'VIGENTE',
            },
          ],
        },
      ],
    });
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(600);
  });

  it('gera um PDF com mais de um funcionario', async () => {
    const buffer = await gerarPdfDossie({
      empresa: 'Estrutural',
      emitidoEm: '19/11/2026 13:00',
      pessoas: [
        {
          nome: 'Maria',
          funcao: 'Encarregada',
          ativo: true,
          treinamentos: [],
          exames: [],
          epis: [],
        },
        {
          nome: 'Pedro',
          funcao: 'Servente',
          ativo: true,
          treinamentos: [],
          exames: [],
          epis: [],
        },
      ],
    });
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(700);
  });
});
