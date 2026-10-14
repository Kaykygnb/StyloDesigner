// O agente (MCP e assistente) desenha vetores com a caneta: tipo "path" no build_layout e no create_layer, com pontos,
// alças de Bézier, contorno e preenchimento. Antes só dava para criar frame, rect, ellipse, text, line e icon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '@stylo/core/store.js';
import { makeDoc } from '@stylo/core/model.js';
import { createRunner } from '@stylo/core/tools/runner.js';
import { createCommands } from '@stylo/core/commands.js';
import { createModelCanvas } from '../apps/server/src/workspace/model-canvas.js';
import { AGENT_TOOLS } from '@stylo/core/tools/schema.js';
import { generateCode } from '@stylo/core/css.js';
import '../apps/server/src/dom-polyfill.ts';

const novo = () => {
  const store = createStore({ initial: { doc: makeDoc() } });
  const commands = createCommands(store, createModelCanvas(store));
  const runner = createRunner({ store, commands, approve: async () => true });
  return { store, runner, commands };
};
// um balão de fala: cantos retos no topo e curva suave na base (alças em coordenadas do viewBox)
const balao = {
  name: 'Balão', w: 48, h: 48, vw: 24, vh: 24, closed: true, fill: 'none',
  stroke: { color: '#ECE9E4', width: 1.75, cap: 'round', join: 'round' },
  points: [
    { x: 3, y: 4 }, { x: 21, y: 4 }, { x: 21, y: 16 },
    { x: 11, y: 16, hin: { x: 14, y: 16 }, hout: { x: 9, y: 16 } },
    { x: 6, y: 20 }, { x: 6, y: 16, hin: { x: 6, y: 18 }, hout: { x: 6, y: 16 } }, { x: 3, y: 16 },
  ],
};

test('build_layout cria um vetor com pontos, alças, fechamento e contorno', async () => {
  const { store, runner } = novo();
  const r = await runner.run('build_layout', { tree: { type: 'path', props: balao } });
  assert.ok(!r.error, r.error);
  const n = store.page().children[0];
  assert.equal(n.type, 'path');
  assert.equal(n.name, 'Balão');
  assert.equal(n.points.length, 7);
  assert.equal(n.points[0].hin, null, 'ponto de canto: sem alças');
  assert.deepEqual(n.points[3].hout, { x: 9, y: 16 });
  assert.equal(n.closed, true);
  assert.equal(n.vw, 24);
  assert.equal(n.vh, 24);
  assert.equal(n.w, 48);
  assert.equal(n.stroke.width, 1.75);
  assert.equal(n.stroke.cap, 'round');
  assert.equal(n.fill.type, 'none');
});

test('o vetor criado sai no HTML exportado como SVG com curvas (C)', async () => {
  const { store, runner } = novo();
  await runner.run('build_layout', { tree: { type: 'path', props: balao } });
  const html = generateCode([store.page().children[0]], null, {}, { root: true }).html;
  assert.match(html, /<svg/);
  assert.match(html, / C /, 'trecho com alças vira curva de Bézier');
});

test('vw e vh, quando faltam, vêm do tamanho dos pontos; w e h, do viewBox', async () => {
  const { store, runner } = novo();
  await runner.run('build_layout', { tree: { type: 'path', props: { points: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 30 }] } } });
  const n = store.page().children[0];
  assert.equal(n.vw, 40);
  assert.equal(n.vh, 30);
  assert.equal(n.w, 40);
  assert.equal(n.h, 30);
  assert.equal(n.closed, false);
});

test('vetor dentro de um frame com outros itens (ícone próprio numa moldura)', async () => {
  const { store, runner } = novo();
  const r = await runner.run('build_layout', { tree: { type: 'frame', props: { name: 'Moldura', w: 64, h: 64, layout: { mode: 'none' } }, children: [{ type: 'path', props: { ...balao, x: 8, y: 8 } }] } });
  assert.ok(!r.error, r.error);
  assert.equal(store.page().children[0].children[0].type, 'path');
});

