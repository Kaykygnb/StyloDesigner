/**
 * services/agents.ts — CADASTRO DOS AGENTES (quem pode entrar pelo MCP)
 *
 * Cada agente (Claude Code, Codex...) é um registro com dono, escopos e estado:
 *   PENDING (esperando aprovação) → ACTIVE → REVOKED.
 * O token (`stylo_agt_...`) aparece UMA vez, na criação; só o hash fica no banco.
 * O canal MCP exige esse token. `forClient` permanece para testes da política antiga e não abre o canal:
 *   open      registraria sozinho pelo nome do programa
 *   approval  registraria como PENDING
 *   closed    só entra quem tem token criado pela conta mestre
 */

import { timingSafeEqual } from 'node:crypto';
import type { Db } from '@stylo/db/client.ts';
import { httpError } from '../http-error.js';
import { newToken, sha256 } from './auth.js';

export type AgentPolicy = 'open' | 'approval' | 'closed';
export const SCOPES = ['read', 'comment', 'write', 'export'] as const;
export interface AgentIdentity { id: string; name: string; type: string; ownerId: string; scopes: string[] }

const clean = (name: string) => String(name || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 60) || 'Agente';
const identity = (a: { id: string; name: string; type: string; ownerId: string; scopes: string[] }): AgentIdentity => ({ id: a.id, name: a.name, type: a.type, ownerId: a.ownerId, scopes: a.scopes });
const sameHash = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export function createAgents(db: Db, hooks: { onCredentialRevoked?: (agentId: string) => void } = {}) {
  /** A conta mestre cria um agente já ativo e recebe o token (mostrado só agora). */
  async function create(ownerId: string, input: { name: string; type?: string; scopes?: string[] }) {
    const scopes = (input.scopes?.length ? input.scopes : ['read', 'comment', 'write', 'export']).filter((s) => (SCOPES as readonly string[]).includes(s));
    const token = newToken('stylo_agt');
    const agent = await db.agent.create({ data: { name: clean(input.name), type: clean(input.type || 'mcp'), ownerId, tokenHash: sha256(token), scopes, status: 'ACTIVE' } });
    return { agent: identity(agent), token };
  }

  async function loadActive(where: { id: string } | { tokenHash: string }) {
    const agent = await db.agent.findUnique({ where, include: { owner: { select: { suspended: true } } } });
    if (!agent) throw httpError(401, 'Token de agente inválido.');
    if (agent.status === 'REVOKED') throw httpError(401, 'Este agente foi revogado pela conta mestre.');
    if (agent.status === 'PENDING') throw httpError(403, 'Este agente ainda não foi aprovado pela conta mestre.');
    if (agent.owner?.suspended) throw httpError(401, 'A conta dona deste agente está suspensa.');
    return agent;
  }

  /** Autentica pelo token. Lança 401/403 com o motivo para o programa mostrar à pessoa. */
  async function authenticate(token: string): Promise<AgentIdentity> {
    const agent = await loadActive({ tokenHash: sha256(token) });
    await db.agent.update({ where: { id: agent.id }, data: { lastSeenAt: new Date() }, select: { id: true } });
    return identity(agent);
  }

  /**
   * Reconfere a credencial presa à sessão, sem bearer novo.
   * Token rotacionado, revogação e dono suspenso recusam. Escopos voltam atualizados.
   */
  async function revalidateBound(id: string, credentialHash: string): Promise<AgentIdentity> {
    const agent = await db.agent.findUnique({ where: { id }, include: { owner: { select: { suspended: true } } } });
    if (!agent || agent.status !== 'ACTIVE') throw httpError(401, 'Este agente foi revogado pela conta mestre.');
    if (!sameHash(agent.tokenHash, credentialHash)) throw httpError(401, 'O token deste agente foi rotacionado. Abra uma sessão nova.');
    if (agent.owner?.suspended) throw httpError(401, 'A conta dona deste agente está suspensa.');
    await db.agent.update({ where: { id: agent.id }, data: { lastSeenAt: new Date() }, select: { id: true } });
    return identity(agent);
  }

  async function credentialHash(id: string): Promise<string> {
    const agent = await db.agent.findUnique({ where: { id }, select: { tokenHash: true } });
    if (!agent) throw httpError(401, 'Token de agente inválido.');
    return agent.tokenHash;
  }

  /** Modo local, sem token: acha (ou cria) o agente pelo nome do programa, conforme a política. */
  async function forClient(ownerId: string, clientName: string, policy: AgentPolicy): Promise<AgentIdentity> {
    if (policy === 'closed') throw httpError(401, 'Este servidor só aceita agentes com token. Peça um à conta mestre.');
    const owner = await db.user.findUnique({ where: { id: ownerId }, select: { suspended: true } });
    if (owner?.suspended) throw httpError(401, 'A conta dona deste agente está suspensa.');
    const name = clean(clientName);
    const found = await db.agent.findFirst({ where: { ownerId, name } });
    if (found) {
      if (found.status === 'REVOKED') throw httpError(401, 'Este agente foi revogado pela conta mestre.');
      if (found.status === 'PENDING') throw httpError(403, 'Este agente ainda não foi aprovado pela conta mestre.');
      await db.agent.update({ where: { id: found.id }, data: { lastSeenAt: new Date() }, select: { id: true } });
      return identity(found);
    }
    const status = policy === 'open' ? 'ACTIVE' : 'PENDING';
    const agent = await db.agent.create({ data: { name, type: 'mcp', ownerId, tokenHash: sha256(newToken('stylo_agt')), scopes: ['read', 'comment', 'write', 'export'], status, lastSeenAt: new Date() } });
    if (status === 'PENDING') throw httpError(403, 'Agente registrado: aguarde a conta mestre aprovar.');
    return identity(agent);
  }

  const setStatus = async (id: string, status: 'ACTIVE' | 'REVOKED') => {
    const agent = await db.agent.update({ where: { id }, data: { status } }).catch(() => null);
    if (!agent) throw httpError(404, 'Agente não encontrado.');
    return identity(agent);
  };

  async function setScopes(id: string, scopes: string[]) {
    const valid = [...new Set(scopes.filter((s) => (SCOPES as readonly string[]).includes(s)))];
    if (!valid.length) throw httpError(400, 'Escolha pelo menos uma permissão.');
    const agent = await db.agent.update({ where: { id }, data: { scopes: valid } }).catch(() => null);
    if (!agent) throw httpError(404, 'Agente não encontrado.');
    return identity(agent);
  }
  async function rotate(id: string) {
    const token = newToken('stylo_agt');
    const agent = await db.agent.update({ where: { id }, data: { tokenHash: sha256(token), status: 'ACTIVE' } }).catch(() => null);
    if (!agent) throw httpError(404, 'Agente não encontrado.');
    hooks.onCredentialRevoked?.(id);
    return { agent: identity(agent), token };
  }

  async function projectAccess(agentId: string, projectId: string) {
    return !!(await db.agentProject.findUnique({ where: { agentId_projectId: { agentId, projectId } }, select: { agentId: true } }));
  }
  async function grantProject(agentId: string, projectId: string) {
    await db.agentProject.upsert({ where: { agentId_projectId: { agentId, projectId } }, create: { agentId, projectId }, update: {} });
    return { ok: true, agentId, projectId };
  }
  async function revokeProject(agentId: string, projectId: string) {
    await db.agentProject.deleteMany({ where: { agentId, projectId } });
    return { ok: true };
  }
  async function projects(agentId: string) {
    return db.agentProject.findMany({ where: { agentId }, select: { projectId: true, createdAt: true }, orderBy: { createdAt: 'asc' } });
  }

  const list = async (ownerId?: string) => (await db.agent.findMany({ where: ownerId ? { ownerId } : {}, orderBy: { createdAt: 'asc' } }))
    .map((a) => ({ ...identity(a), status: a.status, createdAt: a.createdAt, lastSeenAt: a.lastSeenAt }));

  async function revoke(id: string) {
    const agent = await setStatus(id, 'REVOKED');
    hooks.onCredentialRevoked?.(id);
    return agent;
  }

  return { create, rotate, authenticate, revalidateBound, credentialHash, forClient, approve: (id: string) => setStatus(id, 'ACTIVE'), revoke, setScopes, list, projectAccess, grantProject, revokeProject, projects };
}

export type Agents = ReturnType<typeof createAgents>;
