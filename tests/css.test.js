import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, defaultFill, defaultShadow, defaultStroke, fitGroups, cloneNode, scaleNode, resizeNode, applyLimits, limitSize, stateView, editState, hasStates, canHaveStates, cleanTrackList } from '../src/model.js';
import { nodeStyle, rgba, exportHtml, generateCode, fillCss, stateStyle } from '../src/css.js';
import { toSvg } from '../src/svg.js';
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

// ---------------------------------------------------------------- imagem de fundo: ajuste, posição, repetição
const IMG = 'data:image/png;base64,AAAA';
const imgFill = (extra = {}) => ({ ...defaultFill(), type: 'image', assetId: 'a1', fit: 'cover', ...extra });

test('imagem de fundo: padrão idêntico ao de antes (cover, center, no-repeat)', () => {
  const css = fillCss(imgFill(), { a1: IMG });
  assert.equal(css['background-size'], 'cover');
  assert.equal(css['background-position'], 'center');
  assert.equal(css['background-repeat'], 'no-repeat');
});

test('imagem de fundo: posição em %, tamanho próprio e repetição', () => {
  const css = fillCss(imgFill({ fit: 'size', size: 40, posX: 0, posY: 100, repeat: 'repeat-x' }), { a1: IMG });
  assert.equal(css['background-size'], '40% auto');
  assert.equal(css['background-position'], '0% 100%');
  assert.equal(css['background-repeat'], 'repeat-x');
});

test('imagem de fundo: repetir só vale em contain e tamanho próprio', () => {
  assert.equal(fillCss(imgFill({ fit: 'cover', repeat: 'repeat' }), { a1: IMG })['background-repeat'], 'no-repeat');
  assert.equal(fillCss(imgFill({ fit: 'fill', repeat: 'repeat' }), { a1: IMG })['background-repeat'], 'no-repeat');
  assert.equal(fillCss(imgFill({ fit: 'contain', repeat: 'repeat' }), { a1: IMG })['background-repeat'], 'repeat');
});

test('SVG exportado: posição aproximada em cover e posição/tamanho exatos em tamanho próprio', () => {
  const mk = (fill) => createNode('rect', { w: 200, h: 100, fill });
  const cover = toSvg(mk(imgFill({ posX: 0, posY: 100 })), { assets: { a1: IMG } });
  assert.match(cover, /preserveAspectRatio="xMinYMax slice"/);
  // 50% de 200 = 100 de largura; imagem 2:1 → 50 de altura; posição 100%/0% → x = 100, y = 0
  const own = toSvg(mk(imgFill({ fit: 'size', size: 50, natW: 400, natH: 200, posX: 100, posY: 0 })), { assets: { a1: IMG } });
  assert.match(own, /x="100" y="0"/);
  assert.match(own, /width="100" height="50"/);
  const tile = toSvg(mk(imgFill({ fit: 'size', size: 50, natW: 400, natH: 200, repeat: 'repeat' })), { assets: { a1: IMG } });
  assert.match(tile, /<pattern /);
  assert.match(tile, /fill="url\(#p\d+\)"/);
  // sem o tamanho original guardado, cai no "cobrir"
  const fallback = toSvg(mk(imgFill({ fit: 'size', size: 50 })), { assets: { a1: IMG } });
  assert.match(fallback, /slice/);
});

// ---------------------------------------------------------------- texto: truncar e espaço entre palavras
test('texto "Uma linha com …": nowrap + overflow + ellipsis, e o alinhamento vertical por grid é desligado', () => {
  const t = createNode('text', { sizeX: 'fixed', sizeY: 'fixed', w: 120, h: 40, textVAlign: 'center', truncate: 'ellipsis' });
  const s = nodeStyle(t, null);
  assert.equal(s['white-space'], 'nowrap');
  assert.equal(s.overflow, 'hidden');
  assert.equal(s['text-overflow'], 'ellipsis');
  assert.equal(s.display, undefined);
  assert.equal(s['align-content'], undefined);
});

