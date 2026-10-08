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

test('camadas sem etiqueta/nota continuam gerando o HTML de antes', () => {
  const { html } = generateCode([frame({ children: [texto()] })], null);
  assert.equal(html, '<div class="caixa">\n  <p class="titulo">Olá</p>\n</div>');
});

test('etiqueta, link e descrição entram nas propriedades que as instâncias herdam; a nota não', () => {
  for (const k of ['tag', 'href', 'alt']) assert.ok(OVERRIDE_PROPS.includes(k), k);
  assert.ok(!OVERRIDE_PROPS.includes('note'));
});