test('create_layer também aceita path', async () => {
  const { store, runner } = novo();
  const r = await runner.run('create_layer', { type: 'path', props: balao });
  assert.ok(!r.error, r.error);
  assert.equal(store.page().children[0].type, 'path');
});

test('import_svg cria vetor editável e informa recursos ignorados', async () => {
  const { store, runner } = novo();
  const r = await runner.run('import_svg', {
    name: 'Marca',
    svg: '<svg viewBox="0 0 40 20"><defs><linearGradient id="g"><stop offset="0%" stop-color="#f00"/><stop offset="100%" stop-color="#00f"/></linearGradient></defs><path id="p" d="M0 0 C10 0 30 20 40 20 Z" fill="url(#g)"/></svg>',
  });
  assert.equal(r.ok, true, r.error);
  assert.equal(store.page().children[0].type, 'path');
  assert.equal(store.page().children[0].name, 'Marca');
  assert.equal(store.page().children[0].fill.type, 'linear');
  assert.deepEqual(r.ignored, []);
  const def = AGENT_TOOLS.find((t) => t.name === 'import_svg');
  assert.ok(def);
  assert.equal(def.inputSchema.properties.svg.maxLength, 2_000_000);
});

test('audit_svg valida perdas antes de inserir e não altera o documento', async () => {
  const { store, runner } = novo();
  const before = JSON.stringify(store.state.doc);
  const out = await runner.run('audit_svg', { svg: '<svg viewBox="0 0 40 20"><defs><filter id="x"><feGaussianBlur stdDeviation="2"/></filter></defs><path d="M0 0h40v20H0z" filter="url(#x)"/></svg>' });
  assert.ok(!out.error, JSON.stringify(out));
  assert.equal(out.valid, true);
  assert.equal(out.dimensions.width, 40);
  assert.ok(out.editableLayers >= 1);
  assert.ok(Array.isArray(out.ignored));
  assert.deepEqual(JSON.stringify(store.state.doc), before);
});

test('efeito de cantos arredondados é não destrutivo, exporta Bézier e tem undo', async () => {
  const { store, runner } = novo();
  await runner.run('create_layer', { type: 'path', props: { name: 'Quadrado vivo', w: 40, h: 40, vw: 40, vh: 40, points: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }], closed: true, fill: '#fff' } });
  const id = store.page().children[0].id;
  const before = JSON.stringify(store.get(id).points);
  const out = await runner.run('set_path_effect', { id, kind: 'round-corners', radius: 6 });
  assert.equal(out.ok, true, out.error);
  assert.equal(store.get(id).pathEffect.radius, 6);
  const inspected = await runner.run('inspect_vector', { id });
  assert.deepEqual(inspected.pathEffect, { kind: 'round-corners', radius: 6 });
  assert.equal(JSON.stringify(store.get(id).points), before);
  const html = generateCode([store.get(id)], null, {}, { root: true }).html;
  assert.match(html, / C /, 'o efeito deve gerar curvas sem substituir os nós');
  store.undo();
  assert.equal(store.get(id).pathEffect, undefined);
  assert.equal(JSON.stringify(store.get(id).points), before);
});

