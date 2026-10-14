import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '@stylo/db/client.ts';
import { createProjects } from '../apps/server/src/services/projects.ts';
import { createOperations } from '../apps/server/src/services/operations.ts';
import { createNotes } from '../apps/server/src/services/notes.ts';
import { createSharing } from '../apps/server/src/services/sharing.ts';
import { createWorkspace, type Actor } from '../apps/server/src/workspace/index.ts';

test('update_layers registra todas as 60 camadas e recusa escopo de leitura e membro VIEWER', async (t) => {
  const { db, close } = await createDb();
  const owner = await db.user.create({ data: { email: 'lote@x.com', name: 'Dono', passwordHash: '!', role: 'OWNER' } });
  const visitor = await db.user.create({ data: { email: 'visitante-lote@x.com', name: 'Visitante', passwordHash: '!' } });
  const operations = createOperations(db);
  const projects = createProjects({ db, getConfig: () => ({ keepVersions: 5 }) });
  const workspace = createWorkspace({ projects, operations, notes: createNotes(db), sharing: createSharing(db), presence: () => ({}), onOperation: (op) => { void operations.record(op); } });
  t.after(async () => { await operations.idle(); await close(); });
  const actor: Actor = { type: 'USER', userId: owner.id, name: 'Dono', scopes: ['read', 'write', 'export'] };
  const call = (tool: string, args: any = {}, a = actor, sid = 'owner') => workspace.call(tool, args, { actor: a, sid });
  await call('new_project', { name: 'Lote' });
  const ids: string[] = [];
  for (let i = 0; i < 60; i++) {
    const made = await call('create_layer', { type: 'rect', props: { name: `Antes ${i}` } });
    assert.equal(made.error, undefined, made.error);
    ids.push(made.created.id);
  }
  const updates = ids.map((id, i) => ({ id, props: { name: `Depois ${i}` } }));
  const out = await call('update_layers', { updates });
  assert.equal(out.error, undefined, out.error);
  await operations.idle();
  const saved = await projects.load({ id: owner.id }, 'lote.json');
  const log = await operations.list(saved.id);
  assert.deepEqual(log.find((op) => op.tool === 'update_layers')?.layerIds, ids);
  const reader: Actor = { ...actor, scopes: ['read'] };
  await call('open_project', { file: 'lote.json' }, reader, 'reader');
  assert.match((await call('update_layers', { updates }, reader, 'reader')).error, /permissão de escrita/);
  await db.projectMember.create({ data: { projectId: saved.id, userId: visitor.id, role: 'VIEWER' } });
  const viewer: Actor = { ...actor, userId: visitor.id, name: 'Visitante' };
  await call('open_project', { file: 'lote.json' }, viewer, 'viewer');
  assert.match((await call('update_layers', { updates }, viewer, 'viewer')).error, /só pode ler/);
  assert.match(JSON.stringify(await call('get_layer', { id: ids[0] })), /Depois 0/);
  await operations.idle();
  assert.equal((await operations.list(saved.id)).filter((op) => op.tool === 'update_layers').length, 1, 'recusas por permissão não geram gravação nem log de edição');
});
