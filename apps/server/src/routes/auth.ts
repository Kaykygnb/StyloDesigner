/**
 * routes/auth.ts — CONTAS, LOGIN E AGENTES
 *   GET  /api/auth/state          { mode, hasAccounts, user }
 *   POST /api/auth/setup          cria a conta mestre (só enquanto não existe nenhuma) e já entra
 *   POST /api/auth/login | logout
 *   GET  /api/me                  quem sou eu
 *   GET|POST /api/users           (conta mestre) lista / cria contas
 *   GET|POST /api/agents          (conta mestre) lista / cadastra agente — o token aparece UMA vez
 *   POST /api/agents/:id/approve|revoke
 * No modo local (sem login) só `state` e `me` existem; o resto responde 404 explicando como ligar as contas.
 */

import { Hono } from 'hono';
import { httpError } from '../http-error.js';
import type { Services } from '../context.js';
import type { Identity } from '../http/identity.js';
import { sessionCookie, sessionTokenOf } from '../http/identity.js';
import { readObject } from '../http/guards.js';
import { newToken } from '../services/auth.js';

const MONTH = 30 * 86400;

export function authRoutes(s: Services, id: Identity) {
  const r = new Hono();

  r.get('/auth/state', async (c) => {
    const user = s.authMode === 'local' ? s.localUser : await s.auth.userFromToken(sessionTokenOf(c));
    return c.json({ mode: s.authMode, hasAccounts: s.authMode === 'local' ? true : await s.auth.hasAccounts(), user });
  });
  r.get('/me', async (c) => c.json(await id.userOf(c)));
  r.get('/me/export', async (c) => {
    const me = await id.userOf(c);
    const [projects, agents, events] = await Promise.all([
      s.db.project.findMany({ where: { OR: [{ ownerId: me.id }, { members: { some: { userId: me.id } } }] }, orderBy: { updatedAt: 'desc' }, select: { id: true, slug: true, name: true, size: true, updatedAt: true } }),
      s.db.agent.findMany({ where: { ownerId: me.id }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, scopes: true, status: true, createdAt: true, lastSeenAt: true } }),
      s.auth.authEvents(me.id, 200),
    ]);
    return c.json({ exportedAt: new Date().toISOString(), account: me, projects, agents, authEvents: events });
  });
  r.put('/me', async (c) => {
    const me = await id.userOf(c);
    const b = await readObject(c);
    return c.json(await s.auth.updateUser(me.id, { name: b.name === undefined ? undefined : String(b.name), email: b.email === undefined ? undefined : String(b.email), color: b.color === undefined ? undefined : String(b.color), avatar: b.avatar === undefined ? undefined : b.avatar === null ? null : String(b.avatar), preferences: b.preferences && typeof b.preferences === 'object' ? b.preferences : undefined }));
  });
  r.get('/me/sessions', async (c) => c.json(await s.auth.sessions((await id.userOf(c)).id, sessionTokenOf(c))));
  r.get('/sessions', async (c) => { await id.adminOf(c); return c.json(await s.auth.allSessions()); });
  r.delete('/sessions/:id', async (c) => { await id.adminOf(c); return c.json(await s.auth.revokeAnySession(c.req.param('id'))); });
  r.get('/me/auth-events', async (c) => c.json(await s.auth.authEvents((await id.userOf(c)).id, Number(c.req.query('limit')) || 50)));
  r.delete('/me/sessions/:id', async (c) => c.json(await s.auth.revokeSession((await id.userOf(c)).id, c.req.param('id'))));
  r.post('/me/sessions/revoke-all', async (c) => c.json(await s.auth.revokeAllSessions((await id.userOf(c)).id)));
  r.post('/me/password', async (c) => { const me = await id.passwordUserOf(c); const b = await readObject(c); return c.json(await s.auth.changePassword(me.id, String(b.current || ''), String(b.next || ''))); });

  const accountsOnly = (name: string) => { if (s.authMode === 'local') throw httpError(404, `Este servidor está no modo local (sem login). Ligue STYLO_AUTH=accounts para usar ${name}.`); };

  r.post('/auth/setup', async (c) => {
    accountsOnly('contas');
    const b = await readObject(c);
    await s.auth.setup({ email: String(b.email || ''), name: String(b.name || ''), password: String(b.password || '') });
    const { token, user } = await s.auth.login(String(b.email), String(b.password));
    c.header('Set-Cookie', sessionCookie(token, MONTH));
    return c.json({ user, token }, 201);
  });
  r.post('/auth/login', async (c) => {
    accountsOnly('contas');
    const b = await readObject(c);
    const { token, user } = await s.auth.login(String(b.email || ''), String(b.password || ''));
    c.header('Set-Cookie', sessionCookie(token, MONTH));
    return c.json({ user, token });
  });
  r.post('/auth/logout', async (c) => {
    accountsOnly('contas');
    await s.auth.logout(sessionTokenOf(c));
    c.header('Set-Cookie', sessionCookie('', 0));
    return c.json({ ok: true });
  });

  r.get('/users', async (c) => { await id.adminOf(c); return c.json(await s.auth.users()); });
  r.post('/users', async (c) => {
    const actor = await id.adminOf(c);
    const b = await readObject(c);
    const password = String(b.password || '') || newToken('stylo_pwd').slice(-16);
    const role = ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER', 'MEMBER'].includes(String(b.role)) ? String(b.role) as any : undefined;
    const user = await s.auth.createUser({ email: String(b.email || ''), name: String(b.name || ''), password, role }, false, actor);
    if (b.avatar !== undefined || b.color !== undefined) {
      return c.json({ user: await s.auth.updateUser(user.id, { avatar: b.avatar === null ? null : b.avatar === undefined ? undefined : String(b.avatar), color: b.color === undefined ? undefined : String(b.color) }), temporaryPassword: String(b.password || '') ? undefined : password }, 201);
    }
    return c.json({ user, temporaryPassword: String(b.password || '') ? undefined : password }, 201);
  });
  r.put('/users/:id', async (c) => {
    const actor = await id.adminOf(c);
    const b = await readObject(c);
    const role = ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER', 'MEMBER'].includes(String(b.role)) ? String(b.role) as any : undefined;
    return c.json(await s.auth.updateUser(c.req.param('id'), { name: b.name === undefined ? undefined : String(b.name), email: b.email === undefined ? undefined : String(b.email), color: b.color === undefined ? undefined : String(b.color), avatar: b.avatar === undefined ? undefined : b.avatar === null ? null : String(b.avatar), role }, actor));
  });
  r.post('/users/:id/reset-password', async (c) => { await id.adminOf(c); return c.json(await s.auth.resetPassword(c.req.param('id'))); });
  r.post('/users/:id/revoke-sessions', async (c) => { await id.adminOf(c); return c.json(await s.auth.revokeAllSessions(c.req.param('id'))); });
  r.post('/users/:id/suspend', async (c) => { await id.adminOf(c); const b = await readObject(c); return c.json(await s.auth.setSuspended(c.req.param('id'), b.suspended !== false)); });
  r.delete('/users/:id', async (c) => { await id.adminOf(c); return c.json(await s.auth.deleteUser(c.req.param('id'))); });
  r.get('/users/:id/projects', async (c) => {
    await id.adminOf(c);
    const target = (await s.auth.users()).find((u) => u.id === c.req.param('id'));
    if (!target) throw httpError(404, 'Conta não encontrada.');
    const rows = await s.db.project.findMany({ where: { OR: [{ ownerId: target.id }, { members: { some: { userId: target.id } } }] }, orderBy: { updatedAt: 'desc' }, include: { members: { where: { userId: target.id }, select: { role: true } } } });
    return c.json(rows.map((p) => ({ id: p.id, file: p.slug, name: p.name, modified: p.updatedAt, size: p.size, role: p.ownerId === target.id ? 'OWNER' : p.members[0]?.role || 'VIEWER' })));
  });
  r.delete('/users/:id/projects/:projectId', async (c) => {
    const admin = await id.adminOf(c);
    const target = (await s.auth.users()).find((u) => u.id === c.req.param('id'));
    if (!target) throw httpError(404, 'Conta não encontrada.');
    const project = await s.db.project.findUnique({ where: { id: c.req.param('projectId') }, select: { ownerId: true } });
    if (!project) throw httpError(404, 'Projeto não encontrado.');
    if (project.ownerId === target.id) throw httpError(400, 'O dono não pode ser removido do próprio projeto.');
    await s.db.projectMember.deleteMany({ where: { projectId: c.req.param('projectId'), userId: target.id } });
    return c.json({ ok: true, revokedBy: admin.id });
  });

  r.get('/agents', async (c) => {
    const owner = await id.adminOf(c);
    const rows = await s.agents.list(owner.id);
    return c.json(await Promise.all(rows.map(async (agent) => {
      const latestOperation = await s.db.operation.findFirst({ where: { agentId: agent.id }, orderBy: { id: 'desc' }, include: { project: { select: { id: true, slug: true, name: true, updatedAt: true } } } });
      const latestGrant = latestOperation ? null : await s.db.agentProject.findFirst({ where: { agentId: agent.id }, orderBy: { createdAt: 'desc' }, include: { project: { select: { id: true, slug: true, name: true, updatedAt: true } } } });
      return { ...agent, ownerId: owner.id, ownerName: owner.name, lastProject: latestOperation?.project || latestGrant?.project || null };
    })));
  });
  r.post('/agents', async (c) => {
    const owner = await id.adminOf(c);
    const b = await readObject(c);
    return c.json(await s.agents.create(owner.id, { name: String(b.name || ''), type: b.type === undefined ? undefined : String(b.type), scopes: Array.isArray(b.scopes) ? b.scopes.map(String) : undefined }), 201);
  });
  r.post('/agents/:id/approve', async (c) => { await id.adminOf(c); return c.json(await s.agents.approve(c.req.param('id'))); });
  r.post('/agents/:id/revoke', async (c) => { await id.adminOf(c); return c.json(await s.agents.revoke(c.req.param('id'))); });
  r.post('/agents/:id/rotate', async (c) => { await id.adminOf(c); return c.json(await s.agents.rotate(c.req.param('id'))); });
  r.put('/agents/:id', async (c) => {
    await id.adminOf(c);
    const b = await c.req.json().catch(() => ({}));
    return c.json(await s.agents.setScopes(c.req.param('id'), Array.isArray(b.scopes) ? b.scopes.map(String) : []));
  });
  r.get('/agents/:id/projects', async (c) => {
    const owner = await id.adminOf(c);
    const own = (await s.agents.list(owner.id)).some((a) => a.id === c.req.param('id'));
    if (!own) throw httpError(404, 'Agente não encontrado.');
    return c.json(await s.db.agentProject.findMany({ where: { agentId: c.req.param('id') }, orderBy: { createdAt: 'asc' }, include: { project: { select: { id: true, slug: true, name: true, updatedAt: true } } } }));
  });
  r.get('/agents/:id/activity', async (c) => {
    const owner = await id.adminOf(c);
    const own = (await s.agents.list(owner.id)).some((a) => a.id === c.req.param('id'));
    if (!own) throw httpError(404, 'Agente não encontrado.');
    const rows = await s.db.operation.findMany({ where: { agentId: c.req.param('id') }, orderBy: { id: 'desc' }, take: Math.min(Math.max(Number(c.req.query('limit')) || 50, 1), 200), include: { project: { select: { slug: true, name: true } } } });
    return c.json(rows.map((r) => ({ id: String(r.id), at: r.createdAt, project: r.project.name || r.project.slug, tool: r.tool, summary: r.summary, ok: r.ok, layerIds: r.layerIds })));
  });
  r.post('/agents/:id/projects', async (c) => {
    const owner = await id.adminOf(c);
    const own = (await s.agents.list(owner.id)).some((a) => a.id === c.req.param('id'));
    if (!own) throw httpError(404, 'Agente não encontrado.');
    const b = await readObject(c);
    const project = await s.projects.load(owner, String(b.file || ''));
    return c.json(await s.agents.grantProject(c.req.param('id'), project.id));
  });
  r.delete('/agents/:id/projects/:projectId', async (c) => {
    const owner = await id.adminOf(c);
    const own = (await s.agents.list(owner.id)).some((a) => a.id === c.req.param('id'));
    if (!own) throw httpError(404, 'Agente não encontrado.');
    return c.json(await s.agents.revokeProject(c.req.param('id'), c.req.param('projectId')));
  });

  return r;
}
