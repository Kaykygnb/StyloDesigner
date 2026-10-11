/**
 * server/projects.js — ARQUIVOS DE PROJETO NA PASTA (listar, ler, gravar, versões, miniaturas, renomear)
 *
 * Único lugar que sabe COMO os projetos ficam no disco. Quem usa: as rotas /api/projects (o editor) e o workspace
 * (o MCP trabalhando sem navegador). Regras:
 *   - nomes passam por lista estrita e terminam em .json (não dá para escapar da pasta);
 *   - gravar é atômico (arquivo temporário + rename) e serializado por projeto;
 *   - antes de sobrescrever, guarda a versão anterior (no máximo 1 a cada 10 min) e mantém `keepVersions`;
 *   - detecta alteração feita por fora (data + hash) e recusa com 409 em vez de apagar trabalho alheio.
 */

import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { httpError } from './http-error.js';

/** Nome de arquivo aceito: começa com letra/número, só usa letras, números, ponto, - e _, e termina em .json. */
export const FILE_RE = /^[a-z0-9][a-z0-9._-]{0,90}\.json$/i;
/** Nomes que o Windows trata como dispositivo (con.json, nul.json, com1.json...). */
const RESERVED_RE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i;
/** Intervalo mínimo entre duas versões guardadas do mesmo projeto. */
const VERSION_EVERY_MS = 10 * 60 * 1000;
export const MAX_THUMB = 3 * 1024 * 1024;

/** Hash curto do conteúdo de um arquivo de projeto. */
export const hashOf = (data) => createHash('sha1').update(data).digest('hex');

/** Valida o nome de um arquivo de projeto. */
export function checkName(name) {
  if (!FILE_RE.test(name) || name.includes('..') || RESERVED_RE.test(name)) throw httpError(400, 'Nome de arquivo inválido.');
  return name;
}

