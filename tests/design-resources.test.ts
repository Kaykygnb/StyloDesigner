import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '@stylo/core/store.js';
import { createNode, makeDoc } from '@stylo/core/model.js';
import { createRunner } from '@stylo/core/tools/runner.js';
import { createRunnerContext } from '@stylo/core/tools/runner/context.ts';
import { createDesignResourceTools, prepareDesignResourceUpdate } from '@stylo/core/tools/runner/design-resources.ts';
import { DESIGN_RESOURCE_TOOLS } from '@stylo/core/tools/design-resources-schema.ts';
import { responseBytes } from '@stylo/core/tools/runner/response-budget.ts';

function setup() {
  const doc: any = makeDoc();
  doc.styles = {
    colors: [{ id: 'cor', name: 'Principal', color: '#112233', opacity: 0.8, modes: { escuro: { color: '#EEEEEE', opacity: 1 } } }],
    texts: [{ id: 'texto', name: 'Título', fontFamily: 'Arial', fontSize: 24, fontWeight: 700, lineHeight: 1.2 }],
    effects: [{ id: 'efeito', name: 'Card', shadows: [{ x: 1, y: 2, blur: 3, spread: 0, color: '#123456', opacity: 0.5, inset: false }] }],
    gradients: [{ id: 'gradiente', name: 'Fundo', type: 'linear', angle: 90, stops: [{ color: '#112233', opacity: 1, pos: 0 }, { color: '#445566', opacity: 1, pos: 100 }] }],
    vars: [{ id: 'espaco', name: 'Espaço', value: 12 }], modes: [{ id: 'escuro', name: 'Escuro', scheme: 'dark' }],
  };
  const frame: any = createNode('frame', { name: 'Card', layout: { mode: 'column', gap: 12, padding: [12, 12, 12, 12] } });
  frame.fill = { type: 'solid', color: '#112233', opacity: 0.8, styleId: 'cor' };
  frame.effectStyleId = 'efeito'; frame.shadows = structuredClone(doc.styles.effects[0].shadows);
  frame.vars = { gap: 'espaco', padding: 'espaco' };
  const text: any = createNode('text', { text: 'Título', fontFamily: 'Arial', fontSize: 24, fontWeight: 700, lineHeight: 1.2 });
  text.textStyleId = 'texto';
  const gradient: any = createNode('rect');
  gradient.fill = { type: 'linear', gradientId: 'gradiente', angle: 90, stops: structuredClone(doc.styles.gradients[0].stops) };
  frame.children = [text, gradient]; doc.pages[0].children = [frame];
  const store = createStore({ initial: { doc } });
  const ctx = createRunnerContext({ store, commands: {} });
  return { store, ctx, tools: createDesignResourceTools(ctx), frame, text, gradient };
}

test('listagem pagina resources, filtra nome/tipo e respeita orçamento UTF-8', () => {
  const { tools, store } = setup();
  for (let i = 0; i < 70; i++) store.state.doc.styles.colors.push({ id: `c${i}`, name: `Cor ${'á'.repeat(70)} ${i}`, color: '#AABBCC', opacity: 1 });
  const first = tools.list_design_resources({ kind: 'color', limit: 100, maxBytes: 1024 });
  assert.ok(first.count > 0 && first.count < 71);
  assert.equal(first.total, 71); assert.equal(first.nextOffset, first.count); assert.equal(first.hasMore, true);
  assert.ok(responseBytes(first) <= 1024);
  const next = tools.list_design_resources({ kind: 'color', offset: first.nextOffset, limit: 1 });
  assert.notEqual(next.resources[0].id, first.resources[0].id);
  const selected = tools.list_design_resources({ kind: 'text', query: 'TÍT' });
  assert.equal(selected.total, 1); assert.equal(selected.resources[0].id, 'texto');
  assert.equal(selected.resources[0].references, 1);
  assert.equal('layers' in first, false);
});

test('conta referências de todas as páginas, breakpoints, estados e fotos de componentes', () => {
  const { store, frame, tools } = setup();
  frame.bps = { mobile: { fill: { type: 'solid', color: '#ABCDEF', styleId: 'cor' } } };
  frame.states = { hover: { fill: { type: 'solid', color: '#123456', styleId: 'cor' } } };
  frame.base = { '': { fill: { type: 'solid', color: '#112233', styleId: 'cor' } } };
  const other: any = createNode('rect'); other.fill.styleId = 'cor'; other.visible = false;
  store.state.doc.pages.push({ id: 'outra', name: 'Outra', children: [other] });
  const listed = tools.list_design_resources({ kind: 'color' });
  assert.equal(listed.resources[0].references, 5);
  assert.equal(tools.list_design_resources({ kind: 'variable' }).resources[0].references, 2);
  assert.equal(tools.list_design_resources({ kind: 'mode' }).resources[0].references, 1);
});

