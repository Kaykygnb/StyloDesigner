/**
 * services/library.ts — A BIBLIOTECA DE ASSETS DA CONTA
 *
 * Cada pessoa tem a sua (os agentes dela usam todos os assets dela). A ficha fica no banco (`LibraryAsset`: tipo, tamanho,
 * origem, licença, crédito); os bytes, no armazenamento de blobs, pelo sha256 (o mesmo arquivo nunca é guardado duas vezes).
 * O tipo e o MIME vêm dos BYTES (`sniffAsset`), não do que o remetente declarou. Usar um asset num projeto COPIA o
 * conteúdo para dentro dele (feito pelas ferramentas `library_use`/`add_font`).
 */

import type { Db } from '@stylo/db/client.ts';
import { MAX_BYTES, sniffAsset, type AssetKindName } from '@stylo/core/asset-kinds.ts';
import { httpError } from '../http-error.js';
import { sha256, type BlobStore } from './blobs.js';

/** Cota de armazenamento por conta (bytes). `STYLO_LIBRARY_QUOTA_MB` muda; 0 = sem limite. */
const quotaBytes = () => (Number(process.env.STYLO_LIBRARY_QUOTA_MB ?? 2048) || 0) * 1024 * 1024;

export interface LicenseInfo { name: string; url?: string; commercial: boolean; attribution: 'required' | 'optional' | 'none' }

export interface NewAsset {
  bytes: Uint8Array;
  name: string;
  /** Tipo/MIME declarados (só desempate). */
  mimeHint?: string;
  kind?: AssetKindName;
  tags?: string[];
  source?: string;
  sourceUrl?: string;
  license?: LicenseInfo | null;
  credit?: string | null;
  duration?: number;
  width?: number;
  height?: number;
}

const cleanName = (s: string) => String(s || 'asset').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 160) || 'asset';
const cleanTags = (tags: string[] = []) => [...new Set(tags.map((t) => String(t).toLowerCase().trim().slice(0, 40)).filter(Boolean))].slice(0, 20);

