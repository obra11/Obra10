import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSupportWhatsAppMessage,
  normalizeWhatsAppPhone,
  supportWhatsAppUrl,
} from './whatsappSupport.ts';

describe('whatsappSupport', () => {
  it('normaliza DDD brasileiro com DDI 55', () => {
    assert.equal(normalizeWhatsAppPhone('48984047797'), '5548984047797');
    assert.equal(normalizeWhatsAppPhone('55 48 98404-7797'), '5548984047797');
  });

  it('monta a mensagem do chamado com identificação', () => {
    const msg = buildSupportWhatsAppMessage({
      nome: 'Maria',
      email: 'maria@ex.com',
      empresa: 'Estrutural',
      assunto: 'Não consigo excluir a obra',
      categoria: 'TECNICO',
      descricao: 'Aperte confirmar e nada acontece',
      chamadoId: 'abc-123',
      appVersion: 'Versão 2.9.66',
    });
    assert.match(msg, /Maria \(maria@ex.com\) da empresa Estrutural/);
    assert.match(msg, /Chamado: Não consigo excluir a obra/);
    assert.match(msg, /ID do chamado: abc-123/);
    assert.match(msg, /Versão 2.9.66/);
  });

  it('gera wa.me com o texto na query', () => {
    const url = supportWhatsAppUrl('Olá', '5548984047797');
    assert.equal(url.startsWith('https://wa.me/5548984047797?text='), true);
    assert.equal(url.includes(encodeURIComponent('Olá')), true);
  });
});
