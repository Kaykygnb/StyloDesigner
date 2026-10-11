// O servidor em modo "contas": login, conta mestre, agentes com token no MCP, atividade registrada e isolamento entre pessoas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const freePort = () => new Promise((resolve) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

test('modo contas: setup, login, token de agente no MCP, log de atividade, revogação e isolamento', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'stylo-contas-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../apps/server/src/main.ts', import.meta.url))], {
    env: { ...process.env, PORT: String(port), DESIGNER_CONFIG: join(tmp, 'config.json'), STYLO_AUTH: 'accounts', DESIGNER_DB_DIR: 'memory' },
    stdio: 'ignore',
  });
  t.after(() => child.kill());
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 400; i++) {
    try { if ((await fetch(base + '/api/auth/state')).ok) break; } catch { await new Promise((r) => setTimeout(r, 25)); }
  }
  const json = { 'Content-Type': 'application/json' };
  const call = (method, path, body, token) => fetch(base + path, { method, headers: { ...json, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });

  let state = await (await call('GET', '/api/auth/state')).json();
  assert.deepEqual([state.mode, state.hasAccounts, state.user], ['accounts', false, null]);
  assert.equal((await call('GET', '/api/projects')).status, 401, 'sem login não lista projetos');

  // conta mestre
  const setup = await call('POST', '/api/auth/setup', { email: 'dono@x.com', name: 'Dono', password: 'senha-do-dono' });
  assert.equal(setup.status, 201);
  assert.match(setup.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const { token: session } = await setup.json();
  assert.equal((await call('POST', '/api/auth/setup', { email: 'b@x.com', name: 'B', password: '12345678' })).status, 409);
  assert.equal((await call('POST', '/api/auth/login', { email: 'dono@x.com', password: 'errada' })).status, 401);
  assert.equal((await (await call('GET', '/api/me', null, session)).json()).role, 'OWNER');

  // cadastro de agente: só a conta mestre; o token aparece uma vez
  assert.equal((await call('POST', '/api/agents', { name: 'Sem login' })).status, 401);
  const created = await (await call('POST', '/api/agents', { name: 'Claude Code' }, session)).json();
  assert.ok(created.token.startsWith('stylo_agt_'));

  // MCP: sem token não entra; com token entra e trabalha
  const mcp = (body, headers = {}) => fetch(base + '/mcp', { method: 'POST', headers: { ...json, ...headers }, body: JSON.stringify(body) });
  const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Claude Code', version: '1' } } };
  assert.equal((await mcp(init)).status, 401);
  assert.equal((await mcp(init, { Authorization: 'Bearer stylo_agt_falso' })).status, 401);
  const auth = { Authorization: `Bearer ${created.token}` };
  const ok = await mcp(init, auth);
  assert.equal(ok.status, 200);
  const sid = ok.headers.get('mcp-session-id');
  const tool = async (name, args, id = 2) => {
    const r = await mcp({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }, { ...auth, 'Mcp-Session-Id': sid });
    return { status: r.status, body: r.status === 200 ? JSON.parse((await r.json()).result.content[0].text) : null };
  };
  assert.equal((await tool('new_project', { name: 'Do Agente' })).body.file, 'do-agente.json');
  assert.equal((await tool('create_layer', { type: 'frame', props: { name: 'Hero' } })).body.ok, true);

  // o dono vê o projeto e o log de atividade mostra o agente
  const list = await (await call('GET', '/api/projects', null, session)).json();
  assert.deepEqual(list.map((p) => p.file), ['do-agente.json']);
  await new Promise((r) => setTimeout(r, 600)); // o servidor grava 400 ms depois da última alteração
  const doc = await (await call('GET', '/api/projects/do-agente.json', null, session)).json();
  assert.ok(JSON.stringify(doc).includes('Hero'), 'a alteração do agente chegou ao banco');
  const activity = await (await call('GET', '/api/projects/do-agente.json/activity', null, session)).json();
  assert.ok(activity.some((a) => a.tool === 'create_layer' && a.who === 'Claude Code'));

  // outra pessoa não enxerga o projeto
  await call('POST', '/api/users', { email: 'amigo@x.com', name: 'Amigo', password: 'senha-do-amigo' }, session);
  const friend = await (await call('POST', '/api/auth/login', { email: 'amigo@x.com', password: 'senha-do-amigo' })).json();
  assert.deepEqual(await (await call('GET', '/api/projects', null, friend.token)).json(), []);
  assert.equal((await call('GET', '/api/projects/do-agente.json', null, friend.token)).status, 404);
  assert.equal((await call('GET', '/api/agents', null, friend.token)).status, 403, 'só a conta mestre lista agentes');

  // revogar vale na hora
  assert.equal((await call('POST', `/api/agents/${created.agent.id}/revoke`, null, session)).status, 200);
  assert.equal((await tool('get_document', {}, 3)).status, 401);
});
