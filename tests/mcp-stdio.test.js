import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

test('ponte stdio MCP mostra status e motivo de respostas HTTP inesperadas', async (t) => {
  const server = createServer((_req, res) => { res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Acesso negado.'); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const { port } = server.address();
  const child = spawn(process.execPath, ['scripts/mcp.mjs'], {
    env: { ...process.env, DESIGNER_URL: `http://127.0.0.1:${port}` },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stdin.end(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })}\n`);
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  assert.equal(code, 0);
  const response = JSON.parse(stdout.trim());
  assert.equal(response.id, 1);
  assert.match(response.error.message, /HTTP 403/);
  assert.match(response.error.message, /Acesso negado/);
});
