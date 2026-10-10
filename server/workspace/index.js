/**
 * server/workspace/index.js — OS PROJETOS ABERTOS NO SERVIDOR (o MCP trabalha aqui, sem navegador)
 *
 * Antes, quem executava as ferramentas MCP era o editor aberto numa aba. Agora o servidor mantém os projetos em
 * memória e roda o MESMO executor (src/agent/runner.js) sobre o MESMO store e os MESMOS comandos do editor. O
 * navegador passa a ser só mais um cliente do arquivo do projeto.
 *
 *   sessão MCP ──▶ workspace.call(tool) ──▶ runner.run(tool) ──▶ store ──▶ (400 ms) ──▶ projects.write(arquivo)
 *                                                                                           │
 *   editores abertos ◀── evento SSE "project" ◀──────────────────────────────────────────────┘
 *
 * - Cada projeto aberto é um `Doc` (store + comandos + executor). Vários agentes no mesmo arquivo compartilham o Doc.
 * - Cada sessão MCP tem um projeto "atual" (o que open_project/new_project escolheu).
 * - Se OUTRA pessoa gravar o arquivo (o editor, outro processo), o Doc é recarregado do disco: a gravação de fora vence,
 *   e a próxima chamada da sessão recebe um `notice` avisando.
 * - Docs sem uso e sem alterações pendentes saem da memória depois de IDLE_MS.
 */

import { createStore } from '../../src/store.js';
import { createCommands } from '../../src/commands.js';
import { createRunner } from '../../src/agent/runner.js';
import { makeDoc } from '../../src/model.js';
import { createModelCanvas } from './model-canvas.js';
import { fileNameFor } from '../projects.js';
import { exportSite } from '../../src/site-export.js';

const IDLE_MS = 10 * 60 * 1000;
const PROJECT_TOOLS = new Set(['list_projects', 'new_project', 'open_project', 'save_project', 'export_zip']);

/**
 * @param {object} deps
 * @param {ReturnType<import('../projects.js').createProjects>} deps.projects
 * @param {() => string} [deps.baseUrl]  endereço público do servidor (para os links de download)
 */
