// Código à mão: sanitização do HTML, CSS da página (canvas e exportação), atributos HTML e o CSS da camada editado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, defaultLayout } from '../src/model.js';
import { exportHtml, generateCode } from '../src/css.js';
import { sanitizeHtml, safeUrl, scopeSelector, scopePageCss, safePageCss, lintCss, htmlAttrs, cleanId, cleanClasses } from '../src/html.js';
import { applyLayerCss, lintLayerCss, layerCssText, parseColor } from '../src/cssedit.js';

test('sanitizeHtml remove script, on*, javascript: e iframe sem https', () => {
  const { html, removed } = sanitizeHtml(`<div onclick="x()"><script>alert(1)</script><p>Oi</p>
<a href="javascript:alert(1)">a</a><a href="JaVa\tScRiPt:alert(1)">b</a><a href="https://ok.dev" target="_blank">c</a>
<img src="x.png" onerror="alert(1)"><iframe src="http://x.dev"></iframe><iframe src="javascript:alert(1)"></iframe>
<style>body{display:none}</style><object data="x"></object><svg><use href="https://mal.dev/x.svg#a"/></svg></div>`);
  assert.doesNotMatch(html, /<script|onclick|onerror|javascript:|<style|<object|<iframe|mal\.dev/i);
  assert.match(html, /<p>Oi<\/p>/);
  assert.match(html, /<a href="https:\/\/ok\.dev" target="_blank" rel="noopener noreferrer">c<\/a>/);
  assert.match(html, /<img src="x\.png">/);
  assert.ok(removed.includes('<script>') && removed.includes('atributo onclick'));
});

test('sanitizeHtml aceita iframe https (com sandbox), svg e escapa < solto', () => {
  const { html } = sanitizeHtml('<iframe src="https://www.youtube.com/embed/x" sandbox=""></iframe> 1 < 2 <svg viewBox="0 0 2 2"><path d="M0 0"/></svg>');
  assert.match(html, /<iframe src="https:\/\/www\.youtube\.com\/embed\/x" sandbox="allow-scripts[^"]*" loading="lazy"><\/iframe>/);
  assert.match(html, /1 &lt; 2/);
  assert.match(html, /<svg viewBox="0 0 2 2"><path d="M0 0" \/><\/svg>/);
});

test('sandbox imposto ao iframe substitui atributos com qualquer caixa e duplicatas', () => {
  const required = 'sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"';
  for (const supplied of ['Sandbox=""', 'sandbox="" sandbox="allow-scripts"', 'SANDBOX="allow-scripts allow-same-origin"']) {
    const { html } = sanitizeHtml(`<iframe src="https://example.com/embed" ${supplied}></iframe>`);
    assert.equal((html.match(/\bsandbox=/gi) || []).length, 1, supplied);
    assert.ok(html.includes(required), html);
  }
});

test('target equivalente a _blank recebe rel seguro mesmo com opener ou rel duplicado', () => {
  const { html } = sanitizeHtml('<a href="https://example.com" TARGET="_BLANK" rel="opener" REL="external">link</a>');
  assert.match(html, /target="_BLANK" rel="external noopener noreferrer"/);
  assert.equal((html.match(/\brel=/gi) || []).length, 1);
  assert.doesNotMatch(html, /\bopener\b/);
});

test('safeUrl só deixa esquemas seguros', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl(' jav&#x09;ascript:x'.replace('&#x09;', '\t')), '');
  assert.equal(safeUrl('data:text/html,<b>'), '');
  assert.equal(safeUrl('data:image/png;base64,AA', { image: true }), 'data:image/png;base64,AA');
  assert.equal(safeUrl('#secao'), '#secao');
  assert.equal(safeUrl('mailto:a@b.c'), 'mailto:a@b.c');
});

test('camada "Código HTML" exporta o HTML limpo dentro da caixa', () => {
  const tela = createNode('frame', { name: 'Tela', w: 400, h: 300 });
  const emb = createNode('html', { name: 'Banner', html: '<h2>Oi</h2><img src=x onerror=alert(1)><script>x</script>' });
  tela.children.push(emb);
  const out = exportHtml(tela, {}, 'T');
  assert.match(out, /<div class="banner">\s*<h2>Oi<\/h2><img src="x">\s*<\/div>/);
  assert.doesNotMatch(out, /onerror|<script>x/);
});