test('texto "Limitar linhas": -webkit-line-clamp (padrão 2 linhas) e display -webkit-box', () => {
  const t = createNode('text', { sizeX: 'fixed', w: 200, truncate: 'clamp' });
  let s = nodeStyle(t, null);
  assert.equal(s.display, '-webkit-box');
  assert.equal(s['-webkit-box-orient'], 'vertical');
  assert.equal(s['-webkit-line-clamp'], '2');
  assert.equal(s['line-clamp'], '2');
  assert.equal(s.overflow, 'hidden');
  assert.equal(s['white-space'], 'pre-wrap');
  t.lines = 3;
  s = nodeStyle(t, null);
  assert.equal(s['-webkit-line-clamp'], '3');
});

test('texto sem truncar não ganha overflow nem line-clamp; word-spacing só quando definido', () => {
  const t = createNode('text', { sizeX: 'fixed', w: 200 });
  const s = nodeStyle(t, null);
  for (const k of ['text-overflow', '-webkit-line-clamp', 'line-clamp', 'word-spacing']) assert.equal(s[k], undefined, k);
  assert.equal(s.overflow, undefined);
  t.wordSpacing = 4;
  assert.equal(nodeStyle(t, null)['word-spacing'], '4px');
});

// ---------------------------------------------------------------- margem do item e filtros de cor
test('margin: só em itens em fluxo (flex e grid), 1 valor quando iguais, 4 quando diferentes, nada quando zero', () => {
  const row = createNode('frame'); row.layout.mode = 'row';
  const grid = createNode('frame'); grid.layout.mode = 'grid';
  const item = createNode('rect', { sizeX: 'fixed', sizeY: 'fixed' });
  assert.equal(nodeStyle(item, row).margin, undefined);
  item.margin = [8, 8, 8, 8];
  assert.equal(nodeStyle(item, row).margin, '8px');
  item.margin = [0, 8, 0, 16];
  assert.equal(nodeStyle(item, row).margin, '0px 8px 0px 16px');
  assert.equal(nodeStyle(item, grid).margin, '0px 8px 0px 16px');
  item.margin = [0, 0, 0, 0];
  assert.equal(nodeStyle(item, row).margin, undefined);
  // camada livre ou absoluta dentro de um layout: margem ignorada (a posição é left/top)
  item.margin = [8, 8, 8, 8];
  assert.equal(nodeStyle(item, null).margin, undefined);
  item.absolute = true;
  assert.equal(nodeStyle(item, row).margin, undefined);
});

test('filtros de cor: só os que fogem do padrão, na ordem do CSS, depois do blur', () => {
  const n = createNode('rect', { blur: 4, fx: { hue: 90, brightness: 120, saturate: 100, grayscale: 0 } });
  assert.equal(nodeStyle(n, null).filter, 'blur(4px) brightness(120%) hue-rotate(90deg)');
  const clean = createNode('rect', { fx: { brightness: 100 } });
  assert.equal(nodeStyle(clean, null).filter, undefined);
  const g = createNode('rect', { fx: { grayscale: 100, contrast: 80, saturate: 150 } });
  assert.equal(nodeStyle(g, null).filter, 'contrast(80%) saturate(150%) grayscale(100%)');
});

// ---------------------------------------------------------------- estados: hover, pressionado, foco, transição
const btn = () => createNode('rect', { name: 'Botão', w: 120, h: 40, fill: defaultFill('#7C5CFF') });

test('stateView aplica as sobrescritas do estado por cima da base, sem alterar a camada', () => {
  const n = btn();
  n.states = { hover: { fill: { ...defaultFill('#FF5CA8') }, opacity: 0.9 } };
  const v = stateView(n, 'hover');
  assert.equal(v.fill.color, '#FF5CA8');
  assert.equal(v.opacity, 0.9);
  assert.equal(n.fill.color, '#7C5CFF'); // a base não muda
  assert.equal(stateView(n, 'active'), n); // sem sobrescritas devolve a própria camada
  // cascata: pressionado por cima do hover
  n.states.active = { opacity: 0.7 };
  const both = stateView(n, ['hover', 'active']);
  assert.equal(both.fill.color, '#FF5CA8');
  assert.equal(both.opacity, 0.7);
});

