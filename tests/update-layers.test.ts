import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '@stylo/core/store.js';
import { createNode, makeDoc } from '@stylo/core/model.js';
import { createCommands } from '@stylo/core/commands.js';
import { createRunner } from '@stylo/core/tools/runner.js';
import { createModelCanvas } from '../apps/server/src/workspace/model-canvas.js';

function fixture() {
  const store = createStore({ initial: { doc: makeDoc() } });
  const frame = createNode('frame');
  const text = createNode('text');
  const rect = createNode('rect');
  const untouched = createNode('rect');
  frame.w = 300; frame.h = 200; frame.layout.mode = 'none';
  rect.x = 30; rect.y = 20; rect.w = 40; rect.h = 30;
  rect.constraints = { h: 'right', v: 'top' };
  frame.children.push(rect);
  store.update((page) => page.children.push(frame, text, untouched)); store.commit();
  const commands = createCommands(store, createModelCanvas(store));
  return { store, commands, frame, text, rect, untouched };
}
const snapshot = (store: ReturnType<typeof createStore>) => JSON.stringify(store.state.doc);

async function expectAtomicError(updates: any, pattern: RegExp) {
  const f = fixture();
  const args = typeof updates === 'function' ? updates(f) : updates;
  let approvals = 0;
  const runner = createRunner({ ...f, approve: async () => { approvals++; return true; } });
  const before = snapshot(f.store);
  const out = await runner.run('update_layers', { updates: args });
  assert.match(out.error ?? '', pattern);
  assert.equal(approvals, 0, 'pedido inválido não chega à aprovação');
  assert.equal(snapshot(f.store), before, 'nenhuma alteração parcial');
  f.store.undo();
  assert.equal(f.store.page().children.length, 0, 'erro não acrescentou histórico');
}

test('lote muda propriedades diferentes com um único update e um único passo de desfazer/refazer', async () => {
  const f = fixture();
  const before = snapshot(f.store);
  const other = f.store.get(f.untouched.id);
  let updates = 0, commits = 0;
  const originalUpdate = f.store.update.bind(f.store), originalCommit = f.store.commit.bind(f.store);
  f.store.update = (...args: any[]) => { updates++; return originalUpdate(...args); };
  f.store.commit = (...args: any[]) => { commits++; return originalCommit(...args); };
  const runner = createRunner({ ...f, approve: async () => true });
  const out = await runner.run('update_layers', { updates: [
    { id: f.text.id, props: { text: 'Título novo', fontSize: 32 } },
    { id: f.rect.id, props: { fill: '#abc', radius: 8 } },
  ] });
  assert.equal(out.ok, true, out.error);
  assert.equal(updates, 1); assert.equal(commits, 1);
  assert.equal(f.store.get(f.text.id).text, 'Título novo');
  assert.equal(f.store.get(f.text.id).fontSize, 32);
  assert.equal(f.store.get(f.rect.id).fill.color, '#AABBCC');
  assert.deepEqual(f.store.get(f.rect.id).radius, [8, 8, 8, 8]);
  assert.equal(f.store.get(f.untouched.id), other, 'camada não afetada conserva identidade');
  const after = snapshot(f.store);
  f.store.undo(); assert.equal(snapshot(f.store), before);
  f.store.redo(); assert.equal(snapshot(f.store), after);
  f.store.undo(); f.store.undo(); assert.equal(f.store.page().children.length, 0);
});

test('propriedade desconhecida no último item recusa todo o lote', async () => {
  await expectAtomicError((f: any) => [
    { id: f.text.id, props: { text: 'Não aplicar' } },
    { id: f.rect.id, props: { inventada: 1 } },
  ], /Propriedade desconhecida.*inventada/);
});

test('propriedade incompatível com tipo de camada recusa todo o lote', async () => {
  await expectAtomicError((f: any) => [
    { id: f.text.id, props: { text: 'Não aplicar' } },
    { id: f.rect.id, props: { text: 'Não sou texto' } },
  ], /text só vale para camadas de texto/);
});

test('estilo inexistente e ID inexistente não deixam alterações parciais', async () => {
  await expectAtomicError((f: any) => [
    { id: f.text.id, props: { name: 'Não aplicar' } },
    { id: f.rect.id, props: { fill: { styleId: 'ausente' } } },
  ], /Estilo de cor.*não existe/);
  await expectAtomicError((f: any) => [
    { id: f.text.id, props: { name: 'Não aplicar' } },
    { id: 'ausente', props: { name: 'Não aplicar' } },
  ], /não exist|não encontr/);
});

test('IDs duplicados, lote vazio, mais de 100 itens e chave extra por item são recusados', async () => {
  await expectAtomicError((f: any) => [
    { id: f.text.id, props: { name: 'Primeiro' } },
    { id: f.text.id, props: { name: 'Segundo' } },
  ], /duplicad|repetid|únic/);
  await expectAtomicError([], /updates|lista|lote/);
  await expectAtomicError(Array.from({ length: 101 }, (_, i) => ({ id: `id-${i}`, props: { name: 'X' } })), /100/);
  await expectAtomicError((f: any) => [{ id: f.text.id, props: { name: 'X' }, extra: true }], /extra|desconhecid|não permit/);
});