test('interpolação cria vetor entre duas fontes e preserva ambas com undo', async () => {
  const { store, runner } = novo();
  await runner.run('create_layer', { type: 'path', props: { name: 'A', x: 0, y: 0, w: 40, h: 40, vw: 40, vh: 40, points: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }], closed: true, fill: '#111111' } });
  await runner.run('create_layer', { type: 'path', props: { name: 'B', x: 40, y: 20, w: 80, h: 60, vw: 40, vh: 40, points: [{ x: 0, y: 0 }, { x: 20, y: 0, hout: { x: 30, y: 4 } }, { x: 40, y: 40 }, { x: 0, y: 40 }], closed: true, fill: '#eeeeee' } });
  const [from, to] = store.page().children;
  const before = JSON.stringify([from, to]);
  const out = await runner.run('interpolate_vectors', { from_id: from.id, to_id: to.id, t: 0.5, name: 'Meio' });
  assert.equal(out.ok, true, out.error);
  const mid = store.get(out.created.id);
  assert.equal(mid.name, 'Meio');
  assert.equal(mid.x, 20);
  assert.equal(mid.points[1].x, 30);
  assert.deepEqual(mid.points[1].hout, { x: 35, y: 2 });
  assert.equal(JSON.stringify([store.get(from.id), store.get(to.id)]), before);
  store.undo();
  assert.equal(store.get(mid.id), null);
});

test('pontos inválidos viram erro claro e nada é criado', async () => {
  const { store, runner } = novo();
  const casos = [
    [{ points: [{ x: 0, y: 0 }] }, /pelo menos 2 pontos/],
    [{ points: 'texto' }, /points/],
    [{ points: [{ x: 0, y: 0 }, { x: 'a', y: 1 }] }, /números/],
    [{ points: [{ x: 0, y: 0 }, { x: Infinity, y: 1 }] }, /números/],
    [{ points: [{ x: 0, y: 0 }, { x: 5, y: 5, hin: 3 }] }, /alça/],
    [{ points: [{ x: 0, y: 0 }, { x: 5, y: 5, hout: { x: 'z', y: 1 } }] }, /alça/],
    [{ points: Array.from({ length: 501 }, (_, i) => ({ x: i, y: i })) }, /máximo/],
    [{ points: [{ x: 0, y: 0 }, { x: 1e9, y: 1 }] }, /números/],
    [{ points: [{ x: 0, y: 0 }, { x: 5, y: 5 }], vw: -3 }, /vw/],
  ];
  for (const [props, esperado] of casos) {
    const r = await runner.run('build_layout', { tree: { type: 'path', props } });
    assert.match(r.error ?? '', esperado, JSON.stringify(props).slice(0, 80));
  }
  assert.equal(store.page().children.length, 0, 'nada foi criado pela metade');
});

test('MCP inspeciona e edita um nó sem destruir o caminho, com undo', async () => {
  const { store, runner } = novo();
  await runner.run('create_layer', { type: 'path', props: balao });
  const id = store.page().children[0].id;
  const inspected = await runner.run('inspect_vector', { id });
  assert.equal(inspected.contours[0].points[3].hout.x, 9);
  assert.equal(inspected.contours[0].points[3].index, 3);
  const edited = await runner.run('edit_vector_node', { id, node_index: 3, point: { x: 12 }, hout: { x: 10, y: 16 }, mode: 'smooth' });
  assert.equal(edited.ok, true, edited.error);
  assert.equal(store.get(id).points[3].x, 12);
  assert.deepEqual(store.get(id).points[3].hout, { x: 10, y: 16 });
  assert.equal(store.get(id).points[0].x, 3, 'os outros nós continuam intactos');
  store.undo();
  assert.equal(store.get(id).points[3].x, 11);
  assert.deepEqual(store.get(id).points[3].hout, { x: 9, y: 16 });
});

test('auditoria vetorial encontra geometria inválida sem alterar o documento', async () => {
  const { store, runner } = novo();
  await runner.run('create_layer', { type: 'path', props: { name: 'Problema', points: [{ x: 0, y: 0 }, { x: 0, y: 0 }], closed: false, fill: '#ff0000' } });
  const id = store.page().children[0].id;
  store.update(() => { const n = store.get(id); n.vw = 0; n.blur = 30; n.pathEffect = { kind: 'round-corners', radius: 0 }; n.points[0].hout = { x: NaN, y: 1 }; });
  const before = JSON.stringify(store.get(id));
  const report = await runner.run('audit_vector', { id });
  assert.equal(report.error, undefined);
  assert.ok(report.errors >= 1);
  assert.ok(report.issues.some((issue) => issue.code === 'invalid_viewbox'));
  assert.ok(report.issues.some((issue) => issue.code === 'invalid_handle'));
  assert.ok(report.issues.some((issue) => issue.code === 'heavy_filter'));
  assert.ok(report.issues.some((issue) => issue.code === 'invalid_path_effect'));
  assert.equal(JSON.stringify(store.get(id)), before, 'auditoria é somente leitura');
});

