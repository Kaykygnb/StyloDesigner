// Experimento exploratório: duas abas humanas e dois clientes MCP no mesmo servidor local.
// Requer APP_URL apontando para uma instância descartável; recusa a porta padrão para proteger o editor aberto.
import { chromium } from 'playwright';

const rawBase = process.env.APP_URL;
if (!rawBase) throw new Error('Defina APP_URL para a instância de teste isolada, por exemplo http://127.0.0.1:5184/.');
const BASE = new URL(rawBase);
if (!['localhost', '127.0.0.1', '::1'].includes(BASE.hostname) || !BASE.port || BASE.port === '5173') {
  throw new Error('O experimento só pode rodar em uma instância local isolada, com porta explícita diferente de 5173.');
}
const url = (path) => new URL(path, BASE).href;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const humans = [];
const agents = [];

async function openHuman(name, color) {
  const page = await context.newPage();
  await page.route('**/api/account', (route) => route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name, email: '', role: 'Designer', color, avatar: '', language: 'pt-BR', createdAt: null, updatedAt: null }) })
    : route.continue());
  await page.goto(url('?editor'));
  await page.waitForFunction(() => !!window.designer?.store);
  await page.waitForTimeout(250);
  humans.push({ name, page });
  return page;
}

async function openAgent(name) {
  const response = await fetch(url('/mcp'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Stylo-Agent': name },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name, version: 'audit' } } }),
  });
  const sid = response.headers.get('mcp-session-id');
  if (!response.ok || !sid) throw new Error(`${name}: initialize MCP falhou (${response.status}).`);
  agents.push({ name, sid });
  return agents.at(-1);
}

async function call(agent, name, args, id) {
  const response = await fetch(url('/mcp'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': agent.sid },
    body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }),
  });
  const body = await response.json();
  if (!response.ok || body.result?.isError) throw new Error(`${agent.name}/${name}: ${body.result?.content?.[0]?.text || response.status}`);
  return JSON.parse(body.result.content[0].text);
}

async function makePage(page, humanName, color) {
  return page.evaluate(async ({ humanName, color }) => {
    const { createNode, defaultFill } = await import('/src/model.js');
    const store = designer.store;
    store.newDoc();
    const frame = createNode('frame', { name: `${humanName} · tela`, x: 0, y: 0, w: 700, h: 480 });
    const first = createNode('rect', { name: `${humanName} · alvo 1`, x: 24, y: 24, w: 80, h: 60, fill: { ...defaultFill(color) } });
    const second = createNode('rect', { name: `${humanName} · alvo 2`, x: 120, y: 24, w: 80, h: 60, fill: { ...defaultFill(color) } });
    frame.children.push(first, second);
    store.update((pg) => { pg.name = humanName; pg.children.push(frame); }, { commit: true });
    return { pageName: store.page().name, frameId: frame.id, firstId: first.id, secondId: second.id };
  }, { humanName, color });
}

async function waitForPeople(count) {
  for (let i = 0; i < 40; i++) {
    const p = await (await fetch(url('/api/presence'))).json();
    if (p.people.length >= count) return p;
    await delay(100);
  }
  throw new Error(`A presença não mostrou ${count} abas humanas.`);
}

try {
  const humanA = await openHuman('Humana A', '#4c8dff');
  const docA = await makePage(humanA, 'Documento A', '#dce9ff');
  const humanB = await openHuman('Humana B', '#f7a541');
  const docB = await makePage(humanB, 'Documento B', '#fff0d8');
  const presenceBefore = await waitForPeople(2);

  const agentA = await openAgent('Agente A');
  const agentB = await openAgent('Agente B');
  // Os dois agentes pedem o documento ao mesmo tempo. A sessão MCP não escolhe uma aba explicitamente.
  const [readA, readB] = await Promise.all([
    call(agentA, 'get_document', {}, 2),
    call(agentB, 'get_document', {}, 2),
  ]);
  const pagesA = readA.pages.map((p) => p.name);
  const pagesB = readB.pages.map((p) => p.name);

  // Escritas em alvos distintos podem prosseguir em paralelo; ambas as permissões são respondidas na aba B.
  const writeA = call(agentA, 'update_layer', { id: docB.firstId, props: { radius: 14 } }, 3);
  await humanB.waitForSelector('.ask-modal', { timeout: 5000 });
  const writeB = call(agentB, 'update_layer', { id: docB.secondId, props: { radius: 22 } }, 3);
  await delay(100);
  // Enquanto os agentes aguardam aprovação na aba B, a pessoa na aba A muda W pelo painel real.
  await humanA.evaluate((id) => designer.store.setSelection([id]), docA.firstId);
  const humanWidth = humanA.locator('.num-field:has(.num-label:text-is("W")) input');
  await humanWidth.fill('222');
  await humanWidth.press('Enter');
  await humanB.getByRole('button', { name: 'Permitir', exact: true }).click();
  await humanB.waitForSelector('.ask-modal', { timeout: 5000 });
  await humanB.getByRole('button', { name: 'Permitir', exact: true }).click();
  await Promise.all([writeA, writeB]);

  const stateA = await humanA.evaluate((id) => ({ page: designer.store.page().name, width: designer.store.get(id).w }), docA.firstId);
  const stateB = await humanB.evaluate((ids) => ({ page: designer.store.page().name, radius1: designer.store.get(ids.firstId).radius[0], radius2: designer.store.get(ids.secondId).radius[0] }), docB);
  const presenceAfter = await (await fetch(url('/api/presence'))).json();
  const bothAgentsPresent = agents.every((agent) => presenceAfter.agents.some((x) => x.id === agent.sid));
  const observations = {
    twoHumansAndTwoAgentsPresent: presenceBefore.people.length >= 2 && bothAgentsPresent,
    bothAgentsReadDocumentB: pagesA.includes('Documento B') && pagesB.includes('Documento B'),
    documentsRemainUnsynced: stateA.page === 'Documento A' && stateB.page === 'Documento B',
    bothWritesAppliedToTabB: stateB.radius1 === 14 && stateB.radius2 === 22,
    humanAEditStayedOnTabA: stateA.width === 222,
  };

  console.log(JSON.stringify({
    humans: presenceBefore.people.map((person) => person.name),
    agents: presenceAfter.agents.filter((agent) => agents.some((a) => a.sid === agent.id)).map((agent) => agent.name),
    documentA: stateA,
    documentB: stateB,
    agentAReadPages: pagesA,
    agentBReadPages: pagesB,
    observations,
  }, null, 2));
  if (Object.values(observations).some((observed) => !observed)) {
    throw new Error(`O comportamento observado mudou; revise a auditoria multiaba: ${JSON.stringify(observations)}`);
  }
  console.log('GAP: chamadas MCP foram para a última aba conectada; alterações entre abas não sincronizaram.');
} finally {
  await Promise.all(agents.map((agent) => fetch(url('/mcp'), { method: 'DELETE', headers: { 'Mcp-Session-Id': agent.sid } }).catch(() => {})));
  await context.close();
  await browser.close();
}
