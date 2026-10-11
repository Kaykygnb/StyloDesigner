/**
 * services/assets.ts — IMAGENS FORA DO JSON DO PROJETO
 *
 * No documento (e no editor, e em todo o núcleo) as imagens continuam em `doc.assets` como data URLs. Na hora de gravar
 * no banco, cada imagem vai para a tabela `Asset` (uma vez por conteúdo, chave = sha256) e o JSON do projeto leva só
 * `"asset:<sha256>"`. Na hora de ler, a referência volta a ser data URL. Resultado:
 *   - o JSON do projeto, as versões e o histórico ficam leves;
 *   - a mesma imagem não é guardada duas vezes (nem em versões antigas);
 *   - dá para servir a imagem por endereço (`/api/projects/<arquivo>/assets/<hash>`) sem carregar o projeto.
 * Quem não é imagem reconhecível (ou não é data URL) fica como está dentro do JSON.
 */

import { createHash } from 'node:crypto';
import { parseImageDataUrl, toDataUrl } from '@stylo/core/image-size.ts';

export const REF_PREFIX = 'asset:';
/** Teto de uma imagem (depois de decodificar). */
export const MAX_ASSET_BYTES = 16 * 1024 * 1024;

export interface Blob { mime: string; bytes: Uint8Array }

/** sha256 em hexadecimal. */
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Separa as imagens do documento: devolve o documento LEVE (referências) e as imagens novas por hash. */
export function splitAssets(doc: any): { light: any; blobs: Map<string, Blob> } {
  const blobs = new Map<string, Blob>();
  const src: Record<string, unknown> = doc?.assets && typeof doc.assets === 'object' ? doc.assets : {};
  const assets: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(src)) {
    if (typeof value !== 'string' || value.startsWith(REF_PREFIX)) { assets[id] = value; continue; }
    const parsed = parseImageDataUrl(value);
    if (!parsed || parsed.bytes.length > MAX_ASSET_BYTES) { assets[id] = value; continue; }
    const hash = sha256(parsed.bytes);
    blobs.set(hash, { mime: parsed.info.mime, bytes: parsed.bytes });
    assets[id] = REF_PREFIX + hash;
  }
  return { light: { ...doc, assets }, blobs };
}

/** Hashes que o documento leve referencia. */
export function hashesOf(doc: any): Set<string> {
  const out = new Set<string>();
  for (const value of Object.values<unknown>(doc?.assets ?? {})) {
    if (typeof value === 'string' && value.startsWith(REF_PREFIX)) out.add(value.slice(REF_PREFIX.length));
  }
  return out;
}

/** Cliente do banco ou transação (o mesmo conjunto de métodos que usamos). */
type Q = { asset: any };

/** Grava as imagens que ainda não existem no projeto. */
export async function saveBlobs(q: Q, projectId: string, blobs: Map<string, Blob>) {
  if (!blobs.size) return;
  const have = new Set<string>((await q.asset.findMany({ where: { projectId, hash: { in: [...blobs.keys()] } }, select: { hash: true } })).map((a: any) => a.hash));
  const data = [...blobs].filter(([hash]) => !have.has(hash)).map(([hash, b]) => ({ projectId, hash, mime: b.mime, size: b.bytes.length, data: Buffer.from(b.bytes) }));
  if (data.length) await q.asset.createMany({ data, skipDuplicates: true });
}

/** Troca as referências por data URLs (o documento volta ao formato que o núcleo conhece). */
export async function hydrate(q: Q, projectId: string, doc: any): Promise<any> {
  const wanted = hashesOf(doc);
  if (!wanted.size) return doc;
  const rows: { hash: string; mime: string; data: Uint8Array }[] = await q.asset.findMany({ where: { projectId, hash: { in: [...wanted] } }, select: { hash: true, mime: true, data: true } });
  const byHash = new Map(rows.map((r) => [r.hash, toDataUrl(r.data, r.mime)]));
  const assets: Record<string, unknown> = {};
  for (const [id, value] of Object.entries<unknown>(doc.assets)) {
    assets[id] = typeof value === 'string' && value.startsWith(REF_PREFIX) ? byHash.get(value.slice(REF_PREFIX.length)) ?? value : value;
  }
  return { ...doc, assets };
}

/** Apaga as imagens que nem o projeto nem as versões guardadas usam mais. */
export async function collectGarbage(q: Q & { projectVersion: any }, projectId: string, current: any) {
  const keep = hashesOf(current);
  const versions: { doc: any }[] = await q.projectVersion.findMany({ where: { projectId }, select: { doc: true } });
  for (const v of versions) for (const h of hashesOf(v.doc)) keep.add(h);
  await q.asset.deleteMany({ where: { projectId, hash: { notIn: [...keep] } } });
}

/** Uma imagem pelo hash (para servir por endereço). */
export async function readAsset(q: Q, projectId: string, hash: string): Promise<{ mime: string; data: Uint8Array } | null> {
  const row = await q.asset.findUnique({ where: { projectId_hash: { projectId, hash } }, select: { mime: true, data: true } });
  return row ? { mime: row.mime, data: row.data } : null;
}
