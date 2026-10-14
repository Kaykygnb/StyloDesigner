// Vetor desenhado à mão: a caixa segue a curva (não as alças) e o `d` do SVG sai certo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathD, pathFromStroke } from '../apps/studio/src/editor/canvas/path.ts';

test('pathFromStroke: caixa da curva, sem as alças, e pontos relativos', () => {
  // meia elipse: os pontos de controle sobem a 100, mas a curva só chega a 75 (3/4 da altura do controle)
  const { x0, y0, w, h, points } = pathFromStroke([
    { x: 100, y: 200, hin: null, hout: { x: 100, y: 100 } },
    { x: 200, y: 200, hin: { x: 200, y: 100 }, hout: null },
  ], false);
  assert.equal(x0, 100);
  assert.ok(Math.abs(y0 - 125) < 1, `topo da curva ≈125, veio ${y0}`);
  assert.equal(w, 100);
  assert.ok(h >= 74 && h <= 76, `altura ≈75, veio ${h}`);
  assert.equal(points[0].x, 0);
  assert.equal(points[0].hin, null);
  assert.deepEqual(points[0].hout, { x: 0, y: Math.round((100 - y0) * 100) / 100 });
});

test('pathFromStroke: traço de um ponto só continua com caixa mínima de 1×1', () => {
  const r = pathFromStroke([{ x: 5, y: 5 }, { x: 5, y: 5 }], false);
  assert.equal(r.w, 1); assert.equal(r.h, 1);
});

test('pathD: retas sem alça, curva com alça e Z quando fechado', () => {
  assert.equal(pathD({ points: [] }), '');
  assert.equal(pathD({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }), 'M 0 0 C 0 0 10 0 10 0');
  assert.equal(pathD({ points: [{ x: 0, y: 0, hout: { x: 3, y: 4 } }, { x: 10, y: 0, hin: { x: 7, y: 4 } }], closed: true }), 'M 0 0 C 3 4 7 4 10 0 Z');
});
