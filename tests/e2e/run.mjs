// Ambiente accounts descartável; APP_URL explícito conserva o modo de integração externo.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, open, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = resolve(process.env.STYLO_E2E_ARTIFACTS || join(root, 'capturas/e2e'));
await mkdir(artifacts, { recursive: true });
const abort = new AbortController();
const interrupt = () => abort.abort(new Error('E2E interrompido.'));
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);

function launch(script, env, stdio) {
  const child = spawn(process.execPath, script, { cwd: root, env, stdio });
  const exited = new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
    child.once('error', (error) => resolve({ error }));
  });
  return { child, exited };
}

async function stop(process) {
  if (!process || process.child.exitCode !== null || process.child.signalCode !== null) return;
  process.child.kill('SIGTERM');
  const timer = setTimeout(() => process.child.kill('SIGKILL'), 5000);
  try { await process.exited; } finally { clearTimeout(timer); }
}

async function freePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitReady(base, server) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    abort.signal.throwIfAborted();
    if (server.child.exitCode !== null || server.child.signalCode !== null) throw new Error('Servidor E2E encerrou antes de ficar pronto; veja capturas/e2e/server.log.');
    try {
      const response = await fetch(new URL('/api/auth/state', base), { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        const state = await response.json();
        if (state.mode !== 'accounts' || state.hasAccounts) throw new Error('Servidor E2E precisa iniciar em accounts com banco vazio.');
        return;
      }
    } catch (error) {
      if (/Servidor E2E precisa/.test(error.message)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Servidor E2E não ficou pronto em 60 s; veja capturas/e2e/server.log.');
}

async function runSuite(file, env) {
  abort.signal.throwIfAborted();
  const test = launch([file], env, 'inherit');
  let timer;
  let onAbort;
  try {
    const result = await Promise.race([
      test.exited,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${file}: limite de 3 minutos excedido.`)), 180000); }),
      new Promise((_, reject) => { onAbort = () => reject(abort.signal.reason); abort.signal.addEventListener('abort', onAbort, { once: true }); }),
    ]);
    if (result.error) throw result.error;
    if (result.code !== 0) throw new Error(`${file}: falhou (${result.signal || result.code}).`);
  } finally {
    clearTimeout(timer);
    abort.signal.removeEventListener('abort', onAbort);
    await stop(test);
  }
}

let dir;
let server;
let log;
try {
  let base = process.env.APP_URL;
  if (!base) {
    dir = await mkdtemp(join(tmpdir(), 'stylo-e2e-'));
    const port = await freePort();
    base = `http://127.0.0.1:${port}/`;
    log = await open(join(artifacts, 'server.log'), 'w');
    server = launch(['--import', 'tsx', 'apps/server/src/main.ts'], {
      ...process.env, PORT: String(port), STYLO_AUTH: 'accounts', STYLO_DEV: '0',
      DESIGNER_CONFIG: join(dir, 'config.json'), DESIGNER_DB: join(dir, 'db'), STYLO_BLOB_DIR: join(dir, 'blobs'),
      STYLO_SECRET_KEY: randomBytes(32).toString('base64'),
    }, ['ignore', log.fd, log.fd]);
    await waitReady(base, server);
    console.log('E2E: servidor accounts isolado pronto.');
  }
  const env = { ...process.env, APP_URL: base, STYLO_E2E_ARTIFACTS: artifacts };
  await runSuite('tests/e2e/studio-admin-fluxo.mjs', env);
  await runSuite('tests/e2e/studio-login-fluxo.mjs', env);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await stop(server);
  await log?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', interrupt);
}
