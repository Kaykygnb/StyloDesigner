// Biblioteca da conta e chaves dos provedores por HTTP (o que a interface usa), com o servidor real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const freePort = () => new Promise((resolve) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('HTTP: envia arquivo para a biblioteca, lista, baixa com o tipo certo, remove; chave do provedor é guardada e nunca devolvida', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'stylo-lib-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../apps/server/src/main.ts', import.meta.url))], {
    env: { ...process.env, PORT: String(port), DESIGNER_CONFIG: join(tmp, 'config.json'), DESIGNER_DB_DIR: 'memory', STYLO_BLOB_DIR: 'memory', STYLO_SECRET_KEY: Buffer.alloc(32, 7).toString('base64'), PEXELS_API_KEY: '', PIXABAY_API_KEY: '' },
    stdio: 'ignore',
  });
  t.after(() => child.kill());
  const base = `http://127.0.0.1:${port}`;
  // espera o servidor subir (até 60 s: sob carga o PGlite e o Vite demoram) e falha clara se não subir
  for (let i = 0, up = false; !up; i++) {
    if (i > 2400) throw new Error('o servidor de teste não subiu em 60 s');
    try { up = (await fetch(base + '/api/status')).ok; } catch { /* ainda subindo */ }
    if (!up) await new Promise((r) => setTimeout(r, 25));
  }

  // envio dos bytes (não é JSON): tipo e tamanho vêm do conteúdo
  const up = await fetch(base + '/api/library', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Name': encodeURIComponent('Logo da Loja'), 'X-Tags': 'marca,logo', 'X-License': encodeURIComponent('comprado'), 'X-Credit': encodeURIComponent('Logo por Fulano') }, body: PNG });
  assert.equal(up.status, 201);
  const { asset, existed } = await up.json();
  assert.deepEqual([asset.kind, asset.mime, asset.name, existed], ['IMAGE', 'image/png', 'Logo da Loja', false]);
  assert.deepEqual(asset.tags, ['marca', 'logo']);
  assert.equal((await fetch(base + '/api/library', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Name': 'Dup' }, body: PNG })).status, 200, 'o mesmo arquivo não duplica');
  assert.equal((await fetch(base + '/api/library', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: PNG })).status, 400, 'sem nome');
  assert.equal((await fetch(base + '/api/library', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Name': 'x' }, body: new Uint8Array(0) })).status, 400, 'vazio');
  assert.equal((await fetch(base + '/api/library', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Name': 'x', Origin: 'https://site-malicioso.com' }, body: PNG })).status, 403, 'outra origem não envia');

  const list = await (await fetch(base + '/api/library?kind=image')).json();
  assert.equal(list.assets.length, 1);
  assert.equal(list.usage.count, 1);
  assert.equal((await fetch(base + '/api/library?kind=nada')).status, 400);

  const file = await fetch(`${base}/api/library/${asset.id}/file`);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'image/png');
  assert.match(file.headers.get('content-security-policy'), /sandbox/);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), PNG);
  assert.equal((await fetch(`${base}/api/library/00000000-0000-0000-0000-000000000000/file`)).status, 404);

  // provedores e chaves
  const providers = (await (await fetch(base + '/api/providers')).json()).providers;
  const pexels = providers.find((p) => p.id === 'pexels');
  assert.deepEqual([pexels.ready, pexels.hasKey, pexels.needsKey.envVar], [false, false, 'PEXELS_API_KEY']);
  const json = { 'Content-Type': 'application/json' };
  assert.equal((await fetch(base + '/api/providers/pexels/key', { method: 'PUT', headers: json, body: JSON.stringify({ key: 'curta' }) })).status, 400);
  assert.equal((await fetch(base + '/api/providers/openverse/key', { method: 'PUT', headers: json, body: JSON.stringify({ key: 'x'.repeat(20) }) })).status, 404, 'provedor sem chave');
  const saved = await fetch(base + '/api/providers/pexels/key', { method: 'PUT', headers: json, body: JSON.stringify({ key: 'CHAVE-SUPER-SECRETA-123' }) });
  assert.equal(saved.status, 200);
  assert.equal((await saved.text()).includes('SUPER-SECRETA'), false, 'a resposta não repete a chave');
  const after = await (await fetch(base + '/api/providers')).text();
  assert.equal(after.includes('SUPER-SECRETA'), false);
  assert.equal(JSON.parse(after).providers.find((p) => p.id === 'pexels').ready, true);
  await fetch(base + '/api/providers/pexels/key', { method: 'DELETE', headers: json });
  assert.equal((await (await fetch(base + '/api/providers')).json()).providers.find((p) => p.id === 'pexels').ready, false);

  assert.equal((await fetch(`${base}/api/library/${asset.id}`, { method: 'DELETE', headers: json })).status, 200);
  assert.equal((await (await fetch(base + '/api/library')).json()).assets.length, 0);
});
