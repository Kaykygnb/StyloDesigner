import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '@stylo/core/store.js';
import { createNode, makeDoc, makePage } from '@stylo/core/model.js';
import { createRunner } from '@stylo/core/tools/runner.js';

function fixture(nodes: any[] = [], extraPages: any[] = []) {
  const doc = makeDoc(); doc.pages[0].children = nodes; doc.pages.push(...extraPages);
  const store = createStore({ initial: { doc } });
  const runner = createRunner({ store, commands: {}, approve: async () => { throw new Error('Busca não pede aprovação'); } });
  return { store, doc, find: (args: any = {}) => runner.run('find_layers', args) };
}
const ids = (out: any) => out.layers.map((n: any) => n.id);
const bytes = (out: any) => Buffer.byteLength(JSON.stringify(out, null, 2), 'utf8');

test('busca combina texto, tipo e propriedades base sem enviar texto, notas ou overrides', async () => {
  const good = createNode('text', { name: 'Título', text: 'Olá Mundo', fontFamily: 'Inter', fontSize: 24, fontWeight: 700, fill: { type: 'solid', color: '#AABBCC' }, note: 'nota privada' });
  good.bps = { mobile: { fontSize: 12 } };
  const different = createNode('text', { text: 'Olá Mundo', fontFamily: 'Inter Tight', fontSize: 24, fontWeight: 700 });
  const f = fixture([good, different]);
  const out = await f.find({ query: 'MUNDO', type: 'text', where: { fontFamily: 'INTER', fontSize: 24, fontWeight: 700, fillColor: '#abc' } });
  assert.equal(out.error, undefined); assert.deepEqual(ids(out), [good.id]); assert.equal(out.total, 1);
  assert.deepEqual(Object.keys(out.layers[0]).sort(), ['id', 'name', 'page', 'page_id', 'type']);
  assert.deepEqual(ids(await f.find({ where: { fontSize: 12 } })), [], 'não consulta overrides responsivos');
});

test('paginação percorre mais de 60 resultados em ordem sem perder ou repetir IDs', async () => {
  const nodes = Array.from({ length: 137 }, (_, i) => createNode('rect', { name: `Item ${i}` }));
  const f = fixture(nodes); let offset = 0; const seen: string[] = [];
  do {
    const out = await f.find({ fields: 'ids', offset });
    assert.equal(out.error, undefined); assert.equal(out.total, 137); assert.equal(out.count, out.layers.length);
    assert.ok(out.count <= 20); assert.deepEqual(Object.keys(out.layers[0]), ['id']);
    seen.push(...ids(out));
    assert.equal(out.hasMore, out.nextOffset !== null);
    if (!out.hasMore) break;
    assert.equal(out.nextOffset, offset + out.count); offset = out.nextOffset;
  } while (true);
  assert.deepEqual(seen, nodes.map(n => n.id));
  const end = await f.find({ offset: 200 }); assert.equal(end.count, 0); assert.equal(end.nextOffset, null);
});

test('escopo de página e subárvore inclui raiz e mantém ordem da árvore', async () => {
  const child = createNode('rect'), root = createNode('frame'); root.children.push(child);
  const outside = createNode('rect'), second = makePage('Segunda'); second.children.push(createNode('rect'));
  const f = fixture([root, outside], [second]);
  assert.deepEqual(ids(await f.find({ within_id: root.id, fields: 'ids' })), [root.id, child.id]);
  assert.deepEqual(ids(await f.find({ page_id: second.id, fields: 'ids' })), [second.children[0].id]);
  const scoped = await f.find({ page_id: f.doc.pages[0].id, within_id: root.id });
  assert.deepEqual(ids(scoped), [root.id, child.id]); assert.equal(scoped.layers[0].page_id, f.doc.pages[0].id);
});

test('filtros de estilos, imagem, componentes, tag e layout usam IDs exatos e AND', async () => {
  const n = createNode('frame'); Object.assign(n, { component: true, instanceOf: 'master', textStyleId: 'text-style', effectStyleId: 'effect-style', tag: 'article' });
  n.fill = { type: 'solid', color: '#AABBCC', styleId: 'color-style', assetId: 'asset' }; n.layout.mode = 'row';
  const gradient = createNode('rect'); gradient.fill = { type: 'linear', gradientId: 'gradient-style', color: '#AABBCC' };
  const f = fixture([n, gradient]);
  assert.deepEqual(ids(await f.find({ where: { component: true, instanceOf: 'master', textStyleId: 'text-style', effectStyleId: 'effect-style', colorStyleId: 'color-style', assetId: 'asset', tag: 'article', layoutMode: 'row' } })), [n.id]);
  assert.deepEqual(ids(await f.find({ where: { gradientStyleId: 'gradient-style' } })), [gradient.id]);
  assert.deepEqual(ids(await f.find({ where: { colorStyleId: 'COLOR-STYLE' } })), []);
  assert.deepEqual(ids(await f.find({ where: { fillColor: '#aabbcc' } })), [n.id], 'gradiente não conta como cor sólida');
});

