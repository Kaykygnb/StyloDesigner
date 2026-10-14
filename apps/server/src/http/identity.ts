/**
 * http/identity.ts — QUEM FEZ O PEDIDO (pessoa) e a política de entrada de agentes
 * Quem tem a sessão (cookie `stylo_session` ou `Authorization: Bearer`). Sem sessão, 401.
 */

import type { Context } from 'hono';
import { httpError } from '../http-error.js';
import type { Services } from '../context.js';
import type { PublicUser } from '../services/auth.js';
import type { AgentPolicy } from '../services/agents.js';

export const bearerOf = (c: Context) => (/^Bearer\s+(\S+)$/i.exec(c.req.header('authorization') || '') || [])[1] || '';
const cookieOf = (c: Context, name: string) => ((c.req.header('cookie') || '').split(/;\s*/).map((p) => p.split('=')).find(([k]) => k === name) || [])[1] || '';
export const sessionTokenOf = (c: Context) => bearerOf(c) || cookieOf(c, 'stylo_session');
export const sessionCookie = (token: string, maxAge: number) => `stylo_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

export function createIdentity(s: Pick<Services, 'auth' | 'config'>) {
  /** A pessoa dona deste pedido; 401 se não entrou. */
  async function userOf(c: Context): Promise<PublicUser> {
    const user = await s.auth.userFromToken(sessionTokenOf(c));
    if (!user) throw httpError(401, 'Entre com a sua conta.');
    if (user.mustChangePassword) throw httpError(403, 'Troque a senha temporária antes de continuar.');
    return user;
  }
  async function passwordUserOf(c: Context): Promise<PublicUser> {
    const user = await s.auth.userFromToken(sessionTokenOf(c));
    if (!user) throw httpError(401, 'Entre com a sua conta.');
    return user;
  }
  /** A conta mestre (403 para os outros). */
  async function ownerOf(c: Context): Promise<PublicUser> {
    const user = await userOf(c);
    if (user.role !== 'OWNER') throw httpError(403, 'Só a conta mestre faz isto.');
    return user;
  }
  async function adminOf(c: Context): Promise<PublicUser> {
    const user = await userOf(c);
    if (user.role !== 'OWNER' && user.role !== 'ADMIN') throw httpError(403, 'Só administradores fazem isto.');
    return user;
  }
  /** Política gravada na configuração. Sem token o canal não abre; o padrão é fechado. */
  const agentPolicy = (): AgentPolicy => {
    const p = s.config.get().mcp?.agentPolicy;
    return p === 'open' || p === 'approval' || p === 'closed' ? p : 'closed';
  };
  return { userOf, passwordUserOf, ownerOf, adminOf, agentPolicy };
}

export type Identity = ReturnType<typeof createIdentity>;
