// O MCP trabalhando SEM navegador: o workspace do servidor abre/cria projetos no banco, roda o executor, grava e
// recarrega quando outro autor grava o projeto; registra as operações; respeita papéis e escopos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '@stylo/db/client.ts';
import { createProjects } from '../apps/server/src/services/projects.ts';
import { createOperations } from '../apps/server/src/services/operations.ts';
import { createNotes } from '../apps/server/src/services/notes.ts';
import { createSharing } from '../apps/server/src/services/sharing.ts';
import { createWorkspace, type Actor } from '../apps/server/src/workspace/index.ts';

async function setup(extra: { inspectLayout?: import('../packages/core/src/layout-inspection.ts').InspectLayout; fetchImage?: (url: string) => Promise<{ bytes: Uint8Array }>; measureLayout?: (roots: any[]) => Promise<Map<string, { w: number; h: number }>>; auditLayout?: (roots: any[], doc: any, widths: any[]) => Promise<any[]>; renderImage?: (node: any, doc: any, scale: number, opts?: { width?: number }) => Promise<string> } = {}) {
  const { db, close } = await createDb({ pglite: {} });
  const owner = await db.user.create({ data: { email: 'dono@x.com', name: 'Dono', passwordHash: '!', role: 'OWNER' } });
  const other = await db.user.create({ data: { email: 'outro@x.com', name: 'Outro', passwordHash: '!' } });
  const operations = createOperations(db);
  let workspace: ReturnType<typeof createWorkspace>;
  const projects = createProjects({ db, getConfig: () => ({ keepVersions: 5 }), onWrite: (e) => { void workspace.externalWrite(e); } });
  workspace = createWorkspace({ projects, notes: createNotes(db), sharing: createSharing(db), operations, ...extra, presence: () => ({ agents: [] }), onOperation: (op) => { void operations.record(op); } });
  const agentOf = async (name: string, user = owner, scopes?: string[]) => {
    const a = await db.agent.create({ data: { name, ownerId: user.id, tokenHash: `h-${name}-${Math.random()}`, scopes: scopes ?? ['read', 'write', 'export'], status: 'ACTIVE' } });
    return { type: 'AGENT', userId: user.id, agentId: a.id, name, scopes: a.scopes } satisfies Actor;
  };
  // fecha o banco só depois do log de operações terminar de gravar (senão o PGlite pode travar no meio)
  const closeAll = async () => { await operations.idle(); await close(); };
  return { db, owner, other, projects, workspace, operations, agentOf, close: closeAll };
}

test('sem projeto aberto: ferramentas de documento explicam o que fazer', async () => {
  const t = await setup();
  const a = await t.agentOf('A');
  assert.match((await t.workspace.call('get_document', {}, { sid: 'a', actor: a })).error, /new_project|open_project/);
  await t.close();
});

test('new_project cria no banco, create_layer altera, grava e o log registra quem fez', async () => {
  const t = await setup();
  const a = await t.agentOf('Claude Code');
  const created = await t.workspace.call('new_project', { name: 'Meu Site' }, { sid: 'a', actor: a });
  assert.equal(created.file, 'meu-site.json');
  const layer = await t.workspace.call('create_layer', { type: 'frame', props: { name: 'Hero', w: 800, h: 400, fill: '#ff0000' } }, { sid: 'a', actor: a });
  assert.equal(layer.error, undefined, layer.error);
  assert.ok(JSON.stringify(await t.workspace.call('get_document', {}, { sid: 'a', actor: a })).includes('Hero'));
  await t.workspace.flushAll();
  const saved = await t.projects.load({ id: t.owner.id }, 'meu-site.json');
  assert.ok(JSON.stringify(saved.doc).includes('Hero'), 'o banco recebeu o resultado');
  await new Promise((r) => setTimeout(r, 50));
  const log = await t.operations.list(saved.id);
  assert.ok(log.some((o) => o.tool === 'create_layer' && o.who === 'Claude Code' && o.actorType === 'AGENT'), 'o log mostra o agente e a ferramenta');
  assert.ok(log.find((o) => o.tool === 'create_layer')!.layerIds.length >= 1);
  const site = await t.workspace.call('export_site', { includeContent: true }, { sid: 'a', actor: a });
  assert.equal(site.error, undefined, site.error);
  await t.close();
});

