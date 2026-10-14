/**
 * services/backups.ts — CÓPIAS DE SEGURANÇA DO BANCO (um arquivo SQLite)
 *
 * - criar: copia o banco inteiro, de forma consistente, para "stylo-backup-<banco>-<data>" ao lado dele;
 * - restaurar: guarda antes uma cópia do estado atual ("...-pre-restore") e deixa um pedido para o PRÓXIMO início do
 *   servidor trocar o arquivo (não dá para trocar o banco enquanto ele está aberto). A cópia escolhida não é consumida.
 */

import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import type { Db } from '@stylo/db/client.ts';
import { httpError } from '../http-error.js';

const BACKUP_PREFIX = 'stylo-backup-';
const PENDING = '.stylo-restore-pending.json';

export type BackupInfo = { id: string; createdAt: string; bytes: number };

const stampOf = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

export function createBackups({ dbFile, db }: { dbFile: string; db: Db }) {
  const parent = dirname(dbFile);
  const base = basename(dbFile);
  const pathFor = (id: string) => join(parent, `${BACKUP_PREFIX}${base}-${id}`);
  const validId = (id: string) => /^[0-9]{8}-[0-9]{6}$/.test(id);

  async function list(): Promise<BackupInfo[]> {
    const names = await readdir(parent, { withFileTypes: true });
    const prefix = `${BACKUP_PREFIX}${base}-`;
    const rows: BackupInfo[] = [];
    for (const item of names.filter((x) => x.isFile() && x.name.startsWith(prefix))) {
      const id = item.name.slice(prefix.length);
      if (!validId(id)) continue;
      const createdAt = new Date(`${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}T${id.slice(9, 11)}:${id.slice(11, 13)}:${id.slice(13, 15)}Z`);
      rows.push({ id, createdAt: Number.isNaN(createdAt.getTime()) ? new Date(0).toISOString() : createdAt.toISOString(), bytes: (await stat(join(parent, item.name))).size });
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function create(): Promise<BackupInfo> {
    const now = new Date();
    const id = stampOf(now);
    const target = pathFor(id);
    await mkdir(parent, { recursive: true });
    await db.$backupTo(target);
    return { id, createdAt: now.toISOString(), bytes: (await stat(target)).size };
  }

  async function restore(id: string) {
    if (!validId(id)) throw httpError(400, 'Backup inválido.');
    const source = pathFor(id);
    await stat(source).catch(() => { throw httpError(404, 'Backup não encontrado.'); });
    // Guarda o estado atual antes de preparar a troca, para que uma restauração
    // mal escolhida também seja reversível no próximo início.
    let safetyTarget = join(parent, `${BACKUP_PREFIX}${base}-${stampOf(new Date())}-pre-restore`);
    if (await stat(safetyTarget).catch(() => null)) safetyTarget = `${safetyTarget}-${Date.now()}`;
    await db.$backupTo(safetyTarget);
    await writeFile(join(parent, PENDING), JSON.stringify({ source, requestedAt: new Date().toISOString() }), 'utf8');
    return { ok: true, restartRequired: true, id, safetyBackup: basename(safetyTarget) };
  }

  return { list, create, restore, pendingFile: join(parent, PENDING) };
}

/** Roda ANTES de abrir o banco: se há um pedido de restauração, troca o arquivo (o atual fica em quarentena). */
export async function applyPendingRestore(dbFile: string) {
  const marker = join(dirname(dbFile), PENDING);
  let source = '';
  try { source = JSON.parse(await readFile(marker, 'utf8')).source; } catch { return false; }
  if (!source || source === dbFile) return false;
  await stat(source); // some a fonte? o pedido fica guardado e o banco atual não é tocado
  const quarantine = `${dbFile}.quarantined-${Date.now()}`;
  const hadCurrent = await stat(dbFile).then(() => true, () => false);
  const moved: string[] = [];
  const quarantineCurrent = async () => {
    // o arquivo e os restos do modo WAL (-wal/-shm) formam um conjunto: vão juntos para a quarentena
    for (const suffix of ['', '-wal', '-shm']) {
      if (await stat(dbFile + suffix).then(() => true, () => false)) { await rename(dbFile + suffix, quarantine + suffix); moved.push(suffix); }
    }
  };
  if (hadCurrent) await quarantineCurrent();
  try {
    await copyFile(source, dbFile);
    await rm(marker, { force: true });
    return true;
  } catch (err) {
    await rm(dbFile, { force: true }).catch(() => {});
    for (const suffix of moved) await rename(quarantine + suffix, dbFile + suffix).catch(() => {});
    throw err;
  }
}

export type Backups = ReturnType<typeof createBackups>;
