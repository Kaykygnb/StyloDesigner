// Gravação atômica de arquivos de configuração: nunca deixa JSON truncado, serializa gravações concorrentes
// e não deixa arquivo temporário para trás.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer as createProbeServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { writeJsonAtomic } from '../server/atomic.js';

test('writeJsonAtomic: 50 gravações concorrentes terminam num JSON válido, a última vence, sem .tmp', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'designer-atomic-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'config.json');
  await Promise.all(Array.from({ length: 50 }, (_, i) => writeJsonAtomic(file, { n: i, pad: 'x'.repeat(5000) })));
  const saved = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(saved.n, 49, 'a ordem de chamada é a ordem de gravação');
  assert.deepEqual((await readdir(dir)).filter((f) => f.endsWith('.tmp')), []);
});

test('writeJsonAtomic: falha não corrompe o arquivo anterior nem deixa .tmp', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'designer-atomic-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'config.json');
  await writeJsonAtomic(file, { ok: 1 });
  const circular = {}; circular.self = circular;
  await assert.rejects(() => writeJsonAtomic(file, circular));
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { ok: 1 });
  await assert.rejects(() => writeJsonAtomic(join(dir, 'nao-existe', 'x.json'), { a: 1 }));
  assert.deepEqual((await readdir(dir)).filter((f) => f.endsWith('.tmp')), []);
  await writeJsonAtomic(file, { ok: 2 }); // a fila continua funcionando depois de uma falha
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { ok: 2 });
});

test('servidor: configuração corrompida vira cópia .corrompido e o servidor sobe com o padrão', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'designer-atomic-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cfg = join(dir, 'config.json');
  await writeFile(cfg, '{"pexels":{"apiKey":"abc"},"folder":'); // truncado no meio
  const probe = createProbeServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  probe.close();
  await once(probe, 'close');
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.js', import.meta.url))], { env: { ...process.env, PORT: String(port), DESIGNER_CONFIG: cfg }, stdio: 'ignore' });
  t.after(() => child.kill());
  let ok = false;
  for (let i = 0; i < 100 && !ok; i++) {
    try { ok = (await fetch(`http://127.0.0.1:${port}/api/status`)).ok; } catch { await new Promise((r) => setTimeout(r, 25)); }
  }
  assert.ok(ok, 'o servidor sobe mesmo com a configuração quebrada');
  const backups = (await readdir(dir)).filter((f) => f.startsWith('config.json.corrompido'));
  assert.equal(backups.length, 1, 'o conteúdo antigo (com a chave) foi preservado');
  assert.match(await readFile(join(dir, backups[0]), 'utf8'), /"apiKey":"abc"/);
});
