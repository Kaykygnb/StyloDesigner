/**
 * routes/system.ts — STATUS, CONFIGURAÇÃO, PERFIL LOCAL, PRESENÇA E AVISOS AO VIVO
 *   GET  /api/status              { ok, keepVersions }
 *   PUT  /api/config              { keepVersions? }
 *   GET|PUT /api/account          perfil da conta local (modo local; assina comentários e aparece na presença)
 *   GET  /api/presence            quem está no servidor (pessoas e agentes)
 *   GET  /api/agent/events        Server-Sent Events para o editor (presence e project)
 *   GET|PUT /api/agent/config     endereço do MCP, chave do Pexels (as chaves NUNCA são devolvidas)
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Hono } from 'hono';
import { writeJsonAtomic } from '../atomic.js';
import { mergeAccount, normalizeAccount } from '../account.js';
import { httpError } from '../http-error.js';
import type { Services } from '../context.js';
import { readObject } from '../http/guards.js';

export function systemRoutes(s: Services) {
  const r = new Hono();

  const publicConfig = () => ({ keepVersions: s.config.get().keepVersions, folder: 'banco de dados do servidor' });
  r.get('/status', (c) => c.json({ ok: true, ...publicConfig() }));

  r.put('/config', async (c) => {
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
  }));
  r.put('/agent/config', async (c) => {
    const body = await readObject(c);
    const pexels = { ...(s.config.get().pexels || {}) } as { apiKey?: string };
    if (body.pexelsKey !== undefined) {
      const k = String(body.pexelsKey).trim();
      if (k) pexels.apiKey = k.slice(0, 400); else delete pexels.apiKey;
    }
    const next = { ...s.config.get() };
    if (Object.keys(pexels).length) next.pexels = pexels; else delete next.pexels;
    await s.config.set(next);
    return c.json({ ok: true, pexels: pexelsKey().has });
  });

  return r;
}
