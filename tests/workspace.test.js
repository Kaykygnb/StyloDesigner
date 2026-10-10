// O MCP trabalhando SEM navegador: o workspace do servidor abre/cria projetos, roda o executor, grava no disco
// e recarrega quando outra pessoa grava o arquivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjects } from '../server/projects.js';
import { createWorkspace } from '../server/workspace/index.js';

async function setup() {
  const folder = await mkdtemp(join(tmpdir(), 'stylo-ws-'));
  const config = { folder, keepVersions: 5 };
  let workspace;
  const projects = createProjects({ getConfig: () => config, onWrite: (e) => workspace.externalWrite(e) });
  workspace = createWorkspace({ projects });
  return { folder, projects, workspace, done: () => rm(folder, { recursive: true, force: true }) };
}

test('sem projeto aberto: ferramentas de documento explicam o que fazer', async () => {
  const t = await setup();
  const out = await t.workspace.call('get_document', {}, { sid: 'a' });
  assert.match(out.error, /new_project|open_project/);
  await t.done();
});

test('new_project cria o arquivo, create_layer altera e o disco recebe o resultado', async () => {
  const t = await setup();
  const created = await t.workspace.call('new_project', { name: 'Meu Site' }, { sid: 'a' });
  assert.equal(created.file, 'meu-site.json');
  const layer = await t.workspace.call('create_layer', { type: 'frame', props: { name: 'Hero', w: 800, h: 400, fill: '#ff0000' } }, { sid: 'a' });
  assert.equal(layer.error, undefined, layer.error);
  const doc = await t.workspace.call('get_document', {}, { sid: 'a' });
  assert.ok(JSON.stringify(doc).includes('Hero'));
  await t.workspace.flushAll();
  const onDisk = JSON.parse(await readFile(join(t.folder, 'meu-site.json'), 'utf8'));
  assert.ok(JSON.stringify(onDisk).includes('Hero'));
  const html = await t.workspace.call('export_site', { includeContent: true }, { sid: 'a' });
  assert.equal(html.error, undefined, html.error);
  assert.ok(html.files.some((f) => f.path === 'index.html' || /\.html$/.test(f.path)));
  await t.done();
});

test('duas sessões no mesmo projeto veem o trabalho uma da outra; outra sessão sem projeto não vê nada', async () => {
  const t = await setup();
  await t.workspace.call('new_project', { name: 'Equipe' }, { sid: 'a' });
  await t.workspace.call('create_layer', { type: 'rect', props: { name: 'Caixa do A' } }, { sid: 'a' });
  assert.match((await t.workspace.call('get_document', {}, { sid: 'b' })).error, /Nenhum projeto aberto/);
  await t.workspace.call('open_project', { file: 'equipe.json' }, { sid: 'b' });
  assert.ok(JSON.stringify(await t.workspace.call('get_document', {}, { sid: 'b' })).includes('Caixa do A'));
  await t.done();
});

test('gravação de fora recarrega o projeto e avisa a sessão', async () => {
  const t = await setup();
  await t.workspace.call('new_project', { name: 'Externo' }, { sid: 'a' });
  const { doc, modified, contentHash } = await t.projects.load('externo.json');
  doc.name = 'Mudou por fora';
  await t.projects.write('externo.json', JSON.stringify(doc), { base: { modified, hash: contentHash }, by: 'editor-1' });
  await new Promise((r) => setTimeout(r, 50));
  const out = await t.workspace.call('get_document', {}, { sid: 'a' });
  assert.match(out.notice, /recarregado/);
  assert.ok(JSON.stringify(out).includes('Mudou por fora'));
  await t.done();
});

test('new_project recusa nome que já existe; list_projects mostra o aberto', async () => {
  const t = await setup();
  await t.workspace.call('new_project', { name: 'Um' }, { sid: 'a' });
  assert.match((await t.workspace.call('new_project', { name: 'Um' }, { sid: 'a' })).error, /Já existe/);
  const list = await t.workspace.call('list_projects', {}, { sid: 'a' });
  assert.equal(list.open, 'um.json');
  assert.equal(list.projects.length, 1);
  await t.done();
});

test('ferramentas que precisam de navegador respondem com erro claro, sem derrubar nada', async () => {
  const t = await setup();
  await t.workspace.call('new_project', { name: 'Img' }, { sid: 'a' });
  assert.match((await t.workspace.call('get_image', {}, { sid: 'a' })).error, /navegador/);
  await t.done();
});

test('export_zip devolve os endereços do site .zip e do projeto, depois de gravar', async () => {
  const t = await setup();
  await t.workspace.call('new_project', { name: 'Zip' }, { sid: 'a' });
  await t.workspace.call('create_layer', { type: 'frame', props: { name: 'Home', w: 400, h: 300 } }, { sid: 'a' });
  const out = await t.workspace.call('export_zip', {}, { sid: 'a' });
  assert.equal(out.error, undefined, out.error);
  assert.match(out.site_zip_url, /\/api\/projects\/zip\.json\/site\.zip$/);
  assert.ok(out.files.length >= 1);
  assert.ok(JSON.stringify(JSON.parse(await readFile(join(t.folder, 'zip.json'), 'utf8'))).includes('Home'));
  await t.done();
});