test('editState guarda só o que difere da base e limpa quando volta ao valor base', () => {
  const n = btn();
  editState(n, 'hover', (d) => { d.fill.color = '#FF5CA8'; d.scale = 1.05; });
  assert.deepEqual(Object.keys(n.states.hover).sort(), ['fill', 'scale']);
  assert.equal(n.fill.color, '#7C5CFF');
  assert.equal(n.states.hover.scale, 1.05);
  // voltar ao valor da base remove a sobrescrita; sem nenhuma, o estado e o states somem
  editState(n, 'hover', (d) => { d.fill.color = '#7C5CFF'; d.scale = 1; });
  assert.equal(n.states, undefined);
  // um estado pode REMOVER algo da base (ex.: o contorno) e filtros
  n.stroke = { color: '#000000', opacity: 1, width: 2, style: 'solid', position: 'inside' };
  n.fx = { grayscale: 50 };
  editState(n, 'hover', (d) => { d.stroke = null; delete d.fx; });
  assert.equal(n.states.hover.stroke, null);
  assert.deepEqual(n.states.hover.fx, {});
  assert.equal(stateView(n, 'hover').stroke, null);
});

test('hasStates e canHaveStates', () => {
  const n = btn();
  assert.equal(hasStates(n), false);
  n.states = { hover: {} };
  assert.equal(hasStates(n), false); // estado vazio não conta
  n.states = { hover: { opacity: 0.5 } };
  assert.equal(hasStates(n), true);
  assert.equal(hasStates(n, 'hover'), true);
  assert.equal(hasStates(n, 'active'), false);
  assert.equal(canHaveStates(createNode('group')), false);
  assert.equal(canHaveStates(createNode('section')), false);
  assert.equal(canHaveStates(createNode('line')), false);
  assert.equal(canHaveStates(createNode('frame')), true);
});

test('transition e cursor só entram no CSS quando definidos; escala só nos estados', () => {
  const n = btn();
  const s0 = nodeStyle(n, null);
  assert.equal(s0.transition, undefined);
  assert.equal(s0.cursor, undefined);
  n.transition = { duration: 200, easing: 'ease-out' };
  n.cursor = 'pointer';
  const s = nodeStyle(n, null);
  assert.equal(s.transition, 'all 200ms ease-out');
  assert.equal(s.cursor, 'pointer');
  n.transition = { duration: 0, easing: 'ease' };
  assert.equal(nodeStyle(n, null).transition, undefined);
  n.states = { hover: { scale: 1.05 } };
  assert.equal(nodeStyle(stateView(n, 'hover'), null).transform, 'scale(1.05)');
  assert.equal(nodeStyle(n, null).transform, undefined);
});

test('stateStyle devolve só o que muda e usa unset para o que sumiu', () => {
  const n = btn();
  n.shadows = [defaultShadow()];
  n.states = { hover: { fill: { ...defaultFill('#FF5CA8') }, shadows: [], opacity: 0.8 } };
  const d = stateStyle(n, null, {}, {}, 'hover');
  assert.equal(d['background-color'], '#ff5ca8');
  assert.equal(d.opacity, '0.8');
  assert.equal(d['box-shadow'], 'unset'); // a base tinha sombra, o estado não
  assert.equal(d.width, undefined); // o que não mudou não entra
  assert.equal(d.position, undefined);
});

test('generateCode escreve .classe:hover/:active/:focus-visible, tabindex no foco e transition na base', () => {
  const n = btn();
  n.transition = { duration: 150, easing: 'ease' };
  n.states = {
    hover: { fill: { ...defaultFill('#FF5CA8') } },
    active: { scale: 0.97 },
    focus: { stroke: { color: '#7C5CFF', opacity: 1, width: 2, style: 'solid', position: 'outside' } },
  };
  const { html, css } = generateCode([n], null, {});
  assert.ok(css.includes('transition: all 150ms ease;'), css);
  assert.ok(css.includes('.botao:hover {\n  background-color: #ff5ca8;\n}'), css);
  assert.ok(css.includes('.botao:active {\n  transform: scale(0.97);\n}'), css);
  assert.ok(css.includes('.botao:focus-visible {'), css);
  assert.ok(html.includes('class="botao" tabindex="0"'), html);
  // sem estados não há regras extras nem tabindex
  const plain = generateCode([btn()], null, {});
  assert.doesNotMatch(plain.css, /:hover|:active|:focus/);
  assert.doesNotMatch(plain.html, /tabindex/);
});

