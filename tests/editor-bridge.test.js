import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorBridge } from '../server/editor-bridge.js';

test('timeout cancela a chamada e a encerra se o editor não confirmar', async () => {
  const events = [];
  const editor = { write: (event) => events.push(event) };
  const bridge = createEditorBridge({ getEditors: () => new Set([editor]), timeoutMs: 10, cancelGraceMs: 10 });

  await assert.rejects(bridge.callEditor('update_layer', {}, 'Teste'), /não confirmou o cancelamento/);
  assert.equal(events.length, 2);
  assert.match(events[1], /"reason":"timeout"/);
  assert.equal(bridge.pendingCount(), 0);
});

test('resposta normal encerra o timer e devolve o resultado', async () => {
  const editor = { write() {} };
  const bridge = createEditorBridge({ getEditors: () => new Set([editor]), timeoutMs: 100, cancelGraceMs: 10 });
  const result = bridge.callEditor('get_document', {}, 'Teste');
  assert.equal(bridge.reply('1', { ok: true }), true);
  assert.deepEqual(await result, { ok: true });
  assert.equal(bridge.pendingCount(), 0);
});

test('confirmação de cancelamento rejeita a chamada antes do fim da tolerância', async () => {
  const editor = { write() {} };
  const bridge = createEditorBridge({ getEditors: () => new Set([editor]), timeoutMs: 5, cancelGraceMs: 1000 });
  const result = bridge.callEditor('update_layer', {}, 'Teste');
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(bridge.reply('1', { error: 'cancelada' }), true);
  await assert.rejects(result, /confirmou o cancelamento de update_layer/);
  assert.equal(bridge.pendingCount(), 0);
});

test('cancelamento do cliente também tem prazo mesmo sem resposta do editor', async () => {
  const events = [];
  const editor = { write: (event) => events.push(event) };
  const bridge = createEditorBridge({ getEditors: () => new Set([editor]), timeoutMs: 1000, cancelGraceMs: 10 });
  const controller = new AbortController();
  const result = bridge.callEditor('update_layer', {}, 'Teste', controller.signal);
  controller.abort();
  await assert.rejects(result, /não confirmou o cancelamento de update_layer/);
  assert.match(events[1], /"reason":"client"/);
  assert.equal(bridge.pendingCount(), 0);
});

test('fechar a aba rejeita as chamadas dela e limpa timers', async () => {
  const editor = { write() {} };
  const bridge = createEditorBridge({ getEditors: () => new Set([editor]), timeoutMs: 1000 });
  const result = bridge.callEditor('get_document', {}, 'Teste');
  bridge.closeEditor(editor);
  await assert.rejects(result, /editor foi fechado/);
  assert.equal(bridge.pendingCount(), 0);
});

test('sessão MCP pode direcionar chamada a uma aba sem usar a última conectada', async () => {
  const eventsA = [];
  const eventsB = [];
  const editorA = { id: 'tab-a', write: (event) => eventsA.push(event) };
  const editorB = { id: 'tab-b', write: (event) => eventsB.push(event) };
  const bridge = createEditorBridge({ getEditors: () => new Set([editorA, editorB]), getEditorId: (editor) => editor.id, timeoutMs: 100 });
  const result = bridge.callEditor('get_document', {}, 'Teste', undefined, false, 'tab-a');
  const dispatch = [eventsA.length, eventsB.length];
  assert.equal(bridge.reply('1', { tab: 'a' }), true);
  assert.deepEqual(await result, { tab: 'a' });
  assert.deepEqual(dispatch, [1, 0]);
});

test('destino MCP desconectado falha sem redirecionar para outra aba', async () => {
  const events = [];
  const editor = { id: 'tab-b', write: (event) => events.push(event) };
  const bridge = createEditorBridge({ getEditors: () => new Set([editor]), getEditorId: (target) => target.id, timeoutMs: 5, cancelGraceMs: 5 });
  await assert.rejects(bridge.callEditor('get_document', {}, 'Teste', undefined, false, 'tab-a'), /aba selecionada.*desconectada/i);
  assert.equal(events.length, 0);
  assert.equal(bridge.pendingCount(), 0);
});