export function createWorkspace({ projects, baseUrl = () => 'http://localhost:5173' }) {
  /** arquivo → Doc */
  const docs = new Map();
  /** id da sessão MCP → arquivo atual */
  const current = new Map();

  function mount(file, doc, base) {
    const entry = { file, base, notices: [], lastUsed: Date.now() };
    const persist = async (record) => {
      const saved = await projects.write(file, JSON.stringify(record.doc), { base: entry.base, by: 'workspace' });
      entry.base = { modified: saved.modified, hash: saved.contentHash };
      return 'folder';
    };
    entry.store = createStore({ initial: { doc, views: {}, theme: 'dark', link: { file, modified: base.modified, contentHash: base.hash, synced: true } }, persist });
    const canvas = createModelCanvas(entry.store);
    entry.commands = createCommands(entry.store, canvas);
    entry.runner = createRunner({ store: entry.store, commands: entry.commands, approve: null, renderImage: null, imageEditing: false });
    docs.set(file, entry);
    return entry;
  }

  async function openDoc(file) {
    const known = docs.get(file);
    if (known) return known;
    const { doc, modified, contentHash } = await projects.load(file);
    if (!Array.isArray(doc?.pages) || !doc.pages.length) throw new Error('Arquivo inválido: não parece um projeto do Stylo.');
    return mount(file, doc, { modified, hash: contentHash });
  }

  /** O arquivo foi gravado por outro (editor, outro processo): recarrega o Doc para não trabalhar sobre uma cópia velha. */
  async function externalWrite({ file, by }) {
    if (by === 'workspace') return;
    const entry = docs.get(file);
    if (!entry) return;
    try {
      const { doc, modified, contentHash } = await projects.load(file);
      entry.base = { modified, hash: contentHash };
      entry.store.loadDoc(doc, { link: { file, modified, contentHash, synced: true } });
      entry.notices.push(`O projeto "${file}" foi alterado por outra pessoa e foi recarregado do disco. Releia com get_document antes de continuar.`);
    } catch { /* arquivo apagado ou ilegível: o próximo save mostra o erro */ }
  }

  const need = (sid) => {
    const file = current.get(sid);
    if (!file) throw new Error('Nenhum projeto aberto nesta sessão. Use list_projects e open_project, ou new_project para criar um.');
    return file;
  };

  /** Ferramentas de projeto: escolhem o arquivo atual da sessão (não passam pelo executor do documento). */
  const PROJECT = {
    async list_projects(_args, sid) {
      const list = await projects.list();
      return { open: current.get(sid) || null, projects: list.map((p) => ({ file: p.file, modified: new Date(p.modified).toISOString(), size: p.size })) };
    },
    async open_project({ file }, sid) {
      const entry = await openDoc(String(file));
      current.set(sid, entry.file);
      return { ok: true, opened: entry.file, project: entry.store.state.doc.name };
    },
    async new_project({ name } = {}, sid) {
      const file = fileNameFor(name || 'projeto');
      if (await projects.exists(file)) throw new Error(`Já existe "${file}" na pasta. Escolha outro nome ou use open_project.`);
      const doc = makeDoc();
      if (name) doc.name = String(name).slice(0, 80);
      await projects.write(file, JSON.stringify(doc), { overwrite: true, by: 'workspace' });
      const entry = await openDoc(file);
      current.set(sid, file);
      return { ok: true, file, project: doc.name };
    },
    async export_zip(_args, sid) {
      const entry = await openDoc(need(sid));
      if ((await entry.store.saveNow()) === false) throw new Error('Não consegui gravar o projeto antes de exportar.');
      const site = exportSite(entry.store.state.doc);
      const base = `${baseUrl()}/api/projects/${encodeURIComponent(entry.file)}`;
      return {
        ok: true, file: entry.file,
        site_zip_url: `${base}/site.zip`, project_json_url: base,
        files: site.files.map((f) => ({ path: f.path, bytes: Buffer.byteLength(f.content) })), warnings: site.warnings,
      };
    },
    async save_project({ name } = {}, sid) {
      const entry = await openDoc(need(sid));
      if (name) {
        const file = fileNameFor(name);
        if (file !== entry.file && await projects.exists(file)) throw new Error(`Já existe "${file}" na pasta. Escolha outro nome.`);
        const copy = JSON.parse(JSON.stringify(entry.store.state.doc));
        copy.name = String(name).slice(0, 80);
        await entry.store.saveNow();
        if (file !== entry.file) {
          await projects.write(file, JSON.stringify(copy), { overwrite: true, by: 'workspace' });
          current.set(sid, (await openDoc(file)).file);
          return { ok: true, saved: file };
        }
      }
      if ((await entry.store.saveNow()) === false) throw new Error('Não consegui gravar o projeto na pasta.');
      return { ok: true, saved: entry.file };
    },
  };

  /**
   * Executa uma ferramenta pedida por uma sessão MCP.
   * @returns {Promise<object>} o resultado do executor ({ ok, ... } ou { error }) mais `notice` quando houver aviso
   */
  async function call(tool, args, { sid, client = 'IA externa', signal } = {}) {
    try {
      if (PROJECT_TOOLS.has(tool)) return { ...(await PROJECT[tool](args || {}, sid)) };
      const entry = await openDoc(need(sid));
      entry.lastUsed = Date.now();
      const out = await entry.runner.run(tool, args, client, { external: true, admin: true, signal });
      if (entry.notices.length) out.notice = entry.notices.splice(0).join(' ');
      return out;
    } catch (err) {
      return { error: err.message || String(err) };
    }
  }

  /** Solta da memória os projetos parados e já gravados. */
  async function sweep() {
    for (const [file, entry] of docs) {
      if (Date.now() - entry.lastUsed < IDLE_MS) continue;
      if ((await entry.store.saveNow()) === false) continue;
      if ([...current.values()].includes(file)) continue;
      docs.delete(file);
    }
  }
  const timer = setInterval(() => sweep().catch(() => {}), 60 * 1000);
  timer.unref();

  return {
    call,
    externalWrite,
    endSession: (sid) => current.delete(sid),
    /** Gravação imediata de tudo que está pendente (desligar o servidor). */
    flushAll: () => Promise.all([...docs.values()].map((e) => e.store.saveNow())),
    /** Projetos abertos agora: [{ file, name, sessions }]. */
    openDocs: () => [...docs.values()].map((e) => ({ file: e.file, name: e.store.state.doc.name, sessions: [...current.values()].filter((f) => f === e.file).length })),
  };
}
