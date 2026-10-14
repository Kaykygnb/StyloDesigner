// Migração única do banco antigo (PGlite) para o SQLite: um banco antigo real, criado pelas migrações antigas, é importado inteiro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDb } from '@stylo/db/client.ts';
import { importLegacyPglite } from '@stylo/db/legacy.ts';

const legacyMigrations = new URL('./fixtures/legacy-pglite/', import.meta.url);

test('banco antigo (PGlite) é importado: contas, projetos com imagem, versões, agentes, notas, operações e biblioteca', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stylo-legacy-'));
  const dir = join(root, 'designer.db');
  try {
    const { PGlite } = await import('@electric-sql/pglite');
    const pg = new PGlite(dir);
    await pg.waitReady;
    for (const name of (await readdir(legacyMigrations)).filter((n) => /^\d{4}_/.test(n)).sort()) {
      await pg.exec(await readFile(new URL(`${name}/migration.sql`, legacyMigrations), 'utf8'));
    }
    // o Prisma gerava os ids no cliente (sem padrão no banco): o fixture usa o padrão do Postgres só para inserir
    for (const t of ['Session', 'AuthEvent', 'Asset', 'ProjectVersion', 'LibraryAsset', 'AssetSource', 'PublishRecord']) await pg.exec(`ALTER TABLE "${t}" ALTER COLUMN id SET DEFAULT gen_random_uuid()`);
    const U = '11111111-1111-4111-8111-111111111111', V = '22222222-2222-4222-8222-222222222222', A = '33333333-3333-4333-8333-333333333333', P = '44444444-4444-4444-8444-444444444444';
    const N1 = '55555555-5555-4555-8555-555555555555', N2 = '66666666-6666-4666-8666-666666666666';
    await pg.query(`INSERT INTO "User" (id, email, name, "passwordHash", role, preferences, "mustChangePassword") VALUES ($1,'dono@x.invalid','Dono','scrypt$a$b','OWNER','{"language":"pt-BR","theme":"dark"}',false), ($2,'maria@x.invalid','Maria','scrypt$c$d','EDITOR','{}',true)`, [U, V]);
    await pg.query(`INSERT INTO "Agent" (id, name, "ownerId", "tokenHash", scopes, status) VALUES ($1,'Claude Code',$2,'hash-agent',ARRAY['read','write'],'ACTIVE')`, [A, U]);
    await pg.query(`INSERT INTO "Project" (id, slug, name, "ownerId", doc, revision, size, "docHash", thumb, "updatedAt") VALUES ($1,'meu-site.json','Meu site',$2,$3,7,123,'abc','<svg/>', now())`, [P, U, JSON.stringify({ pages: [{ id: 'p', name: 'Início ç', children: [] }], assets: { foto: 'asset:deadbeef' } })]);
    await pg.query(`INSERT INTO "ProjectMember" ("projectId", "userId", role) VALUES ($1,$2,'VIEWER')`, [P, V]);
    await pg.query(`INSERT INTO "AgentProject" ("agentId", "projectId") VALUES ($1,$2)`, [A, P]);
    await pg.query(`INSERT INTO "Asset" ("projectId", hash, mime, size, data) VALUES ($1,'deadbeef','image/png',4,$2)`, [P, new Uint8Array([137, 80, 78, 71])]);
    await pg.query(`INSERT INTO "ProjectVersion" ("projectId", revision, label, size, doc) VALUES ($1,6,'v6',10,'{"pages":[]}')`, [P]);
    await pg.query(`INSERT INTO "Operation" ("projectId", "actorType", "agentId", tool, args, summary, "layerIds", ok) VALUES ($1,'AGENT',$2,'create_layer','{"type":"frame"}','criou o hero',ARRAY['l1','l2'],true), ($1,'USER',NULL,'x',NULL,NULL,ARRAY[]::text[],false)`, [P, A]);
    await pg.query(`INSERT INTO "Note" (id, "projectId", kind, body, "authorType", "agentId") VALUES ($1,$2,'COMMENT','pai','AGENT',$3)`, [N1, P, A]);
    await pg.query(`INSERT INTO "Note" (id, "projectId", kind, body, "authorType", "userId", "parentId", resolved) VALUES ($1,$2,'COMMENT','filha','USER',$3,$4,true)`, [N2, P, V, N1]);
    await pg.query(`INSERT INTO "LibraryAsset" ("userId", kind, name, mime, size, hash, tags, license, credit) VALUES ($1,'IMAGE','Foto','image/png',4,'deadbeef',ARRAY['mar','azul'],'{"name":"CC0","commercial":true,"attribution":"none"}','Fulano')`, [U]);
    await pg.query(`INSERT INTO "ProviderSecret" ("userId", "providerId", secret, "updatedAt") VALUES ($1,'pexels','n.t.d', now())`, [U]);
    await pg.query(`INSERT INTO "AssetSource" ("userId", name, config) VALUES ($1,'Minha API','{"searchUrl":"https://x.invalid/{consulta}"}')`, [U]);
    await pg.query(`INSERT INTO "Session" ("userId", "tokenHash", "expiresAt") VALUES ($1,'sess-hash', now() + interval '10 days')`, [U]);
    await pg.query(`INSERT INTO "AuthEvent" ("userId", email, kind) VALUES ($1,'dono@x.invalid','login')`, [U]);
    await pg.close();

    const { db, close } = await createDb({ file: join(root, 'designer.sqlite') });
    try {
      const counts = await importLegacyPglite(dir, db);
      assert.equal(counts.User, 2); assert.equal(counts.Operation, 2); assert.equal(counts.Note, 2);

      const owner = await db.user.findUniqueOrThrow({ where: { email: 'dono@x.invalid' } });
      assert.equal(owner.id, U); assert.equal(owner.role, 'OWNER'); assert.equal(owner.passwordHash, 'scrypt$a$b');
      assert.deepEqual(owner.preferences, { language: 'pt-BR', theme: 'dark' });
      assert.equal(owner.mustChangePassword, false);
      assert.ok(owner.createdAt instanceof Date && owner.createdAt.getFullYear() >= 2025);
      assert.equal((await db.user.findUniqueOrThrow({ where: { email: 'maria@x.invalid' } })).mustChangePassword, true);

      const project = await db.project.findUniqueOrThrow({ where: { ownerId_slug: { ownerId: U, slug: 'meu-site' } }, include: { members: true, assets: true, versions: true, agents: true } });
      assert.equal(project.revision, 7); assert.equal(project.thumb, '<svg/>'); assert.equal(project.docHash, 'abc');
      assert.equal(project.doc.pages[0].name, 'Início ç');
      assert.equal(project.members[0].role, 'VIEWER');
      assert.deepEqual(Array.from(project.assets[0].data as Uint8Array), [137, 80, 78, 71]);
      assert.equal(project.versions[0].label, 'v6');
      assert.equal(project.agents.length, 1);

      const agent = await db.agent.findUniqueOrThrow({ where: { tokenHash: 'hash-agent' } });
      assert.deepEqual(agent.scopes, ['read', 'write']); assert.equal(agent.status, 'ACTIVE'); assert.equal(agent.type, 'mcp');

      const ops = await db.operation.findMany({ orderBy: { id: 'asc' } });
      assert.equal(typeof ops[0].id, 'bigint');
      assert.deepEqual(ops[0].layerIds, ['l1', 'l2']); assert.deepEqual(ops[0].args, { type: 'frame' }); assert.equal(ops[0].ok, true);
      assert.equal(ops[1].ok, false); assert.equal(ops[1].args, null); assert.deepEqual(ops[1].layerIds, []);
      // o contador continua de onde parou
      const next = await db.operation.create({ data: { projectId: P, actorType: 'USER', tool: 'novo' } });
      assert.equal(next.id, ops[1].id + 1n);

      const notes = await db.note.findMany({ orderBy: { createdAt: 'asc' }, include: { replies: true } });
      assert.equal(notes.find((n: any) => n.body === 'pai').replies[0].body, 'filha');
      assert.equal(notes.find((n: any) => n.body === 'filha').resolved, true);

      const asset = await db.libraryAsset.findFirstOrThrow({});
      assert.deepEqual(asset.tags, ['mar', 'azul']); assert.equal(asset.license.name, 'CC0'); assert.equal(asset.credit, 'Fulano');
      assert.equal((await db.providerSecret.findUniqueOrThrow({ where: { userId_providerId: { userId: U, providerId: 'pexels' } } })).secret, 'n.t.d');
      assert.equal((await db.assetSource.findFirstOrThrow({})).config.searchUrl, 'https://x.invalid/{consulta}');
      assert.ok((await db.session.findUniqueOrThrow({ where: { tokenHash: 'sess-hash' } })).expiresAt > new Date());
      assert.equal((await db.authEvent.findFirstOrThrow({})).kind, 'login');
      // as chaves estrangeiras voltam a valer depois da importação
      await assert.rejects(db.projectMember.create({ data: { projectId: P, userId: '00000000-0000-4000-8000-000000000000' } }), (e: any) => e.code === 'P2003');
    } finally { await close(); }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('banco antigo vazio e com esquema incompleto importa zero linhas, sem erro', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stylo-legacy-empty-'));
  try {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = join(root, 'vazio.db');
    const pg = new PGlite(dir); await pg.waitReady;
    for (const name of (await readdir(legacyMigrations)).filter((n) => /^\d{4}_/.test(n)).sort().slice(0, 3)) await pg.exec(await readFile(new URL(`${name}/migration.sql`, legacyMigrations), 'utf8'));
    await pg.close();
    const { db, close } = await createDb();
    try {
      const counts = await importLegacyPglite(dir, db);
      assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 0, 'esquema antigo incompleto e vazio: nada a trazer, sem erro');
      assert.equal(await db.user.count(), 0);
    } finally { await close(); }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
