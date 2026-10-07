import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createProbeServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
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

test('servidor entrega assets, bloqueia arquivos privados e traversal', async (t) => {
  // codex: escolhe uma porta livre e espera o servidor ficar pronto para evitar colisões entre execuções.
  const port = await unusedPort();
  const serverPath = fileURLToPath(new URL('../server.js', import.meta.url));
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });
  t.after(() => child.kill());

  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100 && !ready; attempt++) {
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`);
    try {
      ready = (await fetch(base)).status === 200;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  assert.equal(ready, true, 'server should start and serve the app shell');

  // codex: cobre assets aninhados e tentativas comuns de sair da allowlist em Windows e Unix.
  for (const path of ['/', '/src/main.js', '/src/styles/app.css', '/src/ui/props.js']) {
    assert.equal((await fetch(`${base}${path}`)).status, 200, `${path} should be served`);
  }
  for (const path of [
    '/package.json',
    '/.git/config',
    '/server.js',
    '/tests/css.test.js',
    '/src/../package.json',
    '/%2e%2e/package.json',
    '/src/%5c..%5cpackage.json',
    '/src/nao-existe.js',
  ]) {
    assert.equal((await fetch(`${base}${path}`)).status, 404, `${path} should be blocked or missing`);
  }
});
