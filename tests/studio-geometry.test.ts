// As contas do canvas do painel (encaixe, medidas, redimensionar com rotação, rotacionar, soltar num auto layout).
import test from 'node:test';
import assert from 'node:assert/strict';
import { flowDrop, measures, resizeGroupBox, resizeSingle, rotateBy, scaleInto, snapMove, snapResize, union } from '../apps/studio/src/editor/canvas/geometry.ts';

const none = { rects: [], guidesX: [], guidesY: [] };

test('snapMove: gruda na borda do vizinho a menos de 6 px e desenha a linha-guia', () => {
  const box = { x: 100, y: 100, w: 50, h: 50 };
  const neighbor = { x: 200, y: 300, w: 80, h: 40 };
  // a borda direita da caixa (150 + 47) chega a 3 px da borda esquerda do vizinho (200)
  const r = snapMove(box, 47, 0, { rects: [neighbor], guidesX: [], guidesY: [] }, 6);
  assert.equal(r.dx, 50, 'ajustou para 200 − 150');
  assert.ok(r.guides.some((g) => g.axis === 'x' && g.pos === 200));
  // longe demais: não mexe
  assert.equal(snapMove(box, 30, 0, { rects: [neighbor], guidesX: [], guidesY: [] }, 6).dx, 30);
  // guia de régua também vale
  assert.equal(snapMove(box, 17, 0, { rects: [], guidesX: [120], guidesY: [] }, 6).dx, 20, 'borda esquerda (117) gruda na guia em 120');
});

test('snapMove: gruda no centro do vizinho', () => {
  const box = { x: 0, y: 0, w: 40, h: 40 };
  const neighbor = { x: 100, y: 0, w: 100, h: 100 }; // centro x = 150
  const r = snapMove(box, 131, 0, { rects: [neighbor], guidesX: [], guidesY: [] }, 6); // centro da caixa = 20 + 131 = 151
  assert.equal(r.dx, 130);
});

test('snapResize: só a borda puxada procura alvo; centros não contam', () => {
  const b = { x: 0, y: 0, w: 100, h: 100 };
  const parent = { x: 0, y: 0, w: 300, h: 300 };
  const r = snapResize(b, 197, 0, 1, 0, { rects: [parent], guidesX: [], guidesY: [] }, 6);
  assert.equal(r.dx, 200, 'a borda direita (100 + 197) gruda em 300');
  const c = snapResize(b, 48, 0, 1, 0, { rects: [{ x: 0, y: 0, w: 200, h: 100 }], guidesX: [], guidesY: [] }, 6); // borda 148 vs centro 100: não gruda no centro
  assert.equal(c.dx, 48);
  assert.equal(snapResize(b, 10, 10, 0, 0, { rects: [parent], guidesX: [], guidesY: [] }, 6).guides.length, 0);
});

test('measures: vão entre camadas separadas e margens quando está dentro', () => {
  const m = measures({ x: 0, y: 0, w: 50, h: 50 }, { x: 80, y: 10, w: 40, h: 20 });
  assert.equal(m.length, 1);
  assert.equal(m[0].len, 30);
  const inside = measures({ x: 20, y: 30, w: 10, h: 10 }, { x: 0, y: 0, w: 100, h: 100 });
  assert.deepEqual(inside.map((x) => x.len).sort((a, b) => a - b), [20, 30, 60, 70]);
  assert.deepEqual(measures({ x: 0, y: 0, w: 50, h: 50 }, { x: 40, y: 40, w: 50, h: 50 }), [], 'sobrepostas: nada');
});

test('resizeSingle: âncora do lado oposto fica parada (sem rotação)', () => {
  const r = resizeSingle({ x: 10, y: 20, w: 100, h: 50, rotation: 0, hx: 1, hy: 1, dx: 40, dy: 10, shift: false, alt: false });
  assert.deepEqual(r, { x: 10, y: 20, w: 140, h: 60 });
  const l = resizeSingle({ x: 10, y: 20, w: 100, h: 50, rotation: 0, hx: -1, hy: 0, dx: -30, dy: 0, shift: false, alt: false });
  assert.deepEqual(l, { x: -20, y: 20, w: 130, h: 50 }, 'puxar a borda esquerda move x');
});

