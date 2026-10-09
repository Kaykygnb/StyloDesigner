// Testes da geometria dos vetores (src/geom.js): simplificação, ajuste de curvas, booleanas, canto/curva e path data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rdp, fitCurve, smoothStroke, flattenContour, polygonArea, booleanPolygons, polygonsToContours, insideShape,
  pointMode, dragHandle, smoothPoint, cornerPoint, reversePoints, ellipseContour, rectContour, cubicAt,
} from '../src/geom.js';
import { pathData } from '../src/css.js';

const square = (x, y, s) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];
const area = (rings) => rings.reduce((s, r) => s + polygonArea(r), 0);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} esperado ${b}, veio ${a}`);

test('rdp tira pontos quase colineares e mantém as quinas', () => {
  const line = [];
  for (let i = 0; i <= 100; i++) line.push({ x: i, y: Math.sin(i) * 0.1 });
  assert.equal(rdp(line, 0.5).length, 2);
  const L = [{ x: 0, y: 0 }, { x: 5, y: 0.01 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 10, y: 10 }];
  assert.deepEqual(rdp(L, 0.1).map((p) => [p.x, p.y]), [[0, 0], [10, 0], [10, 10]]);
});

test('fitCurve aproxima um arco de círculo com poucas curvas e erro pequeno', () => {
  const arc = [];
  for (let i = 0; i <= 60; i++) { const a = (i / 60) * Math.PI; arc.push({ x: 100 * Math.cos(a), y: 100 * Math.sin(a) }); }
  const fit = fitCurve(arc, 1);
  assert.ok(fit.length >= 2 && fit.length <= 5, `pontos: ${fit.length}`);
  // amostra cada segmento e confere a distância ao círculo
  for (let i = 0; i < fit.length - 1; i++) {
    const a = fit[i], b = fit[i + 1];
    for (let t = 0; t <= 1; t += 0.1) {
      const p = cubicAt(a, a.hout, b.hin, b, t);
      near(Math.hypot(p.x, p.y), 100, 1.5, 'raio');
    }
  }
  // pontos internos são suaves (alças alinhadas)
  for (const p of fit.slice(1, -1)) assert.notEqual(pointMode(p), 'free');
});

test('smoothStroke: suavização 0 mantém retas; suavização alta gera menos pontos', () => {
  const raw = [];
  for (let i = 0; i <= 200; i++) raw.push({ x: i * 2, y: 40 * Math.sin(i / 20) + (i % 2 ? 0.6 : -0.6) });
  const low = smoothStroke(raw, 0);
  const high = smoothStroke(raw, 100);
  assert.ok(low.every((p) => !p.hin && !p.hout));
  assert.ok(high.length < low.length, `${high.length} < ${low.length}`);
  assert.ok(high.some((p) => p.hout), 'tem curvas');
  assert.equal(high[0].x, 0);
});

test('flattenContour: curva vira vários pontos; reta fica com 2', () => {
  const e = ellipseContour(100, 100);
  const poly = flattenContour(e, true, 0.5);
  assert.ok(poly.length > 16);
  near(Math.abs(polygonArea(poly)), Math.PI * 50 * 50, 60, 'área do círculo');
  assert.equal(flattenContour([{ x: 0, y: 0 }, { x: 10, y: 0 }], false).length, 2);
});

test('booleanas entre dois quadrados sobrepostos', () => {
  const A = { rings: [square(0, 0, 10)], rule: 'nonzero' };
  const B = { rings: [square(5, 5, 10)], rule: 'nonzero' };
  near(Math.abs(area(booleanPolygons([A, B], 'union'))), 175, 1e-6, 'unir');
  near(Math.abs(area(booleanPolygons([A, B], 'subtract'))), 75, 1e-6, 'subtrair');
  near(Math.abs(area(booleanPolygons([A, B], 'intersect'))), 25, 1e-6, 'interseção');
  const x = booleanPolygons([A, B], 'exclude');
  near(Math.abs(area(x)), 150, 1e-6, 'excluir (área líquida: furo em sentido contrário)');
  assert.equal(insideShape({ rings: x, rule: 'nonzero' }, { x: 7, y: 7 }), false);
  assert.equal(insideShape({ rings: x, rule: 'nonzero' }, { x: 2, y: 2 }), true);
  assert.equal(booleanPolygons([A, B], 'union').length, 1);
});

test('booleanas: bordas coincidentes, furo e formas separadas', () => {
  const A = { rings: [square(0, 0, 10)], rule: 'nonzero' };
  const B = { rings: [square(10, 0, 10)], rule: 'nonzero' }; // encosta pela borda
  const u = booleanPolygons([A, B], 'union');
  assert.equal(u.length, 1);
  near(Math.abs(polygonArea(u[0])), 200, 1e-6);
  // furo: quadrado grande menos o pequeno do meio → 2 anéis com sentidos opostos (nonzero desenha o furo)
  const big = { rings: [square(0, 0, 30)], rule: 'nonzero' };
  const hole = { rings: [square(10, 10, 10)], rule: 'nonzero' };
  const d = booleanPolygons([big, hole], 'subtract');
  assert.equal(d.length, 2);
  assert.ok(Math.sign(polygonArea(d[0])) !== Math.sign(polygonArea(d[1])));
  near(Math.abs(area(d)), 800, 1e-6);
  assert.equal(insideShape({ rings: d, rule: 'nonzero' }, { x: 15, y: 15 }), false);
  assert.equal(insideShape({ rings: d, rule: 'nonzero' }, { x: 5, y: 5 }), true);
  // separadas: interseção vazia; união = 2 anéis
  const far = { rings: [square(50, 50, 5)], rule: 'nonzero' };
  assert.equal(booleanPolygons([A, far], 'intersect').length, 0);
  assert.equal(booleanPolygons([A, far], 'union').length, 2);
});

test('booleanas com círculos achatados + reajuste de curvas', () => {
  const c1 = { rings: [flattenContour(ellipseContour(100, 100), true, 0.2)], rule: 'nonzero' };
  const c2 = { rings: [flattenContour(ellipseContour(100, 100).map((p) => ({ x: p.x + 50, y: p.y, hin: { x: p.hin.x + 50, y: p.hin.y }, hout: { x: p.hout.x + 50, y: p.hout.y } })), true, 0.2)], rule: 'nonzero' };
  const u = booleanPolygons([c1, c2], 'union');
  assert.equal(u.length, 1);
  // área da união de 2 círculos r=50 com centros a 50: 2πr² − lente
  const r = 50, dd = 50;
  const lens = 2 * r * r * Math.acos(dd / (2 * r)) - (dd / 2) * Math.sqrt(4 * r * r - dd * dd);
  near(Math.abs(polygonArea(u[0])), 2 * Math.PI * r * r - lens, 40, 'área da união');
  const contours = polygonsToContours(u, { tol: 0.2 });
  assert.equal(contours.length, 1);
  const pts = contours[0].points;
  assert.ok(pts.length < 20, `poucos pontos depois do reajuste: ${pts.length}`);
  assert.ok(pts.some((p) => p.hout), 'voltou a ter curvas');
  assert.ok(pts.filter((p) => !p.hin && !p.hout).length <= 2, 'só as 2 quinas da junção podem ser canto');
});

test('canto ↔ curva e modos de alça', () => {
  const pts = [{ x: 0, y: 0, hin: null, hout: null }, { x: 10, y: 0, hin: null, hout: null }, { x: 20, y: 10, hin: null, hout: null }];
  smoothPoint(pts, 1, false);
  assert.equal(pointMode(pts[1]), 'mirror');
  assert.deepEqual(pts[1].hout, { x: 15, y: 2.5 });
  // espelhada: mover uma alça espelha a outra (mesmo comprimento)
  dragHandle(pts[1], 'hout', { x: 20, y: 0 });
  assert.deepEqual(pts[1].hin, { x: 0, y: 0 });
  // assimétrica: direção oposta, comprimento próprio
  pts[1].mode = 'asym';
  dragHandle(pts[1], 'hout', { x: 10, y: 5 });
  near(pts[1].hin.x, 10, 1e-9); near(pts[1].hin.y, -10, 1e-9);
  assert.equal(pointMode(pts[1]), 'asym');
  // independente: a outra não se mexe; Alt (breakMirror) também torna independente
  pts[1].mode = 'mirror';
  dragHandle(pts[1], 'hin', { x: 5, y: 5 }, true);
  assert.equal(pts[1].mode, 'free');
  near(pts[1].hout.x, 10, 1e-9); near(pts[1].hout.y, 5, 1e-9);
  cornerPoint(pts[1]);
  assert.equal(pointMode(pts[1]), 'corner');
  // ponto da ponta de caminho aberto também vira curva (usa o único vizinho)
  smoothPoint(pts, 0, false);
  assert.ok(pts[0].hout && pts[0].hin);
});

test('inverter direção troca as alças e mantém o desenho', () => {
  const pts = [{ x: 0, y: 0, hin: null, hout: { x: 5, y: -5 } }, { x: 10, y: 0, hin: { x: 8, y: -5 }, hout: null, mode: 'free' }];
  const r = reversePoints(pts);
  assert.equal(r[0].x, 10);
  assert.deepEqual(r[0].hout, { x: 8, y: -5 });
  assert.equal(r[0].mode, 'free');
  assert.equal(pathData(r, false), 'M 10 0 C 8 -5 5 -5 0 0');
});

test('path data de retângulo arredondado e elipse', () => {
  assert.equal(pathData(rectContour(10, 10), true), 'M 0 0 L 10 0 L 10 10 L 0 10 L 0 0 Z');
  const rr = rectContour(20, 10, [4, 4, 4, 4]);
  assert.equal(rr.length, 8);
  assert.match(pathData(rr, true), /^M 0 4 C 0 1\.79 1\.79 0 4 0 L 16 0 C/);
  const d = pathData(ellipseContour(20, 10), true);
  assert.match(d, /^M 10 0 C 15\.52 0 20 2\.24 20 5/);
});
