import { isolatedServerEnv } from './helpers/test-env.mjs';
import { cleanupFixture } from './helpers/fixture-lifecycle.mjs';
// A ponte do painel web: o navegador chama as MESMAS ferramentas do MCP, pelo mesmo workspace. Servidor real, como nos outros testes HTTP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const freePort = () => new Promise((resolve) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

async function startServer(t, authMode = 'local') {
  const tmp = await mkdtemp(join(tmpdir(), 'stylo-studio-'));
  const fixture = { dir: tmp, children: [], clients: [] };
  t.after(() => cleanupFixture(fixture));
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../apps/server/src/main.ts', import.meta.url))], {
    env: isolatedServerEnv({ PORT: String(port), DESIGNER_CONFIG: join(tmp, 'config.json'), DESIGNER_DB_DIR: 'memory', STYLO_AUTH: authMode, STYLO_BLOB_DIR: 'memory', STYLO_SECRET_KEY: Buffer.alloc(32, 9).toString('base64') }),
    stdio: 'ignore',
  });
  fixture.children.push(child);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0, up = false; !up; i++) {
    if (i > 2400) throw new Error('o servidor de teste não subiu em 60 s');
    try { up = (await fetch(base + '/api/status')).ok; } catch { /* ainda subindo */ }
    if (!up) await new Promise((r) => setTimeout(r, 25));
  }
  return { base, fixture };
}

const json = { 'Content-Type': 'application/json' };

test('painel: a entrada (/) leva para /studio/, e /studio/ entrega a página do painel', async (t) => {
  const { base, fixture } = await startServer(t);
  const root = await fetch(base + '/', { redirect: 'manual' });
  assert.equal(root.status, 302);
  assert.equal(root.headers.get('location'), '/studio/');
  assert.equal((await fetch(base + '/studio', { redirect: 'manual' })).headers.get('location'), '/studio/');
  const page = await fetch(base + '/studio/');
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<div id="root">/);
  // o script que a página referencia (compilado em /studio/assets/… ou, em desenvolvimento, /studio/src/main.tsx) é entregue como JavaScript
  const src = /<script[^>]+type="module"[^>]+src="([^"]+main\.tsx|[^"]+\.js)"/.exec(html)?.[1] ?? /src="(\/studio\/[^"]+\.js)"/.exec(html)?.[1];
  assert.ok(src, 'a página referencia um script do painel');
  const js = await fetch(base + src);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type') || '', /javascript/);
  assert.equal((await fetch(base + '/studio/../package.json')).status === 200, false, 'não vaza arquivos fora do app');
  assert.equal((await fetch(base + '/studio/package.json')).status, 404, 'package.json do app não é servido');
});