test('MCP altera parâmetros de forma sem perder a origem paramétrica e com undo', async () => {
  const { store, runner } = novo();
  const r = await runner.run('create_layer', { type: 'path', props: { name: 'Estrela', w: 100, h: 100, vw: 100, vh: 100, points: Array.from({ length: 10 }, (_, i) => ({ x: i * 10, y: i * 10 })), closed: true, shape: { kind: 'star', sides: 5, innerRatio: 0.45 } } });
  assert.equal(r.ok, true, r.error);
  const id = store.page().children[0].id;
  const changed = await runner.run('edit_vector_shape', { id, sides: 7, inner_ratio: 0.3 });
  assert.equal(changed.ok, true, changed.error);
  assert.equal(store.get(id).shape.sides, 7);
  assert.equal(store.get(id).shape.innerRatio, 0.3);
  assert.equal(store.get(id).points.length, 14);
  store.undo();
  assert.equal(store.get(id).shape.sides, 5);
  assert.equal(store.get(id).points.length, 10);
});

test('edição vetorial rejeita índice inválido sem mutar o documento', async () => {
  const { store, runner } = novo();
  await runner.run('create_layer', { type: 'path', props: balao });
  const id = store.page().children[0].id;
  const before = JSON.stringify(store.get(id).points);
  const r = await runner.run('edit_vector_node', { id, node_index: 999, point: { x: 1 } });
  assert.match(r.error, /não existe/);
  assert.equal(JSON.stringify(store.get(id).points), before);
});

test('MCP inverte a direção e preserva as curvas, com undo', async () => {
  const { store, runner } = novo();
  await runner.run('create_layer', { type: 'path', props: { points: [{ x: 0, y: 0, hout: { x: 10, y: 0 } }, { x: 20, y: 0, hin: { x: 10, y: 0 }, hout: { x: 30, y: 10 } }, { x: 40, y: 20, hin: { x: 30, y: 10 } }], closed: false, fill: 'none' } });
  const id = store.page().children[0].id;
  const out = await runner.run('reverse_vector', { id });
  assert.equal(out.ok, true, out.error);
  assert.deepEqual(store.get(id).points.map((p) => [p.x, p.y]), [[40, 20], [20, 0], [0, 0]]);
  assert.deepEqual(store.get(id).points[0].hin, { x: 30, y: 10 });
  assert.deepEqual(store.get(id).points[2].hout, { x: 10, y: 0 });
  store.undo();
  assert.equal(store.get(id).points[0].x, 0);
});

test('MCP divide contorno fechado em dois caminhos abertos sem perder o fechamento', async () => {
  const { store, runner } = novo();
  await runner.run('create_layer', { type: 'path', props: { points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }], closed: true, fill: 'none' } });
  const id = store.page().children[0].id;
  const out = await runner.run('split_vector_contour', { id, node_index: 2 });
  assert.equal(out.ok, true, out.error);
  const node = store.get(id);
  assert.equal(node.closed, false);
  assert.equal(node.contours.length, 1);
  assert.deepEqual(node.points.map((p) => [p.x, p.y]), [[0, 0], [20, 0], [20, 20]]);
  assert.deepEqual(node.contours[0].points.map((p) => [p.x, p.y]), [[20, 20], [0, 20], [0, 0]]);
  store.undo();
  assert.equal(store.get(id).closed, true);
  assert.equal(store.get(id).contours, undefined);
});

