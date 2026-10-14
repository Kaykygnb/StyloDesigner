import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '@stylo/core/store.js';
import { createNode, makeDoc } from '@stylo/core/model.js';
import { createRunner } from '@stylo/core/tools/runner.js';
import type { InspectLayout } from '../packages/core/src/layout-inspection.ts';

function fixture(nodes: any[], backend?: InspectLayout | null) {
  const doc = makeDoc(); doc.pages[0].children = nodes;
  const store = createStore({ initial: { doc } });
  const calls: any[] = [];
  const fake: InspectLayout = async (root, passedDoc, options) => {
    calls.push({ root, doc: passedDoc, options });
    return { viewport: { width: options.width, height: 600 }, root: { x: 0, y: 0, w: options.width, h: 600 },
      layers: options.ids.map((id, i) => ({ id, parentId: 'backend-parent', rendered: true, visible: true,
        box: { x: i * 7, y: i * 9, w: 333, h: 44 },
        layout: { display: 'flex', direction: 'column', rowGap: '17px', columnGap: '9px', padding: ['1px', '2px', '3px', '4px'] },
        typography: { fontFamily: 'Inter', fontSize: '31px', fontWeight: '700', lineHeight: '38px' },
        overflow: { viewportX: false, parent: false, contentX: true, contentY: false } })) };
  };
  const runner = createRunner({ store, commands: {}, inspectLayout: backend === undefined ? fake : backend,
    approve: async () => { throw new Error('Inspeção não pede aprovação'); } });
  return { store, calls, inspect: (args: any) => runner.run('inspect_layout', args) };
}
const ids = (out: any) => out.layers.map((n: any) => n.id);
const bytes = (out: any) => Buffer.byteLength(JSON.stringify(out, null, 2), 'utf8');
const screen = () => createNode('frame', { w: 900, h: 700 });

test('aceita tela raiz ou dentro de seção raiz; recusa filho como tela isolada', async () => {
  const root = screen(), child = screen(), section = createNode('section'), sectionScreen = screen();
  root.children.push(child); section.children.push(sectionScreen);
  const f = fixture([root, section]);
  assert.equal((await f.inspect({ id: root.id })).error, undefined);
  assert.equal((await f.inspect({ id: sectionScreen.id })).error, undefined);
  assert.match((await f.inspect({ id: child.id })).error ?? '', /tela|frame/);
  assert.match((await f.inspect({ id: section.id })).error ?? '', /tela|frame/);
  assert.equal(f.calls.length, 2);
});

test('within_id limita resposta mas backend recebe tela inteira; depth é relativo ao escopo', async () => {
  const root = screen(), group = createNode('frame'), child = createNode('text'), grandchild = createNode('rect'), outside = createNode('rect');
  group.children.push(child); child.children = [grandchild]; root.children.push(group, outside);
  const f = fixture([root]);
  const zero = await f.inspect({ id: root.id, within_id: group.id, depth: 0 });
  assert.deepEqual(ids(zero), [group.id]); assert.equal(zero.layers[0].parentId, root.id); assert.equal(zero.layers[0].depth, 0);
  assert.equal(f.calls[0].root.id, root.id); assert.equal(f.calls[0].root.children.length, 2);
  assert.deepEqual(f.calls[0].options.ids, [group.id]);
  assert.deepEqual(ids(await f.inspect({ id: root.id, within_id: group.id, depth: 1 })), [group.id, child.id]);
  assert.deepEqual(ids(await f.inspect({ id: root.id, within_id: group.id, depth: 2 })), [group.id, child.id, grandchild.id]);
  assert.deepEqual(ids(await f.inspect({ id: root.id, depth: 0 })), [root.id]);
  assert.match((await f.inspect({ id: root.id, within_id: 'absent' })).error ?? '', /within_id/);
});

