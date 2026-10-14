// Autoridade principal (DOC-SERVER-006): designação no setup, proteção só do principal
// e migração que não escolhe conta antiga. PGlite em memória; sem rede e sem DATABASE_URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { createDb } from '@stylo/db/client.ts';
import { createAuth, LOCAL_EMAIL } from '../apps/server/src/services/auth.ts';
import { createIdentity } from '../apps/server/src/http/identity.ts';
import { authRoutes } from '../apps/server/src/routes/auth.ts';
import type { Services } from '../apps/server/src/context.ts';

const PASSWORD = 'senha-sintetica';

async function memory() {
  const { db, close } = await createDb({ pglite: {} });
  const auth = createAuth(db);
  return { db, close, auth };
}

async function snapshot(db: Awaited<ReturnType<typeof memory>>['db'], id: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id } });
  const sessions = await db.session.count({ where: { userId: id } });
  return { role: user.role, suspended: user.suspended, passwordHash: user.passwordHash, mustChangePassword: user.mustChangePassword, email: user.email, sessions };
}

function httpApp(db: Awaited<ReturnType<typeof memory>>['db'], auth: ReturnType<typeof createAuth>, localUser: Awaited<ReturnType<ReturnType<typeof createAuth>['localUser']>>) {
  const services = { db, auth, authMode: 'accounts' as const, localUser, config: { get: () => ({}) } } as unknown as Services;
  const app = new Hono();
  app.onError((error, c) => c.json({ error: error.message }, (error as { status?: number }).status || 500));
  app.route('/api', authRoutes(services, createIdentity(services)));
  return app;
}

