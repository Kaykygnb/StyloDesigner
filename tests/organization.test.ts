import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '@stylo/core/store.js';
import { createNode, makeDoc } from '@stylo/core/model.js';
import { createCommands } from '@stylo/core/commands.js';
import { createRunner } from '@stylo/core/tools/runner.js';
import { createModelCanvas } from '../apps/server/src/workspace/model-canvas.js';

function fixture() {
  const store = createStore({ initial: { doc: makeDoc() } });
  const frame = createNode('frame'); frame.x = 100; frame.y = 50; frame.w = 400; frame.h = 300;
  const nodes = [0, 30, 100].map((x) => { const node = createNode('rect'); node.x = x; node.y = x; node.w = 20; node.h = 20; return node; });
  frame.children.push(...nodes);
  const other = createNode('rect');
  store.update((page) => page.children.push(frame, other)); store.commit();
  const canvas = createModelCanvas(store);
  const commands = createCommands(store, canvas);
  let approvals = 0;
  const runner = createRunner({ store, commands, approve: async () => { approvals++; return true; } });
  store.setSelection([other.id]);
  return { store, canvas, commands, runner, frame, nodes, other, approvals: () => approvals };
}
const doc = (f: ReturnType<typeof fixture>) => JSON.stringify(f.store.state.doc);
const ids = (f: ReturnType<typeof fixture>) => f.nodes.map((node) => node.id);
async function invalid(f: ReturnType<typeof fixture>, tool: string, args: any, regex: RegExp) {
  const before = doc(f), selection = [...f.store.state.ui.selection], calls = f.approvals();
  const result = await f.runner.run(tool, args);
  assert.match(result.error ?? '', regex);
  assert.equal(doc(f), before); assert.deepEqual(f.store.state.ui.selection, selection);
  assert.equal(f.approvals(), calls, 'inválido não deve pedir aprovação');
}

test('alinha camadas reais, conserva seleção e cria apenas um passo no histórico', async () => {
  const f = fixture(), before = doc(f);
  const result = await f.runner.run('align_layers', { ids: ids(f), alignment: 'left' });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(f.nodes.map((node) => f.store.get(node.id).x), [0, 0, 0]);
  assert.deepEqual(f.store.state.ui.selection, [f.other.id]);
  const after = doc(f); f.store.undo(); assert.equal(doc(f), before);
  f.store.redo(); assert.equal(doc(f), after);
  f.store.undo(); f.store.undo(); assert.equal(f.store.page().children.length, 0);
});

test('alinha uma camada dentro do pai e recusa camada sozinha na raiz', async () => {
  const f = fixture();
  const out = await f.runner.run('align_layers', { ids: [f.nodes[0].id], alignment: 'right' });
  assert.equal(out.ok, true, out.error); assert.equal(f.store.get(f.nodes[0].id).x, 380);
  await invalid(f, 'align_layers', { ids: [f.other.id], alignment: 'left' }, /pai|raiz/);
});

test('distribui com vãos iguais sem mover extremos ou seleção anterior', async () => {
  const f = fixture();
  const result = await f.runner.run('distribute_layers', { ids: ids(f), axis: 'h' });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(f.nodes.map((node) => f.store.get(node.id).x), [0, 50, 100]);
  assert.deepEqual(f.store.state.ui.selection, [f.other.id]);
});

test('agrupa e desagrupa preservando coordenadas absolutas, ordem e histórico único', async () => {
  const f = fixture(), before = doc(f);
  const origins = f.nodes.map((node) => f.canvas.originOf(node.id));
  const grouped = await f.runner.run('group_layers', { ids: [f.nodes[2].id, f.nodes[0].id, f.nodes[1].id], name: 'Meu grupo' });
  assert.equal(grouped.ok, true, grouped.error);
  const group = f.store.get(grouped.group.id);
  assert.equal(group.name, 'Meu grupo'); assert.deepEqual(group.children.map((node) => node.id), ids(f));
  assert.deepEqual(f.store.state.ui.selection, [group.id]);
  assert.deepEqual(f.nodes.map((node) => f.canvas.originOf(node.id)), origins);
  const after = doc(f); f.store.undo(); assert.equal(doc(f), before); f.store.redo(); assert.equal(doc(f), after);
  const ungrouped = await f.runner.run('ungroup_layers', { ids: [group.id] });
  assert.equal(ungrouped.ok, true, ungrouped.error);
  assert.deepEqual(f.store.get(f.frame.id).children.map((node) => node.id), ids(f));
  assert.deepEqual(f.nodes.map((node) => f.canvas.originOf(node.id)), origins);
  assert.deepEqual(f.store.state.ui.selection, ids(f));
  f.store.undo(); assert.ok(f.store.get(group.id));
  f.store.undo(); assert.equal(doc(f), before);
});

