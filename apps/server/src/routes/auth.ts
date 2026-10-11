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

const MONTH = 30 * 86400;

export function authRoutes(s: Services, id: Identity) {
  const r = new Hono();

  r.get('/auth/state', async (c) => {
    const user = s.authMode === 'local' ? s.localUser : await s.auth.userFromToken(sessionTokenOf(c));
    return c.json({ mode: s.authMode, hasAccounts: s.authMode === 'local' ? true : await s.auth.hasAccounts(), user });
  });
  r.get('/me', async (c) => c.json(await id.userOf(c)));

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

  r.get('/users', async (c) => { await id.ownerOf(c); return c.json(await s.auth.users()); });
  r.post('/users', async (c) => {
    await id.ownerOf(c);
    const b = await readObject(c);
    return c.json(await s.auth.createUser({ email: String(b.email || ''), name: String(b.name || ''), password: String(b.password || '') }), 201);
  });

  r.get('/agents', async (c) => { await id.ownerOf(c); return c.json(await s.agents.list()); });
  r.post('/agents', async (c) => {
    const owner = await id.ownerOf(c);
    const b = await readObject(c);
    return c.json(await s.agents.create(owner.id, { name: String(b.name || ''), scopes: Array.isArray(b.scopes) ? b.scopes.map(String) : undefined }), 201);
  });
  r.post('/agents/:id/approve', async (c) => { await id.ownerOf(c); return c.json(await s.agents.approve(c.req.param('id'))); });
  r.post('/agents/:id/revoke', async (c) => { await id.ownerOf(c); return c.json(await s.agents.revoke(c.req.param('id'))); });

  return r;
}