// ---------------------------------------------------------------- gradiente cônico
test('gradiente cônico: conic-gradient com o ângulo de início e as paradas ordenadas', () => {
  const fill = { ...defaultFill(), type: 'conic', angle: 45, stops: [{ color: '#0000ff', opacity: 1, pos: 100 }, { color: '#ff0000', opacity: 1, pos: 0 }] };
  assert.equal(fillCss(fill)['background-image'], 'conic-gradient(from 45deg at center, #ff0000 0%, #0000ff 100%)');
});

test('gradiente cônico em vetor e no SVG: cai para a cor da 1ª parada (o SVG não tem cônico)', () => {
  const fill = { ...defaultFill(), type: 'conic', angle: 0, stops: [{ color: '#0000ff', opacity: 1, pos: 100 }, { color: '#ff0000', opacity: 0.5, pos: 0 }] };
  const r = createNode('rect', { w: 100, h: 100, fill });
  const svg = toSvg(r);
  assert.ok(svg.includes('fill="#ff0000"') && svg.includes('fill-opacity="0.5"'), svg);
  assert.ok(!svg.includes('Gradient'), svg);
});

// ---------------------------------------------------------------- peso no flex e trilhas personalizadas do grid
test('flex-grow: peso do item "fill" no eixo principal (padrão 1 continua "1 1 0%")', () => {
  const parent = createNode('frame'); parent.layout.mode = 'row';
  const a = createNode('rect', { sizeX: 'fill', sizeY: 'fixed', h: 40 });
  assert.equal(nodeStyle(a, parent).flex, '1 1 0%');
  a.grow = 2;
  assert.equal(nodeStyle(a, parent).flex, '2 1 0%');
  a.grow = 1.5;
  assert.equal(nodeStyle(a, parent).flex, '1.5 1 0%');
  // item de tamanho fixo ignora o peso
  const b = createNode('rect', { sizeX: 'fixed', w: 100, h: 40, grow: 3 });
  assert.equal(nodeStyle(b, parent).flex, '0 0 auto');
});

test('grid com trilhas personalizadas: colsTemplate/rowsTemplate mandam sobre cols/rows', () => {
  const g = createNode('frame');
  g.layout = { ...g.layout, mode: 'grid', cols: 3, rows: 2 };
  let s = nodeStyle(g, null);
  assert.equal(s['grid-template-columns'], 'repeat(3, minmax(0, 1fr))');
  assert.equal(s['grid-template-rows'], 'repeat(2, minmax(0, 1fr))');
  g.layout.colsTemplate = '240px 1fr 2fr';
  g.layout.rowsTemplate = 'auto 1fr';
  s = nodeStyle(g, null);
  assert.equal(s['grid-template-columns'], '240px 1fr 2fr');
  assert.equal(s['grid-template-rows'], 'auto 1fr');
  g.layout.colsTemplate = 'repeat(auto-fit, minmax(200px, 1fr))';
  assert.equal(nodeStyle(g, null)['grid-template-columns'], 'repeat(auto-fit, minmax(200px, 1fr))');
});

test('cleanTrackList tira o que não é lista de trilhas (não dá para fechar a regra CSS)', () => {
  assert.equal(cleanTrackList('  200px   1fr  '), '200px 1fr');
  assert.equal(cleanTrackList('1fr; } body { color: red'), '1fr body color red');
  assert.equal(cleanTrackList('a"b\'c{d}e;f:g@h'), 'abcdefgh');
  assert.equal(cleanTrackList('repeat(3, minmax(0, 1fr))'), 'repeat(3, minmax(0, 1fr))');
  assert.equal(cleanTrackList(null), '');
  assert.equal(cleanTrackList('x'.repeat(500)).length, 160);
  // o texto limpo vai para o CSS exportado sem caracteres que fechem a declaração
  const g = createNode('frame');
  g.layout = { ...g.layout, mode: 'grid', colsTemplate: '1fr; } .x { background: red' };
  assert.ok(!/[;{}]/.test(nodeStyle(g, null)['grid-template-columns']));
});
