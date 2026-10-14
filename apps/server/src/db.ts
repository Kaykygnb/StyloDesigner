/**
 * db.ts — ABRE O BANCO DO SERVIDOR
 * Um arquivo SQLite ao lado da configuração (designer.sqlite): nada para instalar. `memory` → só na memória (testes).
 */

import { createDb } from '@stylo/db/client.ts';

const baseOf = (configFile: string) => configFile.replace(/(\.config)?\.json$/i, '');

/** Arquivo do banco: `DESIGNER_DB`, ou "<arquivo de configuração sem .json>.sqlite" (ex.: designer.sqlite). */
export const defaultDbFile = (configFile: string) => process.env.DESIGNER_DB || baseOf(configFile) + '.sqlite';

/** Pasta do banco ANTIGO (PGlite), de onde os dados são trazidos uma vez: "<configuração sem .json>.db". */
export const legacyDbDir = (configFile: string) => process.env.DESIGNER_LEGACY_DB_DIR || baseOf(configFile) + '.db';

/** Pasta dos arquivos grandes (biblioteca, zips publicados), ao lado do banco. */
export const defaultBlobDir = (dbFile: string) => process.env.STYLO_BLOB_DIR || dbFile.replace(/\.(sqlite|db)$/i, '') + '.blobs';

export function openDb({ file }: { file: string }) {
  return createDb({ file: file === 'memory' ? undefined : file });
}
