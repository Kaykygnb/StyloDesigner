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

async function setup() {
  const { db, close } = await createDb({ pglite: {} });
  const owner = await db.user.create({ data: { email: 'dono@x.com', name: 'Dono', passwordHash: '!', role: 'OWNER' } });
  const other = await db.user.create({ data: { email: 'outro@x.com', name: 'Outro', passwordHash: '!' } });
  const operations = createOperations(db);
  let workspace: ReturnType<typeof createWorkspace>;
  const projects = createProjects({ db, getConfig: () => ({ keepVersions: 5 }), onWrite: (e) => { void workspace.externalWrite(e); } });
  workspace = createWorkspace({ projects, notes: createNotes(db), sharing: createSharing(db), operations, presence: () => ({ agents: [] }), onOperation: (op) => { void operations.record(op); } });
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
