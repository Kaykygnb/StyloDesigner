// O agente (MCP e assistente) desenha vetores com a caneta: tipo "path" no build_layout e no create_layer, com pontos,
// alças de Bézier, contorno e preenchimento. Antes só dava para criar frame, rect, ellipse, text, line e icon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { makeDoc } from '../src/model.js';
import { createRunner } from '../src/agent/runner.js';
import { AGENT_TOOLS } from '../src/agent/schema.js';
import { generateCode } from '../src/css.js';

const novo = () => {
  const store = createStore({ initial: { doc: makeDoc() } });
  const runner = createRunner({ store, commands: {}, approve: async () => true });
  return { store, runner };
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
