// O CSS da página pode carregar fontes e imagens de fora (recurso legítimo), mas abrir um projeto de terceiros não pode
// fazer o navegador buscar endereços sem a pessoa saber: o carregamento avisa quais hosts o CSS da página acessa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDoc } from '../src/validate.js';

const docComCss = (pageCss) => ({ pages: [{ id: 'p', children: [] }], styles: { colors: [], texts: [], pageCss } });
const avisoExterno = (css) => sanitizeDoc(docComCss(css)).filter((w) => /de fora|externo/i.test(w));

test('url() externo no CSS da página gera aviso com o host', () => {
  const w = avisoExterno('.a { background: url(https://rastreador.example/p.png) }');
  assert.equal(w.length, 1);
  assert.match(w[0], /rastreador\.example/);
});

test('image-set, @import e @font-face com host externo também avisam', () => {
  assert.match(avisoExterno('.a { background-image: image-set("https://img.exemplo.com/a.png" 1x) }')[0] ?? '', /img\.exemplo\.com/);
  assert.match(avisoExterno('@font-face { font-family: X; src: url("//cdn.exemplo.org/x.woff2") }')[0] ?? '', /cdn\.exemplo\.org/);
  assert.match(avisoExterno('@import url("https://css.exemplo.net/t.css");')[0] ?? '', /css\.exemplo\.net/);
});

test('Google Fonts, data: e #fragmento não geram aviso', () => {
  assert.deepEqual(avisoExterno('@import url("https://fonts.googleapis.com/css2?family=Inter"); .a { background: url(data:image/png;base64,AAA=) } .b { clip-path: url(#c) } @font-face { src: url(https://fonts.gstatic.com/s/x.woff2) }'), []);
});

test('vários hosts viram um aviso só, sem repetir', () => {
  const w = avisoExterno('.a { background: url(https://a.exemplo.com/1.png) } .b { background: url(https://a.exemplo.com/2.png) } .c { background: url(https://b.exemplo.com/3.png) }');
  assert.equal(w.length, 1);
  assert.match(w[0], /a\.exemplo\.com/);
  assert.match(w[0], /b\.exemplo\.com/);
});

test('sem CSS da página, sem aviso', () => {
  assert.deepEqual(avisoExterno(''), []);
  assert.deepEqual(sanitizeDoc({ pages: [{ id: 'p', children: [] }] }).filter((w) => /de fora/i.test(w)), []);
});
