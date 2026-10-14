import { isolatedServerEnv } from './helpers/test-env.mjs';
import { cleanupFixture } from './helpers/fixture-lifecycle.mjs';
// DOC-SERVER-007: identidade da sessão MCP e audiência do canal de eventos.
// Servidor descartável em modo contas. Sem DATABASE_URL herdado e sem dados reais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createProbe } from 'node:net';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const freePort = () => new Promise((resolve) => {
  const probe = createProbe();
  probe.listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
});

async function start(t) {
  const dir = await mkdtemp(join(tmpdir(), 'stylo-canais-'));
  const fixture = { dir, children: [], clients: [] };
  t.after(() => cleanupFixture(fixture));
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../apps/server/src/main.ts', import.meta.url))], {
    env: isolatedServerEnv({ PORT: String(port), DESIGNER_CONFIG: join(dir, 'config.json'), DESIGNER_DB_DIR: 'memory', STYLO_AUTH: 'accounts', STYLO_BLOB_DIR: 'memory', STYLO_SECRET_KEY: Buffer.alloc(32, 5).toString('base64') }),
    stdio: 'ignore',
  });
  fixture.children.push(child);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 2400; i++) {
    try { if ((await fetch(base + '/api/status')).ok) return base; } catch { /* subindo */ }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('servidor de canais não subiu');
}

const doc = { name: 'Privado', pages: [{ id: 'p1', name: 'Página', children: [] }], assets: {}, styles: { colors: [], texts: [] } };

function listen(response, ms = 8000) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let stop = false;
  const finished = (async () => {
    const timer = setTimeout(() => { stop = true; reader.cancel().catch(() => {}); }, ms);
    try {
      while (!stop) {
        const chunk = await reader.read();
        if (chunk.done) break;
        text += decoder.decode(chunk.value, { stream: true });
      }
    } catch { /* cancelado */ }
    clearTimeout(timer);
    return text;
  })();
  return { text: () => text, finished, stop: () => { stop = true; reader.cancel().catch(() => {}); } };
}

const waitFor = async (predicate, ms = 4000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('tempo esgotado esperando o canal');
};

