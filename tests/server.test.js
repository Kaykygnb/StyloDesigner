import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isolatedServerEnv } from './helpers/test-env.mjs';
import { cleanupFixture } from './helpers/fixture-lifecycle.mjs';
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
  const tmp = await mkdtemp(join(tmpdir(), 'designer-server-'));
  const fixture = { dir: tmp, children: [], clients: [] };
  t.after(() => cleanupFixture(fixture));
  const port = await unusedPort();
  const serverPath = fileURLToPath(new URL('../apps/server/src/main.ts', import.meta.url));
  const child = spawn(process.execPath, ['--import', 'tsx', serverPath], {
    env: isolatedServerEnv({ PORT: String(port), DESIGNER_CONFIG: join(tmp, 'config.json'), STYLO_DEV: '1' }),
    stdio: 'ignore',
  });
  fixture.children.push(child);

  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 800 && !ready; attempt++) {
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`);
    try {
      ready = (await fetch(base)).status === 200;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  assert.equal(ready, true, 'server should start and serve the app shell');

  // codex: cobre assets aninhados e tentativas comuns de sair da allowlist em Windows e Unix.
  for (const path of ['/studio/', '/studio/src/main.tsx', '/studio/src/styles/app.css', '/studio/src/ui/Icon.tsx']) {
    assert.equal((await fetch(`${base}${path}`)).status, 200, `${path} should be served`);
  }
  for (const path of [
    '/studio/package.json',
    '/studio/vite.config.ts',
    '/studio/.env',
    '/.git/config',
    '/server.js',
    '/tests/css.test.js',
    '/studio/src/../package.json',
    '/%2e%2e/package.json',
    '/studio/src/%5c..%5cpackage.json',
    '/studio/src/nao-existe.tsx',
  ]) {
    assert.equal((await fetch(`${base}${path}`)).status, 404, `${path} should be blocked or missing`);
  }
});
