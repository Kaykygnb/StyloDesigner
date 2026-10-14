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
import { exportReact } from '@stylo/core/export-react.ts';
import { auditReport, auditStatic } from '@stylo/core/audit.ts';
import { vendorFiles } from '../services/vendor.ts';
import { createZip } from '@stylo/core/zip.js';
import { httpError } from '../http-error.js';
import type { Services } from '../context.js';
import type { Identity } from '../http/identity.js';
import { checkName, fileNameFor } from '../services/projects.js';
import { readObject } from '../http/guards.js';

export function projectRoutes(s: Services, id: Identity) {
  const r = new Hono();

  r.get('/projects', async (c) => c.json(await s.projects.list(await id.userOf(c))));
  r.post('/projects/import', async (c) => {
    const user = await id.userOf(c);
    const body: any = await c.req.json().catch(() => ({}));
    if (!Array.isArray(body.doc?.pages)) throw httpError(400, 'O arquivo não contém um projeto válido.');
    const file = fileNameFor(String(body.name || body.doc.name || 'projeto importado'));
    const saved = await s.projects.write(user, file, body.doc, { base: {}, overwrite: false, by: 'import' });
    return c.json({ ok: true, ...saved }, 201);
  });

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

  /** O zip entrega o projeto para download. VIEWER lê o canvas, mas não leva o pacote. */
  const loadZip = async (c: Parameters<Identity['userOf']>[0], file: string) => {
    const name = checkName(file);
    const loaded = await s.projects.load(await id.userOf(c), name);
    if (loaded.role === 'VIEWER') throw httpError(403, 'Você só pode ler ou comentar este projeto.');
    return { name, doc: loaded.doc };
  };

  r.get('/projects/:file/react.zip', async (c) => {
    const { name, doc } = await loadZip(c, c.req.param('file'));
    const site = exportReact(doc);
    const zip = Buffer.from(createZip(site.files.map(({ path, content }) => ({ path, content }))));
    return c.body(zip, 200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${name.replace(/\.json$/i, '')}-react.zip"`,
    });
  });

  r.get('/projects/:file/site.zip', async (c) => {
    const { name, doc } = await loadZip(c, c.req.param('file'));
    const site = exportSite(doc, { vendor: vendorFiles });
    const zip = Buffer.from(createZip(site.files.map(({ path, content }) => ({ path, content }))));
    return c.body(zip, 200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${name.replace(/\.json$/i, '')}-site.zip"`,
      'Cache-Control': 'no-store',
    });
  });

  r.post('/projects/:file/publish', async (c) => {
    const user = await id.userOf(c);
    const name = checkName(c.req.param('file'));
    const { doc, id: projectId } = await s.projects.load(user, name);
    const body: any = await readObject(c).catch(() => ({}));
    const format = String(body.format || 'html').toLowerCase();
    if (format !== 'html' && format !== 'react') throw httpError(400, 'Formato de publicação inválido.');
    const version = await s.projects.snapshot(user, name, body.label == null ? `Publicação ${new Date().toLocaleString('pt-BR')}` : String(body.label));
    const audit = auditReport(auditStatic(doc.pages || []));
    const warnings = audit.issues.map((issue) => (issue.severity === 'erro' ? 'Erro: ' : 'Aviso: ') + issue.message);
    const site = format === 'react' ? exportReact(doc) : exportSite(doc, { vendor: vendorFiles });
    const zip = Buffer.from(createZip(site.files.map(({ path, content }) => ({ path, content }))));
    const allWarnings = [...warnings, ...site.warnings];
    const record = await s.db.publishRecord.create({ data: { projectId, format, status: allWarnings.length ? 'READY_WITH_WARNINGS' : 'READY', warnings: allWarnings as any } });
    return c.json({ ok: true, id: record.id, version, format, bytes: zip.length, download: `/api/projects/${encodeURIComponent(name)}/${format === 'react' ? 'react' : 'site'}.zip`, warnings: allWarnings, audit: { errors: audit.errors, warnings: audit.warnings, truncated: audit.truncated } });
  });
  r.get('/projects/:file/publishing', async (c) => {
    const { id: projectId } = await s.projects.load(await id.userOf(c), checkName(c.req.param('file')));
    return c.json(await s.db.publishRecord.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 30 }));
  });

  // a imagem pelo hash (sha256): conteúdo imutável, então o navegador pode guardar para sempre
  r.get('/projects/:file/assets/:hash', async (c) => {
    const hash = c.req.param('hash');
    if (!/^[0-9a-f]{64}$/.test(hash)) throw httpError(400, 'Hash de imagem inválido.');
    const { mime, data } = await s.projects.asset(await id.userOf(c), checkName(c.req.param('file')), hash);
    return c.body(Buffer.from(data), 200, {
      'Content-Type': mime,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // SVG pode conter <script>: servido direto não executa nada
      'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
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
  r.get('/projects/:file/versions/compare', async (c) => c.json(await s.projects.compareVersions(await id.userOf(c), checkName(c.req.param('file')), String(c.req.query('left') || ''), String(c.req.query('right') || ''))));
  r.put('/projects/:file/versions/:version', async (c) => { const { label } = await readObject(c); return c.json(await s.projects.labelVersion(await id.userOf(c), checkName(c.req.param('file')), c.req.param('version'), label == null ? null : String(label))); });
  r.post('/projects/:file/versions/:version/duplicate', async (c) => { const { title } = await readObject(c); return c.json(await s.projects.duplicateVersion(await id.userOf(c), checkName(c.req.param('file')), c.req.param('version'), String(title || ''))); });
  r.get('/projects/:file/versions/:version', async (c) => c.json(await s.projects.readVersion(await id.userOf(c), checkName(c.req.param('file')), c.req.param('version'))));
  r.post('/projects/:file/versions/:version/restore', async (c) => c.json({ ok: true, ...(await s.projects.restoreVersion(await id.userOf(c), checkName(c.req.param('file')), c.req.param('version'))) }));
  r.post('/projects/:file/restore', async (c) => {
    const body = await readObject(c);
    const version = String(body.version || body.versionId || '').trim();
    if (!version) throw httpError(400, 'Informe version ou versionId para restaurar o projeto.');
    return c.json({ ok: true, ...(await s.projects.restoreVersion(await id.userOf(c), checkName(c.req.param('file')), version)) });
  });

  r.get('/projects/:file/activity', async (c) => {
    const { id: projectId } = await s.projects.load(await id.userOf(c), checkName(c.req.param('file')));
    const actorType = c.req.query('actor') === 'USER' || c.req.query('actor') === 'AGENT' ? c.req.query('actor') as 'USER' | 'AGENT' : undefined;
    return c.json(await s.operations.list(projectId, { limit: Number(c.req.query('limit')) || 50, agentId: c.req.query('agent') || undefined, userId: c.req.query('user') || undefined, tool: c.req.query('tool') || undefined, actorType }));
  });
  r.get('/projects/:file/presence', async (c) => {
    const { id: projectId } = await s.projects.load(await id.userOf(c), checkName(c.req.param('file')));
    const snap: any = s.presence.snapshotForProject ? s.presence.snapshotForProject(checkName(c.req.param('file'))) : s.presence.snapshot();
    const sessions = new Set(s.workspace.sessionsForProject(projectId));
    return c.json({ projectId, people: snap.people, agents: snap.agents.filter((a: any) => sessions.has(a.id)), locks: snap.agents.filter((a: any) => sessions.has(a.id)).flatMap((a: any) => a.locks || []), activity: await s.operations.list(projectId, { limit: 20 }) });
  });

  return r;
}