test('duas sessões no mesmo projeto veem o trabalho uma da outra; sessão sem projeto não vê nada', async () => {
  const t = await setup();
  const a = await t.agentOf('A'); const b = await t.agentOf('B');
  await t.workspace.call('new_project', { name: 'Equipe' }, { sid: 'a', actor: a });
  await t.workspace.call('create_layer', { type: 'rect', props: { name: 'Caixa do A' } }, { sid: 'a', actor: a });
  assert.match((await t.workspace.call('get_document', {}, { sid: 'b', actor: b })).error, /Nenhum projeto aberto/);
  await t.workspace.call('open_project', { file: 'equipe.json' }, { sid: 'b', actor: b });
  assert.ok(JSON.stringify(await t.workspace.call('get_document', {}, { sid: 'b', actor: b })).includes('Caixa do A'));
  await t.close();
});

test('gravação de outro autor recarrega o projeto e avisa a sessão', async () => {
  const t = await setup();
  const a = await t.agentOf('A');
  await t.workspace.call('new_project', { name: 'Externo' }, { sid: 'a', actor: a });
  const { doc, contentHash } = await t.projects.load({ id: t.owner.id }, 'externo.json');
  doc.name = 'Mudou por fora';
  await t.projects.write({ id: t.owner.id }, 'externo.json', doc, { base: { hash: contentHash }, by: 'editor-1' });
  await new Promise((r) => setTimeout(r, 100));
  const out = await t.workspace.call('get_document', {}, { sid: 'a', actor: a });
  assert.match(out.notice, /recarregado/);
  assert.ok(JSON.stringify(out).includes('Mudou por fora'));
  await t.close();
});

test('new_project recusa nome que já existe; list_projects mostra o aberto', async () => {
  const t = await setup();
  const a = await t.agentOf('A');
  await t.workspace.call('new_project', { name: 'Um' }, { sid: 'a', actor: a });
  assert.match((await t.workspace.call('new_project', { name: 'Um' }, { sid: 'a', actor: a })).error, /Já existe/);
  const list = await t.workspace.call('list_projects', {}, { sid: 'a', actor: a });
  assert.equal(list.open, 'um.json');
  assert.equal(list.projects.length, 1);
  await t.close();
});

test('escopos: agente só de leitura não altera; só pode ler e não exporta sem o escopo', async () => {
  const t = await setup();
  const full = await t.agentOf('Completo');
  const reader = await t.agentOf('Leitor', t.owner, ['read']);
  await t.workspace.call('new_project', { name: 'Escopo' }, { sid: 'f', actor: full });
  await t.workspace.call('open_project', { file: 'escopo.json' }, { sid: 'r', actor: reader });
  assert.equal((await t.workspace.call('get_document', {}, { sid: 'r', actor: reader })).error, undefined);
  assert.match((await t.workspace.call('create_layer', { type: 'rect' }, { sid: 'r', actor: reader })).error, /permissão de escrita/);
  assert.match((await t.workspace.call('export_zip', {}, { sid: 'r', actor: reader })).error, /permissão de exportar/);
  assert.match((await t.workspace.call('new_project', { name: 'Outro' }, { sid: 'r', actor: reader })).error, /permissão de escrita/);
  await t.close();
});

test('membro VIEWER lê o projeto de outra pessoa mas não altera; EDITOR altera', async () => {
  const t = await setup();
  const dono = await t.agentOf('Do dono');
  await t.workspace.call('new_project', { name: 'Compartilhado' }, { sid: 'd', actor: dono });
  const project = await t.db.project.findFirstOrThrow({ where: { slug: 'compartilhado.json' } });
  await t.db.projectMember.create({ data: { projectId: project.id, userId: t.other.id, role: 'VIEWER' } });
  const visitante = await t.agentOf('Visitante', t.other);
  const opened = await t.workspace.call('open_project', { file: 'compartilhado.json' }, { sid: 'v', actor: visitante });
  assert.equal(opened.role, 'VIEWER');
  assert.match((await t.workspace.call('create_layer', { type: 'rect' }, { sid: 'v', actor: visitante })).error, /só pode ler/);
  await t.db.projectMember.update({ where: { projectId_userId: { projectId: project.id, userId: t.other.id } }, data: { role: 'EDITOR' } });
  await t.workspace.call('open_project', { file: 'compartilhado.json' }, { sid: 'v', actor: visitante });
  assert.equal((await t.workspace.call('create_layer', { type: 'rect', props: { name: 'Do editor' } }, { sid: 'v', actor: visitante })).error, undefined);
  // quem não é dono nem membro não enxerga
  const estranho = await t.db.user.create({ data: { email: 'e@x.com', name: 'Estranho', passwordHash: '!' } });
  const intruso = await t.agentOf('Intruso', estranho);
  assert.match((await t.workspace.call('open_project', { file: 'compartilhado.json' }, { sid: 'i', actor: intruso })).error, /não encontrado/i);
  await t.close();
});