test('canais persistentes: sessão MCP não muda de agente e o SSE só entrega a quem pode ver', async (t) => {
  const base = await start(t);
  let cookie = '';
  const call = async (method, path, body, headers = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie && !headers.cookie) cookie = setCookie.split(';', 1)[0];
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* sem JSON */ }
    return { status: response.status, json, text, cookie: setCookie ? setCookie.split(';', 1)[0] : '' };
  };
  assert.equal((await call('GET', '/api/status')).status, 200, 'o mínimo público continua aberto');
  assert.equal((await call('GET', '/api/health')).status, 401, 'diagnóstico exige sessão');
  assert.equal((await call('GET', '/api/presence')).status, 401, 'presença exige sessão');
  assert.equal((await call('GET', '/api/agent/events')).status, 401, 'canal de eventos não aceita anônimo');

  const setup = await call('POST', '/api/auth/setup', { email: 'owner@stylo.test', name: 'Owner', password: 'senha-owner-segura' });
  assert.equal(setup.status, 201);
  const ownerCookie = cookie;
  const makeUser = async (email, name, role) => {
    const created = await call('POST', '/api/users', { email, name, role, password: `senha-${role.toLowerCase()}-segura` });
    assert.equal(created.status, 201, email);
    const login = await call('POST', '/api/auth/login', { email, password: `senha-${role.toLowerCase()}-segura` });
    assert.equal(login.status, 200, email);
    const changed = await call('POST', '/api/me/password', { current: `senha-${role.toLowerCase()}-segura`, next: `senha-${role.toLowerCase()}-nova` });
    assert.equal(changed.status, 200, email);
    const session = cookie;
    cookie = ownerCookie;
    return session;
  };
  const owner2 = await makeUser('owner2@stylo.test', 'Owner Dois', 'OWNER');
  const admin = await makeUser('admin@stylo.test', 'Admin', 'ADMIN');
  const member = await makeUser('member@stylo.test', 'Membro', 'MEMBER');

  const openEvents = async (session) => {
    const response = await fetch(base + '/api/agent/events?id=forjado&user=Forjado&color=red', { headers: { cookie: session } });
    assert.equal(response.status, 200, 'sessão válida abre o canal');
    const bag = listen(response);
    await waitFor(() => bag.text().includes('conectado'));
    return bag;
  };
  const ownerEvents = await openEvents(ownerCookie);
  const owner2Events = await openEvents(owner2);
  const adminEvents = await openEvents(admin);
  const memberEvents = await openEvents(member);
  const listed = await call('GET', '/api/connections');
  assert.equal(listed.status, 200);
  assert.ok(listed.json.some((row) => row.name === 'Owner'));
  assert.ok(listed.json.every((row) => row.name !== 'Forjado' && row.personId !== 'forjado'), 'query não define identidade');

  const created = await call('PUT', '/api/projects/privado.json', doc);
  assert.equal(created.status, 200);
  const forged = await fetch(base + '/api/agent/events?file=privado.json&user=Owner&id=' + setup.json.user.id, { headers: { cookie: member } });
  assert.equal(forged.status, 403, 'projeto alheio na query não inscreve o canal');
  await waitFor(() => ownerEvents.text().includes('privado.json') && owner2Events.text().includes('privado.json'));
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.doesNotMatch(adminEvents.text(), /privado\.json/, 'ADMIN não recebe projeto privado');
  assert.doesNotMatch(memberEvents.text(), /privado\.json/, 'membro sem acesso não recebe o projeto');

  const mcp = (body, headers = {}) => fetch(base + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const initBody = (name) => ({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name, version: '1' } } });
  const agent = await call('POST', '/api/agents', { name: 'Agente Um', scopes: ['read', 'write'] });
  const other = await call('POST', '/api/agents', { name: 'Agente Dois', scopes: ['read', 'write'] });
  assert.equal(agent.status, 201);
  const first = await mcp(initBody('Agente Um'), { authorization: `Bearer ${agent.json.token}` });
  assert.equal(first.status, 200);
  const sid = first.headers.get('mcp-session-id');
  const tool = async (headers, id = 2) => {
    const response = await mcp({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'list_projects', arguments: {} } }, { ...headers, 'mcp-session-id': sid });
    const text = await response.text();
    return { status: response.status, text };
  };
  const withoutBearer = await tool({});
  assert.equal(withoutBearer.status, 200, 'sem bearer a sessão segue no agente original');
  assert.match(withoutBearer.text, /privado\.json/);
  const swapped = await tool({ authorization: `Bearer ${other.json.token}` }, 3);
  assert.equal(swapped.status, 401, 'bearer de outro agente não assume a sessão');
  assert.match(swapped.text, /outro agente/);
  const stillOriginal = await tool({ authorization: `Bearer ${agent.json.token}` }, 4);
  assert.equal(stillOriginal.status, 200, 'a sessão original continua no primeiro agente');

  const narrowed = await call('PUT', `/api/agents/${agent.json.agent.id}`, { scopes: ['read'] });
  assert.equal(narrowed.status, 200);
  const write = await mcp({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'new_project', arguments: { name: 'Nao Pode' } } }, { 'mcp-session-id': sid });
  const writeBody = await write.json();
  assert.equal(write.status, 200);
  assert.equal(writeBody.result.isError, true);
  assert.match(writeBody.result.content[0].text, /escrita/);

  const rotated = await call('POST', `/api/agents/${agent.json.agent.id}/rotate`, {});
  assert.equal(rotated.status, 200);
  const oldToken = await tool({ authorization: `Bearer ${agent.json.token}` }, 6);
  assert.ok(oldToken.status === 401 || oldToken.status === 404, 'token rotacionado não segue na sessão antiga');
  const fresh = await mcp(initBody('Agente Um'), { authorization: `Bearer ${rotated.json.token}` });
  assert.equal(fresh.status, 200, 'o token novo abre sessão nova');

  const secondSid = fresh.headers.get('mcp-session-id');
  const revoked = await call('POST', `/api/agents/${agent.json.agent.id}/revoke`, {});
  assert.equal(revoked.status, 200);
  const denied = (status) => status === 401 || status === 404;
  const afterRevoke = await mcp({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'list_projects', arguments: {} } }, { 'mcp-session-id': secondSid });
  assert.ok(denied(afterRevoke.status), 'revogação vale sem bearer novo');
  const getAfter = await fetch(base + '/mcp', { method: 'GET', headers: { 'mcp-session-id': secondSid } });
  assert.ok(denied(getAfter.status), 'GET da sessão também revalida');
  const deleteAfter = await fetch(base + '/mcp', { method: 'DELETE', headers: { 'mcp-session-id': secondSid } });
  assert.ok(denied(deleteAfter.status));

  const opened = await call('POST', '/api/studio/call', { sid: 'aba-canais-01', tool: 'open_project', args: { file: 'privado.json' } });
  assert.equal(opened.json?.error, undefined, JSON.stringify(opened.json));
  const shared = await call('POST', '/api/studio/call', { sid: 'aba-canais-01', tool: 'share_project', args: { email: 'member@stylo.test', role: 'viewer' } });
  assert.equal(shared.json?.error, undefined, JSON.stringify(shared.json));
  cookie = admin;
  const suspended = await call('POST', `/api/users/${setup.json.user.id}/suspend`, { suspended: true });
  assert.equal(suspended.status, 200);
  const ownerClosed = await Promise.race([ownerEvents.finished.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 3000))]);
  assert.equal(ownerClosed, true, 'suspender fecha o canal de eventos do usuário');
  cookie = member;
  const stillThere = await call('GET', '/api/projects/privado.json');
  assert.equal(stillThere.status, 200, 'o projeto e o acesso do membro permanecem');
  cookie = admin;
  const restored = await call('POST', `/api/users/${setup.json.user.id}/suspend`, { suspended: false });
  assert.equal(restored.status, 200);
  const relogin = await call('POST', '/api/auth/login', { email: 'owner@stylo.test', password: 'senha-owner-segura' });
  assert.equal(relogin.status, 200);
  const listedAgents = await call('GET', '/api/agents');
  const kept = listedAgents.json.find((row) => row.id === agent.json.agent.id);
  assert.equal(kept?.status, 'REVOKED');
  assert.equal(kept?.name, 'Agente Um');
  const revived = await mcp(initBody('Agente Um'), { authorization: `Bearer ${rotated.json.token}` });
  assert.equal(revived.status, 401, 'reativar o usuário não reativa o token do agente');

  owner2Events.stop();
  adminEvents.stop();
  memberEvents.stop();
});