test('desagrupar frame é recusado para preservar fundo e layout', async () => {
  const f = fixture();
  f.store.update(() => { f.frame.layout.mode = 'row'; f.frame.layout.padding = [5, 8, 5, 8]; f.frame.layout.gap = 10; }); f.store.commit();
  await invalid(f, 'ungroup_layers', { ids: [f.frame.id] }, /grupos ou seções/);
});

test('recusa duplicados, pais distintos, seleção aninhada, IDs ausentes e entradas fora do contrato', async () => {
  const f = fixture();
  await invalid(f, 'align_layers', { ids: [f.nodes[0].id, f.nodes[0].id], alignment: 'left' }, /única|duplicad/);
  await invalid(f, 'group_layers', { ids: [f.nodes[0].id, f.other.id] }, /mesmo pai|irmãs/);
  await invalid(f, 'group_layers', { ids: [f.frame.id, f.nodes[0].id] }, /pai e filho/);
  await invalid(f, 'group_layers', { ids: [f.nodes[0].id, 'ausente'] }, /não exist|não encontr/);
  await invalid(f, 'distribute_layers', { ids: ids(f).slice(0, 2), axis: 'h' }, /ids|3/);
  await invalid(f, 'group_layers', { ids: ids(f), name: '   ' }, /name|caractere|pequen/);
  await invalid(f, 'align_layers', { ids: ids(f), alignment: 'left', extra: true }, /extra|desconhecid|não permit/);
  await invalid(f, 'align_layers', { ids: Array.from({ length: 101 }, (_, index) => `id-${index}`), alignment: 'left' }, /100/);
});

test('recusa fluxo e ancestrais girados em vez de ignorar camadas silenciosamente', async () => {
  const f = fixture();
  f.store.update(() => { f.frame.layout.mode = 'row'; }); f.store.commit();
  await invalid(f, 'align_layers', { ids: ids(f), alignment: 'left' }, /fluxo.*layout/);
  await invalid(f, 'distribute_layers', { ids: ids(f), axis: 'h' }, /fluxo.*layout/);
  await invalid(f, 'group_layers', { ids: ids(f) }, /fluxo.*layout/);
  f.store.update(() => { f.frame.layout.mode = 'none'; f.frame.rotation = 20; }); f.store.commit();
  await invalid(f, 'group_layers', { ids: ids(f) }, /girad/);
});

test('desagrupar recusa tipos incompatíveis e componentes sem alteração parcial', async () => {
  const f = fixture();
  await invalid(f, 'ungroup_layers', { ids: [f.frame.id, f.other.id] }, /grupos|frames/);
  f.store.update(() => { f.frame.component = true; }); f.store.commit();
  await invalid(f, 'ungroup_layers', { ids: [f.frame.id] }, /componentes/);
});

test('reordena camada por índice exato, aceita fluxo e conserva seleção', async () => {
  const f = fixture(), before = doc(f);
  const result = await f.runner.run('reorder_layer', { id: f.nodes[0].id, index: 2 });
  assert.equal(result.ok, true, result.error); assert.equal(result.changed, true);
  assert.deepEqual(f.store.get(f.frame.id).children.map((node) => node.id), [f.nodes[1].id, f.nodes[2].id, f.nodes[0].id]);
  assert.deepEqual(f.store.state.ui.selection, [f.other.id]);
  const after = doc(f); f.store.undo(); assert.equal(doc(f), before); f.store.redo(); assert.equal(doc(f), after);
  const unchanged = await f.runner.run('reorder_layer', { id: f.nodes[0].id, index: 2 });
  assert.equal(unchanged.ok, true); assert.equal(unchanged.changed, false);
  f.store.undo(); assert.equal(doc(f), before, 'não-op não cria histórico');
  await invalid(f, 'reorder_layer', { id: f.nodes[0].id, index: 3 }, /index/);
  await invalid(f, 'reorder_layer', { id: f.nodes[0].id, index: 0.5 }, /index|inteiro/);
});

test('renomeia e reordena páginas mantendo página aberta e seleção', async () => {
  const f = fixture();
  const first = f.store.page(); const second = { ...makeDoc().pages[0], id: 'page-second', name: 'Segunda', children: [] };
  f.store.update(() => f.store.state.doc.pages.push(second), { structural: true }); f.store.commit();
  const before = doc(f);
  const renamed = await f.runner.run('rename_page', { id: second.id, name: ' Apresentação ' });
  assert.equal(renamed.ok, true, renamed.error); assert.equal(second.name, 'Apresentação');
  const result = await f.runner.run('reorder_page', { id: second.id, index: 0 });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(f.store.state.doc.pages.map((page) => page.id), [second.id, first.id]);
  assert.equal(f.store.state.ui.pageId, first.id); assert.deepEqual(f.store.state.ui.selection, [f.other.id]);
  f.store.undo(); assert.equal(f.store.state.doc.pages[0].id, first.id);
  f.store.undo(); assert.equal(doc(f), before);
  await invalid(f, 'rename_page', { id: first.id, name: 'a'.repeat(61) }, /name|60/);
  await invalid(f, 'rename_page', { id: first.id, name: '   ' }, /name|caractere|pequen/);
  await invalid(f, 'reorder_page', { id: 'ausente', index: 0 }, /Página.*não existe/);
  await invalid(f, 'reorder_page', { id: first.id, index: 2 }, /index/);
});

