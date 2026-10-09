// Agente, fase 2: resposta em tempo real (streaming), bloco "Pensando…", tempo limite, botão Parar que aborta no
// servidor, subagentes (delegate_task com 2 em paralelo, escopo e Ctrl+Z), Jev (com um servidor falso do Jev) e
// "Testar modelo" nas Configurações. Tudo contra uma "OpenAI de mentira" que responde em SSE como a API real: o
// teste não gasta crédito nem precisa de chave. Devolve a configuração original no fim.
// Capturas (1440×900) em capturas/ quando CAPTURAS=1 (ou sempre, se a pasta existir).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.APP_URL || 'http://localhost:5173/';
const SHOTS = fileURLToPath(new URL('../../capturas/', import.meta.url));
const shoot = process.env.CAPTURAS === '1' || existsSync(SHOTS);
if (process.env.CAPTURAS === '1') mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + x)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = (path) => new URL(path, BASE).href;
const put = (body) => fetch(url('/api/agent/config'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
const getCfg = () => fetch(url('/api/agent/config')).then((r) => r.json());

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
p.on('dialog', (d) => { errors.push('diálogo nativo: ' + d.message()); d.dismiss(); });
const ev = (f, a) => p.evaluate(f, a);
const snap = async (name) => { if (shoot) await p.screenshot({ path: `${SHOTS}${name}.png` }); };

// ---------------------------------------------------------------- "OpenAI de mentira" (SSE)
const original = await getCfg();
let ids = {};
const seen = []; // pedidos de chat recebidos
let subInflight = 0, subPeak = 0;
let stopClosed = 0; // quando a conexão do "demora" foi fechada (Parar → servidor aborta)
let lentoClosed = 0;
const sseHead = (res) => res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
const w = (res, delta, extra = {}) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta, ...extra }] })}\n\n`); };
const done = (res) => { if (!res.writableEnded) res.end('data: [DONE]\n\n'); };
const toolCall = (res, calls) => {
  calls.forEach((c, i) => {
    const args = JSON.stringify(c.args);
    // nome no 1º pedaço, argumentos picados em dois (como a API real)
    w(res, { tool_calls: [{ index: i, id: `c${Date.now()}${i}`, type: 'function', function: { name: c.name, arguments: args.slice(0, 5) } }] });
    w(res, { tool_calls: [{ index: i, function: { arguments: args.slice(5) } }] });
  });
  w(res, {}, { finish_reason: 'tool_calls' });
  done(res);
};
const text = async (res, parts, gap = 0) => { for (const t of parts) { w(res, { content: t }); if (gap) await sleep(gap); } w(res, {}, { finish_reason: 'stop' }); done(res); };

const mock = createServer(async (req, res) => {
  let body = '';
  for await (const c of req) body += c;
  if (req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: [{ id: 'modelo-stream' }, { id: 'modelo-sem-ferramentas' }, { id: 'outro-modelo' }] }));
  }
  const data = JSON.parse(body);
  seen.push({ at: Date.now(), data });
  const sys = data.messages[0]?.content || '';
  const tools = (data.tools || []).map((t) => t.function.name);
  // "Testar modelo"
  if (tools.includes('ping')) {
    if (/sem-ferramentas/.test(data.model)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: '"auto" tool choice requires --enable-auto-tool-choice and --tool-call-parser to be set' } }));
    }
    sseHead(res);
    w(res, { reasoning_content: 'vou chamar ping' });
    await sleep(150);
    return toolCall(res, [{ name: 'ping', args: { ok: true } }]);
  }
  const toolMsgs = data.messages.filter((m) => m.role === 'tool').length;
  // SUBAGENTES
  if (/Você é um SUBAGENTE/.test(sys)) {
    const brief = data.messages[1]?.content || '';
    const who = /“Cabeçalho”/.test(brief) ? 'cab' : 'rod';
    subInflight++; subPeak = Math.max(subPeak, subInflight);
    try {
      sseHead(res);
      if (toolMsgs === 0) {
        w(res, { reasoning_content: `Planejando a parte do ${who === 'cab' ? 'cabeçalho' : 'rodapé'}…` });
        await sleep(1500);
        return toolCall(res, who === 'cab'
          ? [{ name: 'update_layer', args: { id: ids.cab, props: { fill: '#E11D48' } } }]
          // o rodapé tenta mexer no cabeçalho (fora do escopo dele) e depois faz a parte dele
          : [{ name: 'update_layer', args: { id: ids.cab, props: { fill: '#000000' } } }, { name: 'update_layer', args: { id: ids.rod, props: { fill: '#16A34A' } } }]);
      }
      await sleep(400);
      return text(res, [who === 'cab' ? 'Pintei o cabeçalho de vermelho.' : 'Pintei o rodapé de verde (o cabeçalho é de outro subagente).']);
    } finally { subInflight--; }
  }
  // AGENTE PRINCIPAL: decide pela última mensagem da pessoa
  const lastUser = [...data.messages].reverse().find((m) => m.role === 'user')?.content || '';
  sseHead(res);
  if (/^oi stream/.test(lastUser)) {
    for (const t of ['Hmm, a pessoa ', 'quer um oi. ', 'Vou responder ', 'com calma ', 'e em português.']) { w(res, { reasoning_content: t }); await sleep(450); }
    return text(res, ['Olá! ', 'Estou ', 'respondendo ', 'em tempo ', 'real.'], 450);
  }
  if (/^fica lento/.test(lastUser)) { res.on('close', () => { lentoClosed = Date.now(); }); return; } // nunca responde
  if (/^demora/.test(lastUser)) {
    res.on('close', () => { stopClosed = Date.now(); });
    for (let i = 0; i < 200 && !res.destroyed; i++) { w(res, { reasoning_content: `passo ${i} ` }); await sleep(250); }
    return done(res);
  }
  if (/^divide/.test(lastUser)) {
    if (!toolMsgs) return toolCall(res, [{ name: 'delegate_task', args: { tasks: [
      { name: 'Cabeçalho', task: 'Pinte o fundo do cabeçalho de vermelho.', scope: [ids.cab] },
      { name: 'Rodapé', task: 'Pinte o fundo do rodapé de verde.', scope: [ids.rod] },
    ] } }]);
    return text(res, ['Pronto: os dois subagentes terminaram (cabeçalho vermelho e rodapé verde).']);
  }
  if (/^usa o jev/.test(lastUser)) {
    if (!toolMsgs) return toolCall(res, [{ name: 'jev_choose', args: { context: 'Site de pizzaria', question: 'Qual paleta combina?', options: [{ id: 'quente', description: 'vermelho tomate e creme' }, { id: 'fria', description: 'azul e cinza' }] } }]);
    return text(res, ['O Jev escolheu a paleta quente.']);
  }
  return text(res, ['ok']);
});
await new Promise((r) => mock.listen(0, '127.0.0.1', r));
const mockUrl = `http://127.0.0.1:${mock.address().port}/v1`;

