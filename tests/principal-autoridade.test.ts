// Autoridade principal (DOC-SERVER-006): designação no setup, proteção só do principal
// e migração que não escolhe conta antiga. PGlite em memória; sem rede e sem DATABASE_URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { createDb } from '@stylo/db/client.ts';
import { createAuth, LOCAL_EMAIL, STEP_UP_MS } from '../apps/server/src/services/auth.ts';
import { createAgents } from '../apps/server/src/services/agents.ts';
import { allTools } from '@stylo/core/tools/schema.ts';
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

test('principal designado: negativas não mutam; sem ponteiro ninguém altera OWNER', async () => {
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

    const step = await call(principalLogin.token, 'POST', '/me/reconfirm', { password: PASSWORD });
    assert.equal(step.status, 200);
    const createdOwner = await call(principalLogin.token, 'POST', '/users', { email: 'socio@synthetic.test', name: 'Sócio', password: PASSWORD, role: 'OWNER' });
    assert.equal(createdOwner.status, 201);
    assert.equal(createdOwner.json.user?.role, 'OWNER');
    assert.equal('temporaryPassword' in createdOwner.json, false);
    assert.equal(JSON.stringify(createdOwner.json).includes(PASSWORD), false);
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
    assert.equal(demotedSecond.status, 403);
    assert.match(String(demotedSecond.json.error), /autoridade principal/);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: secondId } })).role, 'OWNER');
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: principal.id } })).role, 'OWNER');
    const renamed = await call(adminLogin.token, 'PUT', '/users/' + principal.id, { name: 'Principal atualizado', role: 'OWNER' });
    assert.equal(renamed.status, 200);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: principal.id } })).name, 'Principal atualizado');

    await db.installation.update({ where: { id: 1 }, data: { principalUserId: null } });
    assert.equal(await auth.principalId(), null);
    await assert.rejects(auth.updateUser(principal.id, { role: 'MEMBER' }, { id: secondId, role: 'OWNER', email: 'socio@synthetic.test' }), /autoridade principal/);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: principal.id } })).role, 'OWNER', 'sem designação, ninguém rebaixa um OWNER');
    await db.installation.update({ where: { id: 1 }, data: { principalUserId: principal.id } });
    await assert.rejects(auth.updateUser(principal.id, { role: 'MEMBER' }, { id: admin.id, role: 'ADMIN' }), /autoridade principal/);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: principal.id } })).role, 'OWNER');
  } finally {
    await close();
  }
});

