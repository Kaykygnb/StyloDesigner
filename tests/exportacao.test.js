// HTML exportado fiel ao editor: etiquetas conferidas contra os pais, estilos padrão do navegador zerados, tela "Hug"
// sem altura fixa e tela fluida ocupando a janela também no celular. (A comparação visual completa, camada por
// camada, fica em tests/e2e/exportacao-fiel.mjs.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, htmlTagIn, editBp } from '../src/model.js';
import { exportHtml, generateCode, nodeStyle } from '../src/css.js';

const frame = (name, tag, children = [], extra = {}) => createNode('frame', { name, tag, children, ...extra });
const text = (t, tag) => createNode('text', { text: t, tag });

test('<li> só vale direto dentro de <ul>/<ol>; fora disso vira a etiqueta padrão', () => {
  assert.equal(htmlTagIn(frame('a', 'li'), ['ul']).tag, 'li');
  assert.equal(htmlTagIn(frame('a', 'li'), ['ol']).tag, 'li');
  const out = htmlTagIn(frame('a', 'li'), ['ul', 'li']);
  assert.equal(out.tag, 'div');
  assert.equal(out.wanted, 'li');
  assert.match(out.reason, /lista/);
  assert.equal(htmlTagIn(text('x', 'li'), ['div']).tag, 'p');
});

test('link/botão dentro de link/botão e form dentro de form voltam para a padrão', () => {
  assert.equal(htmlTagIn(frame('a', 'a'), ['div', 'a', 'div']).tag, 'div');
  assert.equal(htmlTagIn(text('x', 'button'), ['a']).tag, 'p');
  assert.equal(htmlTagIn(frame('a', 'button'), ['section']).tag, 'button');
  assert.equal(htmlTagIn(frame('a', 'form'), ['form', 'div']).tag, 'div');
});

test('o card <li> com itens <li> soltos não gera <li> dentro de <li> no HTML', () => {
  const card = frame('Card', 'li', [frame('Item', 'li', [text('um', 'span')]), frame('Item', 'li', [text('dois', 'span')])]);
  const list = frame('Lista', 'ul', [card]);
  const { html } = generateCode([list], null, {});
  // dentro do card, os itens viram <div>; o card continua <li> (está direto na <ul>)
  assert.match(html, /<ul class="lista">\s*<li class="card">\s*<div class="item">/);
  assert.ok(!/<li[^>]*>\s*<li/.test(html), html);
});

test('o pai passado ao gerador conta (painel Código mostrando um item)', () => {
  const item = frame('Item', 'li', [text('um', 'span')]);
  assert.match(generateCode([item], frame('Lista', 'ul')).html, /^<li /);
  assert.match(generateCode([item], frame('Caixa', 'div')).html, /^<div /);
});

test('HTML exportado zera os estilos padrão do navegador (lista, link, botão, títulos)', () => {
  const html = exportHtml(frame('Tela', 'main'), {}, 'x');
  assert.match(html, /\*, \*::before, \*::after \{ margin: 0; padding: 0; box-sizing: border-box; \}/);
  assert.match(html, /ul, ol \{ list-style: none; \}/);
  assert.match(html, /a \{ color: inherit; text-decoration: none; \}/);
  assert.match(html, /button \{ font: inherit;[^}]*border: 0;/);
  // o reset vem ANTES das regras das camadas (que precisam vencer)
  assert.ok(html.indexOf('list-style: none') < html.indexOf('.tela {'));
});

test('tela "Hug" sai sem altura fixa no HTML exportado (o conteúdo que cresceu não é cortado)', () => {
  const tela = frame('Tela', undefined, [], { w: 400, h: 300, sizeX: 'fixed', sizeY: 'hug' });
  const s = nodeStyle(tela, null, {}, { root: true });
  assert.equal(s.width, '400px');
  assert.equal(s.height, 'auto');
  assert.equal(nodeStyle({ ...tela, sizeY: 'fixed' }, null, {}, { root: true }).height, '300px');
});

test('tela fluida continua ocupando a janela no celular (sem max-width do "Telas em 390px")', () => {
  const tela = frame('Site', undefined, [text('oi', 'p')], { w: 1200, h: 800, fluid: true });
  editBp(tela, 'mobile', (d) => { d.w = 390; d.sizeX = 'fixed'; });
  const html = exportHtml(tela, {}, 'x');
  assert.match(html, /max-width: 1200px/);
  assert.ok(!/max-width: 390px/.test(html), html);
});
