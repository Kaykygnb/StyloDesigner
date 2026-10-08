import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, defaultFill, defaultShadow, defaultStroke, fitGroups, cloneNode, scaleNode, resizeNode, applyLimits, limitSize } from '../src/model.js';
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

test('contorno por lado vira border-top/right/bottom/left (e "todos" continua sendo outline)', () => {
  const r = createNode('rect', { stroke: { color: '#FF0000', opacity: 1, width: 2, style: 'solid', position: 'inside', sides: [0, 0, 2, 1] } });
  const s = nodeStyle(r, null);
  assert.equal(s['border-bottom'], '2px solid #ff0000'); // rgba() escreve o hex em minúsculas
  assert.equal(s['border-left'], '1px solid #ff0000');
  assert.equal(s['border-top'], undefined);
  assert.equal(s.outline, undefined);
  delete r.stroke.sides;
  assert.match(nodeStyle(r, null).outline, /^2px solid/);
  const e = createNode('ellipse', { stroke: { color: '#000000', opacity: 1, width: 2, style: 'solid', position: 'inside', sides: [2, 0, 0, 0] } });
  assert.ok(nodeStyle(e, null).outline && !nodeStyle(e, null)['border-top'], 'elipse ignora lados (não faz sentido)');
});

// ---------------------------------------------------------------- limites de tamanho e proporção
test('min/max-width/height só aparecem quando definidos', () => {
  const n = createNode('rect', { w: 100, h: 50 });
  const s0 = nodeStyle(n, null);
  for (const k of ['min-width', 'max-width', 'min-height', 'max-height', 'aspect-ratio']) assert.equal(s0[k], undefined, k);
  Object.assign(n, { minW: 80, maxW: 300, minH: 20, maxH: 200 });
  const s = nodeStyle(n, null);
  assert.equal(s['min-width'], '80px');
  assert.equal(s['max-width'], '300px');
  assert.equal(s['min-height'], '20px');
  assert.equal(s['max-height'], '200px');
});

test('min-width do usuário substitui o min-width:0 do item "fill" de um flex', () => {
  const parent = createNode('frame');
  parent.layout.mode = 'row';
  const child = createNode('rect', { sizeX: 'fill', sizeY: 'fixed', h: 40 });
  assert.equal(nodeStyle(child, parent)['min-width'], '0');
  child.minW = 120;
  assert.equal(nodeStyle(child, parent)['min-width'], '120px');
});

test('aspect-ratio: só entra no CSS quando uma medida é flexível, e a fixa vira auto', () => {
  const parent = createNode('frame');
  parent.layout.mode = 'row';
  const fixedBoth = createNode('rect', { w: 160, h: 90, aspect: 16 / 9 });
  assert.equal(nodeStyle(fixedBoth, null)['aspect-ratio'], undefined); // as duas fixas: o editor mantém a proporção
  const fillW = createNode('rect', { sizeX: 'fill', sizeY: 'fixed', h: 90, aspect: 16 / 9 });
  const s1 = nodeStyle(fillW, parent);
  assert.equal(s1['aspect-ratio'], '1.7778');
  assert.equal(s1.height, 'auto');
  const fillH = createNode('rect', { sizeX: 'fixed', sizeY: 'fill', w: 90, aspect: 1 });
  const s2 = nodeStyle(fillH, parent);
  assert.equal(s2['aspect-ratio'], '1');
  assert.equal(s2.width, 'auto');
});

test('texto, grupo e linha ignoram proporção; grupo e linha ignoram limites', () => {
  const t = createNode('text', { aspect: 2, maxW: 100 });
  assert.equal(nodeStyle(t, null)['aspect-ratio'], undefined);
  assert.equal(nodeStyle(t, null)['max-width'], '100px'); // texto aceita limite de largura
  const g = createNode('group', { minW: 50, aspect: 2 });
  assert.equal(nodeStyle(g, null)['min-width'], undefined);
  assert.equal(nodeStyle(g, null)['aspect-ratio'], undefined);
  const l = createNode('line', { maxW: 50 });
  assert.equal(nodeStyle(l, null)['max-width'], undefined);
});

test('texto "hug" com largura máxima quebra linha (pre-wrap); sem ela fica em uma linha (pre)', () => {
  const t = createNode('text'); // hug nos dois eixos por padrão
  assert.equal(nodeStyle(t, null)['white-space'], 'pre');
  t.maxW = 200;
  assert.equal(nodeStyle(t, null)['white-space'], 'pre-wrap');
});

test('resizeNode: proporção do CSS manda no outro eixo e os limites vencem', () => {
  const n = createNode('rect', { w: 100, h: 100, aspect: 2 });
  resizeNode(n, 200, 999, 'w');
  assert.deepEqual([n.w, n.h, n.sizeX], [200, 100, 'fixed']);
  resizeNode(n, 999, 50, 'h');
  assert.deepEqual([n.w, n.h], [100, 50]);
  n.maxW = 150;
  resizeNode(n, 400, 0, 'w'); // 400 → h 200, depois limitado: a largura fica em 150
  assert.equal(n.w, 150);
  assert.equal(n.h, 75); // e a altura SEGUE a proporção da largura já limitada (como o CSS faz)
});

test('limitSize: o mínimo vence o máximo quando se contradizem', () => {
  assert.deepEqual(limitSize({ minW: 200, maxW: 100 }, 50, 10), [200, 10]);
  assert.deepEqual(limitSize({}, 50, 10), [50, 10]);
  assert.deepEqual(limitSize({ maxH: 30 }, 50, 99), [50, 30]);
});

test('applyLimits só corrige eixos de medida FIXA', () => {
  const n = createNode('rect', { w: 500, h: 500, sizeX: 'fixed', sizeY: 'fill', maxW: 300, maxH: 100 });
  applyLimits(n);
  assert.equal(n.w, 300);
  assert.equal(n.h, 500); // eixo fill: quem decide é o navegador
});
