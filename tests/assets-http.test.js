import { isolatedServerEnv } from './helpers/test-env.mjs';
import { cleanupFixture } from './helpers/fixture-lifecycle.mjs';
// Imagens por HTTP: o editor grava o projeto com data URLs; o servidor guarda as imagens fora do JSON, devolve data URLs
// ao ler e serve cada imagem por endereço (sha256).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const freePort = () => new Promise((resolve) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('projeto com imagem: ler devolve data URL e a imagem sai por /assets/<sha256> com cache imutável', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'stylo-assets-'));
  const fixture = { dir: tmp, children: [], clients: [] };
  t.after(() => cleanupFixture(fixture));
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../apps/server/src/main.ts', import.meta.url))], {
    env: isolatedServerEnv({ PORT: String(port), DESIGNER_CONFIG: join(tmp, 'config.json'), DESIGNER_DB: 'memory', STYLO_AUTH: 'local' }), stdio: 'ignore',
  });
  fixture.children.push(child);
  const base = `http://127.0.0.1:${port}`;
  // espera o servidor subir (até 60 s: sob carga o servidor e o Vite demoram) e falha clara se não subir
  for (let i = 0, up = false; !up; i++) {
    if (i > 2400) throw new Error('o servidor de teste não subiu em 60 s');
    try { up = (await fetch(base + '/api/status')).ok; } catch { /* ainda subindo */ }
    if (!up) await new Promise((r) => setTimeout(r, 25));
  }
  const dataUrl = `data:image/png;base64,${PNG_B64}`;
  const doc = { name: 'Com foto', pages: [{ id: 'p1', name: 'P', children: [] }], assets: { foto: dataUrl }, styles: { colors: [], texts: [] } };
  const put = await fetch(base + '/api/projects/com-foto.json', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) });
  assert.equal(put.status, 200);

  const got = await (await fetch(base + '/api/projects/com-foto.json')).json();
  assert.equal(got.assets.foto, dataUrl, 'o editor recebe o data URL de volta');

  const bytes = Buffer.from(PNG_B64, 'base64');
  const hash = createHash('sha256').update(bytes).digest('hex');
  const img = await fetch(`${base}/api/projects/com-foto.json/assets/${hash}`);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.match(img.headers.get('cache-control'), /immutable/);
  assert.match(img.headers.get('content-security-policy'), /sandbox/);
  assert.deepEqual(Buffer.from(await img.arrayBuffer()), bytes);

  assert.equal((await fetch(`${base}/api/projects/com-foto.json/assets/nao-e-hash`)).status, 400);
  assert.equal((await fetch(`${base}/api/projects/com-foto.json/assets/${'0'.repeat(64)}`)).status, 404);
  assert.equal((await fetch(`${base}/api/projects/outro.json/assets/${hash}`)).status, 404);
});
