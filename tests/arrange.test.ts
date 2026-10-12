// arrange_layers, paste_layers, paste_style e as propriedades novas de update_layer: o que o botão direito do painel precisa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '@stylo/core/store.js';
import { createNode, makeDoc } from '@stylo/core/model.js';
import { createCommands } from '@stylo/core/commands.js';
import { createRunner } from '@stylo/core/tools/runner.js';
import { createModelCanvas } from '../apps/server/src/workspace/model-canvas.js';
import { pastTense } from '../apps/server/src/presence.js';

function fixture() {
  const store = createStore({ initial: { doc: makeDoc() } });
  const a = createNode('frame', { name: 'A', x: 0, y: 0, w: 600, h: 400 });
  const kids = [10, 60, 110].map((x, i) => createNode('rect', { name: `R${i}`, x, y: 20, w: 40, h: 40 }));
  a.children.push(...kids);
  const b = createNode('frame', { name: 'B', x: 700, y: 0, w: 300, h: 300 });
  store.update((page) => page.children.push(a, b)); store.commit();
  const commands = createCommands(store, createModelCanvas(store));
  const runner = createRunner({ store, commands, approve: async () => true });
  return { store, runner, a, b, kids };
}
const order = (f: ReturnType<typeof fixture>) => f.store.get(f.a.id).children.map((n: any) => n.name).join(',');

test('arrange_layers: ordem z (frente, trás, um passo) e um desfazer', async () => {
  const f = fixture();
  assert.equal(order(f), 'R0,R1,R2');
  assert.equal((await f.runner.run('arrange_layers', { ids: [f.kids[0].id], action: 'front' })).ok, true);
  assert.equal(order(f), 'R1,R2,R0');
  await f.runner.run('arrange_layers', { ids: [f.kids[0].id], action: 'backward' });
  assert.equal(order(f), 'R1,R0,R2');
  await f.runner.run('arrange_layers', { ids: [f.kids[2].id], action: 'back' });
  assert.equal(order(f), 'R2,R1,R0');
  f.store.undo();
  assert.equal(order(f), 'R1,R0,R2', 'um desfazer por ação');
});

test('arrange_layers: espelhar liga e desliga; envolver em frame; máscara; instância', async () => {
  const f = fixture();
  await f.runner.run('arrange_layers', { ids: [f.kids[0].id], action: 'flip_h' });
  assert.equal(f.store.get(f.kids[0].id).flipX, true);
  await f.runner.run('arrange_layers', { ids: [f.kids[0].id], action: 'flip_h' });
  assert.equal(f.store.get(f.kids[0].id).flipX, false);

  const wrapped = await f.runner.run('arrange_layers', { ids: [f.kids[1].id, f.kids[2].id], action: 'wrap_in_frame' });
  assert.equal(wrapped.ok, true, wrapped.error);
  const frame = f.store.get(wrapped.selected[0]);
  assert.equal(frame.type, 'frame');
  assert.deepEqual(frame.children.map((n: any) => n.name), ['R1', 'R2']);
  assert.equal(frame.x, 60, 'o frame novo ocupa o lugar das camadas');

  const masked = await f.runner.run('arrange_layers', { ids: [f.kids[0].id, frame.id], action: 'toggle_mask' });
  assert.equal(masked.ok, true, masked.error);
  assert.equal(f.store.get(masked.selected[0]).type, 'group');

  const noInst = await f.runner.run('arrange_layers', { ids: [f.b.id], action: 'detach_instance' });
  assert.match(noInst.error, /instância/);
  const noMask = await f.runner.run('arrange_layers', { ids: [f.b.id], action: 'toggle_mask' });
  assert.match(noMask.error, /Máscara/);
});