test('ferramentas que precisam de navegador respondem com erro claro, sem derrubar nada', async () => {
  const t = await setup();
  const a = await t.agentOf('A');
  await t.workspace.call('new_project', { name: 'Img' }, { sid: 'a', actor: a });
  assert.match((await t.workspace.call('get_image', {}, { sid: 'a', actor: a })).error, /navegador/);
  await t.close();
});

test('export_zip devolve os endereços do site .zip e do projeto, depois de gravar', async () => {
  const t = await setup();
  const a = await t.agentOf('A');
  await t.workspace.call('new_project', { name: 'Zip' }, { sid: 'a', actor: a });
  await t.workspace.call('create_layer', { type: 'frame', props: { name: 'Home', w: 400, h: 300 } }, { sid: 'a', actor: a });
  const out = await t.workspace.call('export_zip', {}, { sid: 'a', actor: a });
  assert.equal(out.error, undefined, out.error);
  assert.match(out.site_zip_url, /\/api\/projects\/zip\.json\/site\.zip$/);
  assert.ok(out.files.length >= 1);
  assert.ok(JSON.stringify((await t.projects.load({ id: t.owner.id }, 'zip.json')).doc).includes('Home'));
  await t.close();
});

test('notas de decisão: o agente anota o porquê, outro agente lê ao abrir, responde e resolve; fica no log', async () => {
  const t = await setup();
  const a = await t.agentOf('Claude Code'); const b = await t.agentOf('Codex');
  await t.workspace.call('new_project', { name: 'Notas' }, { sid: 'a', actor: a });
  const first = await t.workspace.call('add_note', { text: 'Hero em coluna para caber no celular', kind: 'decision', layer_id: 'abc' }, { sid: 'a', actor: a });
  assert.equal(first.error, undefined, first.error);
  assert.equal(first.note.kind, 'DECISION');
  assert.equal(first.note.by, 'Claude Code');
  assert.match((await t.workspace.call('add_note', { text: '   ' }, { sid: 'a', actor: a })).error, /vazia/);

  await t.workspace.call('open_project', { file: 'notas.json' }, { sid: 'b', actor: b });
  const listed = await t.workspace.call('list_notes', {}, { sid: 'b', actor: b });
  assert.equal(listed.count, 1);
  assert.equal(listed.notes[0].body, 'Hero em coluna para caber no celular');
  const reply = await t.workspace.call('add_note', { text: 'Concordo, conferi no iPhone SE', kind: 'comment', reply_to: first.note.id }, { sid: 'b', actor: b });
  assert.equal(reply.note.parentId, first.note.id);
  assert.match((await t.workspace.call('add_note', { text: 'x', reply_to: '00000000-0000-0000-0000-000000000000' }, { sid: 'b', actor: b })).error, /não existe/);
  await t.workspace.call('resolve_note', { id: reply.note.id }, { sid: 'b', actor: b });
  assert.equal((await t.workspace.call('list_notes', { include_resolved: false }, { sid: 'a', actor: a })).count, 1);
  assert.equal((await t.workspace.call('list_notes', { kind: 'comment' }, { sid: 'a', actor: a })).count, 1);
  assert.equal((await t.workspace.call('list_notes', { layer_id: 'abc' }, { sid: 'a', actor: a })).count, 1);

  await new Promise((r) => setTimeout(r, 50));
  const activity = await t.workspace.call('get_activity', {}, { sid: 'a', actor: a });
  assert.ok(activity.activity.some((o: any) => o.tool === 'add_note' && o.who === 'Claude Code' && /Hero em coluna/.test(o.summary)));
  assert.equal((await t.workspace.call('get_activity', { agent: 'codex' }, { sid: 'a', actor: a })).activity.every((o: any) => o.who === 'Codex'), true);
  await t.close();
});

