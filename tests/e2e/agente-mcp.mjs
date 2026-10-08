// IA no editor: inspetor (F12), MCP pelo endereço HTTP e pelo terminal (stdio), janela de permissão, Ctrl+Z e o
// Assistente interno conversando com uma "OpenAI de mentira" (um servidor falso criado aqui, que responde no mesmo
// formato da API real) — assim o teste não gasta crédito nem precisa de chave. Também confere que a chave da API
// nunca sai do servidor. Devolve a configuração original do assistente no fim.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
/** Uma chamada JSON-RPC ao MCP por HTTP (como o Claude Code faz). */
let rpcId = 0;
const mcp = async (method, params = {}, headers = {}) => {
  const r = await fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }) });
  return { status: r.status, body: r.status === 200 ? await r.json() : null };
};
/** Resultado de uma ferramenta chamada pelo MCP (o texto JSON vira objeto). */
const callTool = async (name, args) => {
  const { body } = await mcp('tools/call', { name, arguments: args });
  return { isError: body.result.isError, data: JSON.parse(body.result.content[0].text) };
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
  const note = await fetch(url('/mcp'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
  ok('aviso (notification) recebe 202 sem corpo', note.status === 202);
  const list = await mcp('tools/list');
  const names = list.body.result.tools.map((t) => t.name);
  ok('tools/list traz as 11 ferramentas', names.length === 11 && names.includes('update_layer') && names.includes('get_code'), names.join());
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
  const order = await ev((id) => designer.store.get(id).children.map((c) => c.name).join(), ids.card);
  ok('create_layer entra no flex na posição pedida', order === 'Título,Subtítulo,Botão', order);
  ok('layout.gap mesclado (padding continua)', (await ev((id) => { const L = designer.store.get(id).layout; return `${L.gap}|${L.padding.join()}`; }, ids.card)) === '24|16,16,16,16');
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
  child.kill();
  const sInit = lines.find((l) => l.id === 1), sFind = lines.find((l) => l.id === 2);
  ok('stdio: initialize responde (versão de protocolo do cliente)', sInit?.result?.protocolVersion === '2024-11-05', JSON.stringify(lines));
  ok('stdio: aviso não gera resposta e a ferramenta funciona', lines.length === 2 && JSON.parse(sFind.result.content[0].text).layers[0].name === 'Subtítulo');

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
  mock = createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    if (req.url === '/v1/models') {
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
  ok('a API recebe modelo, ferramentas e o contexto da seleção', first.path === '/v1/chat/completions' && first.data.model === 'modelo-teste' && first.data.tools.length === 11 && first.data.messages[0].role === 'system' && /seleção: “Botão”/.test(first.data.messages[1].content));
  ok('a mensagem de sistema é o docs/AGENTE.md (quem a IA é e como trabalha)', /Assistente do Projeto Designer/.test(first.data.messages[0].content) && /get_document/.test(first.data.messages[0].content));
  ok('a 2ª rodada devolve os resultados das ferramentas à IA', seen[1]?.data.messages.filter((m) => m.role === 'tool').length === 2);
  ok('sem chave configurada, nada de Authorization (servidor local tipo Ollama)', first.auth === '');
  ok('o "contexto" não aparece na conversa da pessoa', !logText.includes('[Contexto do editor'));
} catch (err) {
  ok('cenário terminou sem exceção', false, err.stack);
} finally {
  await fetch(url('/api/agent/config'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: original.baseUrl === 'https://api.openai.com/v1' ? '' : original.baseUrl, model: original.model === 'gpt-4.1-mini' ? '' : original.model }) }).catch(() => {});
  mock?.close();
  await b.close();
}
console.log(errors.join('\n') || 'sem erros no console');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exitCode = fails || errors.length ? 1 : 0;
