import test from 'node:test';
import assert from 'node:assert/strict';
import { boundFindResponse } from '../packages/core/src/tools/runner/search.ts';
const bytes = (value: any) => Buffer.byteLength(JSON.stringify(value, null, 2), 'utf8');
test('aviso do workspace cabe no orçamento e cursor volta às linhas realmente entregues', () => {
  const layers = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, name: '😀'.repeat(60) }));
  const source = { count: 10, total: 30, offset: 10, nextOffset: 20, hasMore: true, layers, notice: 'Aviso'.repeat(3000) };
  const out = boundFindResponse(source, 1024);
  assert.ok(bytes(out) <= 1024); assert.ok(out.count > 0 && out.count < 10);
  assert.equal(out.nextOffset, 10 + out.count); assert.equal(out.hasMore, true);
  assert.match(out.notice, /projeto mudou/); assert.equal(source.layers.length, 10);
  assert.deepEqual(out.layers, layers.slice(0, out.count));
});
test('orçamento nunca entrega página vazia com cursor travado por uma linha grande', () => {
  assert.throws(() => boundFindResponse({ count: 1, total: 1, offset: 0, nextOffset: null, hasMore: false, layers: [{ id: 'x'.repeat(2000) }] }, 1024), /maxBytes/);
});
