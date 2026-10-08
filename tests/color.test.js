// Matemática de cor: conversões, harmonias, contraste WCAG.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, rgbToHsl, hslToRgb, rotateHue, withLightness, harmonies, contrast, wcagLevel, luminance } from '../src/color.js';

test('hex ↔ rgb', () => {
  assert.deepEqual(hexToRgb('#7c5cff'), { r: 124, g: 92, b: 255 });
  assert.deepEqual(hexToRgb('abc'), { r: 170, g: 187, b: 204 });
  assert.deepEqual(hexToRgb('lixo'), { r: 0, g: 0, b: 0 });
  assert.equal(rgbToHex({ r: 124, g: 92, b: 255 }), '#7C5CFF');
  assert.equal(rgbToHex({ r: -5, g: 300, b: 0.4 }), '#00FF00');
});

test('rgb ↔ hsv e rgb ↔ hsl voltam ao mesmo lugar', () => {
  for (const hex of ['#7C5CFF', '#FF3B30', '#34C759', '#000000', '#FFFFFF', '#808080']) {
    const rgb = hexToRgb(hex);
    assert.equal(rgbToHex(hsvToRgb(rgbToHsv(rgb))), hex);
    assert.equal(rgbToHex(hslToRgb(rgbToHsl(rgb))), hex);
  }
  const red = rgbToHsl({ r: 255, g: 0, b: 0 });
  assert.equal(Math.round(red.h), 0); assert.equal(red.s, 1); assert.equal(red.l, 0.5);
});

test('rotateHue e withLightness', () => {
  assert.equal(rotateHue('#FF0000', 120), '#00FF00');
  assert.equal(rotateHue('#FF0000', 360), '#FF0000');
  assert.equal(rotateHue('#FF0000', 180), '#00FFFF');
  assert.equal(withLightness('#FF0000', 1), '#FFFFFF');
  assert.equal(withLightness('#FF0000', 0), '#000000');
});

test('harmonias: complementar, análogas, tríade e tons', () => {
  const h = Object.fromEntries(harmonies('#ff0000').map((x) => [x.key, x.colors]));
  assert.deepEqual(h.complementar, ['#FF0000', '#00FFFF']);
  assert.equal(h.analogas.length, 3);
  assert.equal(h.analogas[1], '#FF0000');
  assert.deepEqual(h.triade, ['#FF0000', '#00FF00', '#0000FF']);
  assert.equal(h.tons.length, 7);
  assert.ok(luminance(h.tons[0]) > luminance(h.tons[6])); // do claro ao escuro
});

test('contraste WCAG', () => {
  assert.equal(Math.round(contrast('#000000', '#FFFFFF')), 21);
  assert.equal(contrast('#777777', '#777777'), 1);
  assert.equal(wcagLevel(21), 'AAA');
  assert.equal(wcagLevel(5), 'AA');
  assert.equal(wcagLevel(3.2), 'AA grande');
  assert.equal(wcagLevel(2), 'falha');
});
