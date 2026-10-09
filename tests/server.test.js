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

test('salvar acusa conflito mesmo com a MESMA data (disco exFAT/FAT de data grosseira)', async (t) => {
  const { mkdtemp, writeFile, readFile, stat, utimes, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'stylo-conflito-'));
  const configFile = join(dir, 'config.json');
  await writeFile(configFile, JSON.stringify({ folder: join(dir, 'projetos') }));
  const port = await unusedPort();
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.js', import.meta.url))], {
    env: { ...process.env, PORT: String(port), DESIGNER_CONFIG: configFile }, stdio: 'ignore',
  });
  t.after(async () => { child.kill(); await rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}/api/projects/teste.json`;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break; } catch { await new Promise((r) => setTimeout(r, 25)); } }
  const doc = (name) => JSON.stringify({ name, pages: [{ id: 'p', name: 'P', children: [] }] });
  const put = (body, mod) => fetch(base, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(mod ? { 'X-Base-Modified': String(mod) } : {}) }, body });
  const first = await (await put(doc('A'))).json();
  // alguém de fora muda o arquivo e a data fica IGUAL (como num disco de data grosseira)
  const file = join(dir, 'projetos', 'teste.json');
  const before = await stat(file);
  await writeFile(file, doc('mudado por fora'));
  await utimes(file, before.atime, before.mtime);
  const r = await put(doc('B'), first.modified);
  assert.equal(r.status, 409, 'deve acusar conflito');
  assert.match(await readFile(file, 'utf8'), /mudado por fora/, 'o arquivo de fora fica intacto');
  // a pessoa recarrega a versão do disco e salva de novo
  const ok = await put(doc('C'), (await (await fetch(base)).headers.get('X-Modified')));
  assert.equal(ok.status, 200, 'depois de avisado e de recarregar, salvar volta a funcionar');
});
