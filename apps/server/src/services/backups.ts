import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import type { Db } from '@stylo/db/client.ts';
import { httpError } from '../http-error.js';

const BACKUP_PREFIX = 'stylo-backup-';
const PENDING = '.stylo-restore-pending.json';

export type BackupInfo = { id: string; createdAt: string; bytes: number };

async function sizeOf(path: string): Promise<number> {
  const info = await stat(path);
  if (info.isFile()) return info.size;
  const children = await readdir(path, { withFileTypes: true });
  return (await Promise.all(children.map((x) => sizeOf(join(path, x.name))))).reduce((a, b) => a + b, 0);
}

export function createBackups({ dbDir, db, postgres }: { dbDir: string; db: Db; postgres: boolean }) {
  const parent = dirname(dbDir);
  const base = basename(dbDir);
  const pathFor = (id: string) => join(parent, `${BACKUP_PREFIX}${base}-${id}`);
  const validId = (id: string) => /^[0-9]{8}-[0-9]{6}$/.test(id);

  async function list(): Promise<BackupInfo[]> {
    const names = await readdir(parent, { withFileTypes: true });
    const prefix = `${BACKUP_PREFIX}${base}-`;
    const rows: BackupInfo[] = [];
    for (const item of names.filter((x) => x.isDirectory() && x.name.startsWith(prefix))) {
      const id = item.name.slice(prefix.length);
      if (!validId(id)) continue;
      const createdAt = new Date(id.replace('-', 'T').replace('-', ':') + ':00Z');
      rows.push({ id, createdAt: Number.isNaN(createdAt.getTime()) ? new Date(0).toISOString() : createdAt.toISOString(), bytes: await sizeOf(join(parent, item.name)) });
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function create(): Promise<BackupInfo> {
    if (postgres) throw httpError(400, 'Para PostgreSQL, use pg_dump/pg_restore; não é seguro copiar a pasta do processo.');
    const now = new Date();
    const id = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const target = pathFor(id);
    await db.$executeRawUnsafe('CHECKPOINT');
    await cp(dbDir, target, { recursive: true, errorOnExist: true });
    return { id, createdAt: now.toISOString(), bytes: await sizeOf(target) };
  }

  async function restore(id: string) {
    if (postgres) throw httpError(400, 'Para PostgreSQL, restaure com pg_restore.');
    if (!validId(id)) throw httpError(400, 'Backup inválido.');
    const source = pathFor(id);
    await stat(source).catch(() => { throw httpError(404, 'Backup não encontrado.'); });
    // Guarda o estado atual antes de preparar a troca, para que uma restauração
    // mal escolhida também seja reversível no próximo boot.
    const safetyNow = new Date();
    const safetyId = safetyNow.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    let safetyTarget = join(parent, `${BACKUP_PREFIX}${base}-${safetyId}-pre-restore`);
    if (await stat(safetyTarget).catch(() => null)) safetyTarget = `${safetyTarget}-${Date.now()}`;
    await db.$executeRawUnsafe('CHECKPOINT');
    await cp(dbDir, safetyTarget, { recursive: true, errorOnExist: true });
    await writeFile(join(parent, PENDING), JSON.stringify({ source, requestedAt: new Date().toISOString() }), 'utf8');
    return { ok: true, restartRequired: true, id, safetyBackup: basename(safetyTarget) };
  }

  return { list, create, restore, pendingFile: join(parent, PENDING) };
}

export async function applyPendingRestore(dbDir: string) {
  const marker = join(dirname(dbDir), PENDING);
  let source = '';
  try { source = JSON.parse(await readFile(marker, 'utf8')).source; } catch { return false; }
  if (!source || source === dbDir) return false;
  const quarantine = `${dbDir}.quarantined-${Date.now()}`;
  await rename(dbDir, quarantine);
  try {
    await rename(source, dbDir);
    await rm(marker, { force: true });
    return true;
  } catch (err) {
    await rename(quarantine, dbDir).catch(() => {});
    throw err;
  }
}

export type Backups = ReturnType<typeof createBackups>;
