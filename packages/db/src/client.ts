/**
 * @stylo/db — CLIENTE DO BANCO (Postgres + Prisma)
 *
 * Dois modos, o mesmo código por cima:
 *   - `url`    Postgres de verdade (produção, servidor pessoal com Docker): `postgresql://...`
 *   - `pglite` Postgres embutido no próprio processo (uso local sem instalar nada, e testes). `dir` guarda em disco;
 *              sem `dir`, fica só na memória.
 * O esquema vem de prisma/migrations/*.sql. Em Postgres de verdade use `prisma migrate deploy`; no PGlite o
 * `applyMigrations` roda os mesmos arquivos.
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from './generated/client.ts';

export type Db = PrismaClient;
export type DbOptions = { url: string } | { pglite: { dir?: string } };

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'migrations');

/** Lê os arquivos de migração em ordem (0001_init, 0002_...). */
async function migrationFiles(): Promise<{ name: string; sql: string }[]> {
  const dirs = (await readdir(migrationsDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  return Promise.all(dirs.map(async (name) => ({ name, sql: await readFile(join(migrationsDir, name, 'migration.sql'), 'utf8') })));
}

export async function createDb(options: DbOptions): Promise<{ db: Db; close: () => Promise<void> }> {
  if ('url' in options) {
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: options.url }) });
    return { db, close: () => db.$disconnect() };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { PrismaPGlite } = await import('pglite-prisma-adapter');
  const client = new PGlite(options.pglite.dir);
  await client.waitReady;
  // marca as migrações já aplicadas para poder abrir o mesmo diretório de novo
  await client.exec('CREATE TABLE IF NOT EXISTS "_stylo_migrations" (name text PRIMARY KEY)');
  const done = new Set((await client.query<{ name: string }>('SELECT name FROM "_stylo_migrations"')).rows.map((r) => r.name));
  for (const m of await migrationFiles()) {
    if (done.has(m.name)) continue;
    await client.exec(m.sql);
    await client.query('INSERT INTO "_stylo_migrations" (name) VALUES ($1)', [m.name]);
  }
  const db = new PrismaClient({ adapter: new PrismaPGlite(client) });
  return { db, close: async () => { await db.$disconnect(); await client.close(); } };
}
