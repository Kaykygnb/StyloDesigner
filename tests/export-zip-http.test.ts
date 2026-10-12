import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Execute na raiz do repositório, inclusive enquanto este teste estiver na pasta temporária.
const repo = process.cwd();
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; }
  return (crc ^ 0xffffffff) >>> 0;
}
// Leitor independente do escritor: confere diretório central, cabeçalho local, offsets e CRC.
function unzipStored(zip: Buffer): Map<string, Buffer> {
  const end = zip.length - 22;
  assert.equal(zip.readUInt32LE(end), 0x06054b50);
  assert.equal(zip.readUInt16LE(end + 4), 0); assert.equal(zip.readUInt16LE(end + 6), 0);
  const count = zip.readUInt16LE(end + 10), start = zip.readUInt32LE(end + 16);
  assert.equal(zip.readUInt16LE(end + 8), count);
  assert.equal(start + zip.readUInt32LE(end + 12), end);
  const files = new Map<string, Buffer>(); let cursor = start;
  for (let index = 0; index < count; index++) {
    assert.equal(zip.readUInt32LE(cursor), 0x02014b50);
    assert.equal(zip.readUInt16LE(cursor + 10), 0, 'ZIP Store');
    const size = zip.readUInt32LE(cursor + 24), crc = zip.readUInt32LE(cursor + 16);
    assert.equal(zip.readUInt32LE(cursor + 20), size);
    const names = zip.readUInt16LE(cursor + 28), extras = zip.readUInt16LE(cursor + 30), comments = zip.readUInt16LE(cursor + 32);
    const name = zip.subarray(cursor + 46, cursor + 46 + names).toString('utf8');
    assert.ok(/^[a-z0-9._/-]+$/i.test(name) && !name.startsWith('/') && !name.split('/').some((part) => !part || part === '..' || part === '.'));
    assert.equal(files.has(name), false);
    const offset = zip.readUInt32LE(cursor + 42);
    assert.equal(zip.readUInt32LE(offset), 0x04034b50);
    assert.equal(zip.readUInt16LE(offset + 8), 0);
    assert.equal(zip.readUInt32LE(offset + 14), crc);
    assert.equal(zip.readUInt32LE(offset + 18), size);
    const localNames = zip.readUInt16LE(offset + 26), localExtras = zip.readUInt16LE(offset + 28);
    assert.equal(zip.subarray(offset + 30, offset + 30 + localNames).toString('utf8'), name);
    const payloadStart = offset + 30 + localNames + localExtras;
    assert.ok(payloadStart + size <= start);
    const bytes = zip.subarray(payloadStart, payloadStart + size);
    assert.equal(crc32(bytes), crc, `CRC ${name}`);
    files.set(name, bytes); cursor += 46 + names + extras + comments;
  }
  assert.equal(cursor, end); return files;
}
const freePort = () => new Promise<number>((resolve) => { const server = createServer(); server.listen(0, '127.0.0.1', () => { const port = (server.address() as any).port; server.close(() => resolve(port)); }); });