// ---------------------------------------------------------------- Jev de mentira
const jevSeen = [];
const jev = createServer(async (req, res) => {
  let body = '';
  for await (const c of req) body += c;
  jevSeen.push({ auth: req.headers.authorization || '', data: JSON.parse(body) });
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ model: 'jev-teste', answers: {
    pass_a: { type: 'choice', choice: 'quente', probabilities: { quente: 0.91, fria: 0.07, none_of_the_above: 0.02 } },
    pass_b: { type: 'choice', choice: 'quente', probabilities: { quente: 0.93, fria: 0.05, none_of_the_above: 0.02 } },
  }, usage: { input_tokens: 40 } }));
});
await new Promise((r) => jev.listen(0, '127.0.0.1', r));
const jevUrl = `http://127.0.0.1:${jev.address().port}/v1/systemone`;

try {
  await put({ baseUrl: mockUrl, model: 'modelo-stream', firstTokenSec: 5, maxThinkSec: 60, jevKey: '' });
  await p.goto(url('?editor'));
  await p.waitForTimeout(900);
  ids = await ev(async () => {
    const { createNode, defaultFill } = await import('/src/model.js');
    const s = designer.store;
    s.newDoc();
    const tela = createNode('frame', { name: 'Tela', x: 0, y: 0, w: 800, h: 500, fill: { ...defaultFill('#FFFFFF') } });
    tela.layout = { ...tela.layout, mode: 'column', gap: 0 };
    const cab = createNode('frame', { name: 'Cabeçalho', w: 800, h: 80, fill: { ...defaultFill('#F3F4F6') } });
    const meio = createNode('frame', { name: 'Conteúdo', w: 800, h: 340, fill: { ...defaultFill('#FFFFFF') } });
    const rod = createNode('frame', { name: 'Rodapé', w: 800, h: 80, fill: { ...defaultFill('#E5E7EB') } });
    tela.children.push(cab, meio, rod);
    s.update((pg) => pg.children.push(tela), { commit: true });
    designer.canvas.fit([tela.id], { padding: 80, maxZoom: 1 });
    return { tela: tela.id, cab: cab.id, rod: rod.id };
  });
  const fillOf = (id) => ev((i) => JSON.stringify(designer.store.get(i).fill), id);
  await p.click('.ai-btn');
  await p.waitForSelector('.ai-panel:not([hidden])');
  await p.locator('.ai-auto input').check(); // subagentes em paralelo: sem janela de permissão (Ctrl+Z continua valendo)
  await p.locator('.ai-panel [aria-label="Nova conversa"]').click();

  // ---------------------------------------------------------------- 1. streaming + raciocínio
  await p.fill('.ai-input', 'oi stream');
  await p.keyboard.press('Enter');
  await p.waitForSelector('.ai-think.live');
  await p.waitForTimeout(1100);
  const liveLabel = await p.locator('.ai-think.live .ai-think-label').innerText();
  ok('raciocínio aparece ao vivo num bloco "Pensando…" com o tempo', /^Pensando… \d+ s$/.test(liveLabel), liveLabel);
  ok('o bloco de raciocínio fica aberto enquanto pensa e mostra o texto', (await p.locator('.ai-think.live').getAttribute('open')) !== null && /a pessoa/.test(await p.locator('.ai-think-body').innerText()));
  await snap('agente-pensando');
  await p.waitForSelector('.ai-msg.bot.streaming');
  await p.waitForTimeout(500);
  const partial = await p.locator('.ai-msg.bot.streaming').innerText();
  ok('o texto aparece enquanto chega (antes de terminar)', partial.length > 0 && !partial.includes('real.'), partial);
  ok('a interface não trava: dá para digitar enquanto o modelo responde', await (async () => { await p.fill('.ai-input', 'rascunho'); const v = await p.inputValue('.ai-input'); await p.fill('.ai-input', ''); return v === 'rascunho'; })());
  await snap('agente-streaming');
  await p.waitForSelector('.ai-thinking', { state: 'detached', timeout: 15000 });
  const bubble = (await p.locator('.ai-msg.bot').last().innerText()).trim();
  ok('resposta final completa, sem o raciocínio dentro', bubble === 'Olá! Estou respondendo em tempo real.', bubble);
  const doneLabel = await p.locator('.ai-think .ai-think-label').last().innerText();
  ok('ao responder, o bloco vira "Pensou por N s" e recolhe', /^Pensou por \d+ s$/.test(doneLabel) && (await p.locator('.ai-think').last().getAttribute('open')) === null, doneLabel);
  const firstReq = seen.find((s) => s.data.messages.some((m) => m.role === 'user' && /^oi stream/.test(m.content)));
  ok('o servidor pede streaming à API (stream: true)', firstReq?.data.stream === true);
  ok('sem chave do Jev, as ferramentas do Jev não vão para o modelo', !firstReq.data.tools.some((t) => t.function.name.startsWith('jev_')) && firstReq.data.tools.some((t) => t.function.name === 'delegate_task'));
  // recarregar a conversa mantém o raciocínio recolhido
  await p.locator('.ai-panel [aria-label="Fechar agente"]').click();
  await p.click('.ai-btn');
  ok('reabrir a conversa mostra o raciocínio guardado (recolhido) e a resposta', (await p.locator('.ai-think').count()) === 1 && /Pensou por/.test(await p.locator('.ai-think-label').innerText()));
  await snap('agente-resposta');

  // ---------------------------------------------------------------- 2. tempo limite (sem 1º pedaço)
  const t0 = Date.now();
  await p.fill('.ai-input', 'fica lento');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(2200);
  ok('enquanto espera, mostra "Esperando o modelo… N s"', /Esperando o modelo… \d+ s/.test(await p.locator('.ai-thinking').innerText()));
  await p.waitForSelector('.ai-error', { timeout: 15000 });
  const tErr = await p.locator('.ai-error').last().innerText();
  ok('sem 1º pedaço no tempo configurado → erro claro com sugestão', /não começou a responder em 5 s/.test(tErr) && /Tente de novo/.test(tErr) && /Esperar o 1º pedaço/.test(tErr), tErr);
  ok('o erro chega no tempo (≈5 s), sem travar', Date.now() - t0 < 12000, `${Date.now() - t0} ms`);
  await p.waitForTimeout(300);
  ok('no tempo limite o servidor fecha o pedido à API', lentoClosed > 0);

  // ---------------------------------------------------------------- 3. Parar aborta no servidor
  await p.fill('.ai-input', 'demora bastante');
  await p.keyboard.press('Enter');
  await p.waitForSelector('.ai-think.live');
  await p.waitForTimeout(600);
  const clickedAt = Date.now();
  await p.click('.ai-stop');
  await p.waitForFunction(() => [...document.querySelectorAll('.ai-error')].some((e) => e.textContent === 'Parado.'));
  await p.waitForTimeout(800);
  ok('Parar: a conversa mostra "Parado."', true);
  ok('Parar: o servidor aborta o pedido à API na hora (a conexão com a API fecha)', stopClosed > 0 && stopClosed - clickedAt < 2000, `${stopClosed ? stopClosed - clickedAt : 'nunca'} ms`);
  ok('Parar: o botão some e dá para enviar de novo', (await p.locator('.ai-stop').isHidden()) && !(await p.locator('.ai-send').isDisabled()));

  // ---------------------------------------------------------------- 4. subagentes (delegate_task com 2)
  await p.locator('.ai-panel [aria-label="Nova conversa"]').click();
  const cabBefore = await fillOf(ids.cab), rodBefore = await fillOf(ids.rod);
  await p.fill('.ai-input', 'divide o trabalho: cabeçalho e rodapé');
  await p.keyboard.press('Enter');
  await p.waitForSelector('.ai-sub[data-state="running"]');
  await p.waitForFunction(() => document.querySelectorAll('.ai-sub').length === 2);
  ok('cada subagente aparece como um cartão com nome e status "rodando"', (await p.locator('.ai-sub .ai-sub-name').allInnerTexts()).join() === 'Cabeçalho,Rodapé' && (await p.locator('.ai-sub[data-state="running"]').count()) === 2);
  ok('cartão em andamento tem o botão Parar', (await p.locator('.ai-sub .ai-sub-stop:visible').count()) === 2);
  await p.locator('.ai-sub').first().locator(':scope > summary').click(); // abre um cartão para ver os passos
  await p.waitForTimeout(500);
  await snap('agente-subagentes-rodando');
  await p.waitForFunction(() => [...document.querySelectorAll('.ai-sub')].every((s) => s.dataset.state !== 'running'), null, { timeout: 20000 });
  await p.waitForSelector('.ai-thinking', { state: 'detached', timeout: 15000 });
  ok('os dois subagentes terminam como "feito"', (await p.locator('.ai-sub[data-state="done"]').count()) === 2, (await p.locator('.ai-subs').innerText()));
  ok('os subagentes rodaram ao mesmo tempo (em paralelo)', subPeak >= 2, `pico ${subPeak}`);
  const cabAfter = await fillOf(ids.cab), rodAfter = await fillOf(ids.rod);
  ok('cada subagente alterou a sua camada', /E11D48/i.test(cabAfter) && /16A34A/i.test(rodAfter), `${cabAfter} ${rodAfter}`);
  const rodCard = await p.locator('.ai-sub').nth(1).textContent();
  ok('escopo respeitado: o subagente do rodapé não altera o cabeçalho (erro claro no cartão)', /fora do seu escopo/.test(await p.locator('.ai-sub').nth(1).locator('.ai-sub-body').innerHTML()) && !/000000/.test(cabAfter), rodCard);
  ok('os cartões mostram passos e o resumo de cada um', /1 passo|2 passos/.test(rodCard) && /Pintei o rodapé de verde/.test(rodCard));
  const subReqs = seen.filter((s) => /Você é um SUBAGENTE/.test(s.data.messages[0]?.content || ''));
  ok('subagente recebe contexto mínimo (tarefa + resumo do projeto) e sem delegate_task/remember', subReqs.length >= 4 && subReqs.every((s) => s.data.messages[1].role === 'user' && /SUA TAREFA/.test(s.data.messages[1].content) && /Resumo do projeto/.test(s.data.messages[1].content))
    && subReqs.every((s) => !s.data.tools.some((t) => ['delegate_task', 'remember'].includes(t.function.name))));
  const mainAfter = seen.filter((s) => s.data.messages.some((m) => m.role === 'user' && /^divide/.test(m.content)) && !/SUBAGENTE/.test(s.data.messages[0].content)).at(-1);
  const delegated = JSON.parse(mainAfter.data.messages.find((m) => m.role === 'tool').content);
  ok('o agente principal recebe o resumo de cada subagente', delegated.subagents?.length === 2 && delegated.subagents.every((r) => r.status === 'done' && r.summary) && /vermelho/.test(delegated.subagents[0].summary));
  ok('a resposta final do principal aparece depois dos cartões', /os dois subagentes terminaram/.test(await p.locator('.ai-msg.bot').last().innerText()));
  await snap('agente-subagentes');
  // Ctrl+Z desfaz cada alteração dos subagentes
  await ev(() => document.activeElement?.blur());
  await p.mouse.click(300, 820);
  await p.keyboard.press('Control+z');
  await p.keyboard.press('Control+z');
  await p.waitForTimeout(200);
  ok('Ctrl+Z desfaz as alterações dos subagentes', (await fillOf(ids.cab)) === cabBefore && (await fillOf(ids.rod)) === rodBefore, `${await fillOf(ids.cab)} / ${await fillOf(ids.rod)}`);
  // reabrir mostra os cartões do histórico
  await p.locator('.ai-panel [aria-label="Fechar agente"]').click();
  await p.click('.ai-btn');
  ok('reabrir a conversa redesenha os cartões dos subagentes', (await p.locator('.ai-sub[data-state="done"]').count()) === 2);

  // ---------------------------------------------------------------- 5. Jev
  await put({ jevKey: 'jev-chave-secreta-123', jevUrl });
  const pub = JSON.stringify(await getCfg());
  ok('com a chave do Jev, a configuração diz que está ligado', JSON.parse(pub).jev === true && JSON.parse(pub).jevSource === 'config');
  ok('a chave do Jev nunca volta ao navegador', !pub.includes('jev-chave-secreta-123'));
  const badUrl = await fetch(url('/api/agent/config'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jevUrl: 'https://outro-site.com/roubar' }) });
  ok('endereço do Jev de fora desta máquina é recusado (a chave não vaza)', badUrl.status === 400);
  await p.locator('.ai-panel [aria-label="Fechar agente"]').click();
  await p.click('.ai-btn'); // reabrir lê a configuração de novo
  await p.waitForTimeout(300);
  await p.locator('.ai-panel [aria-label="Nova conversa"]').click();
  await p.fill('.ai-input', 'usa o jev para escolher a paleta');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => /O Jev escolheu/.test(document.querySelector('.ai-log').innerText), null, { timeout: 15000 });
  const jevReq = seen.filter((s) => s.data.messages.some((m) => m.role === 'user' && /^usa o jev/.test(m.content)));
  ok('com chave, as 3 ferramentas do Jev são oferecidas ao modelo', ['jev_choose', 'jev_score', 'jev_check'].every((n) => jevReq[0].data.tools.some((t) => t.function.name === n)));
  ok('o servidor chama o Jev com a chave guardada (Bearer) e no formato da API', jevSeen.length === 1 && jevSeen[0].auth === 'Bearer jev-chave-secreta-123' && jevSeen[0].data.questions.pass_a.type === 'choice' && /pizzaria/.test(jevSeen[0].data.state.context));
  const jevStep = await p.locator('.ai-step').last().innerText();
  ok('a conversa mostra o que o Jev decidiu', /Pediu ao Jev para escolher → quente \(proceed\)/.test(jevStep), jevStep);
  const jevResult = JSON.parse(jevReq.at(-1).data.messages.find((m) => m.role === 'tool').content);
  ok('o modelo recebe a escolha, as probabilidades e "decision"', jevResult.choice === 'quente' && jevResult.decision === 'proceed' && jevResult.probabilities.quente > 0.9);
  await put({ jevKey: '', jevUrl: '' });
  ok('apagar a chave desliga o Jev', (await getCfg()).jev === false || !!process.env.JEV_API_KEY);

  // ---------------------------------------------------------------- 6. Configurações: Testar modelo
  await p.locator('.ai-panel [aria-label="Fechar agente"]').click();
  await p.keyboard.press('Control+,');
  await p.waitForSelector('.settings-page');
  await p.click('.sp-nav-item[data-section="ai"]');
  await p.fill('[aria-label="Modelo"]', 'modelo-sem-ferramentas');
  await p.locator('button', { hasText: 'Testar modelo' }).click();
  await p.waitForFunction(() => /não serve/.test(document.querySelector('#settings-ai .set-msg')?.textContent || ''), null, { timeout: 15000 });
  ok('Testar modelo: modelo que recusa ferramentas é marcado "sem ferramentas"', /não aceita ferramentas/.test(await p.locator('#settings-ai .set-msg').first().innerText()) && (await p.locator('.model-test-row.bad .model-badge').innerText()) === '✗ sem ferramentas');
  await p.fill('[aria-label="Modelo"]', 'modelo-stream');
  await p.locator('button', { hasText: 'Testar modelo' }).click();
  await p.waitForFunction(() => /funciona/.test(document.querySelector('#settings-ai .set-msg')?.textContent || ''), null, { timeout: 15000 });
  const okMsg = await p.locator('#settings-ai .set-msg').first().innerText();
  ok('Testar modelo: mede o 1º pedaço e confirma ferramentas', /aceita ferramentas, 1º pedaço em [\d,]+ s/.test(okMsg) && /raciocina/.test(okMsg), okMsg);
  const cfg = await getCfg();
  ok('o resultado do teste fica guardado no servidor', cfg.tested?.['modelo-stream']?.ok === true && cfg.tested['modelo-stream'].tools === true && cfg.tested['modelo-sem-ferramentas']?.tools === false);
  await p.locator('button', { hasText: 'Ver modelos' }).click();
  await p.waitForSelector('.model-item');
  ok('a lista de modelos marca quais funcionaram (testados primeiro)', (await p.locator('.model-item').first().getAttribute('class')).includes('tested-ok')
    && (await p.locator('.model-item.tested-ok .model-badge').innerText()).startsWith('✓ ferramentas')
    && (await p.locator('.model-item.tested-bad').count()) === 1);
  await p.locator('#settings-ai .sp-card').nth(1).scrollIntoViewIfNeeded();
  ok('cartão "Tempo e raciocínio" com os campos', (await p.locator('[aria-label="Esperar o 1º pedaço (segundos)"]').inputValue()) === '5' && (await p.locator('#settings-ai', { hasText: 'Pedir menos raciocínio' }).count()) === 1);
  await p.locator('#settings-ai .sp-card').first().scrollIntoViewIfNeeded();
  await snap('config-testar-modelos');
  await p.click('.sp-nav-item[data-section="keys"]');
  ok('Chaves de API tem o cartão do Jev', (await p.locator('[aria-label="Chave do Jev"]').count()) === 1);
  await snap('config-chave-jev');
  await p.keyboard.press('Escape');
} catch (err) {
  ok('cenário terminou sem exceção', false, err.stack);
  if (shoot) await p.screenshot({ path: `${SHOTS}falha.png` }).catch(() => {});
  if (process.env.DEPURAR) {
    console.log(await ev(() => {
      const st = JSON.parse(localStorage.getItem('stylo.agent.v1'));
      const s = st.sessions.find((x) => x.id === st.current);
      return JSON.stringify(s.messages.map((m) => [m.role, (m.content || '').slice(0, 100), m.tool_calls?.map((c) => `${c.function.name}:${c.id}`), m.tool_call_id]));
    }));
    console.log(await ev(() => document.querySelector('.ai-log').innerHTML.slice(0, 3000)));
  }
} finally {
  await put({
    baseUrl: original.baseUrl === 'https://api.openai.com/v1' ? '' : original.baseUrl, model: original.model === 'gpt-4.1-mini' ? '' : original.model,
    firstTokenSec: '', maxThinkSec: '', jevKey: '', jevUrl: '',
  }).catch(() => {});
  mock.close(); jev.close();
  mock.closeAllConnections?.(); jev.closeAllConnections?.();
  await b.close();
}
console.log(errors.join('\n') || 'sem erros no console');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exitCode = fails || errors.length ? 1 : 0;