test('comentar exige o escopo "comment" (ou "write"); leitor puro só lê as notas', async () => {
  const t = await setup();
  const full = await t.agentOf('Completo');
  const reader = await t.agentOf('Leitor', t.owner, ['read']);
  const commenter = await t.agentOf('Revisor', t.owner, ['read', 'comment']);
  await t.workspace.call('new_project', { name: 'Revisao' }, { sid: 'f', actor: full });
  await t.workspace.call('open_project', { file: 'revisao.json' }, { sid: 'r', actor: reader });
  await t.workspace.call('open_project', { file: 'revisao.json' }, { sid: 'c', actor: commenter });
  assert.match((await t.workspace.call('add_note', { text: 'oi' }, { sid: 'r', actor: reader })).error, /permissão de comentar/);
  assert.equal((await t.workspace.call('add_note', { text: 'ajustar o contraste', kind: 'comment' }, { sid: 'c', actor: commenter })).error, undefined);
  assert.equal((await t.workspace.call('list_notes', {}, { sid: 'r', actor: reader })).count, 1);
  assert.match((await t.workspace.call('create_layer', { type: 'rect' }, { sid: 'c', actor: commenter })).error, /permissão de escrita/);
  await t.close();
});

test('compartilhar: só o dono; convida por e-mail com papel; lista e remove membros', async () => {
  const t = await setup();
  const dono = await t.agentOf('Do dono');
  await t.workspace.call('new_project', { name: 'Equipe 2' }, { sid: 'd', actor: dono });
  const shared = await t.workspace.call('share_project', { email: 'OUTRO@x.com', role: 'viewer' }, { sid: 'd', actor: dono });
  assert.equal(shared.member.role, 'VIEWER');
  assert.match((await t.workspace.call('share_project', { email: 'ninguem@x.com' }, { sid: 'd', actor: dono })).error, /Não existe conta/);
  assert.match((await t.workspace.call('share_project', { email: 'dono@x.com' }, { sid: 'd', actor: dono })).error, /já é o dono/);
  const members = (await t.workspace.call('list_members', {}, { sid: 'd', actor: dono })).members;
  assert.deepEqual(members.map((m: any) => [m.email, m.role]), [['dono@x.com', 'OWNER'], ['outro@x.com', 'VIEWER']]);

  // quem é só membro não compartilha
  const visitante = await t.agentOf('Visitante', t.other);
  await t.workspace.call('open_project', { file: 'equipe-2.json' }, { sid: 'v', actor: visitante });
  assert.match((await t.workspace.call('share_project', { email: 'dono@x.com' }, { sid: 'v', actor: visitante })).error, /Só o dono/);
  await t.workspace.call('unshare_project', { email: 'outro@x.com' }, { sid: 'd', actor: dono });
  assert.equal((await t.workspace.call('list_members', {}, { sid: 'd', actor: dono })).members.length, 1);
  const stranger = await t.agentOf('Visitante2', t.other);
  assert.match((await t.workspace.call('open_project', { file: 'equipe-2.json' }, { sid: 'v2', actor: stranger })).error, /não encontrado/i);
  await t.close();
});

test('who_is_here devolve o retrato da presença injetada', async () => {
  const t = await setup();
  const a = await t.agentOf('A');
  await t.workspace.call('new_project', { name: 'P' }, { sid: 'a', actor: a });
  assert.deepEqual(await t.workspace.call('who_is_here', {}, { sid: 'a', actor: a }), { agents: [] });
  await t.close();
});

