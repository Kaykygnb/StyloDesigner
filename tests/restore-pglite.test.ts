import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDb } from '@stylo/db/client.ts';
import { sanitizeDoc } from '@stylo/core/validate.js';
import { createProjects } from '../apps/server/src/services/projects.ts';
import { applyPendingRestore, createBackups } from '../apps/server/src/services/backups.ts';

const checksum = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fixtureDoc = {
  version: 1, name: 'Restore sintético', assets: {
    pixel: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=',
  },
  pages: [{ id: 'page-restore', name: 'Início', children: [] }],
};
const projectsFor = (db: Awaited<ReturnType<typeof createDb>>['db']) => createProjects({ db, getConfig: () => ({ keepVersions: 5 }) });

test('PGlite real: snapshot anterior à migration restaura projeto no próximo boot e preserva cópia de segurança do estado posterior', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stylo-restore-real-'));
  const dir = join(root, 'db');
  let handle: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    handle = await createDb({ pglite: { dir } });
    const { db } = handle;
    const owner = await db.user.create({ data: { email: 'restore@example.invalid', name: 'Fixture', passwordHash: 'synthetic-not-a-password', role: 'OWNER' } });
    const viewer = await db.user.create({ data: { email: 'viewer@example.invalid', name: 'Viewer', passwordHash: 'synthetic-not-a-password' } });
    const project = await projectsFor(db).write(owner, 'restore.json', fixtureDoc);
    await db.projectMember.create({ data: { projectId: project.projectId, userId: viewer.id, role: 'VIEWER' } });
    const agent = await db.agent.create({ data: { ownerId: owner.id, name: 'Fixture agent', tokenHash: 'synthetic-token-hash', scopes: ['read'], status: 'ACTIVE' } });
    await db.agentProject.create({ data: { agentId: agent.id, projectId: project.projectId } });
    await projectsFor(db).snapshot(owner, 'restore.json', 'Antes do backup');
    const assetHash = checksum(Array.from((await db.asset.findFirstOrThrow()).data));
    const expected = await projectsFor(db).load(owner, 'restore.json');
    const hash = checksum(expected.doc);
    const beforeMigrations = await db.$queryRawUnsafe<{ name: string }[]>('SELECT name FROM "_stylo_migrations" ORDER BY name');
    assert.equal(beforeMigrations.at(-1)?.name, '0014_agent_type');
    // Reconstitui explicitamente o estado do contrato imediatamente anterior
    // a 0014, somente neste banco descartável. Não é um backup histórico real.
    await db.$executeRawUnsafe('ALTER TABLE "Agent" DROP COLUMN "type"');
    await db.$executeRawUnsafe('DELETE FROM "_stylo_migrations" WHERE name = \'0014_agent_type\'');
    const backups = createBackups({ dbDir: dir, db, postgres: false });
    const snapshot = await backups.create();
    assert(snapshot.bytes > 0);
    assert.equal((await backups.list())[0].id, snapshot.id);
    await projectsFor(db).write(owner, 'restore.json', { ...fixtureDoc, name: 'Posterior ao backup' }, { base: { hash: expected.contentHash } });
    const later = await projectsFor(db).load(owner, 'restore.json');
    const requested = await backups.restore(snapshot.id);
    assert.equal(requested.restartRequired, true);
    assert.equal(checksum((await projectsFor(db).load(owner, 'restore.json')).doc), checksum(later.doc), 'solicitar restore não troca o banco aberto');
    await handle.close(); handle = undefined;
    assert.equal(await applyPendingRestore(dir), true);
    assert.equal(await applyPendingRestore(dir), false);
    handle = await createDb({ pglite: { dir } });
    const restored = await projectsFor(handle.db).load(owner, 'restore.json');
    assert.equal(restored.id, expected.id);
    assert.equal(restored.revision, expected.revision);
    assert.equal(checksum(restored.doc), hash);
    assert.deepEqual(sanitizeDoc(structuredClone(restored.doc)), []);
    assert.equal((await projectsFor(handle.db).load(viewer, 'restore.json')).role, 'VIEWER');
    assert.equal(await handle.db.user.count(), 2);
    assert.equal(await handle.db.project.count(), 1);
    assert.equal(await handle.db.projectMember.count(), 1);
    assert.equal(await handle.db.agent.count(), 1);
    assert.equal(await handle.db.agentProject.count(), 1);
    assert.equal(await handle.db.projectVersion.count(), 1);
    assert.equal(await handle.db.asset.count(), 1);
    assert.equal(checksum(Array.from((await handle.db.asset.findFirstOrThrow()).data)), assetHash);
    assert.equal((await projectsFor(handle.db).versions(owner, 'restore.json'))[0].label, 'Antes do backup');
    const restoredAgent = await handle.db.agent.findUnique({ where: { id: agent.id } });
    assert(restoredAgent, 'identidade do agente preservada');
    assert.equal(restoredAgent.ownerId, owner.id);
    assert.equal(restoredAgent.status, 'ACTIVE');
    assert.deepEqual(restoredAgent.scopes, ['read']);
    assert(await handle.db.agentProject.findUnique({ where: { agentId_projectId: { agentId: agent.id, projectId: expected.id } } }), 'grant original preservado');
    assert.equal(restoredAgent.type, 'mcp', 'migration 0014 aplicada realmente');
    assert.deepEqual(await handle.db.$queryRawUnsafe('SELECT name FROM "_stylo_migrations" ORDER BY name'), beforeMigrations);
    const dirs = await readdir(root);
    assert(dirs.some(name => name.startsWith('db.before-migrations-')), 'backup preventivo de migração existe');
    assert(dirs.some(name => name.startsWith('db.quarantined-')), 'estado substituído preservado');
    await handle.close(); handle = undefined;
    // Prova que a cópia de segurança também abre e preserva a revisão posterior.
    handle = await createDb({ pglite: { dir: join(root, requested.safetyBackup) } });
    assert.equal(checksum((await projectsFor(handle.db).load(owner, 'restore.json')).doc), checksum(later.doc));
  } finally {
    if (handle) await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('PGlite real: fonte de restore ausente recupera diretório original e mantém projeto intacto', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stylo-restore-failure-'));
  const dir = join(root, 'db');
  let handle: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    handle = await createDb({ pglite: { dir } });
    const owner = await handle.db.user.create({ data: { email: 'failure@example.invalid', name: 'Fixture', passwordHash: 'synthetic-not-a-password', role: 'OWNER' } });
    await projectsFor(handle.db).write(owner, 'original.json', fixtureDoc);
    const expected = await projectsFor(handle.db).load(owner, 'original.json');
    const backups = createBackups({ dbDir: dir, db: handle.db, postgres: false });
    const snapshot = await backups.create();
    await assert.rejects(backups.restore('../outside'), { status: 400 });
    await backups.restore(snapshot.id);
    const pending = await readFile(backups.pendingFile, 'utf8');
    const { source } = JSON.parse(pending);
    await handle.close(); handle = undefined;
    await rm(source, { recursive: true }); // falha determinística em caminho próprio
    await assert.rejects(applyPendingRestore(dir), { code: 'ENOENT' });
    assert((await stat(dir)).isDirectory());
    assert.equal(await readFile(backups.pendingFile, 'utf8'), pending, 'pedido preservado para diagnóstico');
    assert(!(await readdir(root)).some(name => name.startsWith('db.quarantined-')), 'original devolvido ao caminho correto');
    handle = await createDb({ pglite: { dir } });
    const actual = await projectsFor(handle.db).load(owner, 'original.json');
    assert.equal(checksum(actual.doc), checksum(expected.doc));
    assert.equal(actual.id, expected.id);
    assert.equal(actual.revision, expected.revision);
    assert.equal(await handle.db.project.count(), 1);
  } finally {
    if (handle) await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});