test('revalida após aprovação e conserva edição concorrente', async () => {
  const f = fixture(); let concurrent = '';
  const runner = createRunner({ store: f.store, commands: f.commands, approve: async () => {
    f.store.update(() => { f.frame.layout.mode = 'row'; f.other.name = 'Edição humana'; }); f.store.commit();
    concurrent = doc(f); return true;
  } });
  const result = await runner.run('align_layers', { ids: ids(f), alignment: 'left' });
  assert.match(result.error ?? '', /fluxo.*layout/); assert.equal(doc(f), concurrent);
  assert.deepEqual(f.store.state.ui.selection, [f.other.id]);
});

test('recusa páginas diferentes e página inativa antes da aprovação', async () => {
  const f = fixture();
  const foreign = createNode('rect');
  const second = { ...makeDoc().pages[0], id: 'page-second', name: 'Segunda', children: [foreign] };
  f.store.update(() => f.store.state.doc.pages.push(second), { structural: true }); f.store.commit();
  await invalid(f, 'group_layers', { ids: [f.nodes[0].id, foreign.id] }, /mesma página/);
  await invalid(f, 'align_layers', { ids: [foreign.id], alignment: 'left' }, /Abra a página/);
});

test('agrupar itens absolutos em pai flex é recusado pois novo grupo alteraria fluxo', async () => {
  const f = fixture();
  f.store.update(() => { f.frame.layout.mode = 'row'; f.nodes.forEach((node) => { node.absolute = true; }); }); f.store.commit();
  await invalid(f, 'group_layers', { ids: ids(f) }, /fluxo.*layout|layout.*fluxo/);
});

test('não agrupa telas raiz nem cria grupos dentro de seção', async () => {
 const f=fixture();await invalid(f,'group_layers',{ids:[f.frame.id,f.other.id]},/telas raiz/);
 const section=createNode('section'),a=createNode('frame'),b=createNode('frame');section.children.push(a,b);
 f.store.update(page=>page.children.push(section));f.store.commit();
 await invalid(f,'group_layers',{ids:[a.id,b.id]},/seções/);
});
test('organização de muitas camadas retorna apenas IDs limitados, sem texto/notas', async () => {
 const f=fixture();const nodes=Array.from({length:50},()=>createNode('rect',{name:'nome'.repeat(1000)}));
 f.store.update(()=>f.frame.children.push(...nodes));f.store.commit();
 const out=await f.runner.run('align_layers',{ids:nodes.map(node=>node.id),alignment:'left'});
 assert.equal(out.ok,true,out.error);assert.equal(out.count,50);assert.equal(out.aligned.length,20);assert.equal(out.truncated,true);
 assert.deepEqual(Object.keys(out.aligned[0]),['id']);assert.ok(Buffer.byteLength(JSON.stringify(out),'utf8')<2048);
});

test('agrupamento recusa irmãs intercaladas, posição responsiva e perda de efeitos', async()=>{
 const f=fixture();await invalid(f,'group_layers',{ids:[f.nodes[0].id,f.nodes[2].id]},/consecutivas/);
 f.store.update(()=>{f.nodes[0].bps={mobile:{x:50}};});f.store.commit();
 await invalid(f,'group_layers',{ids:ids(f)},/Sobrescritas posicionais/);
 delete f.store.get(f.nodes[0].id).bps;f.store.commit();
 const grouped=await f.runner.run('group_layers',{ids:ids(f)});assert.equal(grouped.ok,true,grouped.error);
 f.store.update(()=>{f.store.get(grouped.group.id).opacity=0.5;});f.store.commit();
 await invalid(f,'ungroup_layers',{ids:[grouped.group.id]},/efeitos/);
});
test('não modifica estrutura dos filhos de instância nem semântica de lista HTML',async()=>{
 const f=fixture();f.store.update(()=>{f.frame.instanceOf='main';});
 await invalid(f,'reorder_layer',{id:f.nodes[0].id,index:2},/componente principal/);
 delete f.frame.instanceOf;f.frame.tag='ul';
 await invalid(f,'group_layers',{ids:ids(f)},/lista HTML/);
});
