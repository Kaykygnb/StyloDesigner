// Testes de segurança do servidor local: origem exata (porta incluída) e limite de corpo por rota.
// Sobe o servidor real com configuração e pasta TEMPORÁRIAS (nunca toca nos projetos de ninguém).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createProbeServer } from 'node:net';
import { request } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

async function unusedPort() {
  const probe = createProbeServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  probe.close();
  await once(probe, 'close');
  return port;
}

/** Sobe o servidor e devolve `call(method, path, body, headers)`; usa http.request porque o fetch não deixa fixar `Origin`. */
async function startServer(t) {
  const tmp = await mkdtemp(join(tmpdir(), 'designer-seg-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const port = await unusedPort();
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.js', import.meta.url))], {
    env: { ...process.env, PORT: String(port), DESIGNER_CONFIG: join(tmp, 'config.json') },
    stdio: 'ignore',
  });
  t.after(() => child.kill());
  const call = (method, path, body, headers = {}) => new Promise((resolve, reject) => {
    const data = body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body);
    const req = request({ host: '127.0.0.1', port, method, path, headers: { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...headers } }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    // o servidor pode fechar a conexão antes de o cliente terminar de enviar um corpo grande: conta como recusa (status 0)
    req.on('error', (err) => (err.code === 'ECONNRESET' || err.code === 'EPIPE' ? resolve({ status: 0, text: '' }) : reject(err)));
    req.end(data);
  });
  for (let i = 0; i < 100; i++) {
    try { if ((await call('GET', '/api/status')).status === 200) break; } catch { await new Promise((r) => setTimeout(r, 25)); }
  }
  // pasta de projetos TEMPORÁRIA: sem isso o servidor usaria ./projetos do repositório
  assert.equal((await call('PUT', '/api/config', { folder: join(tmp, 'projetos') })).status, 200);
  return { port, call };
}

test('origem: só a página do próprio servidor (mesma porta) escreve; outra porta de localhost é recusada', async (t) => {
  const { port, call } = await startServer(t);
  const own = `http://localhost:${port}`;
  const other = `http://localhost:${port + 1}`;
  const cfg = { keepVersions: 7 };

  assert.equal((await call('PUT', '/api/config', cfg, { Origin: other })).status, 403, 'localhost em outra porta não pode alterar a configuração');
  assert.equal((await call('PUT', '/api/config', cfg, { Origin: 'https://exemplo.com' })).status, 403, 'site externo não pode');
  assert.equal((await call('PUT', '/api/config', cfg, { Origin: own })).status, 200, 'a própria página pode');
  assert.equal((await call('PUT', '/api/config', cfg, { Origin: `http://127.0.0.1:${port}` })).status, 200, '127.0.0.1 na mesma porta também');
  assert.equal((await call('PUT', '/api/config', cfg)).status, 200, 'sem Origin (curl, MCP stdio, testes) continua aceito');
});

test('origem: /mcp e o modo administrador do MCP recusam página de outra porta', async (t) => {
  const { port, call } = await startServer(t);
  const other = `http://localhost:${port + 1}`;
  const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} };
  assert.equal((await call('POST', '/mcp', init, { Origin: other })).status, 403);
  assert.equal((await call('POST', '/mcp', init, { Origin: `http://localhost:${port}` })).status, 200);
  assert.equal((await call('PUT', '/api/agent/mcp', { admin: true }, { Origin: other })).status, 403, 'outra página não liga o acesso de administrador');
  const state = JSON.parse((await call('GET', '/api/agent/mcp')).text);
  assert.equal(Boolean(state.admin), false);
});

test('limite de corpo por rota: configuração aceita pouco; projeto aceita muito', async (t) => {
  const { call } = await startServer(t);
  const big = (n) => ({ folder: '', pad: 'x'.repeat(n) });
  const refused = (await call('PUT', '/api/config', big(2 * 1024 * 1024))).status;
  assert.ok(refused === 413 || refused === 0, `2 MB em /api/config é abuso e deve ser recusado (status ${refused})`);
  const doc = { name: 'Grande', pages: [{ id: 'p1', name: 'P', children: [] }], assets: { a: 'x'.repeat(3 * 1024 * 1024) }, styles: { colors: [], texts: [] } };
  assert.equal((await call('PUT', '/api/projects/grande.json', doc)).status, 200, 'um projeto com 3 MB de imagem continua válido');
});

test('DNS rebinding: Host que não é desta máquina é recusado, com ou sem Origin', async (t) => {
  const { port, call } = await startServer(t);
  assert.equal((await call('GET', '/api/status', undefined, { Host: `atacante.example:${port}` })).status, 403);
  assert.equal((await call('PUT', '/api/config', { keepVersions: 3 }, { Host: `atacante.example:${port}` })).status, 403);
  assert.equal((await call('GET', '/api/status')).status, 200);
});
