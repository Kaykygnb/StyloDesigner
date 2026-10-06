import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, defaultFill, defaultShadow, defaultStroke, fitGroups, cloneNode, scaleNode } from '../src/model.js';
import { nodeStyle, rgba, exportHtml, generateCode } from '../src/css.js';
import { buildSample } from '../src/sample.js';

test('rgba converte hex e opacidade', () => {
  assert.equal(rgba('#ff0000', 1), '#ff0000');
  assert.equal(rgba('#f00', 0.5), 'rgba(255, 0, 0, 0.5)');
});

test('nó livre vira position:absolute com left/top', () => {
  const n = createNode('rect', { x: 10, y: 20, w: 50, h: 60 });
  const s = nodeStyle(n, null);
  assert.equal(s.position, 'absolute');
  assert.equal(s.left, '10px');
  assert.equal(s.top, '20px');
  assert.equal(s.width, '50px');
  assert.equal(s['background-color'], '#d9d9d9');
});

test('frame com auto layout vira display:flex', () => {
  const f = createNode('frame');
  f.layout = { mode: 'column', gap: 12, padding: [8, 16, 8, 16], justify: 'center', align: 'flex-start', wrap: false };
  const s = nodeStyle(f, null);
  assert.equal(s.display, 'flex');
  assert.equal(s['flex-direction'], 'column');
  assert.equal(s.gap, '12px');
  assert.equal(s.padding, '8px 16px 8px 16px');
  assert.equal(s['justify-content'], 'center');
  assert.equal(s.overflow, 'hidden');
});

test('filho em fluxo usa flex e fill estica', () => {
  const parent = createNode('frame');
  parent.layout.mode = 'row';
  const child = createNode('rect', { sizeX: 'fill', sizeY: 'fixed', h: 40 });
  const s = nodeStyle(child, parent);
  assert.equal(s.position, 'relative');
  assert.equal(s.flex, '1 1 0%');
  assert.equal(s.left, undefined);
  assert.equal(s.height, '40px');
  const crossFill = nodeStyle(createNode('rect', { sizeY: 'fill' }), parent);
  assert.equal(crossFill['align-self'], 'stretch');
  assert.equal(crossFill.height, 'auto');
});

test('filho absoluto dentro de auto layout ignora o fluxo', () => {
  const parent = createNode('frame');
  parent.layout.mode = 'row';
  const s = nodeStyle(createNode('rect', { absolute: true, x: 5, y: 6 }), parent);
  assert.equal(s.position, 'absolute');
  assert.equal(s.left, '5px');
});

test('efeitos: sombra, blur, backdrop, rotação, contorno', () => {
  const n = createNode('rect', {
    shadows: [{ ...defaultShadow(), x: 1, y: 2, blur: 3, spread: 4, color: '#000000', opacity: 0.5 }],
    blur: 4, bgBlur: 10, rotation: 45, opacity: 0.8,
    stroke: { ...defaultStroke(), width: 2, position: 'outside', style: 'dashed' },
  });
  const s = nodeStyle(n, null);
  assert.equal(s['box-shadow'], '1px 2px 3px 4px rgba(0, 0, 0, 0.5)');
  assert.equal(s.filter, 'blur(4px)');
  assert.equal(s['backdrop-filter'], 'blur(10px)');
  assert.equal(s.transform, 'rotate(45deg)');
  assert.equal(s.opacity, '0.8');
  assert.equal(s.outline, '2px dashed #000000');
  assert.equal(s['outline-offset'], '0px');
});

test('gradiente e texto com gradiente', () => {
  const fill = { ...defaultFill(), type: 'linear', angle: 90 };
  const r = createNode('rect', { fill });
  assert.match(nodeStyle(r, null)['background-image'], /^linear-gradient\(90deg, #7c5cff 0%, #2dd4ff 100%\)$/);
  const t = createNode('text', { fill });
  const s = nodeStyle(t, null);
  assert.equal(s['background-clip'], 'text');
  assert.equal(s.color, 'transparent');
});

test('elipse usa border-radius 50%', () => {
  assert.equal(nodeStyle(createNode('ellipse'), null)['border-radius'], '50%');
});

test('fitGroups ajusta o grupo aos filhos e remove vazios', () => {
  const a = createNode('rect', { x: 10, y: 10, w: 20, h: 20 });
  const b = createNode('rect', { x: 50, y: 40, w: 10, h: 10 });
  const g = createNode('group', { x: 100, y: 100 });
  g.children = [a, b];
  const empty = createNode('group');
  const list = [g, empty];
  fitGroups(list);
  assert.equal(list.length, 1);
  assert.deepEqual([g.x, g.y, g.w, g.h], [110, 110, 50, 40]);
  assert.deepEqual([a.x, a.y, b.x, b.y], [0, 0, 40, 30]);
});

test('cloneNode gera ids novos em toda a árvore', () => {
  const g = createNode('group');
  g.children = [createNode('rect')];
  const c = cloneNode(g);
  assert.notEqual(c.id, g.id);
  assert.notEqual(c.children[0].id, g.children[0].id);
});

test('scaleNode escala grupos recursivamente', () => {
  const g = createNode('group', { x: 0, y: 0, w: 100, h: 100 });
  g.children = [createNode('rect', { x: 50, y: 50, w: 50, h: 50 })];
  scaleNode(g, 2, 0.5);
  assert.deepEqual([g.w, g.h], [200, 50]);
  assert.deepEqual([g.children[0].x, g.children[0].w, g.children[0].h], [100, 100, 25]);
});

test('exportHtml gera documento completo e classes únicas', () => {
  const doc = buildSample();
  const html = exportHtml(doc.pages[0].children[0], {}, 'Hero');
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /display: flex;/);
  assert.match(html, /<p class="/);
  const { css } = generateCode(doc.pages[0].children, null);
  const classes = [...css.matchAll(/^\.([\w-]+) \{/gm)].map((m) => m[1]);
  assert.equal(new Set(classes).size, classes.length);
});

test('texto é escapado no HTML exportado', () => {
  const t = createNode('text', { text: '<b>"oi" & tchau</b>' });
  const { html } = generateCode([t], null);
  assert.ok(html.includes('&lt;b&gt;&quot;oi&quot; &amp; tchau&lt;/b&gt;'));
});
