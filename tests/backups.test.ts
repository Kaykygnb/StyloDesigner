import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rename, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyPendingRestore, createBackups } from '../apps/server/src/services/backups.ts';

test('backup PGlite cria e lista snapshot', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stylo-backups-test-'));
  const dir = join(root, 'db');
  try {
    await mkdir(dir);
    await writeFile(join(dir, 'state.txt'), 'ok');
    const backups = createBackups({ dbDir: dir, db: { $executeRawUnsafe: async () => 0 } as any, postgres: false });
    const created = await backups.create();
    assert.match(created.id, /^\d{8}-\d{6}$/);
    const snapshots = await backups.list();
    assert.equal(snapshots.length, 1);
    const [listed] = snapshots;
    assert.equal(listed.id, created.id);
    assert.equal(listed.createdAt, created.createdAt.replace(/\.\d{3}Z$/, '.000Z'));
    assert.equal(listed.bytes, created.bytes);
    await writeFile(join(dir, 'state.txt'), 'changed');
    const restored = await backups.restore(created.id);
    assert.equal(restored.restartRequired, true);
    assert.match(restored.safetyBackup, /pre-restore/);
    const pending = JSON.parse(await readFile(backups.pendingFile, 'utf8'));
    assert.equal(pending.source, join(root, `stylo-backup-db-${created.id}`));
    assert.equal(await readFile(join(root, restored.safetyBackup, 'state.txt'), 'utf8'), 'changed');
    assert.equal(await readFile(join(dir, 'state.txt'), 'utf8'), 'changed');
    assert.equal(await applyPendingRestore(dir), true);
    assert.equal(await readFile(join(dir, 'state.txt'), 'utf8'), 'ok');
    assert.equal(await applyPendingRestore(dir), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('backup lista datas UTC corretas do mais novo ao mais antigo', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stylo-backups-test-'));
  const dir = join(root, 'db');
  try {
    await mkdir(dir);
    await writeFile(join(dir, 'state.txt'), 'snapshot');
    const backups = createBackups({ dbDir: dir, db: { $executeRawUnsafe: async () => 0 } as any, postgres: false });
    for (const id of ['20251231-235959', '20260101-000001', '20260203-123456']) {
      const created = await backups.create();
      await rename(join(root, `stylo-backup-db-${created.id}`), join(root, `stylo-backup-db-${id}`));
    }
    assert.deepEqual((await backups.list()).map(({ id, createdAt }) => ({ id, createdAt })), [
      { id: '20260203-123456', createdAt: '2026-02-03T12:34:56.000Z' },
      { id: '20260101-000001', createdAt: '2026-01-01T00:00:01.000Z' },
      { id: '20251231-235959', createdAt: '2025-12-31T23:59:59.000Z' },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
