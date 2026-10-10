import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundedUtf8Chunk } from '../src/agent/content.js';

test('trechos UTF-8 respeitam o limite e remontam sem corromper caracteres', () => {
  const text = `A😀${'é'.repeat(700)}fim`;
  const first = boundedUtf8Chunk(text, { maxBytes: 1024 });
  assert.ok(first.chunkBytes <= 1024);
  assert.equal(first.complete, false);
  const second = boundedUtf8Chunk(text, { offset: first.nextOffset, maxBytes: 1024 });
  const rest = boundedUtf8Chunk(text, { offset: second.nextOffset, maxBytes: 1024 });
  assert.equal(first.content + second.content + rest.content, text);
  assert.equal(rest.complete, true);
  assert.equal(second.offset, first.nextOffset);
});

test('recusa offsets dentro de caracteres ou fora do conteúdo', () => {
  assert.throws(() => boundedUtf8Chunk('A😀B', { offset: 2 }), /entre caracteres UTF-8/);
  assert.throws(() => boundedUtf8Chunk('abc', { offset: 4 }), /posição válida/);
});

test('limita cada resposta entre 1 KiB e 1 MiB', () => {
  const text = 'x'.repeat(2 * 1024 * 1024);
  assert.equal(boundedUtf8Chunk(text, { maxBytes: 1 }).chunkBytes, 1024);
  assert.equal(boundedUtf8Chunk(text, { maxBytes: 99 * 1024 * 1024 }).chunkBytes, 1024 * 1024);
});
