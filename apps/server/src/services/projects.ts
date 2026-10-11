/**
 * services/projects.ts — PROJETOS NO BANCO (listar, ler, gravar, versões, miniatura, renomear)
 *
 * Substitui a pasta de arquivos .json. Quem pode o quê:
 *   - o DONO do projeto lê e grava; membros EDITOR gravam; VIEWER só lê;
 *   - `slug` é o "nome do arquivo" ("meu-site.json"), único por dono; o editor continua chamando de `file`.
 * Concorrência: cada gravação sobe `revision`. O chamador diz de qual revisão partiu (`baseHash` = "r<revisão>");
 * se o projeto já avançou, a gravação é recusada com 409 em vez de apagar o trabalho de outro autor.
 * Antes de sobrescrever, a versão anterior vira ProjectVersion (no máximo 1 a cada 10 min, `keepVersions` no total).
 */

import { createHash } from 'node:crypto';
import type { Db } from '@stylo/db/client.ts';
import { httpError } from '../http-error.js';
import { collectGarbage, hashesOf, hydrate, readAsset, saveBlobs, splitAssets } from './assets.js';

const VERSION_EVERY_MS = 10 * 60 * 1000;
export const MAX_THUMB = 3 * 1024 * 1024;

/** Nome de arquivo aceito: começa com letra/número, só usa letras, números, ponto, - e _, e termina em .json. */
export const FILE_RE = /^[a-z0-9][a-z0-9._-]{0,90}\.json$/i;
/** Nomes que o Windows trata como dispositivo (con.json, nul.json, com1.json...). */
const RESERVED_RE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i;

export function checkName(name: string): string {
  if (!FILE_RE.test(name) || name.includes('..') || RESERVED_RE.test(name)) throw httpError(400, 'Nome de arquivo inválido.');
  return name;
}

