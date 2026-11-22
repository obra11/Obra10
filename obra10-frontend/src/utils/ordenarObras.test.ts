import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inserirObraAntesDe, moverObraNaLista } from './ordenarObras.ts';

const obras = (nomes: string[]) => nomes.map((nome) => ({ id: nome, nome }));
const ids = (lista: { id: string }[]) => lista.map((o) => o.id);

describe('moverObraNaLista', () => {
  it('agrupa itens filtrados ao subir um que estava separado', () => {
    const todas = obras(['naval-a', 'outra', 'naval-c']);
    const visiveis = obras(['naval-a', 'naval-c']);
    const next = moverObraNaLista(todas, visiveis, 'naval-c', -1);
    assert.deepEqual(ids(next), ['naval-c', 'naval-a', 'outra']);
  });

  it('agrupa itens filtrados ao descer o primeiro do grupo', () => {
    const todas = obras(['naval-a', 'outra', 'naval-c']);
    const visiveis = obras(['naval-a', 'naval-c']);
    const next = moverObraNaLista(todas, visiveis, 'naval-a', 1);
    assert.deepEqual(ids(next), ['outra', 'naval-c', 'naval-a']);
  });

  it('não move além das pontas da lista visível', () => {
    const todas = obras(['a', 'b']);
    const visiveis = obras(['a', 'b']);
    assert.deepEqual(ids(moverObraNaLista(todas, visiveis, 'a', -1)), ['a', 'b']);
    assert.deepEqual(ids(moverObraNaLista(todas, visiveis, 'b', 1)), ['a', 'b']);
  });
});

describe('inserirObraAntesDe', () => {
  it('arrasta um item para ficar imediatamente antes do alvo', () => {
    const todas = obras(['a', 'b', 'c', 'd']);
    const next = inserirObraAntesDe(todas, 'd', 'b');
    assert.deepEqual(ids(next), ['a', 'd', 'b', 'c']);
  });

  it('ignora soltar no próprio item', () => {
    const todas = obras(['a', 'b']);
    assert.deepEqual(ids(inserirObraAntesDe(todas, 'a', 'a')), ['a', 'b']);
  });
});
