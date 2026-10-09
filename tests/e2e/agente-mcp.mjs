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
  ok('tools/list traz as 35 ferramentas (com edit_image e generate_image_edit)', names.length === 35 && ['edit_image', 'generate_image_edit', 'get_image', 'set_responsive', 'set_state', 'create_instance', 'add_interaction', 'list_projects'].every((n) => names.includes(n)) && ['update_layer', 'get_code', 'build_layout', 'insert_icon', 'search_icons', 'list_fonts', 'create_color_styles', 'create_page'].every((n) => names.includes(n)), names.join());
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
  ok('export_html devolve o arquivo HTML completo', /^<!doctype html>/.test(html.data.html) && html.data.html.includes('class="card"'));
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
  ok('a API recebe modelo, ferramentas e o contexto da seleção', first.path === '/v1/chat/completions' && first.data.model === 'modelo-teste' && first.data.tools.length === 36 && first.data.tools.some((t) => t.function.name === 'edit_image') && !first.data.tools.some((t) => t.function.name === 'generate_image_edit') && first.data.tools.some((t) => t.function.name === 'remember') && first.data.tools.some((t) => t.function.name === 'delegate_task') && !first.data.tools.some((t) => t.function.name.startsWith('jev_')) && first.data.messages[0].role === 'system' && /seleção: “Botão”/.test(first.data.messages[1].content));
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
