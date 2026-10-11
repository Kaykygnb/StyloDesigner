/**
 * db.ts — ABRE O BANCO DO SERVIDOR
 *   DATABASE_URL definido  → Postgres de verdade (produção / servidor pessoal)
 *   senão                  → PGlite (Postgres embutido) numa pasta ao lado da configuração: nada para instalar
 *   dir === 'memory'       → PGlite só na memória (testes)
 */

import { createDb } from '@stylo/db/client.ts';

export function openDb({ dir }: { dir: string }) {
  const url = process.env.DATABASE_URL;
  if (url) return createDb({ url });
  return createDb({ pglite: dir === 'memory' ? {} : { dir } });
}
