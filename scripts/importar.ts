/**
 * importar.ts — IMPORTA PROJETOS .json ANTIGOS PARA O BANCO (uso pontual: testes e aproveitar o que já existe)
 *
 *   npm run importar -- <pasta> [--owner email]
 *
 * - Lê cada `*.json` da pasta que seja um projeto do Stylo (tem `pages`); ignora versões (.versoes) e miniaturas.
 * - Grava como projeto de `--owner` (padrão: o usuário local). Nome de arquivo já existente é PULADO, nunca sobrescrito.
 * - Usa o mesmo banco do servidor (DESIGNER_CONFIG / DESIGNER_DB). Com o servidor ligado em
 *   SQLite, o ideal é parar o servidor antes de importar muita coisa.
 * Os .json NÃO são o armazenamento do Stylo; este comando é só uma ponte.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { openDb, defaultDbFile } from '../apps/server/src/db.ts';
import { createProjects, FILE_RE } from '../apps/server/src/services/projects.ts';
import { createAuth } from '../apps/server/src/services/auth.ts';

const args = process.argv.slice(2);
const folder = args.find((a) => !a.startsWith('--'));
const ownerEmail = args.includes('--owner') ? args[args.indexOf('--owner') + 1] : '';
if (!folder) {
  console.error('Uso: npm run importar -- <pasta com .json> [--owner email]');
  process.exit(1);
}

const configFile = resolve(process.env.DESIGNER_CONFIG || 'designer.config.json');
const { db, close } = await openDb({ file: defaultDbFile(configFile) });
try {
  const auth = createAuth(db);
  const owner = ownerEmail
    ? await db.user.findUnique({ where: { email: ownerEmail.toLowerCase() } })
    : await auth.localUser();
  if (!owner) throw new Error(`Não existe conta com o e-mail ${ownerEmail}.`);
  const projects = createProjects({ db, getConfig: () => ({ keepVersions: 20 }) });

  const names = (await readdir(folder)).filter((f) => FILE_RE.test(f)).sort();
  const done: string[] = [], skipped: string[] = [], invalid: string[] = [];
  for (const file of names) {
    let doc: any;
    try { doc = JSON.parse(await readFile(join(folder, file), 'utf8')); } catch { invalid.push(`${file} (JSON ilegível)`); continue; }
    if (!Array.isArray(doc?.pages)) { invalid.push(`${file} (não é um projeto)`); continue; }
    if (await projects.exists({ id: owner.id }, file)) { skipped.push(file); continue; }
    await projects.write({ id: owner.id }, file, doc);
    done.push(file);
  }
  console.log(`Importados: ${done.length}${done.length ? ' → ' + done.join(', ') : ''}`);
  if (skipped.length) console.log(`Pulados (já existem): ${skipped.join(', ')}`);
  if (invalid.length) console.log(`Ignorados: ${invalid.join(', ')}`);
} finally {
  await close();
}