test('update valida campos do kind, ID, nome duplicado, vazio, cor e modo antes de modificar', () => {
  const { ctx, store } = setup();
  store.state.doc.styles.colors.push({ id: 'outra', name: 'Duplicada', color: '#FFFFFF', opacity: 1 });
  const before = JSON.stringify(store.state.doc);
  const bad = [
    { kind: 'color', id: 'ausente', changes: { color: '#123' } },
    { kind: 'color', id: 'cor', changes: { fontSize: 32 } },
    { kind: 'color', id: 'cor', changes: { name: ' duplicada ' } },
    { kind: 'color', id: 'cor', changes: {} },
    { kind: 'color', id: 'cor', changes: { color: 'red' } },
    { kind: 'color', id: 'cor', changes: { opacity: 2 } },
    { kind: 'color', id: 'cor', changes: { mode_id: 'ausente', color: '#000' } },
    { kind: 'color', id: 'cor', changes: { mode_id: 'escuro' } },
    { kind: 'variable', id: 'espaco', changes: { value: -1 } },
    { kind: 'effect', id: 'efeito', changes: { shadows: [{ color: '#000', lixo: true }] } },
    { kind: 'gradient', id: 'gradiente', changes: { stops: [{ color: '#000' }] } },
  ];
  for (const args of bad) assert.throws(() => prepareDesignResourceUpdate(ctx, args, 'update'));
  assert.equal(JSON.stringify(store.state.doc), before);
});

test('atualiza cores, texto, efeito, gradiente e variável mantendo IDs e sincronizando vínculos', () => {
  const { tools, store, frame, text, gradient } = setup();
  tools.update_design_resource({ kind: 'color', id: 'cor', changes: { color: '#abc', opacity: 0.6 } });
  assert.equal(frame.fill.color, '#AABBCC'); assert.equal(frame.fill.opacity, 0.6);
  tools.update_design_resource({ kind: 'text', id: 'texto', changes: { fontSize: 36, letterSpacing: 2 } });
  assert.equal(text.fontSize, 36); assert.equal(text.letterSpacing, 2);
  tools.update_design_resource({ kind: 'effect', id: 'efeito', changes: { shadows: [{ color: '#def', blur: 8 }] } });
  assert.equal(frame.shadows[0].color, '#DDEEFF'); assert.equal(frame.shadows[0].blur, 8);
  tools.update_design_resource({ kind: 'gradient', id: 'gradiente', changes: { type: 'radial', stops: [{ color: '#000' }, { color: '#fff' }] } });
  assert.equal(gradient.fill.type, 'radial'); assert.equal(gradient.fill.stops[1].pos, 100);
  tools.update_design_resource({ kind: 'variable', id: 'espaco', changes: { value: 20 } });
  assert.equal(frame.layout.gap, 20); assert.deepEqual(frame.layout.padding, [20, 20, 20, 20]);
  assert.deepEqual(store.state.doc.styles.colors.map((s: any) => s.id), ['cor']);
});

test('alterar modo ou valor de cor no modo não muda padrão; renomear não sobrescreve variantes', () => {
  const { tools, frame, store } = setup();
  frame.bps = { mobile: { fill: { type: 'solid', color: '#AABBCC', opacity: 0.3, styleId: 'cor' } } };
  tools.update_design_resource({ kind: 'color', id: 'cor', changes: { mode_id: 'escuro', opacity: 0.4 } });
  assert.equal(store.state.doc.styles.colors[0].modes.escuro.color, '#EEEEEE');
  assert.equal(store.state.doc.styles.colors[0].modes.escuro.opacity, 0.4);
  assert.equal(frame.fill.color, '#112233');
  tools.update_design_resource({ kind: 'color', id: 'cor', changes: { name: 'Nova cor' } });
  assert.equal(frame.bps.mobile.fill.color, '#AABBCC');
  tools.update_design_resource({ kind: 'mode', id: 'escuro', changes: { name: 'Noite', scheme: null } });
  assert.equal(store.state.doc.styles.modes[0].id, 'escuro'); assert.equal(store.state.doc.styles.modes[0].scheme, null);
});

