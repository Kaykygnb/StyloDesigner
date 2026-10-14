import { isolatedServerEnv } from './helpers/test-env.mjs';
import { cleanupFixture } from './helpers/fixture-lifecycle.mjs';
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
const WOFF = Buffer.from([0x77, 0x4f, 0x46, 0x46, 0, 1, 0, 0, 0, 0, 0, 0]);

test('HTTP: envia arquivo para a biblioteca, lista, baixa com o tipo certo, remove; chave do provedor é guardada e nunca devolvida', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'stylo-lib-'));
  const fixture = { dir: tmp, children: [], clients: [] };
  t.after(() => cleanupFixture(fixture));
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../apps/server/src/main.ts', import.meta.url))], {
    env: isolatedServerEnv({ PORT: String(port), DESIGNER_CONFIG: join(tmp, 'config.json'), DESIGNER_DB: 'memory', STYLO_AUTH: 'local', STYLO_BLOB_DIR: 'memory', STYLO_SECRET_KEY: Buffer.alloc(32, 7).toString('base64'), PEXELS_API_KEY: '', PIXABAY_API_KEY: '' }),
    stdio: 'ignore',
  });
  fixture.children.push(child);
  const base = `http://127.0.0.1:${port}`;
  // espera o servidor subir (até 60 s: sob carga o servidor e o Vite demoram) e falha clara se não subir
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
  const usage = await (await fetch(`${base}/api/library/usage-detail`)).json();
  assert.deepEqual(usage.assets.find((item) => item.assetId === asset.id), { assetId: asset.id, useCount: 0, projectIds: [], projects: [], orphan: true });
  const projectDoc = { name: 'Usa logo', pages: [{ id: 'p1', name: 'Página', children: [{ id: 'shape', type: 'rect', fill: { type: 'image', assetId: asset.id }, x: 0, y: 0, w: 10, h: 10 }] }], assets: {}, styles: { colors: [], texts: [] } };
  assert.equal((await fetch(`${base}/api/projects/usa-logo.json`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(projectDoc) })).status, 200);
  const used = await (await fetch(`${base}/api/library/usage-detail`)).json();
  const usedAsset = used.assets.find((item) => item.assetId === asset.id);
  assert.equal(usedAsset.useCount, 1);
  assert.equal(usedAsset.projects[0].file, 'usa-logo');
  const replaced = await fetch(`${base}/api/library/${asset.id}/replace`, { method: 'POST', headers: { 'Content-Type': 'font/woff', 'X-Name': encodeURIComponent('Logo atualizado') }, body: WOFF });
  assert.equal(replaced.status, 200);
  const replacedAsset = await replaced.json();
  assert.deepEqual([replacedAsset.id, replacedAsset.name, replacedAsset.mime], [asset.id, 'Logo atualizado', 'font/woff']);
  assert.equal((await (await fetch(`${base}/api/library/usage-detail`)).json()).assets.find((item) => item.assetId === asset.id).useCount, 1, 'substituição mantém o uso nos projetos');
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

  // fonte declarativa: o painel consegue cadastrar tipos, mapeamento e licença sem código executável
  const source = await fetch(base + '/api/asset-sources', { method: 'POST', headers: json, body: JSON.stringify({
    name: 'Catálogo Comunitário', searchUrl: 'https://assets.example.test/search?q={consulta}&page={pagina}',
    kinds: ['image', 'icon'], resultsPath: 'data.items',
    fields: { id: 'id', title: 'name', preview: 'thumb', download: 'file', author: 'creator', page: 'page', license: 'license' },
    headers: { Accept: 'application/json' }, license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/', commercial: true, attribution: 'required' },
  }) });
  assert.equal(source.status, 201);
  const savedSource = (await source.json());
  assert.deepEqual([savedSource.name, savedSource.kinds, savedSource.fields.preview, savedSource.license.attribution], ['Catálogo Comunitário', ['image', 'icon'], 'thumb', 'required']);
  const listedSources = await (await fetch(base + '/api/asset-sources')).json();
  assert.equal(listedSources.sources.some((item) => item.name === 'Catálogo Comunitário' && item.headers.Accept === 'application/json'), true);
  assert.equal((await fetch(base + '/api/asset-sources', { method: 'POST', headers: json, body: JSON.stringify({ name: 'Sem licença', searchUrl: 'https://assets.example.test/?q={consulta}', kinds: ['image'], resultsPath: 'items', fields: { id: 'id', title: 'title', download: 'url' } }) })).status, 400);
  assert.equal((await fetch(base + '/api/asset-sources/Cat%C3%A1logo%20Comunit%C3%A1rio', { method: 'DELETE', headers: json })).status, 200);

  const bulk = await fetch(`${base}/api/library`, { method: 'DELETE', headers: json, body: JSON.stringify({ ids: [asset.id, asset.id] }) });
  assert.equal(bulk.status, 200);
  assert.equal((await bulk.json()).count, 1, 'remoção em lote deduplica IDs');
  assert.equal((await (await fetch(base + '/api/library')).json()).assets.length, 0);
});
