/**
 * services/auth.ts — PESSOAS, SENHAS E SESSÕES
 *
 * - Senha: scrypt (do próprio Node, sem dependência) com sal por usuário.
 * - Sessão: token aleatório de 256 bits; só o hash (sha256) vai para o banco. Vale 30 dias.
 * - A PRIMEIRA conta criada (`setup`) é a conta mestre (OWNER): aprova pessoas e agentes. Depois disso só o dono cria contas.
 * - Modo local (sem login): existe um usuário técnico "local" que age no lugar da pessoa; ninguém consegue entrar com ele.
 */

import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Db } from '@stylo/db/client.ts';
import { httpError } from '../http-error.js';

export const SESSION_DAYS = 30;
export const LOCAL_EMAIL = 'local@stylo.local';

export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
export const newToken = (prefix = 'stylo') => `${prefix}_${randomBytes(32).toString('base64url')}`;
const LOGIN_WINDOW_MS = 5 * 60_000;
const LOGIN_MAX_ATTEMPTS = 8;

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
export interface AccountPreferences { theme?: 'light' | 'dark' | 'system'; accent?: string; density?: 'comfortable' | 'compact'; language?: 'pt-BR' | 'en-US' | 'ru-RU' | 'ja-JP' | 'zh-CN' | 'ko-KR'; shortcuts?: Record<string, string> }
export interface PublicUser { id: string; email: string; name: string; role: UserRole; color: string | null; avatar: string | null; preferences: AccountPreferences; suspended: boolean; mustChangePassword: boolean }
const publicUser = (u: { id: string; email: string; name: string; role: UserRole; color: string | null; avatar?: string | null }): PublicUser =>
  ({ id: u.id, email: u.email, name: u.name, role: u.role, color: u.color, avatar: u.avatar ?? null, preferences: ((u as any).preferences || {}) as AccountPreferences, suspended: Boolean((u as any).suspended), mustChangePassword: Boolean((u as any).mustChangePassword) });

const checkCredentials = (email: string, name: string, password: string) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'E-mail inválido.');
  if (!name.trim()) throw httpError(400, 'Diga o nome.');
  if (password.length < 8) throw httpError(400, 'A senha precisa ter pelo menos 8 caracteres.');
};