test('MCP une contornos preservando nós, alças e undo', async () => {
  const { store, runner } = novo();
  await runner.run('create_layer', { type: 'path', props: {
    points: [{ x: 0, y: 0, hout: { x: 8, y: 0 } }, { x: 20, y: 0, hin: { x: 12, y: 0 }, hout: { x: 28, y: 8 } }, { x: 40, y: 20, hin: { x: 32, y: 12 } }, { x: 0, y: 30, hout: { x: 8, y: 30 } }],
    closed: true,
    fill: 'none',
  } });
  const id = store.page().children[0].id;
  const split = await runner.run('split_vector_contour', { id, node_index: 2 });
  assert.equal(split.ok, true, split.error);
  const out = await runner.run('join_vector_contours', { id });
  assert.equal(out.ok, true, out.error);
  assert.equal(out.joined, 2);
  assert.equal(store.get(id).closed, false);
  assert.equal(store.get(id).contours, undefined);
  assert.equal(store.get(id).points.length, 5);
  assert.deepEqual(store.get(id).points[0].hout, { x: 8, y: 0 });
  assert.ok(store.get(id).points.some((point) => point.hout?.x === 28 && point.hout?.y === 8));
  store.undo();
  assert.equal(store.get(id).contours.length, 1);
  assert.ok(store.get(id).contours[0].points.some((point) => point.hout?.x === 8 && point.hout?.y === 0));
});

test('MCP simplifica contorno reto e curvas abertas/fechadas com undo', async () => {
  const { store, runner } = novo();
  await runner.run('create_layer', { type: 'path', props: { points: [{ x: 0, y: 0 }, { x: 10, y: 0.1 }, { x: 20, y: -0.1 }, { x: 30, y: 0 }, { x: 40, y: 0 }], closed: false, fill: 'none' } });
  const id = store.page().children[0].id;
  const out = await runner.run('simplify_vector', { id, tolerance: 1 });
  assert.equal(out.ok, true, out.error);
  assert.ok(out.removed >= 1);
  assert.equal(store.get(id).points.length, 2);
  store.undo();
  assert.equal(store.get(id).points.length, 5);

  await runner.run('create_layer', { type: 'path', props: { points: [{ x: 0, y: 0, hout: { x: 8, y: 0 } }, { x: 20, y: 10, hin: { x: 12, y: 4 } }, { x: 40, y: 0, hin: { x: 30, y: 4 } }], closed: false, fill: 'none' } });
  const curvedId = store.page().children[1].id;
  const before = JSON.stringify(store.get(curvedId).points);
  const simplifiedCurve = await runner.run('simplify_vector', { id: curvedId, tolerance: 100 });
  assert.equal(simplifiedCurve.ok, true, simplifiedCurve.error);
  assert.ok(simplifiedCurve.removed > 0, 'a curva aberta deve poder perder nós redundantes');
  assert.ok(store.get(curvedId).points.every((p) => p.hin || p.hout || p.x === 0 || p.x === 40), 'o resultado continua representado por nós editáveis');
  store.undo();
  assert.equal(JSON.stringify(store.get(curvedId).points), before);

  await runner.run('create_layer', { type: 'path', props: { points: [{ x: 0, y: 0, hout: { x: 8, y: 0 }, hin: { x: 0, y: -8 } }, { x: 20, y: 10, hin: { x: 12, y: 4 }, hout: { x: 28, y: 4 } }, { x: 40, y: 0, hin: { x: 30, y: 4 }, hout: { x: 30, y: -4 } }, { x: 20, y: -10, hin: { x: 28, y: -4 }, hout: { x: 12, y: -4 } }], closed: true, fill: 'none' } });
  const closedId = store.page().children[2].id;
  const closedBefore = JSON.stringify(store.get(closedId).points);
  const closed = await runner.run('simplify_vector', { id: closedId, tolerance: 2 });
  assert.equal(closed.ok, true, closed.error);
  assert.ok(closed.removed > 0, 'a curva fechada deve poder simplificar nós redundantes');
  assert.equal(store.get(closedId).closed, true);
  assert.ok(store.get(closedId).points[0].hin || store.get(closedId).points.at(-1).hout, 'a costura continua com alça editável');
  store.undo();
  assert.equal(JSON.stringify(store.get(closedId).points), closedBefore);
});