test('migração 0015 não escolhe principal e não altera contas existentes', async () => {
  const { db, close } = await memory();
  try {
    await db.$executeRawUnsafe('DROP TABLE "Installation"');
    await db.$executeRawUnsafe(`DELETE FROM "_stylo_migrations" WHERE name = '0015_autoridade_principal'`);
    await db.user.create({ data: { email: LOCAL_EMAIL, name: 'Você', passwordHash: '!', role: 'OWNER', createdAt: new Date('2019-01-01T00:00:00Z') } });
    await db.user.create({ data: { email: 'primeiro@synthetic.test', name: 'Primeiro', passwordHash: 'hash-um', role: 'OWNER', createdAt: new Date('2020-01-01T00:00:00Z') } });
    await db.user.create({ data: { email: 'segundo@synthetic.test', name: 'Segundo', passwordHash: 'hash-dois', role: 'ADMIN', createdAt: new Date('2024-06-01T00:00:00Z') } });
    const before = await db.user.findMany({ orderBy: { email: 'asc' }, select: { id: true, email: true, role: true, passwordHash: true, suspended: true } });
    const sql = await readFile(fileURLToPath(new URL('../packages/db/prisma/migrations/0015_autoridade_principal/migration.sql', import.meta.url)), 'utf8');
    assert.doesNotMatch(sql, /UPDATE\s+"User"/i);
    assert.doesNotMatch(sql, /createdAt|ORDER BY|min\(|max\(/i);
    for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) await db.$executeRawUnsafe(statement);
    assert.equal((await db.installation.findUniqueOrThrow({ where: { id: 1 } })).principalUserId, null);
    const after = await db.user.findMany({ orderBy: { email: 'asc' }, select: { id: true, email: true, role: true, passwordHash: true, suspended: true } });
    assert.deepEqual(after, before);
    await assert.rejects(db.$executeRawUnsafe('INSERT INTO "Installation" ("id", "principalUserId") VALUES (2, NULL)'));
  } finally {
    await close();
  }
});

test('setup designa a primeira conta humana; o usuário técnico e uma segunda corrida não viram principal', async () => {
  const { db, close, auth } = await memory();
  try {
    const local = await auth.localUser();
    assert.equal(await auth.principalId(), null);
    assert.equal(local.email, LOCAL_EMAIL);
    await assert.rejects(auth.setup({ email: LOCAL_EMAIL, name: 'Local', password: PASSWORD }), /reservado/);
    const [first, second] = await Promise.allSettled([
      auth.setup({ email: 'um@synthetic.test', name: 'Um', password: PASSWORD }),
      auth.setup({ email: 'dois@synthetic.test', name: 'Dois', password: PASSWORD }),
    ]);
    const fulfilled = [first, second].filter((result) => result.status === 'fulfilled');
    assert.equal(fulfilled.length, 1, 'só uma conta humana sobrevive à corrida do setup');
    const winner = fulfilled[0].status === 'fulfilled' ? fulfilled[0].value : null;
    assert.ok(winner);
    assert.equal(winner.role, 'OWNER');
    assert.equal(await auth.principalId(), winner.id);
    assert.equal(await db.user.count({ where: { email: { not: LOCAL_EMAIL } } }), 1);
    assert.notEqual((await db.user.findUniqueOrThrow({ where: { email: LOCAL_EMAIL } })).id, winner.id);
    await assert.rejects(auth.setup({ email: 'tres@synthetic.test', name: 'Três', password: PASSWORD }), /Já existe uma conta mestre/);
    assert.equal(await db.user.count({ where: { email: { not: LOCAL_EMAIL } } }), 1);
  } finally {
    await close();
  }
});

test('principal designado: negativas não mutam; OWNER adicional não é o principal; legado sem ponteiro não bloqueia todo OWNER', async () => {
  const { db, close, auth } = await memory();
  try {
    const local = await auth.localUser();
    const principal = await auth.setup({ email: 'principal@synthetic.test', name: 'Principal', password: PASSWORD });
    const admin = await auth.createUser({ email: 'admin@synthetic.test', name: 'Admin', password: PASSWORD, role: 'ADMIN' });
    await auth.changePassword(admin.id, PASSWORD, 'senha-admin-2');
    const member = await auth.createUser({ email: 'membro@synthetic.test', name: 'Membro', password: PASSWORD, role: 'MEMBER' });
    const adminLogin = await auth.login(admin.email, 'senha-admin-2');
    const principalLogin = await auth.login(principal.email, PASSWORD);
    await auth.login(principal.email, PASSWORD);
    const app = httpApp(db, auth, local);
    const call = async (token: string, method: string, path: string, body?: unknown) => {
      const response = await app.request('/api' + path, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      const json = await response.json() as { error?: string; role?: string; id?: string; suspended?: boolean; user?: { id: string; role: string } };
      return { status: response.status, json };
    };

    const before = await snapshot(db, principal.id);
    assert.equal(before.sessions, 2);
    const suspend = await call(adminLogin.token, 'POST', '/users/' + principal.id + '/suspend', { suspended: true });
    const demote = await call(adminLogin.token, 'PUT', '/users/' + principal.id, { role: 'MEMBER' });
    const remove = await call(adminLogin.token, 'DELETE', '/users/' + principal.id);
    assert.equal(suspend.status, 403);
    assert.equal(demote.status, 403);
    assert.equal(remove.status, 403);
    assert.match(String(demote.json.error), /autoridade principal/);
    assert.deepEqual(await snapshot(db, principal.id), before);

    const self = await call(principalLogin.token, 'PUT', '/users/' + principal.id, { role: 'ADMIN' });
    assert.equal(self.status, 403);
    assert.equal((await snapshot(db, principal.id)).role, 'OWNER');

    await auth.changePassword(member.id, PASSWORD, 'senha-membro-2');
    const memberToken = (await auth.login(member.email, 'senha-membro-2')).token;
    const memberDemote = await call(memberToken, 'PUT', '/users/' + principal.id, { role: 'MEMBER' });
    assert.equal(memberDemote.status, 403);
    assert.equal((await snapshot(db, principal.id)).role, 'OWNER');

    const createdOwner = await call(principalLogin.token, 'POST', '/users', { email: 'socio@synthetic.test', name: 'Sócio', password: PASSWORD, role: 'OWNER' });
    assert.equal(createdOwner.status, 201);
    assert.equal(createdOwner.json.user?.role, 'OWNER');
    const secondId = createdOwner.json.user!.id;
    assert.notEqual(secondId, principal.id);
    assert.equal(await auth.principalId(), principal.id);
    await auth.changePassword(secondId, PASSWORD, 'senha-socio-2');
    const secondLogin = await auth.login('socio@synthetic.test', 'senha-socio-2');
    const secondGrant = await call(secondLogin.token, 'POST', '/users', { email: 'terceiro@synthetic.test', name: 'Terceiro', password: PASSWORD, role: 'OWNER' });
    assert.equal(secondGrant.status, 403);
    assert.equal(await db.user.count({ where: { email: 'terceiro@synthetic.test' } }), 0);
    const secondDemote = await call(secondLogin.token, 'PUT', '/users/' + principal.id, { role: 'MEMBER', name: 'Tomada' });
    assert.equal(secondDemote.status, 403);
    const afterHostileOwner = await snapshot(db, principal.id);
    assert.equal(afterHostileOwner.role, 'OWNER');
    assert.equal(afterHostileOwner.email, 'principal@synthetic.test');
    assert.equal(afterHostileOwner.passwordHash, before.passwordHash);

    const promoted = await call(adminLogin.token, 'PUT', '/users/' + member.id, { role: 'OWNER' });
    assert.equal(promoted.status, 403);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: member.id } })).role, 'MEMBER');
    const suspendedMember = await call(adminLogin.token, 'POST', '/users/' + member.id + '/suspend', { suspended: true });
    assert.equal(suspendedMember.status, 200);
    assert.equal(suspendedMember.json.suspended, true);
    const demotedSecond = await call(adminLogin.token, 'PUT', '/users/' + secondId, { role: 'ADMIN' });
    assert.equal(demotedSecond.status, 200);
    assert.equal(demotedSecond.json.role, 'ADMIN');
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: principal.id } })).role, 'OWNER');
    const renamed = await call(adminLogin.token, 'PUT', '/users/' + principal.id, { name: 'Principal atualizado', role: 'OWNER' });
    assert.equal(renamed.status, 200);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: principal.id } })).name, 'Principal atualizado');

    await db.installation.update({ where: { id: 1 }, data: { principalUserId: null } });
    assert.equal(await auth.principalId(), null);
    const legacy = await auth.updateUser(principal.id, { role: 'MEMBER' }, { id: secondId, role: 'OWNER' });
    assert.equal(legacy.role, 'MEMBER', 'sem designação, a proteção não se estende a todo OWNER');
    await db.user.update({ where: { id: principal.id }, data: { role: 'OWNER' } });
    await db.installation.update({ where: { id: 1 }, data: { principalUserId: principal.id } });
    await assert.rejects(auth.updateUser(principal.id, { role: 'MEMBER' }, { id: admin.id, role: 'ADMIN' }), /autoridade principal/);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: principal.id } })).role, 'OWNER');
  } finally {
    await close();
  }
});