export function createAuth(db: Db) {
  const loginAttempts = new Map<string, { count: number; since: number }>();
  const recordAuth = (userId: string | null, email: string, kind: string) => db.authEvent.create({ data: { userId, email, kind } }).catch(() => undefined);
  /** Há alguma conta de pessoa (fora o usuário técnico do modo local)? */
  const hasAccounts = async () => (await db.user.count({ where: { email: { not: LOCAL_EMAIL } } })) > 0;

  /** Cria a conta mestre. Só funciona enquanto não existe nenhuma conta. */
  async function setup(input: { email: string; name: string; password: string }): Promise<PublicUser> {
    if (await hasAccounts()) throw httpError(409, 'Já existe uma conta mestre.');
    return createUser({ ...input, role: 'OWNER' }, true);
  }

  /** Cria uma conta. Quem chama (a conta mestre) é conferido na rota. */
  async function createUser(input: { email: string; name: string; password: string; role?: UserRole }, skipDuplicateCheck = false): Promise<PublicUser> {
    const email = input.email.trim().toLowerCase();
    checkCredentials(email, input.name, input.password);
    if (!skipDuplicateCheck && (await db.user.findUnique({ where: { email } }))) throw httpError(409, 'Já existe uma conta com este e-mail.');
    const user = await db.user.create({ data: { email, name: input.name.trim().slice(0, 60), passwordHash: hashPassword(input.password), role: input.role ?? 'MEMBER', mustChangePassword: !skipDuplicateCheck } });
    return publicUser(user);
  }

  async function login(emailRaw: string, password: string): Promise<{ token: string; user: PublicUser }> {
    const email = String(emailRaw).trim().toLowerCase();
    const now = Date.now();
    const attempt = loginAttempts.get(email);
    if (attempt && now - attempt.since < LOGIN_WINDOW_MS && attempt.count >= LOGIN_MAX_ATTEMPTS) throw httpError(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
    if (attempt && now - attempt.since >= LOGIN_WINDOW_MS) loginAttempts.delete(email);
    const user = await db.user.findUnique({ where: { email } });
    // mesma resposta para "não existe" e "senha errada" (não revela quais e-mails têm conta)
    if (!user || user.suspended || !verifyPassword(String(password), user.passwordHash)) {
      const current = loginAttempts.get(email);
      loginAttempts.set(email, { count: (current?.count || 0) + 1, since: current?.since || now });
      throw httpError(401, 'E-mail ou senha incorretos.');
    }
    loginAttempts.delete(email);
    const token = newToken('stylo_ses');
    await db.session.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) } });
    await recordAuth(user.id, email, 'login');
    return { token, user: publicUser(user) };
  }

  async function userFromToken(token: string): Promise<PublicUser | null> {
    if (!token) return null;
    const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
    if (!s || s.expiresAt < new Date()) return null;
    return publicUser(s.user);
  }

  const logout = async (token: string) => { const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } }); if (session) await recordAuth(session.userId, session.user.email, 'logout'); await db.session.deleteMany({ where: { tokenHash: sha256(token) } }); };

  /** O usuário técnico do modo local: age no lugar da pessoa quando o login está desligado. */
  async function localUser(): Promise<PublicUser> {
    const existing = await db.user.findUnique({ where: { email: LOCAL_EMAIL } });
    if (existing) return publicUser(existing);
    return publicUser(await db.user.create({ data: { email: LOCAL_EMAIL, name: 'Você', passwordHash: '!', role: 'OWNER' } }));
  }

  async function users(): Promise<PublicUser[]> {
    return (await db.user.findMany({ where: { email: { not: LOCAL_EMAIL } }, orderBy: { createdAt: 'asc' } })).map(publicUser);
  }

  async function updateUser(id: string, input: { name?: string; email?: string; color?: string | null; avatar?: string | null; role?: UserRole; preferences?: AccountPreferences }): Promise<PublicUser> {
    const name = input.name?.trim();
    if (name !== undefined && !name) throw httpError(400, 'Diga o nome.');
    const email = input.email?.trim().toLowerCase();
    if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'E-mail inválido.');
    if (email && (await db.user.findFirst({ where: { email, NOT: { id } } }))) throw httpError(409, 'Já existe uma conta com este e-mail.');
    if (input.avatar !== undefined && input.avatar !== null && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.avatar) || input.avatar.length > 220_000)) throw httpError(400, 'Avatar inválido ou grande demais. Use PNG, JPEG ou WebP de até 160 KB.');
    const user = await db.user.update({ where: { id }, data: { ...(name !== undefined ? { name: name.slice(0, 60) } : {}), ...(email !== undefined ? { email } : {}), ...(input.color !== undefined ? { color: input.color?.slice(0, 32) || null } : {}), ...(input.avatar !== undefined ? { avatar: input.avatar } : {}), ...(input.role !== undefined ? { role: input.role } : {}), ...(input.preferences !== undefined ? { preferences: input.preferences as any } : {}) } }).catch(() => null);
    if (!user) throw httpError(404, 'Conta não encontrada.');
    return publicUser(user);
  }

  async function changePassword(id: string, current: string, next: string) {
    const user = await db.user.findUnique({ where: { id } });
    if (!user || !verifyPassword(current, user.passwordHash)) throw httpError(400, 'A senha atual está incorreta.');
    checkCredentials(user.email, user.name, next);
    await db.user.update({ where: { id }, data: { passwordHash: hashPassword(next), mustChangePassword: false } });
    return { ok: true };
  }

  async function sessions(id: string, currentToken: string) {
    const rows = await db.session.findMany({ where: { userId: id, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, select: { id: true, createdAt: true, expiresAt: true, tokenHash: true } });
    return rows.map((s) => ({ id: s.id, createdAt: s.createdAt, expiresAt: s.expiresAt, current: s.tokenHash === sha256(currentToken) }));
  }
  async function allSessions() {
    const rows = await db.session.findMany({ where: { expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, select: { id: true, userId: true, createdAt: true, expiresAt: true, user: { select: { name: true, email: true, role: true } } } });
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

  async function resetPassword(id: string) {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) throw httpError(404, 'Conta não encontrada.');
    const temporaryPassword = newToken('stylo_pwd').slice(-16);
    await db.user.update({ where: { id }, data: { passwordHash: hashPassword(temporaryPassword), mustChangePassword: true } });
    await db.session.deleteMany({ where: { userId: id } });
    return { temporaryPassword };
  }

  async function revokeAllSessions(id: string) {
    const result = await db.session.deleteMany({ where: { userId: id } });
    return { ok: true, count: result.count };
  }

  async function deleteUser(id: string) {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) throw httpError(404, 'Conta não encontrada.');
    if (user.role === 'OWNER') throw httpError(400, 'A conta mestre não pode ser excluída.');
    await db.user.delete({ where: { id } });
    return { ok: true };
  }

  async function setSuspended(id: string, suspended: boolean) {
    const user = await db.user.update({ where: { id }, data: { suspended } }).catch(() => null);
    if (!user) throw httpError(404, 'Conta não encontrada.');
    if (suspended) await db.session.deleteMany({ where: { userId: id } });
    return publicUser(user);
  }

  return { hasAccounts, setup, createUser, updateUser, changePassword, sessions, allSessions, authEvents, revokeSession, revokeAnySession, resetPassword, revokeAllSessions, deleteUser, setSuspended, login, userFromToken, logout, localUser, users };
}

export type Auth = ReturnType<typeof createAuth>;
