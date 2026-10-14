/**
 * services/auth.ts — PESSOAS, SENHAS E SESSÕES
 *
 * - Senha: scrypt (do próprio Node, sem dependência) com sal por usuário. Nenhum fluxo devolve a senha já gravada.
 * - Sessão: token aleatório de 256 bits; só o hash (sha256) vai para o banco. Vale 30 dias.
 * - A PRIMEIRA conta humana (`setup`) vira a autoridade principal da instalação e recebe papel OWNER.
 *   Vários OWNER podem existir. Só o principal nomeia, suspende, rebaixa, remove ou redefine a senha de um OWNER.
 *   Sem principal designado, ninguém faz isso — não se volta ao “qualquer OWNER”.
 * - Autenticação reforçada, substituível: `reconfirm` grava uma janela curta SÓ NESTE PROCESSO (`STEP_UP_MS`).
 *   Um mecanismo futuro troca `reconfirm` e a leitura dessa janela; a regra de quem pode administrar um OWNER fica aqui.
 * - Login: nome de usuário obrigatório, ou e-mail quando a conta tem um. Texto com "@" procura e-mail.
 * - Instalação antiga só com o usuário técnico `local@stylo.local` (senha inutilizável) é assumida pelo primeiro setup,
 *   no mesmo id, para projetos e agentes não ficarem órfãos. Não existe mais entrada sem senha.
 */

import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Db } from '@stylo/db/client.ts';
import { httpError } from '../http-error.js';