test('delete recusa todos os tipos em uso sem alteração; modo padrão não existe como recurso', () => {
  const { tools, store } = setup(); const before = JSON.stringify(store.state.doc);
  for (const [kind, id] of [['color', 'cor'], ['text', 'texto'], ['effect', 'efeito'], ['gradient', 'gradiente'], ['variable', 'espaco'], ['mode', 'escuro']]) assert.throws(() => tools.delete_design_resource({ kind, id }), /detach:true/);
  assert.throws(() => tools.delete_design_resource({ kind: 'mode', id: 'default', detach: true }), /modo padrão/);
  assert.equal(JSON.stringify(store.state.doc), before);
});

test('detach preserva literais padrão, breakpoints, estados e fotos e remove todos os vínculos', () => {
  const { tools, frame, text, gradient, store } = setup();
  frame.bps = { mobile: { fill: { type: 'solid', color: '#AABBCC', opacity: 0.3, styleId: 'cor' }, vars: { gap: 'espaco' }, layout: { gap: 7 } } };
  frame.states = { hover: { fill: { type: 'solid', color: '#DDEEFF', opacity: 1, styleId: 'cor' }, effectStyleId: 'efeito', shadows: [{ blur: 99 }] } };
  frame.base = { '': { fill: { type: 'solid', color: '#112233', opacity: 0.8, styleId: 'cor' }, vars: { padding: 'espaco' }, layout: { padding: [12, 12, 12, 12] } } };
  for (const [kind, id] of [['color', 'cor'], ['text', 'texto'], ['effect', 'efeito'], ['gradient', 'gradiente'], ['variable', 'espaco']]) tools.delete_design_resource({ kind, id, detach: true });
  assert.deepEqual(frame.fill, { type: 'solid', color: '#112233', opacity: 0.8 });
  assert.equal(frame.bps.mobile.fill.color, '#AABBCC'); assert.equal(frame.bps.mobile.layout.gap, 7);
  assert.equal(frame.states.hover.fill.color, '#DDEEFF'); assert.equal(frame.states.hover.shadows[0].blur, 99);
  assert.equal(frame.base[''].fill.styleId, undefined); assert.equal(frame.base[''].vars, undefined);
  assert.equal(frame.vars, undefined); assert.equal(text.textStyleId, undefined); assert.equal(text.fontSize, 24);
  assert.equal(gradient.fill.gradientId, undefined); assert.equal(gradient.fill.stops[0].color, '#112233');
  store.commit(); assert.equal(frame.fill.styleId, undefined);
});

test('remove modo com detach eliminando só seus valores nos estilos de cor', () => {
  const { tools, store } = setup();
  tools.delete_design_resource({ kind: 'mode', id: 'escuro', detach: true });
  assert.equal(store.state.doc.styles.modes, undefined); assert.equal(store.state.doc.styles.colors[0].modes, undefined);
  assert.equal(store.state.doc.styles.colors[0].color, '#112233');
});

test('esquemas rejeitam campos top-level e shadows desconhecidos', () => {
  const update = DESIGN_RESOURCE_TOOLS.find(def => def.name === 'update_design_resource')!;
  assert.equal(update.input.safeParse({ kind: 'color', id: 'cor', changes: { color: '#123' }, extra: true }).success, false);
  assert.equal(update.input.safeParse({ kind: 'effect', id: 'efeito', changes: { shadows: [{ extra: 1 }] } }).success, false);
});

test('runner pré-valida antes da aprovação e cada atualização/remoção vira um único desfazer', async () => {
  const { store } = setup(); let approvals = 0;
  const runner = createRunner({ store, commands: {}, approve: async () => { approvals++; return true; } });
  const bad = await runner.run('update_design_resource', { kind: 'color', id: 'cor', changes: { fontSize: 20 } });
  assert.match(bad.error ?? '', /changes.*color/); assert.equal(approvals, 0);
  const updated = await runner.run('update_design_resource', { kind: 'variable', id: 'espaco', changes: { value: 28 } });
  assert.equal(updated.ok, true); assert.equal(approvals, 1);
  store.undo(); assert.equal(store.state.doc.styles.vars[0].value, 12); assert.equal(store.page().children[0].layout.gap, 12);
  const removed = await runner.run('delete_design_resource', { kind: 'color', id: 'cor', detach: true });
  assert.equal(removed.ok, true); assert.equal(store.state.doc.styles.colors.length, 0);
  store.undo(); assert.equal(store.state.doc.styles.colors[0].id, 'cor'); assert.equal(store.page().children[0].fill.styleId, 'cor');
});
