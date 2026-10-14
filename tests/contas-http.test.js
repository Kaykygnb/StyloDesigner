import { isolatedServerEnv } from './helpers/test-env.mjs';
import { cleanupFixture } from './helpers/fixture-lifecycle.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createProbe } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const freePort = () => new Promise((resolve) => {
  const s = createProbe();
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

async function start(t) {
  const dir = await mkdtemp(join(tmpdir(), 'stylo-contas-'));
  const fixture = { dir: dir, children: [], clients: [] };
  t.after(() => cleanupFixture(fixture));
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../apps/server/src/main.ts', import.meta.url))], {
    env: isolatedServerEnv({ PORT: String(port), DESIGNER_CONFIG: join(dir, 'config.json'), DESIGNER_DB_DIR: 'memory', STYLO_AUTH: 'accounts', STYLO_BLOB_DIR: 'memory', STYLO_SECRET_KEY: Buffer.alloc(32, 7).toString('base64') }),
    stdio: 'ignore',
  });
  fixture.children.push(child);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 2400; i++) {
    try { if ((await fetch(base + '/api/status')).ok) return { base, cookie: '' }; } catch { /* subindo */ }
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('servidor de contas não subiu');
}

const doc = { name: 'Controle', pages: [{ id: 'p1', name: 'Página', children: [] }], assets: {}, styles: { colors: [], texts: [] } };

