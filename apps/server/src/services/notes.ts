/**
 * services/notes.ts — NOTAS DE DECISÃO E COMENTÁRIOS (no banco)
 * Duas espécies: DECISION ("por que fizemos assim", para quem retomar o trabalho depois) e COMMENT (conversa/revisão).
 * Cada nota pertence a um projeto e, opcionalmente, a uma camada; pode responder a outra nota.
 */

import type { Db } from '@stylo/db/client.ts';
import { httpError } from '../http-error.js';
import type { Actor } from '../workspace/index.js';

export type NoteKindName = 'COMMENT' | 'DECISION';

export interface NoteView {
  id: string; kind: NoteKindName; body: string; layerId: string | null; parentId: string | null;
  resolved: boolean; at: Date; by: string; byType: 'USER' | 'AGENT' | 'SYSTEM';
}

export function createNotes(db: Db) {
  const view = (n: any): NoteView => ({
    id: n.id, kind: n.kind, body: n.body, layerId: n.layerId, parentId: n.parentId, resolved: n.resolved, at: n.createdAt,
    by: n.agent?.name ?? n.user?.name ?? 'Sistema', byType: n.authorType,
  });
  const include = { agent: { select: { name: true } }, user: { select: { name: true } } } as const;

  async function create(actor: Actor, projectId: string, input: { body: string; kind?: NoteKindName; layerId?: string; parentId?: string }) {
    const body = String(input.body ?? '').trim();
    if (!body) throw httpError(400, 'A nota está vazia.');
    if (body.length > 8000) throw httpError(400, 'Nota grande demais (limite de 8000 caracteres).');
    if (input.parentId) {
      const parent = await db.note.findFirst({ where: { id: input.parentId, projectId } });
      if (!parent) throw httpError(404, 'A nota a que você responde não existe neste projeto.');
    }
    const note = await db.note.create({
      data: {
        projectId, body, kind: input.kind ?? 'DECISION', layerId: input.layerId || null, parentId: input.parentId || null,
        authorType: actor.type, userId: actor.type === 'USER' ? actor.userId : null, agentId: actor.agentId ?? null,
      },
      include,
    });
    return view(note);
  }

  async function list(projectId: string, { layerId, kind, includeResolved = true, limit = 100 }: { layerId?: string; kind?: NoteKindName; includeResolved?: boolean; limit?: number } = {}) {
    const rows = await db.note.findMany({
      where: { projectId, ...(layerId ? { layerId } : {}), ...(kind ? { kind } : {}), ...(includeResolved ? {} : { resolved: false }) },
      orderBy: { createdAt: 'asc' }, take: Math.min(Math.max(limit, 1), 500), include,
    });
    return rows.map(view);
  }

  async function resolve(projectId: string, id: string, resolved: boolean) {
    const found = await db.note.findFirst({ where: { id, projectId } });
    if (!found) throw httpError(404, 'Nota não encontrada neste projeto.');
    return view(await db.note.update({ where: { id }, data: { resolved }, include }));
  }

  return { create, list, resolve };
}

export type Notes = ReturnType<typeof createNotes>;
