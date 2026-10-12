import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBackups } from '../apps/server/src/services/backups.ts';

test('backup PGlite cria e lista snapshot', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'stylo-db-'));
  try {
    await writeFile(join(dir, 'state.txt'), 'ok');
    const backups = createBackups({ dbDir: dir, db: { $executeRawUnsafe: async () => 0 } as any, postgres: false });
    const created = await backups.create();
    assert.match(created.id, /^\d{8}-\d{6}$/);
    assert.equal((await backups.list()).length, 1);
    const restored = await backups.restore(created.id);
    assert.equal(restored.restartRequired, true);
    assert.match(restored.safetyBackup, /pre-restore/);
    assert.match(await readFile(join(dir.slice(0, dir.lastIndexOf('\\')), '.stylo-restore-pending.json'), 'utf8'), /"source"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
    const parent = dir.slice(0, dir.lastIndexOf('\\'));
    const { readdir } = await import('node:fs/promises');
    for (const name of await readdir(parent)) if (name.startsWith('stylo-backup-')) await rm(join(parent, name), { recursive: true, force: true });
  }
});
