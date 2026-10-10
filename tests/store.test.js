import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { makeDoc, createNode, setBreakpoints, BREAKPOINTS, DEFAULT_BREAKPOINTS, bpView } from '../src/model.js';
import { generateCode } from '../src/css.js';

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

test('init restaura breakpoints personalizados, projectId e comments do projeto salvo', () => {
  try {
    const doc = makeDoc();
    delete doc.projectId;
    delete doc.comments;
    doc.breakpoints = [
      { id: 'tablet', name: 'Tablet', max: 900, preview: 700 },
      { id: 'mobile', name: 'Celular', max: 500, preview: 390 },
    ];
    const node = createNode('frame', { w: 400, h: 200 });
    node.bps = { tablet: { w: 300 } };
    doc.pages[0].children.push(node);

    const store = createStore({ initial: { doc }, persist: async () => {} });

    assert.deepEqual(BREAKPOINTS.map((b) => b.max), [900, 500]);
    assert.equal(bpView(node, 'tablet').w, 300);
    assert.ok(store.state.doc.projectId, 'ganha projectId');
    assert.deepEqual(store.state.doc.comments, []);
    const { css } = generateCode([node], null, {});
    assert.match(css, /@media \(max-width: 900px\)/);
    assert.doesNotMatch(css, /max-width: 1024px/);
  } finally {
    setBreakpoints(DEFAULT_BREAKPOINTS);
  }
});
