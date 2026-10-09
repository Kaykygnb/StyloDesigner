// IA no editor, sem navegador: o protocolo MCP (server/mcp.js), a lista de ferramentas (src/agent/schema.js) e as
// regras de alteração (src/agent/runner.js → applyProps). O fluxo completo, com editor aberto, permissão e o
// Assistente, fica em tests/e2e/agente-mcp.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMcp, PROTOCOL_VERSIONS } from '../server/mcp.js';
import { AGENT_TOOLS, openAiTools, mcpTools } from '../src/agent/schema.js';
import { applyProps, summarize, describeCall, PROPS } from '../src/agent/runner.js';
import { createNode } from '../src/model.js';

const rpc = (method, params, id = 1) => ({ jsonrpc: '2.0', id, method, params });

test('MCP initialize: devolve a versão pedida (se conhecida) e guarda o nome do programa', async () => {
  const session = {};
  const r = await handleMcp(rpc('initialize', { protocolVersion: '2024-11-05', clientInfo: { name: 'Claude Code' } }), { callTool: null, version: '9.9.9', session });
  assert.equal(r.result.protocolVersion, '2024-11-05');
  assert.equal(r.result.serverInfo.version, '9.9.9');
  assert.ok(r.result.capabilities.tools);
  assert.match(r.result.instructions, /canvas É CSS/);
  assert.equal(session.name, 'Claude Code');
  const unknown = await handleMcp(rpc('initialize', { protocolVersion: '1999-01-01' }), { callTool: null });
  assert.equal(unknown.result.protocolVersion, PROTOCOL_VERSIONS[0]);
});

test('MCP: aviso sem id não tem resposta; método desconhecido e pedido inválido dão erro JSON-RPC', async () => {
  assert.equal(await handleMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, { callTool: null }), null);
  assert.equal((await handleMcp(rpc('resources/list'), { callTool: null })).error.code, -32601);
  assert.equal((await handleMcp({ hello: 1 }, { callTool: null })).error.code, -32600);
  assert.deepEqual((await handleMcp(rpc('ping'), { callTool: null })).result, {});
});

test('MCP tools/call: repassa ao editor; erro e recusa voltam como isError (a IA lê e explica)', async () => {
  const calls = [];
  const callTool = async (name, args, client) => { calls.push([name, args, client]); return name === 'get_layer' ? { error: 'Camada "x" não existe.' } : { ok: true }; };
  const session = { name: 'Codex' };
  const ok = await handleMcp(rpc('tools/call', { name: 'get_document', arguments: { depth: 2 } }), { callTool, session });
  assert.equal(ok.result.isError, false);
  assert.deepEqual(JSON.parse(ok.result.content[0].text), { ok: true });
  assert.deepEqual(calls[0], ['get_document', { depth: 2 }, 'Codex']);
  const err = await handleMcp(rpc('tools/call', { name: 'get_layer', arguments: { id: 'x' } }), { callTool, session });
  assert.equal(err.result.isError, true);
  const offline = await handleMcp(rpc('tools/call', { name: 'get_document' }), { callTool: async () => { throw new Error('O editor não está aberto.'); } });
  assert.equal(offline.result.isError, true);
  assert.match(offline.result.content[0].text, /editor não está aberto/);
  assert.equal((await handleMcp(rpc('tools/call', { name: 'rm_rf' }), { callTool })).error.code, -32602);
});

test('lista de ferramentas: mesma para MCP e OpenAI, com esquemas válidos e "somente leitura" marcado', () => {
  assert.equal(mcpTools().length, AGENT_TOOLS.length);
  assert.equal(openAiTools().length, AGENT_TOOLS.length);
  for (const t of openAiTools()) {
    assert.equal(t.type, 'function');
    assert.equal(t.function.parameters.type, 'object');
  }
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
  const { PROVIDERS, providerOf, isLocalUrl } = await import('../src/agent/providers.js');
  assert.deepEqual(PROVIDERS.map((p) => p.id), ['openai', 'nvidia', 'ollama']);
  assert.equal(providerOf('https://integrate.api.nvidia.com/v1/').id, 'nvidia');
  assert.equal(providerOf('https://exemplo.com/v1'), null);
  assert.equal(isLocalUrl('http://localhost:11434/v1'), true);
  assert.equal(isLocalUrl('http://127.0.0.1:1234/v1'), true);
  assert.equal(isLocalUrl('https://integrate.api.nvidia.com/v1'), false);
  assert.equal(isLocalUrl('https://localhost.evil.com/v1'), false);
});

