/**
 * importar.ts — IMPORTA PROJETOS .json ANTIGOS PARA O BANCO (uso pontual: testes e aproveitar o que já existe)
 *
 *   npm run importar -- <pasta> [--owner usuário-ou-email]
 *
 * - Lê cada `*.json` da pasta que seja um projeto do Stylo (tem `pages`); ignora versões (.versoes) e miniaturas.
 * - Grava como projeto de `--owner` (usuário ou e-mail). Sem isso, usa a autoridade principal, ou a única conta. Nome de arquivo já existente é PULADO.
 * - Usa o mesmo banco do servidor (DESIGNER_CONFIG / DESIGNER_DB_DIR / DATABASE_URL). Com o servidor ligado em
 *   PGlite, pare-o antes: o PGlite aceita um processo por vez.
 * Os .json NÃO são o armazenamento do Stylo; este comando é só uma ponte.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { openDb, defaultDbDir } from '../apps/server/src/db.ts';
import { createProjects, FILE_RE } from '../apps/server/src/services/projects.ts';
import { createAuth } from '../apps/server/src/services/auth.ts';

const args = process.argv.slice(2);
const folder = args.find((a) => !a.startsWith('--'));
const ownerKey = args.includes('--owner') ? args[args.indexOf('--owner') + 1] : '';
if (!folder) {
  console.error('Uso: npm run importar -- <pasta com .json> [--owner usuário-ou-email]');
  process.exit(1);
}

const configFile = resolve(process.env.DESIGNER_CONFIG || 'designer.config.json');
const { db, close } = await openDb({ dir: defaultDbDir(configFile) });
try {
  const auth = createAuth(db);
  const key = ownerKey.trim().toLowerCase();
  const owner = key
    ? await db.user.findFirst({ where: key.includes('@') ? { email: key } : { username: key } })
    : await (async () => {
      const principalId = await auth.principalId();
      if (principalId) return db.user.findUnique({ where: { id: principalId } });
      const people = await db.user.findMany({ where: { NOT: { passwordHash: '!' } }, take: 2 });
      return people.length === 1 ? people[0] : null;
    })();
  if (!owner) throw new Error(key ? `Não existe conta com o identificador ${ownerKey}.` : 'Informe --owner com o nome de usuário ou o e-mail. Há mais de uma conta, ou nenhuma.');
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