test('get_image usa o renderizador injetado e devolve a imagem para o MCP', async () => {
  const { db, close } = await createDb({ pglite: {} });
  const owner = await db.user.create({ data: { email: 'r@x.com', name: 'R', passwordHash: '!', role: 'OWNER' } });
  const ag = await db.agent.create({ data: { name: 'A', ownerId: owner.id, tokenHash: 'h-r', scopes: ['read', 'write'], status: 'ACTIVE' } });
  const actor: Actor = { type: 'AGENT', userId: owner.id, agentId: ag.id, name: 'A', scopes: ag.scopes };
  let workspace: ReturnType<typeof createWorkspace>;
  const projects = createProjects({ db, getConfig: () => ({ keepVersions: 5 }), onWrite: (e) => { void workspace.externalWrite(e); } });
  const seen: number[] = [];
  workspace = createWorkspace({ projects, notes: createNotes(db), sharing: createSharing(db), operations: createOperations(db), renderImage: async (node, _doc, scale) => { seen.push(node.w * scale); return 'UE5HRkFLRQ=='; } });
  await workspace.call('new_project', { name: 'Foto' }, { sid: 's', actor });
  await workspace.call('create_layer', { type: 'frame', props: { name: 'Hero', w: 320, h: 180 } }, { sid: 's', actor });
  const out = await workspace.call('get_image', { scale: 2 }, { sid: 's', actor });
  assert.equal(out.error, undefined, out.error);
  assert.deepEqual(out._image, { data: 'UE5HRkFLRQ==', mimeType: 'image/png' });
  assert.deepEqual(seen, [640]);
  await close();
});

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SVG_B64 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="red"/></svg>').toString('base64');

test('add_asset: envia imagem (base64, data URL ou endereço), reaproveita a repetida, recusa o que não é imagem e guarda fora do JSON', async () => {
  const fetched: string[] = [];
  const t = await setup({ fetchImage: async (url) => { fetched.push(url); return { bytes: Uint8Array.from(Buffer.from(SVG_B64, 'base64')) }; } });
  const a = await t.agentOf('Claude Code');
  await t.workspace.call('new_project', { name: 'Imagens' }, { sid: 's', actor: a });

  const first = await t.workspace.call('add_asset', { data_base64: PNG_B64 }, { sid: 's', actor: a });
  assert.equal(first.error, undefined, first.error);
  assert.deepEqual([first.format, first.width, first.height, first.reused], ['png', 1, 1, false]);
  const again = await t.workspace.call('add_asset', { data_url: `data:image/png;base64,${PNG_B64}` }, { sid: 's', actor: a });
  assert.equal(again.asset_id, first.asset_id, 'a mesma imagem não vira dois assets');
  assert.equal(again.reused, true);

  // por endereço (o servidor baixa) e já inserindo numa camada, com as dimensões do SVG sem navegador
  const remote = await t.workspace.call('add_asset', { source_url: 'https://exemplo.com/logo.svg', insert: true, name: 'Logo' }, { sid: 's', actor: a });
  assert.equal(remote.error, undefined, remote.error);
  assert.deepEqual(fetched, ['https://exemplo.com/logo.svg']);
  assert.equal(remote.created.name, 'Logo');
  assert.deepEqual([remote.width, remote.height], [200, 100]);
  assert.deepEqual([remote.created.w, remote.created.h], [200, 100]);

  // erros claros
  assert.match((await t.workspace.call('add_asset', {}, { sid: 's', actor: a })).error, /exatamente UM/);
  assert.match((await t.workspace.call('add_asset', { data_base64: PNG_B64, data_url: `data:image/png;base64,${PNG_B64}` }, { sid: 's', actor: a })).error, /exatamente UM/);
  assert.match((await t.workspace.call('add_asset', { data_base64: Buffer.from('isso nao e imagem nenhuma').toString('base64') }, { sid: 's', actor: a })).error, /não é uma imagem/);
  assert.match((await t.workspace.call('add_asset', { data_base64: '@@@' }, { sid: 's', actor: a })).error, /base64 inválido/);

  // list_assets enxerga; ao gravar, o JSON do projeto fica sem base64 e a tabela de imagens recebe
  const listed = await t.workspace.call('list_assets', {}, { sid: 's', actor: a });
  assert.ok(listed.count >= 1);
  await t.workspace.flushAll();
  const row = await t.db.project.findFirstOrThrow({ where: { slug: 'imagens.json' } });
  assert.equal(JSON.stringify(row.doc).includes('base64'), false);
  assert.equal(await t.db.asset.count({ where: { projectId: row.id } }), 2);
  const loaded = await t.projects.load({ id: t.owner.id }, 'imagens.json');
  assert.ok(Object.values<string>(loaded.doc.assets).every((v) => v.startsWith('data:image/')), 'ao ler, as imagens voltam como data URL');
  await t.close();
});