test('respostas dos modelos: some o <think>, argumentos em texto ou objeto, ferramenta "escrita" como texto é detectada', async () => {
  const { cleanReply, parseArgs, looksLikeTextToolCall } = await import('../src/ui/assistant.js');
  assert.equal(cleanReply('<think>pensando...</think>Pronto!'), 'Pronto!');
  assert.equal(cleanReply('<think>cortado no meio'), '');
  assert.equal(cleanReply('Só texto'), 'Só texto');
  assert.deepEqual(parseArgs('{"id":"a"}'), { id: 'a' });
  assert.deepEqual(parseArgs({ id: 'a' }), { id: 'a' });
  assert.deepEqual(parseArgs(''), {});
  assert.equal(parseArgs('{quebrado'), null);
  assert.equal(looksLikeTextToolCall('{"name": "update_layer", "arguments": {}}'), true);
  assert.equal(looksLikeTextToolCall('<tool_call>{...}</tool_call>'), true);
  assert.equal(looksLikeTextToolCall('Deixei o botão com cantos de 12px.'), false);
});

test('MCP usa as instruções recebidas (o servidor lê de docs/AGENTE.md)', async () => {
  const r = await handleMcp(rpc('initialize', {}), { callTool: null, instructions: 'Você é um teste.' });
  assert.match(r.result.instructions, /^Você é um teste\./);
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
  const { searchIcons, iconExists } = await import('../src/ui/googleicons.js');
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

test('MCP: get_image vira conteúdo de IMAGEM (a IA vê o design); campos internos não vazam', async () => {
  const callTool = async () => ({ id: 'a', _image: { data: 'iVBORw0KGgo=', mimeType: 'image/png' }, _summary: 'x' });
  const r = await handleMcp(rpc('tools/call', { name: 'get_image', arguments: {} }), { callTool });
  assert.deepEqual(r.result.content[0], { type: 'image', data: 'iVBORw0KGgo=', mimeType: 'image/png' });
  assert.equal(r.result.content[1].type, 'text');
  assert.ok(!r.result.content[1].text.includes('iVBOR') && !r.result.content[1].text.includes('_summary'));
});

test('MCP completo: 33 ferramentas; as de projeto exigem administrador; destrutivas marcadas', () => {
  assert.equal(AGENT_TOOLS.length, 33);
  const admin = AGENT_TOOLS.filter((t) => t.admin).map((t) => t.name).sort();
  assert.deepEqual(admin, ['list_projects', 'new_project', 'open_project', 'save_project']);
  const destructive = mcpTools().filter((t) => t.annotations.destructiveHint).map((t) => t.name).sort();
  assert.deepEqual(destructive, ['delete_layers', 'delete_page', 'new_project', 'open_project']);
});

test('plugin do Claude Code: arquivos válidos, nomes batendo e MCP apontando para o editor', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
  const market = read('.claude-plugin/marketplace.json');
  const plugin = read('integrations/claude-code/.claude-plugin/plugin.json');
  const mcpCfg = read('integrations/claude-code/.mcp.json');
  assert.equal(market.plugins[0].name, plugin.name); // o nome do marketplace e o do plugin precisam ser iguais
  assert.equal(market.plugins[0].source, './integrations/claude-code');
  assert.ok(market.owner?.name && plugin.version && plugin.description);
  assert.deepEqual(mcpCfg.mcpServers['projeto-designer'], { type: 'http', url: 'http://localhost:5173/mcp' });
  const skill = readFileSync(new URL('../integrations/claude-code/skills/projeto-designer/SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /^---\r?\nname: projeto-designer\r?\ndescription: .+\r?\n---/);
  assert.ok(existsSync(new URL('../integrations/codex/config.toml', import.meta.url)) && existsSync(new URL('../integrations/codex/AGENTS.md', import.meta.url)));
});
