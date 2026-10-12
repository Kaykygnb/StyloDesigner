// Ferramentas MCP: a lista (packages/core/src/tools/schema.ts) e as regras de alteração do executor (runner.js → applyProps).
// O protocolo (cliente oficial do SDK) está em tests/mcp-sdk.test.js e o fluxo completo em tests/workspace.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_TOOLS, mcpTools, validateToolArgs } from '@stylo/core/tools/schema.js';
import { applyProps, summarize, describeCall, PROPS, createRunner } from '@stylo/core/tools/runner.js';
import { createNode } from '@stylo/core/model.js';

test('toolResult: imagem vira conteúdo de imagem do MCP, o resto texto; erro e recusa marcam isError', async () => {
  const { toolResult } = await import('../apps/server/src/mcp/gateway.ts');
  const ok = toolResult({ ok: true, _image: { data: 'QUJD', mimeType: 'image/png' }, _summary: 'x', id: 'a' });
  assert.equal(ok.isError, false);
  assert.deepEqual(ok.content[0], { type: 'image', data: 'QUJD', mimeType: 'image/png' });
  assert.deepEqual(JSON.parse(ok.content[1].text), { ok: true, id: 'a' }, '_image e _summary não vão no texto');
  assert.equal(toolResult({ error: 'x' }).isError, true);
  assert.equal(toolResult({ refused: true }).isError, true);
});

test('lista de ferramentas: esquemas JSON válidos (gerados do Zod) e "somente leitura" marcado', () => {
  assert.equal(mcpTools().length, AGENT_TOOLS.length);
  for (const t of mcpTools()) {
    assert.equal(t.inputSchema.type, 'object', t.name);
    assert.ok(!('$schema' in t.inputSchema), `${t.name}: sem ruído do Zod`);
    assert.ok(t.description.length > 20, t.name);
  }
  assert.deepEqual(new Set(AGENT_TOOLS.map((t) => t.name)).size, AGENT_TOOLS.length, 'nomes únicos');
  const ro = Object.fromEntries(mcpTools().map((t) => [t.name, t.annotations.readOnlyHint]));
  assert.equal(ro.get_document, true);
  assert.equal(ro.update_layer, false);
  assert.equal(mcpTools().find((t) => t.name === 'delete_layers').annotations.destructiveHint, true);
});

test('applyProps: cores, cantos, layout mesclado, etiqueta e tamanho', () => {
  const f = createNode('frame', { w: 300, h: 200 });
  let modeSet = null;
  applyProps(f, { fill: '#abc', radius: 8, layout: { mode: 'row', gap: 16, padding: [8, 12] }, tag: 'nav', w: 500 }, { setLayoutMode: (n, m) => { modeSet = m; n.layout.mode = m; } });
  assert.equal(f.fill.color, '#AABBCC');
  assert.equal(f.fill.type, 'solid');
  assert.deepEqual(f.radius, [8, 8, 8, 8]);
  assert.equal(modeSet, 'row');
  assert.equal(f.layout.gap, 16);
  assert.deepEqual(f.layout.padding, [8, 12, 8, 12]);
  assert.equal(f.layout.align, 'flex-start'); // o resto do layout continua
  assert.equal(f.tag, 'nav');
  assert.equal(f.w, 500);
  applyProps(f, { fill: 'none', stroke: '#ff0000' });
  assert.equal(f.fill.type, 'none');
  assert.equal(f.stroke.color, '#FF0000');
  applyProps(f, { stroke: null });
  assert.equal(f.stroke, null);
});

test('applyProps recusa o que não existe ou não faz sentido (mensagens que a IA entende)', () => {
  const r = createNode('rect');
  assert.throws(() => applyProps(r, { corDeFundo: 'azul' }), /desconhecida: corDeFundo/);
  assert.throws(() => applyProps(r, { layout: { mode: 'row' } }), /layout só vale para frames/);
  assert.throws(() => applyProps(r, { text: 'oi' }), /text só vale para camadas de texto/);
  assert.throws(() => applyProps(r, { sizeX: 'grande' }), /sizeX precisa ser/);
  assert.throws(() => applyProps(r, { fill: 'azul' }), /fill: use uma cor/);
  assert.throws(() => applyProps(r, { tag: 'script' }), /tag para/);
  assert.throws(() => applyProps(r, { w: -5 }), /maiores que zero/);
  assert.throws(() => applyProps(createNode('frame'), { layout: { mode: 'flexbox' } }), /layout.mode precisa ser/);
  assert.ok(PROPS.includes('fill') && PROPS.includes('layout'));
});