test('recusa de aprovação não altera documento ou histórico', async () => {
  const f = fixture(), before = snapshot(f.store);
  const runner = createRunner({ ...f, approve: async () => false });
  const out = await runner.run('update_layers', { updates: [{ id: f.text.id, props: { text: 'Não aplicar' } }] });
  assert.equal(out.refused, true); assert.equal(snapshot(f.store), before);
  f.store.undo(); assert.equal(f.store.page().children.length, 0);
});

test('edição concorrente durante aprovação é preservada ao preparar lote novamente', async () => {
  const f = fixture();
  const runner = createRunner({ ...f, approve: async () => {
    f.store.update(() => { f.store.get(f.text.id).fontSize = 45; f.store.get(f.untouched.id).name = 'Edição humana'; });
    f.store.commit(); return true;
  } });
  const out = await runner.run('update_layers', { updates: [{ id: f.text.id, props: { text: 'Texto do lote' } }] });
  assert.equal(out.ok, true, out.error);
  assert.equal(f.store.get(f.text.id).text, 'Texto do lote');
  assert.equal(f.store.get(f.text.id).fontSize, 45);
  assert.equal(f.store.get(f.untouched.id).name, 'Edição humana');
  f.store.undo(); assert.equal(f.store.get(f.text.id).fontSize, 45);
  assert.equal(f.store.get(f.untouched.id).name, 'Edição humana');
});

test('camada removida durante aprovação é revalidada sem aplicar outros itens', async () => {
  const f = fixture(); let concurrent = '';
  const runner = createRunner({ ...f, approve: async () => {
    f.store.update((page) => { page.children = page.children.filter((node) => node.id !== f.text.id); }, { structural: true });
    f.store.commit(); concurrent = snapshot(f.store); return true;
  } });
  const out = await runner.run('update_layers', { updates: [
    { id: f.rect.id, props: { name: 'Não aplicar' } },
    { id: f.text.id, props: { text: 'Removido' } },
  ] });
  assert.match(out.error ?? '', /não exist|não encontr/);
  assert.equal(snapshot(f.store), concurrent);
});

test('pai e filho no mesmo lote preservam constraints e propriedades explícitas em ambas as ordens', async () => {
  for (const parentFirst of [true, false]) {
    const f = fixture();
    const updates = [{ id: f.frame.id, props: { w: 400 } }, { id: f.rect.id, props: { fill: '#ff0000', name: 'Filho' } }];
    if (!parentFirst) updates.reverse();
    const runner = createRunner({ ...f, approve: async () => true });
    const out = await runner.run('update_layers', { updates });
    assert.equal(out.ok, true, out.error);
    assert.equal(f.store.get(f.frame.id).w, 400);
    assert.equal(f.store.get(f.rect.id).x, 130);
    assert.equal(f.store.get(f.rect.id).fill.color, '#FF0000');
    assert.equal(f.store.get(f.rect.id).name, 'Filho');
  }
});

test('comando real congela layout e conserva alteração do filho sobreposto', async () => {
  const f = fixture();
  f.store.update(() => {
    f.frame.layout.mode = 'row'; f.frame.layout.gap = 10; f.frame.layout.padding = [5, 8, 5, 8];
    f.rect.x = 99; f.rect.y = 99;
  }); f.store.commit();
  const runner = createRunner({ ...f, approve: async () => true });
  const out = await runner.run('update_layers', { updates: [
    { id: f.frame.id, props: { layout: { mode: 'none' } } },
    { id: f.rect.id, props: { name: 'Filho livre' } },
  ] });
  assert.equal(out.ok, true, out.error);
  assert.equal(f.store.get(f.frame.id).layout.mode, 'none');
  assert.equal(f.store.get(f.rect.id).x, 8); assert.equal(f.store.get(f.rect.id).y, 5);
  assert.equal(f.store.get(f.rect.id).name, 'Filho livre');
});

test('falha controlada do comando de layout no segundo item não muda nenhum nó', async () => {
  const f = fixture(); let approvals = 0;
  const before = snapshot(f.store);
  const runner = createRunner({ store: f.store, commands: { ...f.commands, setLayoutMode(frames: any[]) {
    frames[0].name = 'Mutação antes da falha'; throw new Error('Falha controlada de layout');
  } }, approve: async () => { approvals++; return true; } });
  const out = await runner.run('update_layers', { updates: [
    { id: f.text.id, props: { text: 'Não aplicar' } },
    { id: f.frame.id, props: { layout: { mode: 'row' } } },
  ] });
  assert.match(out.error ?? '', /Falha controlada de layout/);
  assert.equal(approvals, 0); assert.equal(snapshot(f.store), before);
  f.store.undo(); assert.equal(f.store.page().children.length, 0);
});

test('limite de 100 alterações aceita lote completo com IDs distintos', async () => {
  const f = fixture();
  const nodes = Array.from({ length: 100 }, () => createNode('rect'));
  f.store.update((page) => page.children.push(...nodes)); f.store.commit();
  const runner = createRunner({ ...f, approve: async () => true });
  const out = await runner.run('update_layers', { updates: nodes.map((node, i) => ({ id: node.id, props: { name: `Item ${i}` } })) });
  assert.equal(out.ok, true, out.error);
  for (const [i, node] of nodes.entries()) assert.equal(f.store.get(node.id).name, `Item ${i}`);
});

test('texto inválido no último item é recusado antes de escrever ou pedir aprovação', async () => {
  await expectAtomicError((f: ReturnType<typeof fixture>) => [
    { id: f.rect.id, props: { radius: 12 } },
    { id: f.text.id, props: { text: null } },
  ], /text precisa ser uma string/);
});
