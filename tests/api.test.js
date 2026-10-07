// Testes da API de salvamento do server.js: sobe o servidor real com configuração e pasta TEMPORÁRIAS
// (nunca toca na sua pasta de projetos) e confere gravar/ler/listar, proteção contra conflito, versões e segurança.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createProbeServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Porta livre escolhida pelo sistema (evita colisão com outro servidor rodando). */
async function unusedPort() {
  const probe = createProbeServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  probe.close();
  await once(probe, 'close');
  return port;
}

const doc = (name) => ({ name, pages: [{ id: 'p1', name: 'Página 1', children: [] }], assets: {}, styles: { colors: [], texts: [] } });

test('API de salvamento: pasta, gravar/ler, conflito, versões e segurança', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'designer-api-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const port = await unusedPort();
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.js', import.meta.url))], {
    env: { ...process.env, PORT: String(port), DESIGNER_CONFIG: join(tmp, 'config.json') },
    stdio: 'ignore',
  });
  t.after(() => child.kill());
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + '/api/status')).ok) break; } catch { await new Promise((r) => setTimeout(r, 25)); }
  }
  const json = { 'Content-Type': 'application/json' };
  const put = (path, body, headers = {}) => fetch(base + path, { method: 'PUT', headers: { ...json, ...headers }, body: JSON.stringify(body) });

  // 1. escolher a pasta: caminho relativo é recusado; absoluto é criado na hora
  assert.equal((await put('/api/config', { folder: 'relativa/pasta' })).status, 400);
  const folder = join(tmp, 'meus projetos');
  const cfg = await (await put('/api/config', { folder, keepVersions: 3 })).json();
  assert.equal(cfg.folder, folder);
  assert.equal(cfg.keepVersions, 3);
  assert.equal((await (await fetch(base + '/api/status')).json()).folder, folder, 'a configuração vale para os próximos pedidos');
  assert.ok(JSON.parse(await readFile(join(tmp, 'config.json'), 'utf8')).folder === folder, 'e fica gravada em disco');

  // 2. gravar um projeto novo, listar e ler de volta (com a data de modificação)
  let r = await put('/api/projects/meu-app.json', doc('Meu app'));
  assert.equal(r.status, 200);
  const { modified } = await r.json();
  const list = await (await fetch(base + '/api/projects')).json();
  assert.deepEqual(list.map((p) => p.file), ['meu-app.json']);
  r = await fetch(base + '/api/projects/meu-app.json');
  assert.equal((await r.json()).name, 'Meu app');
  assert.equal(Number(r.headers.get('x-modified')), modified);

  // 3. conflito: gravar sem saber a data atual (ou com data velha) é recusado; com a data certa, aceito
  assert.equal((await put('/api/projects/meu-app.json', doc('Sem base'))).status, 409);
  assert.equal((await put('/api/projects/meu-app.json', doc('Velha'), { 'X-Base-Modified': String(modified - 5000) })).status, 409);
  r = await put('/api/projects/meu-app.json', doc('Versão 2'), { 'X-Base-Modified': String(modified) });
  assert.equal(r.status, 200);
  const m2 = (await r.json()).modified;
  assert.equal((await put('/api/projects/meu-app.json', doc('Forçado'), { 'X-Overwrite': '1' })).status, 200, 'X-Overwrite grava mesmo assim');

  // 4. versões: a 1ª sobrescrita guardou o conteúdo anterior; outra logo em seguida NÃO cria versão nova (intervalo de 10 min)
  let versions = await (await fetch(base + '/api/projects/meu-app.json/versions')).json();
  assert.equal(versions.length, 1);
  assert.equal((await (await fetch(`${base}/api/projects/meu-app.json/versions/${versions[0].id}`)).json()).name, 'Meu app');
  // envelhece a versão em 11 min e grava de novo: agora entra uma nova
  const vdir = join(folder, '.versoes', 'meu-app');
  const old = new Date(Date.now() - 11 * 60 * 1000);
  await utimes(join(vdir, versions[0].id), old, old);
  const cur = Number((await fetch(base + '/api/projects/meu-app.json')).headers.get('x-modified'));
  assert.ok(cur >= m2);
  await put('/api/projects/meu-app.json', doc('Versão 3'), { 'X-Base-Modified': String(cur) });
  versions = await (await fetch(base + '/api/projects/meu-app.json/versions')).json();
  assert.equal(versions.length, 2);
  assert.ok(!(await readdir(folder)).some((f) => f.endsWith('.tmp')), 'não sobra arquivo temporário');

  // 5. validação: conteúdo que não é projeto, nome perigoso, rota inexistente
  assert.equal((await put('/api/projects/x.json', { nada: 1 })).status, 400);
  for (const bad of ['..%2Fsegredo.json', '.oculto.json', 'semextensao', 'a%5C..%5Cb.json']) {
    assert.equal((await put('/api/projects/' + bad, doc('x'))).status, 400, bad);
  }
  assert.equal((await fetch(base + '/api/projects/nao-existe.json')).status, 404);
  assert.equal((await fetch(base + '/api/qualquer')).status, 404);

  // 6. segurança: site de fora (Origin estranho), Content-Type errado e Host falso (DNS rebinding) são recusados
  assert.equal((await put('/api/projects/x.json', doc('x'), { Origin: 'https://site-malicioso.com' })).status, 403);
  assert.equal((await fetch(base + '/api/projects/x.json', { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(doc('x')) })).status, 415);
  const http = await import('node:http');
  const status = await new Promise((ok) => http.get({ host: '127.0.0.1', port, path: '/api/projects', headers: { Host: 'evil.example:' + port } }, (res) => { res.resume(); ok(res.statusCode); }));
  assert.equal(status, 403);
  // os projetos e a configuração não vazam pelo servidor estático
  assert.equal((await fetch(base + '/designer.config.json')).status, 404);
  assert.equal((await fetch(base + '/projetos/meu-app.json')).status, 404);
});
