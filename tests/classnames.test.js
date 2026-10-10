import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode } from '../src/model.js';
import { generateCode, classNamesOf } from '../src/css.js';

const named = (name) => ({ ...createNode('rect', { x: 0, y: 0 }), name });
const classesOf = (names) => {
  const root = { ...createNode('frame', { x: 0, y: 0 }), name: 'raiz', children: names.map(named) };
  const m = classNamesOf([root]);
  return root.children.map((c) => m.get(c.id));
};

test('classe nunca comeca com digito', () => {
  const [c] = classesOf(['2024 Hero']);
  assert.match(c, /^[a-z]/);
  assert.equal(c, 'l-2024-hero');
});

test('regra CSS gerada tem seletor valido para nome numerico', () => {
  const { css } = generateCode([named('2024 Hero')], null);
  assert.doesNotMatch(css, /\.\d/);
});

test('"botao 2" nao colide com duas camadas "botao"', () => {
  const cs = classesOf(['botao 2', 'botao', 'botao']);
  assert.equal(new Set(cs).size, 3);
});

test('nomes normais mantem a saida atual', () => {
  assert.deepEqual(classesOf(['Botão', 'Botão', 'Card']), ['botao', 'botao-2', 'card']);
});

test('nome vazio ou so simbolos vira item, sem colidir', () => {
  assert.deepEqual(classesOf(['', '!!!', 'item']), ['item', 'item-2', 'item-3']);
});
