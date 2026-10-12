/**
 * routes/library.ts — BIBLIOTECA DA CONTA E CHAVES DOS PROVEDORES (para a interface; o agente usa as ferramentas MCP)
 *   GET    /api/library                lista (?kind=&q=&tag=)
 *   POST   /api/library                envia um arquivo (corpo = os bytes; cabeçalhos X-Name, X-Tags, X-License, X-Credit)
 *   GET    /api/library/:id/file       os bytes do asset (com o tipo certo)
 *   DELETE /api/library/:id            remove
 *   GET    /api/providers              provedores de assets e se têm chave (a chave NUNCA volta)
 *   PUT    /api/providers/:id/key      { key } guarda a chave desta conta (criptografada)
 *   DELETE /api/providers/:id/key      apaga
 */

import { Hono } from 'hono';
import { kindFromTool } from '@stylo/core/asset-kinds.ts';
import { BUILTIN_PROVIDERS, providerStatuses } from '@stylo/plugins/assets/registry.ts';
import { httpError } from '../http-error.js';
import type { Services } from '../context.js';
import type { Identity } from '../http/identity.js';
import { limit, readObject } from '../http/guards.js';
import type { AssetServices } from '@stylo/plugins/assets/types.ts';

export const MAX_UPLOAD = 220 * 1024 * 1024;

export function libraryRoutes(s: Services, id: Identity, assetServices: AssetServices) {
  const r = new Hono();

  r.get('/library', async (c) => {
    const user = await id.userOf(c);
    const kindParam = c.req.query('kind');
    const kind = kindParam ? kindFromTool(kindParam) : undefined;
    if (kindParam && !kind) throw httpError(400, 'Tipo inválido.');
    const list = await s.library.list(user.id, { kind: kind ?? undefined, query: c.req.query('q'), tag: c.req.query('tag') });
    return c.json({ assets: list, usage: await s.library.usage(user.id) });
  });
  r.get('/library/usage-detail', async (c) => {
    const user = await id.userOf(c);
    const assets = await s.library.list(user.id);
    const projects = await s.db.project.findMany({ where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] }, select: { id: true, slug: true, name: true, doc: true } });
    const result = assets.map((asset) => {
      const usedProjects: Array<{ id: string; file: string; name: string }> = [];
      for (const project of projects) {
        let used = false;
        const walk = (value: unknown) => {
          if (used) return;
          if (typeof value === 'string') { used = value === asset.id; return; }
          if (Array.isArray(value)) { for (const item of value) walk(item); return; }
          if (value && typeof value === 'object') for (const item of Object.values(value)) walk(item);
        };
        walk(project.doc);
        if (used) usedProjects.push({ id: project.id, file: project.slug, name: project.name || project.slug });
      }
      return { assetId: asset.id, useCount: usedProjects.length, projectIds: usedProjects.map((project) => project.id), projects: usedProjects, orphan: usedProjects.length === 0 };
    });
    return c.json({ assets: result });
  });

  r.post('/library', limit(MAX_UPLOAD), async (c) => {
    const user = await id.userOf(c);
    const name = decodeURIComponent(c.req.header('x-name') || '').trim();
    if (!name) throw httpError(400, 'Envie o nome no cabeçalho X-Name.');
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (!bytes.length) throw httpError(400, 'Arquivo vazio.');
    const license = decodeURIComponent(c.req.header('x-license') || '').trim();
    const credit = decodeURIComponent(c.req.header('x-credit') || '').trim();
    const tags = decodeURIComponent(c.req.header('x-tags') || '').split(',').map((t) => t.trim()).filter(Boolean);
    const out = await s.library.add(user.id, {
      bytes, name, mimeHint: (c.req.header('content-type') || '').split(';')[0], tags, source: 'upload', credit: credit || null,
      license: { name: license || 'Enviado pela conta', commercial: true, attribution: credit ? 'required' : 'none' },
    });
    return c.json(out, out.existed ? 200 : 201);
  });

  r.get('/library/:id/file', async (c) => {
    const { asset, data } = await s.library.bytes((await id.userOf(c)).id, c.req.param('id'));
    return c.body(Buffer.from(data), 200, {
      'Content-Type': asset.mime,
      'Content-Disposition': `inline; filename="${asset.name.replace(/[^\w.-]+/g, '_').slice(0, 80)}"`,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
    });
  });

  r.delete('/library', async (c) => {
    const body = await readObject(c);
    if (!Array.isArray(body.ids)) throw httpError(400, 'ids precisa ser uma lista.');
    if (body.ids.length > 100) throw httpError(400, 'Remova no máximo 100 assets por vez.');
    return c.json(await s.library.removeMany((await id.userOf(c)).id, body.ids));
  });
  r.delete('/library/:id', async (c) => c.json(await s.library.remove((await id.userOf(c)).id, c.req.param('id'))));
  r.put('/library/:id', async (c) => {
    const body = await readObject(c);
    const changes: any = {};
    if (body.name !== undefined) changes.name = String(body.name);
    if (body.credit !== undefined) changes.credit = body.credit == null ? null : String(body.credit);
    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags)) throw httpError(400, 'tags precisa ser uma lista.');
      changes.tags = body.tags.map(String);
    }
    if (body.license !== undefined) {
      if (body.license !== null && (typeof body.license !== 'object' || typeof body.license.name !== 'string' || typeof body.license.commercial !== 'boolean')) throw httpError(400, 'license precisa conter name e commercial.');
      changes.license = body.license;
    }
    return c.json(await s.library.update((await id.userOf(c)).id, c.req.param('id'), changes));
  });
  r.post('/library/:id/replace', limit(MAX_UPLOAD), async (c) => {
    const name = decodeURIComponent(c.req.header('x-name') || '').trim();
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (!bytes.length) throw httpError(400, 'Arquivo vazio.');
    return c.json(await s.library.replace((await id.userOf(c)).id, c.req.param('id'), { bytes, name, mimeHint: (c.req.header('content-type') || '').split(';')[0] }));
  });

  r.get('/providers', async (c) => c.json({ providers: await providerStatuses((await id.userOf(c)).id, assetServices) }));

  r.put('/providers/:id/key', async (c) => {
    const user = await id.userOf(c);
    const provider = BUILTIN_PROVIDERS.find((p) => p.id === c.req.param('id'));
    if (!provider?.needsKey) throw httpError(404, 'Este provedor não usa chave.');
    const { key } = await readObject(c);
    if (typeof key !== 'string' || key.trim().length < 8) throw httpError(400, 'Envie a chave em { "key": "..." }.');
    await s.secrets.set(user.id, provider.id, key);
    return c.json({ ok: true, provider: provider.id, hasKey: true });
  });
  r.delete('/providers/:id/key', async (c) => {
    await s.secrets.remove((await id.userOf(c)).id, c.req.param('id'));
    return c.json({ ok: true });
  });

  return r;
}
