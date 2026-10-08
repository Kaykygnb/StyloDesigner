// Paletas de cor próprias: funções puras (normalizar, criar, parse de texto, cores do projeto, CSS, limpeza).
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHex, makePalette, addColor, removeColor, parseColors, docColors, paletteCss, sanitize, slug, MAX_COLORS } from '../src/palettes.js';

test('normalizeHex: aceita 3 e 6 dígitos, com ou sem #, e rejeita o resto', () => {
  assert.equal(normalizeHex('#abc'), '#AABBCC');
  assert.equal(normalizeHex('7c5cff'), '#7C5CFF');
  assert.equal(normalizeHex(' #7c5cff '), '#7C5CFF');
  assert.equal(normalizeHex('azul'), null);
  assert.equal(normalizeHex('#12345'), null);
  assert.equal(normalizeHex(null), null);
});

test('makePalette: descarta cores inválidas e repetidas, nome padrão', () => {
  const p = makePalette('  ', ['#fff', 'FFFFFF', 'xx', '#000']);
  assert.equal(p.name, 'Paleta');
  assert.deepEqual(p.colors, ['#FFFFFF', '#000000']);
  assert.match(p.id, /^pal_/);
});

test('addColor / removeColor: sem repetir e com limite', () => {
  const p = makePalette('x');
  assert.equal(addColor(p, '#f00'), true);
  assert.equal(addColor(p, '#FF0000'), false); // repetida
  assert.equal(addColor(p, 'nada'), false);
  assert.equal(removeColor(p, '#ff0000'), true);
  assert.equal(removeColor(p, '#ff0000'), false);
  for (let i = 0; i < MAX_COLORS + 5; i++) addColor(p, '#' + i.toString(16).padStart(6, '0'));
  assert.equal(p.colors.length, MAX_COLORS);
});

test('parseColors: lista livre, rgb(), repetidas, lixo', () => {
  assert.deepEqual(parseColors('#7c5cff, 00c7be;  #fff\n#7C5CFF'), ['#7C5CFF', '#00C7BE', '#FFFFFF']);
  assert.deepEqual(parseColors('rgb(255, 0, 0) rgba(0,0,255,0.5)'), ['#FF0000', '#0000FF']);
  assert.deepEqual(parseColors('olá mundo'), []);
  assert.deepEqual(parseColors(''), []);
});

test('docColors: conta preenchimento, paradas de gradiente, contorno e sombra, da mais usada para a menos', () => {
  const doc = { pages: [{ children: [
    { fill: { type: 'solid', color: '#ff0000' }, stroke: { color: '#000000' }, shadows: [{ color: '#000000' }], children: [
      { fill: { type: 'solid', color: '#FF0000' } },
      { fill: { type: 'linear', stops: [{ color: '#00ff00' }, { color: '#0000ff' }] } },
    ] },
    { fill: { type: 'none' } },
  ] }] };
  assert.deepEqual(docColors(doc).slice(0, 2), ['#FF0000', '#000000']);
  assert.equal(docColors(doc).length, 4);
  assert.deepEqual(docColors(doc, 1), ['#FF0000']);
  assert.deepEqual(docColors(null), []);
});

test('paletteCss e slug: variáveis de CSS sem acento', () => {
  const p = makePalette('Marca Roxa Ação', ['#7c5cff', '#00c7be']);
  assert.equal(slug(p.name), 'marca-roxa-acao');
  assert.equal(paletteCss(p), ':root {\n  --marca-roxa-acao-1: #7C5CFF;\n  --marca-roxa-acao-2: #00C7BE;\n}');
});

test('sanitize: lixo vira lista vazia, dados bons ficam', () => {
  assert.deepEqual(sanitize('x'), []);
  assert.deepEqual(sanitize([null, 3, 'a']), []);
  const [p] = sanitize([{ id: 'pal_abc', name: 'Minha', colors: ['#fff', 'zzz', '#fff'] }]);
  assert.equal(p.id, 'pal_abc');
  assert.deepEqual(p.colors, ['#FFFFFF']);
  const [q] = sanitize([{ id: '<script>', name: 'A', colors: 'não é lista' }]);
  assert.match(q.id, /^pal_/);
  assert.deepEqual(q.colors, []);
});
