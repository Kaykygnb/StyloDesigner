import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, applyConstraints, defaultFill } from '../src/model.js';
import { nodeStyle, pathData, pathSvg, maskClip, transformOf, generateCode } from '../src/css.js';
import { syncInstances, makeComponent, createInstance, detachInstance, syncStyles } from '../src/components.js';

const mkButton = () => {
  const b = createNode('frame', { name: 'Botão', w: 120, h: 40 });
  const t = createNode('text', { text: 'Enviar', x: 10, y: 10 });
  b.children.push(t);
  return b;
};

test('CSS Grid: container e itens', () => {
  const g = createNode('frame');
  g.layout = { ...g.layout, mode: 'grid', cols: 3, rows: 0, colGap: 10, rowGap: 20, padding: [4, 4, 4, 4], justify: 'center', align: 'flex-start' };
  const s = nodeStyle(g, null);
  assert.equal(s.display, 'grid');
  assert.equal(s['grid-template-columns'], 'repeat(3, minmax(0, 1fr))');
  assert.equal(s.gap, '20px 10px');
  assert.equal(s['justify-items'], 'center');
  assert.equal(s['align-items'], 'start');
  const item = nodeStyle(createNode('rect', { colSpan: 2, sizeX: 'fill' }), g);
  assert.equal(item['grid-column'], 'span 2');
  assert.equal(item['justify-self'], 'stretch');
  assert.equal(item.position, 'relative');
});

test('linha vira barra com gradiente e altura mínima de 12px', () => {
  const l = createNode('line');
  const s = nodeStyle(l, null);
  assert.equal(s.height, '12px');
  assert.match(s['background-image'], /linear-gradient/);
  assert.equal(s['background-size'], '100% 2px');
  assert.equal(s.outline, undefined);
});

test('espelhar combina com rotação', () => {
  assert.equal(transformOf(createNode('rect', { rotation: 30, flipX: true })), 'rotate(30deg) scale(-1, 1)');
  assert.equal(transformOf(createNode('rect')), '');
});

test('caminho SVG: linhas e curvas de Bézier', () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0, hin: { x: 5, y: -5 } }, { x: 10, y: 10 }];
  assert.equal(pathData(pts, false), 'M 0 0 C 0 0 5 -5 10 0 L 10 10');
  assert.match(pathData(pts, true), / Z$/);
  const p = createNode('path', { points: pts, closed: true, vw: 10, vh: 10, w: 20, h: 20 });
  const svg = pathSvg(p);
  assert.match(svg, /viewBox="0 0 10 10"/);
  assert.match(svg, /vector-effect="non-scaling-stroke"/);
  assert.ok(generateCode([p], null).html.includes('<svg'));
});

test('máscara gera clip-path a partir do filho marcado', () => {
  const g = createNode('group', { w: 100, h: 100 });
  const m = createNode('ellipse', { x: 10, y: 10, w: 50, h: 40, isMask: true });
  g.children = [m, createNode('rect')];
  assert.equal(maskClip(g), 'ellipse(25px 20px at 35px 30px)');
  assert.equal(nodeStyle(m, g).display, 'none');
  m.type = 'rect';
  m.radius = [8, 8, 8, 8];
  assert.equal(maskClip(g), 'inset(10px 40px 50px 10px round 8px 8px 8px 8px)');
});

test('constraints: direita, esquerda+direita, centro e escala', () => {
  const f = createNode('frame', { w: 200, h: 100 });
  const mk = (h, v) => createNode('rect', { x: 20, y: 10, w: 40, h: 20, constraints: { h, v } });
  const a = mk('right', 'bottom'), b = mk('leftright', 'topbottom'), c = mk('center', 'center'), d = mk('scale', 'scale');
  f.children = [a, b, c, d];
  f.w = 300; f.h = 200;
  applyConstraints(f, 200, 100);
  assert.deepEqual([a.x, a.y], [120, 110]);
  assert.deepEqual([b.x, b.w, b.y, b.h], [20, 140, 10, 120]);
  assert.deepEqual([c.x, c.y], [70, 60]);
  assert.deepEqual([d.x, d.w, d.y, d.h], [30, 60, 20, 40]);
});

test('constraints não mexem em frames com auto layout', () => {
  const f = createNode('frame', { w: 100, h: 100 });
  f.layout.mode = 'row';
  const r = createNode('rect', { constraints: { h: 'right', v: 'top' } });
  f.children = [r];
  f.w = 200;
  applyConstraints(f, 100, 100);
  assert.equal(r.x, 0);
});