test('summarize e describeCall: resumo curto para a IA e frase clara para a janela de permissão', () => {
  const f = createNode('frame', { name: 'Card', w: 300, h: 200 });
  f.layout.mode = 'column';
  f.children.push(createNode('text', { name: 'Título', text: 'Olá' }));
  const s = summarize(f, 1);
  assert.equal(s.layout.mode, 'column');
  assert.equal(s.children[0].text, 'Olá');
  assert.equal(summarize(f, 0).childCount, 1);
  const store = { get: (id) => (id === f.id ? f : null) };
  assert.equal(describeCall('update_layer', { id: f.id, props: { radius: 8, layout: { gap: 4 } } }, store), 'Alterar “Card”: radius, layout.gap');
  assert.equal(describeCall('create_layer', { type: 'text', parent_id: f.id, props: { name: 'Sub' } }, store), 'Criar um texto “Sub” dentro de “Card”');
});

test('provedores: OpenAI, NVIDIA NIM e Ollama reconhecidos pelo endereço; locais não pedem chave', async () => {
  const { PROVIDERS, providerOf, isLocalUrl } = await import('@stylo/server/providers.js');
  assert.deepEqual(PROVIDERS.map((p) => p.id), ['openai', 'nvidia', 'ollama']);
  assert.equal(providerOf('https://integrate.api.nvidia.com/v1/').id, 'nvidia');
  assert.equal(providerOf('https://exemplo.com/v1'), null);
  assert.equal(isLocalUrl('http://localhost:11434/v1'), true);
  assert.equal(isLocalUrl('http://127.0.0.1:1234/v1'), true);
  assert.equal(isLocalUrl('https://integrate.api.nvidia.com/v1'), false);
  assert.equal(isLocalUrl('https://localhost.evil.com/v1'), false);
});

test('applyProps: fill ligado a um estilo de cor do projeto; estilo inexistente é recusado', () => {
  const r = createNode('rect');
  const styles = { c1: { id: 'c1', color: '#B91C1C', opacity: 1 } };
  applyProps(r, { fill: { styleId: 'c1' } }, { colorStyle: (id) => styles[id] || null });
  assert.equal(r.fill.styleId, 'c1');
  assert.equal(r.fill.color, '#B91C1C');
  assert.equal(r.fill.type, 'solid');
  assert.throws(() => applyProps(r, { fill: { styleId: 'nao-existe' } }, { colorStyle: () => null }), /Estilo de cor "nao-existe" não existe/);
  applyProps(r, { fill: '#00ff00' });
  assert.equal(r.fill.styleId, undefined); // cor escolhida à mão desliga o estilo
});

test('ícones do Google: busca em português e conferência do nome (o agente usa isso)', async () => {
  const { searchIcons, iconExists } = await import('@stylo/core/icons.js');
  assert.equal(searchIcons('carrinho')[0], 'shopping_cart');
  assert.equal(searchIcons('casa')[0], 'home');
  assert.ok(iconExists('local_pizza'));
  assert.ok(!iconExists('carrinho_de_compras'));
});

test('ferramentas de criação grande existem e estão marcadas certo (escrita × leitura)', () => {
  const byName = Object.fromEntries(AGENT_TOOLS.map((t) => [t.name, t]));
  for (const n of ['build_layout', 'insert_icon', 'create_color_styles', 'create_page']) assert.equal(byName[n].write, true, n);
  for (const n of ['search_icons', 'list_fonts', 'switch_page']) assert.equal(byName[n].write, false, n);
  assert.match(byName.build_layout.description, /UMA permissão/);
});

