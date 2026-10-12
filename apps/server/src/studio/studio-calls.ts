/**
 * studio/studio-calls.ts — O PAINEL WEB CHAMANDO AS FERRAMENTAS
 *
 * O painel (apps/studio) não tem um caminho próprio para alterar o documento: ele chama as MESMAS ferramentas que um agente
 * chama pelo MCP, pelo mesmo workspace, com as mesmas validações, permissões, travas por camada e log de atividade.
 * Assim pessoa e agente produzem exatamente o mesmo resultado, e uma regra nova das ferramentas vale para os dois.
 *
 * `sid` identifica a aba do navegador (o workspace guarda o projeto aberto por sessão, como faz com cada agente MCP).
 */

import { randomUUID } from 'node:crypto';
import { toolByName } from '@stylo/core/tools/schema.js';
import { colorFor, targetsOf, DOCUMENT_LOCK } from '../presence.js';
import type { PublicUser } from '../services/auth.js';
import type { Actor, Workspace } from '../workspace/index.js';
import type { Events } from '../events.js';

/** Ferramentas que o painel não deve chamar direto (não fazem sentido para uma pessoa na tela). */
const BLOCKED = new Set<string>([]);

export interface StudioCallInput {
  sid: string;
  tool: string;
  args?: Record<string, unknown>;
  /** Página que a aba está mostrando: o projeto tem uma página "atual" compartilhada, então a aba a restabelece antes de escrever. */
  pageId?: string;
}

export function createStudioCaller({ workspace, presence, events }: { workspace: Workspace; presence: any; events: Events }) {
  /** Mostra na lista de atividade o que a pessoa fez (as pessoas não são "agentes", então não entram em presence.done). */
  const log = (user: PublicUser, text: string) => presence.log?.(user.name, user.color || colorFor(user.name), text);

  async function call(user: PublicUser, input: StudioCallInput, signal?: AbortSignal): Promise<any> {
    const { sid, tool, args = {}, pageId } = input;
    if (BLOCKED.has(tool)) return { error: `A ferramenta ${tool} não está disponível no painel.` };
    const def: any = toolByName(tool);
    const actor: Actor = { type: 'USER', userId: user.id, name: user.name };
    const locking = !!def?.write && !def.noLock;
    const targets = locking ? targetsOf(args) : [];
    const lockTargets = locking ? (targets.length ? targets : [DOCUMENT_LOCK]) : [];
    const lockId = randomUUID();
    let locked = false;
    if (locking) {
      const lock = presence.lock(lockId, lockTargets, 0, { agentId: sid, name: user.name, yieldToCompleted: true });
      if (!lock.ok) {
        const what = lock.id === DOCUMENT_LOCK ? 'O documento inteiro está sendo alterado' : `A camada ${lock.id} está sendo alterada`;
        return { error: `${what} por ${lock.by} agora. Espere uns ${lock.wait}s e tente de novo.` };
      }
      locked = true;
    }
    try {
      // a aba pode estar numa página diferente da "atual" do projeto: restabelece antes de escrever
      if (pageId && tool !== 'switch_page') {
        const current = workspace.snapshot(sid);
        if (current && current.pageId !== pageId) await workspace.call('switch_page', { id: pageId }, { sid, actor, signal });
      }
      const out = await workspace.call(tool, args, { sid, actor, signal });
      if (def?.write && !out?.error && !out?.refused) log(user, out?._summary || `usou ${tool}`);
      return out;
    } finally {
      // sem janela depois da edição: quem edita no painel não deve fazer o agente esperar (nem esperar o agente) à toa
      if (locked) presence.finishLocks(lockId, lockTargets, 0);
      if (locking) events.broadcastPresence();
    }
  }

  return { call };
}

export type StudioCaller = ReturnType<typeof createStudioCaller>;
