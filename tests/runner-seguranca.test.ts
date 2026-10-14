import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '@stylo/core/store.js';
import { createNode, makeDoc } from '@stylo/core/model.js';
import { createRunner } from '@stylo/core/tools/runner.js';

const novo = () => createStore({ initial: { doc: makeDoc() } });

test('executor recusa escrita sem aprovação e mantém documento e histórico', async () => {
  for (const approve of [undefined, async () => false]) {
    const store = novo();
    const before = JSON.stringify(store.state.doc);
    const runner = createRunner({ store, commands: {}, ...(approve ? { approve } : {}) });
    const out = await runner.run('create_layer', { type: 'rect' });
    assert.equal(out.refused, true);
    assert.equal(JSON.stringify(store.state.doc), before);
    assert.equal(store.canUndo(), false);
  }
});

test('leitura dispensa aprovação; administrador executa escrita sem perguntar', async () => {
  const store = novo();
  let approvals = 0;
  const runner = createRunner({ store, commands: {}, approve: async () => { approvals++; return false; } });
  const read = await runner.run('get_document');
  assert.equal(read.project, store.state.doc.name);
  const write = await runner.run('create_layer', { type: 'rect' }, 'Agente externo', { external: true, admin: true });
  assert.equal(write.ok, true);
  assert.equal(typeof write._summary, 'string');
  assert.equal(store.page().children.length, 1);
  assert.equal(approvals, 0);
  assert.equal(store.canUndo(), true);
  store.undo();
  assert.equal(store.page().children.length, 0);
});

test('cliente externo sem administrador continua sujeito à recusa da pessoa', async () => {
  const store = novo();
  let approvals = 0;
  const before = JSON.stringify(store.state.doc);
  const runner = createRunner({ store, commands: {}, approve: async () => { approvals++; return false; } });
  const out = await runner.run('create_layer', { type: 'rect' }, 'Agente externo', { external: true });
  assert.equal(out.refused, true);
  assert.equal(approvals, 1);
  assert.equal(JSON.stringify(store.state.doc), before);
});

test('cancelamento durante aprovação impede uma escrita já aprovada', async () => {
  const store = novo();
  const before = JSON.stringify(store.state.doc);
  const controller = new AbortController();
  const runner = createRunner({ store, commands: {}, approve: async (request) => {
    assert.equal(request.signal, controller.signal);
    controller.abort();
    return true;
  } });
  const out = await runner.run('create_layer', { type: 'rect' }, 'Agente', { signal: controller.signal });
  assert.match(out.error ?? '', /cancelada/);
  assert.equal(JSON.stringify(store.state.doc), before);
  assert.equal(store.canUndo(), false);
});

test('falha parcial sem edição concorrente restaura documento sem adicionar histórico', async () => {
  const store = novo();
  const frame = createNode('frame');
  store.update((page) => page.children.push(frame));
  store.commit();
  const before = JSON.stringify(store.state.doc);
  const runner = createRunner({ store, commands: { setLayoutMode() { throw new Error('Falha controlada de layout'); } }, approve: async () => true });
  const out = await runner.run('update_layer', { id: frame.id, props: { name: 'Mudança parcial', layout: { mode: 'row' } } });
  assert.match(out.error ?? '', /Falha controlada de layout/);
  assert.equal(JSON.stringify(store.state.doc), before);
  store.undo();
  assert.equal(store.page().children.length, 0, 'a falha não criou outro passo de desfazer');
});

test('falha assíncrona preserva edição concorrente em vez de restaurar foto antiga', async () => {
  const store = novo();
  let started!: () => void;
  let reject!: (reason: Error) => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  const pending = new Promise<never>((_resolve, fail) => { reject = fail; });
  const runner = createRunner({ store, commands: { insertImageAsset: async () => { started(); return pending; } }, approve: async () => true });
  const operation = runner.run('insert_asset', { id: 'imagem' });
  await entered;
  store.update(() => { store.state.doc.name = 'Trabalho concorrente'; });
  reject(new Error('Falha controlada de imagem'));
  const out = await operation;
  assert.match(out.error ?? '', /Falha controlada de imagem/);
  assert.match(out.error ?? '', /documento mudou.*mantive o estado atual/);
  assert.equal(store.state.doc.name, 'Trabalho concorrente');
});
