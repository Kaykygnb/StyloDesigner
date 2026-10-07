// Testes do módulo de fontes (src/fonts.js): URL do Google Fonts, pesos, fontes usadas e o <link> no HTML exportado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { googleFontsUrl, nearestWeight, weightsOf, usedFonts, GOOGLE, SYSTEM_FONTS } from '../src/fonts.js';
import { exportHtml } from '../src/css.js';
import { createNode } from '../src/model.js';

test('lista embutida tem as fontes do Google mais conhecidas, com pesos', () => {
  assert.ok(GOOGLE.size > 1500);
  for (const f of ['Inter', 'Roboto', 'Montserrat', 'Lobster', 'Pacifico']) assert.ok(GOOGLE.has(f), f);
  assert.deepEqual(weightsOf('Lobster'), [400]);
  assert.ok(weightsOf('Roboto').includes(700));
  assert.ok(!GOOGLE.has('Arial') && SYSTEM_FONTS.includes('Arial'), 'Arial é do sistema, não do Google');
});

test('URL do Google Fonts: nome com espaço vira +, pesos entram, fontes do sistema ficam de fora', () => {
  assert.equal(googleFontsUrl(['Lobster']), 'https://fonts.googleapis.com/css2?family=Lobster&display=swap');
  const u = googleFontsUrl(['Open Sans', 'Arial']);
  assert.match(u, /family=Open\+Sans:wght@[\d;]*400;[\d;]*700/);
  assert.ok(!u.includes('Arial'));
  assert.equal(googleFontsUrl(['Arial']), '');
  assert.match(googleFontsUrl(['Lobster'], { text: 'Lobster' }), /&text=Lobster$/);
});

test('peso mais próximo que a fonte tem', () => {
  assert.equal(nearestWeight('Lobster', 700), 400);
  assert.equal(nearestWeight('Roboto', 650), 600);
  assert.equal(nearestWeight('Arial', 300), 300, 'fonte do sistema: qualquer peso');
});

test('fontes usadas por textos (inclusive dentro de frames) e estilos de texto', () => {
  const frame = createNode('frame');
  frame.children.push(createNode('text', { fontFamily: 'Lobster' }));
  const doc = { pages: [{ children: [frame, createNode('text', { fontFamily: 'Inter' }), createNode('rect')] }], styles: { texts: [{ fontFamily: 'Pacifico' }] } };
  assert.deepEqual(usedFonts(doc).sort(), ['Inter', 'Lobster', 'Pacifico']);
});

test('HTML exportado leva o <link> das fontes do Google usadas', () => {
  const frame = createNode('frame');
  frame.children.push(createNode('text', { fontFamily: 'Lobster', text: 'Oi' }));
  const html = exportHtml(frame, {});
  assert.match(html, /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Lobster&display=swap">/);
  const sys = createNode('frame');
  sys.children.push(createNode('text', { fontFamily: 'Arial' }));
  assert.ok(!exportHtml(sys, {}).includes('fonts.googleapis'), 'só fontes do sistema: sem link');
});
