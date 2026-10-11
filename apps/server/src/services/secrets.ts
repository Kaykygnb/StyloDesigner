/**
 * services/secrets.ts — CHAVES DE API DOS PROVEDORES, POR CONTA, CRIPTOGRAFADAS
 *
 * Cada pessoa traz as próprias chaves (Pexels, Pixabay...). No banco fica só o texto cifrado (AES-256-GCM); a chave de
 * cifragem é do SERVIDOR: variável STYLO_SECRET_KEY (32 bytes em base64) ou, sem ela, um arquivo `*.secret` ao lado da
 * configuração, criado na primeira vez com permissão só do dono. Quem tem o banco mas não tem essa chave não lê nada.
 * A chave nunca volta por API nem por MCP: só `has` (existe ou não).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Db } from '@stylo/db/client.ts';

/** Chave de 32 bytes: da variável de ambiente, do arquivo, ou criada agora. */
export async function loadSecretKey(file: string): Promise<Buffer> {
  const fromEnv = process.env.STYLO_SECRET_KEY;
  if (fromEnv) {
    const key = Buffer.from(fromEnv, 'base64');
    if (key.length !== 32) throw new Error('STYLO_SECRET_KEY precisa ter 32 bytes em base64 (ex.: openssl rand -base64 32).');
    return key;
  }
  try {
    const key = Buffer.from((await readFile(file, 'utf8')).trim(), 'base64');
    if (key.length === 32) return key;
  } catch { /* ainda não existe */ }
  const key = randomBytes(32);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, key.toString('base64'), { mode: 0o600 });
  await chmod(file, 0o600).catch(() => {}); // no Windows o chmod é ignorado
  return key;
}

export const encrypt = (plain: string, key: Buffer): string => {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [nonce, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
};

export const decrypt = (secret: string, key: Buffer): string => {
  const [nonce, tag, data] = secret.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
};

export function createSecrets(db: Db, key: Buffer) {
  return {
    async set(userId: string, providerId: string, value: string) {
      const secret = encrypt(String(value).trim().slice(0, 500), key);
      await db.providerSecret.upsert({ where: { userId_providerId: { userId, providerId } }, create: { userId, providerId, secret }, update: { secret } });
    },
    /** O texto da chave (só para uso interno do servidor, nunca devolver a cliente). */
    async get(userId: string, providerId: string): Promise<string | null> {
      const row = await db.providerSecret.findUnique({ where: { userId_providerId: { userId, providerId } } });
      if (!row) return null;
      try { return decrypt(row.secret, key); } catch { return null; } // chave do servidor trocada: trata como "sem chave"
    },
    async has(userId: string, providerId: string) { return !!(await db.providerSecret.findUnique({ where: { userId_providerId: { userId, providerId } }, select: { providerId: true } })); },
    async remove(userId: string, providerId: string) { await db.providerSecret.deleteMany({ where: { userId, providerId } }); },
  };
}

export type Secrets = ReturnType<typeof createSecrets>;