test('MCP converte stroke aberto em forma preenchida editável e recusa casos ambíguos', async () => {
  const { store, runner } = novo();
  await runner.run('create_layer', { type: 'path', props: { points: [{ x: 0, y: 10 }, { x: 30, y: 10, hout: { x: 42, y: 10 } }, { x: 60, y: 30 }], closed: false, fill: 'none', stroke: { color: '#ff0000', width: 6, cap: 'round', position: 'center', style: 'solid' } } });
  const id = store.page().children[0].id;
  const out = await runner.run('stroke_to_path', { id, tolerance: 0.5 });
  assert.equal(out.ok, true, out.error);
  const node = store.get(id);
  assert.equal(node.closed, true);
  assert.equal(node.stroke, null);
  assert.equal(node.fill.type, 'solid');
  assert.equal(node.fill.color, '#FF0000');
  assert.ok(node.points.length >= 6);
  store.undo();
  assert.equal(store.get(id).stroke.width, 6);

  await runner.run('create_layer', { type: 'path', props: { points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }], closed: true, stroke: { color: '#000', width: 2, style: 'solid', position: 'center' } } });
  const closedId = store.page().children[1].id;
  const closed = await runner.run('stroke_to_path', { id: closedId });
  assert.equal(closed.ok, true, closed.error);
  assert.equal(store.get(closedId).contours.length, 1);
  assert.equal(store.get(closedId).fillRule, 'evenodd');

  await runner.run('create_layer', { type: 'path', props: { points: [{ x: 0, y: 0 }, { x: 20, y: 0 }], closed: false, stroke: { color: '#000', width: 2, style: 'dashed', position: 'center' } } });
  const dashedId = store.page().children[2].id;
  const dashed = await runner.run('stroke_to_path', { id: dashedId });
  assert.equal(dashed.ok, true, dashed.error);
  assert.equal(dashed.dashed, true);
  assert.ok(store.get(dashedId).contours.length >= 1);

  await runner.run('create_layer', { type: 'path', props: { points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }], closed: true, stroke: { color: '#000', width: 2, style: 'dashed', position: 'center' } } });
  const closedDashedId = store.page().children[3].id;
  const rejected = await runner.run('stroke_to_path', { id: closedDashedId });
  assert.match(rejected.error, /caminho fechado/);
});

test('MCP desloca contorno fechado para fora/dentro com undo e recusa caminho aberto', async () => {
  const { store, runner } = novo();
  await runner.run('create_layer', { type: 'path', props: { points: [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 40 }, { x: 10, y: 40 }], closed: true, fill: '#f00' } });
  const id = store.page().children[0].id;
  const before = store.get(id).points.map((p) => [p.x, p.y]);
  const out = await runner.run('offset_path', { id, distance: 5 });
  assert.equal(out.ok, true, out.error);
  assert.ok(store.get(id).points.some((p) => p.x < 10 || p.y < 10));
  store.undo();
  assert.deepEqual(store.get(id).points.map((p) => [p.x, p.y]), before);

  await runner.run('create_layer', { type: 'path', props: { points: [{ x: 0, y: 0 }, { x: 20, y: 0 }], closed: false, fill: 'none' } });
  const openId = store.page().children[1].id;
  const rejected = await runner.run('offset_path', { id: openId, distance: 2 });
  assert.match(rejected.error, /fechados/);
});