test('false explícito e defaults ausentes não são confundidos com filtro omitido', async () => {
  const visible = createNode('rect'), hidden = createNode('rect', { visible: false, locked: true }), legacy = createNode('rect');
  delete legacy.visible; delete legacy.locked;
  const f = fixture([visible, hidden, legacy]);
  assert.equal((await f.find()).total, 3);
  assert.deepEqual(ids(await f.find({ where: { visible: false } })), [hidden.id]);
  assert.deepEqual(ids(await f.find({ where: { visible: true, locked: false } })), [visible.id, legacy.id]);
  assert.deepEqual(ids(await f.find({ where: { component: false } })), [visible.id, hidden.id, legacy.id]);
});

test('orçamento contabiliza JSON inteiro em UTF-8 e preserva cursor quando reduz página', async () => {
  const nodes = Array.from({ length: 40 }, (_, i) => createNode('text', { name: '😀漢'.repeat(90), text: 'texto'.repeat(1000), note: '😀'.repeat(1000), id: `node-${i}` }));
  const f = fixture(nodes); f.doc.pages[0].name = '😀'.repeat(100);
  for (const fields of ['compact', 'ids', 'summary']) {
    const budget = fields === 'summary' ? 4096 : 1024;
    let offset = 0; const seen: string[] = [];
    for (;;) {
      const out = await f.find({ fields, maxBytes: budget, limit: 100, offset });
      assert.equal(out.error, undefined, `${fields}: ${out.error}`); assert.ok(bytes(out) <= budget, `${fields}: ${bytes(out)} bytes`);
      assert.ok(out.count > 0);
      if (fields === 'compact') { assert.ok(Array.from(out.layers[0].name).length <= 80); assert.ok(Array.from(out.layers[0].page).length <= 60); }
      seen.push(...ids(out));
      if (!out.hasMore) break;
      assert.equal(out.nextOffset, offset + out.count); offset = out.nextOffset;
    }
    assert.deepEqual(seen, nodes.map(n => n.id), fields);
  }
});

test('ID impossível de caber exige aumento de maxBytes sem descartar o resultado', async () => {
  const n = createNode('rect'); const f = fixture([n]);
  f.store.update(page => { page.children[0].id = 'x'.repeat(2000); });
  const longId = f.store.page().children[0].id;
  const out = await f.find({ fields: 'ids', maxBytes: 1024 }); assert.match(out.error ?? '', /maxBytes/);
  const retry = await f.find({ fields: 'ids', maxBytes: 4096 }); assert.deepEqual(ids(retry), [longId]); assert.equal(retry.nextOffset, null);
});

test('schema rejeita filtros desconhecidos e limites inválidos', async () => {
  const f = fixture();
  for (const args of [{ where: { invented: true } }, { where: { fontSize: '24' } }, { limit: 101 }, { limit: 0 }, { offset: -1 }, { offset: 1.5 }, { maxBytes: 1023 }, { maxBytes: 65537 }, { fields: 'full' }]) {
    assert.ok((await f.find(args)).error, JSON.stringify(args));
  }
  for (const type of ['html', 'media']) assert.equal((await f.find({ type })).error, undefined, type);
});

test('busca não modifica documento, seleção, revisão ou histórico', async () => {
  const f = fixture(); const n = createNode('text');
  f.store.update(page => page.children.push(n)); f.store.commit();
  const before = JSON.stringify(f.store.state.doc), revision = f.store.docRevision(), selection = [...f.store.ui.selection];
  await f.find(); await f.find({ fields: 'summary', where: { fontFamily: 'Inter' } });
  assert.equal(JSON.stringify(f.store.state.doc), before); assert.equal(f.store.docRevision(), revision); assert.deepEqual(f.store.ui.selection, selection);
  f.store.undo(); assert.equal(f.store.page().children.length, 0, 'busca não acrescentou histórico');
});

test('summary grande informa limite e permite repetir sem perder resultado', async () => {
  const n = createNode('text', { name: '😀'.repeat(500), text: '漢'.repeat(2000), note: '😀'.repeat(2000) });
  const f = fixture([n]);
  const small = await f.find({ fields: 'summary', maxBytes: 1024 });
  assert.match(small.error ?? '', /maxBytes/);
  const retry = await f.find({ fields: 'summary', maxBytes: 8192 });
  assert.equal(retry.error, undefined); assert.deepEqual(ids(retry), [n.id]); assert.equal(retry.nextOffset, null);
  assert.ok(bytes(retry) <= 8192);
});