test('só o principal administra outro OWNER: reconfirmação, auditoria e senha que não volta', async () => {
  const { db, close, auth } = await memory();
  try {
    const local = await auth.localUser();
    const principal = await auth.setup({ email: 'principal@synthetic.test', name: 'Principal', password: PASSWORD });
    assert.equal(principal.principal, true);
    const admin = await auth.createUser({ email: 'admin@synthetic.test', name: 'Admin', password: PASSWORD, role: 'ADMIN' });
    await auth.changePassword(admin.id, PASSWORD, 'senha-admin-2');
    const principalLogin = await auth.login(principal.email, PASSWORD);
    const adminLogin = await auth.login(admin.email, 'senha-admin-2');
    const app = httpApp(db, auth, local);
    const call = async (token: string, method: string, path: string, body?: unknown) => {
      const response = await app.request('/api' + path, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: response.status, json: await response.json() as Record<string, unknown> };
    };
    const ownerEvents = async () => (await db.authEvent.findMany({ select: { kind: true, email: true } })).map((event) => `${event.email} ${event.kind}`);

    const early = await call(principalLogin.token, 'POST', '/users', { email: 'cedo@synthetic.test', name: 'Cedo', password: PASSWORD, role: 'OWNER' });
    assert.equal(early.status, 403);
    assert.match(String(early.json.error), /Confirme sua senha/);
    assert.equal(await db.user.count({ where: { email: 'cedo@synthetic.test' } }), 0);

    const adminGrant = await call(adminLogin.token, 'POST', '/users', { email: 'admin-owner@synthetic.test', name: 'Não', password: PASSWORD, role: 'OWNER' });
    assert.equal(adminGrant.status, 403);
    assert.match(String(adminGrant.json.error), /Só a autoridade principal/);
    assert.doesNotMatch(String(adminGrant.json.error), /Confirme sua senha/);

    const wrong = await call(principalLogin.token, 'POST', '/me/reconfirm', { password: 'senha-errada' });
    assert.equal(wrong.status, 400);
    assert.match(String(wrong.json.error), /senha atual está incorreta/);
    assert.equal(JSON.stringify(wrong.json).includes('senha-errada'), false);
    const step = await call(principalLogin.token, 'POST', '/me/reconfirm', { password: PASSWORD });
    assert.equal(step.status, 200);
    assert.match(String(step.json.until), /^\d{4}-\d{2}-\d{2}T/);
    assert.ok((await ownerEvents()).some((kind) => kind.endsWith(' step-up')));
    assert.equal(JSON.stringify(await db.authEvent.findMany()).includes(PASSWORD), false);

    const missing = await call(principalLogin.token, 'POST', '/users', { email: 'sem-senha@synthetic.test', name: 'Sem', role: 'OWNER' });
    assert.equal(missing.status, 400);
    assert.match(String(missing.json.error), /não será mostrada de volta/);
    assert.equal(await db.user.count({ where: { email: 'sem-senha@synthetic.test' } }), 0);

    const created = await call(principalLogin.token, 'POST', '/users', { email: 'socio@synthetic.test', name: 'Sócio', password: PASSWORD, role: 'OWNER' });
    assert.equal(created.status, 201);
    const second = created.json.user as { id: string; role: string; principal?: boolean };
    assert.equal(second.role, 'OWNER');
    assert.equal(second.principal, false);
    assert.equal('temporaryPassword' in created.json, false);
    assert.equal(JSON.stringify(created.json).includes(PASSWORD), false);
    assert.ok((await ownerEvents()).some((kind) => kind.includes(`owner.grant:${second.id}`)));
    const listed = await call(principalLogin.token, 'GET', '/users');
    const rows = listed.json as unknown as Array<{ id: string; principal?: boolean }>;
    assert.equal(rows.find((row) => row.id === principal.id)?.principal, true);
    assert.equal(rows.find((row) => row.id === second.id)?.principal, false);

    await auth.changePassword(second.id, PASSWORD, 'senha-socio-2');
    const secondLogin = await auth.login('socio@synthetic.test', 'senha-socio-2');
    const beforeSecond = await snapshot(db, second.id);
    const beforePrincipal = await snapshot(db, principal.id);
    for (const [token, path, body] of [
      [adminLogin.token, '/users/' + second.id + '/suspend', { suspended: true }],
      [adminLogin.token, '/users/' + second.id + '/reset-password', { password: 'senha-nova-admin' }],
      [secondLogin.token, '/users/' + principal.id + '/suspend', { suspended: true }],
      [secondLogin.token, '/users/' + principal.id + '/reset-password', { password: 'senha-nova-socio' }],
      [secondLogin.token, '/users/' + second.id + '/suspend', { suspended: true }],
    ] as const) {
      const denied = await call(token, 'POST', path, body);
      assert.equal(denied.status, 403, path);
      assert.doesNotMatch(String(denied.json.error), /Confirme sua senha/);
      assert.equal('temporaryPassword' in denied.json, false);
    }
    const adminDemote = await call(adminLogin.token, 'PUT', '/users/' + second.id, { role: 'MEMBER' });
    const secondRemove = await call(secondLogin.token, 'DELETE', '/users/' + principal.id);
    assert.equal(adminDemote.status, 403);
    assert.equal(secondRemove.status, 403);
    assert.deepEqual(await snapshot(db, second.id), beforeSecond);
    assert.deepEqual(await snapshot(db, principal.id), beforePrincipal);
    assert.equal((await ownerEvents()).some((kind) => /owner\.(suspend|demote|remove|reset):/.test(kind)), false);

    const selfReset = await call(principalLogin.token, 'POST', '/users/' + principal.id + '/reset-password', { password: 'senha-nova-principal' });
    assert.equal(selfReset.status, 403);
    assert.match(String(selfReset.json.error), /não pode ser suspensa, rebaixada, removida ou ter a senha/);
    assert.deepEqual(await snapshot(db, principal.id), beforePrincipal);

    const resetMissing = await call(principalLogin.token, 'POST', '/users/' + second.id + '/reset-password', {});
    assert.equal(resetMissing.status, 400);
    assert.deepEqual(await snapshot(db, second.id), beforeSecond);
    const nextPassword = 'senha-definida-aqui';
    const reset = await call(principalLogin.token, 'POST', '/users/' + second.id + '/reset-password', { password: nextPassword });
    assert.equal(reset.status, 200);
    assert.deepEqual(Object.keys(reset.json).sort(), ['mustChangePassword', 'ok']);
    assert.equal(reset.json.ok, true);
    assert.equal(reset.json.mustChangePassword, true);
    assert.equal(JSON.stringify(reset.json).includes(nextPassword), false);
    const resetSnapshot = await snapshot(db, second.id);
    assert.notEqual(resetSnapshot.passwordHash, beforeSecond.passwordHash);
    assert.equal(resetSnapshot.mustChangePassword, true);
    assert.equal(resetSnapshot.sessions, 0);
    assert.equal(resetSnapshot.role, 'OWNER');
    assert.equal(JSON.stringify(await db.authEvent.findMany()).includes(nextPassword), false);
    assert.ok((await ownerEvents()).some((kind) => kind.includes(`owner.reset:${second.id}`)));

    const suspended = await call(principalLogin.token, 'POST', '/users/' + second.id + '/suspend', { suspended: true });
    assert.equal(suspended.status, 200);
    assert.equal(suspended.json.suspended, true);
    assert.equal((await snapshot(db, second.id)).suspended, true);
    const restored = await call(principalLogin.token, 'POST', '/users/' + second.id + '/suspend', { suspended: false });
    assert.equal(restored.status, 200);
    assert.equal((await snapshot(db, second.id)).suspended, false);
    assert.ok((await ownerEvents()).some((kind) => kind.includes(`owner.suspend:${second.id}`)));
    assert.ok((await ownerEvents()).some((kind) => kind.includes(`owner.restore:${second.id}`)));

    await db.project.create({ data: { slug: 'loja.json', name: 'Loja', ownerId: second.id, doc: { pages: [] } } });
    const blocked = await call(principalLogin.token, 'DELETE', '/users/' + second.id);
    assert.equal(blocked.status, 409);
    assert.match(String(blocked.json.error), /Transfira os projetos/);
    assert.equal(await db.user.count({ where: { id: second.id } }), 1);
    assert.equal((await ownerEvents()).some((kind) => kind.includes(`owner.remove:${second.id}`)), false);
    await db.project.deleteMany({ where: { ownerId: second.id } });
    const removed = await call(principalLogin.token, 'DELETE', '/users/' + second.id);
    assert.equal(removed.status, 200);
    assert.equal(await db.user.count({ where: { id: second.id } }), 0);
    assert.ok((await ownerEvents()).some((kind) => kind.includes(`owner.remove:${second.id}`)));

    const member = await auth.createUser({ email: 'membro@synthetic.test', name: 'Membro', password: PASSWORD, role: 'MEMBER' });
    const memberReset = await call(adminLogin.token, 'POST', '/users/' + member.id + '/reset-password', {});
    assert.equal(memberReset.status, 200);
    assert.equal(typeof memberReset.json.temporaryPassword, 'string');
    assert.notEqual(memberReset.json.temporaryPassword, PASSWORD);

    const pending = await auth.createUser({ email: 'pendente@synthetic.test', name: 'Pendente', password: PASSWORD, role: 'MEMBER' });
    const pendingLogin = await auth.login(pending.email, PASSWORD);
    const pendingStep = await call(pendingLogin.token, 'POST', '/me/reconfirm', { password: PASSWORD });
    assert.equal(pendingStep.status, 403);
    assert.match(String(pendingStep.json.error), /senha temporária/);

    const agent = await createAgents(db).create(principal.id, { name: 'Agente' });
    for (const [method, path] of [['POST', '/users'], ['POST', '/users/' + member.id + '/suspend'], ['POST', '/users/' + member.id + '/reset-password'], ['DELETE', '/users/' + member.id]] as const) {
      const denied = await call(agent.token, method, path, { email: 'agente@synthetic.test', name: 'Agente', password: PASSWORD, role: 'ADMIN', suspended: true });
      assert.equal(denied.status, 401, method + ' ' + path);
    }
    assert.equal(await db.user.count({ where: { email: 'agente@synthetic.test' } }), 0);
    const toolNames = allTools().map((tool) => tool.name);
    for (const name of ['create_user', 'update_user', 'delete_user', 'suspend_user', 'reset_password', 'grant_owner']) assert.equal(toolNames.includes(name), false, name);
  } finally {
    await close();
  }
});

