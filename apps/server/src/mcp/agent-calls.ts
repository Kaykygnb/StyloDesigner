/**
 * mcp/agent-calls.ts — EXECUTA UMA FERRAMENTA PEDIDA POR UMA SESSÃO MCP
 *
 * Em volta do workspace: presença (o agente aparece "fazendo algo"), TRAVAS por camada (duas IAs não mexem na mesma
 * camada ao mesmo tempo; quem chega depois recebe um aviso claro) e contagem de chamadas em voo (encerrar a sessão
 * no meio de uma edição só solta as travas quando ela termina).
 */

import { randomUUID } from 'node:crypto';
import { toolByName } from '@stylo/core/tools/schema.js';
import { targetsOf, DOCUMENT_LOCK } from '../presence.js';
import type { AgentIdentity } from '../services/agents.js';
import type { Workspace } from '../workspace/index.js';
import type { Events } from '../events.js';

export interface McpSession {
  id: string;
  agent: AgentIdentity;
  /** Nome mostrado na presença (o do agente cadastrado ou o forçado pelo cabeçalho x-stylo-agent). */
  name: string;
  activeCalls: number;
  closing: boolean;
  lastSeen: number;
}

export function createToolCaller({ workspace, presence, events }: { workspace: Workspace; presence: any; events: Events }) {
  /** A sessão acabou: tira o agente da presença e solta o projeto atual. */
  function endSession(session: McpSession) {
    presence.removeAgent(session.id);
    workspace.endSession(session.id);
    events.broadcastPresence();
  }
  const settle = (session: McpSession) => {
    session.activeCalls--;
    if (session.closing && session.activeCalls === 0) endSession(session);
  };

  async function call(session: McpSession, tool: string, args: any, signal?: AbortSignal): Promise<any> {
    const sid = session.id;
    session.activeCalls++;
    session.lastSeen = Date.now();
    presence.touchAgent(sid, session.name);
    const def: any = toolByName(tool);
    const locking = def?.write && !def.noLock;
    const writeTargets = locking ? targetsOf(args) : [];
    // Resize e mudança de modo de layout podem afetar filhos fora da lista explícita do lote.
    if (locking && tool === 'update_layers' && Array.isArray(args?.updates) && args.updates.some((update: any) => {
      const props = update?.props;
      return props && typeof props === 'object' && ('w' in props || 'h' in props || (props.layout && typeof props.layout === 'object' && 'mode' in props.layout));
    })) writeTargets.push(DOCUMENT_LOCK);
    const lockTargets = locking ? (writeTargets.length ? writeTargets : [DOCUMENT_LOCK]) : [];
    let locked = false;
    // Trava por chamada, não por sessão: uma mesma IA pode disparar ferramentas em paralelo, e chamadas
    // diferentes do mesmo agente também não podem escrever ao mesmo tempo na mesma camada.
    const lockId = randomUUID();
    if (locking) {
      const lock = presence.lock(lockId, lockTargets, 0, { agentId: sid, name: session.name });
      if (!lock.ok) {
        presence.done(sid, tool, `esperou a camada ${lock.id} (em uso por ${lock.by})`, false);
        settle(session);
        events.broadcastPresence();
        const message = lock.id === DOCUMENT_LOCK ? 'O documento inteiro está sendo alterado' : `A camada ${lock.id} está sendo alterada`;
        return { error: `${message} por ${lock.by} agora. Espere uns ${lock.wait}s e tente de novo, ou trabalhe em outra parte do design.` };
      }
      locked = true;
    }
    events.broadcastPresence();
    try {
      const actor = { type: 'AGENT' as const, userId: session.agent.ownerId, agentId: session.agent.id, name: session.name, scopes: session.agent.scopes };
      const out = await workspace.call(tool, args, { sid, actor, signal });
      presence.done(sid, tool, def?.write ? (out?._summary || `usou ${tool}`) : null, !(out?.error || out?.refused));
      return out;
    } catch (err: any) {
      presence.done(sid, tool, `${tool}: ${err.message}`, false);
      throw err;
    } finally {
      if (locked) presence.finishLocks(lockId, lockTargets);
      settle(session);
      events.broadcastPresence();
    }
  }

  return { call, endSession };
}

export type ToolCaller = ReturnType<typeof createToolCaller>;