test('CSS da página vai para o HTML exportado (depois das regras), limpo e com @media/@keyframes', () => {
  const tela = createNode('frame', { name: 'Tela' });
  const styles = { colors: [], texts: [], pageCss: '.tela:hover { opacity: .9 }\n@media (max-width: 600px) { .tela { padding: 8px } }\n@keyframes a { to { opacity: 1 } }\n.x { background: url(javascript:alert(1)); color: red }\n.y { content: "</style><script>alert(1)</script>" }' };
  const out = exportHtml(tela, {}, 'T', styles);
  const i = out.indexOf('/* CSS da página */');
  assert.ok(i > out.indexOf('.tela {'), 'vem depois das regras das camadas');
  assert.match(out, /\.tela:hover \{\n {2}opacity: \.9;\n\}/);
  assert.match(out, /@media \(max-width: 600px\) \{\n {2}\.tela \{/);
  assert.match(out, /@keyframes a/);
  assert.doesNotMatch(out, /javascript:/);
  assert.equal(out.match(/<\/style>/g).length, 1, 'o CSS da página não fecha o <style>');
  assert.doesNotMatch(safePageCss('.x{color:red}'), /<\//);
});

test('fontes importadas de projeto não conseguem injetar regras no CSS exportado', () => {
  const texto = createNode('text', { name: 'Fonte', text: 'Seguro', fontFamily: 'Inter"; }\n.pwned { color: red }\n/*' });
  const html = exportHtml(texto, {}, 'Fonte');
  assert.doesNotMatch(html, /^\s*\.pwned\s*\{/m);
  assert.equal((html.match(/font-family:/g) || []).length, 2, 'só as declarações do reset e da camada são emitidas');
});

test('@import da página permite Google Fonts e rejeita CSS remoto arbitrário no editor e no export', () => {
  const css = '@import url("https://fonts.googleapis.com/css2?family=Inter");\n@import "https://attacker.example/theme.css";\n.card { color: red }';
  for (const safe of [safePageCss(css), scopePageCss(css)]) {
    assert.match(safe, /fonts\.googleapis\.com/);
    assert.doesNotMatch(safe, /attacker\.example/);
  }
});

test('scopeSelector prende os seletores ao canvas', () => {
  assert.equal(scopeSelector('.card:hover', '.world'), '.world :is([data-cls~="card"], .card):hover');
  assert.equal(scopeSelector('body h1, #topo', '.world'), '.world :is([data-tag="h1"], h1), .world :is([data-hid="topo"], #topo)');
  assert.equal(scopeSelector(':root', '.world'), '.world');
  assert.equal(scopeSelector('li:nth-child(odd)', '.world'), '.world :is([data-tag="li"], li):nth-child(odd)');
  const css = scopePageCss('.a { color: red }\n@media (max-width: 9px) { .a { color: blue } }');
  assert.match(css, /\.world :is\(\[data-cls~="a"\], \.a\) \{\n {2}color: red !important;/);
  assert.match(css, /@media \(max-width: 9px\) \{\n {2}\.world/);
});

test('lintCss aponta chaves faltando, valores bloqueados e propriedades desconhecidas com a linha', () => {
  const list = lintCss('.a {\n  colr: red;\n  color: url(javascript:x);\n}\n.b { color: red', (p) => p !== 'colr');
  assert.deepEqual(list.map((d) => [d.line, d.level]), [[2, 'warn'], [3, 'error'], [5, 'error']]);
});

test('atributos HTML: id, classes extras, title, role, target/rel, type do botão', () => {
  const link = createNode('text', { name: 'Saiba mais', text: 'Saiba', tag: 'a', href: 'javascript:alert(1)', htmlId: 'cta', classes: 'botao  botao <x>', title: 'Abre "nova" aba', role: 'link', target: '_blank' });
  const btn = createNode('text', { name: 'Enviar', text: 'Enviar', tag: 'button', buttonType: 'submit' });
  const { html } = generateCode([link, btn], null, {});
  assert.match(html, /<a class="saiba-mais botao" id="cta" title="Abre &quot;nova&quot; aba" role="link" target="_blank" rel="noopener noreferrer" href="#">/);
  assert.match(html, /<button class="enviar" type="submit">/);
  assert.equal(cleanId('1abc'), '');
  assert.deepEqual(cleanClasses('a b a 9x'), ['a', 'b']);
  assert.equal(htmlAttrs({ role: 'x" onclick="y' }, 'div'), '');
});

test('novas etiquetas (figure, blockquote, time, code) chegam ao HTML', () => {
  const fig = createNode('frame', { name: 'Figura', tag: 'figure' });
  fig.children.push(createNode('text', { name: 'Legenda', text: 'Legenda', tag: 'figcaption' }), createNode('text', { name: 'Data', text: 'hoje', tag: 'time', dateTime: '2026-10-09' }));
  const { html } = generateCode([fig], null, {});
  assert.match(html, /<figure class="figura">/);
  assert.match(html, /<figcaption class="legenda">Legenda<\/figcaption>/);
  assert.match(html, /<time class="data" datetime="2026-10-09">hoje<\/time>/);
});

test('CSS da camada editado: mapeia para o modelo, o resto vai ao CSS livre, apagadas viram unset', () => {
  const card = createNode('frame', { name: 'Card', x: 10, y: 20, w: 200, h: 100 });
  card.layout = { ...defaultLayout(), mode: 'column', gap: 8 };
  const text = layerCssText(card, null, {})
    .replace('width: 200px', 'width: 240px')
    .replace('gap: 8px', 'gap: 12px')
    .replace(/background-color: [^;]+/, 'background-color: rgba(255, 0, 0, 0.5)')
    .replace(/^overflow:.*$/m, '') + '\ncursor: pointer;\nbox-shadow: 0 2px 4px #0003;';
  const rep = applyLayerCss(card, null, {}, text);
  assert.equal(card.w, 240);
  assert.equal(card.layout.gap, 12);
  assert.deepEqual([card.fill.color, card.fill.opacity], ['#FF0000', 0.5]);
  assert.match(card.customCss, /cursor: pointer;/);
  assert.match(card.customCss, /box-shadow: 0 2px 4px #0003;/);
  assert.match(card.customCss, /overflow: unset;/);
  assert.deepEqual(rep.unset, ['overflow']);
  assert.doesNotMatch(card.customCss, /width|gap|background/, 'o que virou campo não se repete no CSS livre');
  // reaplicar o mesmo texto não muda nada
  const again = layerCssText(card, null, {});
  applyLayerCss(card, null, {}, again);
  assert.equal(layerCssText(card, null, {}), again);
});

test('lintLayerCss e parseColor', () => {
  assert.equal(lintLayerCss('color: red;\n.x { }')[0].level, 'error');
  assert.equal(lintLayerCss('color: red\nwidth: 2px;')[0].msg.includes('faltou ";"'), true);
  assert.deepEqual(parseColor('#abc'), { color: '#AABBCC', opacity: 1 });
  assert.deepEqual(parseColor('rgb(0 128 255 / 50%)'), { color: '#0080FF', opacity: 0.5 });
  assert.equal(parseColor('red'), null);
});

test('painel Design volta a mandar: a edição tira do CSS livre só o que mudou', async () => {
  const { releaseOverrides } = await import('../src/cssedit.js');
  const n = { customCss: 'width: 500px;\nborder-radius: 40px;\ninset: 0;' };
  const freed = releaseOverrides(n, { width: '200px', left: '10px' }, { width: '320px', left: '30px' });
  assert.deepEqual(freed.sort(), ['inset', 'width']);
  assert.equal(n.customCss, 'border-radius: 40px;');
  assert.deepEqual(releaseOverrides({ customCss: 'color: red;' }, { width: '1px' }, { width: '1px' }), []);
});
