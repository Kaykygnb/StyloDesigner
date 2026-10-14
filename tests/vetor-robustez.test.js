// Vetor: operações sobre caminhos (inverter, dividir, unir, deslocar, contorno → forma) precisam preservar a geometria.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '@stylo/core/store.js';
import { makeDoc } from '@stylo/core/model.js';
import { createRunner } from '@stylo/core/tools/runner.js';
import { createCommands } from '@stylo/core/commands.js';
import { flattenContour } from '@stylo/core/geom.js';
import { createModelCanvas } from '../apps/server/src/workspace/model-canvas.js';
import '../apps/server/src/dom-polyfill.ts';

const novo = () => {
  const store = createStore({ initial: { doc: makeDoc() } });
  const commands = createCommands(store, createModelCanvas(store));
  const runner = createRunner({ store, commands, approve: async () => true });
  return { store, runner, commands };
};
const criar = async (runner, store, props) => {
  const r = await runner.run('build_layout', { tree: { type: 'path', props } });
  assert.ok(!r.error, r.error);
  return store.page().children[0];
};
const caixa = (pts) => ({ x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)) });
const larg = (pts) => { const b = caixa(pts); return { w: b.x1 - b.x0, h: b.y1 - b.y0 }; };
const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (±${tol})`);

test('inverter: ponto só com alça de saída vira ponto só com alça de entrada (e inverter duas vezes devolve o original)', async () => {
  const { store, runner } = novo();
  const n = await criar(runner, store, { w: 100, h: 100, vw: 100, vh: 100, closed: false, fill: 'none', stroke: { color: '#000', width: 2 },
    points: [{ x: 0, y: 0, hout: { x: 30, y: 0 } }, { x: 60, y: 50 }, { x: 100, y: 100, hin: { x: 100, y: 70 } }] });
  const original = JSON.parse(JSON.stringify(n.points));
  const r = await runner.run('reverse_vector', { id: n.id });
  assert.ok(!r.error, r.error);
  const rev = store.get(n.id).points;
  assert.deepEqual([rev[0].x, rev[0].y], [100, 100]);
  assert.equal(rev[0].hin ?? null, null, 'o novo primeiro ponto não tem alça de entrada');
  assert.deepEqual(rev[0].hout, { x: 100, y: 70 }, 'a alça de entrada antiga virou de saída');
  assert.equal(rev[2].hout ?? null, null, 'o novo último ponto não tem alça de saída');
  assert.deepEqual(rev[2].hin, { x: 30, y: 0 });
  await runner.run('reverse_vector', { id: n.id });
  const volta = store.get(n.id).points;
  for (const [i, p] of volta.entries()) {
    assert.deepEqual([p.x, p.y, p.hin ?? null, p.hout ?? null], [original[i].x, original[i].y, original[i].hin ?? null, original[i].hout ?? null]);
  }
});

test('dividir contorno: os contornos novos guardam só pontos e fechamento, não uma cópia da camada', async () => {
  const { store, runner } = novo();
  const n = await criar(runner, store, { name: 'Zigue', w: 100, h: 100, vw: 100, vh: 100, closed: false, fill: 'none', stroke: { color: '#000', width: 2 },
    points: [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }, { x: 100, y: 100 }] });
  const r = await runner.run('split_vector_contour', { id: n.id, contour_index: 0, node_index: 1 });
  assert.ok(!r.error, r.error);
  const node = store.get(n.id);
  assert.equal(node.contours.length, 1);
  assert.deepEqual(Object.keys(node.contours[0]).sort(), ['closed', 'points'], 'sem id, nome, fill… copiados da camada');
  assert.equal(node.points.length, 2);
  assert.equal(node.contours[0].points.length, 3);
});

test('dividir e unir de novo mantém a mesma linha desenhada', async () => {
  const { store, runner } = novo();
  const n = await criar(runner, store, { w: 100, h: 100, vw: 100, vh: 100, closed: false, fill: 'none', stroke: { color: '#000', width: 2 },
    points: [{ x: 0, y: 0, hout: { x: 20, y: 0 } }, { x: 50, y: 50, hin: { x: 30, y: 50 }, hout: { x: 70, y: 50 } }, { x: 100, y: 100, hin: { x: 100, y: 80 } }] });
  const antes = flattenContour(n.points, false, 0.2);
  await runner.run('split_vector_contour', { id: n.id, contour_index: 0, node_index: 1 });
  await runner.run('join_vector_contours', { id: n.id });
  const depois = flattenContour(store.get(n.id).points, false, 0.2);
  assert.equal(depois.length, antes.length);
  for (const [i, p] of depois.entries()) { perto(p.x, antes[i].x, 1e-6, `x${i}`); perto(p.y, antes[i].y, 1e-6, `y${i}`); }
});

test('deslocar contorno: um quadrado 60×60 deslocado em 10 vira 80×80 (cada lado anda 10, não 7)', async () => {
  const { store, runner } = novo();
  const n = await criar(runner, store, { w: 100, h: 100, vw: 100, vh: 100, closed: true, fill: '#000',
    points: [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 80 }, { x: 20, y: 80 }] });
  const r = await runner.run('offset_path', { id: n.id, distance: 10 });
  assert.ok(!r.error, r.error);
  const g = larg(store.get(n.id).points);
  perto(g.w, 80, 0.05, 'largura'); perto(g.h, 80, 0.05, 'altura');
  await runner.run('offset_path', { id: n.id, distance: -20 });
  const h = larg(store.get(n.id).points);
  perto(h.w, 40, 0.05, 'largura p/ dentro'); perto(h.h, 40, 0.05, 'altura p/ dentro');
});

test('contorno → forma: o anel de um quadrado 60×60 com traço 10 tem 70×70 por fora e 50×50 por dentro', async () => {
  const { store, runner } = novo();
  const n = await criar(runner, store, { w: 100, h: 100, vw: 100, vh: 100, closed: true, fill: 'none', stroke: { color: '#000', width: 10 },
    points: [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 80 }, { x: 20, y: 80 }] });
  const r = await runner.run('stroke_to_path', { id: n.id });
  assert.ok(!r.error, r.error);
  const node = store.get(n.id);
  const externo = larg(node.points), interno = larg(node.contours[0].points);
  perto(externo.w, 70, 0.05, 'externo'); perto(interno.w, 50, 0.05, 'interno');
});

test('contorno → forma em linha aberta em L: espessura constante no canto (esquadro)', async () => {
  const { store, runner } = novo();
  const n = await criar(runner, store, { w: 100, h: 100, vw: 100, vh: 100, closed: false, fill: 'none', stroke: { color: '#000', width: 10, cap: 'butt' },
    points: [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }] });
  const r = await runner.run('stroke_to_path', { id: n.id });
  assert.ok(!r.error, r.error);
  const node = store.get(n.id);
  // o L vai de x 10→95 e y 5→90 (a quina externa é (95, 5)): caixa 85×85
  const g = larg(node.points);
  perto(g.w, 85, 0.1, 'largura'); perto(g.h, 85, 0.1, 'altura');
  // distância entre a quina externa e a interna = a diagonal da espessura (10√2)
  const { x0, y0 } = caixa(node.points);
  const externa = node.points.find((p) => Math.abs(p.x - (x0 + 85)) < 0.1 && Math.abs(p.y - y0) < 0.1);
  assert.ok(externa, 'existe a quina externa');
  const interna = node.points.find((p) => Math.abs(p.x - (x0 + 75)) < 0.1 && Math.abs(p.y - (y0 + 10)) < 0.1);
  assert.ok(interna, 'existe a quina interna, 10 para dentro');
});

test('fuzz: nenhuma operação de vetor devolve NaN ou lança com contornos degenerados', async () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const formas = [
    [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
    [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
    [{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 50, y: 5 }, { x: 50, y: 5 }],
    [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0.0001 }],
  ];
  for (let i = 0; i < 40; i++) formas.push(Array.from({ length: 3 + Math.floor(rnd() * 9) }, () => ({ x: Math.round(rnd() * 100), y: Math.round(rnd() * 100), ...(rnd() < 0.5 ? { hout: { x: rnd() * 100, y: rnd() * 100 }, hin: { x: rnd() * 100, y: rnd() * 100 } } : {}) })));
  const finitos = (node) => [node.points, ...(node.contours || []).map((c) => c.points)].flat().every((p) => [p.x, p.y, p.hin?.x ?? 0, p.hin?.y ?? 0, p.hout?.x ?? 0, p.hout?.y ?? 0].every(Number.isFinite));
  for (const [k, points] of formas.entries()) for (const closed of [true, false]) {
    for (const op of [['reverse_vector', {}], ['simplify_vector', { tolerance: 2 }], ['offset_path', { distance: 3 }], ['offset_path', { distance: -3 }], ['stroke_to_path', {}], ['split_vector_contour', { node_index: 1 }], ['join_vector_contours', {}]]) {
      const { store, runner } = novo();
      const n = await criar(runner, store, { w: 100, h: 100, vw: 100, vh: 100, closed, fill: closed ? '#000' : 'none', stroke: { color: '#000', width: 4 }, points: JSON.parse(JSON.stringify(points)) });
      const r = await runner.run(op[0], { id: n.id, ...op[1] });
      // recusar com mensagem é aceitável; lançar exceção solta ou gravar NaN, não
      assert.ok(r && typeof r === 'object', `forma ${k} ${op[0]} sem resposta`);
      assert.ok(finitos(store.get(n.id)), `forma ${k} (${closed ? 'fechada' : 'aberta'}) ${op[0]} gravou coordenada inválida`);
    }
  }
});

test('deslocar contorno: vale nos dois sentidos de desenho, recusa recuo maior que a forma e não lança pontas enormes', async () => {
  for (const pontos of [
    [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 80 }, { x: 20, y: 80 }],
    [{ x: 20, y: 20 }, { x: 20, y: 80 }, { x: 80, y: 80 }, { x: 80, y: 20 }],
  ]) {
    const { store, runner } = novo();
    const n = await criar(runner, store, { w: 100, h: 100, vw: 100, vh: 100, closed: true, fill: '#000', points: pontos });
    await runner.run('offset_path', { id: n.id, distance: 5 });
    perto(larg(store.get(n.id).points).w, 70, 0.05, 'para fora');
    const antes = JSON.stringify(store.get(n.id).points);
    const r = await runner.run('offset_path', { id: n.id, distance: -50 });
    assert.ok(r.error, 'recuo maior que a forma é recusado');
    assert.equal(JSON.stringify(store.get(n.id).points), antes, 'a forma não muda quando recusa');
  }
  // triângulo muito agudo: a ponta não passa de 4× a distância
  const { store, runner } = novo();
  const n = await criar(runner, store, { w: 100, h: 100, vw: 100, vh: 100, closed: true, fill: '#000', points: [{ x: 0, y: 50 }, { x: 100, y: 45 }, { x: 100, y: 55 }] });
  await runner.run('offset_path', { id: n.id, distance: 10 });
  const g = larg(store.get(n.id).points);
  assert.ok(g.w < 100 + 2 * 10 * 4 + 1, `largura ${g.w} dentro do limite de ponta`);
});

test('contorno → forma: junção redonda arredonda o canto de fora e as pontas redondas fecham o traço', async () => {
  const { store, runner } = novo();
  const n = await criar(runner, store, { w: 100, h: 100, vw: 100, vh: 100, closed: false, fill: 'none', stroke: { color: '#000', width: 10, cap: 'round', join: 'round' },
    points: [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }] });
  const r = await runner.run('stroke_to_path', { id: n.id });
  assert.ok(!r.error, r.error);
  const g = larg(store.get(n.id).points);
  perto(g.w, 90, 0.2, 'largura: 5 de ponta de cada lado'); perto(g.h, 90, 0.2, 'altura');
  assert.ok(store.get(n.id).points.length > 20, 'tem arcos, não só retas');
});

test('inverter: num caminho FECHADO com ponto de uma alça só, a forma desenhada continua a mesma', async () => {
  const { store, runner } = novo();
  const fechado = [{ x: 0, y: 0 }, { x: 60, y: 0, hout: { x: 80, y: 30 } }, { x: 60, y: 60 }, { x: 0, y: 60 }];
  const n = await criar(runner, store, { w: 100, h: 100, vw: 100, vh: 100, closed: true, fill: '#000', points: JSON.parse(JSON.stringify(fechado)) });
  await runner.run('reverse_vector', { id: n.id });
  const ref = flattenContour(fechado, true, 0.2), nova = flattenContour(store.get(n.id).points, true, 0.2);
  const longe = (a, b) => Math.max(...a.map((p) => Math.min(...b.map((q) => Math.hypot(p.x - q.x, p.y - q.y)))));
  assert.ok(Math.max(longe(ref, nova), longe(nova, ref)) < 0.05, 'a curva não pode deformar (a alça antiga não fica sobrando)');
});