export function createLibrary({ db, blobs }: { db: Db; blobs: BlobStore }) {
  const view = (a: any) => ({
    id: a.id, kind: a.kind as AssetKindName, name: a.name, mime: a.mime, size: a.size, hash: a.hash, width: a.width, height: a.height, duration: a.duration,
    tags: a.tags as string[], source: a.source, sourceUrl: a.sourceUrl, license: a.license as LicenseInfo | null, credit: a.credit, capturedAt: a.capturedAt?.toISOString() ?? null, addedAt: a.createdAt.toISOString(),
  });
  type AssetView = ReturnType<typeof view>;

  /** Guarda um arquivo na biblioteca (se o mesmo conteúdo já existe, devolve o existente e atualiza etiquetas). */
  async function add(userId: string, input: NewAsset): Promise<{ asset: AssetView; existed: boolean }> {
    const sniffed = sniffAsset(input.bytes, input.mimeHint);
    const kind = sniffed.kind;
    if (input.kind && input.kind !== kind && !(input.kind === 'AUDIO' && kind === 'VIDEO')) {
      throw httpError(400, `O arquivo parece ser ${kind.toLowerCase()}, não ${input.kind.toLowerCase()}.`);
    }
    if (input.bytes.length > MAX_BYTES[kind]) throw httpError(413, `Arquivo grande demais para ${kind.toLowerCase()} (limite ${Math.round(MAX_BYTES[kind] / 1048576)} MB).`);
    const hash = sha256(input.bytes);
    const size = input.bytes.length;
    const found = await db.libraryAsset.findUnique({ where: { userId_hash: { userId, hash } } });
    if (found) {
      const tags = cleanTags([...(found.tags as string[]), ...(input.tags ?? [])]);
      const updated = await db.libraryAsset.update({ where: { id: found.id }, data: { tags } });
      return { asset: view(updated), existed: true };
    }
    const quota = quotaBytes();
    if (quota) {
      const used = await db.libraryAsset.aggregate({ where: { userId }, _sum: { size: true } });
      if ((used._sum.size ?? 0) + size > quota) throw httpError(413, `A biblioteca ultrapassaria a cota de ${Math.round(quota / 1048576)} MB. Remova algo antes.`);
    }
    await blobs.put(input.bytes);
    const row = await db.libraryAsset.create({
      data: {
        userId, kind, name: cleanName(input.name), mime: sniffed.mime, size, hash,
        width: input.width ?? sniffed.width ?? null, height: input.height ?? sniffed.height ?? null, duration: input.duration ?? null,
        tags: cleanTags(input.tags), source: input.source ?? 'upload', sourceUrl: input.sourceUrl ?? null,
        license: (input.license ?? undefined) as any, credit: input.credit ?? null, capturedAt: new Date(),
      },
    });
    return { asset: view(row), existed: false };
  }

  async function list(userId: string, { kind, query, tag, limit = 100 }: { kind?: AssetKindName; query?: string; tag?: string; limit?: number } = {}) {
    const q = query?.trim();
    const rows = await db.libraryAsset.findMany({
      where: {
        userId, ...(kind ? { kind } : {}), ...(tag ? { tags: { has: tag.toLowerCase() } } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { tags: { has: q.toLowerCase() } }] } : {}),
      },
      orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(limit, 1), 500),
    });
    return rows.map(view);
  }

  async function get(userId: string, id: string) {
    const row = await db.libraryAsset.findFirst({ where: { id, userId } });
    if (!row) throw httpError(404, 'Asset não encontrado na sua biblioteca.');
    return view(row);
  }

  /** Os bytes de um asset da biblioteca. */
  async function bytes(userId: string, id: string) {
    const asset = await get(userId, id);
    const data = await blobs.get((await db.libraryAsset.findFirstOrThrow({ where: { id, userId } })).hash);
    if (!data) throw httpError(410, 'O arquivo deste asset não está mais no armazenamento.');
    return { asset, data };
  }

  async function remove(userId: string, id: string) {
    const row = await db.libraryAsset.findFirst({ where: { id, userId } });
    if (!row) throw httpError(404, 'Asset não encontrado na sua biblioteca.');
    await db.libraryAsset.delete({ where: { id } });
    // outro dono (ou o mesmo, com outro nome) pode usar o mesmo conteúdo: só apaga o blob se ninguém mais o referencia
    if ((await db.libraryAsset.count({ where: { hash: row.hash } })) === 0) await blobs.remove(row.hash);
    return { removed: view(row) };
  }

  async function removeMany(userId: string, ids: string[]) {
    const unique = [...new Set(ids.map(String).filter(Boolean))].slice(0, 100);
    const removed: AssetView[] = [];
    for (const id of unique) removed.push((await remove(userId, id)).removed);
    return { removed, count: removed.length };
  }

  async function update(userId: string, id: string, changes: { name?: string; tags?: string[]; license?: LicenseInfo | null; credit?: string | null }) {
    const row = await db.libraryAsset.findFirst({ where: { id, userId } });
    if (!row) throw httpError(404, 'Asset não encontrado na sua biblioteca.');
    const data: any = {};
    if (changes.name !== undefined) data.name = cleanName(changes.name);
    if (changes.tags !== undefined) data.tags = cleanTags(changes.tags);
    if (changes.license !== undefined) data.license = changes.license as any;
    if (changes.credit !== undefined) data.credit = changes.credit ? String(changes.credit).trim().slice(0, 1000) : null;
    if (!Object.keys(data).length) throw httpError(400, 'Informe ao menos um campo para atualizar.');
    return view(await db.libraryAsset.update({ where: { id }, data }));
  }

  /** Troca os bytes mantendo o id do asset, portanto as camadas existentes continuam válidas. */
  async function replace(userId: string, id: string, input: Pick<NewAsset, 'bytes' | 'mimeHint' | 'name'>) {
    const current = await db.libraryAsset.findFirst({ where: { id, userId } });
    if (!current) throw httpError(404, 'Asset não encontrado na sua biblioteca.');
    const sniffed = sniffAsset(input.bytes, input.mimeHint);
    if (input.bytes.length > MAX_BYTES[sniffed.kind]) throw httpError(413, `Arquivo grande demais para ${sniffed.kind.toLowerCase()}.`);
    const hash = sha256(input.bytes);
    const duplicate = await db.libraryAsset.findFirst({ where: { userId, hash, id: { not: id } }, select: { id: true } });
    if (duplicate) throw httpError(409, 'Esse arquivo já existe na biblioteca.');
    await blobs.put(input.bytes);
    const next = await db.libraryAsset.update({ where: { id }, data: { kind: sniffed.kind, name: cleanName(input.name || current.name), mime: sniffed.mime, size: input.bytes.length, hash, width: sniffed.width ?? null, height: sniffed.height ?? null, duration: null } });
    if (current.hash !== hash && (await db.libraryAsset.count({ where: { hash: current.hash } })) === 0) await blobs.remove(current.hash);
    return view(next);
  }

  async function usage(userId: string) {
    const used = await db.libraryAsset.aggregate({ where: { userId }, _sum: { size: true }, _count: true });
    return { count: used._count, bytes: used._sum.size ?? 0, quotaBytes: quotaBytes() };
  }

  return { add, list, get, bytes, remove, removeMany, update, replace, usage };
}

export type Library = ReturnType<typeof createLibrary>;
