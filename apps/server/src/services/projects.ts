/**
 * services/projects.ts — PROJETOS NO BANCO (listar, ler, gravar, versões, miniatura, renomear)
 *
 * Os projetos moram no banco (SQLite), não em arquivos. Quem pode o quê:
 *   - o DONO do projeto lê e grava; membros EDITOR gravam; VIEWER só lê;
 *   - `slug` é o nome do projeto ("meu-site"), único por dono; a API e o editor chamam de `file`. Um ".json" no fim,
 *     herança do tempo em que eram arquivos, ainda é aceito na entrada e é descartado.
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

/** Nome aceito: começa com letra/número e só usa letras, números, ponto, - e _. */
export const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,90}$/i;
/** Nomes que o Windows trata como dispositivo (con, nul, com1...), com ou sem extensão. */
const RESERVED_RE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i;

/** Valida o nome e devolve o nome canônico (sem o ".json" da época dos arquivos). */
export function checkName(name: string): string {
  const base = String(name ?? '').replace(/\.json$/i, '');
  if (!NAME_RE.test(base) || base.includes('..') || base.endsWith('.') || /\.json$/i.test(base) || RESERVED_RE.test(base)) throw httpError(400, 'Nome de projeto inválido.');
  return base;
}

/** Nome do projeto a partir de um título livre ("Meu Site!" → "meu-site"). */
export function fileNameFor(title: string): string {
  return String(title || '').replace(/\.json$/i, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'projeto';
}

export interface Person { id: string }
export interface ProjectSummary { file: string; name: string; modified: number; size: number; thumb: number }
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
  async function find(user: Person, rawSlug: string, write = false) {
    const slug = checkName(rawSlug);
    const found = await db.project.findMany({
      where: { slug, OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
      include: { members: { where: { userId: user.id } } },
    });
    const own = found.find((p) => p.ownerId === user.id);
    const project = own ?? found[0];
    if (!project) return null;
    if (write && !own && (project.members[0]?.role === 'VIEWER' || project.members[0]?.role === 'COMMENTER')) throw httpError(403, 'Você só pode ler ou comentar este projeto.');
    return project;
  }
  const need = async (user: Person, slug: string, write = false) => {
    const project = await find(user, slug, write);
    if (!project) throw httpError(404, 'Projeto não encontrado.');
    return project;
  };

  /** Permissão atual por ID: não hidrata documento/assets nem resolve slugs ambíguos. */
  async function access(user: Person, projectId: string) {
    const p = await db.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, members: { where: { userId: user.id }, select: { role: true } } },
    });
    const role = p?.ownerId === user.id ? 'OWNER' : p?.members[0]?.role;
    if (!role) throw httpError(404, 'Projeto não encontrado.');
    return role;
  }

  async function list(user: Person): Promise<ProjectSummary[]> {
    const rows = await db.project.findMany({
      where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
      select: { slug: true, name: true, updatedAt: true, size: true, thumb: true },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((p) => ({ file: p.slug, name: p.name, modified: p.updatedAt.getTime(), size: p.size, thumb: p.thumb ? p.updatedAt.getTime() : 0 }));
  }

  async function load(user: Person, slug: string) {
    const p = await need(user, slug);
    const role = p.ownerId === user.id ? 'OWNER' : p.members[0]?.role ?? 'VIEWER';
    const doc = await hydrate(db, p.id, p.doc);
    return { id: p.id, file: p.slug, ownerId: p.ownerId, role, doc, modified: p.updatedAt.getTime(), contentHash: hashOf(p.revision), revision: p.revision, name: p.name };
  }

  const exists = async (user: Person, slug: string) => !!(await find(user, slug));

  /**
   * Grava o projeto (cria se não existir). `base.hash` = o que o chamador leu por último; diferente do atual → 409.
   * Sem `base.hash` num projeto que já existe também é 409, a não ser com `overwrite`.
   */
  async function write(user: Person, rawSlug: string, doc: any, { base = {}, overwrite = false, by = '', size }: {
    base?: { hash?: string }; overwrite?: boolean; by?: string; size?: number;
  } = {}): Promise<WriteResult> {
    const slug = checkName(rawSlug);
    if (!Array.isArray(doc?.pages)) throw httpError(400, 'Isso não parece um projeto (faltam as páginas).');
    const text = JSON.stringify(doc);
    const bytes = size ?? text.length;
    const docHash = createHash('sha1').update(text).digest('hex');
    const name = String(doc.name || slug).slice(0, 120);
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
      if (cur.ownerId !== user.id && (cur.members[0]?.role === 'VIEWER' || cur.members[0]?.role === 'COMMENTER')) throw httpError(403, 'Você só pode ler ou comentar este projeto.');
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
    const rows = await db.projectVersion.findMany({ where: { projectId: p.id }, orderBy: { createdAt: 'desc' }, select: { id: true, createdAt: true, size: true, label: true, revision: true } });
    return rows.map((v) => ({ id: v.id, modified: v.createdAt.getTime(), size: v.size, label: v.label, revision: v.revision }));
  }

  /** Guarda explicitamente o estado atual como uma versão nomeada (por exemplo, uma publicação). */
  async function snapshot(user: Person, slug: string, label: string | null = null) {
    const p = await need(user, slug, true);
    const keep = getConfig().keepVersions;
    if (keep <= 0) return { id: null, label: null };
    const value = label == null || !String(label).trim() ? null : String(label).trim().slice(0, 120);
    const created = await db.$transaction(async (tx) => {
      const row = await tx.projectVersion.create({ data: { projectId: p.id, revision: p.revision, doc: p.doc as any, size: p.size, label: value } });
      const old = await tx.projectVersion.findMany({ where: { projectId: p.id }, orderBy: { createdAt: 'desc' }, skip: keep, select: { id: true } });
      if (old.length) await tx.projectVersion.deleteMany({ where: { id: { in: old.map((v) => v.id) } } });
      return row;
    });
    return { id: created.id, label: created.label, revision: created.revision };
  }

  async function labelVersion(user: Person, slug: string, id: string, label: string | null) {
    const p = await need(user, slug, true);
    const value = label == null || !String(label).trim() ? null : String(label).trim().slice(0, 120);
    const found = await db.projectVersion.updateMany({ where: { id, projectId: p.id }, data: { label: value } });
    if (!found.count) throw httpError(404, 'Versão não encontrada.');
    return { id, label: value };
  }

  async function compareVersions(user: Person, slug: string, leftId: string, rightId: string) {
    const p = await need(user, slug);
    const rows = await db.projectVersion.findMany({ where: { projectId: p.id, id: { in: [leftId, rightId] } }, select: { id: true, doc: true, size: true, createdAt: true, label: true, revision: true } });
    const left = rows.find((v) => v.id === leftId), right = rows.find((v) => v.id === rightId);
    if (!left || !right) throw httpError(404, 'As duas versões precisam pertencer a este projeto.');
    const a = left.doc as any, b = right.doc as any;
    const keys = [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])];
    return { left: { id: left.id, label: left.label, revision: left.revision, modified: left.createdAt.getTime(), size: left.size }, right: { id: right.id, label: right.label, revision: right.revision, modified: right.createdAt.getTime(), size: right.size }, changed: keys.filter((k) => JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])), same: JSON.stringify(a) === JSON.stringify(b) };
  }

  async function duplicateVersion(user: Person, slug: string, id: string, title: string) {
    const p = await need(user, slug);
    const v = await db.projectVersion.findFirst({ where: { id, projectId: p.id } });
    if (!v) throw httpError(404, 'Versão não encontrada.');
    const base = fileNameFor(title || v.label || `${p.name}-copia`);
    let target = base, n = 2;
    while (await exists(user, target)) target = fileNameFor(`${base}-${n++}`);
    const out = await write(user, target, v.doc, { overwrite: false, by: `duplicate:${id}` });
    return { file: out.file, projectId: out.projectId, sourceVersion: id };
  }

  async function readVersion(user: Person, slug: string, id: string) {
    const p = await need(user, slug);
    const v = await db.projectVersion.findFirst({ where: { id, projectId: p.id } });
    if (!v) throw httpError(404, 'Versão não encontrada.');
    return hydrate(db, p.id, v.doc);
  }

  async function restoreVersion(user: Person, slug: string, id: string) {
    const doc = await readVersion(user, slug, id);
    return write(user, slug, doc, { overwrite: true, by: `restore:${id}` });
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
    if (target === p.slug) return { file: p.slug };
    if (p.ownerId !== user.id) throw httpError(403, 'Só o dono renomeia o projeto.');
    if (await db.project.findUnique({ where: { ownerId_slug: { ownerId: user.id, slug: target } } })) throw httpError(409, `Já existe "${target}".`);
    const updated = await db.project.update({ where: { id: p.id }, data: { slug: target } });
    return { file: target, modified: updated.updatedAt.getTime() };
  }

  return { access, list, load, exists, write, asset, versions, snapshot, labelVersion, compareVersions, duplicateVersion, readVersion, restoreVersion, readThumb, writeThumb, rename };
}

export type Projects = ReturnType<typeof createProjects>;