test('arrange_layers: auto layout liga deduzindo a direção e desliga mantendo as posições', async () => {
  const f = fixture();
  const on = await f.runner.run('arrange_layers', { ids: [f.a.id], action: 'toggle_auto_layout' });
  assert.equal(on.ok, true, on.error);
  assert.equal(f.store.get(f.a.id).layout.mode, 'row', 'filhos lado a lado → linha');
  await f.runner.run('arrange_layers', { ids: [f.a.id], action: 'toggle_auto_layout' });
  assert.equal(f.store.get(f.a.id).layout.mode, 'none');
});

test('paste_layers: copia para outro frame ou ao lado do original; recusa pai que não é frame', async () => {
  const f = fixture();
  const into = await f.runner.run('paste_layers', { ids: [f.kids[0].id], parent_id: f.b.id });
  assert.equal(into.ok, true, into.error);
  const copy = f.store.get(into.created[0]);
  assert.notEqual(copy.id, f.kids[0].id);
  assert.equal(f.store.parentOf(copy.id).id, f.b.id);
  assert.ok(f.store.get(f.kids[0].id), 'o original continua onde estava');

  const beside = await f.runner.run('paste_layers', { ids: [f.kids[1].id] });
  assert.equal(beside.ok, true, beside.error);
  const c2 = f.store.get(beside.created[0]);
  assert.equal(f.store.parentOf(c2.id).id, f.a.id);
  assert.equal(c2.x, f.kids[1].x + 16);

  const bad = await f.runner.run('paste_layers', { ids: [f.kids[0].id], parent_id: f.kids[1].id });
  assert.match(bad.error, /frame/);
  const self = await f.runner.run('paste_layers', { ids: [f.a.id], parent_id: f.kids[1].id });
  assert.match(self.error, /frame|dentro dela mesma/);
});

test('paste_style: leva só a aparência e deixa tamanho e posição', async () => {
  const f = fixture();
  await f.runner.run('update_layer', { id: f.kids[0].id, props: { fill: '#FF0000', radius: 8, opacity: 0.5 } });
  const out = await f.runner.run('paste_style', { source_id: f.kids[0].id, ids: [f.kids[1].id, f.kids[2].id] });
  assert.equal(out.ok, true, out.error);
  for (const id of [f.kids[1].id, f.kids[2].id]) {
    const n = f.store.get(id);
    assert.equal(n.fill.color, '#FF0000');
    assert.deepEqual(n.radius, [8, 8, 8, 8]);
    assert.equal(n.opacity, 0.5);
    assert.equal(n.w, 40);
  }
});

test('update_layer: propriedades novas (espelhar, inclinar, constraints, filtros, atributos) validam e valem', async () => {
  const f = fixture();
  const id = f.kids[0].id;
  const ok = await f.runner.run('update_layer', { id, props: { flipX: true, skewX: 10, lockRatio: true, constraints: { h: 'right' }, fx: { brightness: 120 }, htmlId: 'logo', classes: 'a b', title: 'Oi' } });
  assert.equal(ok.ok, true, ok.error);
  const n = f.store.get(id);
  assert.equal(n.flipX, true); assert.equal(n.skewX, 10); assert.equal(n.lockRatio, true);
  assert.deepEqual(n.constraints, { h: 'right', v: 'top' });
  assert.deepEqual(n.fx, { brightness: 120 });
  assert.equal(n.htmlId, 'logo');
  assert.match((await f.runner.run('update_layer', { id, props: { flipX: 'sim' } })).error, /true ou false/);
  assert.match((await f.runner.run('update_layer', { id, props: { constraints: { h: 'meio' } } })).error, /constraints\.h/);
  assert.match((await f.runner.run('update_layer', { id, props: { fx: { sepia: 1 } } })).error, /fx:/);
  await f.runner.run('update_layer', { id, props: { fx: null } });
  assert.equal(f.store.get(id).fx, undefined);
});

