/**
 * legacy.ts — TRAZ OS DADOS DO BANCO ANTIGO (PGlite/Postgres embutido) PARA O SQLITE
 *
 * Versões anteriores guardavam tudo numa pasta (ex.: designer.db/). Na primeira abertura com o SQLite o servidor chama
 * isto UMA vez: lê cada tabela da pasta antiga e grava no banco novo. A pasta antiga não é alterada nem apagada.
 * O pacote @electric-sql/pglite só é carregado aqui (e é opcional): quem nunca teve o banco antigo não paga nada.
 */

import { MODELS, delegateName } from './schema.ts';
import type { Db } from './client.ts';

/** Ordem que respeita as chaves estrangeiras. */
const ORDER = ['User', 'AuthEvent', 'Session', 'Agent', 'Project', 'ProjectMember', 'AgentProject', 'PublishRecord', 'Asset', 'ProjectVersion', 'Operation', 'Note', 'LibraryAsset', 'ProviderSecret', 'AssetSource'];
const PAGE = 25;

export async function importLegacyPglite(dir: string, db: Db, log: (line: string) => void = () => {}): Promise<Record<string, number>> {
  let PGlite: typeof import('@electric-sql/pglite').PGlite;
  try {
    ({ PGlite } = await import('@electric-sql/pglite'));
  } catch {
    throw new Error('Encontrei um banco antigo, mas falta o pacote @electric-sql/pglite para lê-lo. Rode "npm install" (ele é opcional e só serve para esta migração).');
  }
  const pg = new PGlite(dir);
  await pg.waitReady;
  const counts: Record<string, number> = {};
  try {
    await db.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
    await db.$transaction(async (tx) => {
      for (const name of ORDER) {
        const m = MODELS[name];
        const exists = (await pg.query<{ ok: boolean }>('SELECT to_regclass($1) IS NOT NULL AS ok', [`"${m.table}"`])).rows[0]?.ok;
        counts[name] = 0;
        if (!exists) continue;
        const columns = (await pg.query<{ column_name: string }>('SELECT column_name FROM information_schema.columns WHERE table_name = $1', [m.table])).rows
          .map((r) => r.column_name).filter((c) => m.fields[c]);
        const list = columns.map((c) => `"${c}"`).join(', ');
        const paged = !!m.fields.id && m.pk.length === 1;
        for (let offset = 0; ; offset += PAGE) {
          const sql = paged ? `SELECT ${list} FROM "${m.table}" ORDER BY "id" LIMIT ${PAGE} OFFSET ${offset}` : `SELECT ${list} FROM "${m.table}"`;
          const rows = (await pg.query<Record<string, unknown>>(sql)).rows;
          if (rows.length) {
            const data = rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === undefined ? null : v])));
            // Notas respondem a notas: as mais antigas primeiro
            if (name === 'Note') data.sort((a, b) => new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime());
            await (tx as any)[delegateName(name)].createMany({ data });
            counts[name] += rows.length;
          }
          if (!paged || rows.length < PAGE) break;
        }
        log(`  ${name}: ${counts[name]}`);
      }
      // dentro da transação: se algo ficou solto, nada é gravado
      const broken = await tx.$queryRawUnsafe<unknown[]>('PRAGMA foreign_key_check');
      if (broken.length) throw new Error(`O banco antigo tem ${broken.length} referência(s) quebrada(s); a importação foi cancelada.`);
    });
  } finally {
    await db.$executeRawUnsafe('PRAGMA foreign_keys = ON').catch(() => undefined);
    await pg.close().catch(() => undefined);
  }
  return counts;
}
