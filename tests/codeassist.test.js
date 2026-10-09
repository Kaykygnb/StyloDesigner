// Autocompletar do editor de código (src/codeassist.js): sugestões por contexto em CSS e HTML, busca fuzzy e Emmet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeCss, completeHtml, expandEmmet, emmetAbbrBefore, fuzzyMatch, scanCss, openTags, CARET, CSS_PROPERTIES } from '../src/codeassist.js';

/** Roda o autocompletar com o cursor onde está o "|". */
const at = (fn, text, opts) => {
  const pos = text.indexOf('|');
  return fn(text.replace('|', ''), pos, opts);
};
const labels = (r) => (r ? r.items.map((i) => i.label) : []);
const css = (t, o = {}) => at(completeCss, t, o);
const decls = (t, o = {}) => at(completeCss, t, { decls: true, ...o });
const html = (t, o = {}) => at(completeHtml, t, o);
const clean = (s) => s.replaceAll(CARET, '');

test('fuzzy: começo vale mais, iniciais de cada pedaço acham a propriedade', () => {
  assert.ok(fuzzyMatch('jc', 'justify-content').score > fuzzyMatch('jc', 'object-fit').score);
  assert.ok(fuzzyMatch('dis', 'display').score > fuzzyMatch('dis', 'text-decoration-skip-ink').score);
  assert.equal(fuzzyMatch('xyz', 'display').score, -1);
  assert.deepEqual(fuzzyMatch('bg', 'background').hits.length, 2);
});

test('lista de propriedades é a moderna e completa', () => {
  for (const p of ['display', 'gap', 'aspect-ratio', 'container-type', 'text-wrap', 'inset', 'scroll-snap-type', 'backdrop-filter', 'accent-color', 'view-transition-name'])
    assert.ok(CSS_PROPERTIES.includes(p), p);
  assert.ok(CSS_PROPERTIES.length > 300);
  assert.equal(new Set(CSS_PROPERTIES).size, CSS_PROPERTIES.length, 'sem repetidas');
});

test('CSS da camada: propriedade → insere "prop: " e pede os valores', () => {
  const r = decls('display: flex;\njustify-con|');
  assert.equal(r.context, 'property');
  assert.equal(r.items[0].label, 'justify-content');
  assert.equal(r.items[0].insert, 'justify-content: ');
  assert.ok(r.items[0].retrigger);
  assert.equal(r.from, 'display: flex;\n'.length);
  assert.equal(labels(decls('jc|'))[0], 'justify-content', 'fuzzy pelas iniciais');
  // editando um nome que já tem ":" depois: não duplica
  assert.equal(decls('colo|r: red;').items[0].insert, 'color');
  assert.equal(decls('|', {}), null, 'sem nada digitado não abre sozinho');
  assert.ok(decls('|', { manual: true }).items.length > 50, 'Ctrl+Espaço abre');
});

test('CSS: valores por propriedade, com ";" nas de um valor só', () => {
  assert.deepEqual(labels(decls('display: |')).slice(0, 3), ['flex', 'grid', 'block']);
  assert.equal(decls('display: |').items[0].insert, 'flex;');
  assert.equal(decls('display: |;').items[0].insert, 'flex', 'já tem ; depois');
  for (const [p, v] of [['position', 'sticky'], ['align-items', 'center'], ['flex-direction', 'column'], ['text-align', 'justify'], ['font-weight', '700'],
    ['cursor', 'pointer'], ['overflow', 'hidden'], ['white-space', 'nowrap'], ['grid-auto-flow', 'dense'], ['object-fit', 'cover']])
    assert.ok(labels(decls(`${p}: |`)).includes(v), `${p} → ${v}`);
  assert.deepEqual(labels(decls('justify-content: sb|')).slice(0, 1), ['space-between']);
  assert.ok(labels(decls('display: |')).includes('inherit'), 'valores globais');
  assert.equal(decls('grid-template-columns: |').items.find((i) => i.label === 'repeat()').insert, `repeat(${CARET})`);
});

test('CSS: unidades depois de números (e nada em propriedades sem unidade)', () => {
  assert.deepEqual(labels(decls('width: 16|')).slice(0, 3), ['16px', '16rem', '16%']);
  assert.deepEqual(labels(decls('width: 16r|')), ['16rem']);
  assert.ok(labels(decls('grid-template-columns: 1|')).includes('1fr'));
  assert.ok(labels(decls('transition: opacity 2|')).includes('2ms'));
  assert.ok(labels(decls('rotate: 45|')).includes('45deg'));
  assert.equal(decls('opacity: 5|'), null);
  assert.equal(decls('z-index: 1|'), null);
  assert.equal(decls('margin: 0|'), null, 'zero não precisa de unidade');
});