test('paginação de 137 filhos preserva ordem, limita backend a100 e resposta a8KiB', async () => {
  const root = screen(); root.children.push(...Array.from({ length: 137 }, () => createNode('rect')));
  const f = fixture([root]); const seen: string[] = []; let offset = 0;
  for (;;) {
    const out = await f.inspect({ id: root.id, offset });
    assert.equal(out.error, undefined); assert.equal(out.total, 138); assert.ok(out.count <= 20); assert.ok(bytes(out) <= 8192);
    assert.equal(f.calls.at(-1).options.ids.length, Math.min(20, 138 - offset));
    seen.push(...ids(out)); if (!out.hasMore) { assert.equal(out.nextOffset, null); break; }
    assert.equal(out.nextOffset, offset + out.count); offset = out.nextOffset;
  }
  assert.deepEqual(seen, [root.id, ...root.children.map(n => n.id)]);
  const large = await f.inspect({ id: root.id, limit: 100 });
  assert.equal(large.error, undefined); assert.equal(f.calls.at(-1).options.ids.length, 100); assert.ok(bytes(large) <= 8192);
});

test('tipografia e layout retornados são CSS computado, sem alterar base ou histórico', async () => {
  const f = fixture([]), root = screen(), text = createNode('text', { fontSize: 16 }); root.children.push(text);
  f.store.update(page => page.children.push(root)); f.store.commit();
  const before = JSON.stringify(f.store.state.doc), revision = f.store.docRevision();
  const out = await f.inspect({ id: root.id, width: 390 });
  assert.equal(out.error, undefined); assert.equal(out.viewport.width, 390);
  assert.equal(out.layers[1].typography.fontSize, '31px'); assert.equal(out.layers[0].layout.rowGap, '17px');
  assert.equal(out.layers[1].box.w, 333); assert.equal(out.layers[1].parentId, root.id);
  assert.equal(JSON.stringify(f.store.state.doc), before); assert.equal(f.store.docRevision(), revision);
  assert.equal(f.store.get(root.id).w, 900); assert.equal(f.store.get(text.id).fontSize, 16);
  f.store.undo(); assert.equal(f.store.page().children.length, 0, 'inspeção não acrescenta histórico');
});

test('HTML, vetores e mídia são opacos no backend mesmo fora da página solicitada de resultados', async () => {
  const root = screen(), group = createNode('frame'); root.children.push(group);
  const opaque = ['html', 'path', 'media'].map(type => createNode(type as any)); root.children.push(...opaque);
  const f = fixture([root]); const out = await f.inspect({ id: root.id, within_id: group.id, depth: 0, limit: 1 });
  assert.equal(out.error, undefined); assert.deepEqual(f.calls[0].options.opaqueIds, opaque.map(n => n.id));
  assert.deepEqual(f.calls[0].options.ids, [group.id]); assert.equal(f.calls[0].root.children.length, 4);
});

test('validação recusa largura dupla, largura inválida, depth e paginação inválidos antes do backend', async () => {
  const root = screen(), f = fixture([root]);
  for (const args of [{ width: 390, breakpoint: 'mobile' }, { width: 199 }, { width: 4001 }, { width: 390.5 }, { depth: -1 }, { depth: 9 }, { depth: 1.5 }, { limit: 101 }, { limit: 0 }, { offset: -1 }, { maxBytes: 1023 }, { breakpoint: 'unknown' }]) {
    assert.ok((await f.inspect({ id: root.id, ...args })).error, JSON.stringify(args));
  }
  assert.equal(f.calls.length, 0);
});

test('ausência de Chromium e falha do backend geram erros honestos sem inventar medidas', async () => {
  const root = screen(), missing = fixture([root], null);
  const out = await missing.inspect({ id: root.id }); assert.match(out.error ?? '', /Chromium/); assert.match(out.error ?? '', /NÃO foram conferidas/); assert.equal(out.layers, undefined);
  const failing = fixture([screen()], async () => { throw new Error('Chromium falhou ao renderizar'); });
  assert.match((await failing.inspect({ id: failing.store.page().children[0].id })).error ?? '', /Chromium falhou/);
});

test('orçamento pequeno informa maxBytes sem ocultar a primeira camada; repetição funciona', async () => {
  const root = screen(); root.name = '😀'.repeat(200);
  const f = fixture([root]); const small = await f.inspect({ id: root.id, maxBytes: 1024 });
  assert.match(small.error ?? '', /maxBytes/); assert.equal(small.layers, undefined);
  const retry = await f.inspect({ id: root.id, maxBytes: 4096 });
  assert.equal(retry.error, undefined); assert.deepEqual(ids(retry), [root.id]); assert.equal(retry.nextOffset, null); assert.ok(bytes(retry) <= 4096);
});