test('add_asset sem como baixar (source_url) explica; leitor sem escrita não envia', async () => {
  const t = await setup();
  const w = await t.agentOf('Escritor');
  const r = await t.agentOf('Leitor', t.owner, ['read']);
  await t.workspace.call('new_project', { name: 'Sem Download' }, { sid: 'w', actor: w });
  assert.match((await t.workspace.call('add_asset', { source_url: 'https://exemplo.com/a.png' }, { sid: 'w', actor: w })).error, /não está disponível/);
  await t.workspace.call('open_project', { file: 'sem-download.json' }, { sid: 'r', actor: r });
  assert.match((await t.workspace.call('add_asset', { data_base64: PNG_B64 }, { sid: 'r', actor: r })).error, /permissão de escrita/);
  await t.close();
});

test('insert_icon funciona no servidor (SVG lido com o DOM do linkedom, sem navegador)', async (t) => {
  await import('../apps/server/src/dom-polyfill.ts');
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9h-12v-9h-3z"/></svg>', { status: 200 })) as typeof fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const tt = await setup();
  const a = await tt.agentOf('A');
  await tt.workspace.call('new_project', { name: 'Icones' }, { sid: 'a', actor: a });
  const out = await tt.workspace.call('insert_icon', { name: 'home', size: 32, color: '#2255cc' }, { sid: 'a', actor: a });
  assert.equal(out.error, undefined, out.error);
  assert.equal(out.created.type, 'path');
  assert.equal(out.created.fill, '#2255CC');
  await tt.close();
});

test('export_site com format "react" pelo MCP lista o projeto Vite/React; export_zip devolve o endereço do zip React; format inválido é recusado', async () => {
  const t = await setup();
  const a = await t.agentOf('Exportador');
  const call = (tool: string, args: any = {}) => t.workspace.call(tool, args, { sid: 'r', actor: a }) as Promise<any>;
  await call('new_project', { name: 'App React' });
  const frame = (await call('create_layer', { type: 'frame', props: { name: 'Home', w: 400, h: 300 } })).created;
  await call('create_layer', { type: 'text', parent_id: frame.id, props: { text: 'Olá React', tag: 'h1' } });
  const list = await call('export_site', { format: 'react' });
  assert.equal(list.error, undefined, list.error);
  const paths = list.files.map((f: any) => f.path);
  for (const p of ['package.json', 'src/App.jsx', 'src/pages/Home.jsx', 'src/pages/Home.module.css', 'index.html']) assert.ok(paths.includes(p), p);
  const jsx = await call('export_site', { format: 'react', includeContent: true, path: 'src/pages/Home.jsx' });
  assert.match(jsx.files[0].content, /Olá React/);
  assert.match(jsx.files[0].content, /export default function Home\(\)/);
  assert.match((await call('export_site', { format: 'vue' })).error, /Argumentos inválidos|format/);
  const zip = await call('export_zip');
  assert.match(zip.react_zip_url, /\/api\/projects\/app-react\.json\/react\.zip$/);
  await t.close();
});

test('medida de layout: lê o tamanho real antes de get_layer/get_document, só quando algo mudou, e segue sem erro se o renderizador falhar', async () => {
  let calls = 0;
  let broken = false;
  const measureLayout = async (roots: any[]) => {
    calls++;
    if (broken) throw new Error('sem navegador');
    const sizes = new Map<string, { w: number; h: number }>();
    for (const r of roots) sizes.set(r.id, { w: r.w, h: 777 }); // "o navegador mediu 777 de altura"
    return sizes;
  };
  const t = await setup({ measureLayout });
  const a = await t.agentOf('Medidor');
  const call = (tool: string, args: any = {}) => t.workspace.call(tool, args, { sid: 'm', actor: a }) as Promise<any>;
  await call('new_project', { name: 'Medida' });
  const made = (await call('create_layer', { type: 'frame', props: { name: 'Tela', w: 400, h: 100, sizeY: 'hug' } })).created;
  assert.equal(calls, 0, 'escrever não mede');
  const layer = await call('get_layer', { id: made.id });
  assert.equal(layer.layer?.h ?? layer.h, 777, 'a leitura vê o tamanho medido');
  const before = calls;
  await call('get_document');
  await call('find_layers', { query: 'Tela' });
  assert.equal(calls, before, 'sem escrita nova, não mede de novo');
  await call('update_layer', { id: made.id, props: { name: 'Tela 2' } });
  await call('get_document');
  assert.equal(calls, before + 1, 'depois de escrever, mede uma vez');
  broken = true;
  await call('update_layer', { id: made.id, props: { name: 'Tela 3' } });
  const doc = await call('get_document');
  assert.equal(doc.error, undefined, 'falha do renderizador não quebra a leitura');
  const afterFail = calls;
  await call('update_layer', { id: made.id, props: { name: 'Tela 4' } });
  await call('get_document');
  assert.equal(calls, afterFail, 'depois de uma falha, espera antes de tentar de novo');
  await t.close();
});

