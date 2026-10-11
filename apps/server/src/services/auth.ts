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

export interface PublicUser { id: string; email: string; name: string; role: 'OWNER' | 'MEMBER'; color: string | null }
const publicUser = (u: { id: string; email: string; name: string; role: 'OWNER' | 'MEMBER'; color: string | null }): PublicUser =>
  ({ id: u.id, email: u.email, name: u.name, role: u.role, color: u.color });

const checkCredentials = (email: string, name: string, password: string) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'E-mail inválido.');
  if (!name.trim()) throw httpError(400, 'Diga o nome.');
  if (password.length < 8) throw httpError(400, 'A senha precisa ter pelo menos 8 caracteres.');
};

export function createAuth(db: Db) {
  /** Há alguma conta de pessoa (fora o usuário técnico do modo local)? */
  const hasAccounts = async () => (await db.user.count({ where: { email: { not: LOCAL_EMAIL } } })) > 0;

  /** Cria a conta mestre. Só funciona enquanto não existe nenhuma conta. */
  async function setup(input: { email: string; name: string; password: string }): Promise<PublicUser> {
    if (await hasAccounts()) throw httpError(409, 'Já existe uma conta mestre.');
    return createUser({ ...input, role: 'OWNER' }, true);
  }

  /** Cria uma conta. Quem chama (a conta mestre) é conferido na rota. */
  async function createUser(input: { email: string; name: string; password: string; role?: 'OWNER' | 'MEMBER' }, skipDuplicateCheck = false): Promise<PublicUser> {
    const email = input.email.trim().toLowerCase();
    checkCredentials(email, input.name, input.password);
    if (!skipDuplicateCheck && (await db.user.findUnique({ where: { email } }))) throw httpError(409, 'Já existe uma conta com este e-mail.');
    const user = await db.user.create({ data: { email, name: input.name.trim().slice(0, 60), passwordHash: hashPassword(input.password), role: input.role ?? 'MEMBER' } });
    return publicUser(user);
  }

  async function login(emailRaw: string, password: string): Promise<{ token: string; user: PublicUser }> {
    const user = await db.user.findUnique({ where: { email: String(emailRaw).trim().toLowerCase() } });
    // mesma resposta para "não existe" e "senha errada" (não revela quais e-mails têm conta)
    if (!user || !verifyPassword(String(password), user.passwordHash)) throw httpError(401, 'E-mail ou senha incorretos.');
    const token = newToken('stylo_ses');
    await db.session.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) } });
    return { token, user: publicUser(user) };
  }

  async function userFromToken(token: string): Promise<PublicUser | null> {
    if (!token) return null;
    const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
    if (!s || s.expiresAt < new Date()) return null;
    return publicUser(s.user);
  }

  const logout = async (token: string) => { await db.session.deleteMany({ where: { tokenHash: sha256(token) } }); };

  /** O usuário técnico do modo local: age no lugar da pessoa quando o login está desligado. */
  async function localUser(): Promise<PublicUser> {
    const existing = await db.user.findUnique({ where: { email: LOCAL_EMAIL } });
    if (existing) return publicUser(existing);
    return publicUser(await db.user.create({ data: { email: LOCAL_EMAIL, name: 'Você', passwordHash: '!', role: 'OWNER' } }));
  }

  async function users(): Promise<PublicUser[]> {
    return (await db.user.findMany({ where: { email: { not: LOCAL_EMAIL } }, orderBy: { createdAt: 'asc' } })).map(publicUser);
  }

  return { hasAccounts, setup, createUser, login, userFromToken, logout, localUser, users };
}

export type Auth = ReturnType<typeof createAuth>;
