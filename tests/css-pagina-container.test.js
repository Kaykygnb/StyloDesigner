// Issue #10: no canvas, o @media de largura do CSS da página deve responder à largura da TELA desenhada, não à da
// janela do editor. O canvas converte essas condições em container queries; a exportação continua com @media.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopePageCss, safePageCss } from '../src/html.js';

const css = (media) => `.card { color: blue }\n${media} { .card { color: red } }`;

test('canvas: @media de largura em px vira @container e as telas de largura definida viram contêineres', () => {
  const out = scopePageCss(css('@media (max-width: 640px)'));
  assert.match(out, /@container \(max-width: 640px\)/);
  assert.doesNotMatch(out, /@media/);
  assert.match(out, /\[data-board\][^{]*\{[^}]*container-type: inline-size/);
});

test('canvas: min-width, width e combinações com "and" e "screen and" também convertem', () => {
  assert.match(scopePageCss(css('@media (min-width: 641px) and (max-width: 1024px)')), /@container \(min-width: 641px\) and \(max-width: 1024px\)/);
  assert.match(scopePageCss(css('@media screen and (min-width: 700px)')), /@container \(min-width: 700px\)/);
  assert.match(scopePageCss(css('@media only screen and (width: 500px)')), /@container \(width: 500px\)/);
});

test('canvas: o que não é só largura em px continua @media (preferência de cor, orientação, em/rem, misto)', () => {
  for (const media of ['@media (prefers-color-scheme: dark)', '@media (orientation: portrait)', '@media (max-width: 40em)', '@media (max-width: 640px) and (orientation: portrait)', '@media print']) {
    const out = scopePageCss(css(media));
    assert.match(out, /@media/, media);
    assert.doesNotMatch(out, /@container/, media);
  }
});

test('canvas: sem regra de largura, nada de container-type (não mexe nas telas à toa)', () => {
  assert.doesNotMatch(scopePageCss('.card { color: blue }'), /container-type/);
  assert.doesNotMatch(scopePageCss(css('@media (prefers-color-scheme: dark)')), /container-type/);
});

test('exportação: continua @media, sem @container nem contêiner', () => {
  const out = safePageCss(css('@media (max-width: 640px)'));
  assert.match(out, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(out, /@container|container-type/);
});
