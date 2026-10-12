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

test('API de projetos: gravar/ler, conflito por revisão, versões, miniatura, renomear e segurança', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'designer-api-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const port = await unusedPort();
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../apps/server/src/main.ts', import.meta.url))], {
    // Este teste exercita apenas a persistência da API. O servidor real exige
    // contas por padrão; o modo local fica explícito somente neste teste legado.
    env: { ...process.env, PORT: String(port), DESIGNER_CONFIG: join(tmp, 'config.json'), STYLO_AUTH: 'local' },
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
  const json = { 'Content-Type': 'application/json' };
  const put = (path, body, headers = {}) => fetch(base + path, { method: 'PUT', headers: { ...json, ...headers }, body: JSON.stringify(body) });

  // 1. configuração: nº de versões guardadas (a pasta de projetos não existe mais: os projetos moram no banco)
  const cfg = await (await put('/api/config', { keepVersions: 3 })).json();
  assert.equal(cfg.keepVersions, 3);
  assert.equal((await (await fetch(base + '/api/status')).json()).keepVersions, 3, 'a configuração vale para os próximos pedidos');
  assert.ok(JSON.parse(await readFile(join(tmp, 'config.json'), 'utf8')).keepVersions === 3, 'e fica gravada em disco');

  // 2. gravar um projeto novo, listar e ler de volta (com a data de modificação)
  let r = await put('/api/projects/meu-app.json', doc('Meu app'));
  assert.equal(r.status, 200);
  const { modified, contentHash } = await r.json();
  const list = await (await fetch(base + '/api/projects')).json();
  assert.deepEqual(list.map((p) => p.file), ['meu-app.json']);
  r = await fetch(base + '/api/projects/meu-app.json');
  assert.equal((await r.json()).name, 'Meu app');
  assert.equal(Number(r.headers.get('x-modified')), modified);
  assert.equal(r.headers.get('x-content-hash'), contentHash, 'GET devolve a revisão por conteúdo além do timestamp');

  const imported = await fetch(base + '/api/projects/import', { method: 'POST', headers: json, body: JSON.stringify({ name: 'Importado pela API', doc: doc('Documento importado') }) });
  assert.equal(imported.status, 201);
  assert.equal((await (await fetch(base + '/api/projects/importado-pela-api.json')).json()).name, 'Documento importado');

  // 3. conflito: gravar sem saber a revisão atual (ou com revisão velha) é recusado; com a revisão certa, aceito
  assert.equal((await put('/api/projects/meu-app.json', doc('Sem base'))).status, 409);
  assert.equal((await put('/api/projects/meu-app.json', doc('Velha'), { 'X-Base-Hash': 'r0' })).status, 409);
  r = await put('/api/projects/meu-app.json', doc('Versão 2'), { 'X-Base-Hash': contentHash });
  assert.equal(r.status, 200);
  const second = await r.json();
  assert.notEqual(second.contentHash, contentHash, 'cada gravação muda a revisão');
  assert.equal((await put('/api/projects/meu-app.json', doc('Forçado'), { 'X-Overwrite': '1' })).status, 200, 'X-Overwrite grava mesmo assim');

  // 4. versões: a 1ª sobrescrita guarda o conteúdo anterior; outra logo em seguida NÃO cria versão nova (intervalo de 10 min)
  const versions = await (await fetch(base + '/api/projects/meu-app.json/versions')).json();
  assert.equal(versions.length, 1);
  assert.equal((await (await fetch(`${base}/api/projects/meu-app.json/versions/${versions[0].id}`)).json()).name, 'Meu app');

  // 4b. duas abas com a mesma revisão: apenas a primeira escrita deve vencer
  const initial = await (await put('/api/projects/concorrente.json', doc('Base'))).json();
  const contenders = await Promise.all([
    put('/api/projects/concorrente.json', doc('A'), { 'X-Base-Hash': initial.contentHash }),
    put('/api/projects/concorrente.json', doc('B'), { 'X-Base-Hash': initial.contentHash }),
  ]);
  assert.deepEqual(contenders.map((response) => response.status).sort(), [200, 409], 'uma gravação aceita e a outra recebe conflito');
  const finalDoc = await (await fetch(base + '/api/projects/concorrente.json')).json();
  assert.ok(['A', 'B'].includes(finalDoc.name), 'o conteúdo vencedor permanece íntegro');

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
  // 7. miniatura: grava, aparece na lista, é servida como SVG com política que impede scripts
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
  assert.equal((await put('/api/projects/meu-app.json/thumb', { svg })).status, 200);
  assert.equal((await put('/api/projects/meu-app.json/thumb', { svg: 'não é svg' })).status, 400);
  assert.equal((await put('/api/projects/nao-existe.json/thumb', { svg })).status, 404, 'só aceita miniatura de projeto existente');
  r = await fetch(base + '/api/projects/meu-app.json/thumb');
  assert.equal(r.headers.get('content-type'), 'image/svg+xml');
  assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal(await r.text(), svg);
  assert.ok((await (await fetch(base + '/api/projects')).json()).find((p) => p.file === 'meu-app.json').thumb > 0);

  // 8. renomear: leva junto versões e miniatura; recusa nome existente e nome inválido
  const post = (path, body) => fetch(base + path, { method: 'POST', headers: json, body: JSON.stringify(body) });
  await put('/api/projects/outro.json', doc('Outro'));
  assert.equal((await post('/api/projects/meu-app.json/rename', { to: 'outro.json' })).status, 409);
  assert.equal((await post('/api/projects/meu-app.json/rename', { to: '../fora.json' })).status, 400);
  r = await post('/api/projects/meu-app.json/rename', { to: 'app-final.json' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).file, 'app-final.json');
  assert.equal((await fetch(base + '/api/projects/meu-app.json')).status, 404);
  assert.equal((await (await fetch(base + '/api/projects/app-final.json')).json()).name, 'Forçado');
  assert.equal((await (await fetch(base + '/api/projects/app-final.json/versions')).json()).length, 1, 'versões vieram junto');
  assert.equal((await fetch(base + '/api/projects/app-final.json/thumb')).status, 200, 'miniatura veio junto');

  // os projetos e a configuração não vazam pelo servidor estático
  assert.equal((await fetch(base + '/designer.config.json')).status, 404);
  assert.equal((await fetch(base + '/designer.db')).status, 404);
});