test('MCP completo: 66 ferramentas (com exportação, assets, lote e edição CSS); destrutivas marcadas', () => {
  assert.equal(AGENT_TOOLS.length, 66);
  assert.equal(mcpTools().find((tool) => tool.name === 'export_site').annotations.readOnlyHint, true);
  const destructive = mcpTools().filter((t) => t.annotations.destructiveHint).map((t) => t.name).sort();
  assert.deepEqual(destructive, ['delete_layers', 'delete_page']);
});

test('export_site lista metadados e entrega conteúdo grande em trechos UTF-8', async () => {
  const page = { id: 'page', name: 'Projeto', children: [createNode('frame', { name: 'Home', children: [createNode('text', { text: 'x'.repeat(300 * 1024) })] })] };
  const store = { state: { doc: { name: 'Projeto', pages: [page], assets: {}, styles: {} } } };
  const frame = page.children[0];
  store.get = (id) => id === frame.id ? frame : null;
  const runner = createRunner({ store, commands: {}, approve: async () => true });
  const meta = await runner.run('export_site', {});
  assert.equal(meta.files[0].path, 'index.html');
  assert.ok(meta.files[0].bytes > 256 * 1024);
  assert.ok(!('content' in meta.files[0]));
  const tooLarge = await runner.run('export_site', { includeContent: true });
  assert.match(tooLarge.error, /O conteúdo total tem/);
  let content = '';
  let offset = 0;
  let complete = false;
  while (!complete) {
    const chunk = await runner.run('export_site', { includeContent: true, path: 'index.html', offset, maxBytes: 256 * 1024 });
    assert.ok(chunk.files[0].chunkBytes <= 256 * 1024);
    content += chunk.files[0].content;
    offset = chunk.files[0].nextOffset;
    complete = chunk.files[0].complete;
  }
  assert.match(content, /x{64}/);
  assert.equal(new TextEncoder().encode(content).byteLength, meta.files[0].bytes);
  const htmlFirst = await runner.run('export_html', { id: frame.id, maxBytes: 1024 });
  assert.equal(htmlFirst.file, 'home.html');
  assert.equal(typeof htmlFirst.html, 'string');
  assert.equal(htmlFirst.chunkBytes, 1024);
  assert.equal(htmlFirst.complete, false);
  const htmlSecond = await runner.run('export_html', { id: frame.id, maxBytes: 1024, offset: htmlFirst.nextOffset });
  assert.equal(htmlSecond.offset, htmlFirst.nextOffset);
  assert.match((await runner.run('export_site', { path: '../index.html' })).error, /não existe/);
});

test('validateToolArgs: o Zod da ferramenta recusa o que está errado com mensagem em português e aceita o resto', () => {
  assert.equal(validateToolArgs('get_layer', { id: 'abc' }), null);
  assert.match(validateToolArgs('get_layer', {}), /Argumentos inválidos para get_layer — id:/);
  assert.match(validateToolArgs('create_layer', { type: 'triangulo' }), /type: .*frame/);
  assert.match(validateToolArgs('get_document', { depth: 'muito' }), /depth:/);
  assert.match(validateToolArgs('edit_image', { id: 'a', rotate: 45 }), /rotate: .*90/);
  assert.equal(validateToolArgs('edit_image', { id: 'a', rotate: 90 }), null);
  assert.equal(validateToolArgs('create_layer', { type: 'frame', props: { qualquer: 1 } }), null, 'o conteúdo livre de props continua livre (quem confere é applyProps)');
  assert.match(validateToolArgs('create_layer', { type: 'frame', campo_que_nao_existe: true }), /Argumento desconhecido em create_layer: campo_que_nao_existe. Aceitos: type, parent_id, index, props./, 'campos desconhecidos são recusados, listando os aceitos');
  assert.equal(validateToolArgs('ferramenta_inexistente', {}), null, 'quem não conhece a ferramenta reclama em outro lugar');
});

test('o executor devolve o erro de validação sem rodar a ferramenta', async () => {
  const runner = createRunner({ store: {}, commands: {} });
  const out = await runner.run('get_layer', {});
  assert.match(out.error, /Argumentos inválidos para get_layer/);
});
