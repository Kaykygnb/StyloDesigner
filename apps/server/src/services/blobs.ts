/**
 * services/blobs.ts — ARMAZENAMENTO DE ARQUIVOS GRANDES (vídeo, 3D, áudio...), POR CONTEÚDO
 *
 * O banco guarda a ficha; os bytes ficam aqui, endereçados pelo sha256. Mesma interface para qualquer lugar:
 *   - arquivos numa pasta (uso local e servidor pequeno): `createFileBlobStore(dir)`;
 *   - memória (testes): `createMemoryBlobStore()`;
 *   - (futuro) S3/R2 no serviço hospedado, com a mesma interface.
 * Gravação atômica (arquivo temporário + rename): uma queda no meio nunca deixa um blob pela metade.
 */

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface BlobStore {
  /** Guarda os bytes (se já existem, não grava de novo) e devolve o hash e o tamanho. */
  put(bytes: Uint8Array): Promise<{ hash: string; size: number }>;
  get(hash: string): Promise<Uint8Array | null>;
  has(hash: string): Promise<boolean>;
  remove(hash: string): Promise<void>;
}

export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const HASH_RE = /^[0-9a-f]{64}$/;
const checkHash = (hash: string) => { if (!HASH_RE.test(hash)) throw new Error('Hash de blob inválido.'); return hash; };

export function createFileBlobStore(dir: string): BlobStore {
  const pathOf = (hash: string) => join(dir, checkHash(hash).slice(0, 2), hash);
  return {
    async put(bytes) {
      const hash = sha256(bytes);
      const file = pathOf(hash);
      if (await stat(file).then(() => true, () => false)) return { hash, size: bytes.length };
      await mkdir(dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(tmp, bytes);
      await rename(tmp, file);
      return { hash, size: bytes.length };
    },
    async get(hash) {
      try { return new Uint8Array(await readFile(pathOf(hash))); } catch (err: any) { if (err?.code === 'ENOENT') return null; throw err; }
    },
    has: (hash) => stat(pathOf(hash)).then(() => true, () => false),
    remove: (hash) => rm(pathOf(hash), { force: true }),
  };
}

/** O armazenamento de blobs escolhido pela configuração: pasta (padrão) ou memória (`dir === 'memory'`, testes). */
export function createBlobStore(dir: string): BlobStore {
  return dir === 'memory' || dir.startsWith('memory') ? createMemoryBlobStore() : createFileBlobStore(dir);
}

export function createMemoryBlobStore(): BlobStore & { size: () => number } {
  const map = new Map<string, Uint8Array>();
  return {
    async put(bytes) { const hash = sha256(bytes); map.set(hash, Uint8Array.from(bytes)); return { hash, size: bytes.length }; },
    async get(hash) { return map.get(checkHash(hash)) ?? null; },
    async has(hash) { return map.has(checkHash(hash)); },
    async remove(hash) { map.delete(checkHash(hash)); },
    size: () => map.size,
  };
}