/** Nome de arquivo a partir de um título livre ("Meu Site!" → "meu-site.json"). */
export function fileNameFor(title: string): string {
  const base = String(title || '').replace(/\.json$/i, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'projeto';
  return `${base}.json`;
}

export interface Person { id: string }
export interface ProjectSummary { file: string; modified: number; size: number; thumb: number }
export interface WriteResult { projectId: string; file: string; modified: number; contentHash: string; revision: number }
export interface WriteEvent extends WriteResult { by: string }

const hashOf = (revision: number) => `r${revision}`;

export function createProjects({ db, getConfig, onWrite = () => {}, versionEveryMs = VERSION_EVERY_MS }: {
  db: Db;
  getConfig: () => { keepVersions: number };
  onWrite?: (event: WriteEvent) => void;
  /** Intervalo mínimo entre duas versões guardadas (padrão 10 min; os testes encurtam). */
  versionEveryMs?: number;
}) {
  /** Projeto pelo nome, entre os que a pessoa pode ver (os próprios primeiro). `write` exige poder editar. */
  async function find(user: Person, slug: string, write = false) {
    checkName(slug);
    const found = await db.project.findMany({
      where: { slug, OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
      include: { members: { where: { userId: user.id } } },
    });
    const own = found.find((p) => p.ownerId === user.id);
    const project = own ?? found[0];
    if (!project) return null;
    if (write && !own && project.members[0]?.role === 'VIEWER') throw httpError(403, 'Você só pode ler este projeto.');
    return project;
  }
  const need = async (user: Person, slug: string, write = false) => {
    const project = await find(user, slug, write);
    if (!project) throw httpError(404, 'Projeto não encontrado.');
    return project;
  };

  async function list(user: Person): Promise<ProjectSummary[]> {
    const rows = await db.project.findMany({
      where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
      select: { slug: true, updatedAt: true, size: true, thumb: true },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((p) => ({ file: p.slug, modified: p.updatedAt.getTime(), size: p.size, thumb: p.thumb ? p.updatedAt.getTime() : 0 }));
  }

  async function load(user: Person, slug: string) {
    const p = await need(user, slug);
    const role = p.ownerId === user.id ? 'OWNER' : p.members[0]?.role ?? 'VIEWER';
    const doc = await hydrate(db, p.id, p.doc);
    return { id: p.id, ownerId: p.ownerId, role, doc, modified: p.updatedAt.getTime(), contentHash: hashOf(p.revision), revision: p.revision, name: p.name };
  }

  const exists = async (user: Person, slug: string) => !!(await find(user, slug));

  /**
   * Grava o projeto (cria se não existir). `base.hash` = o que o chamador leu por último; diferente do atual → 409.
   * Sem `base.hash` num projeto que já existe também é 409, a não ser com `overwrite`.
   */
  async function write(user: Person, slug: string, doc: any, { base = {}, overwrite = false, by = '', size }: {
    base?: { hash?: string }; overwrite?: boolean; by?: string; size?: number;
  } = {}): Promise<WriteResult> {
    checkName(slug);
    if (!Array.isArray(doc?.pages)) throw httpError(400, 'Isso não parece um projeto (faltam as páginas).');
    const text = JSON.stringify(doc);
    const bytes = size ?? text.length;
    const docHash = createHash('sha1').update(text).digest('hex');
    const name = String(doc.name || slug.replace(/\.json$/i, '')).slice(0, 120);
    const keep = getConfig().keepVersions;
    // as imagens vão para a tabela Asset; o JSON do projeto leva só as referências
    const { light, blobs } = splitAssets(doc);
    const result = await db.$transaction(async (tx) => {
      const found = await tx.project.findMany({ where: { slug, OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] }, include: { members: { where: { userId: user.id } } } });
      const cur = found.find((p) => p.ownerId === user.id) ?? found[0];
      if (!cur) {
        const created = await tx.project.create({ data: { slug, name, ownerId: user.id, doc: light, size: bytes, docHash, revision: 1 } });
        await saveBlobs(tx, created.id, blobs);
        return { project: created, changed: true };
      }
      if (cur.ownerId !== user.id && cur.members[0]?.role === 'VIEWER') throw httpError(403, 'Você só pode ler este projeto.');
      // mesmo conteúdo que já está salvo (e a base confere): nada a gravar, sem revisão nem versão nova
      if (cur.docHash === docHash && (overwrite || base.hash === hashOf(cur.revision))) return { project: cur, changed: false };
      if (!overwrite && base.hash !== hashOf(cur.revision)) {
        throw httpError(409, 'O projeto foi alterado por outra pessoa ou agente.', { body: { modified: cur.updatedAt.getTime(), contentHash: hashOf(cur.revision) } });
      }
      // versão anterior (no máximo 1 a cada 10 min)
      let prunedVersions = false;
      if (keep > 0) {
        const last = await tx.projectVersion.findFirst({ where: { projectId: cur.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
        if (!last || Date.now() - last.createdAt.getTime() >= versionEveryMs) {
          await tx.projectVersion.create({ data: { projectId: cur.id, revision: cur.revision, doc: cur.doc as any, size: cur.size } });
          const old = await tx.projectVersion.findMany({ where: { projectId: cur.id }, orderBy: { createdAt: 'desc' }, skip: keep, select: { id: true } });
          if (old.length) { await tx.projectVersion.deleteMany({ where: { id: { in: old.map((v) => v.id) } } }); prunedVersions = true; }
        }
      }
      // otimista: se alguém gravou entre a leitura e aqui, `count` é 0
      await saveBlobs(tx, cur.id, blobs);
      const done = await tx.project.updateMany({ where: { id: cur.id, revision: cur.revision }, data: { doc: light, name, size: bytes, docHash, revision: cur.revision + 1 } });
      if (done.count === 0) throw httpError(409, 'O projeto foi alterado por outra pessoa ou agente.', { body: { contentHash: hashOf(cur.revision + 1) } });
      // alguma imagem deixou de ser usada (no documento ou por uma versão que saiu)? limpa; as das versões guardadas ficam
      const before = hashesOf(cur.doc), after = hashesOf(light);
      if (prunedVersions || [...before].some((h) => !after.has(h))) await collectGarbage(tx, cur.id, light);
      return { project: await tx.project.findUniqueOrThrow({ where: { id: cur.id } }), changed: true };
    });
    const p = result.project;
    const out: WriteResult = { projectId: p.id, file: slug, modified: p.updatedAt.getTime(), contentHash: hashOf(p.revision), revision: p.revision };
    if (result.changed) onWrite({ ...out, by });
    return out;
  }

  async function versions(user: Person, slug: string) {
    const p = await need(user, slug);
    const rows = await db.projectVersion.findMany({ where: { projectId: p.id }, orderBy: { createdAt: 'desc' }, select: { id: true, createdAt: true, size: true } });
    return rows.map((v) => ({ id: v.id, modified: v.createdAt.getTime(), size: v.size }));
  }

  async function readVersion(user: Person, slug: string, id: string) {
    const p = await need(user, slug);
    const v = await db.projectVersion.findFirst({ where: { id, projectId: p.id } });
    if (!v) throw httpError(404, 'Versão não encontrada.');
    return hydrate(db, p.id, v.doc);
  }

  /** Uma imagem do projeto pelo hash (a pessoa precisa poder ler o projeto). */
  async function asset(user: Person, slug: string, hash: string) {
    const p = await need(user, slug);
    const found = await readAsset(db, p.id, hash);
    if (!found) throw httpError(404, 'Imagem não encontrada.');
    return found;
  }

  async function readThumb(user: Person, slug: string): Promise<string> {
    const p = await need(user, slug);
    if (!p.thumb) throw httpError(404, 'Sem miniatura.');
    return p.thumb;
  }

  async function writeThumb(user: Person, slug: string, svg: unknown) {
    const p = await need(user, slug, true);
    if (typeof svg !== 'string' || !svg.trimStart().startsWith('<svg')) throw httpError(400, 'Miniatura inválida.');
    if (svg.length > MAX_THUMB) throw httpError(413, 'Miniatura grande demais.');
    await db.project.update({ where: { id: p.id }, data: { thumb: svg }, select: { id: true } });
  }

  /** Renomeia o arquivo do projeto (só o dono); 409 se o nome já existe. */
  async function rename(user: Person, slug: string, to: string) {
    const p = await need(user, slug, true);
    const target = checkName(String(to || ''));
    if (target === slug) return { file: slug };
    if (p.ownerId !== user.id) throw httpError(403, 'Só o dono renomeia o projeto.');
    if (await db.project.findUnique({ where: { ownerId_slug: { ownerId: user.id, slug: target } } })) throw httpError(409, `Já existe "${target}".`);
    const updated = await db.project.update({ where: { id: p.id }, data: { slug: target } });
    return { file: target, modified: updated.updatedAt.getTime() };
  }

  return { list, load, exists, write, asset, versions, readVersion, readThumb, writeThumb, rename };
}

export type Projects = ReturnType<typeof createProjects>;
