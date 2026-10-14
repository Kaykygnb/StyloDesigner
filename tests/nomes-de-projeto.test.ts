// Projetos moram no banco: o nome não termina em ".json" (herança do tempo dos arquivos), mas a entrada antiga ainda funciona.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDb } from '@stylo/db/client.ts';
import { checkName, createProjects, fileNameFor } from '../apps/server/src/services/projects.ts';

const doc = (name: string) => ({ name, pages: [{ id: 'p', name: 'P', children: [] }], assets: {}, styles: { colors: [], texts: [] } });

test('checkName: tira o .json, valida e recusa nomes perigosos', () => {
  assert.equal(checkName('meu-site'), 'meu-site');
  assert.equal(checkName('meu-site.json'), 'meu-site');
  assert.equal(checkName('Versão.v2'.replace('ã', 'a')), 'Versao.v2');
  for (const bad of ['', '.oculto', '-x', 'a/b', '..', 'a..b', 'x.json.json', 'con', 'NUL.json', 'com1', 'lpt9.json', 'fim.', 'a b', 'ç', 'x'.repeat(92)]) {
    assert.throws(() => checkName(bad), { status: 400 }, `"${bad}" deveria ser recusado`);
  }
  assert.equal(checkName('consulta'), 'consulta');
});

test('fileNameFor: título livre vira nome limpo, sem extensão', () => {
  assert.equal(fileNameFor('Meu Site!'), 'meu-site');
  assert.equal(fileNameFor('Café com Leite.json'), 'cafe-com-leite');
  assert.equal(fileNameFor('   '), 'projeto');
  assert.equal(fileNameFor('日本語'), 'projeto');
});

test('com ou sem .json é o mesmo projeto', async () => {
  const { db, close } = await createDb();
  try {
    const me = await db.user.create({ data: { email: 'a@x.invalid', name: 'A', passwordHash: 'x' } });
    const projects = createProjects({ db, getConfig: () => ({ keepVersions: 5 }) });
    const first = await projects.write(me, 'novo.json', doc('Novo'));
    assert.equal(first.file, 'novo');
    assert.equal((await projects.load(me, 'novo')).id, first.projectId);
    assert.equal((await projects.load(me, 'novo.json')).id, first.projectId);
    assert.equal(await projects.exists(me, 'NOVO.json'.toLowerCase()), true);
    const second = await projects.write(me, 'novo', doc('Novo 2'), { base: { hash: first.contentHash } });
    assert.equal(second.projectId, first.projectId);
    assert.equal(await db.project.count(), 1);
    assert.deepEqual((await projects.list(me)).map((p) => p.file), ['novo']);
    assert.equal((await projects.rename(me, 'novo.json', 'outro.json')).file, 'outro');
  } finally { await close(); }
});

test('migração 0002: projetos antigos perdem o .json do nome, sem colidir com nomes já limpos', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stylo-slug-'));
  const file = join(root, 'designer.sqlite');
  try {
    const first = await createDb({ file });
    const a = await first.db.user.create({ data: { email: 'a@x.invalid', name: 'A', passwordHash: 'x' } });
    const b = await first.db.user.create({ data: { email: 'b@x.invalid', name: 'B', passwordHash: 'x' } });
    for (const [owner, slug] of [[a, 'velho.json'], [a, 'colide.json'], [a, 'colide'], [b, 'colide.json'], [a, 'JSON.JSON'], [a, '.json']] as const) {
      await first.db.project.create({ data: { slug, name: slug, ownerId: owner.id, doc: {} } });
    }
    await first.db.$executeRawUnsafe('PRAGMA user_version = 1'); // como se o banco fosse de antes da migração
    await first.close();
    const second = await createDb({ file });
    const slugs = (await second.db.project.findMany({ orderBy: { name: 'asc' } })).map((p: any) => `${p.name}→${p.slug}`);
    assert.deepEqual(slugs, ['.json→.json', 'JSON.JSON→JSON', 'colide→colide', 'colide.json→colide-antigo', 'colide.json→colide', 'velho.json→velho']);
    assert.ok(second.backup && (await readdir(root)).some((n) => n.includes('before-migrations')), 'cópia preventiva antes de migrar');
    await second.close();
  } finally { await rm(root, { recursive: true, force: true }); }
});
