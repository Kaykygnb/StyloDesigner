// Projeto .json de terceiros é entrada não confiável: o que vem dele não pode escapar do <style>, nem do atributo,
// nem puxar recurso externo. Duas camadas: validar ao carregar (sanitizeDoc) e escapar na saída (css.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, defaultFill, defaultStroke } from '../src/model.js';
import { exportHtml, generateCode, toCssText, safeIdent, isSafeCssValue } from '../src/css.js';
import { sanitizeDoc } from '../src/validate.js';
import { buildSampleShowcase } from '../src/sample-vitrine.js';

const HOSTIL = 'normal;}</style><script>alert(1)</script>';
const perigoso = (html) => /<script|<\/style>\s*</i.test(html.replace(/<\/style>\s*<\/head>/i, ''));

test('isSafeCssValue: aceita valores legítimos e recusa os que escapam da declaração', () => {
  for (const ok of ['12px', 'rgba(1, 2, 3, 0.5)', '"IBM Plex Sans", sans-serif', 'url("data:image/png;base64,AAA=")', 'linear-gradient(90deg, #fff 0%, #000 100%)', 'calc(100% - 4px)', '1px solid #ccc !important']) {
    assert.equal(isSafeCssValue(ok), true, ok);
  }
  for (const bad of ['red;}</style><script>', 'a}b', 'a{b', '</style>', 'x/*y', 'url("a")}', '"aberta', 'fn(aberto', 'a;b']) {
    assert.equal(isSafeCssValue(bad), false, bad);
  }
});

test('safeIdent: só identificadores simples; o resto cai no valor padrão', () => {
  assert.equal(safeIdent('round', 'butt'), 'round');
  assert.equal(safeIdent('multiply', 'normal'), 'multiply');
  assert.equal(safeIdent(HOSTIL, 'normal'), 'normal');
  assert.equal(safeIdent('round" onload="x', 'round'), 'round');
  assert.equal(safeIdent(undefined, 'auto'), 'auto');
});

test('exportação: blend, cursor e contorno hostis não escapam do <style>', () => {
  const n = createNode('rect', { x: 0, y: 0, w: 10, h: 10 });
  n.blend = HOSTIL;
  n.cursor = HOSTIL;
  n.stroke = { ...defaultStroke(), width: 2, style: HOSTIL };
  const html = exportHtml(n, {});
  assert.equal(perigoso(html), false, html);
  assert.doesNotMatch(generateCode([n], null, {}).css ?? String(generateCode([n], null, {})), /<script/);
  assert.doesNotMatch(toCssText({ 'mix-blend-mode': HOSTIL, color: 'red' }), /<script|\}/);
});

test('exportação: imagem com endereço hostil não fecha o url() nem o <style>', () => {
  const n = createNode('rect', { x: 0, y: 0, w: 10, h: 10 });
  const fill = { ...defaultFill('#fff'), type: 'image', assetId: 'a1', fit: 'cover' };
  n.fill = fill;
  const html = exportHtml(n, { a1: '");}</style><script>alert(1)</script>' });
  assert.equal(perigoso(html), false, html);
});

test('sanitizeDoc: a vitrine de exemplo passa sem nenhuma alteração', () => {
  const doc = buildSampleShowcase();
  const before = JSON.stringify(doc);
  const warnings = sanitizeDoc(doc);
  assert.equal(JSON.stringify(doc), before);
  assert.deepEqual(warnings, []);
});

test('sanitizeDoc: remove imagem externa e endereço hostil; mantém data:image', () => {
  const doc = buildSampleShowcase();
  doc.assets = {
    boa: 'data:image/png;base64,iVBORw0KGgo=',
    svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"/>',
    externa: 'https://rastreador.example/x.png',
    hostil: '");}</style><script>alert(1)</script>',
    js: 'javascript:alert(1)',
    numero: 42,
  };
  const warnings = sanitizeDoc(doc);
  assert.deepEqual(Object.keys(doc.assets).sort(), ['boa', 'svg']);
  assert.ok(warnings.some((w) => /4 imagem/.test(w)), `avisos: ${warnings.join(' | ')}`);
});

test('sanitizeDoc: números inválidos viram o padrão e lixo estrutural não derruba', () => {
  const doc = {
    name: 'x',
    pages: [
      null,
      { id: 'p1', name: 5, children: [null, 'texto', { id: 'a', type: 'rect', x: NaN, y: Infinity, w: '10', h: 20, children: 'não é lista' }] },
      { id: 'p2', children: 'não é lista' },
    ],
    assets: null,
    styles: 7,
    comments: 'x',
  };
  assert.doesNotThrow(() => sanitizeDoc(doc));
  assert.ok(Array.isArray(doc.pages) && doc.pages.length >= 1);
  for (const p of doc.pages) assert.ok(Array.isArray(p.children));
  const rect = doc.pages[0].children[0];
  assert.equal(Number.isFinite(rect.x) && Number.isFinite(rect.y), true);
  assert.equal(typeof doc.assets, 'object');
});