test('ponte /api/studio: chama as ferramentas, devolve o documento, valida entradas e recusa abusos', async (t) => {
  const { base, fixture } = await startServer(t);
  const call = (body) => fetch(base + '/api/studio/call', { method: 'POST', headers: json, body: JSON.stringify(body) });
  const sid = 'web-teste-0123456789ab';

  // sem projeto aberto
  const vazio = await fetch(`${base}/api/studio/doc?sid=${sid}`);
  assert.equal(vazio.status, 200);
  assert.equal(await vazio.json(), null, 'sem projeto aberto: null (não é erro)');
  const sem = await (await call({ sid, tool: 'get_document' })).json();
  assert.match(sem.error, /Nenhum projeto aberto/);

  // entradas inválidas
  assert.equal((await call({ sid: 'x', tool: 'get_document' })).status, 400, 'sid curto demais');
  assert.equal((await call({ sid, tool: '../etc' })).status, 400, 'nome de ferramenta inválido');
  assert.equal((await call({ sid, tool: 'get_document', args: [1] })).status, 400, 'args precisa ser objeto');
  assert.equal((await fetch(`${base}/api/studio/doc?sid=../x`)).status, 400);
  assert.equal((await fetch(base + '/api/studio/call', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status, 415, 'só JSON');
  assert.equal((await fetch(base + '/api/studio/call', { method: 'POST', headers: { ...json, Origin: 'https://site-malicioso.com' }, body: JSON.stringify({ sid, tool: 'get_document' }) })).status, 403, 'outra origem não entra');

  // criar, montar e ler de volta
  const novo = await (await call({ sid, tool: 'new_project', args: { name: 'Painel' } })).json();
  assert.equal(novo.file, 'painel.json');
  const tela = await (await call({ sid, tool: 'build_layout', args: { tree: { type: 'frame', props: { name: 'Tela', w: 800, h: 600, fill: '#FFFFFF' } } } })).json();
  assert.equal(tela.error, undefined, tela.error);
  const rect = await (await call({ sid, tool: 'create_layer', args: { type: 'rect', parent_id: tela.created.id, props: { x: 10, y: 20, w: 100, h: 50, fill: '#FF0000' } } })).json();
  assert.equal(rect.error, undefined, rect.error);
  const up = await (await call({ sid, tool: 'update_layer', args: { id: rect.created.id, props: { x: 77 } } })).json();
  assert.equal(up.error, undefined, up.error);
  const snap = await (await fetch(`${base}/api/studio/doc?sid=${sid}`)).json();
  assert.equal(snap.file, 'painel.json');
  const flat = (l) => l.flatMap((n) => [n, ...(n.children ? flat(n.children) : [])]);
  const r = flat(snap.doc.pages[0].children).find((n) => n.id === rect.created.id);
  assert.deepEqual([r.x, r.y, r.w, r.h], [77, 20, 100, 50]);

  // erro de ferramenta volta como { error } com o conserto, não como falha do servidor
  const ruim = await call({ sid, tool: 'update_layer', args: { id: rect.created.id, props: { naoExiste: 1 } } });
  assert.equal(ruim.status, 200);
  assert.match((await ruim.json()).error, /Propriedade desconhecida/);
  // argumento desconhecido também é recusado aqui (mesma validação do MCP)
  assert.match((await (await call({ sid, tool: 'find_layers', args: { name: 'x' } })).json()).error, /Argumento desconhecido/);

  // a lista de projetos agora traz o nome
  const list = await (await fetch(base + '/api/projects')).json();
  assert.equal(list[0].name, 'Painel');

  // miniatura: só SVG
  assert.equal((await fetch(`${base}/api/projects/painel.json/thumb`, { method: 'PUT', headers: json, body: JSON.stringify({ svg: '<svg xmlns="http://www.w3.org/2000/svg"/>' }) })).status, 200);
  assert.equal((await fetch(`${base}/api/projects/painel.json/thumb`, { method: 'PUT', headers: json, body: JSON.stringify({ svg: 'não é svg' }) })).status, 400);
});

test('pessoa no painel e agente no MCP no mesmo projeto não se bloqueiam depois de cada edição (regressão: janela de 10 s)', async (t) => {
  const { base, fixture } = await startServer(t);
  const sid = 'web-teste-bloqueio-001';
  const call = async (tool, args) => (await fetch(base + '/api/studio/call', { method: 'POST', headers: json, body: JSON.stringify({ sid, tool, args }) })).json();
  const novo = await call('new_project', { name: 'Dois' });
  const tela = await call('build_layout', { tree: { type: 'frame', props: { name: 'Tela', w: 600, h: 400 } } }); // trava o documento inteiro

  const client = new Client({ name: 'Agente do teste', version: '1.0.0' }, {});
  await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp')));
  fixture.clients.push(client);
  const mcp = async (name, args) => JSON.parse((await client.callTool({ name, arguments: args })).content[0].text);
  await mcp('open_project', { file: novo.file });

  // 1) logo depois da edição da pessoa, o agente edita sem esperar
  const doAgente = await mcp('create_layer', { type: 'text', parent_id: tela.created.id, props: { text: 'do agente', x: 5, y: 5 } });
  assert.equal(doAgente.error, undefined, doAgente.error);
  // 2) logo depois da edição do agente, a pessoa edita sem esperar
  const doPessoa = await call('update_layer', { id: doAgente.created.id, props: { text: 'editado pela pessoa' } });
  assert.equal(doPessoa.error, undefined, doPessoa.error);
  const snap = await (await fetch(`${base}/api/studio/doc?sid=${sid}`)).json();
  const flat = (l) => l.flatMap((n) => [n, ...(n.children ? flat(n.children) : [])]);
  assert.equal(flat(snap.doc.pages[0].children).find((n) => n.id === doAgente.created.id).text, 'editado pela pessoa');
});

test('accounts: sid reutilizado não lê nem altera workspace de outra conta', async (t) => {
  const { base, fixture } = await startServer(t, 'accounts');
  const request = async (cookie, method, path, body) => fetch(base + path, {
    method, headers: { ...json, ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setup = await request('', 'POST', '/api/auth/setup', { email: 'owner@isolation.test', name: 'Owner', password: 'senha-owner-segura' });
  assert.equal(setup.status, 201);
  const ownerCookie = setup.headers.get('set-cookie').split(';', 1)[0];
  const sid = 'web-isolation-shared-001';
  const call = async (cookie, tool, args = {}) => (await request(cookie, 'POST', '/api/studio/call', { sid, tool, args })).json();
  assert.equal((await call(ownerCookie, 'new_project', { name: 'Mesmo nome' })).error, undefined);
  const snapshot = async (cookie) => (await request(cookie, 'GET', `/api/studio/doc?sid=${sid}`)).json();
  const ownerBefore = await snapshot(ownerCookie);
  assert.ok(ownerBefore?.doc);
  assert.equal((await request(ownerCookie, 'POST', '/api/users', { email: 'editor@isolation.test', name: 'Editor', password: 'senha-editor-inicial', role: 'EDITOR' })).status, 201);
  const login = await request('', 'POST', '/api/auth/login', { email: 'editor@isolation.test', password: 'senha-editor-inicial' });
  assert.equal(login.status, 200);
  const editorCookie = login.headers.get('set-cookie').split(';', 1)[0];
  assert.equal((await request(editorCookie, 'POST', '/api/me/password', { current: 'senha-editor-inicial', next: 'senha-editor-final' })).status, 200);
  assert.equal(await snapshot(editorCookie), null);
  assert.ok((await call(editorCookie, 'get_document')).error);
  assert.ok((await call(editorCookie, 'create_layer', { type: 'rect' })).error);
  assert.deepEqual(await snapshot(ownerCookie), ownerBefore);
  assert.equal((await call(editorCookie, 'new_project', { name: 'Mesmo nome' })).error, undefined);
  const editorOwn = await snapshot(editorCookie);
  assert.equal(editorOwn.file, ownerBefore.file, 'nomes de arquivo iguais em contas distintas são permitidos');
  assert.notEqual(editorOwn.id, ownerBefore.id, 'cada conta mantém seu próprio documento com o mesmo sid e nome');
  assert.deepEqual(await snapshot(ownerCookie), ownerBefore);
});

test('accounts: workspace aberto respeita downgrade, revogação e novo compartilhamento', async (t) => {
  const { base, fixture } = await startServer(t, 'accounts');
  const request = (cookie, method, path, body) => fetch(base + path, {
    method, headers: { ...json, ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setup = await request('', 'POST', '/api/auth/setup', { email: 'owner@sharing.test', name: 'Owner', password: 'senha-owner-segura' });
  assert.equal(setup.status, 201);
  const ownerCookie = setup.headers.get('set-cookie').split(';', 1)[0];
  assert.equal((await request(ownerCookie, 'POST', '/api/users', { email: 'editor@sharing.test', name: 'Editor', password: 'senha-editor-inicial', role: 'EDITOR' })).status, 201);
  const login = await request('', 'POST', '/api/auth/login', { email: 'editor@sharing.test', password: 'senha-editor-inicial' });
  const editorCookie = login.headers.get('set-cookie').split(';', 1)[0];
  assert.equal((await request(editorCookie, 'POST', '/api/me/password', { current: 'senha-editor-inicial', next: 'senha-editor-final' })).status, 200);
  const sid = 'web-sharing-active-001';
  const call = async (cookie, tool, args = {}) => (await request(cookie, 'POST', '/api/studio/call', { sid, tool, args })).json();
  const snapshot = (cookie) => request(cookie, 'GET', `/api/studio/doc?sid=${sid}`);
  const share = (role) => call(ownerCookie, 'share_project', { email: 'editor@sharing.test', role });
  const created = await call(ownerCookie, 'new_project', { name: 'Sharing ativo' });
  assert.equal((await share('editor')).error, undefined);
  assert.equal((await call(editorCookie, 'open_project', { file: created.file })).error, undefined);
  const layer = await call(editorCookie, 'create_layer', { type: 'rect', props: { name: 'Permitido' } });
  assert.equal(layer.error, undefined);
  for (const role of ['viewer', 'commenter']) {
    assert.equal((await share(role)).error, undefined);
    const before = (await (await snapshot(ownerCookie)).json()).doc;
    assert.match((await call(editorCookie, 'update_layer', { id: layer.created.id, props: { name: 'Proibido' } })).error, /só pode ler ou comentar/);
    assert.equal((await (await snapshot(editorCookie)).json()).role, role.toUpperCase(), 'snapshot reflete o papel atual');
    assert.match((await call(editorCookie, 'save_project', { name: 'Copia proibida' })).error, /só pode ler ou comentar/);
    assert.equal((await call(editorCookie, 'get_document')).error, undefined);
    assert.deepEqual((await (await snapshot(ownerCookie)).json()).doc, before, 'recusa não altera documento');
  }
  assert.equal((await share('editor')).error, undefined);
  assert.equal((await call(editorCookie, 'update_layer', { id: layer.created.id, props: { name: 'Promovido' } })).error, undefined);
  const beforeRevocation = (await (await snapshot(ownerCookie)).json()).doc;
  assert.equal((await call(ownerCookie, 'unshare_project', { email: 'editor@sharing.test' })).error, undefined);
  assert.ok((await call(editorCookie, 'get_document')).error, 'revogação impede leitura sem reabrir');
  assert.ok((await call(editorCookie, 'get_activity')).error, 'revogação impede leitura de atividade');
  assert.ok((await call(editorCookie, 'update_layer', { id: layer.created.id, props: { name: 'Revogado' } })).error);
  assert.equal((await snapshot(editorCookie)).status, 404, 'snapshot recusado após revogação');
  assert.deepEqual((await (await snapshot(ownerCookie)).json()).doc, beforeRevocation);
  assert.equal((await share('editor')).error, undefined);
  assert.equal((await call(editorCookie, 'get_document')).error, undefined, 'novo compartilhamento permite continuar');
  assert.equal((await call(ownerCookie, 'unshare_project', { email: 'editor@sharing.test' })).error, undefined);
  assert.equal((await call(editorCookie, 'new_project', { name: 'Sharing ativo' })).error, undefined, 'mesmo slug próprio permitido');
  assert.equal((await share('editor')).error, undefined);
  assert.equal((await call(ownerCookie, 'unshare_project', { email: 'editor@sharing.test' })).error, undefined);
  assert.equal((await call(editorCookie, 'get_document')).error, undefined, 'projeto próprio com mesmo slug mantém acesso');
});