test('atividade: o verbo da descrição vai para o passado', () => {
  assert.equal(pastTense('Alterar “Retângulo”: x, y'), 'alterou “Retângulo”: x, y');
  assert.equal(pastTense('Criar um texto na página'), 'criou um texto na página');
  assert.equal(pastTense('Apagar “A”'), 'apagou “A”');
  assert.equal(pastTense('Mover “A” para dentro de “B”'), 'moveu “A” para dentro de “B”');
  assert.equal(pastTense('Distribuir 3 camadas (h)'), 'distribuiu 3 camadas (h)');
  assert.equal(pastTense('Desfazer a última alteração (Ctrl+Z)'), 'desfez a última alteração');
  assert.equal(pastTense('conectou pelo MCP'), 'conectou pelo MCP');
  assert.equal(pastTense('não conseguiu: Alterar “A”'), 'não conseguiu: Alterar “A”');
});

test('move_layers: troca de pai, de ordem e de posição de uma vez, com um só desfazer; recusa o que não faz sentido', async () => {
  const f = fixture();
  const before = JSON.stringify(f.store.state.doc);
  const out = await f.runner.run('move_layers', { moves: [
    { id: f.kids[0].id, parent_id: f.b.id, x: 5, y: 6 },
    { id: f.kids[1].id, parent_id: 'root', x: 900, y: 40 },
    { id: f.kids[2].id, index: 0 },
  ] });
  assert.equal(out.ok, true, out.error);
  const r0 = f.store.get(f.kids[0].id);
  assert.equal(f.store.parentOf(r0.id).id, f.b.id);
  assert.deepEqual([r0.x, r0.y], [5, 6]);
  assert.equal(f.store.parentOf(f.kids[1].id), null, 'foi para a raiz da página');
  assert.equal(f.store.get(f.a.id).children[0].id, f.kids[2].id, 'índice 0 = fundo');
  f.store.undo();
  assert.equal(JSON.stringify(f.store.state.doc), before, 'um desfazer volta tudo');

  assert.match((await f.runner.run('move_layers', { moves: [{ id: f.a.id, parent_id: f.kids[0].id }] })).error, /frame|grupo|filhos|dentro dela/);
  assert.match((await f.runner.run('move_layers', { moves: [{ id: f.a.id, parent_id: f.a.id }] })).error, /dentro dela mesma/);
  assert.equal(JSON.stringify(f.store.state.doc), before, 'erro não deixa meia mudança');
});

test('create_layer: seção (só na raiz) e código HTML', async () => {
  const f = fixture();
  const sec = await f.runner.run('create_layer', { type: 'section', props: { name: 'Fluxo', w: 900, h: 700 } });
  assert.equal(sec.ok, true, sec.error);
  assert.equal(f.store.get(sec.created.id).type, 'section');
  assert.match((await f.runner.run('create_layer', { type: 'section', parent_id: f.a.id })).error, /raiz/);
  const html = await f.runner.run('create_layer', { type: 'html', parent_id: f.a.id, props: { x: 10, y: 10, html: '<p>oi</p>' } });
  assert.equal(html.ok, true, html.error);
  assert.equal(f.store.get(html.created.id).html, '<p>oi</p>');
  assert.match((await f.runner.run('update_layer', { id: f.kids[0].id, props: { html: '<p>x</p>' } })).error, /html só vale/);
});

test('set_guides: define a lista de guias da página, valida e um desfazer volta', async () => {
  const f = fixture();
  const out = await f.runner.run('set_guides', { guides: [{ axis: 'x', pos: 120 }, { axis: 'y', pos: 40.456 }] });
  assert.equal(out.ok, true, out.error);
  assert.deepEqual(f.store.page().guides, [{ axis: 'x', pos: 120 }, { axis: 'y', pos: 40.46 }]);
  f.store.undo();
  assert.deepEqual(f.store.page().guides ?? [], []);
  assert.match((await f.runner.run('set_guides', { guides: [{ axis: 'z', pos: 1 }] })).error, /axis|x|y/);
  assert.match((await f.runner.run('set_guides', { page_id: 'nao-existe', guides: [] })).error, /não existe/);
});
