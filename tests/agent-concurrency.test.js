import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCurrentImageTarget } from '../src/agent/runner.js';

test('resultado lento de imagem só pode aplicar na mesma camada, documento e origem', () => {
  const node = { id: 'imagem-1', fill: { type: 'image', assetId: 'asset-1' } };
  const doc = { assets: { 'asset-1': 'data:image/png;base64,original' } };
  const store = { state: { doc }, get: (id) => id === node.id ? node : null };
  assert.equal(assertCurrentImageTarget(store, node.id, doc, node, JSON.stringify(node.fill), doc.assets['asset-1']), node);

  node.fill.assetId = 'asset-2';
  assert.throws(() => assertCurrentImageTarget(store, node.id, doc, node, JSON.stringify({ type: 'image', assetId: 'asset-1' }), 'data:image/png;base64,original'), /não apliquei o resultado antigo/);
  node.fill.assetId = 'asset-1';
  store.state.doc = { assets: doc.assets };
  assert.throws(() => assertCurrentImageTarget(store, node.id, doc, node, JSON.stringify(node.fill), doc.assets['asset-1']), /não apliquei o resultado antigo/);
});
