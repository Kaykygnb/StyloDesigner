/**
 * @stylo/db — BANCO LOCAL (SQLite do próprio Node, sem nada para instalar)
 *
 * Um arquivo só (ex.: designer.sqlite). Sem `file`, o banco vive na memória (testes). O esquema vem de
 * migrations/*.sql, aplicadas em ordem na abertura; a versão fica no próprio arquivo (PRAGMA user_version) e,
 * antes de aplicar uma migração num banco que já existe, uma cópia de segurança é guardada ao lado.
 * A API (`db.user.findMany(...)` etc.) imita a do Prisma que o servidor já usava; veja orm.ts.
 */

import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine, type Delegate } from './orm.ts';
import { MODELS, delegateName } from './schema.ts';

// O SQLite do Node ainda avisa "experimental" no terminal. Esse aviso não ajuda quem usa o Stylo: filtramos só ele.
const emitWarning = process.emitWarning;
process.emitWarning = function (warning: string | Error, ...rest: any[]) {
  if (typeof warning === 'string' && /SQLite is an experimental/i.test(warning)) return;
  return (emitWarning as any).call(process, warning, ...rest);
} as typeof process.emitWarning;
const { DatabaseSync } = await import('node:sqlite');
process.emitWarning = emitWarning;

export interface Models {
  user: Delegate; authEvent: Delegate; session: Delegate; agent: Delegate; project: Delegate; projectMember: Delegate;
  agentProject: Delegate; publishRecord: Delegate; asset: Delegate; projectVersion: Delegate; operation: Delegate;
  note: Delegate; libraryAsset: Delegate; providerSecret: Delegate; assetSource: Delegate;
}

export type Tx = Models & {
  $queryRawUnsafe<T = any>(sql: string, ...params: any[]): Promise<T>;
  $executeRawUnsafe(sql: string, ...params: any[]): Promise<number>;
};

export type Db = Tx & {
  /** Transação interativa: tudo o que `tx` faz vale junto ou nada vale. Não use `db` lá dentro (espera a fila e trava). */
  $transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** Copia o banco inteiro, de forma consistente, para outro arquivo. */
  $backupTo(file: string): Promise<void>;
  $disconnect(): Promise<void>;
};

export interface DbHandle {
  db: Db;
  close: () => Promise<void>;
  /** Versão do esquema aplicada (número de migrações). */
  schemaVersion: number;
  /** Nomes das migrações aplicadas. */
  migrations: string[];
  /** Cópia de segurança feita antes de migrar (se houve). */
  backup: string | null;
}

export type DbOptions = { file?: string };

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export function migrationFiles(): { name: string; sql: string }[] {
  return readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort().map((f) => ({ name: f.replace(/\.sql$/, ''), sql: readFileSync(join(migrationsDir, f), 'utf8') }));
}

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').replace(/\.\d{3}Z$/, '');

export async function createDb(options: DbOptions = {}): Promise<DbHandle> {
  const file = options.file && options.file !== 'memory' ? options.file : undefined;
  const sqlite: DatabaseSyncType = new DatabaseSync(file ?? ':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (file) sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  // minúsculas também para letras fora do ASCII ("ação" / "AÇÃO"): usado nas buscas sem diferenciar maiúsculas
  sqlite.function('ulower', { deterministic: true }, (value) => (typeof value === 'string' ? value.toLowerCase() : value));

  // migrações
  const files = migrationFiles();
  const current = Number((sqlite.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
  if (current > files.length) {
    sqlite.close();
    throw new Error(`O banco foi criado por uma versão mais nova do Stylo (esquema ${current}, esta versão conhece ${files.length}).`);
  }
  let backup: string | null = null;
  if (file && current > 0 && current < files.length) {
    backup = `${file}.before-migrations-${stamp()}`;
    sqlite.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
  }
  for (let i = current; i < files.length; i++) {
    sqlite.exec('BEGIN');
    try {
      sqlite.exec(files[i].sql);
      sqlite.exec(`PRAGMA user_version = ${i + 1}`);
      sqlite.exec('COMMIT');
    } catch (err) {
      sqlite.exec('ROLLBACK');
      sqlite.close();
      throw new Error(`Falha ao aplicar a migração ${files[i].name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  const engine = createEngine(sqlite);

  // fila: uma operação por vez; uma transação segura a fila até o fim
  let tail: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(fn: () => T | Promise<T>): Promise<T> => {
    const next = tail.then(fn, fn);
    tail = next.then(() => undefined, () => undefined);
    return next as Promise<T>;
  };
  const immediate = async <T>(fn: () => T): Promise<T> => fn();

  const models = (run: <T>(fn: () => T) => Promise<T>) => {
    const out: Record<string, Delegate> = {};
    for (const name of Object.keys(MODELS)) out[delegateName(name)] = engine.delegate(name, run);
    return out as unknown as Models;
  };
  const raw = (run: <T>(fn: () => T) => Promise<T>) => ({
    $queryRawUnsafe: <T = any>(sql: string, ...params: any[]) => run(() => engine.all(sql, params) as unknown as T),
    $executeRawUnsafe: (sql: string, ...params: any[]) => run(() => Number(engine.exec(sql, params).changes)),
  });

  let closed = false;
  const db: Db = {
    ...models(exclusive),
    ...raw(exclusive),
    async $transaction<T>(fn: (tx: Tx) => Promise<T>) {
      return exclusive(async () => {
        sqlite.exec('BEGIN IMMEDIATE');
        try {
          const result = await fn({ ...models(immediate), ...raw(immediate) });
          sqlite.exec('COMMIT');
          return result;
        } catch (err) {
          sqlite.exec('ROLLBACK');
          throw err;
        }
      });
    },
    $backupTo: (target: string) => exclusive(() => {
      if (existsSync(target)) throw new Error(`O destino já existe: ${target}`);
      sqlite.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    }),
    $disconnect: async () => {
      await exclusive(() => {
        if (closed) return;
        closed = true;
        if (file) { try { sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch { /* nada a fazer */ } }
        sqlite.close();
      });
    },
  };
  return { db, close: () => db.$disconnect(), schemaVersion: files.length, migrations: files.map((f) => f.name), backup };
}