test('instância copia o principal e propaga mudanças', () => {
  const main = mkButton();
  makeComponent(main);
  const pages = [{ children: [main] }];
  const inst = createInstance(main, pages);
  pages[0].children.push(inst);
  assert.equal(inst.children.length, 1);
  assert.equal(inst.children[0].text, 'Enviar');
  assert.equal(inst.children[0].id, `${inst.id}~${main.children[0].id}`);

  main.children[0].fill = { ...defaultFill('#FF0000') };
  main.fill = defaultFill('#00AA00');
  syncInstances(pages);
  assert.equal(inst.children[0].fill.color, '#FF0000');
  assert.equal(inst.fill.color, '#00AA00');
});

test('sobrescritas na instância sobrevivem a mudanças no principal', () => {
  const main = mkButton();
  makeComponent(main);
  const pages = [{ children: [main] }];
  const inst = createInstance(main, pages);
  pages[0].children.push(inst);
  const idBefore = inst.children[0].id;

  inst.children[0].text = 'Cancelar'; // override de texto
  inst.w = 200; // override de tamanho da raiz
  main.children[0].fontSize = 30; // muda no principal
  syncInstances(pages);

  assert.equal(inst.children[0].text, 'Cancelar');
  assert.equal(inst.children[0].fontSize, 30);
  assert.equal(inst.w, 200);
  assert.equal(inst.children[0].id, idBefore); // ids estáveis (seleção não se perde)

  // estável: sincronizar de novo não muda nada
  const snap = JSON.stringify(inst);
  syncInstances(pages);
  assert.equal(JSON.stringify(inst), snap);
});

test('instância redimensionada aplica constraints nos filhos', () => {
  const main = mkButton();
  main.children[0].constraints = { h: 'right', v: 'top' };
  makeComponent(main);
  const pages = [{ children: [main] }];
  const inst = createInstance(main, pages);
  pages[0].children.push(inst);
  inst.w = 220; // +100
  syncInstances(pages);
  assert.equal(inst.children[0].x, 110);
});

test('apagar o principal desanexa as instâncias; detach limpa metadados', () => {
  const main = mkButton();
  makeComponent(main);
  const pages = [{ children: [main] }];
  const inst = createInstance(main, pages);
  pages[0].children.push(inst);
  pages[0].children.splice(0, 1);
  syncInstances(pages);
  assert.equal(inst.instanceOf, undefined);
  assert.equal(inst.children.length, 1);
  const i2 = { ...inst, instanceOf: 'x', base: {}, children: [{ ...inst.children[0], srcId: 'a' }] };
  detachInstance(i2);
  assert.equal(i2.base, undefined);
  assert.equal(i2.children[0].srcId, undefined);
});

test('estilos de cor e texto atualizam as camadas vinculadas', () => {
  const r = createNode('rect');
  r.fill = { ...defaultFill('#111111'), styleId: 'c1' };
  const t = createNode('text', { textStyleId: 't1' });
  const doc = {
    pages: [{ children: [r, t] }],
    styles: {
      colors: [{ id: 'c1', name: 'Primária', color: '#7C5CFF', opacity: 0.5 }],
      texts: [{ id: 't1', name: 'Título', fontFamily: 'Poppins', fontSize: 40, fontWeight: 800, fontStyle: 'normal', lineHeight: 1.1, letterSpacing: -1 }],
    },
  };
  syncStyles(doc);
  assert.equal(r.fill.color, '#7C5CFF');
  assert.equal(r.fill.opacity, 0.5);
  assert.equal(t.fontSize, 40);
  assert.equal(t.fontFamily, 'Poppins');
  doc.styles.colors = [];
  syncStyles(doc);
  assert.equal(r.fill.styleId, undefined);
});

import { toSvg } from '../src/svg.js';

test('SVG: frame com filhos, gradiente, sombra, texto e vetor', () => {
  const frame = createNode('frame', { name: 'Card', w: 200, h: 100 });
  frame.fill = { ...defaultFill(), type: 'linear', angle: 90 };
  frame.radius = [8, 8, 8, 8];
  frame.shadows = [{ x: 0, y: 4, blur: 10, spread: 0, color: '#000000', opacity: 0.3, inset: false }];
  const t = createNode('text', { text: 'Olá\nmundo', x: 10, y: 10, w: 60, h: 40 });
  const p = createNode('path', { x: 100, y: 10, w: 50, h: 50, vw: 50, vh: 50, closed: true, points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 50 }] });
  p.stroke = { color: '#FF0000', opacity: 1, width: 3, style: 'solid', position: 'center' };
  const hidden = createNode('rect', { visible: false });
  frame.children = [t, p, hidden];
  const svg = toSvg(frame);
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="200" height="100"/);
  assert.match(svg, /<linearGradient/);
  assert.match(svg, /<feDropShadow dx="0" dy="4"/);
  assert.match(svg, /<clipPath/);
  assert.equal((svg.match(/<tspan/g) || []).length, 2);
  assert.match(svg, /vector-effect="non-scaling-stroke"/);
  assert.ok(!svg.includes('data-name="Retângulo"')); // oculto não exporta
  assert.match(svg, /translate\(10 10\)/);
});

