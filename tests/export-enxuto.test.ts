import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode } from '@stylo/core/model.js';
import { nodeStyle, boxShorthand } from '@stylo/core/css.js';
import { applyProps } from '@stylo/core/tools/runner/properties.ts';

test('padding sai na forma curta do CSS', () => {
  assert.equal(boxShorthand(24, 24, 24, 24), '24px');
  assert.equal(boxShorthand(8, 16, 8, 16), '8px 16px');
  assert.equal(boxShorthand(8, 16, 4, 16), '8px 16px 4px');
  assert.equal(boxShorthand(1, 2, 3, 4), '1px 2px 3px 4px');
});

test('gap sozinho num grid vale para linhas e colunas', () => {
  const f = createNode('frame');
  applyProps(f, { layout: { mode: 'grid', cols: 3, gap: 24 } });
  assert.equal(nodeStyle(f, null).gap, '24px 24px');
  // colGap/rowGap explícitos continuam mandando
  applyProps(f, { layout: { gap: 10, colGap: 32 } });
  assert.equal(nodeStyle(f, null).gap, '10px 32px');
});
