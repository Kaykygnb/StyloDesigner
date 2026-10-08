// Etiquetas HTML escolhidas no painel, link, descrição (aria-label) e nota da camada virando comentário no código.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, tagOf, TEXT_TAGS, BOX_TAGS } from '../src/model.js';
import { generateCode, noteComment } from '../src/css.js';
import { OVERRIDE_PROPS } from '../src/components.js';

const frame = (extra = {}) => createNode('frame', { name: 'Caixa', w: 100, h: 50, ...extra });
const texto = (extra = {}) => createNode('text', { name: 'Título', text: 'Olá', ...extra });

test('tagOf: padrão por tipo, valor escolhido só se for da lista', () => {
  assert.equal(tagOf(frame()), 'div');
  assert.equal(tagOf(createNode('section', { name: 'S' })), 'section');
  assert.equal(tagOf(texto()), 'p');
  assert.equal(tagOf(frame({ tag: 'nav' })), 'nav');
  assert.equal(tagOf(texto({ tag: 'h1' })), 'h1');
  assert.equal(tagOf(frame({ tag: 'script' })), 'div'); // fora da lista: ignora
  assert.equal(tagOf(texto({ tag: 'nav' })), 'p'); // nav não vale para texto
  assert.ok(TEXT_TAGS.includes('h1') && BOX_TAGS.includes('header'));
});

test('generateCode usa a etiqueta escolhida (texto e caixa)', () => {
  const t = texto({ tag: 'h2' });
  const f = frame({ tag: 'header', children: [t] });
  const { html } = generateCode([f], null);
  assert.ok(html.includes('<header class="caixa">'));
  assert.ok(html.includes('<h2 class="titulo">Olá</h2>'));
  assert.ok(html.includes('</header>'));
});

test('link: <a> ganha href (padrão #), botão ganha type="button"', () => {
  const a = frame({ name: 'Link', tag: 'a', href: 'https://exemplo.com/?a=1&b="2"' });
  const b = frame({ name: 'Botao', tag: 'button' });
  const c = frame({ name: 'Sem endereco', tag: 'a' });
  const { html } = generateCode([a, b, c], null);
  assert.ok(html.includes('<a class="link" href="https://exemplo.com/?a=1&amp;b=&quot;2&quot;">'));
  assert.ok(html.includes('<button class="botao" type="button">'));
  assert.ok(html.includes('<a class="sem-endereco" href="#">'));
});

test('descrição vira aria-label (e role="img" em camada sem filhos)', () => {
  const img = frame({ name: 'Foto', alt: 'Equipe sorrindo' });
  const comFilho = frame({ name: 'Cartao', alt: 'Cartão', children: [texto()] });
  const { html } = generateCode([img, comFilho], null);
  assert.ok(html.includes('<div class="foto" aria-label="Equipe sorrindo" role="img"></div>'));
  assert.ok(html.includes('<div class="cartao" aria-label="Cartão">'));
  assert.ok(!html.includes('class="cartao" aria-label="Cartão" role'));
});

test('nota: vira comentário HTML antes do elemento; some com noteInCode=false; "--" não quebra o comentário', () => {
  const n = frame({ name: 'Botao', note: 'Botão principal --> leva ao checkout\nsegunda linha' });
  assert.equal(noteComment(n), 'Botão principal –> leva ao checkout segunda linha');
  const { html } = generateCode([n], null);
  assert.ok(html.startsWith('<!-- Botão principal –> leva ao checkout segunda linha -->\n<div class="botao">'));
  const off = frame({ name: 'Botao', note: 'segredo', noteInCode: false });
  assert.equal(noteComment(off), '');
  assert.ok(!generateCode([off], null).html.includes('segredo'));
  assert.equal(noteComment(frame()), '');
});

test('a nota também vira comentário no CSS (e "*/" não fecha o comentário)', () => {
  const n = frame({ name: 'Botao', note: 'Botão principal */ cuidado' });
  const { css } = generateCode([n], null);
  assert.ok(css.startsWith('/* Botão principal * / cuidado */\n.botao {'), css);
  const off = frame({ name: 'Botao', note: 'segredo', noteInCode: false });
  assert.ok(!generateCode([off], null).css.includes('segredo'));
});

test('camadas sem etiqueta/nota continuam gerando o HTML de antes', () => {
  const { html } = generateCode([frame({ children: [texto()] })], null);
  assert.equal(html, '<div class="caixa">\n  <p class="titulo">Olá</p>\n</div>');
});

test('etiqueta, link e descrição entram nas propriedades que as instâncias herdam; a nota não', () => {
  for (const k of ['tag', 'href', 'alt']) assert.ok(OVERRIDE_PROPS.includes(k), k);
  assert.ok(!OVERRIDE_PROPS.includes('note'));
});

// ---- acabamentos: estado em vetor no HTML, filtros de cor no SVG, editar comentário
import { editText, addComment } from '../src/comments.js';
import { colorFilterPrimitives, toSvg } from '../src/svg.js';
import { editState } from '../src/model.js';

test('estado (hover) em vetor vira regra para o <path> de dentro do <svg>', () => {
  const p = createNode('path', { name: 'Icone', w: 24, h: 24, vw: 24, vh: 24, points: [{ x: 0, y: 0, in: null, out: null }, { x: 24, y: 24, in: null, out: null }], closed: false });
  p.fill = { ...p.fill, type: 'solid', color: '#000000', opacity: 1 };
  p.stroke = { color: '#112233', opacity: 1, width: 2, style: 'solid', position: 'center' };
  editState(p, 'hover', (n) => { n.fill = { ...n.fill, color: '#ff0000' }; n.stroke = { ...n.stroke, color: '#00ff00', width: 4 }; });
  const { css } = generateCode([p], null);
  assert.ok(css.includes('.icone:hover path[data-vis] {'), css);
  assert.ok(css.includes('fill: #ff0000') || css.includes('fill: rgb(255, 0, 0)'), css);
  assert.ok(css.includes('stroke: #00ff00') || css.includes('stroke: rgb(0, 255, 0)'), css);
  assert.ok(css.includes('stroke-width: 4'), css);
});

test('filtros de cor viram primitivas de <filter> no SVG exportado', () => {
  assert.deepEqual(colorFilterPrimitives({}), []);
  assert.deepEqual(colorFilterPrimitives({ fx: { brightness: 100, contrast: 100 } }), []);
  const prims = colorFilterPrimitives({ fx: { brightness: 120, contrast: 150, saturate: 0, grayscale: 50, hue: 90 } }).join('');
  assert.ok(prims.includes('slope="1.2"'));
  assert.ok(prims.includes('slope="1.5" intercept="-0.25"'));
  assert.ok(prims.includes('type="saturate" values="0"'));
  assert.ok(prims.includes('type="saturate" values="0.5"'));
  assert.ok(prims.includes('type="hueRotate" values="90"'));
  const r = createNode('rect', { name: 'R', w: 50, h: 50 });
  r.fx = { grayscale: 100 };
  const svg = toSvg(r, {});
  assert.ok(svg.includes('<filter') && svg.includes('feColorMatrix'), svg);
});

test('editText: troca o texto, marca editedAt, ignora vazio e igual', () => {
  const doc = { comments: [] };
  const c = addComment(doc, { nodeId: 'n1', text: 'primeiro' });
  assert.equal(editText(c, '  segundo  '), true);
  assert.equal(c.text, 'segundo');
  assert.ok(c.editedAt);
  assert.equal(editText(c, ''), false);
  assert.equal(editText(c, 'segundo'), false);
  assert.equal(c.text, 'segundo');
});
