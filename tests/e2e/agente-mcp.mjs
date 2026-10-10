// IA no editor: inspetor (F12), MCP pelo endereço HTTP e pelo terminal (stdio), janela de permissão, Ctrl+Z e o
// Assistente interno conversando com uma "OpenAI de mentira" (um servidor falso criado aqui, que responde no mesmo
// formato da API real) — assim o teste não gasta crédito nem precisa de chave. Também confere que a chave da API
// nunca sai do servidor. Devolve a configuração original do assistente no fim.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.APP_URL || 'http://localhost:5173/';
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + x)); };
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
p.on('dialog', (d) => { errors.push('diálogo nativo: ' + d.message()); d.dismiss(); });
const ev = (f, a) => p.evaluate(f, a);
const url = (path) => new URL(path, BASE).href;
/** Espera a remoção de uma aba na presença antes de encaminhar chamadas para o editor restante. */
async function waitForEditorDisconnect(editorId) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const snapshot = await (await fetch(url('/api/presence'))).json();
    if (!snapshot.people.some((person) => person.id === editorId)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`O servidor não confirmou o fechamento do editor ${editorId}.`);
}
/** Uma chamada JSON-RPC ao MCP por HTTP (como o Claude Code faz). */
let rpcId = 0;
let mcpSession = '';
let secondEditorContext = null;
let selectedTabAgent = null;
const mcp = async (method, params = {}, headers = {}) => {
  // initialize abre outra conexão; encerrar a anterior evita reaproveitar a identidade de um agente diferente.
  if (method === 'initialize' && mcpSession) {
    await fetch(url('/mcp'), { method: 'DELETE', headers: { 'Mcp-Session-Id': mcpSession } });
    mcpSession = '';
  }
  const r = await fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(mcpSession ? { 'Mcp-Session-Id': mcpSession } : {}), ...headers }, body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }) });
  mcpSession = r.headers.get('mcp-session-id') || mcpSession;
  return { status: r.status, body: r.status === 200 ? await r.json() : null };
};
/** Resultado de uma ferramenta chamada pelo MCP (o texto JSON vira objeto). */
const callTool = async (name, args) => {
  const { body } = await mcp('tools/call', { name, arguments: args });
  const text = body.result.content[0].text;
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text }; }
  return { isError: body.result.isError, data };
};
const callWithSession = async (sid, id, name, args) => {
  const response = await fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': sid }, body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }) });
  const body = await response.json();
  const text = body.result?.content?.[0]?.text || '';
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text }; }
  return { isError: body.result?.isError, data, body };
};
const original = await (await fetch(url('/api/agent/config'))).json();
let mock = null;