test('a janela de reconfirmação expira e a senha errada entra no limite', async () => {
  let now = Date.parse('2026-10-14T08:00:00Z');
  const { db, close } = await createDb({ pglite: {} });
  const auth = createAuth(db, { now: () => now });
  try {
    const principal = await auth.setup({ email: 'principal@synthetic.test', name: 'Principal', password: PASSWORD });
    await auth.reconfirm(principal.id, PASSWORD);
    await auth.createUser({ email: 'socio@synthetic.test', name: 'Sócio', password: PASSWORD, role: 'OWNER' }, false, principal);
    now += STEP_UP_MS;
    await assert.rejects(auth.createUser({ email: 'outro@synthetic.test', name: 'Outro', password: PASSWORD, role: 'OWNER' }, false, principal), /Confirme sua senha/);
    assert.equal(await db.user.count({ where: { email: 'outro@synthetic.test' } }), 0);
    now += 1;
    await auth.reconfirm(principal.id, PASSWORD);
    const again = await auth.createUser({ email: 'outro@synthetic.test', name: 'Outro', password: PASSWORD, role: 'OWNER' }, false, principal);
    assert.equal(again.role, 'OWNER');

    for (let attempt = 0; attempt < 8; attempt++) await assert.rejects(auth.reconfirm(principal.id, 'senha-errada'), /senha atual está incorreta/);
    await assert.rejects(auth.reconfirm(principal.id, PASSWORD), /Muitas tentativas/);
  } finally {
    await close();
  }
});