test('check_design e get_image por breakpoint pelo MCP: junta regras estáticas e vazamento; sem navegador avisa; breakpoint e argumento inválidos explicam', async () => {
  const widthsSeen: any[] = [];
  const png = (h: number) => { const b = Buffer.alloc(24); b.writeUInt32BE(390, 16); b.writeUInt32BE(h, 20); return b.toString('base64'); };
  const optsSeen: any[] = [];
  let textId = '';
  const t = await setup({
    auditLayout: async (_roots, _doc, widths) => { widthsSeen.push(...widths); return [{ nodeId: textId, label: 'celular (390px)', width: 390, right: 520, left: 8 }]; },
    renderImage: async (_n, _d, _s, opts) => { optsSeen.push(opts); return png(900); },
  });
  const a = await t.agentOf('Auditor');
  const call = (tool: string, args: any = {}) => t.workspace.call(tool, args, { sid: 'c', actor: a }) as Promise<any>;
  await call('new_project', { name: 'Auditoria' });
  const tela = (await call('create_layer', { type: 'frame', props: { name: 'Tela', w: 800, h: 400, fill: '#111111' } })).created;
  const texto = (await call('create_layer', { type: 'text', parent_id: tela.id, props: { name: 'Frase', text: 'oi', fontSize: 10, fill: '#222222' } })).created;
  textId = texto.id;
  const rep = await call('check_design', {});
  assert.equal(rep.error, undefined, rep.error);
  assert.deepEqual(rep.issues.map((i: any) => i.type).sort(), ['contraste', 'texto-pequeno', 'vazamento']);
  assert.equal(rep.errors, 2);
  assert.equal(rep.issues[0].severity, 'erro', 'erros primeiro');
  assert.ok(widthsSeen.some((w) => w.label === 'desktop (800px)') && widthsSeen.some((w) => w.label === 'celular (390px)'), 'confere desktop e cada breakpoint');
  assert.equal(rep.note, undefined, 'o navegador respondeu: sem aviso de que faltou');
  const so = await call('check_design', { id: tela.id, breakpoints: ['mobile'] });
  assert.deepEqual(so.widths, ['desktop (800px)', 'celular (390px)']);
  assert.match((await call('check_design', { breakpoints: ['nada'] })).error, /Breakpoint "nada" não existe/);
  assert.match((await call('check_design', { bp: 'mobile' })).error, /Argumento desconhecido em check_design: bp. Aceitos: id, breakpoints/);

  const img = await call('get_image', { id: tela.id, breakpoint: 'mobile' });
  assert.equal(img.error, undefined, img.error);
  assert.deepEqual(optsSeen.at(-1), { width: 390 });
  assert.deepEqual([img.breakpoint, img.width, img.w, img.h], ['mobile', 390, 390, 900], 'altura lida do PNG desenhado');
  assert.match((await call('get_image', { id: tela.id, breakpoint: 'watch' })).error, /Breakpoint "watch" não existe/);
  await call('get_image', { id: tela.id });
  assert.equal(optsSeen.at(-1), undefined, 'sem breakpoint: desenho normal');
  await t.close();

  // sem navegador de auditoria: só as regras estáticas e um aviso claro
  const t2 = await setup();
  const b = await t2.agentOf('Sem navegador');
  const call2 = (tool: string, args: any = {}) => t2.workspace.call(tool, args, { sid: 'd', actor: b }) as Promise<any>;
  await call2('new_project', { name: 'Sem Nav' });
  const f2 = (await call2('create_layer', { type: 'frame', props: { name: 'Tela', w: 300, h: 100 } })).created;
  await call2('create_layer', { type: 'text', parent_id: f2.id, props: { text: 'x', fontSize: 9 } });
  const r2 = await call2('check_design', {});
  assert.deepEqual(r2.issues.map((i: any) => i.type), ['texto-pequeno']);
  assert.match(r2.note, /Vazamento horizontal NÃO foi conferido/);
  await t2.close();
});

