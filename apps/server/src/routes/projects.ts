/**
 * routes/projects.ts — PROJETOS (o editor e quem baixa o resultado usam estas rotas)
 *   GET  /api/projects                              lista os projetos que a pessoa vê
 *   GET  /api/projects/<arquivo>                    o projeto (cabeçalhos X-Modified e X-Content-Hash = "r<revisão>")
 *   PUT  /api/projects/<arquivo>                    grava; envie X-Base-Hash com a revisão que você leu: se o projeto
 *        já avançou (outra aba, agente), 409 em vez de apagar o trabalho alheio. X-Overwrite: 1 grava mesmo assim.
 *   GET  /api/projects/<arquivo>/site.zip           o site inteiro em .zip (HTML estruturado)
 *   GET|PUT /api/projects/<arquivo>/thumb           miniatura SVG
 *   POST /api/projects/<arquivo>/rename   { to }
 *   GET  /api/projects/<arquivo>/versions[/<id>]    histórico guardado
 *   GET  /api/projects/<arquivo>/activity           o que foi feito, por quem (log de operações)
 */

import { Hono } from 'hono';
import { exportSite } from '@stylo/core/site-export.js';
import { createZip } from '@stylo/core/zip.js';
import { httpError } from '../http-error.js';
import type { Services } from '../context.js';
import type { Identity } from '../http/identity.js';
import { checkName } from '../services/projects.js';
import { readObject } from '../http/guards.js';

export function projectRoutes(s: Services, id: Identity) {
  const r = new Hono();

  r.get('/projects', async (c) => c.json(await s.projects.list(await id.userOf(c))));

  r.get('/projects/:file', async (c) => {
    const { doc, modified, contentHash } = await s.projects.load(await id.userOf(c), checkName(c.req.param('file')));
    c.header('Cache-Control', 'no-store');
    c.header('X-Modified', String(modified));
    c.header('X-Content-Hash', contentHash);
    return c.body(JSON.stringify(doc), 200, { 'Content-Type': 'application/json; charset=utf-8' });
  });

  r.put('/projects/:file', async (c) => {
    const user = await id.userOf(c);
    const name = checkName(c.req.param('file'));
    const text = await c.req.text();
    let doc: any;
    try { doc = JSON.parse(text); } catch { throw httpError(400, 'O conteúdo não é JSON válido.'); }
    if (!Array.isArray(doc?.pages)) throw httpError(400, 'Isso não parece um projeto (faltam as páginas).');
    try {
      const saved = await s.projects.write(user, name, doc, {
        base: { hash: c.req.header('x-base-hash') || '' },
        overwrite: c.req.header('x-overwrite') === '1',
        by: c.req.header('x-editor-id') || '',
        size: text.length,
      });
      return c.json({ ok: true, ...saved });
    } catch (err: any) {
      if (err.status === 409) return c.json({ error: err.message, ...err.body }, 409);
      throw err;
    }
  });

  r.get('/projects/:file/site.zip', async (c) => {
    const name = checkName(c.req.param('file'));
    const { doc } = await s.projects.load(await id.userOf(c), name);
    const site = exportSite(doc);
    const zip = Buffer.from(createZip(site.files.map(({ path, content }: { path: string; content: string }) => ({ path, content }))));
    return c.body(zip, 200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${name.replace(/\.json$/i, '')}-site.zip"`,
      'Cache-Control': 'no-store',
    });
  });

  r.get('/projects/:file/thumb', async (c) => {
    const svg = await s.projects.readThumb(await id.userOf(c), checkName(c.req.param('file')));
    // SVG pode conter <script>: a política de segurança abaixo impede que rode, mesmo se alguém abrir a URL direto
    return c.body(svg, 200, {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache',
      'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
    });
  });
  r.put('/projects/:file/thumb', async (c) => {
    const { svg } = await readObject(c);
    await s.projects.writeThumb(await id.userOf(c), checkName(c.req.param('file')), svg);
    return c.json({ ok: true });
  });

  r.post('/projects/:file/rename', async (c) => {
    const { to } = await readObject(c);
    return c.json({ ok: true, ...(await s.projects.rename(await id.userOf(c), checkName(c.req.param('file')), to)) });
  });

  r.get('/projects/:file/versions', async (c) => c.json(await s.projects.versions(await id.userOf(c), checkName(c.req.param('file')))));
  r.get('/projects/:file/versions/:version', async (c) => c.json(await s.projects.readVersion(await id.userOf(c), checkName(c.req.param('file')), c.req.param('version'))));

  r.get('/projects/:file/activity', async (c) => {
    const { id: projectId } = await s.projects.load(await id.userOf(c), checkName(c.req.param('file')));
    return c.json(await s.operations.list(projectId, { limit: Number(c.req.query('limit')) || 50 }));
  });

  return r;
}
