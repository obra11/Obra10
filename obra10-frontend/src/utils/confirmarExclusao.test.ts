import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { confirmouExclusao } from './confirmarExclusao.ts';

describe('confirmouExclusao', () => {
  it('aceita EXCLUIR em qualquer caixa, com espaço ou pontuação', () => {
    assert.equal(confirmouExclusao('EXCLUIR'), true);
    assert.equal(confirmouExclusao('excluir'), true);
    assert.equal(confirmouExclusao('Excluir'), true);
    assert.equal(confirmouExclusao(' EXCLUIR '), true);
    assert.equal(confirmouExclusao('EXCLUIR.'), true);
    assert.equal(confirmouExclusao('excluir!'), true);
  });

  it('rejeita vazio ou outra palavra', () => {
    assert.equal(confirmouExclusao(''), false);
    assert.equal(confirmouExclusao('excluir obra'), false);
    assert.equal(confirmouExclusao('APAGAR'), false);
  });
});