test('contas: cadastro, agente MCP, autorização por projeto e revogação', async (t) => {
  const { base } = await start(t);
  let cookie = '';
  const call = async (method, path, body) => {
    const response = await fetch(base + path, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';', 1)[0];
    const text = await response.text();
    let json = null; try { json = JSON.parse(text); } catch { /* resposta sem JSON */ }
    return { status: response.status, json, text };
  };

  const setup = await call('POST', '/api/auth/setup', { email: 'owner@stylo.test', name: 'Owner', password: 'senha-segura' });
  assert.equal(setup.status, 201);
  const sessions = await call('GET', '/api/sessions');
  assert.equal(sessions.status, 200);
  assert.ok(sessions.json.some((row) => row.user.email === 'owner@stylo.test'));
  assert.ok(!JSON.stringify(sessions.json).includes('tokenHash'));
  const unknownSession = await call('DELETE', '/api/sessions/not-a-real-session', {});
  assert.deepEqual(unknownSession.json, { ok: true, revoked: false });
  const catalog = await call('GET', '/api/plugins/catalog');
  assert.equal(catalog.status, 200);
  const assetsPlugin = catalog.json.plugins.find((plugin) => plugin.id === 'assets');
  assert.equal(assetsPlugin.enabled, true);
  assert.deepEqual((await call('PUT', '/api/plugins/assets', { enabled: false })).json, { id: 'assets', enabled: false });
  assert.equal((await call('GET', '/api/plugins/catalog')).json.plugins.find((plugin) => plugin.id === 'assets').enabled, false);
  assert.deepEqual((await call('PUT', '/api/plugins/assets', { enabled: true })).json, { id: 'assets', enabled: true });
  const network = await call('GET', '/api/network');
  assert.equal(network.status, 200);
  assert.equal(network.json.bound, '0.0.0.0');
  assert.match(network.json.localUrl, /^http:\/\/localhost:/);
  const adminActivity = await call('GET', '/api/admin/activity');
  assert.equal(adminActivity.status, 200);
  assert.ok(Array.isArray(adminActivity.json));
  const streamAbort = new AbortController();
  const stream = await fetch(base + '/api/agent/events?id=editor-e2e&user=Editor%20Web', { headers: { cookie }, signal: streamAbort.signal });
  assert.equal(stream.status, 200);
  const connections = await call('GET', '/api/connections');
  assert.equal(connections.status, 200);
  const live = connections.json.find((connection) => connection.name === 'Owner');
  assert.ok(live, 'a conexão SSE deve aparecer para o administrador com a identidade da sessão');
  assert.notEqual(live.personId, 'editor-e2e', 'a query não escolhe a identidade da conexão');
  const closeConnection = await call('DELETE', `/api/connections/${live.id}`, {});
  assert.equal(closeConnection.status, 200);
  streamAbort.abort();
  const accountExport = await call('GET', '/api/me/export');
  assert.equal(accountExport.status, 200);
  assert.equal(accountExport.json.account.email, 'owner@stylo.test');
  assert.ok(Array.isArray(accountExport.json.projects));
  assert.ok(Array.isArray(accountExport.json.agents));
  assert.ok(accountExport.json.agents.every((agent) => !('token' in agent)), 'exportação nunca inclui tokens');
  const created = await call('POST', '/api/users', { email: 'editor@stylo.test', name: 'Editor', role: 'EDITOR', color: '#123456', avatar: 'data:image/png;base64,AA==' });
  assert.equal(created.status, 201);
  assert.ok(created.json.temporaryPassword, 'a senha temporária deve aparecer uma vez');
  assert.equal(created.json.user.role, 'EDITOR');
  assert.equal(created.json.user.color, '#123456');
  assert.equal(created.json.user.avatar, 'data:image/png;base64,AA==');
  const ownerCookie = cookie;
  const editorLogin = await call('POST', '/api/auth/login', { email: 'editor@stylo.test', password: created.json.temporaryPassword });
  assert.equal(editorLogin.status, 200);
  const forbiddenOwner = await call('POST', '/api/users', { email: 'owner2@stylo.test', name: 'Owner 2', role: 'OWNER' });
  assert.equal(forbiddenOwner.status, 403);
  const blockedBeforePasswordChange = await call('GET', '/api/projects');
  assert.equal(blockedBeforePasswordChange.status, 403);
  const changed = await call('POST', '/api/me/password', { current: created.json.temporaryPassword, next: 'senha-editor-segura' });
  assert.equal(changed.status, 200);
  const allowedAfterPasswordChange = await call('GET', '/api/projects');
  assert.equal(allowedAfterPasswordChange.status, 200);
  cookie = ownerCookie;

  const project = await call('PUT', '/api/projects/controle.json', doc);
  assert.equal(project.status, 200);
  const owned = await call('GET', '/api/users/' + setup.json.user.id + '/projects');
  assert.equal(owned.status, 200);
  assert.equal(owned.json[0].role, 'OWNER');
  const cannotRevokeOwner = await call('DELETE', `/api/users/${setup.json.user.id}/projects/${owned.json[0].id}`, {});
  assert.equal(cannotRevokeOwner.status, 400);

  const agent = await call('POST', '/api/agents', { name: 'Agente de teste', type: 'codex' });
  assert.equal(agent.status, 201);
  assert.ok(agent.json.token, 'o token do agente deve aparecer na criação');
  assert.equal(agent.json.agent.type, 'codex');
  const grant = await call('POST', `/api/agents/${agent.json.agent.id}/projects`, { file: 'controle.json' });
  assert.equal(grant.status, 200);
  const listedAgents = await call('GET', '/api/agents');
  assert.equal(listedAgents.status, 200);
  assert.equal(listedAgents.json.find((item) => item.id === agent.json.agent.id).lastProject.slug, 'controle.json');
  const listed = await call('GET', `/api/agents/${agent.json.agent.id}/projects`);
  assert.equal(listed.status, 200);
  assert.equal(listed.json.length, 1);
  assert.equal(listed.json[0].project.slug, 'controle.json');
  const revoke = await call('DELETE', `/api/agents/${agent.json.agent.id}/projects/${listed.json[0].projectId}`, {});
  assert.equal(revoke.status, 200);
  const after = await call('GET', `/api/agents/${agent.json.agent.id}/projects`);
  assert.equal(after.status, 200);
  assert.equal(after.json.length, 0);
});
