// Responsivo: visões por breakpoint (cascata), edição por diferença, CSS em @media, largura fluida, ocultar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, bpView, editBp, hasBps, bpsUpTo, BP_KEYS, BREAKPOINTS } from '../src/model.js';
import { generateCode } from '../src/css.js';

const row = () => {
  const f = createNode('frame', { name: 'Cartao', w: 800, h: 300 });
  f.layout = { ...f.layout, mode: 'row', gap: 24, padding: [16, 16, 16, 16], justify: 'flex-start', align: 'flex-start' };
  const a = createNode('rect', { name: 'Foto', w: 200, h: 100 });
  const b = createNode('text', { name: 'Texto', text: 'Olá', w: 200, h: 20 });
  f.children = [a, b];
  return { f, a, b };
};

test('cascata: celular vem depois do tablet', () => {
  assert.deepEqual(bpsUpTo('tablet'), ['tablet']);
  assert.deepEqual(bpsUpTo('mobile'), ['tablet', 'mobile']);
  assert.deepEqual(bpsUpTo(null), []);
  assert.deepEqual(BREAKPOINTS.map((b) => b.id), ['tablet', 'mobile']);
});

test('editBp guarda só a diferença e bpView aplica em cascata sem tocar na base', () => {
  const { a } = row();
  editBp(a, 'tablet', (d) => { d.w = 150; });
  editBp(a, 'mobile', (d) => { d.h = 60; });
  assert.equal(a.w, 200); assert.equal(a.h, 100);
  assert.deepEqual(a.bps, { tablet: { w: 150 }, mobile: { h: 60 } });
  assert.equal(bpView(a, null), a);
  assert.equal(bpView(a, 'tablet').w, 150);
  assert.equal(bpView(a, 'mobile').w, 150); // herda do tablet
  assert.equal(bpView(a, 'mobile').h, 60);
  assert.equal(bpView(a, 'tablet').h, 100);
  // voltar ao valor anterior da cascata remove a sobrescrita
  editBp(a, 'mobile', (d) => { d.h = 100; });
  assert.equal(a.bps.mobile, undefined);
  editBp(a, 'tablet', (d) => { d.w = 200; });
  assert.equal(a.bps, undefined);
  assert.equal(hasBps(a), false);
});

test('editBp: apagar uma propriedade vira null e bpView a remove; objetos aninhados não vazam para a base', () => {
  const { f, a } = row();
  a.minW = 100;
  editBp(a, 'mobile', (d) => { delete d.minW; });
  assert.equal(a.minW, 100);
  assert.equal(a.bps.mobile.minW, null);
  assert.equal(bpView(a, 'mobile').minW, undefined);
  editBp(f, 'mobile', (d) => { d.layout.mode = 'column'; d.layout.gap = 8; });
  assert.equal(f.layout.mode, 'row'); assert.equal(f.layout.gap, 24); // base intacta
  assert.equal(bpView(f, 'mobile').layout.mode, 'column');
  assert.equal(bpView(f, 'tablet').layout.mode, 'row');
  assert.ok(hasBps(f, 'mobile') && !hasBps(f, 'tablet'));
});

test('chaves fora de BP_KEYS (nome, texto) não ficam como sobrescrita', () => {
  const { b } = row();
  editBp(b, 'mobile', (d) => { d.name = 'Outro'; d.text = 'Mudou'; d.fontSize = 14; });
  assert.deepEqual(Object.keys(b.bps.mobile), ['fontSize']);
  assert.ok(BP_KEYS.includes('fontSize') && !BP_KEYS.includes('text') && !BP_KEYS.includes('name'));
});

test('generateCode: sem sobrescritas não escreve @media', () => {
  const { f } = row();
  assert.ok(!generateCode([f], null, {}, { root: true }).css.includes('@media'));
});

test('generateCode: o que muda no celular vira @media (max-width: 640px), em cima da cascata do tablet', () => {
  const { f, a, b } = row();
  editBp(f, 'tablet', (d) => { d.layout.padding = [8, 8, 8, 8]; });
  editBp(f, 'mobile', (d) => { d.layout.mode = 'column'; d.layout.gap = 8; });
  editBp(b, 'mobile', (d) => { d.fontSize = 14; });
  editBp(a, 'mobile', (d) => { d.visible = false; });
  const { css } = generateCode([f], null, {}, { root: true });
  const t = css.indexOf('@media (max-width: 1024px)'), m = css.indexOf('@media (max-width: 640px)');
  assert.ok(t > 0 && m > t, css);
  const tabletBlock = css.slice(t, m), mobileBlock = css.slice(m);
  assert.ok(tabletBlock.includes('.cartao {') && tabletBlock.includes('padding: 8px 8px 8px 8px'), tabletBlock);
  assert.ok(!tabletBlock.includes('flex-direction'), tabletBlock);
  assert.ok(mobileBlock.includes('flex-direction: column') && mobileBlock.includes('gap: 8px'), mobileBlock);
  assert.ok(!mobileBlock.includes('padding'), 'o padding veio do tablet, não muda no celular');
  assert.ok(mobileBlock.includes('.texto {') && mobileBlock.includes('font-size: 14px'), mobileBlock);
  assert.ok(mobileBlock.includes('.foto {') && mobileBlock.includes('display: none'), mobileBlock);
  // o CSS base continua com os valores do desktop
  const base = css.slice(0, t);
  assert.ok(base.includes('flex-direction: row') && base.includes('gap: 24px'), base);
});

test('mudar o layout do PAI muda o estilo do filho (posição/largura) mesmo sem sobrescrita no filho', () => {
  const f = createNode('frame', { name: 'Caixa', w: 400, h: 200 });
  const c = createNode('rect', { name: 'Item', x: 20, y: 30, w: 100, h: 50 });
  f.children = [c];
  editBp(f, 'mobile', (d) => { d.layout = { ...d.layout, mode: 'column', gap: 4 }; });
  const { css } = generateCode([f], null, {}, { root: true });
  const m = css.slice(css.indexOf('@media (max-width: 640px)'));
  assert.ok(m.includes('.item {'), css);
  assert.ok(m.includes('flex: 0 0 auto'), m); // virou item de flex
});

test('largura fluida na raiz: width 100%, max-width e min-height; sem fluid fica fixo', () => {
  const f = createNode('frame', { name: 'Pagina', w: 1200, h: 800 });
  const fixed = generateCode([f], null, {}, { root: true }).css;
  assert.ok(fixed.includes('width: 1200px') && fixed.includes('height: 800px'));
  f.fluid = true;
  const fluid = generateCode([f], null, {}, { root: true }).css;
  assert.ok(fluid.includes('width: 100%') && fluid.includes('max-width: 1200px') && fluid.includes('min-height: 800px') && fluid.includes('margin: 0 auto'), fluid);
  assert.ok(!fluid.includes('height: 800px;') || fluid.includes('min-height: 800px'));
  // fluid só vale na raiz da exportação
  const child = createNode('frame', { name: 'Filho', w: 100, h: 100 });
  child.fluid = true;
  const wrap = createNode('frame', { name: 'Pai', w: 300, h: 300 });
  wrap.children = [child];
  assert.ok(!generateCode([wrap], null, {}, { root: true }).css.includes('max-width'));
});
