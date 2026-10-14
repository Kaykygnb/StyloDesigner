import { isolatedServerEnv } from './helpers/test-env.mjs';
import { cleanupFixture } from './helpers/fixture-lifecycle.mjs';
// Testes de autorização dos endpoints de configuração do servidor (DOC-SERVER-005).
// Sobe o servidor real em modo contas e verifica que PUT /api/config e PUT /api/agent/config
// só aceitam OWNER/ADMIN: anônimo leva 401, MEMBER leva 403 e nada é mutado nas recusas.
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
  const dir = await mkdtemp(join(tmpdir(), 'stylo-config-auth-'));
  const fixture = { dir: dir, children: [], clients: [] };
  t.after(() => cleanupFixture(fixture));
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../apps/server/src/main.ts', import.meta.url))], {
    env: isolatedServerEnv({ PORT: String(port), DESIGNER_CONFIG: join(dir, 'config.json'), DESIGNER_DB: 'memory', STYLO_AUTH: 'accounts', STYLO_BLOB_DIR: 'memory', STYLO_SECRET_KEY: Buffer.alloc(32, 7).toString('base64') }),
    stdio: 'ignore',
  });
  fixture.children.push(child);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 2400; i++) {
    try { if ((await fetch(base + '/api/status')).ok) return { base }; } catch { /* subindo */ }
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('servidor de contas não subiu');
}

const call = async (base, method, path, body, cookie) => {
  const response = await fetch(base + path, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.get('set-cookie');
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch { /* resposta sem JSON */ }
  return { status: response.status, json, cookie: setCookie ? setCookie.split(';', 1)[0] : '' };
};

const login = async (base, email, password) => {
  const session = await call(base, 'POST', '/api/auth/login', { email, password });
  assert.equal(session.status, 200, `login de ${email}`);
  return session.cookie;
};

test('config do servidor: anônimo e membro são recusados; owner e admin alteram; recusa não muta nada', async (t) => {
  const { base } = await start(t);

  const setup = await call(base, 'POST', '/api/auth/setup', { email: 'owner@stylo.test', name: 'Owner', password: 'senha-owner-segura' });
  assert.equal(setup.status, 201);
  const ownerCookie = setup.cookie;

  const makeUser = async (email, name, role) => {
    const created = await call(base, 'POST', '/api/users', { email, name, role }, ownerCookie);
    assert.equal(created.status, 201);
    const cookie = await login(base, email, created.json.temporaryPassword);
    const changed = await call(base, 'POST', '/api/me/password', { current: created.json.temporaryPassword, next: `senha-${role.toLowerCase()}-segura` }, cookie);
    assert.equal(changed.status, 200);
    return cookie;
  };
  const memberCookie = await makeUser('member@stylo.test', 'Member', 'MEMBER');
  const adminCookie = await makeUser('admin@stylo.test', 'Admin', 'ADMIN');

  // política padrão antes de qualquer tentativa
  const statusBefore = (await call(base, 'GET', '/api/status')).json;
  const agentBefore = (await call(base, 'GET', '/api/agent/config')).json;
  assert.equal(typeof statusBefore.keepVersions, 'number');
  assert.equal(agentBefore.agentPolicy, 'closed');

  // anônimo: 401 nos dois PUT
  assert.equal((await call(base, 'PUT', '/api/config', { keepVersions: 42 })).status, 401);
  assert.equal((await call(base, 'PUT', '/api/agent/config', { agentPolicy: 'open' })).status, 401);

  // membro: 403 nos dois PUT
  assert.equal((await call(base, 'PUT', '/api/config', { keepVersions: 42 }, memberCookie)).status, 403);
  assert.equal((await call(base, 'PUT', '/api/agent/config', { agentPolicy: 'open' }, memberCookie)).status, 403);

  // as recusas não mutaram nada
  const statusAfterRefusals = (await call(base, 'GET', '/api/status')).json;
  const agentAfterRefusals = (await call(base, 'GET', '/api/agent/config')).json;
  assert.equal(statusAfterRefusals.keepVersions, statusBefore.keepVersions, 'recusa não pode mudar keepVersions');
  assert.equal(agentAfterRefusals.agentPolicy, 'closed', 'recusa não pode mudar agentPolicy');

  // owner: altera e persiste
  const byOwner = await call(base, 'PUT', '/api/config', { keepVersions: 9 }, ownerCookie);
  assert.equal(byOwner.status, 200);
  assert.equal(byOwner.json.keepVersions, 9);
  assert.equal((await call(base, 'GET', '/api/status')).json.keepVersions, 9, 'keepVersions persistido');

  const byOwnerAgent = await call(base, 'PUT', '/api/agent/config', { agentPolicy: 'approval', pexelsKey: 'chave-de-teste-123' }, ownerCookie);
  assert.equal(byOwnerAgent.status, 200);
  assert.equal(byOwnerAgent.json.pexels, true);
  const agentAfterOwner = (await call(base, 'GET', '/api/agent/config')).json;
  assert.equal(agentAfterOwner.agentPolicy, 'approval', 'agentPolicy persistido');
  assert.ok(!JSON.stringify(agentAfterOwner).includes('chave-de-teste-123'), 'a chave Pexels nunca aparece na resposta');

  // admin: também altera
  const byAdmin = await call(base, 'PUT', '/api/config', { keepVersions: 5 }, adminCookie);
  assert.equal(byAdmin.status, 200);
  assert.equal((await call(base, 'GET', '/api/status')).json.keepVersions, 5);
  assert.equal((await call(base, 'PUT', '/api/agent/config', { agentPolicy: 'closed' }, adminCookie)).status, 200);
  assert.equal((await call(base, 'GET', '/api/agent/config')).json.agentPolicy, 'closed');
});
