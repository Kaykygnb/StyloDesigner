// O exemplo "Vitrine" tem de usar de verdade os recursos que promete (e gerar HTML/CSS válido).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSampleShowcase } from '../src/sample-vitrine.js';
import { walk, hasBps, hasStates, STATE_LIST } from '../src/model.js';
import { generateCode, joinCss } from '../src/css.js';
import { pruneComments, commentsOf } from '../src/comments.js';

const doc = buildSampleShowcase();
const all = [];
for (const p of doc.pages) walk(p.children, (n) => { all.push(n); });
const site = doc.pages[0].children[0].children[0];

test('estrutura: 2 páginas, seção, tela raiz fluida e tela Obrigado', () => {
  assert.equal(doc.pages.length, 2);
  assert.equal(doc.pages[0].children[0].type, 'section');
  assert.equal(site.name, 'Página');
  assert.equal(site.fluid, true);
  assert.ok(doc.pages[0].children[0].children.some((n) => n.name === 'Obrigado'));
});

test('usa os recursos: componentes, instâncias, vetores, gradientes, vidro, grade, notas', () => {
  assert.ok(all.filter((n) => n.component).length >= 3);
  assert.ok(all.filter((n) => n.instanceOf).length >= 10);
  assert.ok(all.filter((n) => n.type === 'path').length >= 8);
  assert.ok(['linear', 'radial', 'conic'].every((t) => all.some((n) => n.fill?.type === t)));
  assert.ok(all.some((n) => n.bgBlur > 0) && all.some((n) => n.blur > 0));
  assert.ok(all.some((n) => n.layout?.mode === 'grid') && all.some((n) => n.layout?.mode === 'row') && all.some((n) => n.layout?.mode === 'column'));
  assert.ok(all.filter((n) => n.note).length >= 6);
  assert.ok(all.some((n) => n.truncate === 'clamp') && all.some((n) => n.overflow === 'scroll-x'));
  assert.ok(site.grids.length === 1);
});

test('estados com transição e cursor; HTML semântico; links', () => {
  for (const [state] of STATE_LIST) assert.ok(all.some((n) => hasStates(n, state)), state);
  assert.ok(all.some((n) => n.transition?.duration > 0 && n.cursor === 'pointer'));
  for (const tag of ['header', 'nav', 'section', 'footer', 'h1', 'h2', 'h3', 'p', 'a', 'button', 'ul', 'li']) assert.ok(all.some((n) => n.tag === tag), tag);
  assert.ok(all.some((n) => n.tag === 'a' && n.href === '#recursos'));
});

test('responsivo: ajustes em tablet e celular, grade 3 → 2 → 1, menu some no celular', () => {
  assert.ok(all.filter((n) => hasBps(n, 'tablet')).length >= 4);
  assert.ok(all.filter((n) => hasBps(n, 'mobile')).length >= 10);
  const grid = all.find((n) => n.name === 'Grade de recursos');
  assert.equal(grid.layout.cols, 3);
  assert.equal(grid.bps.tablet.layout.cols, 2);
  assert.equal(grid.bps.mobile.layout.cols, 1);
  assert.equal(all.find((n) => n.name === 'Menu').bps.mobile.visible, false);
});

test('modo escuro e variáveis: estilos com valor por modo e campos ligados', () => {
  assert.equal(doc.styles.modes.length, 1);
  assert.equal(doc.styles.modes[0].scheme, 'dark');
  assert.ok(doc.styles.colors.every((c) => c.modes?.[doc.styles.modes[0].id]?.color));
  assert.equal(doc.styles.vars.length, 4);
  assert.ok(all.some((n) => n.vars?.gap) && all.some((n) => n.vars?.radius) && all.some((n) => n.vars?.padding));
  assert.ok(doc.styles.texts.length === 5 && all.some((n) => n.textStyleId));
});

test('comentários: 3 (um resolvido, um com resposta) e nenhum órfão', () => {
  const cs = commentsOf(doc);
  assert.equal(cs.length, 3);
  assert.equal(cs.filter((c) => c.resolved).length, 1);
  assert.ok(cs.some((c) => c.replies.length === 1));
  assert.equal(pruneComments(doc), false);
});

test('prototipo: o botão do topo e o do hero levam a Obrigado, e ela volta à página', () => {
  const thanks = all.find((n) => n.name === 'Obrigado');
  assert.equal(all.find((n) => n.name === 'Botão do topo').interactions[0].target, thanks.id);
  assert.equal(all.find((n) => n.name === 'Botão do hero').interactions[0].target, thanks.id);
  assert.equal(all.find((n) => n.name === 'Botão voltar').interactions[0].target, site.id);
});

test('o HTML/CSS gerado: @media, variáveis, modo escuro, tags, hover, fluido', () => {
  const gen = generateCode([site], null, doc.assets, { root: true, styles: doc.styles });
  const css = joinCss([gen]);
  assert.ok(css.includes('@media (max-width: 1024px)') && css.includes('@media (max-width: 640px)'));
  assert.ok(css.includes(':root[data-theme="escuro"]') && css.includes('@media (prefers-color-scheme: dark)'));
  assert.ok(css.includes('var(--cor-fundo)') && css.includes('var(--espaco-l)') && css.includes('var(--raio-card)'));
  assert.ok(css.includes(':hover') && css.includes('transition: all 160ms') && css.includes('cursor: pointer'));
  assert.ok(css.includes('width: 100%') && css.includes('max-width: 1200px'));
  assert.ok(css.includes('conic-gradient') && css.includes('backdrop-filter') && css.includes('-webkit-line-clamp'));
  assert.ok(gen.html.includes('<header') && gen.html.includes('<nav') && gen.html.includes('<h1') && gen.html.includes('<footer'));
  assert.ok(gen.html.includes('<a class="link-recursos" href="#recursos">'));
  assert.ok(gen.html.includes('<!-- Título principal da página (h1)'));
  assert.ok(!/NaN|undefined/.test(css + gen.html), 'sem NaN/undefined no código');
});
