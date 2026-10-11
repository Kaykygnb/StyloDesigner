/**
 * services/operations.ts — LOG DE ATIVIDADE (quem fez o quê, em qual projeto)
 * Alimenta a presença ("o agente X está fazendo..."), o histórico e a auditoria. Só ferramentas que ALTERAM o projeto entram.
 */

import type { Db } from '@stylo/db/client.ts';
import type { OperationRecord } from '../workspace/index.js';

export function createOperations(db: Db) {
  /** Gravações do log ainda em andamento: quem for fechar o banco espera por elas com `idle()`. */
  const inflight = new Set<Promise<unknown>>();

  function record(op: OperationRecord): Promise<void> {
    const p = db.operation.create({
      data: {
        projectId: op.projectId, actorType: op.actor.type, userId: op.actor.type === 'USER' ? op.actor.userId : null,
        agentId: op.actor.agentId ?? null, tool: op.tool, args: (op.args ?? undefined) as any,
        summary: op.summary, layerIds: op.layerIds, ok: op.ok,
      },
    }).then(() => undefined);
    inflight.add(p);
    const done = () => { inflight.delete(p); };
    p.then(done, done);
    return p;
  }

  const idle = async () => { await Promise.allSettled([...inflight]); };

  /** Atividade recente do projeto (mais nova primeiro). */
  async function list(projectId: string, { limit = 50, agentId }: { limit?: number; agentId?: string } = {}) {
    const rows = await db.operation.findMany({
      where: { projectId, ...(agentId ? { agentId } : {}) },
      orderBy: { id: 'desc' }, take: Math.min(Math.max(limit, 1), 200),
      include: { agent: { select: { name: true } }, user: { select: { name: true } } },
    });
    return rows.map((r) => ({
      id: Number(r.id), at: r.createdAt, who: r.agent?.name ?? r.user?.name ?? 'Sistema', actorType: r.actorType,
      tool: r.tool, summary: r.summary, layerIds: r.layerIds, ok: r.ok,
    }));
  }

  return { record, list, idle };
}

export type Operations = ReturnType<typeof createOperations>;
