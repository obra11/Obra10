import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarNomeObra, obraComMesmoNome } from './nomeObra.ts';

describe('normalizarNomeObra', () => {
  it('trata Condominio e Condomínio como o mesmo nome', () => {
    assert.equal(normalizarNomeObra('Condominio Bosque Azul'), 'condominio bosque azul');
    assert.equal(normalizarNomeObra('Condomínio bosque azul'), 'condominio bosque azul');
  });
});

describe('obraComMesmoNome', () => {
  it('acha a obra já cadastrada mesmo com acento diferente', () => {
    const existente = obraComMesmoNome(
      [{ id: '1', nome: 'Condominio Bosque Azul' }],
      'Condomínio bosque azul',
    );
    assert.equal(existente?.id, '1');
  });
});