test('SVG: elipse, linha, rotação e espelhar', () => {
  const root = createNode('frame', { w: 100, h: 100 });
  root.fill = defaultFill('#FFFFFF');
  const e = createNode('ellipse', { x: 10, y: 10, w: 40, h: 20, rotation: 45, flipX: true });
  const l = createNode('line', { x: 0, y: 50, w: 80 });
  root.children = [e, l];
  const svg = toSvg(root);
  assert.match(svg, /rotate\(45 20 10\)/);
  assert.match(svg, /scale\(-1 1\)/);
  assert.match(svg, /<line x1="0" y1="6" x2="80" y2="6"/);
});

import { measures } from '../src/overlay.js';

test('medidas Alt: distância horizontal e vertical entre camadas', () => {
  const A = { x: 0, y: 0, w: 50, h: 50 };
  const right = measures(A, { x: 80, y: 10, w: 20, h: 20 });
  assert.equal(right.length, 1);
  assert.equal(right[0].len, 30);
  assert.equal(right[0].y1, 20); // no meio da sobreposição vertical (10..50 ∩ → 10..50 -> 30?) deve ficar dentro da sobreposição
  const below = measures(A, { x: 10, y: 90, w: 20, h: 20 });
  assert.equal(below[0].len, 40);
  assert.deepEqual([below[0].x1, below[0].y1, below[0].y2], [20, 50, 90]);
});

test('medidas Alt: camada dentro de outra mostra as 4 margens', () => {
  const inner = { x: 10, y: 20, w: 30, h: 40 };
  const outer = { x: 0, y: 0, w: 100, h: 100 };
  const m = measures(inner, outer);
  assert.deepEqual(m.map((x) => x.len).sort((a, b) => a - b), [10, 20, 40, 60]);
  assert.deepEqual(measures({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), []); // sobrepostas: sem medida
});

import { buildSampleApp } from '../src/sample.js';
import { walk } from '../src/model.js';

test('exemplo "app mobile": instâncias sincronizadas, estilos ligados e protótipo navegável', () => {
  const doc = buildSampleApp();
  const all = [];
  walk(doc.pages[0].children, (n) => { all.push(n); });
  const byId = new Map(all.map((n) => [n.id, n]));

  // 4 instâncias do componente "Ação", cada uma com o ícone/rótulo próprios (sobrescritas) e o resto vindo do principal
  const insts = all.filter((n) => n.instanceOf);
  assert.equal(insts.length, 4);
  assert.deepEqual(insts.map((i) => i.children[1].text), ['Enviar', 'Receber', 'Pagar', 'Cartões']);
  const main = byId.get(insts[0].instanceOf);
  assert.equal(main.component, true);
  assert.equal(main.children[1].text, 'Enviar'); // o principal não foi alterado pelas sobrescritas

  // mudar o principal propaga; as sobrescritas permanecem
  main.children[1].fontSize = 20;
  syncInstances(doc.pages);
  assert.equal(insts[2].children[1].fontSize, 20);
  assert.equal(insts[2].children[1].text, 'Pagar');

  // estilos ligados a camadas existem
  const styleIds = new Set([...doc.styles.colors, ...doc.styles.texts].map((s) => s.id));
  const linked = all.filter((n) => n.textStyleId || n.fill?.styleId);
  assert.ok(linked.length >= 3);
  assert.ok(linked.every((n) => styleIds.has(n.textStyleId ?? n.fill.styleId)));

  // toda interação de navegação aponta para um frame que existe
  const navs = all.flatMap((n) => (n.interactions || []).filter((i) => i.action === 'navigate'));
  assert.equal(navs.length, 2);
  assert.ok(navs.every((i) => byId.get(i.target)?.type === 'frame'));
});

test('nome novo usa o MAIOR número existente + 1 (não repete quando algo virou frame ou foi apagado)', async () => {
  const { nextName } = await import('../src/model.js');
  const page = { children: [{ type: 'frame', name: 'Retângulo 1', children: [{ type: 'rect', name: 'Retângulo 4' }, { type: 'rect', name: 'Retângulo 2' }] }] };
  assert.equal(nextName(page, 'rect'), 'Retângulo 5');
  assert.equal(nextName({ children: [] }, 'rect'), 'Retângulo 1');
});

test('limites de tamanho e proporção sincronizam do principal para a instância', () => {
  const main = mkButton();
  main.maxW = 240;
  main.aspect = 3;
  makeComponent(main);
  const pages = [{ children: [main] }];
  const inst = createInstance(main, pages);
  assert.equal(inst.maxW, 240);
  assert.equal(inst.aspect, 3);
  main.maxW = 300;
  delete main.aspect;
  syncInstances(pages.concat([{ children: [inst] }]));
  assert.equal(inst.maxW, 300);
  assert.equal(inst.aspect, undefined);
});
