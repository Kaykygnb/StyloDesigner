// update_layer: o que o painel de propriedades do painel web manda (opcionais com null, transição, grades, máscara, CSS livre).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '@stylo/core/store.js';
import { createNode, makeDoc } from '@stylo/core/model.js';
import { createCommands } from '@stylo/core/commands.js';
import { createRunner } from '@stylo/core/tools/runner.js';
import { createModelCanvas } from '../apps/server/src/workspace/model-canvas.js';

function fixture() {
  const store = createStore({ initial: { doc: makeDoc() } });
  const a = createNode('frame', { name: 'A', x: 0, y: 0, w: 600, h: 400 });
  const kid = createNode('rect', { name: 'R', x: 10, y: 20, w: 40, h: 40 });
  a.children.push(kid);
  store.update((page) => page.children.push(a)); store.commit();
  const commands = createCommands(store, createModelCanvas(store));
  return { store, a, kid, runner: createRunner({ store, commands, approve: async () => true }) };
}

test('update_layer: null apaga opcionais; transição, grades, máscara e CSS livre validam', async () => {
  const f = fixture();
  const id = f.kid.id;
  const set = await f.runner.run('update_layer', { id, props: { minW: 10, sticky: 8, cursor: 'pointer', margin: [1, 2, 3, 4], customCss: 'accent-color: red;', isMask: true, transition: { duration: 200, easing: 'ease-out' } } });
  assert.equal(set.ok, true, set.error);
  let n = f.store.get(id);
  assert.deepEqual([n.minW, n.sticky, n.cursor, n.isMask, n.transition], [10, 8, 'pointer', true, { duration: 200, easing: 'ease-out' }]);
  const clear = await f.runner.run('update_layer', { id, props: { minW: null, sticky: null, cursor: null, margin: null, customCss: null, transition: null } });
  assert.equal(clear.ok, true, clear.error);
  n = f.store.get(id);
  for (const k of ['minW', 'sticky', 'cursor', 'margin', 'customCss', 'transition']) assert.equal(k in n, false, `${k} foi apagado`);
  assert.match((await f.runner.run('update_layer', { id, props: { transition: { duration: 99999 } } })).error, /transition/);
  assert.match((await f.runner.run('update_layer', { id, props: { grids: [] } })).error, /só valem para frames/);
  const ok = await f.runner.run('update_layer', { id: f.a.id, props: { grids: [{ type: 'columns', count: 12, gutter: 16, margin: 24 }] } });
  assert.equal(ok.ok, true, ok.error);
  assert.equal(f.store.get(f.a.id).grids[0].color, '#FF3D3D');
  assert.match((await f.runner.run('update_layer', { id: f.a.id, props: { grids: [{ type: 'diagonal' }] } })).error, /grids/);
});

test('set_layer_css: o que o painel entende vira campo, o resto vai para o CSS livre; get_code traz as declarações', async () => {
  const f = fixture();
  const id = f.kid.id;
  const code = await f.runner.run('get_code', { id });
  assert.match(code.declarations, /width: 40px;/);
  const out = await f.runner.run('set_layer_css', { id, css: 'width: 80px;\nopacity: 0.5;\naccent-color: red;' });
  assert.equal(out.ok, true, out.error);
  const n = f.store.get(id);
  assert.equal(n.w, 80, 'width virou campo do modelo');
  assert.equal(n.opacity, 0.5);
  assert.match(n.customCss, /accent-color: red/);
  assert.ok(Array.isArray(out.mapped));
  assert.equal((await f.runner.run('set_layer_css', { id: 'nao-existe', css: 'color: red' })).ok, undefined);
});

test('comentários: criar com ponto, responder, editar, resolver, reabrir e apagar', async () => {
  const f = fixture();
  const made = await f.runner.run('add_comment', { id: f.kid.id, text: 'Aumentar o espaço aqui', rx: 0.5, ry: 0.25 });
  assert.equal(made.ok, true, made.error);
  const c = f.store.state.doc.comments[0];
  assert.deepEqual([c.rx, c.ry], [0.5, 0.25]);
  assert.equal((await f.runner.run('manage_comment', { comment_id: c.id, action: 'reply', text: 'Feito' })).ok, true);
  assert.equal(c.replies.length, 1);
  assert.equal((await f.runner.run('manage_comment', { comment_id: c.id, action: 'edit', text: 'Aumentar o espaço ao redor' })).ok, true);
  assert.equal(c.text, 'Aumentar o espaço ao redor');
  assert.equal((await f.runner.run('manage_comment', { comment_id: c.id, action: 'edit', reply_id: c.replies[0].id, text: 'Pronto' })).ok, true);
  assert.equal(c.replies[0].text, 'Pronto');
  await f.runner.run('manage_comment', { comment_id: c.id, action: 'resolve' });
  assert.equal(c.resolved, true);
  await f.runner.run('manage_comment', { comment_id: c.id, action: 'reopen' });
  assert.equal(c.resolved, false);
  assert.match((await f.runner.run('manage_comment', { comment_id: c.id, action: 'reply', text: '  ' })).error, /vazia/);
  assert.match((await f.runner.run('manage_comment', { comment_id: 'x', action: 'resolve' })).error, /não existe/);
  await f.runner.run('manage_comment', { comment_id: c.id, action: 'delete' });
  assert.equal(f.store.state.doc.comments.length, 0);
});

test('update_layer: interações do protótipo, ponto de partida e crédito de foto', async () => {
  const f = fixture();
  const id = f.kid.id;
  const ok = await f.runner.run('update_layer', { id, props: { interactions: [{ trigger: 'hover', action: 'navigate', target: f.a.id, transition: 'slide-left' }, { action: 'url', url: 'https://exemplo.com' }, { action: 'back' }] } });
  assert.equal(ok.ok, true, ok.error);
  const n = f.store.get(id);
  assert.deepEqual(n.interactions.map((x: any) => [x.trigger, x.action, x.transition]), [['hover', 'navigate', 'slide-left'], ['click', 'url', 'dissolve'], ['click', 'back', 'dissolve']]);
  assert.equal(n.interactions[1].url, 'https://exemplo.com');
  assert.match((await f.runner.run('update_layer', { id, props: { interactions: [{ action: 'voar' }] } })).error, /interactions/);
  await f.runner.run('update_layer', { id: f.a.id, props: { flowStart: true } });
  assert.equal(f.store.get(f.a.id).flowStart, true);
  await f.runner.run('update_layer', { id: f.a.id, props: { flowStart: null } });
  assert.equal('flowStart' in f.store.get(f.a.id), false);
  const pc = await f.runner.run('update_layer', { id, props: { photoCredit: { provider: 'Pexels', author: 'Ana', sourceUrl: 'javascript:alert(1)', authorUrl: 'https://pexels.com/ana', attributionRequired: true } } });
  assert.equal(pc.ok, true, pc.error);
  assert.equal(f.store.get(id).photoCredit.sourceUrl, '', 'só http(s) vale');
  assert.equal(f.store.get(id).photoCredit.authorUrl, 'https://pexels.com/ana');
});