test('CSS: funções, cores e variáveis do documento', () => {
  const vars = [{ name: '--cor-primaria', value: '#e11d74', kind: 'color', label: 'Primária' }, { name: '--espaco-md', value: '16px', kind: 'size', label: 'Espaço' }];
  const c = decls('color: |', { vars, colors: [{ name: 'Primária', value: '#E11D74' }] });
  assert.equal(c.items[0].label, 'var(--cor-primaria)');
  assert.equal(c.items[0].color, '#e11d74', 'prévia da cor');
  assert.ok(labels(c).includes('rgb()') && labels(c).includes('hsl()') && labels(c).includes('red'));
  assert.equal(labels(decls('color: rebe|'))[0], 'rebeccapurple', 'todas as cores com nome');
  assert.ok(!labels(c).includes('var(--espaco-md)'), 'variável de tamanho não aparece em cor');
  const g = decls('gap: |', { vars });
  assert.ok(labels(g).includes('var(--espaco-md)') && labels(g).includes('clamp()') && labels(g).includes('calc()') && labels(g).includes('min()') && labels(g).includes('max()'));
  assert.ok(labels(decls('gap: var(|)', { vars })).includes('--espaco-md'), 'dentro de var( só o nome');
  assert.equal(decls('padding: --esp|', { vars }).items[0].insert, 'var(--espaco-md)');
  assert.deepEqual(labels(decls('color: #|', { colors: [{ name: 'Primária', value: '#E11D74' }] })), ['#E11D74']);
  assert.ok(labels(decls('background: lin|')).includes('linear-gradient()'));
  assert.ok(labels(decls('background: linear-gradient(|)')).includes('to right'));
  assert.ok(labels(decls('grid-template-columns: repeat(|)')).includes('auto-fill'));
  assert.ok(labels(decls('grid-template-columns: repeat(auto-fill, |)')).includes('minmax()'));
  assert.ok(labels(decls('transform: |')).includes('translate()'));
  assert.ok(labels(decls('filter: |')).includes('blur()'));
  // variáveis declaradas no próprio texto também
  assert.ok(labels(css(':root { --raio: 8px; }\n.a { border-radius: var(|) }')).includes('--raio'));
});

test('CSS da página: seletores (classes/ids do projeto, etiquetas, pseudo) e blocos', () => {
  const o = { classes: ['card', 'cabecalho'], ids: ['topo'] };
  assert.deepEqual(labels(css('.ca|', o)), ['.card', '.cabecalho']);
  assert.deepEqual(labels(css('#t|', o)), ['#topo']);
  assert.equal(labels(css('.card:ho|', o))[0], ':hover');
  assert.ok(labels(css('a::|', o)).includes('::before'));
  assert.equal(css('li:nth|', o).items[0].insert, `:nth-child(${CARET})`);
  assert.ok(labels(css('na|', o)).includes('nav'));
  // dentro do bloco: propriedades; dentro do @media: seletores de novo
  assert.equal(css('.card {\n  backg|\n}').context, 'property');
  assert.equal(css('@media (max-width: 600px) {\n  .ca|\n}', o).context, 'selector');
  assert.equal(css('@media (max-width: 600px) {\n  .card { colo| }\n}').context, 'property');
  assert.equal(css('@keyframes x {\n  fr|').items[0].label, 'from');
  assert.equal(css('@keyframes x {\n  from { opa|').context, 'property');
  assert.equal(css('/* .ca| */', o), null, 'nada dentro de comentário');
  assert.equal(css('.a { content: "te|" }'), null, 'nada dentro de texto');
});

test('CSS: @media com os breakpoints do projeto, @keyframes e @supports', () => {
  const o = { breakpoints: [{ name: 'Tablet', max: 1024 }, { name: 'Celular', max: 640 }] };
  const r = css('@me|', o);
  assert.equal(r.context, 'at');
  const mob = r.items.find((i) => i.label === '@media (max-width: 640px)');
  assert.equal(mob.detail, 'Celular');
  assert.equal(mob.insert, `@media (max-width: 640px) {\n  ${CARET}\n}`);
  assert.ok(labels(css('@ke|', o)).includes('@keyframes'));
  assert.ok(labels(css('@sup|', o)).includes('@supports'));
  const feat = labels(css('@media (|', o));
  assert.ok(feat.includes('(max-width: 1024px)') && feat.includes('(prefers-color-scheme: dark)'));
});

test('scanCss acha o bloco e a declaração atuais', () => {
  const s = scanCss('.a { color: red; } @media (x) { .b { gap: 1', 44);
  assert.deepEqual(s.stack, ['@media (x)', '.b']);
  assert.equal(s.stmt.trim(), 'gap: 1');
});