test('resizeSingle: Shift mantém a proporção, Alt cresce do centro, limites valem', () => {
  const s = resizeSingle({ x: 0, y: 0, w: 100, h: 50, rotation: 0, hx: 1, hy: 1, dx: 100, dy: 0, shift: true, alt: false });
  assert.equal(s.w / s.h, 2);
  const a = resizeSingle({ x: 100, y: 100, w: 100, h: 100, rotation: 0, hx: 1, hy: 0, dx: 20, dy: 0, shift: false, alt: true });
  assert.deepEqual([a.x, a.w], [80, 140], 'cada lado andou 20: o centro não mexeu');
  const lim = resizeSingle({ x: 0, y: 0, w: 100, h: 100, rotation: 0, hx: 1, hy: 0, dx: 500, dy: 0, shift: false, alt: false, max: { w: 300 } });
  assert.equal(lim.w, 300);
  const min = resizeSingle({ x: 0, y: 0, w: 100, h: 100, rotation: 0, hx: 1, hy: 0, dx: -500, dy: 0, shift: false, alt: false });
  assert.equal(min.w, 1);
});

test('resizeSingle: girado 90°, puxar a alça "leste" (na tela, para baixo) cresce a altura visual e mantém a âncora', () => {
  // caixa 100×40 centrada em (50,20), girada 90° → ocupa visualmente 40 de largura e 100 de altura em torno do centro.
  const r = resizeSingle({ x: 0, y: 0, w: 100, h: 40, rotation: 90, hx: 1, hy: 0, dx: 0, dy: 30, shift: false, alt: false });
  assert.equal(r.w, 130);
  assert.equal(r.h, 40);
  // âncora = lado oeste (local): ponto (−w/2, 0) do centro, girado 90° → em cima do centro. Antes: (50, 20 − 50) = (50, −30)
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  assert.ok(Math.abs(cx - 50) < 1 && Math.abs(cy - 35) < 1, `novo centro (${cx}, ${cy}) deslizou 15 px para baixo`);
});

test('resizeGroupBox e scaleInto: escalar um conjunto leva cada camada junto', () => {
  const b = { x: 0, y: 0, w: 200, h: 100 };
  const { box, sx, sy } = resizeGroupBox(b, 1, 1, 200, 0, false);
  assert.deepEqual([box.w, box.h, sx, sy], [400, 100, 2, 1]);
  assert.deepEqual(scaleInto({ x: 100, y: 0, w: 50, h: 50 }, b, box), { x: 200, y: 0, w: 100, h: 50 });
  assert.deepEqual(union([{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 5, w: 10, h: 10 }]), { x: 0, y: 0, w: 30, h: 15 });
  const west = resizeGroupBox(b, -1, 0, -100, 0, false);
  assert.deepEqual([west.box.x, west.box.w], [-100, 300], 'puxar a borda esquerda mantém a direita parada');
});

test('rotateBy: gira com o ponteiro, Shift trava de 15 em 15°, fica entre -180 e 180', () => {
  assert.equal(rotateBy(0, 0, 40, false), 40);
  assert.equal(rotateBy(0, 0, 40, true), 45);
  assert.equal(rotateBy(170, 0, 30, false), -160);
});

test('flowDrop: reordena pelo irmão mais perto e dá a linha de inserção', () => {
  const sibs = [{ x: 0, y: 0, w: 100, h: 40 }, { x: 110, y: 0, w: 100, h: 40 }, { x: 220, y: 0, w: 100, h: 40 }];
  assert.equal(flowDrop(sibs, { x: 20, y: 20 }, true).index, 0, 'antes do primeiro');
  assert.equal(flowDrop(sibs, { x: 170, y: 20 }, true).index, 2, 'depois do segundo');
  const r = flowDrop(sibs, { x: 330, y: 20 }, true);
  assert.equal(r.index, 3);
  assert.equal(r.line?.pos, 320);
  const col = [{ x: 0, y: 0, w: 100, h: 40 }, { x: 0, y: 50, w: 100, h: 40 }];
  assert.equal(flowDrop(col, { x: 50, y: 60 }, false).index, 1);
  assert.equal(flowDrop([], { x: 0, y: 0 }, true).index, 0);
});