/** Nome de arquivo a partir de um título livre ("Meu Site!" → "meu-site.json"). */
export function fileNameFor(title) {
  const base = String(title || '').replace(/\.json$/i, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'projeto';
  return `${base}.json`;
}

/**
 * @param {object} deps
 * @param {() => { folder: string, keepVersions: number }} deps.getConfig  configuração atual (a pasta pode mudar)
 * @param {(event: { file: string, modified: number, contentHash: string, by?: string }) => void} [deps.onWrite]
 *        chamado depois de cada gravação (o servidor avisa os editores abertos)
 */
export function createProjects({ getConfig, onWrite = () => {} }) {
  /** Conteúdo de cada projeto que o servidor leu/gravou por último, para achar alteração feita por fora. */
  const knownContent = new Map();
  const queues = new Map();

  const folder = () => getConfig().folder;
  const pathOf = (name) => join(folder(), name);
  const versionsDir = (name) => join(folder(), '.versoes', name.replace(/\.json$/i, ''));
  const thumbPath = (name) => join(folder(), '.miniaturas', name.replace(/\.json$/i, '.svg'));

  /** Serializa comparação de revisão + gravação por arquivo, sem bloquear projetos independentes. */
  async function withWrite(name, task) {
    const previous = queues.get(name) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    queues.set(name, current);
    await previous;
    try { return await task(); } finally {
      release();
      if (queues.get(name) === current) queues.delete(name);
    }
  }

  async function list() {
    await mkdir(folder(), { recursive: true });
    const names = (await readdir(folder())).filter((f) => FILE_RE.test(f));
    const items = await Promise.all(names.map(async (file) => {
      const s = await stat(pathOf(file));
      if (!s.isFile()) return null;
      const thumb = await stat(thumbPath(file)).then((t) => t.mtimeMs, () => 0);
      return { file, modified: s.mtimeMs, size: s.size, thumb };
    }));
    return items.filter(Boolean).sort((a, b) => b.modified - a.modified);
  }

  /** Lê o arquivo cru e registra o que foi lido (a base da detecção de conflito). */
  async function read(name) {
    checkName(name);
    const [data, s] = await Promise.all([readFile(pathOf(name)), stat(pathOf(name))]);
    const contentHash = hashOf(data);
    // só registra se a data mudou: com a MESMA data, o registro do último salvamento daqui é que vale
    const prev = knownContent.get(name);
    if (!prev || Math.abs(prev.mtime - s.mtimeMs) > 1) knownContent.set(name, { mtime: s.mtimeMs, hash: contentHash });
    return { data, modified: s.mtimeMs, contentHash };
  }

  /** Lê e interpreta o projeto. */
  async function load(name) {
    const { data, modified, contentHash } = await read(name);
    return { doc: JSON.parse(data.toString('utf8')), modified, contentHash };
  }

  /**
   * Grava o projeto. `base` = o que o chamador leu por último ({ modified, hash }); se o arquivo mudou desde então,
   * lança 409 (a não ser com `overwrite`). Em discos FAT a data é grosseira, por isso o hash também conta.
   */
  function write(name, text, { base = {}, overwrite = false, by = '' } = {}) {
    checkName(name);
    return withWrite(name, async () => {
      const cur = await stat(pathOf(name)).catch(() => null);
      const baseModified = Number(base.modified);
      const baseHash = String(base.hash || '');
      const known = knownContent.get(name);
      const sameDate = !!baseModified && Math.abs(cur?.mtimeMs - baseModified) <= 1;
      const diskText = cur ? await readFile(pathOf(name)) : null;
      const diskHash = diskText === null ? '' : hashOf(diskText);
      const changedInside = cur && sameDate && known && Math.abs(known.mtime - baseModified) <= 1 && known.hash !== diskHash;
      const staleHash = cur && baseHash && baseHash !== diskHash;
      if (cur && !overwrite && (staleHash || (!baseHash && (!sameDate || changedInside)))) {
        if (changedInside || staleHash) knownContent.set(name, { mtime: cur.mtimeMs, hash: diskHash });
        throw httpError(409, 'O arquivo foi alterado fora deste editor.', { body: { modified: cur.mtimeMs, contentHash: diskHash } });
      }
      await mkdir(folder(), { recursive: true });
      await snapshot(name);
      const tmp = pathOf(`.${name}.${process.pid}.${randomUUID()}.tmp`);
      await writeFile(tmp, text);
      await rename(tmp, pathOf(name));
      const modified = (await stat(pathOf(name))).mtimeMs;
      const contentHash = hashOf(text);
      knownContent.set(name, { mtime: modified, hash: contentHash });
      onWrite({ file: name, modified, contentHash, by });
      return { file: name, modified, contentHash };
    });
  }

  async function versions(name) {
    try {
      const files = (await readdir(versionsDir(name))).filter((f) => FILE_RE.test(f)).sort().reverse();
      return await Promise.all(files.map(async (f) => {
        const s = await stat(join(versionsDir(name), f));
        return { id: f, modified: s.mtimeMs, size: s.size };
      }));
    } catch { return []; }
  }

  async function readVersion(name, id) {
    return readFile(join(versionsDir(name), checkName(id)));
  }

  /** Guarda o conteúdo ANTERIOR como versão (no máximo 1 a cada 10 min) e apaga as mais antigas além de keepVersions. */
  async function snapshot(name) {
    const keep = getConfig().keepVersions;
    if (!keep) return;
    let current;
    try { current = await readFile(pathOf(name)); } catch { return; }
    const all = await versions(name);
    if (all[0] && Date.now() - all[0].modified < VERSION_EVERY_MS) return;
    await mkdir(versionsDir(name), { recursive: true });
    const id = new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, '') + '.json';
    await writeFile(join(versionsDir(name), id), current);
    for (const old of (await versions(name)).slice(keep)) await rm(join(versionsDir(name), old.id), { force: true });
  }

  const readThumb = (name) => readFile(thumbPath(checkName(name)));
  async function writeThumb(name, svg) {
    checkName(name);
    if (typeof svg !== 'string' || !svg.trimStart().startsWith('<svg')) throw httpError(400, 'Miniatura inválida.');
    if (svg.length > MAX_THUMB) throw httpError(413, 'Miniatura grande demais.');
    await stat(pathOf(name)); // só aceita miniatura de projeto que existe (senão: 404)
    await mkdir(join(folder(), '.miniaturas'), { recursive: true });
    await writeFile(thumbPath(name), svg);
  }

  /** Renomeia (leva junto versões e miniatura); 409 se o nome já existe. */
  async function renameProject(name, to) {
    checkName(name);
    const target = checkName(String(to || ''));
    if (target === name) return { file: name };
    await stat(pathOf(name));
    if (await stat(pathOf(target)).catch(() => null)) throw httpError(409, `Já existe "${target}" na pasta.`);
    await rename(pathOf(name), pathOf(target));
    await rename(versionsDir(name), versionsDir(target)).catch(() => {});
    await rename(thumbPath(name), thumbPath(target)).catch(() => {});
    return { file: target, modified: (await stat(pathOf(target))).mtimeMs };
  }

  const exists = (name) => stat(pathOf(checkName(name))).then(() => true, () => false);

  return { list, read, load, write, exists, versions, readVersion, readThumb, writeThumb, rename: renameProject, pathOf };
}