test('HTML: etiquetas, fechamento e atributos por etiqueta', () => {
  assert.equal(html('<di|').items[0].label, 'div');
  assert.ok(html('<|').items.length > 50, 'logo depois de < já sugere');
  assert.deepEqual(labels(html('<div>\n  <p>oi</p>\n  </|')), ['/div']);
  assert.equal(html('<section><div></|').items[0].insert, '/div>');
  const a = html('<a |');
  assert.ok(labels(a).slice(0, 3).includes('href'));
  assert.equal(a.items.find((i) => i.label === 'href').insert, `href="${CARET}"`);
  assert.equal(html('<input dis|').items[0].insert, 'disabled', 'atributo booleano sem valor');
  assert.equal(html('<img src="x" s|').items.find((i) => i.label === 'src'), undefined, 'não repete atributo usado');
  assert.ok(labels(html('<div ar|')).includes('aria-label'), 'atributos globais/aria');
});

test('HTML: valores de atributos (type, target, classes do projeto)', () => {
  assert.ok(labels(html('<input type="|"')).includes('email'));
  assert.deepEqual(labels(html('<button type="|"')), ['button', 'submit', 'reset']);
  assert.ok(labels(html('<a target="_b|"')).includes('_blank'));
  assert.deepEqual(labels(html('<div class="titulo ca|"', { classes: ['card', 'titulo'] })), ['card']);
  assert.ok(labels(html('<label for="|"', { ids: ['email'] })).includes('email'));
  assert.equal(html('<!-- <di| -->'), null, 'nada em comentário');
});

test('HTML: texto oferece etiqueta (com fechamento) e abreviação Emmet', () => {
  const t = html('<div>\n  sec|');
  assert.equal(t.items[0].label, 'section');
  assert.equal(t.items[0].insert, `<section>${CARET}</section>`);
  const e = html('  div.card>h2+p|');
  assert.equal(e.context, 'emmet');
  assert.equal(e.from, 2);
  assert.match(e.items[0].doc, /<div class="card">/);
  assert.equal(html('<p>Olá, mundo|'), null, 'texto comum não abre nada');
});

test('Emmet: filhos, irmãos, classes, ids, atributos, texto, repetição com $ e subir', () => {
  assert.equal(clean(expandEmmet('div.card>h2+p')), '<div class="card">\n  <h2></h2>\n  <p></p>\n</div>');
  assert.equal(expandEmmet('div.card>h2+p').indexOf(CARET), '<div class="card">\n  <h2>'.length, 'cursor no primeiro lugar vazio');
  assert.equal(clean(expandEmmet('ul>li.item$*3>a{Item $}')), '<ul>\n  <li class="item1"><a href="">Item 1</a></li>\n  <li class="item2"><a href="">Item 2</a></li>\n  <li class="item3"><a href="">Item 3</a></li>\n</ul>');
  assert.equal(clean(expandEmmet('section#topo.hero.escuro')), '<section id="topo" class="hero escuro"></section>');
  assert.equal(clean(expandEmmet('a[href=#contato target=_blank]{Fale}')), '<a href="#contato" target="_blank">Fale</a>');
  assert.equal(clean(expandEmmet('img')), '<img src="" alt="">');
  assert.equal(clean(expandEmmet('input:email')), '<input type="email">', 'input:tipo');
  assert.equal(clean(expandEmmet('div{')), '', 'inválido vira vazio (não quebra)');
  assert.equal(clean(expandEmmet('ul>.x')), '<ul>\n  <li class="x"></li>\n</ul>', 'etiqueta implícita');
  assert.equal(clean(expandEmmet('header>nav^main')), '<header>\n  <nav></nav>\n</header>\n<main></main>');
  assert.equal(clean(expandEmmet('(dt+dd)*2')), '<dt></dt>\n<dd></dd>\n<dt></dt>\n<dd></dd>');
  assert.equal(clean(expandEmmet('p>span+strong')), '<p><span></span><strong></strong></p>', 'filhos de linha na mesma linha');
  assert.equal(expandEmmet('div>'), '');
  assert.equal(expandEmmet('ol>li*'), '');
});

test('emmetAbbrBefore pega só a abreviação antes do cursor', () => {
  assert.equal(emmetAbbrBefore('  ul>li*3'), 'ul>li*3');
  assert.equal(emmetAbbrBefore('<div>p.nota'), 'p.nota');
  assert.equal(emmetAbbrBefore('texto a[href=x y]'), 'a[href=x y]');
  assert.equal(emmetAbbrBefore('<p>Olá '), '');
});

test('openTags lista as etiquetas abertas', () => {
  assert.deepEqual(openTags('<div><p>oi</p><ul><li>a</li><img src=x><br/>'), ['div', 'ul']);
});
