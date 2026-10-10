// Exportar site: avisar quando uma tela de largura fixa vai rolar na horizontal em celular.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, makeDoc } from '../src/model.js';
import { exportSite } from '../src/site-export.js';

const docWith = (...boards) => {
  const doc = makeDoc();
  doc.pages[0].children.push(...boards);
  return doc;
};
const avisos = (doc) => exportSite(doc).warnings.filter((w) => /largura fixa/i.test(w));

test('tela de largura fixa maior que o celular gera aviso com o nome e a largura', () => {
  const w = avisos(docWith(createNode('frame', { name: 'Guia', w: 900, h: 500 })));
  assert.equal(w.length, 1);
  assert.match(w[0], /Guia/);
  assert.match(w[0], /900/);
});

test('tela com largura fluida não gera aviso', () => {
  assert.deepEqual(avisos(docWith(createNode('frame', { name: 'Home', w: 1440, h: 900, fluid: true }))), []);
});

test('tela que já cabe no celular não gera aviso', () => {
  assert.deepEqual(avisos(docWith(createNode('frame', { name: 'Cartão', w: 360, h: 200 }))), []);
});

test('tela que se ajusta ao conteúdo (hug) não gera aviso', () => {
  assert.deepEqual(avisos(docWith(createNode('frame', { name: 'Hug', w: 1200, h: 200, sizeX: 'hug' }))), []);
});

test('o menor breakpoint do PROJETO define o limite (celular de 480 px aceita tela de 480)', () => {
  const doc = docWith(createNode('frame', { name: 'Larga', w: 480, h: 300 }));
  doc.breakpoints = [{ id: 'mobile', name: 'Celular', max: 700, preview: 480 }];
  assert.deepEqual(avisos(doc), []);
  doc.pages[0].children[0].w = 481;
  assert.equal(avisos(doc).length, 1);
});
