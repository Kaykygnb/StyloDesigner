import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { makeDoc } from '../src/model.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('continua mostrando "Salvando" até concluir a gravação da edição mais recente', async () => {
  const writes = [];
  const store = createStore({
    initial: { doc: makeDoc() },
    persist: () => {
      const write = deferred();
      writes.push(write);
      return write.promise;
    },
  });

  store.touch();
  const firstSave = store.saveNow();
  assert.equal(writes.length, 1);
  assert.equal(store.state.ui.saveState, 'saving');

  // A nova edição chega enquanto a primeira escrita ainda está pendente.
  store.touch();
  store.saveNow();
  writes[0].resolve('browser');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(writes.length, 2, 'uma segunda gravação deve persistir a edição mais recente');
  assert.equal(store.state.ui.saveState, 'saving', 'não pode anunciar que salvou enquanto a segunda escrita está pendente');

  writes[1].resolve('browser');
  await firstSave;
  assert.equal(store.state.ui.saveState, 'saved');
});
