// Testes da parte matemática do importador de SVG (src/svgimport.js): leitura do `d`, arcos, transformações e cores.
// A parte que usa o DOM (importSvg) é testada no navegador em tests/e2e/svg-icones-fontes.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePathD, arcToCubics, parseTransform, transformContours, contoursBounds, parseColor, multiply } from '../src/svgimport.js';
import { nodePathData } from '../src/css.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('caminho com retas absolutas e relativas, H/V e Z', () => {
  const [c] = parsePathD('M10 10 L20 10 l0 10 H10 V15 z');
  assert.equal(c.closed, true);
  assert.deepEqual(c.points.map((p) => [p.x, p.y]), [[10, 10], [20, 10], [20, 20], [10, 20], [10, 15]]);
  assert.ok(c.points.every((p) => !p.hin && !p.hout), 'retas não têm alças');
});

test('pares extras repetem o comando; depois de M viram linhas', () => {
  const [c] = parsePathD('M0 0 10 0 10 10');
  assert.equal(c.points.length, 3);
  const [d] = parsePathD('m5 5 10 0 0 10');
  assert.deepEqual(d.points.map((p) => [p.x, p.y]), [[5, 5], [15, 5], [15, 15]]);
});

test('números colados ("-" e ".") como os ícones do Google usam', () => {
  const [c] = parsePathD('M240-200h120v-240h.5-.5Z');
  assert.deepEqual(c.points.slice(0, 4).map((p) => [p.x, p.y]), [[240, -200], [360, -200], [360, -440], [360.5, -440]]);
});

test('curvas C e S: alças nos pontos certos (S espelha a anterior)', () => {
  const [c] = parsePathD('M0 0 C10 0 20 10 20 20 S30 40 40 40');
  assert.deepEqual(c.points[0].hout, { x: 10, y: 0 });
  assert.deepEqual(c.points[1].hin, { x: 20, y: 10 });
  assert.deepEqual(c.points[1].hout, { x: 20, y: 30 }, 'reflexo de (20,10) em torno de (20,20)');
  assert.deepEqual(c.points[2].hin, { x: 30, y: 40 });
});

test('quadrática Q vira cúbica equivalente (controles a 2/3)', () => {
  const [c] = parsePathD('M0 0 Q30 30 60 0');
  assert.ok(near(c.points[0].hout.x, 20) && near(c.points[0].hout.y, 20));
  assert.ok(near(c.points[1].hin.x, 40) && near(c.points[1].hin.y, 20));
});

test('vários subcaminhos viram vários contornos (furos)', () => {
  const cs = parsePathD('M0 0H10V10H0Z M3 3H7V7H3Z');
  assert.equal(cs.length, 2);
  assert.ok(cs.every((c) => c.closed));
});

test('Z fecha juntando o último ponto se ele repete o primeiro', () => {
  const [c] = parsePathD('M0 0 L10 0 L10 10 L0 0 Z');
  assert.equal(c.points.length, 3);
});

test('arco: meio círculo vira 2 curvas que terminam no ponto certo e passam pelo raio', () => {
  const segs = arcToCubics(0, 0, 10, 10, 0, 0, 1, 20, 0);
  assert.equal(segs.length, 2);
  const last = segs[segs.length - 1];
  assert.ok(near(last[4], 20) && near(last[5], 0));
  // o ponto do meio do arco (fim do 1º segmento) fica a 10 do centro (10,0)
  const mid = segs[0];
  assert.ok(near(Math.hypot(mid[4] - 10, mid[5]), 10, 1e-6));
  assert.deepEqual(arcToCubics(0, 0, 0, 10, 0, 0, 1, 5, 5), [], 'raio zero = linha (sem curvas)');
});

test('arco com raio pequeno demais é aumentado (regra do SVG)', () => {
  const segs = arcToCubics(0, 0, 1, 1, 0, 0, 1, 20, 0);
  assert.ok(segs.length >= 1);
  const last = segs[segs.length - 1];
  assert.ok(near(last[4], 20) && near(last[5], 0));
});

test('transform: translate, scale, rotate com centro e composição', () => {
  assert.deepEqual(parseTransform('translate(10 20)'), [1, 0, 0, 1, 10, 20]);
  assert.deepEqual(parseTransform('scale(2)'), [2, 0, 0, 2, 0, 0]);
  const r = parseTransform('rotate(90 10 10)');
  // gira (20,10) 90° em torno de (10,10) → (10,20)
  const p = transformContours([{ closed: false, points: [{ x: 20, y: 10, hin: null, hout: null }] }], r)[0].points[0];
  assert.ok(near(p.x, 10) && near(p.y, 20));
  assert.deepEqual(parseTransform('translate(5,0) scale(2)'), multiply([1, 0, 0, 1, 5, 0], [2, 0, 0, 2, 0, 0]));
});

test('limites consideram a curva, não só os pontos', () => {
  const b = contoursBounds(parsePathD('M0 0 C0 -20 20 -20 20 0'));
  assert.ok(b.y0 < -10, 'a curva sobe acima de y=0');
});

test('cores: hex curto/longo/com alfa e rgb/rgba', () => {
  assert.deepEqual(parseColor('#abc'), { color: '#AABBCC', alpha: 1 });
  assert.deepEqual(parseColor('#11223380'), { color: '#112233', alpha: 128 / 255 });
  assert.deepEqual(parseColor('rgb(255, 0, 10)'), { color: '#FF000A', alpha: 1 });
  assert.deepEqual(parseColor('rgba(0 0 0 / 50%)'), { color: '#000000', alpha: 0.5 });
});

test('vetor com contornos extras gera um `d` com todos', () => {
  const d = nodePathData({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: true, contours: [{ closed: true, points: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 4 }] }] });
  assert.equal((d.match(/M/g) || []).length, 2);
  assert.equal((d.match(/Z/g) || []).length, 2);
});
