import {
  chaveDataISO,
  clampPercentual,
  ehFotoEvolucao,
  montarTimelineEvolucao,
  parseDateOnly,
} from './obra-evolucao.helper';

describe('obra-evolucao.helper', () => {
  describe('chaveDataISO', () => {
    it('usa o calendário UTC da data de referência', () => {
      expect(chaveDataISO(new Date('2026-08-20T00:00:00.000Z'))).toBe(
        '2026-08-20',
      );
    });

    it('retorna null para valor inválido', () => {
      expect(chaveDataISO('nao-e-data')).toBeNull();
      expect(chaveDataISO(null)).toBeNull();
    });
  });

  describe('parseDateOnly', () => {
    it('converte YYYY-MM-DD para meio-dia UTC', () => {
      const d = parseDateOnly('2026-03-15');
      expect(d).toBeInstanceOf(Date);
      expect(d?.toISOString()).toBe('2026-03-15T12:00:00.000Z');
    });

    it('trata vazio como null e undefined como omitido', () => {
      expect(parseDateOnly('')).toBeNull();
      expect(parseDateOnly(null)).toBeNull();
      expect(parseDateOnly(undefined)).toBeUndefined();
    });
  });

  describe('clampPercentual', () => {
    it('limita entre 0 e 100', () => {
      expect(clampPercentual(-10)).toBe(0);
      expect(clampPercentual(140)).toBe(100);
      expect(clampPercentual(37.4)).toBe(37);
    });

    it('aceita limpar o valor', () => {
      expect(clampPercentual(null)).toBeNull();
      expect(clampPercentual('')).toBeNull();
      expect(clampPercentual(undefined)).toBeUndefined();
    });
  });

  describe('ehFotoEvolucao', () => {
    it('reconhece imagem por mime ou tipo', () => {
      expect(ehFotoEvolucao('image/jpeg', 'ANEXO_DIARIO')).toBe(true);
      expect(ehFotoEvolucao('application/pdf', 'FOTO_DIARIO')).toBe(true);
      expect(ehFotoEvolucao('video/mp4', 'VIDEO_DIARIO')).toBe(false);
    });
  });

  describe('montarTimelineEvolucao', () => {
    const rdos = [
      {
        id: 'rdo-1',
        dataReferencia: new Date('2026-08-01T12:00:00.000Z'),
        status: 'APROVADO',
        atividades: ['Alvenaria 1º pavimento', ''],
      },
      {
        id: 'rdo-2',
        dataReferencia: new Date('2026-08-10T12:00:00.000Z'),
        status: 'SUBMETIDO',
        atividades: ['Concretagem da laje'],
      },
    ];

    it('agrupa fotos pelo dia do RDO e ordena do mais recente', () => {
      const { dias, resumo } = montarTimelineEvolucao(rdos, [
        {
          id: 'f1',
          rdoId: 'rdo-1',
          urlS3: 'https://cdn.example/a.jpg',
          mimeType: 'image/jpeg',
          tipoArquivo: 'FOTO_DIARIO',
          nomeOriginal: 'alvenaria',
          createdAt: new Date('2026-08-01T18:00:00.000Z'),
          criadorNome: 'Mestre',
        },
        {
          id: 'f2',
          rdoId: 'rdo-2',
          urlS3: 'https://cdn.example/b.jpg',
          mimeType: 'image/jpeg',
          tipoArquivo: 'FOTO_DIARIO',
          nomeOriginal: 'laje',
          createdAt: new Date('2026-08-10T18:00:00.000Z'),
          criadorNome: 'Técnico',
        },
        {
          id: 'video',
          rdoId: 'rdo-2',
          urlS3: 'https://cdn.example/c.mp4',
          mimeType: 'video/mp4',
          tipoArquivo: 'VIDEO_DIARIO',
          nomeOriginal: 'drone',
          createdAt: new Date('2026-08-10T19:00:00.000Z'),
        },
      ]);

      expect(dias.map((d) => d.data)).toEqual(['2026-08-10', '2026-08-01']);
      expect(dias[0].fotos).toHaveLength(1);
      expect(dias[0].fotos[0].legenda).toBe('laje');
      expect(dias[0].atividades).toEqual(['Concretagem da laje']);
      expect(resumo.totalFotos).toBe(2);
      expect(resumo.totalDiasComFoto).toBe(2);
      expect(resumo.primeiraData).toBe('2026-08-01');
      expect(resumo.ultimaData).toBe('2026-08-10');
    });

    it('ignora fotos de RDO que não pertence à lista', () => {
      const { resumo } = montarTimelineEvolucao(rdos, [
        {
          id: 'x',
          rdoId: 'rdo-outro',
          urlS3: 'https://cdn.example/x.jpg',
          mimeType: 'image/jpeg',
          tipoArquivo: 'FOTO_DIARIO',
          createdAt: new Date(),
        },
      ]);
      expect(resumo.totalFotos).toBe(0);
    });
  });
});
