// Bugs menores do núcleo: reproduzidos primeiro, corrigidos depois.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safePageCss, scopePageCss } from '../src/html.js';

test('CSS nesting na página não quebra as regras vizinhas nem gera "&: hover"', () => {
  const css = '.a { color: red; &:hover { color: blue; } }\n.b { color: green; }';
  for (const out of [safePageCss(css), scopePageCss(css)]) {
    assert.ok(!/&:\s/.test(out), out);
    assert.equal((out.match(/{/g) || []).length, (out.match(/}/g) || []).length, out);
    assert.match(out, /color: green/);
    assert.match(out, /\.b/);
  }
});

import { parseCustomCss } from '../src/css.js';

test('parseCustomCss: ";" dentro de url()/aspas não separa; "/*" sem fechar é descartado', () => {
  const r = parseCustomCss('background: url(data:image/png;base64,AAA); color: red');
  assert.equal(r.background, 'url(data:image/png;base64,AAA)');
  assert.equal(r.color, 'red');
  assert.equal(parseCustomCss('content: "a;b"; color: red').content, '"a;b"');
  const open = parseCustomCss('color: red; /* sem fim; width: 10px');
  assert.deepEqual(open, { color: 'red' });
});

import { createStore } from '../src/store.js';
import { makeDoc, createNode } from '../src/model.js';
import { createCommands } from '../src/commands.js';

test('colar: camada copiada que ainda existe noutra página vai para a página atual', () => {
  const store = createStore({ initial: { doc: makeDoc() }, persist: () => Promise.resolve() });
  const box = createNode('frame', { name: 'A', w: 10, h: 10 });
  const outer = createNode('frame', { name: 'Pai', w: 100, h: 100 });
  outer.children.push(box);
  store.page().children.push(outer);
  store.touch();
  const cmds = createCommands(store, { unionAabb: () => null });
  const firstPage = store.page();
  store.setSelection([box.id]);
  cmds.copy();
  store.addPage();
  const second = store.page();
  assert.notEqual(second.id, firstPage.id);
  cmds.paste();
  assert.equal(second.children.length, 1, 'colou na página atual');
  assert.equal(outer.children.length, 1, 'não colou dentro do pai da outra página');
});

import { generateCode } from '../src/css.js';

test('visible indefinido = visível no gerador de código (igual ao site-export)', () => {
  const n = createNode('frame', { name: 'Caixa', w: 10, h: 10 });
  delete n.visible;
  const g = generateCode([n], null, {}, { root: true });
  assert.ok(g.html.trim() && g.css.includes('10px'), 'camada sem "visible" deve sair no código');
  const h = createNode('frame', { name: 'Oculta', w: 10, h: 10, visible: false });
  assert.equal(generateCode([h], null, {}, { root: true }).html.trim(), '');
});

import { applyLayerCss } from '../src/cssedit.js';

test('applyLayerCss: !important do CSS livre sobrevive até o código gerado', () => {
  const n = createNode('frame', { name: 'A', w: 10, h: 10 });
  applyLayerCss(n, null, {}, 'cursor: pointer !important;');
  assert.match(n.customCss, /cursor: pointer !important;/);
  assert.match(generateCode([n], null, {}, { root: true }).css, /cursor: pointer !important;/);
});