test('MCP Shape Builder cria somente a região indicada e preserva as fontes', async () => {
  const { store, runner } = novo();
  const a = await runner.run('create_layer', { type: 'rect', props: { name: 'A', x: 0, y: 0, w: 60, h: 60, fill: '#f00' } });
  const b = await runner.run('create_layer', { type: 'rect', props: { name: 'B', x: 30, y: 30, w: 60, h: 60, fill: '#00f' } });
  const result = await runner.run('shape_builder', { ids: [a.created.id, b.created.id], points: [{ x: 45, y: 45 }], mode: 'add' });
  assert.equal(result.ok, true, result.error);
  const built = store.get(result.created.id);
  assert.equal(built.type, 'path');
  assert.ok(built.points.length >= 4);
  assert.equal(store.get(a.created.id).type, 'rect');
  assert.equal(store.get(b.created.id).type, 'rect');
  assert.equal(built.shapeBuilder.mode, 'add');
  store.undo();
  assert.equal(store.get(result.created.id), null);
});

test('MCP cria rede vetorial com junções, ramificação e segmento Bézier editável', async () => {
  const { store, runner } = novo();
  const result = await runner.run('create_vector_network', {
    name: 'Rede',
    nodes: [{ id: 'a', x: 10, y: 10 }, { id: 'b', x: 50, y: 30 }, { id: 'c', x: 90, y: 10 }],
    segments: [
      { id: 'ab', from: 'a', to: 'b', kind: 'cubic', hout_from: { x: 25, y: 0 }, hin_to: { x: 35, y: 60 } },
      { id: 'bc', from: 'b', to: 'c' },
    ],
    stroke: { color: '#00aa88', width: 3 },
  });
  assert.equal(result.ok, true, result.error);
  const node = store.get(result.created.id);
  assert.equal(node.type, 'path');
  assert.equal(node.vectorNetwork.nodes.length, 3);
  assert.equal(node.vectorNetwork.segments[0].kind, 'cubic');
  assert.equal(node.contours.length, 1);
  assert.ok(node.points[0].hout && node.points[1].hin);
  assert.equal(node.stroke.color, '#00aa88');
  store.undo();
  assert.equal(store.get(result.created.id), null);
});

test('inspect_vector expõe a topologia da rede vetorial sem depender de screenshot', async () => {
  const { store, runner } = novo();
  const result = await runner.run('create_vector_network', {
    name: 'Rede inspecionável',
    nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 40, y: 0 }, { id: 'c', x: 40, y: 30 }],
    segments: [
      { id: 'ab', from: 'a', to: 'b', kind: 'line' },
      { id: 'bc', from: 'b', to: 'c', kind: 'cubic', hout_from: { x: 45, y: 5 }, hin_to: { x: 45, y: 25 } },
    ],
  });
  const inspected = await runner.run('inspect_vector', { id: result.created.id });
  assert.deepEqual(inspected.vectorNetwork.nodes, [
    { id: 'a', x: 0, y: 0 }, { id: 'b', x: 40, y: 0 }, { id: 'c', x: 40, y: 30 },
  ]);
  assert.equal(inspected.vectorNetwork.segmentCount, 2);
  assert.deepEqual(inspected.vectorNetwork.segments[1].hinTo, { x: 45, y: 25 });
  assert.equal(store.get(result.created.id).vectorNetwork.segments.length, 2);
});

test('path não tem filhos', async () => {
  const { runner } = novo();
  const r = await runner.run('build_layout', { tree: { type: 'path', props: balao, children: [{ type: 'rect', props: {} }] } });
  assert.match(r.error ?? '', /filhos/);
});

test('as ferramentas anunciam o tipo path (esquema e descrição)', () => {
  const create = AGENT_TOOLS.find((t) => t.name === 'create_layer');
  assert.ok(create.inputSchema.properties.type.enum.includes('path'));
  const build = AGENT_TOOLS.find((t) => t.name === 'build_layout');
  assert.match(build.description, /path/);
  assert.match(build.description, /hin|hout|alça/i);
});
