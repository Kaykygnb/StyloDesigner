// Integração com PostgreSQL de verdade (DOC-SERVER-001).
// Sobe um PostgreSQL descartável (embedded-postgres; baixa o binário na primeira vez),
// cria um banco temporário, aplica as mesmas migrações do PGlite (packages/db/prisma/migrations),
// liga o servidor com DATABASE_URL e roda o fluxo: auth → projeto → agente (MCP com bearer) →
// duas sessões → reinício do servidor com o mesmo banco (persistência/reconexão) →
// falha de conexão (PostgreSQL derrubado: o servidor responde erro limpo e se recupera).
// Nada toca em dados de produto: tudo em pastas temporárias e banco descartável.
// Se o binário não puder ser provisionado nesta plataforma (ex. CI sem rede), o teste é pulado com aviso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const freePort = () => new Promise((resolve) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const migrationsDir = fileURLToPath(new URL('../packages/db/prisma/migrations', import.meta.url));
const mainTs = fileURLToPath(new URL('../apps/server/src/main.ts', import.meta.url));

async function migrationSql() {
  const dirs = (await readdir(migrationsDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  return Promise.all(dirs.map(async (name) => ({ name, sql: await readFile(join(migrationsDir, name, 'migration.sql'), 'utf8') })));
}

/** Sobe o servidor Stylo apontando para o PostgreSQL descartável; devolve helper de chamada HTTP. */
async function startStylo(t, dbUrl, dir) {
  const port = await freePort();
  let log = '';
  const child = spawn(process.execPath, ['--import', 'tsx', mainTs], {
    env: { ...process.env, PORT: String(port), DATABASE_URL: dbUrl, DESIGNER_CONFIG: join(dir, 'config.json'), STYLO_AUTH: 'accounts', STYLO_BLOB_DIR: 'memory', STYLO_SECRET_KEY: Buffer.alloc(32, 3).toString('base64') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  t.after(() => child.kill());
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 2400; i++) {
    try { if ((await fetch(base + '/api/status')).ok) return { base, child }; } catch { /* subindo */ }
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`o servidor não subiu em 60 s\n--- log do servidor ---\n${log.slice(-3000)}`);
}

const call = async (base, method, path, body, cookie) => {
  const response = await fetch(base + path, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.get('set-cookie');
  let json = null; try { json = await response.json(); } catch { /* resposta sem JSON */ }
  return { status: response.status, json, cookie: setCookie ? setCookie.split(';', 1)[0] : '' };
};

const doc = { name: 'Controle', pages: [{ id: 'p1', name: 'Página', children: [] }], assets: {}, styles: { colors: [], texts: [] } };

test('postgresql descartavel: migrações, auth, projeto, agente, sessões, reinício e falha de conexão', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'stylo-pg-'));
  t.after(async () => {
    // Windows segura arquivos do PostgreSQL por alguns segundos após o pg_ctl stop: tenta de novo
    for (let attempt = 1; attempt <= 6; attempt++) {
      try { await rm(dir, { recursive: true, force: true }); return; } catch { await new Promise((r) => setTimeout(r, 1500)); }
    }
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  // 1. ambiente descartável
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const pgPort = await freePort();
  // persistent: true é obrigatório aqui — o teste derruba e ressobe o PostgreSQL na etapa de falha;
  // persistent: false apaga os dados no stop. A limpeza final é o rm da pasta temporária.
  const pg = new EmbeddedPostgres({ databaseDir: join(dir, "pg"), port: pgPort, user: "stylo", password: "stylo-test", persistent: true });
  try { await pg.initialise(); await pg.start(); } catch (err) {
    t.skip(`PostgreSQL descartável indisponível nesta plataforma: ${err.message}`);
    return;
  }
  t.after(async () => { await pg.stop().catch(() => {}); });
  await pg.createDatabase('stylo_validacao');

  // 2. migrações (mesmos arquivos SQL que o caminho PGlite aplica)
  const client = pg.getPgClient('stylo_validacao');
  await client.connect();
  try {
    await client.query('CREATE TABLE IF NOT EXISTS "_stylo_migrations" (name text PRIMARY KEY)');
    const done = new Set((await client.query('SELECT name FROM "_stylo_migrations"')).rows.map((r) => r.name));
    for (const m of await migrationSql()) {
      if (done.has(m.name)) continue;
      await client.query(m.sql);
      await client.query('INSERT INTO "_stylo_migrations" (name) VALUES ($1)', [m.name]);
    }
  } finally { await client.end(); }

  const dbUrl = `postgresql://stylo:stylo-test@127.0.0.1:${pgPort}/stylo_validacao`;

  // 3. servidor no PostgreSQL: setup de conta, usuário, projeto e agente
  const first = await startStylo(t, dbUrl, dir);
  const owner = await call(first.base, 'POST', '/api/auth/setup', { email: 'owner@stylo.test', name: 'Owner', password: 'senha-owner-segura' });
  assert.equal(owner.status, 201, 'setup no PostgreSQL');
  const ownerCookie = owner.cookie;

  const created = await call(first.base, 'POST', '/api/users', { email: 'editor@stylo.test', name: 'Editor', role: 'EDITOR' }, ownerCookie);
  assert.equal(created.status, 201, 'criação de usuário no PostgreSQL');
  let editor = await call(first.base, 'POST', '/api/auth/login', { email: 'editor@stylo.test', password: created.json.temporaryPassword });
  assert.equal(editor.status, 200);
  const changed = await call(first.base, 'POST', '/api/me/password', { current: created.json.temporaryPassword, next: 'senha-editor-segura' }, editor.cookie);
  assert.equal(changed.status, 200, 'troca de senha no PostgreSQL');

  const project = await call(first.base, 'PUT', '/api/projects/controle.json', doc, ownerCookie);
  assert.equal(project.status, 200, 'projeto gravado no PostgreSQL');

  // agente com token: entra pelo MCP com Bearer e vê o projeto
  const agent = await call(first.base, 'POST', '/api/agents', { name: 'Agente PG', type: 'codex' }, ownerCookie);
  assert.equal(agent.status, 201);
  const grant = await call(first.base, 'POST', `/api/agents/${agent.json.agent.id}/projects`, { file: 'controle.json' }, ownerCookie);
  assert.equal(grant.status, 200);
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const mcp = new Client({ name: 'validacao-pg', version: '1.0.0' });
  await mcp.connect(new StreamableHTTPClientTransport(new URL(first.base + '/mcp'), { requestInit: { headers: { authorization: `Bearer ${agent.json.token}` } } }));
  t.after(() => mcp.close());
  const listed = JSON.parse((await mcp.callTool({ name: 'list_projects', arguments: {} })).content.find((c) => c.type === 'text').text);
  assert.ok(listed.projects.some((p) => p.file === 'controle.json'), 'agente MCP com bearer lista o projeto no PostgreSQL');

  // o dono abre o projeto na sua sessão do Studio e compartilha com a editora (papéis DOC-SERVER-004)
  await call(first.base, 'POST', '/api/studio/call', { sid: 'aba-do-dono', tool: 'open_project', args: { file: 'controle.json' } }, ownerCookie);
  const shared = await call(first.base, 'POST', '/api/studio/call', { sid: 'aba-do-dono', tool: 'share_project', args: { email: 'editor@stylo.test', role: 'EDITOR' } }, ownerCookie);
  assert.equal(shared.status, 200, 'dono compartilha o projeto (PostgreSQL)');

  // duas sessões no mesmo projeto se veem (PGlite externo, não memória)
  const seenByEditor = await call(first.base, 'GET', '/api/projects/controle.json', undefined, editor.cookie);
  assert.equal(seenByEditor.status, 200, 'segunda sessão lê o projeto gravado pela primeira');

  // 4. reinício com o MESMO banco: persistência e reconexão
  first.child.kill();
  await new Promise((r) => setTimeout(r, 500));
  const second = await startStylo(t, dbUrl, dir);
  const relogin = await call(second.base, 'POST', '/api/auth/login', { email: 'owner@stylo.test', password: 'senha-owner-segura' });
  assert.equal(relogin.status, 200, 'conta sobrevive ao reinício do servidor');
  const survived = await call(second.base, 'GET', '/api/projects/controle.json', undefined, relogin.cookie);
  assert.equal(survived.status, 200, 'projeto sobrevive ao reinício (persistência real no PostgreSQL)');
  const sessionsKept = await call(second.base, 'GET', '/api/agents', undefined, relogin.cookie);
  assert.ok(sessionsKept.json.some((a) => a.name === 'Agente PG'), 'agente sobrevive ao reinício');

  // 5. falha de conexão: derrubar o PostgreSQL não derruba o servidor; recupera ao voltar
  await pg.stop();
  await new Promise((r) => setTimeout(r, 800));
  const healthDown = await call(second.base, 'GET', '/api/health');
  assert.equal(healthDown.status, 503, 'health acusa o banco fora do ar');
  assert.equal(healthDown.json.ok, false);
  const duringOutage = await call(second.base, 'GET', '/api/projects', undefined, relogin.cookie);
  assert.ok(duringOutage.status >= 500 && duringOutage.status < 600 && duringOutage.json?.error, 'chamada na queda devolve erro JSON limpo');
  const stillUp = await call(second.base, 'GET', '/api/status');
  assert.equal(stillUp.status, 200, 'servidor segue de pé durante a queda do banco');

  await pg.start();
  await new Promise((r) => setTimeout(r, 1500));
  const healthBack = await call(second.base, 'GET', '/api/health');
  assert.equal(healthBack.status, 200, 'health se recupera quando o PostgreSQL volta');
  assert.equal(healthBack.json.database.engine, 'postgresql');
  const projectBack = await call(second.base, 'GET', '/api/projects/controle.json', undefined, relogin.cookie);
  assert.equal(projectBack.status, 200, 'projeto acessível após a recuperação');
});
