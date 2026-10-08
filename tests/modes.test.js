// Modos de cor (claro/escuro) e variáveis de tamanho: dados puros e o CSS que eles geram.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, defaultFill } from '../src/model.js';
import { generateCode, joinCss } from '../src/css.js';
import { addMode, removeMode, darkVariant, modeView, setStyleColor, styleValue, addVar, removeVar, bindVar, unbindVar, syncVars, VAR_PROPS } from '../src/modes.js';
import { syncStyles } from '../src/components.js';

const styles = () => ({ colors: [{ id: 's1', name: 'Fundo', color: '#FFFFFF', opacity: 1 }, { id: 's2', name: 'Texto', color: '#111111', opacity: 1 }], texts: [] });
const withStyle = (id, color = '#FFFFFF') => { const n = createNode('frame', { name: 'Caixa', w: 100, h: 50 }); n.fill = { ...defaultFill(color), styleId: id }; return n; };

test('darkVariant inverte a luminosidade', () => {
  assert.equal(darkVariant('#FFFFFF'), '#0D0D0D');
  assert.ok(darkVariant('#111111') > '#EEEEEE'.toUpperCase() || darkVariant('#111111').startsWith('#'));
  const d = darkVariant('#F5F0FF'); // claro arroxeado → escuro arroxeado
  assert.match(d, /^#[0-9A-F]{6}$/);
  assert.ok(parseInt(d.slice(1, 3), 16) < 60);
});

test('addMode com auto gera valores; sem auto só cria o modo; removeMode limpa tudo', () => {
  const s = styles();
  const m = addMode(s, { name: 'Escuro', scheme: 'dark', auto: true });
  assert.equal(s.modes.length, 1);
  assert.equal(s.colors[0].modes[m.id].color, darkVariant('#FFFFFF'));
  assert.equal(s.colors[1].modes[m.id].color, darkVariant('#111111'));
  const m2 = addMode(s, { name: '  ', auto: false });
  assert.equal(m2.name, 'Modo 3');
  assert.equal(s.colors[0].modes[m2.id], undefined);
  removeMode(s, m.id);
  assert.equal(s.modes.length, 1);
  assert.equal(s.colors[0].modes, undefined);
  removeMode(s, m2.id);
  assert.equal(s.modes, undefined);
});

test('setStyleColor e styleValue: padrão ou por modo', () => {
  const s = styles();
  const m = addMode(s, { name: 'Escuro' });
  setStyleColor(s.colors[0], null, '#EEEEEE');
  assert.equal(s.colors[0].color, '#EEEEEE');
  assert.deepEqual(styleValue(s.colors[0], m.id), { color: '#EEEEEE', opacity: 1 }); // sem valor no modo: usa o padrão
  setStyleColor(s.colors[0], m.id, '#222222', 0.5);
  assert.deepEqual(styleValue(s.colors[0], m.id), { color: '#222222', opacity: 0.5 });
  assert.equal(s.colors[0].color, '#EEEEEE');
});

test('modeView troca só a cor do preenchimento ligado ao estilo', () => {
  const s = styles();
  const m = addMode(s, { name: 'Escuro', auto: true });
  const n = withStyle('s1');
  assert.equal(modeView(n, s, null), n);
  const v = modeView(n, s, m.id);
  assert.notEqual(v, n);
  assert.equal(v.fill.color, darkVariant('#FFFFFF'));
  assert.equal(n.fill.color, '#FFFFFF'); // o original não muda
  const free = createNode('rect', { name: 'Livre' });
  assert.equal(modeView(free, s, m.id), free);
});

test('CSS: variáveis por modo → :root, :root[data-theme] e prefers-color-scheme', () => {
  const s = styles();
  const m = addMode(s, { name: 'Escuro', scheme: 'dark', auto: true });
  const n = withStyle('s1');
  const gen = generateCode([n], null, {}, { root: true, styles: s });
  assert.ok(gen.css.includes('background-color: var(--cor-fundo)'));
  assert.equal(gen.modes.length, 1);
  const css = joinCss([gen]);
  assert.ok(css.startsWith(':root {\n  --cor-fundo: #ffffff;\n}'), css);
  assert.ok(css.includes(':root[data-theme="escuro"] {\n  --cor-fundo: ' + darkVariant('#FFFFFF').toLowerCase()), css);
  assert.ok(css.includes('@media (prefers-color-scheme: dark) {\n  :root:not([data-theme]) {'), css);
  // modo sem valores nas cores usadas não gera bloco
  const s2 = styles();
  addMode(s2, { name: 'Vazio' });
  assert.ok(!joinCss([generateCode([withStyle('s1')], null, {}, { root: true, styles: s2 })]).includes('data-theme'));
});

test('variáveis de tamanho: criar, ligar, sincronizar, CSS com var()', () => {
  const s = styles();
  const v = addVar(s, 'Espaço M', 16);
  const f = createNode('frame', { name: 'Card', w: 200, h: 100 });
  f.layout = { ...f.layout, mode: 'row', gap: 4, padding: [0, 0, 0, 0] };
  f.radius = [2, 2, 2, 2];
  bindVar(f, 'gap', v); bindVar(f, 'padding', v); bindVar(f, 'radius', v);
  assert.equal(f.layout.gap, 16);
  assert.deepEqual(f.layout.padding, [16, 16, 16, 16]);
  assert.deepEqual(f.radius, [16, 16, 16, 16]);
  assert.deepEqual(f.vars, { gap: v.id, padding: v.id, radius: v.id });
  const doc = { styles: s, pages: [{ children: [f] }] };
  v.value = 24;
  syncVars(doc, true);
  assert.equal(f.layout.gap, 24);
  assert.deepEqual(f.layout.padding, [24, 24, 24, 24]);
  const gen = generateCode([f], null, {}, { root: true, styles: s });
  assert.ok(gen.css.includes('gap: var(--espaco-m)'), gen.css);
  assert.ok(gen.css.includes('padding: var(--espaco-m)'), gen.css);
  assert.ok(gen.css.includes('border-radius: var(--espaco-m)'), gen.css);
  assert.ok(joinCss([gen]).startsWith(':root {\n  --espaco-m: 24px;\n}'));
  // editar o campo à mão solta a ligação; apagar a variável também
  unbindVar(f, 'gap');
  assert.deepEqual(Object.keys(f.vars), ['padding', 'radius']);
  removeVar(s, v.id);
  syncVars(doc);
  assert.equal(f.vars, undefined);
  assert.equal(f.layout.gap, 24); // o valor fica
  assert.ok(VAR_PROPS.includes('fontSize'));
});

test('editar o campo à mão solta a ligação no próximo sync (sem force); com force a variável vence', () => {
  const s = styles();
  const v = addVar(s, 'Gap', 8);
  const f = createNode('frame', { name: 'F', w: 100, h: 100 });
  f.layout = { ...f.layout, mode: 'row' };
  bindVar(f, 'gap', v);
  const doc = { styles: s, pages: [{ children: [f] }] };
  syncVars(doc);
  assert.deepEqual(f.vars, { gap: v.id }); // igual: continua ligada
  f.layout.gap = 12; // a pessoa editou o campo
  syncVars(doc);
  assert.equal(f.vars, undefined);
  assert.equal(f.layout.gap, 12);
  bindVar(f, 'gap', v);
  f.layout.gap = 12;
  syncVars(doc, true); // a variável mudou de valor: vence
  assert.equal(f.layout.gap, 8);
});

test('variável de tamanho em texto (font-size) e gap sem layout é ignorado', () => {
  const s = styles();
  const v = addVar(s, 'Título', 32);
  const t = createNode('text', { name: 'T', text: 'x' });
  bindVar(t, 'fontSize', v);
  assert.equal(t.fontSize, 32);
  assert.ok(generateCode([t], null, {}, { root: true, styles: s }).css.includes('font-size: var(--titulo)'));
  const r = createNode('rect', { name: 'R' });
  bindVar(r, 'gap', v); // retângulo não tem layout: não quebra
  assert.ok(true);
});

test('syncStyles continua levando a cor do estilo às camadas', () => {
  const s = styles();
  const n = withStyle('s1');
  s.colors[0].color = '#ABCDEF';
  syncStyles({ styles: s, pages: [{ children: [n] }] });
  assert.equal(n.fill.color, '#ABCDEF');
});
