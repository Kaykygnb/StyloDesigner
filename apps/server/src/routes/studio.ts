/**
 * routes/studio.ts — A PONTE DO PAINEL WEB
 *
 *   POST /api/studio/call   chama uma ferramenta (as mesmas do MCP) em nome da pessoa logada
 *   GET  /api/studio/doc    o documento do projeto aberto na sessão (o painel o desenha sozinho); null se não há projeto aberto
 *
 * Não há "edição do documento pelo navegador": toda mudança é uma chamada de ferramenta, feita pelo workspace do servidor.
 */

import { Hono } from 'hono';
import type { HttpBindings } from '@hono/node-server';
import type { Services } from '../context.js';
import type { Identity } from '../http/identity.js';
import type { StudioCaller } from '../studio/studio-calls.js';
import { httpError } from '../http-error.js';

const SID = /^[A-Za-z0-9_-]{8,80}$/;

export function studioRoutes(s: Services, id: Identity, studio: StudioCaller) {
  const r = new Hono<{ Bindings: HttpBindings }>();

  r.post('/studio/call', async (c) => {
    const user = await id.userOf(c);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') throw httpError(400, 'Corpo inválido.');
    const { sid, tool, args, pageId } = body as Record<string, unknown>;
    if (typeof sid !== 'string' || !SID.test(sid)) throw httpError(400, 'sid inválido.');
    if (typeof tool !== 'string' || !/^[a-z_0-9]{1,60}$/.test(tool)) throw httpError(400, 'tool inválida.');
    if (args !== undefined && (typeof args !== 'object' || args === null || Array.isArray(args))) throw httpError(400, 'args precisa ser um objeto.');
    if (pageId !== undefined && typeof pageId !== 'string') throw httpError(400, 'pageId inválido.');
    const out = await studio.call(user, { sid, tool, args: (args as Record<string, unknown>) || {}, pageId: pageId as string | undefined });
    return c.json(out);
  });

  r.get('/studio/doc', async (c) => {
    await id.userOf(c);
    const sid = c.req.query('sid') || '';
    if (!SID.test(sid)) throw httpError(400, 'sid inválido.');
    const snap = s.workspace.snapshot(sid);
    // sem projeto aberto não é erro: o painel pergunta isso ao carregar a página (null = nenhum)
    return c.json(snap);
  });


  return r;
}
