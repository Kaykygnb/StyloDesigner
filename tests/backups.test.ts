import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
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
type Handle = Awaited<ReturnType<typeof createDb>>;
const projectsFor = (db: Handle['db']) => createProjects({ db, getConfig: () => ({ keepVersions: 5 }) });

test('backup: cria, lista e restaura no próximo início, preservando projeto, imagens, membros e agentes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stylo-restore-real-'));
  const file = join(root, 'designer.sqlite');
  let handle: Handle | undefined;
  try {
    handle = await createDb({ file });
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

    const backups = createBackups({ dbFile: file, db });
    const snapshot = await backups.create();
    assert.match(snapshot.id, /^\d{8}-\d{6}$/);
    assert(snapshot.bytes > 0);
    assert.equal((await backups.list())[0].id, snapshot.id);

    await projectsFor(db).write(owner, 'restore.json', { ...fixtureDoc, name: 'Posterior ao backup' }, { base: { hash: expected.contentHash } });
    const later = await projectsFor(db).load(owner, 'restore.json');
    const requested = await backups.restore(snapshot.id);
    assert.equal(requested.restartRequired, true);
    assert.match(requested.safetyBackup, /pre-restore/);
    assert.equal(checksum((await projectsFor(db).load(owner, 'restore.json')).doc), checksum(later.doc), 'solicitar restore não troca o banco aberto');
    await handle.close(); handle = undefined;

    assert.equal(await applyPendingRestore(file), true);
    assert.equal(await applyPendingRestore(file), false);
    handle = await createDb({ file });
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
    assert.deepEqual(restoredAgent.scopes, ['read']);
    assert(await handle.db.agentProject.findUnique({ where: { agentId_projectId: { agentId: agent.id, projectId: expected.id } } }), 'grant original preservado');
    const names = await readdir(root);
    assert(names.some((name) => name.startsWith('designer.sqlite.quarantined-')), 'estado substituído preservado');
    assert(names.includes(`stylo-backup-designer.sqlite-${snapshot.id}`), 'a cópia escolhida não é consumida');
    await handle.close(); handle = undefined;
    // a cópia de segurança do estado anterior também abre e guarda a revisão posterior
    handle = await createDb({ file: join(root, requested.safetyBackup) });
    assert.equal(checksum((await projectsFor(handle.db).load(owner, 'restore.json')).doc), checksum(later.doc));
  } finally {
    if (handle) await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('backup: lista datas UTC do mais novo ao mais antigo', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stylo-backups-test-'));
  const file = join(root, 'designer.sqlite');
  const handle = await createDb({ file });
  try {
    const backups = createBackups({ dbFile: file, db: handle.db });
    for (const id of ['20251231-235959', '20260101-000001', '20260203-123456']) {
      const created = await backups.create();
      await rename(join(root, `stylo-backup-designer.sqlite-${created.id}`), join(root, `stylo-backup-designer.sqlite-${id}`));
    }
    assert.deepEqual((await backups.list()).map(({ id, createdAt }) => ({ id, createdAt })), [
      { id: '20260203-123456', createdAt: '2026-02-03T12:34:56.000Z' },
      { id: '20260101-000001', createdAt: '2026-01-01T00:00:01.000Z' },
      { id: '20251231-235959', createdAt: '2025-12-31T23:59:59.000Z' },
    ]);
  } finally {
    await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('backup: id inválido é recusado e fonte ausente mantém o banco atual intacto', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stylo-restore-failure-'));
  const file = join(root, 'designer.sqlite');
  let handle: Handle | undefined;
  try {
    handle = await createDb({ file });
    const owner = await handle.db.user.create({ data: { email: 'failure@example.invalid', name: 'Fixture', passwordHash: 'synthetic-not-a-password', role: 'OWNER' } });
    await projectsFor(handle.db).write(owner, 'original.json', fixtureDoc);
    const expected = await projectsFor(handle.db).load(owner, 'original.json');
    const backups = createBackups({ dbFile: file, db: handle.db });
    const snapshot = await backups.create();
    await assert.rejects(backups.restore('../outside'), { status: 400 });
    await assert.rejects(backups.restore('20200101-000000'), { status: 404 });
    await backups.restore(snapshot.id);
    const pending = await readFile(backups.pendingFile, 'utf8');
    const { source } = JSON.parse(pending);
    await handle.close(); handle = undefined;
    await rm(source); // falha determinística: a cópia sumiu
    await assert.rejects(applyPendingRestore(file), { code: 'ENOENT' });
    assert((await stat(file)).isFile());
    assert.equal(await readFile(backups.pendingFile, 'utf8'), pending, 'pedido preservado para diagnóstico');
    assert(!(await readdir(root)).some((name) => name.includes('quarantined')), 'nada foi movido');
    handle = await createDb({ file });
    const actual = await projectsFor(handle.db).load(owner, 'original.json');
    assert.equal(checksum(actual.doc), checksum(expected.doc));
    assert.equal(actual.revision, expected.revision);
  } finally {
    if (handle) await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('banco: o esquema é criado uma vez, reabrir preserva os dados e arquivo estranho é recusado', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stylo-reopen-'));
  const file = join(root, 'designer.sqlite');
  try {
    const first = await createDb({ file });
    await first.db.user.create({ data: { email: 'a@example.invalid', name: 'A', passwordHash: 'x' } });
    assert.equal(first.schemaVersion, first.migrations.length);
    await first.close();
    await copyFile(file, join(root, 'copia.sqlite'));
    const second = await createDb({ file });
    assert.equal(await second.db.user.count(), 1);
    assert.equal(second.backup, null, 'sem migração pendente não há cópia preventiva');
    await second.close();
    await writeFile(file, 'isto não é um banco');
    await assert.rejects(createDb({ file }), /not a database|malformed/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
