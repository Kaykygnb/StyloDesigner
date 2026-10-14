// Alterações em várias camadas (responsivo, estados, mover) valem UM passo no histórico: um Ctrl+Z desfaz o lote inteiro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '@stylo/core/store.js';
import { makeDoc, createNode } from '@stylo/core/model.js';
import { createRunner } from '@stylo/core/tools/runner.js';
import { createCommands } from '@stylo/core/commands.js';
import { createModelCanvas } from '../apps/server/src/workspace/model-canvas.js';
import '../apps/server/src/dom-polyfill.ts';

function novo() {
  const store = createStore({ initial: { doc: makeDoc() } });
  const commands = createCommands(store, createModelCanvas(store));
  const runner = createRunner({ store, commands, approve: async () => true });
  const tela = createNode('frame', { name: 'Tela', w: 400, h: 300 });
  const a = createNode('rect', { name: 'A', w: 50, h: 50 }), b = createNode('rect', { name: 'B', w: 50, h: 50 }), c = createNode('rect', { name: 'C', w: 50, h: 50 });
  tela.children.push(a, b);
  const alvo = createNode('frame', { name: 'Alvo', w: 200, h: 200 });
  store.update(() => { store.page().children.push(tela, alvo, c); }, { structural: true });
  store.commit();
  return { store, runner, a, b, c, alvo };
}

test('set_responsive com ids: várias camadas, um único Ctrl+Z', async () => {
  const { store, runner, a, b } = novo();
  const r = await runner.run('set_responsive', { ids: [a.id, b.id], breakpoint: 'mobile', props: { visible: false } });
  assert.ok(!r.error, r.error);
  assert.equal(store.get(a.id).bps.mobile.visible, false);
  assert.equal(store.get(b.id).bps.mobile.visible, false);
  store.undo();
  assert.equal(store.get(a.id).bps, undefined, 'o lote inteiro voltou');
  assert.equal(store.get(b.id).bps, undefined);
  const reset = await runner.run('set_responsive', { ids: [a.id, b.id], breakpoint: 'mobile', props: { visible: false } });
  assert.ok(!reset.error);
  await runner.run('set_responsive', { ids: [a.id, b.id], breakpoint: 'mobile', reset: true });
  assert.equal(store.get(a.id).bps, undefined);
  store.undo();
  assert.equal(store.get(b.id).bps.mobile.visible, false, 'um Ctrl+Z desfaz o reset das duas');
});

test('set_state com ids, e id único continua funcionando', async () => {
  const { store, runner, a, b } = novo();
  assert.ok(!(await runner.run('set_state', { ids: [a.id, b.id], state: 'hover', props: { opacity: 0.5 } })).error);
  assert.equal(store.get(a.id).states.hover.opacity, 0.5);
  assert.equal(store.get(b.id).states.hover.opacity, 0.5);
  store.undo();
  assert.equal(store.get(a.id).states, undefined);
  assert.ok(!(await runner.run('set_state', { id: a.id, state: 'hover', props: { opacity: 0.2 } })).error);
  assert.equal(store.get(a.id).states.hover.opacity, 0.2);
});

test('id e ids: pede um dos dois, recusa repetidos e não deixa o lote pela metade', async () => {
  const { store, runner, a, b } = novo();
  assert.match((await runner.run('set_state', { state: 'hover', props: {} })).error, /id.*ids/);
  assert.match((await runner.run('set_responsive', { ids: [a.id, a.id], breakpoint: 'mobile', props: { visible: false } })).error, /repetir/);
  const ruim = await runner.run('set_responsive', { ids: [a.id, b.id], breakpoint: 'mobile', props: { naoExiste: 1 } });
  assert.ok(ruim.error);
  assert.equal(store.get(a.id).bps, undefined, 'nada foi gravado');
});

test('move_layers: cortar/colar várias camadas num frame vale um passo só', async () => {
  const { store, runner, a, b, alvo } = novo();
  const r = await runner.run('move_layers', { moves: [{ id: a.id, parent_id: alvo.id }, { id: b.id, parent_id: alvo.id }] });
  assert.ok(!r.error, r.error);
  assert.equal(store.parentOf(a.id).id, alvo.id);
  assert.equal(store.parentOf(b.id).id, alvo.id);
  store.undo();
  assert.notEqual(store.parentOf(a.id).id, alvo.id);
  assert.notEqual(store.parentOf(b.id).id, alvo.id);
});

test('duplicate_layers com moves: a cópia já nasce no destino e um Ctrl+Z desfaz tudo', async () => {
  const { store, runner, a, alvo } = novo();
  const x0 = store.get(a.id).x, pai0 = store.parentOf(a.id).id;
  const r = await runner.run('duplicate_layers', { ids: [a.id], moves: [{ id: a.id, parent_id: alvo.id, x: 33, y: 44 }] });
  assert.ok(!r.error, r.error);
  const copiaId = r.created[0].id;
  assert.notEqual(copiaId, a.id);
  assert.equal(store.parentOf(copiaId).id, alvo.id, 'a cópia foi para o destino');
  assert.deepEqual([store.get(copiaId).x, store.get(copiaId).y], [33, 44]);
  assert.equal(store.parentOf(a.id).id, pai0, 'o original não saiu do lugar');
  assert.equal(store.get(a.id).x, x0);
  store.undo();
  assert.equal(store.get(copiaId), null, 'um Ctrl+Z removeu a cópia (e o movimento dela)');
  assert.equal(store.parentOf(a.id).id, pai0);
});

test('duplicate_layers com moves recusa id fora de ids e não duplica nada', async () => {
  const { store, runner, a, b } = novo();
  const antes = store.page().children.length + store.get(b.id).children?.length;
  const r = await runner.run('duplicate_layers', { ids: [a.id], moves: [{ id: b.id, x: 1 }] });
  assert.match(r.error, /ORIGINAL|ids/);
  assert.equal(store.page().children.length + store.get(b.id).children?.length, antes);
  assert.equal(store.parentOf(a.id).children.filter((n) => n.name === a.name).length, 1, 'nenhuma cópia ficou para trás');
});
