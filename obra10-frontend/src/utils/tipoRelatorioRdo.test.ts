import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  devePedirTipoRelatorio,
  devePersistirRascunhoLocal,
  tipoDeExtras,
  tituloTipoRelatorio,
} from './tipoRelatorioRdo.ts';

describe('tipoRelatorioRdo', () => {
  it('trata período só quando o campo é PERIODO', () => {
    assert.equal(tipoDeExtras({ tipoRelatorio: 'PERIODO' }), 'PERIODO');
    assert.equal(tipoDeExtras({ tipoRelatorio: 'DIA' }), 'DIA');
    assert.equal(tipoDeExtras({}), 'DIA');
  });

  it('pede o tipo enquanto ele não foi escolhido, inclusive ao trocar depois', () => {
    assert.equal(
      devePedirTipoRelatorio({ initLoading: false, tipoRelatorio: null }),
      true,
    );
    assert.equal(
      devePedirTipoRelatorio({ initLoading: true, tipoRelatorio: null }),
      false,
    );
    assert.equal(
      devePedirTipoRelatorio({ initLoading: false, tipoRelatorio: 'DIA' }),
      false,
    );
  });

  it('não grava rascunho local antes de escolher o tipo', () => {
    assert.equal(
      devePersistirRascunhoLocal({ tipoRelatorio: null, status: 'rascunho', isReadOnly: false }),
      false,
    );
    assert.equal(
      devePersistirRascunhoLocal({ tipoRelatorio: 'DIA', status: 'rascunho', isReadOnly: false }),
      true,
    );
  });

  it('usa título neutro até a escolha', () => {
    assert.equal(tituloTipoRelatorio(null), 'Novo relatório');
    assert.equal(tituloTipoRelatorio('PERIODO'), 'Relatório de período');
  });
});
