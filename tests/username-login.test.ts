// Login por nome de usuário (DOC-SERVER-011): migração 0016 e entrada por usuário ou e-mail.
// PGlite em memória. O SQL da migração roda inteiro, sem partir o bloco DO $$ no ponto e vírgula.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from '@stylo/db/client.ts';
import { createAuth, normalizeUsername } from '../apps/server/src/services/auth.ts';

const PASSWORD = 'senha-sintetica';
const migrationsDir = fileURLToPath(new URL('../packages/db/prisma/migrations', import.meta.url));

async function databaseBeforeUsername() {
  const { PGlite } = await import('@electric-sql/pglite');
  const client = new PGlite();
  await client.waitReady;
  const names = (await readdir(migrationsDir)).filter((name) => name < '0016_nome_de_usuario').sort();
  for (const name of names) await client.exec(await readFile(join(migrationsDir, name, 'migration.sql'), 'utf8'));
  return client;
}

test('migração 0016 gera usuário, guarda o e-mail e não escolhe principal', async () => {
  const client = await databaseBeforeUsername();
  try {
    const rows = [
      ['11111111-1111-4111-8111-111111111111', 'Ana.Silva@Example.com', 'Ana Silva', '2020-01-01T00:00:00Z'],
      ['22222222-2222-4222-8222-222222222222', 'a.b@x.com', 'AB', '2020-01-02T00:00:00Z'],
      ['33333333-3333-4333-8333-333333333333', 'ab@y.com', 'AB dois', '2020-01-03T00:00:00Z'],
      ['44444444-4444-4444-8444-444444444444', 'user@x.com', 'User', '2020-01-04T00:00:00Z'],
      ['55555555-5555-4555-8555-555555555555', 'u.s.e.r@y.com', 'User dois', '2020-01-05T00:00:00Z'],
      ['66666666-6666-4666-8666-666666666666', '---@z.com', 'Vazio', '2020-01-06T00:00:00Z'],
      ['77777777-7777-4777-8777-777777777777', 'local@stylo.local', 'Você', '2020-01-07T00:00:00Z'],
    ];
    for (const [id, email, name, createdAt] of rows) {
      await client.query('INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "createdAt") VALUES ($1, $2, $3, $4, $5, $6)', [id, email, name, 'hash', 'MEMBER', createdAt]);
    }
    const before = await client.query<{ id: string; email: string; name: string }>('SELECT "id", "email", "name" FROM "User" ORDER BY "createdAt"');
    const sql = await readFile(join(migrationsDir, '0016_nome_de_usuario', 'migration.sql'), 'utf8');
    assert.doesNotMatch(sql, /principalUserId|DELETE FROM "User"/i);
    await client.exec(sql);
    const after = await client.query<{ id: string; email: string; name: string; username: string }>('SELECT "id", "email", "name", "username" FROM "User" ORDER BY "createdAt"');
    assert.deepEqual(after.rows.map((row) => [row.id, row.email, row.name, row.username]), [
      [rows[0][0], 'ana.silva@example.com', 'Ana Silva', 'anasilva'],
      [rows[1][0], 'a.b@x.com', 'AB', 'ab'],
      [rows[2][0], 'ab@y.com', 'AB dois', 'ab-2'],
      [rows[3][0], 'user@x.com', 'User', 'user'],
      [rows[4][0], 'u.s.e.r@y.com', 'User dois', 'user-2'],
      [rows[5][0], '---@z.com', 'Vazio', 'user-3'],
      [rows[6][0], 'local@stylo.local', 'Você', 'local'],
    ]);
    assert.deepEqual(before.rows.map((row) => row.name), after.rows.map((row) => row.name));
    assert.equal((await client.query<{ principalUserId: string | null }>('SELECT "principalUserId" FROM "Installation"')).rows[0].principalUserId, null);
    await client.query('INSERT INTO "User" ("id", "username", "email", "name", "passwordHash", "role") VALUES ($1, $2, NULL, $3, $4, $5)', ['88888888-8888-4888-8888-888888888888', 'sem-email', 'Sem e-mail', 'hash', 'MEMBER']);
    await client.query('INSERT INTO "User" ("id", "username", "email", "name", "passwordHash", "role") VALUES ($1, $2, NULL, $3, $4, $5)', ['99999999-9999-4999-8999-999999999999', 'sem-email-2', 'Outro sem e-mail', 'hash', 'MEMBER']);
    assert.equal((await client.query<{ n: number }>('SELECT count(*)::int AS n FROM "User" WHERE "email" IS NULL')).rows[0].n, 2);
  } finally {
    await client.close();
  }
});

test('login aceita usuário ou e-mail, sem distinguir maiúsculas, e recusa duplicata', async () => {
  const { db, close } = await createDb({ pglite: {} });
  const auth = createAuth(db);
  try {
    assert.throws(() => normalizeUsername('ana@x.com'), /sem @/);
    assert.throws(() => normalizeUsername('-ana'), /inválido/);
    const owner = await auth.setup({ username: 'Kayky', name: 'Kayky', password: PASSWORD });
    assert.equal(owner.username, 'kayky');
    assert.equal(owner.email, null);
    assert.equal(owner.role, 'OWNER');
    assert.equal(owner.principal, true);
    assert.equal(await auth.principalId(), owner.id);
    assert.equal((await auth.login('KAYKY', PASSWORD)).user.id, owner.id);
    await assert.rejects(auth.login('kayky@x.com', PASSWORD), /Usuário ou senha incorretos/);

    const ana = await auth.createUser({ username: 'Ana', email: 'Ana@X.com', name: 'Ana', password: PASSWORD });
    assert.equal(ana.email, 'ana@x.com');
    assert.equal(ana.username, 'ana');
    assert.equal((await auth.login('ANA', PASSWORD)).user.id, ana.id);
    assert.equal((await auth.login('ANA@X.COM', PASSWORD)).user.id, ana.id);
    await assert.rejects(auth.createUser({ username: 'ana', email: 'outra@x.com', name: 'Outra', password: PASSWORD }), /nome de usuário/);
    await assert.rejects(auth.createUser({ username: 'outra', email: 'ANA@x.com', name: 'Outra', password: PASSWORD }), /e-mail/);
    const cleared = await auth.updateUser(ana.id, { email: '' });
    assert.equal(cleared.email, null);
    assert.equal((await auth.login('ana', PASSWORD)).user.id, ana.id);
    await assert.rejects(auth.login('ana@x.com', PASSWORD), /Usuário ou senha incorretos/);
  } finally {
    await close();
  }
});
