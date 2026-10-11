/**
 * services/agents.ts — CADASTRO DOS AGENTES (quem pode entrar pelo MCP)
 *
 * Cada agente (Claude Code, Codex...) é um registro com dono, escopos e estado:
 *   PENDING (esperando aprovação) → ACTIVE → REVOKED.
 * O token (`stylo_agt_...`) aparece UMA vez, na criação; só o hash fica no banco.
 * Política de entrada de agentes sem token (modo local):
 *   open      registra sozinho pelo nome do programa e já ativa (conveniência de quem roda na própria máquina)
 *   approval  registra como PENDING; a conta mestre aprova
 *   closed    só entra quem tem token criado pela conta mestre
 */

import type { Db } from '@stylo/db/client.ts';
import { httpError } from '../http-error.js';
import { newToken, sha256 } from './auth.js';

export type AgentPolicy = 'open' | 'approval' | 'closed';
export const SCOPES = ['read', 'comment', 'write', 'export'] as const;
export interface AgentIdentity { id: string; name: string; ownerId: string; scopes: string[] }

const clean = (name: string) => String(name || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 60) || 'Agente';
const identity = (a: { id: string; name: string; ownerId: string; scopes: string[] }): AgentIdentity => ({ id: a.id, name: a.name, ownerId: a.ownerId, scopes: a.scopes });

export function createAgents(db: Db) {
  /** A conta mestre cria um agente já ativo e recebe o token (mostrado só agora). */
  async function create(ownerId: string, input: { name: string; scopes?: string[] }) {
    const scopes = (input.scopes?.length ? input.scopes : ['read', 'comment', 'write', 'export']).filter((s) => (SCOPES as readonly string[]).includes(s));
    const token = newToken('stylo_agt');
    const agent = await db.agent.create({ data: { name: clean(input.name), ownerId, tokenHash: sha256(token), scopes, status: 'ACTIVE' } });
    return { agent: identity(agent), token };
  }

  /** Autentica pelo token. Lança 401/403 com o motivo para o programa mostrar à pessoa. */
  async function authenticate(token: string): Promise<AgentIdentity> {
    const agent = await db.agent.findUnique({ where: { tokenHash: sha256(token) } });
    if (!agent) throw httpError(401, 'Token de agente inválido.');
    if (agent.status === 'REVOKED') throw httpError(401, 'Este agente foi revogado pela conta mestre.');
    if (agent.status === 'PENDING') throw httpError(403, 'Este agente ainda não foi aprovado pela conta mestre.');
    await db.agent.update({ where: { id: agent.id }, data: { lastSeenAt: new Date() }, select: { id: true } });
    return identity(agent);
  }

  /** Modo local, sem token: acha (ou cria) o agente pelo nome do programa, conforme a política. */
  async function forClient(ownerId: string, clientName: string, policy: AgentPolicy): Promise<AgentIdentity> {
    if (policy === 'closed') throw httpError(401, 'Este servidor só aceita agentes com token. Peça um à conta mestre.');
    const name = clean(clientName);
    const found = await db.agent.findFirst({ where: { ownerId, name } });
    if (found) {
      if (found.status === 'REVOKED') throw httpError(401, 'Este agente foi revogado pela conta mestre.');
      if (found.status === 'PENDING') throw httpError(403, 'Este agente ainda não foi aprovado pela conta mestre.');
      await db.agent.update({ where: { id: found.id }, data: { lastSeenAt: new Date() }, select: { id: true } });
      return identity(found);
    }
    const status = policy === 'open' ? 'ACTIVE' : 'PENDING';
    const agent = await db.agent.create({ data: { name, ownerId, tokenHash: sha256(newToken('stylo_agt')), scopes: ['read', 'comment', 'write', 'export'], status, lastSeenAt: new Date() } });
    if (status === 'PENDING') throw httpError(403, 'Agente registrado: aguarde a conta mestre aprovar.');
    return identity(agent);
  }

  const setStatus = async (id: string, status: 'ACTIVE' | 'REVOKED') => {
    const agent = await db.agent.update({ where: { id }, data: { status } }).catch(() => null);
    if (!agent) throw httpError(404, 'Agente não encontrado.');
    return identity(agent);
  };

  const list = async (ownerId?: string) => (await db.agent.findMany({ where: ownerId ? { ownerId } : {}, orderBy: { createdAt: 'asc' } }))
    .map((a) => ({ ...identity(a), status: a.status, createdAt: a.createdAt, lastSeenAt: a.lastSeenAt }));

  return { create, authenticate, forClient, approve: (id: string) => setStatus(id, 'ACTIVE'), revoke: (id: string) => setStatus(id, 'REVOKED'), list };
}

export type Agents = ReturnType<typeof createAgents>;
