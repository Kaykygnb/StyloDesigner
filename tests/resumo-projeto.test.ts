// Resumo do projeto para o agente (packages/core/src/brief.ts e a ferramenta get_project_map).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectBrief } from '@stylo/core/brief.ts';
import { createNode, makeDoc } from '@stylo/core/model.js';
import { createStore } from '@stylo/core/store.js';
import { createCommands } from '@stylo/core/commands.js';
import { createRunner } from '@stylo/core/tools/runner.ts';

function sample() {
  const doc = makeDoc();
  doc.name = 'Loja de bolos';
  const title = createNode('text', { name: 'Título', text: 'Bolos caseiros em Uberlândia', w: 400, h: 48 });
  const cta = createNode('frame', { name: 'Botão comprar', w: 160, h: 44, component: true });
  const home = createNode('frame', { name: 'Início', w: 1440, h: 900, children: [title, cta] });
  const cart = createNode('frame', { name: 'Carrinho', w: 1440, h: 900 });
  cta.interactions = [{ trigger: 'click', action: 'navigate', target: cart.id }];
  doc.pages[0].children = [home, cart];
  doc.styles.colors.push({ id: 'c1', name: 'Marca', color: '#c2410c' });
  doc.comments.push({ id: 'k1', nodeId: title.id, text: 'Trocar o título por algo mais curto', resolved: false, author: 'kayky' });
  return doc;
}

test('projectBrief: telas, textos reais, design system, navegação e pendências', () => {
  const { markdown, stats } = projectBrief(sample(), { notes: [{ kind: 'DECISION', body: 'Pagamento só por Pix', by: 'kayky' }] });
  assert.match(markdown, /^# Loja de bolos/);
  assert.match(markdown, /\*\*Início\*\* — 1440×900/);
  assert.match(markdown, /“Bolos caseiros em Uberlândia”/, 'leva o texto real');
  assert.match(markdown, /Marca: `#c2410c`/);
  assert.match(markdown, /Botão comprar.*vai para “Carrinho”/);
  assert.match(markdown, /Pagamento só por Pix \(kayky\)/);
  assert.match(markdown, /Trocar o título.*em “Título”/);
  assert.equal(stats.screens, 2);
  assert.equal(stats.components, 1);
  assert.equal(stats.interactions, 1);
  assert.equal(stats.openComments, 1);
});

test('projectBrief: projeto vazio explica o que falta em vez de quebrar', () => {
  const { markdown } = projectBrief(makeDoc());
  assert.match(markdown, /Página vazia/);
  assert.match(markdown, /Nenhum estilo ou componente salvo/);
  assert.match(markdown, /Nenhuma interação definida/);
});

test('get_project_map: o executor devolve o mesmo resumo', async () => {
  const store = createStore();
  store.state.doc = sample();
  const runner = createRunner({ store, commands: createCommands(store) });
  const out: any = await runner.run('get_project_map', { depth: 2 }, 'teste');
  assert.match(out.markdown, /# Loja de bolos/);
});
