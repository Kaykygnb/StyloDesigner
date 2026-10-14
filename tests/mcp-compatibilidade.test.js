// Testes de compatibilidade MCP com CLIENTE EXTERNO SEM SDK (DOC-MCP-001).
// Fala JSON-RPC 2.0 cru sobre POST /mcp com fetch — o mesmo subconjunto de protocolo que
// qualquer integração customizada (n8n, script próprio, agente hosted) precisa implementar:
// initialize, tools/list, tools/call, sessão por Mcp-Session-Id, texto/erro e encerramento.
// Conteúdo de IMAGEM fica como lacuna explícita: só get_image produz e ele exige renderer
// com navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { cleanupFixture } from './helpers/fixture-lifecycle.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const freePort = () => new Promise((resolve) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

async function startServer(t, inheritedEnv = process.env) {
  const tmp = await mkdtemp(join(tmpdir(), 'stylo-mcp-cru-'));
  const fixture = { dir: tmp, children: [] };
  t.after(() => cleanupFixture(fixture));
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../apps/server/src/main.ts', import.meta.url))], {
    env: { ...inheritedEnv, PORT: String(port), DESIGNER_CONFIG: join(tmp, 'config.json'), DESIGNER_DB: 'memory', STYLO_AUTH: 'local', STYLO_BLOB_DIR: 'memory', STYLO_DEV: '0', STYLO_SECRET_KEY: randomBytes(32).toString('base64') }, stdio: 'ignore',
  });
  fixture.children.push(child);
  let startupError;
  child.once('error', (error) => { startupError = error; });
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (startupError) throw startupError;
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Servidor de teste encerrou antes de ficar pronto.');
    try { if ((await fetch(base + '/api/status', { signal: AbortSignal.timeout(1000) })).ok) return base; } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('O servidor de teste não subiu em 60 s.');
}

/** Cliente MCP mínimo, sem SDK: POST JSON-RPC e cabeçalho Mcp-Session-Id após o initialize. */
function rawClient(base, name = 'cliente-cru') {
  const url = base + '/mcp';
  let sid = '';
  let nextId = 0;
  const rpc = async (method, params, { expectError = false } = {}) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(sid ? { 'mcp-session-id': sid } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++nextId, method, params }),
    });
    const sessionHeader = response.headers.get('mcp-session-id');
    if (sessionHeader) sid = sessionHeader;
    const body = await response.json();
    if (!expectError) assert.equal(body.error, undefined, `${method}: ${JSON.stringify(body.error)}`);
    return { status: response.status, body };
  };
  return {
    initialize: () => rpc('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name, version: '0.0.1' },
    }),
    listTools: () => rpc('tools/list', {}),
    callTool: (name, args, options) => rpc('tools/call', { name, arguments: args }, options),
    ping: () => rpc('ping', {}),
    close: async () => {
      const response = await fetch(url, { method: 'DELETE', headers: { 'mcp-session-id': sid } });
      return response.status;
    },
    sessionId: () => sid,
    postRaw: (text, headers = {}) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: text }),
  };
}

const textOf = (body) => JSON.parse(body.result.content.find((c) => c.type === 'text').text);

test('cliente externo sem SDK: initialize, tools/list, tools/call, erros de protocolo e sessão por cabeçalho', async (t) => {
  const base = await startServer(t);
  const client = rawClient(base, 'integracao-custom');

  // pedido que não é initialize sem sessão: recusado com orientação
  const noSession = await client.postRaw(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }));
  assert.equal(noSession.status, 400);
  assert.match((await noSession.json()).error, /Mcp-Session-Id ausente/);

  // JSON inválido: erro de protocolo -32700
  const badJson = await client.postRaw('{json quebrado');
  assert.equal(badJson.status, 400);
  assert.equal((await badJson.json()).error.code, -32700);

  // initialize: devolve sessão, identidade do servidor, capacidades e instruções
  const init = await client.initialize();
  assert.equal(init.status, 200);
  assert.ok(client.sessionId(), 'initialize devolve o cabeçalho Mcp-Session-Id');
  assert.equal(init.body.result.serverInfo.name, 'projeto-designer');
  assert.equal(init.body.result.protocolVersion, '2025-11-25');
  assert.ok(init.body.result.capabilities.tools);
  assert.match(init.body.result.instructions, /new_project/);

  // tools/list pela sessão aberta
  const tools = await client.listTools();
  assert.equal(tools.body.result.tools.length, 120);

  // tools/call: resultado em texto JSON, sem isError
  const scale = await client.callTool('color_scale', { color: '#2F6AE0' });
  assert.equal(scale.body.result.isError, false);
  assert.equal(textOf(scale.body).scale.length, 11);

  // erro de ferramenta volta como resultado com isError (texto legível pela IA)
  const created = await client.callTool('new_project', { name: 'Cliente Cru' });
  assert.equal(created.body.result.isError, false, JSON.stringify(created.body));
  const missing = await client.callTool('get_layer', { id: 'nao-existe' });
  assert.equal(missing.body.result.isError, true);
  assert.match(textOf(missing.body).error, /não existe/);

  // ferramenta inexistente: erro de protocolo -32602 (não cai no transporte)
  const unknown = await client.callTool('rm_rf', {}, { expectError: true });
  assert.equal(unknown.body.error.code, -32602);
  assert.match(unknown.body.error.message, /Ferramenta desconhecida/);

  await client.ping();

  // DELETE encerra a sessão: a mesma sessão deixa de responder
  assert.equal(await client.close(), 200);
  const afterClose = await client.postRaw(JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'tools/list', params: {} }), { 'mcp-session-id': client.sessionId() });
  assert.equal(afterClose.status, 404);
});

test('cliente externo sem SDK: sessões diferentes não misturam o projeto atual e aparecem na presença pelo nome do cliente', async (t) => {
  const base = await startServer(t);
  const a = rawClient(base, 'agente-a');
  const b = rawClient(base, 'agente-b');
  await a.initialize();
  await b.initialize();

  const created = await a.callTool('new_project', { name: 'Sessão A' });
  assert.equal(created.body.result.isError, false, JSON.stringify(created.body));

  const semProjeto = await b.callTool('get_document', {});
  assert.equal(semProjeto.body.result.isError, true);
  assert.match(textOf(semProjeto.body).error, /Nenhum projeto aberto/);

  const opened = await b.callTool('open_project', { file: 'sessao-a.json' });
  assert.equal(opened.body.result.isError, false, JSON.stringify(opened.body));
  const document = await b.callTool('get_document', {});
  assert.equal(document.body.result.isError, false, JSON.stringify(document.body));
  assert.ok(textOf(document.body).pages.length >= 1);

  const presence = await (await fetch(base + '/api/presence')).json();
  assert.deepEqual(presence.agents.map((x) => x.name).sort(), ['agente-a', 'agente-b']);

  await a.close();
  await b.close();
});


test('fixture MCP ignora blobs e segredo herdados', async (t) => {
  const base = await startServer(t, { ...process.env, STYLO_BLOB_DIR: '/nao-usar-blobs-herdados', STYLO_SECRET_KEY: 'segredo-invalido' });
  const health = await (await fetch(base + '/api/health')).json();
  assert.equal(health.database.engine, 'sqlite');
  const client = rawClient(base, 'fixture-isolado');
  await client.initialize();
  try {
    const created = await client.callTool('new_project', { name: 'Isolado' });
    assert.equal(created.body.result.isError, false);
  } finally { await client.close(); }
});
