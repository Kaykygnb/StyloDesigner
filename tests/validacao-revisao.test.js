// Falhas reais apontadas pela revisão independente (Codex Astra, somente leitura) sobre a validação de projetos de
// terceiros: escapes e caracteres de controle que o navegador interpreta diferente do filtro, recursão sem limite,
// chaves que enganam a conversão de tipos e seletor/id que escapam do <style> e do atributo SVG.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeCssValue, cssRule, nodeStyle } from '../src/css.js';
import { sanitizeDoc } from '../src/validate.js';
import { createNode } from '../src/model.js';

test('isSafeCssValue: escapes e caracteres de controle que o navegador trata diferente são recusados', () => {
  const bad = [
    '\\";}body{background-image:url(https://tracker.invalid/p)}/*"', // \" fora de aspas
    '\\(;background-image:url(https://tracker.invalid/p);--x:\\)', // \( fora de aspas
    '"\r;}body{x:1}/*"', // CR dentro de string
    '"\f;}body{x:1}/*"', // FF dentro de string
    'u\\72l(https://tracker.invalid/p)', // url escrito com escape
    'url(https://tracker.invalid/p)',
    'url("https://tracker.invalid/p")',
    'image-set("https://tracker.invalid/p" 1x)',
    '-webkit-image-set(url(data:image/png;base64,AA==) 1x)',
    'a\u0000b',
  ];
  for (const v of bad) assert.equal(isSafeCssValue(v), false, JSON.stringify(v));
  const ok = ['url("data:image/png;base64,AAA=")', 'url(#clip)', 'url("#clip")', '"Inter\\"x", sans-serif', 'ease-in-out', 'cubic-bezier(0.4, 0, 0.2, 1)', 'rotate(45deg) scale(1.2)', '1px solid #ccc !important'];
  for (const v of ok) assert.equal(isSafeCssValue(v), true, JSON.stringify(v));
});

test('cssRule descarta regra cujo seletor tenta fechar o <style>', () => {
  assert.equal(cssRule('</style><img src="https://tracker.invalid/p"><style>', { color: 'red' }), '');
  assert.equal(cssRule('.a{}b', { color: 'red' }), '');
  assert.match(cssRule('.card:hover > .x', { color: 'red' }), /^\.card:hover > \.x \{/);
});

test('sanitizeDoc: aninhamento muito profundo não estoura a pilha', () => {
  const json = '{"pages":[{"id":"p","children":[' + '{"id":"n","type":"group","children":['.repeat(20000) + '{"id":"leaf","type":"frame"}' + ']}'.repeat(20000) + ']}]}';
  const doc = JSON.parse(json);
  let warnings;
  assert.doesNotThrow(() => { warnings = sanitizeDoc(doc); });
  assert.ok(warnings.some((w) => /profund/i.test(w)), warnings.join(' | '));
});

test('sanitizeDoc: chaves que enganam a conversão de tipos (toString, valueOf, __proto__) são removidas em qualquer nível', () => {
  const doc = JSON.parse('{"pages":[{"id":"p","children":[{"id":"n","type":"frame","transition":{"duration":{"toString":null},"easing":"ease"},"fill":{"type":"radial","color":"#fff","opacity":1,"stops":[{"pos":0,"color":"#f00","opacity":{"valueOf":1}},{"pos":100,"color":"#00f","opacity":1}]},"__proto__":{"polluido":true}}]}]}');
  sanitizeDoc(doc);
  doc.pages[0].children[0] = { ...createNode('frame'), ...doc.pages[0].children[0] }; // nó completo, como o editor cria
  const n = doc.pages[0].children[0];
  assert.equal(Object.hasOwn(n.transition.duration ?? {}, 'toString'), false);
  assert.equal(Object.hasOwn(n.fill.stops[0].opacity ?? {}, 'valueOf'), false);
  assert.equal(Object.hasOwn(n, '__proto__'), false);
  assert.doesNotThrow(() => nodeStyle(n, null, {}));
  assert.equal({}.polluido, undefined);
});

test('sanitizeDoc: id com aspas ou símbolos é substituído (vira atributo SVG e seletor)', () => {
  const doc = { pages: [{ id: 'p', children: [{ id: 'x" data-owned="yes', type: 'frame' }] }] };
  const warnings = sanitizeDoc(doc);
  assert.match(doc.pages[0].children[0].id, /^[\w~-]{1,200}$/);
  assert.ok(warnings.length >= 1);
});