try {
  await p.goto(url('?editor'));
  await p.waitForTimeout(900);
  // projeto pequeno e conhecido: uma tela com um card (flex em coluna) contendo título e botão
  const ids = await ev(async () => {
    const { createNode, defaultFill } = await import('/src/model.js');
    const s = designer.store;
    s.newDoc();
    const tela = createNode('frame', { name: 'Tela', x: 0, y: 0, w: 600, h: 400 });
    const card = createNode('frame', { name: 'Card', x: 40, y: 40, w: 300, h: 200, fill: { ...defaultFill('#F2F2F7') } });
    card.layout = { ...card.layout, mode: 'column', gap: 12, padding: [16, 16, 16, 16] };
    const titulo = createNode('text', { name: 'Título', text: 'Olá', fontSize: 24, sizeX: 'hug', sizeY: 'hug' });
    const botao = createNode('rect', { name: 'Botão', w: 120, h: 40, fill: { ...defaultFill('#7C5CFF') } });
    card.children.push(titulo, botao);
    tela.children.push(card);
    s.update((pg) => pg.children.push(tela), { commit: true });
    designer.canvas.fit([tela.id], { padding: 100, maxZoom: 1 });
    return { tela: tela.id, card: card.id, titulo: titulo.id, botao: botao.id };
  });
  await p.waitForTimeout(300);

  // ---------------------------------------------------------------- 1. inspetor (F12)
  await p.keyboard.press('i');
  ok('tecla I liga o inspetor', (await ev(() => designer.store.ui.tool)) === 'inspect');
  const bp = await ev((id) => { const r = designer.canvas.els.get(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, ids.botao);
  await p.mouse.move(bp.x, bp.y);
  await p.waitForTimeout(200);
  const tip = await p.locator('.insp-tip').innerText().catch(() => '');
  ok('passar o mouse mostra etiqueta e classe do código (div.botao)', /div\s*\.botao/.test(tip) && tip.includes('120 × 40'), tip);
  ok('mostra o CSS de verdade (display, position, background)', tip.includes('display') && tip.includes('relative') && tip.includes('rgb(124, 92, 255)'), tip);
  ok('desenha conteúdo e caixa (box model)', (await p.locator('.insp-content').count()) === 1 && (await p.locator('.insp-box').count()) === 1);
  const cp = await ev((id) => { const r = designer.canvas.els.get(id).getBoundingClientRect(); return { x: r.left + 4, y: r.top + 4 }; }, ids.card);
  await p.mouse.move(cp.x, cp.y);
  await p.waitForTimeout(200);
  const tipCard = await p.locator('.insp-tip').innerText();
  ok('frame com layout mostra flex, gap e padding', tipCard.includes('flex · column') && tipCard.includes('12px') && tipCard.includes('padding') && tipCard.includes('16'), tipCard);
  ok('mostra o contorno de cada filho e o gap entre eles (hachurado)', (await p.locator('.insp-child').count()) === 2 && (await p.locator('.insp-gap').count()) === 1 && tipCard.includes('filhos'));
  // grid: linhas das colunas/linhas e os gaps entre elas
  await ev((id) => { const s = designer.store; s.update(() => { const c = s.get(id); c.layout.mode = 'grid'; c.layout.cols = 2; c.layout.colGap = 10; c.layout.rowGap = 10; }); s.emit('doc'); }, ids.card);
  await p.mouse.move(cp.x + 1, cp.y + 1);
  await p.waitForTimeout(250);
  ok('grid: linhas de cada coluna/linha e os gaps', (await p.locator('.insp-line.v').count()) === 4 && (await p.locator('.insp-line.h').count()) === 2 && (await p.locator('.insp-gap').count()) === 1, `${await p.locator('.insp-line.v').count()} v, ${await p.locator('.insp-line.h').count()} h, ${await p.locator('.insp-gap').count()} gaps`);
  await ev((id) => { const s = designer.store; s.update(() => { s.get(id).layout.mode = 'column'; }); s.emit('doc'); }, ids.card);
  await p.mouse.click(bp.x, bp.y);
  ok('clicar seleciona o elemento exato sob o mouse (o botão, não o card)', (await ev(() => designer.store.ui.selection.join())) === ids.botao);
  ok('e continua inspecionando', (await ev(() => designer.store.ui.tool)) === 'inspect');
  await p.keyboard.press('Escape');
  ok('Esc sai do inspetor', (await ev(() => designer.store.ui.tool)) === 'move' && (await p.locator('.insp-tip').count()) === 0);

  // ---------------------------------------------------------------- 2. MCP por HTTP
  const init = await mcp('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Teste MCP', version: '1' } });
  ok('MCP initialize responde com nome e ferramentas', init.body?.result?.serverInfo?.name === 'projeto-designer' && !!init.body.result.capabilities.tools, JSON.stringify(init.body));
  // Duas conexões independentes leem ao mesmo tempo e encerram suas sessões sem deixar presença fantasma.
  const openAgent = async (name) => {
    const response = await fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Stylo-Agent': name }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name, version: '1' } } }) });
    return { sid: response.headers.get('mcp-session-id'), init: await response.json(), name };
  };
  const agents = await Promise.all(['Auditoria A', 'Auditoria B'].map(openAgent));
  const sessionlessWrite = await fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'tools/call', params: { name: 'update_layer', arguments: { id: ids.botao, props: { radius: 77 } } } }) });
  const sessionlessError = await sessionlessWrite.json();
  ok('cliente sem Mcp-Session-Id não compartilha identidade nem trava', sessionlessWrite.status === 400 && /Mcp-Session-Id ausente/.test(sessionlessError.error || ''));
  const reads = await Promise.all(agents.map((agent) => fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': agent.sid }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_document', arguments: {} } }) }).then((r) => r.json())));
  const liveAgents = await (await fetch(url('/api/presence'))).json();
  ok('dois clientes MCP independentes fazem leituras simultâneas', agents.every((a) => a.sid && a.init.result) && reads.every((r) => !r.result?.isError) && agents.every((a) => liveAgents.agents.some((x) => x.id === a.sid && x.name === a.name && x.active)));
  const closed = await Promise.all(agents.map((a) => fetch(url('/mcp'), { method: 'DELETE', headers: { 'Mcp-Session-Id': a.sid } })));
  const afterClose = await (await fetch(url('/api/presence'))).json();
  ok('DELETE encerra sessões MCP, remove presença e libera os clientes', closed.every((r) => r.status === 204) && agents.every((a) => !afterClose.agents.some((x) => x.id === a.sid)));
  const expired = await fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': agents[0].sid }, body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list' }) });
  ok('sessão encerrada não pode ser reutilizada', expired.status === 404);
  const getStream = await fetch(url('/mcp'), { method: 'GET' });
  ok('transporte informa POST e DELETE como métodos aceitos', getStream.status === 405 && /POST/.test(getStream.headers.get('allow') || '') && /DELETE/.test(getStream.headers.get('allow') || ''));
  // Clique no canvas durante uma aprovação pendente não deve parecer uma recusa silenciosa.
  const outsideClickAgent = await openAgent('Teste de clique fora');
  const outsideClickWrite = fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': outsideClickAgent.sid }, body: JSON.stringify({ jsonrpc: '2.0', id: 31, method: 'tools/call', params: { name: 'update_layer', arguments: { id: ids.botao, props: { radius: 6 } } } }) });
  await p.waitForSelector('.ask-modal', { timeout: 5000 });
  await p.locator('.modal-backdrop').click({ position: { x: 8, y: 8 } });
  await p.waitForTimeout(100);
  const permissionStillOpen = (await p.locator('.ask-modal').count()) === 1;
  ok('clique fora da aprovação MCP não fecha nem recusa a alteração', permissionStillOpen);
  if (permissionStillOpen) await p.getByRole('button', { name: 'Recusar', exact: true }).click();
  const outsideClickResult = await outsideClickWrite.then((r) => r.json());
  ok('recusa explícita encerra a operação sem aplicar a mudança', outsideClickResult.result?.isError === true && /recusou/i.test(outsideClickResult.result.content?.[0]?.text || '') && (await ev((id) => designer.store.get(id).radius[0], ids.botao)) === 0);
  await fetch(url('/mcp'), { method: 'DELETE', headers: { 'Mcp-Session-Id': outsideClickAgent.sid } });
  // Fechar uma sessão com escrita aguardando permissão não pode liberar a trava cedo.
  const pendingAgent = await openAgent('Auditoria pendente');
  const pendingWrite = fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': pendingAgent.sid }, body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'update_layer', arguments: { id: ids.botao, props: { radius: 7 } } } }) });
  await p.waitForSelector('.ask-modal', { timeout: 5000 }).catch((err) => { console.log('DEBUG pending MCP:', errors.join(' | ')); throw err; });
  // A segunda escrita em outra camada espera na fila de permissões. Cancelá-la precisa
  // responder ao MCP sem aguardar a pessoa resolver o diálogo da primeira chamada.
  const queuedWrite = fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': pendingAgent.sid }, body: JSON.stringify({ jsonrpc: '2.0', id: 42, method: 'tools/call', params: { name: 'update_layer', arguments: { id: ids.titulo, props: { opacity: 0.7 } } } }) });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const queuedCancel = await fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': pendingAgent.sid }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 42 } }) });
  const queuedResult = await Promise.race([queuedWrite.then(async (r) => ({ done: true, body: await r.json() })), new Promise((resolve) => setTimeout(() => resolve({ done: false }), 700))]);
  ok('cancelar escrita na fila MCP responde sem esperar a primeira permissão', queuedCancel.status === 202 && queuedResult.done && queuedResult.body.result?.isError && /cancelada pelo cliente/.test(queuedResult.body.result.content?.[0]?.text || ''), JSON.stringify(queuedResult));
  const sameSessionConflict = await fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': pendingAgent.sid }, body: JSON.stringify({ jsonrpc: '2.0', id: 41, method: 'tools/call', params: { name: 'update_layer', arguments: { id: ids.botao, props: { radius: 8 } } } }) }).then((r) => r.json());
  ok('duas escritas paralelas da mesma sessão não disputam a mesma camada', /está sendo alterada/.test(sameSessionConflict.result?.content?.[0]?.text || ''), JSON.stringify(sameSessionConflict));
  const contender = await openAgent('Auditoria concorrente');
  const conflict = await fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': contender.sid }, body: JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'update_layer', arguments: { id: ids.botao, props: { radius: 9 } } } }) }).then((r) => r.json());
  ok('a trava impede outro agente de alterar a camada durante a permissão pendente', /está sendo alterada/.test(conflict.result?.content?.[0]?.text || ''), JSON.stringify(conflict));
  const documentConflict = await fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': contender.sid }, body: JSON.stringify({ jsonrpc: '2.0', id: 51, method: 'tools/call', params: { name: 'create_page', arguments: { name: 'Página concorrente' } } }) }).then((r) => r.json());
  ok('operação estrutural global também espera enquanto outra camada está em edição', /está sendo alterada/.test(documentConflict.result?.content?.[0]?.text || ''), JSON.stringify(documentConflict));
  const closePending = await fetch(url('/mcp'), { method: 'DELETE', headers: { 'Mcp-Session-Id': pendingAgent.sid } });
  const cancelledByClose = await pendingWrite.then((r) => r.json());
  ok('DELETE cancela a edição pendente antes de liberar a sessão', closePending.status === 204 && cancelledByClose.result?.isError && /cancelada pelo cliente/.test(cancelledByClose.result.content?.[0]?.text || '') && (await ev((id) => designer.store.get(id).radius[0], ids.botao)) === 0);
  const afterPending = await (await fetch(url('/api/presence'))).json();
  ok('a presença é removida depois que a edição pendente termina', !afterPending.agents.some((a) => a.id === pendingAgent.sid));
  await fetch(url('/mcp'), { method: 'DELETE', headers: { 'Mcp-Session-Id': contender.sid } });
  const cancellable = await openAgent('Auditoria cancelamento');
  const cancellableWrite = fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': cancellable.sid }, body: JSON.stringify({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'update_layer', arguments: { id: ids.botao, props: { radius: 13 } } } }) });
  await p.waitForSelector('.ask-modal');
  const cancelled = await fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': cancellable.sid }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 6 } }) });
  const cancelResponse = await cancellableWrite.then((r) => r.json());
  ok('notifications/cancelled fecha a permissão e impede a edição pendente', cancelled.status === 202 && cancelResponse.result?.isError && /cancelada pelo cliente/.test(cancelResponse.result.content?.[0]?.text || '') && (await ev((id) => designer.store.get(id).radius[0], ids.botao)) === 0);
  await fetch(url('/mcp'), { method: 'DELETE', headers: { 'Mcp-Session-Id': cancellable.sid } });
  const note = await fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
  ok('aviso (notification) recebe 202 sem corpo', note.status === 202);
  const list = await mcp('tools/list');
  const names = list.body.result.tools.map((t) => t.name);
  ok('tools/list traz 41 ferramentas de design e 2 para escolher a aba', names.length === 43 && ['edit_image', 'generate_image_edit', 'get_image', 'get_comments', 'get_project_css', 'set_project_css', 'set_responsive', 'set_state', 'create_instance', 'add_interaction', 'list_projects', 'list_assets', 'insert_asset', 'list_editors', 'select_editor', 'export_site'].every((n) => names.includes(n)) && ['update_layer', 'get_code', 'build_layout', 'insert_icon', 'search_icons', 'list_fonts', 'create_color_styles', 'create_page'].every((n) => names.includes(n)), names.join());
  const mainEditorId = await ev(() => sessionStorage.getItem('stylo.tab'));
  secondEditorContext = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const secondEditor = await secondEditorContext.newPage();
  await secondEditor.goto(url('?editor'));
  await secondEditor.waitForFunction(() => !!window.designer?.store);
  const { editorId: secondEditorId, markerId: secondMarkerId } = await secondEditor.evaluate(async () => {
    const { createNode } = await import('/src/model.js');
    const store = designer.store;
    store.newDoc();
    const marker = createNode('text', { name: 'Documento da segunda pessoa', text: 'Só nesta aba' });
    store.update((page) => page.children.push(marker), { commit: true });
    return { editorId: sessionStorage.getItem('stylo.tab'), markerId: marker.id };
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const editorInventory = await callTool('list_editors', {});
  ok('MCP lista duas abas conectadas com ids distintos', editorInventory.data.editors.length >= 2 && editorInventory.data.editors.some((item) => item.editor_id === mainEditorId) && editorInventory.data.editors.some((item) => item.editor_id === secondEditorId));
  const selectedMain = await callTool('select_editor', { editor_id: mainEditorId });
  const mainDocument = await callTool('get_document', {});
  ok('sessão MCP seleciona a aba humana principal', selectedMain.data.selected_editor === mainEditorId && JSON.stringify(mainDocument.data).includes('Título'));
  const selectedSecond = await callTool('select_editor', { editor_id: secondEditorId });
  const secondDocument = await callTool('get_document', {});
  ok('mesma sessão lê o documento da segunda aba por escolha explícita', selectedSecond.data.selected_editor === secondEditorId && JSON.stringify(secondDocument.data).includes('Documento da segunda pessoa'));
  const mainSessionSelection = await callTool('select_editor', { editor_id: mainEditorId });
  selectedTabAgent = await openAgent('Agente da segunda aba');
  const otherSelection = await callWithSession(selectedTabAgent.sid, 2, 'select_editor', { editor_id: secondEditorId });
  const writeOnMain = callWithSession(mcpSession, 91, 'update_layer', { id: ids.botao, props: { radius: 14 } });
  const writeOnSecond = callWithSession(selectedTabAgent.sid, 3, 'update_layer', { id: secondMarkerId, props: { opacity: 0.65 } });
  await Promise.all([p.waitForSelector('.ask-modal', { timeout: 5000 }), secondEditor.waitForSelector('.ask-modal', { timeout: 5000 })]);
  await Promise.all([
    p.getByRole('button', { name: 'Permitir', exact: true }).click(),
    secondEditor.getByRole('button', { name: 'Permitir', exact: true }).click(),
  ]);
  const [mainWriteResult, secondWriteResult] = await Promise.all([writeOnMain, writeOnSecond]);
  const isolatedWrites = mainSessionSelection.data.selected_editor === mainEditorId && otherSelection.data.selected_editor === secondEditorId && !mainWriteResult.isError && !secondWriteResult.isError && (await ev((id) => designer.store.get(id).radius[0], ids.botao)) === 14 && (await secondEditor.evaluate((id) => designer.store.get(id).opacity, secondMarkerId)) === 0.65;
  await Promise.all([p.keyboard.press('Control+z'), secondEditor.keyboard.press('Control+z')]);
  ok('dois agentes escrevem em abas selecionadas diferentes sem cruzar documentos e cada Ctrl+Z é local', isolatedWrites && (await ev((id) => designer.store.get(id).radius[0], ids.botao)) === 0 && (await secondEditor.evaluate((id) => designer.store.get(id).opacity, secondMarkerId)) === 1);
  await fetch(url('/mcp'), { method: 'DELETE', headers: { 'Mcp-Session-Id': selectedTabAgent.sid } });
  selectedTabAgent = null;
  await callTool('select_editor', { editor_id: secondEditorId });
  const secondPresenceId = await secondEditor.evaluate(() => sessionStorage.getItem('stylo.tab'));
  await secondEditorContext.close();
  await waitForEditorDisconnect(secondPresenceId);
  const disconnectedDocument = await callTool('get_document', {});
  ok('aba escolhida desconectada dá erro em vez de redirecionar para outra', disconnectedDocument.isError && /aba selecionada.*desconectada/i.test(disconnectedDocument.data.error || ''), JSON.stringify(disconnectedDocument));
  await callTool('select_editor', { editor_id: mainEditorId });
  const mainAfterReconnect = await callTool('get_document', {});
  ok('sessão pode escolher explicitamente a aba principal após desconexão', JSON.stringify(mainAfterReconnect.data).includes('Título'));
  secondEditorContext = null;
  const docOut = await callTool('get_document', {});
  ok('get_document lê o projeto aberto (camadas da página)', !docOut.isError && docOut.data.page.layers[0].name === 'Tela' && docOut.data.page.layers[0].children[0].name === 'Card', JSON.stringify(docOut.data).slice(0, 300));
  const code = await callTool('get_code', { id: ids.card });
  ok('get_code devolve o CSS real (flex column, gap 12px)', /flex-direction: column/.test(code.data.css) && /gap: 12px/.test(code.data.css));
  const bad = await callTool('get_layer', { id: 'nao-existe' });
  ok('id inventado volta erro claro para a IA', bad.isError && /não existe/.test(bad.data.error));

  // alteração: a janela de permissão aparece no editor; RECUSAR não muda nada
  let pending = callTool('update_layer', { id: ids.botao, props: { radius: 12 } });
  await p.waitForSelector('.ask-modal');
  const askText = await p.locator('.ask-modal').innerText();
  ok('alteração pede permissão mostrando quem e o quê', askText.includes('Teste MCP quer alterar o design') && askText.includes('Alterar “Botão”: radius'), askText);
  await p.locator('.ask-buttons button', { hasText: 'Recusar' }).click();
  let res = await pending;
  ok('recusar: a IA recebe "recusou" e nada muda', res.data.refused === true && (await ev((id) => designer.store.get(id).radius[0], ids.botao)) === 0);
  // PERMITIR: muda e vira um passo do Ctrl+Z
  pending = callTool('update_layer', { id: ids.botao, props: { radius: 12, fill: '#ff5a5f' } });
  await p.waitForSelector('.ask-modal');
  await p.locator('.ask-buttons button', { hasText: /^Permitir$/ }).click();
  res = await pending;
  const after = await ev((id) => { const n = designer.store.get(id); return { r: n.radius.join(), c: n.fill.color }; }, ids.botao);
  ok('permitir: a camada muda na hora', res.data.ok && after.r === '12,12,12,12' && after.c === '#FF5A5F', JSON.stringify(after));
  await p.keyboard.press('Control+z');
  await p.waitForTimeout(150);
  ok('Ctrl+Z desfaz a alteração da IA inteira', (await ev((id) => designer.store.get(id).radius[0], ids.botao)) === 0);
  // PERMITIR TUDO: as próximas alterações deste programa não perguntam mais
  pending = callTool('update_layer', { id: ids.card, props: { layout: { gap: 24 } } });
  await p.waitForSelector('.ask-modal');
  await p.locator('.ask-buttons button', { hasText: 'Permitir tudo' }).click();
  await pending;
  const created = await callTool('create_layer', { type: 'text', parent_id: ids.card, index: 1, props: { name: 'Subtítulo', text: 'feito pela IA', fontSize: 14 } });
  ok('"permitir tudo nesta sessão": a próxima não pergunta', (await p.locator('.ask-modal').count()) === 0 && created.data.ok);
  const currentCss = await callTool('get_project_css', {});
  const projectCss = `.card { perspective: 600px; }\n.titulo { transform-style: preserve-3d; transform: perspective(800px) rotateY(20deg); animation: entrar 1s ease both; }\n@keyframes entrar { from { opacity: 0 } to { opacity: 1 } }`;
  const cssWrite = await callTool('set_project_css', { css: projectCss });
  const cssAfter = await callTool('get_project_css', {});
  const cssComputed = await ev(({ card, title }) => ({ perspective: getComputedStyle(designer.canvas.els.get(card)).perspective, transformStyle: getComputedStyle(designer.canvas.els.get(title)).transformStyle, animation: getComputedStyle(designer.canvas.els.get(title)).animationName }), { card: ids.card, title: ids.titulo });
  const cssExport = await callTool('export_html', { id: ids.tela });
  ok('agente lê e define CSS global via MCP; canvas e export preservam animação e 3D', !currentCss.isError && currentCss.data.css === '' && cssWrite.data.ok && cssAfter.data.css === projectCss && cssComputed.perspective === '600px' && cssComputed.transformStyle === 'preserve-3d' && cssComputed.animation === 'entrar' && cssExport.data.html.includes('transform-style: preserve-3d') && cssExport.data.html.includes('@keyframes entrar'), JSON.stringify({ current: currentCss.data, computed: cssComputed }));
  await callTool('add_comment', { id: ids.card, text: 'Anotação para revisão MCP' });
  const comments = await callTool('get_comments', { id: ids.card, unresolved_only: true });
  ok('get_comments entrega ao agente a anotação da camada com autor e página', !comments.isError && comments.data.count === 1 && comments.data.comments[0].text === 'Anotação para revisão MCP' && comments.data.comments[0].layer.name === 'Card' && comments.data.comments[0].page.name === 'Página 1');
  // Uma falha de rede durante build_layout não pode restaurar a foto antiga do documento e apagar a edição humana.
  const iconUrl = 'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/home/default/24px.svg';
  let iconStarted;
  let releaseIcon;
  const iconRequestStarted = new Promise((resolve) => { iconStarted = resolve; });
  const holdIcon = new Promise((resolve) => { releaseIcon = resolve; });
  await p.route(iconUrl, async (route) => { iconStarted(); await holdIcon; await route.fulfill({ status: 503, body: 'indisponível' }); });
  await mcp('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Teste concorrência humana', version: '1' } });
  const originalPosition = await ev((id) => { const n = designer.store.get(id); return { x: n.x, y: n.y }; }, ids.tela);
  const failingBuild = callTool('build_layout', { tree: { type: 'frame', props: { name: 'Construção interrompida' }, children: [{ type: 'icon', props: { name: 'home' } }] } });
  await p.waitForSelector('.ask-modal');
  await p.locator('.ask-buttons button', { hasText: /^Permitir$/ }).click();
  await iconRequestStarted;
  await p.locator(`.layer-row[data-id="${ids.tela}"]`).click();
  await p.keyboard.press('ArrowRight');
  const movedPosition = await ev((id) => { const n = designer.store.get(id); return { x: n.x, y: n.y }; }, ids.tela);
  releaseIcon();
  const buildFailure = await failingBuild;
  const positionAfterFailure = await ev((id) => { const n = designer.store.get(id); return { x: n.x, y: n.y }; }, ids.tela);
  ok('build_layout falha claramente quando a rede do ícone responde erro', buildFailure.isError && /Não consegui baixar o ícone/.test(buildFailure.data.error));
  ok('edição pela interface enquanto o MCP aguarda não se perde na falha assíncrona', movedPosition.x !== originalPosition.x && (positionAfterFailure.x === movedPosition.x && positionAfterFailure.y === movedPosition.y) && /mantive o estado atual/.test(buildFailure.data.error), JSON.stringify({ originalPosition, movedPosition, positionAfterFailure, error: buildFailure.data.error }));
  await ev(({ id, pos }) => { const s = designer.store; s.update(() => { const n = s.get(id); n.x = pos.x; n.y = pos.y; }); s.commit(); }, { id: ids.tela, pos: originalPosition });
  await p.unroute(iconUrl);
  await mcp('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Teste MCP', version: '1' } });
  const order = await ev((id) => designer.store.get(id).children.map((c) => c.name).join(), ids.card);
  ok('create_layer entra no flex na posição pedida', order === 'Título,Subtítulo,Botão', order);
  ok('layout.gap mesclado (padding continua)', (await ev((id) => { const L = designer.store.get(id).layout; return `${L.gap}|${L.padding.join()}`; }, ids.card)) === '24|16,16,16,16');
  // ferramentas de criação grande: paleta, estrutura inteira de uma vez, ícones e fontes
  const icons = await callTool('search_icons', { query: 'carrinho', limit: 3 });
  ok('search_icons entende português (carrinho → shopping_cart)', icons.data.icons[0] === 'shopping_cart', JSON.stringify(icons.data));
  const fonts = await callTool('list_fonts', { query: 'fraunces' });
  ok('list_fonts devolve nome e pesos', fonts.data.google[0]?.name === 'Fraunces' && fonts.data.google[0].weights.includes(700), JSON.stringify(fonts.data).slice(0, 200));
  const pal = await callTool('create_color_styles', { colors: [{ name: 'Primária', color: '#b91c1c' }, { name: 'Texto', color: '#111827' }] });
  ok('create_color_styles cria a paleta e devolve os ids', pal.data.created?.length === 2 && pal.data.created[0].color === '#B91C1C');
  const histBefore = await ev(() => designer.store.page().children.length);
  const built = await callTool('build_layout', { tree: { type: 'frame', props: { name: 'Landing teste', w: 1200, fluid: true, layout: { mode: 'column' } }, children: [
    { type: 'frame', props: { name: 'Topo', tag: 'header', sizeX: 'fill', layout: { mode: 'row', justify: 'space-between', align: 'center', padding: [20, 48] } }, children: [
      { type: 'text', props: { text: 'Marca', fontSize: 24, fontWeight: 700, fill: { styleId: pal.data.created[0].id } } },
      { type: 'frame', props: { name: 'Botão', tag: 'button', fill: '#111827', radius: 999, layout: { mode: 'row', padding: [12, 24] } }, children: [{ type: 'text', props: { text: 'Entrar', fill: '#FFFFFF' } }] }] },
    { type: 'frame', props: { name: 'Cards', sizeX: 'fill', layout: { mode: 'grid', cols: 3, colGap: 24, rowGap: 24, padding: 48 } }, children: [1, 2, 3].map((i) => ({ type: 'frame', props: { name: `Card ${i}`, sizeX: 'fill', fill: '#F7F7FA', radius: 16, layout: { mode: 'column', gap: 8, padding: 24 } }, children: [{ type: 'text', props: { text: `Item ${i}`, tag: 'h3', fontSize: 20 } }] })) }] } });
  const landing = await ev(() => { const s = designer.store; const t = s.page().children.find((n) => n.name === 'Landing teste'); const others = s.page().children.filter((n) => n !== t); const right = Math.max(...others.map((n) => n.x + n.w)); const topo = t.children[0], botao = topo.children[1], marca = topo.children[0];
    return { n: t.children.length, cards: t.children[1].children.length, gridCols: t.children[1].layout.cols, botaoSize: `${botao.sizeX}/${botao.sizeY}`, alturaTela: t.sizeY, ladoALado: t.x >= right, estilo: marca.fill.styleId, cor: marca.fill.color, sel: s.ui.selection[0] === t.id }; });
  ok('build_layout monta a estrutura inteira de uma vez (tela nova, sem seleção)', built.data.ok && built.data.count === 12 && landing.n === 2 && landing.cards === 3 && landing.gridCols === 3, JSON.stringify({ count: built.data.count, ...landing }));
  ok('a tela nova nasce AO LADO das existentes, cresce com o conteúdo e frames com layout ficam "hug"', landing.ladoALado && landing.alturaTela === 'hug' && landing.botaoSize === 'hug/hug', JSON.stringify(landing));
  ok('fill {styleId} liga o texto ao estilo de cor (cor vem do estilo)', landing.estilo === pal.data.created[0].id && landing.cor === '#B91C1C');
  await ev(() => designer.store.undo());
  ok('a estrutura inteira sai com UM Ctrl+Z', (await ev(() => designer.store.page().children.length)) === histBefore);
  const badTree = await callTool('build_layout', { tree: { type: 'frame', children: [{ type: 'botao' }] } });
  ok('árvore inválida é recusada antes de criar qualquer coisa', badTree.isError && /type "botao" inválido/.test(badTree.data.error) && (await ev(() => designer.store.page().children.length)) === histBefore);
  const badIcon = await callTool('insert_icon', { name: 'carrinho_de_compras' });
  ok('ícone com nome errado sugere parecidos', badIcon.isError && /não existe/.test(badIcon.data.error));
  // ---- MCP completo: ver a imagem, HTML, responsivo, estados, componentes, protótipo, comentários, páginas
  const img = await mcp('tools/call', { name: 'get_image', arguments: { id: ids.tela } });
  const imgPart = img.body.result.content.find((c) => c.type === 'image');
  ok('get_image: a IA recebe a tela como IMAGEM PNG (conteúdo de imagem do MCP)', imgPart?.mimeType === 'image/png' && Buffer.from(imgPart.data, 'base64').subarray(1, 4).toString() === 'PNG' && !img.body.result.content.at(-1).text.includes('"data"'));
  const html = await callTool('export_html', { id: ids.tela });
  ok('export_html devolve o HTML completo quando cabe no trecho padrão', /^<!doctype html>/.test(html.data.html) && html.data.html.includes('class="card"') && html.data.complete === true);
  const siteMeta = await callTool('export_site', {});
  ok('export_site lista páginas e tamanhos sem inserir HTML grande no contexto', Array.isArray(siteMeta.data.files) && siteMeta.data.files[0]?.path === 'index.html' && Number.isFinite(siteMeta.data.files[0]?.bytes) && !('content' in siteMeta.data.files[0]) && Array.isArray(siteMeta.data.warnings), JSON.stringify({ paths: siteMeta.data.files?.map((f) => f.path), warnings: siteMeta.data.warnings }));
  const sitePage = await callTool('export_site', { includeContent: true, path: 'index.html' });
  ok('export_site entrega uma página quando pedida explicitamente', /^<!doctype html>/i.test(sitePage.data.files?.[0]?.content) && sitePage.data.files.length === 1 && sitePage.data.totalBytes === sitePage.data.files[0].bytes);
  const respBad = await callTool('set_responsive', { id: ids.card, breakpoint: 'mobile', props: { name: 'Outro nome' } });
  ok('set_responsive recusa o que não varia por largura', respBad.isError && /Não varia por largura: name/.test(respBad.data.error));
  const resp = await callTool('set_responsive', { id: ids.card, breakpoint: 'mobile', props: { layout: { gap: 4 } } });
  const cardCss = (await callTool('get_code', { id: ids.card })).data.css;
  ok('set_responsive vira @media só no celular (Desktop igual)', resp.data.ok && /@media \(max-width: 640px\)[\s\S]*gap: 4px/.test(cardCss) && /gap: 24px/.test(cardCss), cardCss.slice(-300));
  const st = await callTool('set_state', { id: ids.botao, state: 'hover', props: { fill: '#991b1b', scale: 1.05 } });
  const btnCss = (await callTool('get_code', { id: ids.botao })).data.css;
  ok('set_state cria o :hover no CSS', st.data.ok && /\.botao:hover \{[\s\S]*#991b1b/i.test(btnCss), btnCss);
  const comp = await callTool('create_component', { id: ids.botao });
  const inst = await callTool('create_instance', { component_id: ids.botao, parent_id: ids.card, props: { name: 'Botão 2' } });
  ok('componente + cópia ligada dentro do card', comp.data.ok && inst.data.created?.instanceOf === ids.botao && (await ev((id) => designer.store.get(id).children.at(-1).name, ids.card)) === 'Botão 2');
  const dup = await callTool('duplicate_layers', { ids: [ids.titulo] });
  ok('duplicate_layers devolve a cópia', dup.data.created?.length === 1 && dup.data.created[0].id !== ids.titulo);
  const inter = await callTool('add_interaction', { id: ids.botao, action: 'navigate', target_id: ids.tela, transition: 'slide-left' });
  ok('add_interaction liga o protótipo', inter.data.interactions?.[0]?.target === ids.tela && inter.data.interactions[0].transition === 'slide-left');
  const cm = await callTool('add_comment', { id: ids.card, text: 'Espaçamento apertado aqui' });
  ok('add_comment deixa o comentário com o nome do programa', cm.data.ok && (await ev(() => designer.store.state.doc.comments.at(-1).author)) === 'Teste MCP');
  const pg = await callTool('create_page', { name: 'Rascunho IA' });
  const del = await callTool('delete_page', { id: pg.data.page.id });
  ok('create_page e delete_page', pg.data.page.name === 'Rascunho IA' && del.data.ok && !(await ev(() => designer.store.state.doc.pages.some((p) => p.name === 'Rascunho IA'))));
  const und = await callTool('undo', {});
  const red = await callTool('redo', {});
  ok('undo e redo', und.data.ok && red.data.ok && !(await ev(() => designer.store.state.doc.pages.some((p) => p.name === 'Rascunho IA'))));
  await ev((id) => designer.store.switchPage(designer.store.state.doc.pages[0].id), null);

  // ---- ACESSO DE ADMINISTRADOR: sem ele, projetos são recusados; com ele, a IA abre/salva e não pergunta
  const noAdmin = await callTool('list_projects', {});
  ok('sem acesso de administrador, ferramentas de projeto são recusadas', noAdmin.isError && /Acesso de administrador/.test(noAdmin.data.error));
  const tmp = await mkdtemp(join(tmpdir(), 'designer-mcp-'));
  const status0 = await (await fetch(url('/api/status'))).json();
  await fetch(url('/api/config'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: tmp }) });
  await ev(() => designer.saving.refresh());
  await fetch(url('/api/agent/mcp'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin: true }) });
  ok('Configurações mostram o acesso de administrador ligado', (await (await fetch(url('/api/agent/config'))).json()).mcpAdmin === true);
  // um programa NOVO (nunca liberado nesta sessão): com administrador, altera sem janela e aparece um aviso
  await mcp('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Claude Code' } });
  const adm = await callTool('update_layer', { id: ids.titulo, props: { text: 'Feito pelo administrador' } });
  await p.waitForTimeout(150);
  ok('administrador: altera sem abrir a janela de permissão', adm.data.ok && (await p.locator('.ask-modal').count()) === 0 && (await ev((id) => designer.store.get(id).text, ids.titulo)) === 'Feito pelo administrador');
  ok('e mostra um aviso do que foi feito', (await p.locator('.toast').innerText().catch(() => '')).includes('Claude Code: Alterar “Título”'));
  const newBlocked = await callTool('new_project', { name: 'X' });
  ok('não troca de projeto se o aberto só existe no navegador', newBlocked.isError && /save_project/.test(newBlocked.data.error));
  const saved = await callTool('save_project', { name: 'site-da-ia' });
  ok('save_project grava na pasta', saved.data.saved === 'site-da-ia.json' && existsSync(join(tmp, 'site-da-ia.json')));
  const projList = await callTool('list_projects', {});
  ok('list_projects mostra o arquivo e qual está aberto', projList.data.open === 'site-da-ia.json' && projList.data.projects.some((x) => x.file === 'site-da-ia.json'));
  const nova = await callTool('new_project', { name: 'Projeto novo da IA' });
  ok('new_project começa em branco (o anterior está salvo na pasta)', nova.data.project === 'Projeto novo da IA' && (await ev(() => designer.store.page().children.length)) === 0);
  const back = await callTool('open_project', { file: 'site-da-ia.json' });
  ok('open_project abre o projeto da pasta', back.data.ok && (await ev(() => designer.store.ui.link?.file)) === 'site-da-ia.json' && (await ev((id) => !!designer.store.get(id), ids.titulo)));
  await fetch(url('/api/agent/mcp'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin: false }) });
  await fetch(url('/api/config'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: status0.folder }) });
  await ev(() => { designer.store.setLink(null); return designer.saving.refresh(); });
  await rm(tmp, { recursive: true, force: true });
  await mcp('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Teste MCP' } });

  const wrong = await callTool('update_layer', { id: ids.card, props: { corDeFundo: 'azul' } });
  ok('propriedade desconhecida é recusada com a lista das aceitas', wrong.isError && /desconhecida: corDeFundo/.test(wrong.data.error));
  const evil = await mcp('tools/list', {}, { Origin: 'https://site-malicioso.com' });
  ok('MCP recusa pedido vindo de outro site (Origin)', evil.status === 403);

  // ---------------------------------------------------------------- 3. MCP pelo terminal (stdio)
  const script = fileURLToPath(new URL('../../scripts/mcp.mjs', import.meta.url));
  const child = spawn(process.execPath, [script], { env: { ...process.env, DESIGNER_URL: new URL(BASE).origin } });
  const lines = [];
  let buf = '';
  child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { lines.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'Codex' } } })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'find_layers', arguments: { query: 'subtítulo' } } })}\n`);
  for (let t = 0; t < 50 && lines.length < 2; t++) await new Promise((r) => setTimeout(r, 100));
  const sInit = lines.find((l) => l.id === 1), sFind = lines.find((l) => l.id === 2);
  ok('stdio: initialize responde (versão de protocolo do cliente)', sInit?.result?.protocolVersion === '2024-11-05', JSON.stringify(lines));
  ok('stdio: aviso não gera resposta e a ferramenta funciona', lines.length === 2 && JSON.parse(sFind.result.content[0].text).layers[0].name === 'Subtítulo');
  child.stdin.end();
  await new Promise((resolve) => child.once('close', resolve));
  const afterStdioClose = await (await fetch(url('/api/presence'))).json();
  ok('stdio envia DELETE ao fechar e remove sua sessão da presença', !afterStdioClose.agents.some((a) => a.name === 'Codex'));
  const parallel = spawn(process.execPath, [script], { env: { ...process.env, DESIGNER_URL: new URL(BASE).origin, STYLO_AGENT: 'stdio paralelo' } });
  const parallelLines = new Map();
  let parallelBuf = '';
  parallel.stdout.on('data', (d) => { parallelBuf += d; let i; while ((i = parallelBuf.indexOf('\n')) >= 0) { const item = JSON.parse(parallelBuf.slice(0, i)); parallelBuf = parallelBuf.slice(i + 1); if (item.id != null) parallelLines.set(item.id, item); } });
  const waitLine = async (id, ms = 5000) => { for (let t = 0; t < ms / 50 && !parallelLines.has(id); t++) await new Promise((r) => setTimeout(r, 50)); return parallelLines.get(id); };
  parallel.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 11, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'Codex paralelo' } } })}\n`);
  await waitLine(11);
  parallel.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name: 'update_layer', arguments: { id: ids.botao, props: { radius: 11 } } } })}\n`);
  await p.waitForSelector('.ask-modal');
  parallel.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 13, method: 'tools/call', params: { name: 'get_document', arguments: {} } })}\n`);
  const fastRead = await waitLine(13, 2000);
  ok('stdio responde uma leitura rápida enquanto outra escrita aguarda permissão', fastRead?.id === 13 && !parallelLines.has(12), JSON.stringify([...parallelLines.keys()]));
  await p.locator('.ask-buttons button', { hasText: 'Recusar' }).click();
  await waitLine(12);
  parallel.stdin.end();
  await new Promise((resolve) => parallel.once('close', resolve));

  // ---------------------------------------------------------------- 4. segurança da chave
  await fetch(url('/api/agent/config'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: 'sk-teste-segredo-123' }) });
  const pub = await (await fetch(url('/api/agent/config'))).text();
  const status = await (await fetch(url('/api/status'))).text();
  ok('a chave salva nunca volta (nem na config do agente, nem no status)', !pub.includes('sk-teste') && !status.includes('sk-teste') && JSON.parse(pub).hasKey === true);
  await fetch(url('/api/agent/config'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: '' }) });
  // provedores: cada um guarda a sua chave (trocar de OpenAI para NVIDIA e voltar não apaga nada)
  const put = (body) => fetch(url('/api/agent/config'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
  const getCfg = () => fetch(url('/api/agent/config')).then((r) => r.json());
  await put({ baseUrl: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.3-70b-instruct' });
  let cfg = await getCfg();
  ok('NVIDIA NIM: provedor reconhecido e pede chave', cfg.provider === 'nvidia' && cfg.needsKey === true && cfg.model === 'meta/llama-3.3-70b-instruct', JSON.stringify(cfg));
  await put({ apiKey: 'nvapi-teste-123' });
  cfg = await getCfg();
  ok('chave da NVIDIA salva (e não devolvida)', cfg.hasKey && !JSON.stringify(cfg).includes('nvapi-teste'));
  await put({ baseUrl: 'https://api.openai.com/v1' });
  ok('na OpenAI a chave da NVIDIA não vale', (await getCfg()).hasKey === false);
  await put({ baseUrl: 'https://integrate.api.nvidia.com/v1' });
  ok('voltando para a NVIDIA, a chave dela continua lá', (await getCfg()).hasKey === true);
  await put({ apiKey: '' });
  ok('as instruções do agente vêm de docs/AGENTE.md', /docs[\\/]AGENTE\.md$/.test(cfg.instructions || ''), cfg.instructions);

  // ---------------------------------------------------------------- 5. Assistente com uma "OpenAI de mentira"
  const seen = [];
  const modelsAuth = [];
  mock = createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    if (req.url === '/v1/models') {
      modelsAuth.push(req.headers.authorization || '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: [{ id: 'nvidia/modelo-b' }, { id: 'meta/modelo-a' }] }));
    }
    const data = JSON.parse(body);
    seen.push({ path: req.url, auth: req.headers.authorization || '', data });
    const last = data.messages[data.messages.length - 1];
    // 1ª rodada: pede para ler a seleção e alterar o botão; 2ª: responde em texto
    const msg = last.role === 'user'
      ? { role: 'assistant', content: null, tool_calls: [
        { id: 'c1', type: 'function', function: { name: 'get_selection', arguments: '{}' } },
        // alguns servidores compatíveis (NIM, Ollama) mandam os argumentos já como objeto, não como texto
        { id: 'c2', type: 'function', function: { name: 'update_layer', arguments: { id: ids.botao, props: { radius: 8 } } } },
      ] }
      : { role: 'assistant', content: '<think>raciocínio interno que a pessoa não precisa ver</think>Pronto: deixei o botão com `border-radius: 8px`.' };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: msg }], usage: { total_tokens: 10 } }));
  });
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));
  const mockUrl = `http://127.0.0.1:${mock.address().port}/v1`;
  await fetch(url('/api/agent/config'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: mockUrl, model: 'modelo-teste' }) });
  const listed = await (await fetch(url('/api/agent/models'))).json();
  ok('"Ver modelos" lista os modelos da conta (em ordem)', listed.models?.join() === 'meta/modelo-a,nvidia/modelo-b', JSON.stringify(listed));
  // na TELA, como uma pessoa faz: cola a chave e clica "Ver modelos" SEM clicar em Salvar antes; escolhe na lista
  await p.keyboard.press('Control+,');
  await p.waitForSelector('.settings-page [aria-label="Chave da API"]', { state: 'attached' });
  await p.click('.sp-nav-item[data-section="keys"]');
  await p.fill('[aria-label="Chave da API"]', 'chave-da-tela-123');
  await p.click('.sp-nav-item[data-section="ai"]');
  await p.locator('button', { hasText: 'Ver modelos' }).click();
  await p.waitForSelector('.model-item');
  ok('"Ver modelos" salva a chave digitada e mostra a lista (sem precisar de Salvar)', (await p.locator('.model-item').count()) === 2 && modelsAuth.at(-1) === 'Bearer chave-da-tela-123', `${await p.locator('.model-item').count()} itens, auth ${modelsAuth.at(-1)}`);
  await p.fill('[aria-label="Buscar modelo"]', 'nvidia');
  ok('a busca filtra a lista (sem texto "null" sobrando)', (await p.locator('.model-item').count()) === 1 && !(await p.locator('.model-list').innerText()).includes('null'));
  await p.locator('.model-item', { hasText: 'nvidia/modelo-b' }).click();
  await p.waitForFunction(() => /Modelo escolhido/.test(document.querySelector('#settings-ai .set-msg')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
  ok('clicar escolhe e salva o modelo', (await (await fetch(url('/api/agent/config'))).json()).model === 'nvidia/modelo-b' && (await p.inputValue('[aria-label="Modelo"]')) === 'nvidia/modelo-b');
  await p.focus('[aria-label="Buscar modelo"]');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  ok('Esc na busca de modelos fecha a página de Configurações', (await p.locator('.settings-page').count()) === 0);
  await fetch(url('/api/agent/config'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: '', model: 'modelo-teste' }) });
  await ev((id) => designer.store.setSelection([id]), ids.botao);
  await p.click('.ai-btn');
  await p.waitForSelector('.ai-panel:not([hidden])');
  ok('botão Assistente abre o painel com o modelo configurado', (await p.locator('.ai-model').innerText()) === 'modelo-teste');
  await p.fill('.ai-input', 'arredonda os cantos deste botão');
  await p.keyboard.press('Enter');
  await p.waitForSelector('.ask-modal');
  ok('alteração do Assistente também pede permissão', (await p.locator('.ask-modal').innerText()).includes('Assistente quer alterar o design'));
  await p.locator('.ask-buttons button', { hasText: /^Permitir$/ }).click();
  await p.waitForSelector('.ai-msg.bot');
  const logText = await p.locator('.ai-log').innerText();
  ok('conversa mostra os passos e a resposta', logText.includes('✓ Leu a seleção') && logText.includes('✓ Alterou “Botão”: radius') && logText.includes('Pronto: deixei o botão'), logText);
  ok('o raciocínio <think> do modelo não aparece', !logText.includes('raciocínio interno'));
  ok('o botão mudou', (await ev((id) => designer.store.get(id).radius[0], ids.botao)) === 8);
  const first = seen[0];
  ok('a API recebe modelo, ferramentas e o contexto da seleção', first.path === '/v1/chat/completions' && first.data.model === 'modelo-teste' && first.data.tools.length === 42 && first.data.tools.some((t) => t.function.name === 'list_assets') && first.data.tools.some((t) => t.function.name === 'insert_asset') && first.data.tools.some((t) => t.function.name === 'get_comments') && first.data.tools.some((t) => t.function.name === 'get_project_css') && first.data.tools.some((t) => t.function.name === 'set_project_css') && first.data.tools.some((t) => t.function.name === 'edit_image') && !first.data.tools.some((t) => t.function.name === 'generate_image_edit') && first.data.tools.some((t) => t.function.name === 'remember') && first.data.tools.some((t) => t.function.name === 'delegate_task') && !first.data.tools.some((t) => t.function.name.startsWith('jev_')) && first.data.messages[0].role === 'system' && /seleção: “Botão”/.test(first.data.messages[1].content));
  ok('a mensagem de sistema é o docs/AGENTE.md (quem a IA é e como trabalha)', /Assistente do Stylo/.test(first.data.messages[0].content) && /get_document/.test(first.data.messages[0].content));
  ok('a 2ª rodada devolve os resultados das ferramentas à IA', seen[1]?.data.messages.filter((m) => m.role === 'tool').length === 2);
  ok('sem chave configurada, nada de Authorization (servidor local tipo Ollama)', first.auth === '');
  ok('o "contexto" não aparece na conversa da pessoa', !logText.includes('[Contexto do editor'));
  ok('o contexto leva as telas da página (para criar sem seleção)', /telas na página: “Tela”/.test(first.data.messages[1].content));
  // FAZER SEM PERGUNTAR: liga a opção; a próxima alteração vale direto (e sai com Ctrl+Z)
  await p.locator('.ai-auto input').check();
  await ev((id) => designer.store.update(() => { designer.store.get(id).radius = [0, 0, 0, 0]; }, { commit: true }), ids.botao);
  await p.fill('.ai-input', 'arredonda de novo');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => document.querySelectorAll('.ai-msg.bot').length >= 2, null, { timeout: 10000 });
  ok('"Fazer sem perguntar": altera sem abrir a janela de permissão', (await p.locator('.ask-modal').count()) === 0 && (await ev((id) => designer.store.get(id).radius[0], ids.botao)) === 8);
  ok('a opção fica lembrada nas preferências', (await ev(() => JSON.parse(localStorage.getItem('projeto-designer:prefs') || '{}').agentAuto)) === true);
  await p.locator('.ai-auto input').uncheck();

  // A confirmação do editor pode se perder numa falha transitória de rede. A ponte precisa reenviar a mesma
  // resposta até o servidor confirmar, para liberar a chamada MCP e a trava sem fechar a aba.
  const replyPage = await p.context().newPage();
  await replyPage.goto(url('?editor'));
  await replyPage.waitForFunction(() => !!window.designer?.store);
  const replyTarget = await replyPage.evaluate(async () => {
    const { createNode } = await import('/src/model.js');
    const store = designer.store;
    store.newDoc();
    const target = createNode('rect', { name: 'Alvo com resposta recuperável', x: 20, y: 20, w: 90, h: 60 });
    store.update((pg) => pg.children.push(target), { commit: true });
    return target.id;
  });
  let replyAttempts = 0;
  let replyId = '';
  await replyPage.route('**/api/agent/reply', (route) => {
    replyAttempts++;
    replyId = String(route.request().postDataJSON()?.id || replyId);
    return replyAttempts === 1 ? route.abort() : route.continue();
  });
  const replyAgent = await openAgent('Resposta perdida');
  const lostReplyWrite = fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': replyAgent.sid }, body: JSON.stringify({ jsonrpc: '2.0', id: 71, method: 'tools/call', params: { name: 'update_layer', arguments: { id: replyTarget, props: { radius: 17 } } } }) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  await replyPage.waitForSelector('.ask-modal', { timeout: 5000 });
  await replyPage.getByRole('button', { name: 'Permitir', exact: true }).click();
  let recoveredReply = await Promise.race([lostReplyWrite.then((value) => ({ done: true, value })), new Promise((resolve) => setTimeout(() => resolve({ done: false }), 2500))]);
  ok('resposta MCP perdida é reenviada até o servidor confirmar', recoveredReply.done && replyAttempts >= 2 && recoveredReply.value.body.result?.isError !== true && (await replyPage.evaluate((id) => designer.store.get(id).radius[0], replyTarget)) === 17, JSON.stringify({ replyAttempts, done: recoveredReply.done }));
  if (!recoveredReply.done) {
    // Em caso de regressão, fechar a aba encerra a chamada pendente e evita contaminar os checks seguintes.
    await replyPage.close();
    recoveredReply = { done: true, value: await lostReplyWrite };
  } else {
    await replyPage.unroute('**/api/agent/reply');
    const duplicateReplyStatus = await replyPage.evaluate(async (id) => (await fetch('/api/agent/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, result: {} }) })).status, replyId);
    ok('resposta duplicada recebe status terminal sem alterar outra chamada', duplicateReplyStatus === 410, String(duplicateReplyStatus));
    await replyPage.close();
    await lostReplyWrite;
  }
  await fetch(url('/mcp'), { method: 'DELETE', headers: { 'Mcp-Session-Id': replyAgent.sid } });

  await mcp('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Cliente aguardando', version: '1' } });
  const waitingForEditor = mcp('tools/call', { name: 'update_layer', arguments: { id: ids.botao, props: { radius: 10 } } });
  await p.waitForSelector('.ask-modal');
  await p.close();
  const closedEditor = await waitingForEditor;
  const closeText = closedEditor.body?.result?.content?.[0]?.text || '';
  ok('MCP encerra a chamada pendente quando o editor fecha', closedEditor.status === 200 && closedEditor.body?.result?.isError && /editor foi fechado durante a chamada/.test(closeText), closeText);
  const finalSession = mcpSession;
  const terminated = await fetch(url('/mcp'), { method: 'DELETE', headers: { 'Mcp-Session-Id': finalSession } });
  const finalPresence = await (await fetch(url('/api/presence'))).json();
  ok('encerrar o cliente de teste limpa sua presença no editor', terminated.status === 204 && !finalPresence.agents.some((a) => a.id === finalSession));
  mcpSession = '';
} catch (err) {
  ok('cenário terminou sem exceção', false, err.stack);
} finally {
  if (selectedTabAgent) await fetch(url('/mcp'), { method: 'DELETE', headers: { 'Mcp-Session-Id': selectedTabAgent.sid } }).catch(() => {});
  if (secondEditorContext) await secondEditorContext.close().catch(() => {});
  if (mcpSession) await fetch(url('/mcp'), { method: 'DELETE', headers: { 'Mcp-Session-Id': mcpSession } }).catch(() => {});
  await fetch(url('/api/agent/config'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: original.baseUrl === 'https://api.openai.com/v1' ? '' : original.baseUrl, model: original.model === 'gpt-4.1-mini' ? '' : original.model }) }).catch(() => {});
  mock?.close();
  await b.close();
}
console.log(errors.join('\n') || 'sem erros no console');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exitCode = fails || errors.length ? 1 : 0;