export const SESSION_DAYS = 30;
/** E-mail da conta técnica antiga (modo sem senha). Não é mais criada na subida. O setup pode assumi-la. */
export const LOCAL_EMAIL = 'local@stylo.local';
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
export const newToken = (prefix = 'stylo') => `${prefix}_${randomBytes(32).toString('base64url')}`;
const LOGIN_WINDOW_MS = 5 * 60_000;
const LOGIN_MAX_ATTEMPTS = 8;
/** Janela da reconfirmação de senha. Só vive na memória deste processo; não é política de papel. */
export const STEP_UP_MS = 5 * 60_000;
const OWNER_GATE = 'Só a autoridade principal pode alterar um proprietário.';
const PRINCIPAL_LOCK = 'A autoridade principal não pode ser suspensa, rebaixada, removida ou ter a senha redefinida por aqui.';
const STEP_UP_REQUIRED = 'Confirme sua senha de novo para esta operação.';
const OWNER_PASSWORD_REQUIRED = 'Informe a nova senha. Ela não será mostrada de volta.';

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${scryptSync(password, salt, 64).toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false; // "!" (usuário local) nunca confere
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

export type UserRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'COMMENTER' | 'VIEWER' | 'MEMBER';
export interface AccountPreferences { theme?: 'light' | 'dark' | 'system'; accent?: string; density?: 'comfortable' | 'compact'; language?: 'pt-BR' | 'en-US'; shortcuts?: Record<string, string> }
export interface PublicUser { id: string; username: string; email: string | null; name: string; role: UserRole; color: string | null; avatar: string | null; preferences: AccountPreferences; suspended: boolean; mustChangePassword: boolean; principal: boolean }
const publicUser = (u: { id: string; username: string; email: string | null; name: string; role: UserRole; color: string | null; avatar?: string | null }, principal = false): PublicUser =>
  ({ id: u.id, username: u.username, email: u.email, name: u.name, role: u.role, color: u.color, avatar: u.avatar ?? null, preferences: ((u as any).preferences || {}) as AccountPreferences, suspended: Boolean((u as any).suspended), mustChangePassword: Boolean((u as any).mustChangePassword), principal });

/** Rótulo da trilha quando a conta não tem e-mail. A coluna do evento continua preenchida. */
const auditLabel = (user: { email?: string | null; username?: string | null; id?: string }) => user.email || user.username || user.id || 'conta';

export function normalizeUsername(raw: string): string {
  const username = String(raw ?? '').trim().toLowerCase();
  if (!username) throw httpError(400, 'Diga o nome de usuário.');
  if (username.includes('@') || !USERNAME_RE.test(username)) throw httpError(400, 'Nome de usuário inválido. Use letras, números e hífen, sem @.');
  return username;
}

/** Vazio vira nulo. E-mail presente é minúsculo e válido. O endereço técnico antigo não entra de novo. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  const email = String(raw ?? '').trim().toLowerCase();
  if (!email) return null;
  if (email === LOCAL_EMAIL) throw httpError(400, 'Este e-mail é reservado.');
  if (!EMAIL_RE.test(email)) throw httpError(400, 'E-mail inválido.');
  return email;
}

type Actor = { id: string; role: UserRole; email?: string | null };
type OwnerAction = 'grant' | 'suspend' | 'restore' | 'demote' | 'remove' | 'reset';
const HARD_ON_PRINCIPAL = new Set<OwnerAction>(['suspend', 'demote', 'remove', 'reset']);

const checkName = (name: string) => { if (!name.trim()) throw httpError(400, 'Diga o nome.'); };
const checkPassword = (password: string) => { if (password.length < 8) throw httpError(400, 'A senha precisa ter pelo menos 8 caracteres.'); };

export function createAuth(db: Db, options: { now?: () => number; onUserSuspended?: (userId: string) => void } = {}) {
  const clock = () => options.now?.() ?? Date.now();
  const loginAttempts = new Map<string, { count: number; since: number }>();
  const stepUpAttempts = new Map<string, { count: number; since: number }>();
  const stepUpUntil = new Map<string, number>();
  const recordAuth = (userId: string | null, email: string, kind: string) => db.authEvent.create({ data: { userId, email, kind } }).catch(() => undefined);
  /** Conta técnica antiga, ainda sem senha utilizável. Não conta como pessoa que já entrou. */
  const legacyWhere = { email: LOCAL_EMAIL, passwordHash: '!' };
  /** Há alguma conta de pessoa (fora o usuário técnico que ainda não foi assumido)? */
  const hasAccounts = async () => (await db.user.count({ where: { NOT: legacyWhere } })) > 0;
  /** Conta apontada como autoridade principal, ou null se o banco ainda não foi designado. */
  const principalId = async () => (await db.installation.findUnique({ where: { id: 1 }, select: { principalUserId: true } }))?.principalUserId ?? null;
  const publish = async (u: { id: string; username: string; email: string | null; name: string; role: UserRole; color: string | null; avatar?: string | null }) => publicUser(u, (await principalId()) === u.id);

  /** Auditoria obrigatória: se o evento não grava, a mutação também não fica. A senha nunca entra no texto. */
  async function audit(tx: { authEvent: { create: (args: { data: { userId: string; email: string; kind: string } }) => Promise<unknown> }; user: { findUnique: (args: { where: { id: string }; select: { email: true; username: true } }) => Promise<{ email: string | null; username: string } | null> } }, actor: Actor, kind: string) {
    if (!/^owner\.(grant|suspend|restore|demote|remove|reset):[0-9a-f-]{36}$/i.test(kind)) throw httpError(500, 'Evento de auditoria inválido.');
    const row = await tx.user.findUnique({ where: { id: actor.id }, select: { email: true, username: true } });
    const email = actor.email || auditLabel({ email: row?.email, username: row?.username, id: actor.id });
    await tx.authEvent.create({ data: { userId: actor.id, email, kind } });
  }

  /**
   * Nomear, suspender, reativar, rebaixar, remover ou redefinir senha de um OWNER.
   * Ordem: trava do principal, depois “só o principal”, depois a janela de senha.
   * Quem não é o principal não recebe o pedido de reconfirmação.
   */
  async function assertCanManageOwner(actor: Actor | undefined, action: OwnerAction, targetId?: string) {
    const designated = await principalId();
    if (targetId && designated === targetId && HARD_ON_PRINCIPAL.has(action)) throw httpError(403, PRINCIPAL_LOCK);
    if (!designated || actor?.id !== designated) throw httpError(403, OWNER_GATE);
    if ((stepUpUntil.get(actor.id) ?? 0) <= clock()) throw httpError(403, STEP_UP_REQUIRED);
  }

  /** Reconfirma a senha atual e abre a janela. A senha não vai para o evento. */
  async function reconfirm(userId: string, password: string): Promise<{ until: string }> {
    const now = clock();
    const attempt = stepUpAttempts.get(userId);
    if (attempt && now - attempt.since < LOGIN_WINDOW_MS && attempt.count >= LOGIN_MAX_ATTEMPTS) throw httpError(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
    if (attempt && now - attempt.since >= LOGIN_WINDOW_MS) stepUpAttempts.delete(userId);
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      const current = stepUpAttempts.get(userId);
      stepUpAttempts.set(userId, { count: (current?.count || 0) + 1, since: current?.since ?? now });
      if (user) await db.authEvent.create({ data: { userId, email: auditLabel(user), kind: 'step-up-denied' } }).catch(() => undefined);
      throw httpError(400, 'A senha atual está incorreta.');
    }
    stepUpAttempts.delete(userId);
    const until = now + STEP_UP_MS;
    await db.authEvent.create({ data: { userId, email: auditLabel(user), kind: 'step-up' } });
    stepUpUntil.set(userId, until);
    return { until: new Date(until).toISOString() };
  }

  /**
   * Cria a primeira conta humana e a grava como principal.
   * Se a única conta for o usuário técnico antigo, assume esse id (projetos, agentes e segredos ficam).
   */
  async function setup(input: { username: string; name: string; password: string; email?: string | null }): Promise<PublicUser> {
    const username = normalizeUsername(input.username);
    const email = normalizeEmail(input.email);
    checkName(input.name);
    checkPassword(input.password);
    const name = input.name.trim().slice(0, 60);
    const passwordHash = hashPassword(input.password);
    try {
      return await db.$transaction(async (tx) => {
        const installation = await tx.installation.findUnique({ where: { id: 1 }, select: { principalUserId: true } });
        if (!installation) throw httpError(500, 'A instalação não tem registro de autoridade principal.');
        const legacy = await tx.user.findFirst({ where: legacyWhere });
        const humans = await tx.user.count({ where: legacy ? { id: { not: legacy.id } } : undefined });
        if (humans > 0 || (installation.principalUserId && installation.principalUserId !== legacy?.id)) throw httpError(409, 'Já existe uma conta mestre.');
        const user = legacy
          ? await tx.user.update({ where: { id: legacy.id }, data: { username, email, name, passwordHash, role: 'OWNER', mustChangePassword: false } })
          : await tx.user.create({ data: { username, email, name, passwordHash, role: 'OWNER', mustChangePassword: false } });
        if (!installation.principalUserId) {
          const claimed = await tx.installation.updateMany({ where: { id: 1, principalUserId: null }, data: { principalUserId: user.id } });
          if (claimed.count !== 1) throw httpError(409, 'Já existe uma conta mestre.');
        }
        return publicUser(user, true);
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002') throw httpError(409, 'Já existe uma conta mestre.');
      throw error;
    }
  }

  /** Cria uma conta. Papel OWNER exige o principal, a janela de senha e uma senha informada — ela não volta na resposta. */
  async function createUser(input: { username: string; email?: string | null; name: string; password: string; role?: UserRole }, skipDuplicateCheck = false, actor?: Actor): Promise<PublicUser> {
    const username = normalizeUsername(input.username);
    const email = normalizeEmail(input.email);
    const role = input.role ?? 'MEMBER';
    if (role === 'OWNER' && !skipDuplicateCheck) {
      await assertCanManageOwner(actor, 'grant');
      if (!input.password) throw httpError(400, OWNER_PASSWORD_REQUIRED);
    }
    checkName(input.name);
    checkPassword(input.password);
    if (!skipDuplicateCheck && (await db.user.findUnique({ where: { username } }))) throw httpError(409, 'Já existe uma conta com este nome de usuário.');
    if (!skipDuplicateCheck && email && (await db.user.findUnique({ where: { email } }))) throw httpError(409, 'Já existe uma conta com este e-mail.');
    const data = { username, email, name: input.name.trim().slice(0, 60), passwordHash: hashPassword(input.password), role, mustChangePassword: !skipDuplicateCheck };
    if (role === 'OWNER' && !skipDuplicateCheck) {
      const user = await db.$transaction(async (tx) => {
        const created = await tx.user.create({ data });
        await audit(tx, actor as Actor, `owner.grant:${created.id}`);
        return created;
      });
      return publish(user);
    }
    return publish(await db.user.create({ data }));
  }

  async function login(identifierRaw: string, password: string): Promise<{ token: string; user: PublicUser }> {
    const identifier = String(identifierRaw).trim().toLowerCase();
    const now = Date.now();
    const attempt = loginAttempts.get(identifier);
    if (attempt && now - attempt.since < LOGIN_WINDOW_MS && attempt.count >= LOGIN_MAX_ATTEMPTS) throw httpError(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
    if (attempt && now - attempt.since >= LOGIN_WINDOW_MS) loginAttempts.delete(identifier);
    const user = identifier.includes('@')
      ? await db.user.findFirst({ where: { email: identifier } })
      : await db.user.findUnique({ where: { username: identifier } });
    // mesma resposta para "não existe" e "senha errada" (não revela quais contas existem)
    if (!user || user.suspended || !verifyPassword(String(password), user.passwordHash)) {
      const current = loginAttempts.get(identifier);
      loginAttempts.set(identifier, { count: (current?.count || 0) + 1, since: current?.since || now });
      throw httpError(401, 'Usuário ou senha incorretos.');
    }
    loginAttempts.delete(identifier);
    const token = newToken('stylo_ses');
    await db.session.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) } });
    await recordAuth(user.id, identifier, 'login');
    return { token, user: await publish(user) };
  }

  async function userFromToken(token: string): Promise<PublicUser | null> {
    if (!token) return null;
    const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
    if (!s || s.expiresAt < new Date() || s.user.suspended) return null;
    return publish(s.user);
  }

  const logout = async (token: string) => { const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } }); if (session) await recordAuth(session.userId, auditLabel(session.user), 'logout'); await db.session.deleteMany({ where: { tokenHash: sha256(token) } }); };

  async function users(): Promise<PublicUser[]> {
    const designated = await principalId();
    return (await db.user.findMany({ orderBy: { createdAt: 'asc' } })).map((user) => publicUser(user, user.id === designated));
  }

  async function updateUser(id: string, input: { name?: string; username?: string; email?: string | null; color?: string | null; avatar?: string | null; role?: UserRole; preferences?: AccountPreferences }, actor?: Actor): Promise<PublicUser> {
    const name = input.name?.trim();
    if (name !== undefined && !name) throw httpError(400, 'Diga o nome.');
    const username = input.username === undefined ? undefined : normalizeUsername(input.username);
    const email = input.email === undefined ? undefined : normalizeEmail(input.email);
    if (username && (await db.user.findFirst({ where: { username, NOT: { id } } }))) throw httpError(409, 'Já existe uma conta com este nome de usuário.');
    if (email && (await db.user.findFirst({ where: { email, NOT: { id } } }))) throw httpError(409, 'Já existe uma conta com este e-mail.');
    if (input.avatar !== undefined && input.avatar !== null && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.avatar) || input.avatar.length > 220_000)) throw httpError(400, 'Avatar inválido ou grande demais. Use PNG, JPEG ou WebP de até 160 KB.');
    let ownerKind: string | null = null;
    if (input.role !== undefined) {
      const current = await db.user.findUnique({ where: { id }, select: { role: true } });
      if (!current) throw httpError(404, 'Conta não encontrada.');
      if (input.role === 'OWNER' && current.role !== 'OWNER') {
        await assertCanManageOwner(actor, 'grant', id);
        ownerKind = `owner.grant:${id}`;
      } else if (current.role === 'OWNER' && input.role !== 'OWNER') {
        await assertCanManageOwner(actor, 'demote', id);
        ownerKind = `owner.demote:${id}`;
      }
    }
    const data = { ...(name !== undefined ? { name: name.slice(0, 60) } : {}), ...(username !== undefined ? { username } : {}), ...(email !== undefined ? { email } : {}), ...(input.color !== undefined ? { color: input.color?.slice(0, 32) || null } : {}), ...(input.avatar !== undefined ? { avatar: input.avatar } : {}), ...(input.role !== undefined ? { role: input.role } : {}), ...(input.preferences !== undefined ? { preferences: input.preferences as any } : {}) };
    if (ownerKind) {
      const user = await db.$transaction(async (tx) => {
        const updated = await tx.user.update({ where: { id }, data }).catch(() => null);
        if (!updated) throw httpError(404, 'Conta não encontrada.');
        await audit(tx, actor as Actor, ownerKind as string);
        return updated;
      });
      return publish(user);
    }
    const user = await db.user.update({ where: { id }, data }).catch(() => null);
    if (!user) throw httpError(404, 'Conta não encontrada.');
    return publish(user);
  }

  async function changePassword(id: string, current: string, next: string) {
    const user = await db.user.findUnique({ where: { id } });
    if (!user || !verifyPassword(current, user.passwordHash)) throw httpError(400, 'A senha atual está incorreta.');
    checkName(user.name);
    checkPassword(next);
    await db.user.update({ where: { id }, data: { passwordHash: hashPassword(next), mustChangePassword: false } });
    stepUpUntil.delete(id);
    return { ok: true };
  }

  async function sessions(id: string, currentToken: string) {
    const rows = await db.session.findMany({ where: { userId: id, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, select: { id: true, createdAt: true, expiresAt: true, tokenHash: true } });
    return rows.map((s) => ({ id: s.id, createdAt: s.createdAt, expiresAt: s.expiresAt, current: s.tokenHash === sha256(currentToken) }));
  }
  async function allSessions() {
    const rows = await db.session.findMany({ where: { expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, select: { id: true, userId: true, createdAt: true, expiresAt: true, user: { select: { name: true, username: true, email: true, role: true } } } });
    return rows.map((s) => ({ id: s.id, userId: s.userId, user: s.user, createdAt: s.createdAt, expiresAt: s.expiresAt }));
  }
  async function authEvents(id: string, limit = 50) { return db.authEvent.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(limit, 1), 200), select: { id: true, email: true, kind: true, createdAt: true } }); }

  async function revokeSession(userId: string, sessionId: string) {
    await db.session.deleteMany({ where: { id: sessionId, userId } });
    return { ok: true };
  }
  async function revokeAnySession(sessionId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) return { ok: true, revoked: false };
    const existing = await db.session.findUnique({ where: { id: sessionId }, select: { id: true } });
    if (!existing) return { ok: true, revoked: false };
    await db.session.delete({ where: { id: sessionId } });
    return { ok: true, revoked: true };
  }

  async function resetPassword(id: string, actor?: Actor, nextPassword?: string) {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) throw httpError(404, 'Conta não encontrada.');
    if (user.role === 'OWNER') {
      await assertCanManageOwner(actor, 'reset', id);
      const password = String(nextPassword ?? '');
      if (!password) throw httpError(400, OWNER_PASSWORD_REQUIRED);
      checkName(user.name);
      checkPassword(password);
      await db.$transaction(async (tx) => {
        await tx.user.update({ where: { id }, data: { passwordHash: hashPassword(password), mustChangePassword: true } });
        await tx.session.deleteMany({ where: { userId: id } });
        await audit(tx, actor as Actor, `owner.reset:${id}`);
      });
      stepUpUntil.delete(id);
      return { ok: true as const, mustChangePassword: true as const };
    }
    const temporaryPassword = newToken('stylo_pwd').slice(-16);
    await db.user.update({ where: { id }, data: { passwordHash: hashPassword(temporaryPassword), mustChangePassword: true } });
    await db.session.deleteMany({ where: { userId: id } });
    return { temporaryPassword };
  }

  async function revokeAllSessions(id: string) {
    const result = await db.session.deleteMany({ where: { userId: id } });
    return { ok: true, count: result.count };
  }

  async function deleteUser(id: string, actor?: Actor) {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) throw httpError(404, 'Conta não encontrada.');
    if (user.role === 'OWNER') {
      await assertCanManageOwner(actor, 'remove', id);
      await db.$transaction(async (tx) => {
        if (await tx.project.count({ where: { ownerId: id } })) throw httpError(409, 'Transfira os projetos desta conta antes de removê-la.');
        await audit(tx, actor as Actor, `owner.remove:${id}`);
        await tx.user.delete({ where: { id } });
      });
      stepUpUntil.delete(id);
      return { ok: true };
    }
    await db.user.delete({ where: { id } });
    return { ok: true };
  }

  async function setSuspended(id: string, suspended: boolean, actor?: Actor) {
    const current = await db.user.findUnique({ where: { id }, select: { role: true } });
    if (!current) throw httpError(404, 'Conta não encontrada.');
    if (current.role === 'OWNER') await assertCanManageOwner(actor, suspended ? 'suspend' : 'restore', id);
    const user = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: { suspended } }).catch(() => null);
      if (!updated) throw httpError(404, 'Conta não encontrada.');
      if (suspended) {
        await tx.session.deleteMany({ where: { userId: id } });
        // Invalida credenciais ativas. Reativar a conta não as devolve. O registro do agente fica.
        await tx.agent.updateMany({ where: { ownerId: id, status: 'ACTIVE' }, data: { status: 'REVOKED' } });
      }
      if (current.role === 'OWNER') await audit(tx, actor as Actor, `${suspended ? 'owner.suspend' : 'owner.restore'}:${id}`);
      return updated;
    });
    if (suspended) {
      stepUpUntil.delete(id);
      await recordAuth(id, auditLabel(user), 'user.suspend');
      options.onUserSuspended?.(id);
    } else {
      await recordAuth(id, auditLabel(user), 'user.restore');
    }
    return publish(user);
  }

  return { hasAccounts, principalId, setup, createUser, updateUser, changePassword, reconfirm, sessions, allSessions, authEvents, revokeSession, revokeAnySession, resetPassword, revokeAllSessions, deleteUser, setSuspended, login, userFromToken, logout, users };
}

export type Auth = ReturnType<typeof createAuth>;
