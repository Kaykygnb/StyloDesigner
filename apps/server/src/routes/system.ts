/**
 * routes/system.ts — STATUS, CONFIGURAÇÃO, PERFIL LOCAL, PRESENÇA E AVISOS AO VIVO
 *   GET  /api/status              { ok, keepVersions }
 *   GET  /api/health              diagnóstico seguro do servidor e do banco
 *   PUT  /api/config              { keepVersions? } (só administradores)
 *   GET|PUT /api/account          perfil da conta local (modo local; assina comentários e aparece na presença)
 *   GET  /api/presence            quem está no servidor (pessoas e agentes)
 *   GET  /api/agent/events        Server-Sent Events para o editor (presence e project)
 *   GET|PUT /api/agent/config     endereço do MCP, chave do Pexels (as chaves NUNCA são devolvidas; PUT só administradores)
 */

import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';
import { join } from 'node:path';
import { Hono } from 'hono';
import { writeJsonAtomic } from '../atomic.js';
import { mergeAccount, normalizeAccount } from '../account.js';
import { httpError } from '../http-error.js';
import type { Services } from '../context.js';
import type { Identity } from '../http/identity.js';
import { readObject } from '../http/guards.js';

export function systemRoutes(s: Services, identity: Identity) {
  const r = new Hono();

  const publicConfig = () => ({ keepVersions: s.config.get().keepVersions, folder: 'banco de dados do servidor' });
  r.get('/status', (c) => c.json({ ok: true, ...publicConfig() }));
  r.get('/health', async (c) => {
    const checkedAt = new Date().toISOString();
    try {
      const [database, migrations, users, projects] = await Promise.all([
        s.db.$queryRawUnsafe<Array<{ ok: number }>>('SELECT 1 AS ok'),
        s.db.$queryRawUnsafe<Array<{ name: string }>>('SELECT name FROM "_stylo_migrations" ORDER BY name'),
        s.db.user.count(),
        s.db.project.count(),
      ]);
      return c.json({ ok: true, checkedAt, database: { ok: database[0]?.ok === 1, engine: process.env.DATABASE_URL ? 'postgresql' : 'pglite', migrations: migrations.map((m) => m.name) }, counts: { users, projects }, transport: { port: s.port, editors: s.events.count(), mcp: true } });
    } catch (err) {
      return c.json({ ok: false, checkedAt, database: { ok: false, engine: process.env.DATABASE_URL ? 'postgresql' : 'pglite', error: err instanceof Error ? err.message : 'falha desconhecida' }, transport: { port: s.port, editors: s.events.count(), mcp: false } }, 503);
    }
  });
  r.get('/network', async (c) => {
    await identity.userOf(c);
    const bound = process.env.STYLO_HOST === '127.0.0.1' || process.env.STYLO_HOST === 'localhost' ? '127.0.0.1' : '0.0.0.0';
    const addresses = bound === '127.0.0.1' ? [] : Object.entries(networkInterfaces()).flatMap(([name, entries]) => (entries || []).filter((entry) => !entry.internal && (entry.family === 'IPv4' || (entry.family as unknown) === 4)).map((entry) => ({ name, address: entry.address, url: `http://${entry.address}:${s.port}`, mcpUrl: `http://${entry.address}:${s.port}/mcp` })));
    return c.json({ bound, port: s.port, localUrl: `http://localhost:${s.port}`, mcpLocalUrl: `http://localhost:${s.port}/mcp`, addresses, remoteAccess: bound !== '127.0.0.1' });
  });
  r.get('/network/qr', async (c) => {
    await identity.userOf(c);
    const value = String(c.req.query('value') || `http://localhost:${s.port}`).trim();
    if (!/^https?:\/\//i.test(value) || value.length > 2048) throw httpError(400, 'URL inválida para QR Code.');
    const svg = await QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    return c.body(Buffer.from(svg), 200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' });
  });
  r.get('/admin/activity', async (c) => {
    await identity.adminOf(c);
    const project = c.req.query('project')?.trim();
    const userId = c.req.query('user')?.trim();
    const agentId = c.req.query('agent')?.trim();
    const tool = c.req.query('tool')?.trim();
    const rows = await s.db.operation.findMany({
      where: { ...(project ? { project: { OR: [{ id: project }, { slug: project }] } } : {}), ...(userId ? { userId } : {}), ...(agentId ? { agentId } : {}), ...(tool ? { tool } : {}) },
      orderBy: { id: 'desc' }, take: Math.min(Math.max(Number(c.req.query('limit')) || 100, 1), 500),
      include: { project: { select: { id: true, slug: true, name: true } }, user: { select: { id: true, name: true, email: true } }, agent: { select: { id: true, name: true } } },
    });
    return c.json(rows.map((row) => ({ id: String(row.id), at: row.createdAt, project: row.project, user: row.user, agent: row.agent, actorType: row.actorType, tool: row.tool, summary: row.summary, ok: row.ok, layerIds: row.layerIds })));
  });

  r.get('/backups', async (c) => {
    await identity.adminOf(c);
    return c.json(await s.backups.list());
  });
  r.post('/backups', async (c) => {
    await identity.adminOf(c);
    return c.json(await s.backups.create());
  });
  r.post('/backups/:id/restore', async (c) => {
    await identity.adminOf(c);
    return c.json(await s.backups.restore(c.req.param('id')));
  });

  r.put('/config', async (c) => {
    await identity.adminOf(c);
    const body = await readObject(c);
    const next = { ...s.config.get() };
    if (body.keepVersions !== undefined) next.keepVersions = Math.max(0, Math.min(200, Math.round(Number(body.keepVersions) || 0)));
    await s.config.set(next);
    return c.json({ ok: true, ...publicConfig() });
  });

  // PERFIL LOCAL: GET devolve; PUT mescla os campos enviados (validados em account.js)
  const loadAccount = async () => {
    try { return normalizeAccount(JSON.parse(await readFile(s.accountFile, 'utf8'))); } catch { return normalizeAccount(null); }
  };
  r.get('/account', async (c) => c.json(await loadAccount()));
  r.put('/account', async (c) => {
    const body = await readObject(c);
    let next;
    try { next = mergeAccount(await loadAccount(), body); } catch (err: any) { throw httpError(400, err.message); }
    await writeJsonAtomic(s.accountFile, next);
    return c.json(next);
  });

  r.get('/presence', (c) => c.json(s.presence.snapshot()));
  r.get('/connections', async (c) => { await identity.adminOf(c); return c.json(s.events.list()); });
  r.delete('/connections/:id', async (c) => { await identity.adminOf(c); if (!s.events.close(c.req.param('id'))) throw httpError(404, 'Conexão não encontrada.'); return c.json({ ok: true }); });
  r.get('/agent/events', (c) => s.events.handler(c));

  const pexelsKey = () => {
    const cfg = s.config.get();
    return { has: !!(cfg.pexels?.apiKey || process.env.PEXELS_API_KEY), source: cfg.pexels?.apiKey ? 'config' : process.env.PEXELS_API_KEY ? 'env' : '' };
  };
  r.get('/agent/config', (c) => c.json({
    editors: s.events.count(),
    mcpUrl: `http://localhost:${s.port}/mcp`,
    mcpScript: join(s.root, 'apps', 'server', 'bin', 'mcp.mjs'),
    instructions: join(s.here, 'instrucoes-agente.txt'),
    pexels: pexelsKey().has,
    pexelsSource: pexelsKey().source,
    agentPolicy: s.config.get().mcp?.agentPolicy || 'closed',
  }));
  r.put('/agent/config', async (c) => {
    await identity.adminOf(c);
    const body = await readObject(c);
    const pexels = { ...(s.config.get().pexels || {}) } as { apiKey?: string };
    if (body.pexelsKey !== undefined) {
      const k = String(body.pexelsKey).trim();
      if (k) pexels.apiKey = k.slice(0, 400); else delete pexels.apiKey;
    }
    const next = { ...s.config.get() };
    if (body.agentPolicy === 'open' || body.agentPolicy === 'approval' || body.agentPolicy === 'closed') {
      next.mcp = { ...(next.mcp || {}), agentPolicy: body.agentPolicy };
    }
    if (Object.keys(pexels).length) next.pexels = pexels; else delete next.pexels;
    await s.config.set(next);
    return c.json({ ok: true, pexels: pexelsKey().has });
  });

  return r;
}