test('build_layout devolve o tamanho MEDIDO da estrutura criada (não a estimativa da altura "hug")', async () => {
  const measureLayout = async (roots: any[]) => new Map(roots.map((r: any) => [r.id, { w: r.w, h: 777 }]));
  const t = await setup({ measureLayout });
  const a = await t.agentOf('Construtor');
  const call = (tool: string, args: any = {}) => t.workspace.call(tool, args, { sid: 'b', actor: a }) as Promise<any>;
  await call('new_project', { name: 'Build' });
  const out = await call('build_layout', { tree: { type: 'frame', props: { name: 'Tela', w: 400, sizeY: 'hug', layout: { mode: 'column' } }, children: [{ type: 'text', props: { text: 'oi' } }] } });
  assert.equal(out.error, undefined, out.error);
  assert.equal(out.created.h, 777, 'a resposta já traz a altura real');
  await t.close();
});

test('find_layers compacto e ids dispensam medição; summary pede geometria atual', async () => {
  let calls = 0;
  const t = await setup({ measureLayout: async roots => { calls++; return new Map(roots.map(r => [r.id, { w: r.w, h: 777 }])); } });
  try {
    const actor = await t.agentOf('Busca');
    const call = (tool: string, args: any = {}) => t.workspace.call(tool, args, { sid: 'busca', actor }) as Promise<any>;
    await call('new_project', { name: 'Busca pequena' });
    const made = await call('create_layer', { type: 'frame', props: { name: 'Tela', w: 400, h: 100, sizeY: 'hug' } });
    for (const args of [{}, { fields: 'ids' }]) {
      const out = await call('find_layers', args);
      assert.equal(out.error, undefined); assert.equal(out.layers[0].id, made.created.id);
      assert.equal(calls, 0, 'busca leve não chama renderizador');
      assert.ok(Buffer.byteLength(JSON.stringify(out, null, 2), 'utf8') <= 8192);
    }
    const summary = await call('find_layers', { fields: 'summary' });
    assert.equal(summary.error, undefined); assert.equal(summary.layers[0].h, 777); assert.equal(calls, 1);
  } finally { await t.close(); }
});

test('inspect_layout pelo workspace aceita leitor e não grava medidas responsivas nos dados base', async () => {
  let measures = 0, inspections = 0;
  const t = await setup({
    measureLayout: async () => { measures++; return new Map(); },
    inspectLayout: async (_root, _doc, opts) => {
      inspections++;
      return { viewport: { width: opts.width, height: 800 }, root: { x: 0, y: 0, w: opts.width, h: 777 }, layers: opts.ids.map(id => ({ id, parentId: null, rendered: true, visible: true, box: { x: 0, y: 0, w: opts.width, h: 777 } })) };
    },
  });
  try {
    const writer = await t.agentOf('Criador'); const reader = await t.agentOf('Leitor de layout', t.owner, ['read']);
    const call = (tool: string, args: any = {}, actor = writer, sid = 'inspector') => t.workspace.call(tool, args, { sid, actor }) as Promise<any>;
    await call('new_project', { name: 'Inspeção sem escrita' });
    const { created } = await call('create_layer', { type: 'frame', props: { w: 600, h: 100 } });
    await call('save_project');
    await call('open_project', { file: 'inspecao-sem-escrita.json' }, reader, 'reader');
    const before = await t.projects.load({ id: t.owner.id }, 'inspecao-sem-escrita.json');
    const out = await call('inspect_layout', { id: created.id, width: 390 }, reader, 'reader');
    assert.equal(out.error, undefined, out.error); assert.equal(out.layers[0].box.w, 390); assert.equal(out.layers[0].box.h, 777);
    assert.equal(inspections, 1); assert.equal(measures, 0, 'inspeção não chama a medição que altera geometria desktop');
    await t.workspace.flushAll();
    const after = await t.projects.load({ id: t.owner.id }, 'inspecao-sem-escrita.json');
    assert.equal(after.contentHash, before.contentHash); assert.equal(after.doc.pages[0].children[0].w, 600); assert.equal(after.doc.pages[0].children[0].h, 100);
  } finally { await t.close(); }
});