test('rotas ZIP entregam HTML/React íntegros e isolam projetos por conta', { timeout: 90000 }, async (t) => {
  const { createNode, makeDoc } = await import(pathToFileURL(join(repo, 'packages/core/src/model.ts')).href);
  const temporary = await mkdtemp(join(tmpdir(), 'stylo-zip-http-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', join(repo, 'apps/server/src/main.ts')], { cwd: repo, env: { ...process.env, PORT: String(port), STYLO_AUTH: 'accounts', DESIGNER_CONFIG: join(temporary, 'config.json'), DESIGNER_DB_DIR: 'memory' }, stdio: 'ignore' });
  t.after(async () => { if (child.exitCode !== null) return; const exited = new Promise<void>((resolve) => child.once('exit', () => resolve())); child.kill(); await exited; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    if (child.exitCode !== null) throw new Error('Servidor encerrou antes de subir');
    if (i > 2400) throw new Error('Servidor não subiu em 60 segundos');
    try { if ((await fetch(base + '/api/status')).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  const json = (url: string, body: unknown, token?: string) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const setup = await json('/api/auth/setup', { email: 'owner@zip.test', name: 'Dono', password: 'SenhaZipTeste123!' }); assert.equal(setup.status, 201);
  const owner = (await setup.json()).token;
  const created = await json('/api/users', { email: 'other@zip.test', name: 'Outra conta', password: 'SenhaZipTeste123!' }, owner); assert.equal(created.status, 201);
  const other = (await (await json('/api/auth/login', { email: 'other@zip.test', password: 'SenhaZipTeste123!' })).json()).token;
  const changedOther = await json('/api/me/password', { current: 'SenhaZipTeste123!', next: 'SenhaZipTesteNova123!' }, other); assert.equal(changedOther.status, 200);
  const doc: any = makeDoc(); doc.name = 'Entrega ZIP'; doc.assets.foto = `data:image/png;base64,${PNG}`;
  doc.breakpoints = [{ id: 'mobile', name: 'Celular', max: 600, preview: 390 }];
  const home: any = createNode('frame', { name: 'Home', w: 800, h: 400, fluid: true }); home.layout.mode = 'column';
  const title: any = createNode('text', { name: 'Título', text: 'Olá entrega', tag: 'h1' }); title.bps = { mobile: { fontSize: 24 } };
  const image: any = createNode('rect', { name: 'Foto', w: 100, h: 100 }); image.fill = { ...image.fill, type: 'image', assetId: 'foto', fit: 'cover' };
  const component: any = createNode('frame', { name: 'Cartão', w: 100, h: 50 }); component.component = true; component.children.push(createNode('text', { text: 'Peça reutilizável' }));
  const instance: any = structuredClone(component); instance.id = 'instance-safe'; instance.component = false; instance.instanceOf = component.id; instance.children[0].id = 'instance-text-safe';
  const manual: any = createNode('html', { name: 'HTML', w: 100, h: 30 }); manual.html = '<p onclick="window.ZIP_BAD=1">Seguro</p><script>window.ZIP_BAD=1</script><img src="javascript:window.ZIP_BAD=1">';
  home.children.push(title, image, component, instance, manual);
  doc.pages[0].children.push(home, createNode('frame', { name: '../../CON', w: 100, h: 100 }));
  const put = await fetch(base + '/api/projects/entrega.json', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner}` }, body: JSON.stringify(doc) }); assert.equal(put.status, 200);
  for (const kind of ['site', 'react']) {
    const url = `/api/projects/entrega.json/${kind}.zip`;
    const response = await fetch(base + url, { headers: { Authorization: `Bearer ${owner}` } }); assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/zip'); assert.match(response.headers.get('content-disposition')!, new RegExp(`attachment; filename="entrega-${kind}\\.zip"`));
    const files = unzipStored(Buffer.from(await response.arrayBuffer()));
    const text = (path: string) => { assert.ok(files.has(path), path); return files.get(path)!.toString('utf8'); };
    const asset = [...files.keys()].find((path) => new RegExp(`^${kind === 'react' ? 'public/' : ''}assets/img-.*\\.png$`).test(path)); assert.ok(asset); assert.deepEqual(files.get(asset), Buffer.from(PNG, 'base64'));
    if (kind === 'site') {
      const html = text('index.html'); assert.match(html, /Olá entrega/); assert.match(html, /Peça reutilizável/); assert.match(html, /@media[^{}]*max-width:\s*600px/); assert.match(html, /assets\/img-/); assert.doesNotMatch(html, /data:image\/png/); assert.doesNotMatch(html, /ZIP_BAD|onclick|javascript:/);
      assert.ok([...files.keys()].some((path) => path !== 'index.html' && path.endsWith('.html')));
    } else {
      const pkg = JSON.parse(text('package.json')); assert.ok(pkg.dependencies.react); assert.ok(pkg.scripts.build);
      text('src/App.jsx'); text('src/main.jsx'); const jsx = text('src/pages/Home.jsx'); const css = text('src/pages/Home.module.css');
      assert.match(jsx, /Olá entrega/); assert.match(css, /@media[^{}]*max-width:\s*600px/); assert.match(css, /\/assets\/img-/); assert.doesNotMatch(jsx, /ZIP_BAD|onclick|javascript:/);
    }
    assert.equal((await fetch(base + url)).status, 401);
    assert.equal((await fetch(base + url, { headers: { Authorization: `Bearer ${other}` } })).status, 404);
    assert.equal((await fetch(base + `/api/projects/inexistente.json/${kind}.zip`, { headers: { Authorization: `Bearer ${owner}` } })).status, 404);
    const traversal = await fetch(base + `/api/projects/${encodeURIComponent('../entrega.json')}/${kind}.zip`, { headers: { Authorization: `Bearer ${owner}` } }); assert.ok([400, 404].includes(traversal.status));
  }
});
