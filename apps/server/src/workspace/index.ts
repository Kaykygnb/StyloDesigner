/**
 * workspace/index.ts — OS PROJETOS ABERTOS NO SERVIDOR (o MCP trabalha aqui, sem navegador)
 *
 *   sessão MCP ──▶ workspace.call(tool, actor) ──▶ runner.run(tool) ──▶ store ──(400 ms)──▶ projects.write (banco)
 *                                    │                                                          │
 *                                    └─▶ onOperation (log de quem fez o quê)                     └─▶ editores abertos (SSE "project")
 *
 * - Cada projeto aberto é um `Doc` (store + comandos + executor). Vários agentes no mesmo projeto compartilham o Doc.
 * - Cada sessão MCP tem um projeto "atual" e um PAPEL nele (dono, editor ou leitor). Ferramentas de escrita exigem
 *   editor e o escopo "write" do agente.
 * - Se OUTRO autor gravar o projeto (o editor, outra instância), o Doc é recarregado do banco: a gravação de fora
 *   vence, e a próxima chamada da sessão recebe um `notice`.
 * - Docs sem uso e já gravados saem da memória depois de IDLE_MS.
 */

import { createStore } from '@stylo/core/store.js';
import { createCommands } from '@stylo/core/commands.js';
import { createRunner } from '@stylo/core/tools/runner.ts';
import type { ImageOperations } from '@stylo/core/image-edit.ts';
import { toolByName, validateToolArgs } from '@stylo/core/tools/schema.js';
import type { Plugins } from '../plugins.js';
import { makeDoc } from '@stylo/core/model.js';
import { exportSite } from '@stylo/core/site-export.js';
import { exportReact } from '@stylo/core/export-react.ts';
import { vendorFiles } from '../services/vendor.ts';
import { applyMeasured, rootsOf } from './measure.ts';
import { createModelCanvas } from './model-canvas.js';
import { fileNameFor, type Projects, type WriteEvent } from '../services/projects.js';
import type { Notes } from '../services/notes.js';
import type { Sharing } from '../services/sharing.js';
import type { Operations } from '../services/operations.js';

const IDLE_MS = 10 * 60 * 1000;
const PROJECT_TOOLS = new Set(['list_projects', 'new_project', 'open_project', 'save_project', 'export_zip', 'add_note', 'list_notes', 'resolve_note', 'get_activity', 'who_is_here', 'list_members', 'share_project', 'unshare_project']);

/** Quem está pedindo: uma pessoa ou um agente. `userId` é a conta com a qual se acessa o banco. */
export interface Actor {
  type: 'USER' | 'AGENT' | 'SYSTEM';
  userId: string;
  agentId?: string;
  name: string;
  /** Escopos do agente (read/write/export). Pessoas têm todos. */
  scopes?: string[];
}

export interface OperationRecord {
  projectId: string;
  actor: Actor;
  tool: string;
  args: unknown;
  summary: string | null;
  layerIds: string[];
  ok: boolean;
}

interface Doc {
  id: string;
  file: string;
  ownerId: string;
  base: { hash: string };
  notices: string[];
  lastUsed: number;
  store: any;
  commands: any;
  runner: any;
  /** O desenho mudou desde a última medida de layout (altura "hug", "fill"...). */
  dirty: boolean;
  measuring: Promise<void> | null;
}

export function createWorkspace({ projects, notes, sharing, operations, plugins = null, renderImage = null, measureLayout = null, auditLayout = null, fetchImage = null, imageOps = null, presence = () => ({}), baseUrl = () => 'http://localhost:5173', onOperation = () => {} }: {
  projects: Projects;
  notes: Notes;
  sharing: Sharing;
  operations: Operations;
  /** Plugins ligados (ferramentas extras); sem ele só valem as ferramentas do núcleo. */
  plugins?: Plugins | null;
  /** Desenha uma camada como PNG base64 (services/renderer.ts). Sem ele, `get_image` explica que não há renderizador. */
  renderImage?: ((node: any, doc: any, scale: number, opts?: { width?: number }) => Promise<string>) | null;
  /** Descobre o que vaza da tela em cada largura (services/renderer.ts → overflow). */
  auditLayout?: ((roots: any[], doc: any, widths: Array<{ rootId: string; label: string; width: number }>) => Promise<any[]>) | null;
  /** Mede o layout real das pranchetas (services/renderer.ts → measure). Sem ele, alturas "hug" ficam como guardadas. */
  measureLayout?: ((roots: any[], doc: any) => Promise<Map<string, { w: number; h: number }>>) | null;
  /** Baixa uma imagem por endereço (services/remote-image.ts, protegido contra SSRF). */
  fetchImage?: ((url: string) => Promise<{ bytes: Uint8Array }>) | null;
  /** Edição local de fotos por um adaptador confiável; sem ele edit_image avisa. */
  imageOps?: ImageOperations | null;
  /** Retrato de quem está no servidor (pessoas e agentes), vindo da presença. */
  presence?: () => unknown;
  baseUrl?: () => string;
  onOperation?: (op: OperationRecord) => void;
}) {
  /** id do projeto → Doc */
  const docs = new Map<string, Doc>();
  /** id da sessão MCP → projeto atual e papel nele */
  const current = new Map<string, { id: string; role: string }>();

  function mount(id: string, file: string, ownerId: string, doc: unknown, base: { hash: string }): Doc {
    const entry: Doc = { id, file, ownerId, base, notices: [], lastUsed: Date.now(), store: null, commands: null, runner: null, dirty: true, measuring: null };
    const persist = async (record: { doc: unknown }) => {
      // grava como o dono do projeto: o controle de quem pode escrever é feito em `call`, antes de executar a ferramenta
      const saved = await projects.write({ id: ownerId }, entry.file, record.doc, { base: entry.base, by: 'workspace' });
      entry.base = { hash: saved.contentHash };
      return 'server';
    };
    entry.store = createStore({ initial: { doc, views: {}, theme: 'dark', link: { file, synced: true } }, persist });
    const canvas = createModelCanvas(entry.store);
    const commands = createCommands(entry.store, canvas);
    entry.commands = commands;
    entry.runner = createRunner({ store: entry.store, commands, renderImage, auditLayout, fetchImage, imageOps, vendor: vendorFiles });
    docs.set(id, entry);
    return entry;
  }

  async function open(actor: Actor, file: string) {
    const loaded = await projects.load({ id: actor.userId }, file);
    if (!Array.isArray(loaded.doc?.pages) || !loaded.doc.pages.length) throw new Error('Arquivo inválido: não parece um projeto do Stylo.');
    const entry = docs.get(loaded.id) ?? mount(loaded.id, file, loaded.ownerId, loaded.doc, { hash: loaded.contentHash });
    return { entry, role: loaded.role };
  }

  /** Alguém que não é este workspace gravou o projeto: recarrega o Doc para não trabalhar sobre uma cópia velha. */
  async function externalWrite(event: WriteEvent) {
    if (event.by === 'workspace') return;
    const entry = docs.get(event.projectId);
    if (!entry) return;
    try {
      const loaded = await projects.load({ id: entry.ownerId }, entry.file);
      entry.base = { hash: loaded.contentHash };
      entry.store.loadDoc(loaded.doc, { link: { file: entry.file, synced: true }, clean: true });
      entry.dirty = true;
      entry.notices.push(`O projeto "${entry.file}" foi alterado por outra pessoa e foi recarregado do banco. Releia com get_document antes de continuar.`);
    } catch { /* projeto apagado ou ilegível: o próximo save mostra o erro */ }
  }

  const need = (sid: string) => {
    const cur = current.get(sid);
    if (!cur) throw new Error('Nenhum projeto aberto nesta sessão. Use list_projects e open_project, ou new_project para criar um.');
    const entry = docs.get(cur.id);
    if (!entry) { current.delete(sid); return need(sid); }
    return { entry, role: cur.role };
  };

  const has = (actor: Actor, scope: string) => !actor.scopes || actor.scopes.includes(scope);

  /** Leituras que mostram tamanhos: antes delas, o layout real é medido (se mudou algo desde a última vez). */
  const GEOMETRY_READS = new Set(['get_document', 'get_layer', 'find_layers', 'get_selection', 'get_image', 'check_design']);
  let measureFailedAt = 0;
  async function ensureMeasured(entry: Doc) {
    if (!measureLayout || !entry.dirty) return;
    if (Date.now() - measureFailedAt < 60_000) return; // sem navegador: não insiste a cada leitura
    entry.measuring ??= (async () => {
      entry.dirty = false;
      try {
        const sizes = await measureLayout(rootsOf(entry.store.page().children), entry.store.state.doc);
        applyMeasured(entry.store.page().children, null, sizes);
      } catch {
        measureFailedAt = Date.now(); // renderizador indisponível: segue com os tamanhos guardados
      } finally {
        entry.measuring = null;
      }
    })();
    await entry.measuring;
  }

  /** Ferramentas de projeto: escolhem o arquivo atual da sessão (não passam pelo executor do documento). */
  const PROJECT: Record<string, (args: any, sid: string, actor: Actor) => Promise<object>> = {
    async list_projects(_args, sid, actor) {
      const list = await projects.list({ id: actor.userId });
      return { open: current.has(sid) ? docs.get(current.get(sid)!.id)?.file ?? null : null, projects: list.map((p) => ({ file: p.file, modified: new Date(p.modified).toISOString(), size: p.size })) };
    },
    async open_project({ file }, sid, actor) {
      const { entry, role } = await open(actor, String(file));
      current.set(sid, { id: entry.id, role });
      return { ok: true, opened: entry.file, role, project: entry.store.state.doc.name };
    },
    async new_project({ name } = {}, sid, actor) {
      if (!has(actor, 'write')) throw new Error('Este agente não tem permissão de escrita.');
      const file = fileNameFor(name || 'projeto');
      if (await projects.exists({ id: actor.userId }, file)) throw new Error(`Já existe "${file}". Escolha outro nome ou use open_project.`);
      const doc = makeDoc();
      if (name) doc.name = String(name).slice(0, 80);
      const saved = await projects.write({ id: actor.userId }, file, doc, { overwrite: true, by: 'workspace' });
      const { entry, role } = await open(actor, file);
      current.set(sid, { id: entry.id, role });
      onOperation({ projectId: saved.projectId, actor, tool: 'new_project', args: { name }, summary: `criou o projeto "${doc.name}"`, layerIds: [], ok: true });
      return { ok: true, file, project: doc.name };
    },
    async save_project({ name } = {}, sid, actor) {
      const { entry } = need(sid);
      if ((await entry.store.saveNow()) === false) throw new Error('Não consegui gravar o projeto.');
      if (name) {
        const file = fileNameFor(name);
        if (file !== entry.file) {
          if (await projects.exists({ id: actor.userId }, file)) throw new Error(`Já existe "${file}". Escolha outro nome.`);
          const copy = JSON.parse(JSON.stringify(entry.store.state.doc));
          copy.name = String(name).slice(0, 80);
          await projects.write({ id: actor.userId }, file, copy, { overwrite: true, by: 'workspace' });
          const { entry: next, role } = await open(actor, file);
          current.set(sid, { id: next.id, role });
          return { ok: true, saved: file };
        }
      }
      return { ok: true, saved: entry.file };
    },
    async export_zip(_args, sid, actor) {
      if (!has(actor, 'export')) throw new Error('Este agente não tem permissão de exportar.');
      const { entry } = need(sid);
      if ((await entry.store.saveNow()) === false) throw new Error('Não consegui gravar o projeto antes de exportar.');
      const site = exportSite(entry.store.state.doc, { vendor: vendorFiles });
      const base = `${baseUrl()}/api/projects/${encodeURIComponent(entry.file)}`;
      return {
        ok: true, file: entry.file,
        site_zip_url: `${base}/site.zip`, react_zip_url: `${base}/react.zip`, project_json_url: base,
        files: site.files.map((f: { path: string; content: string | Uint8Array }) => ({ path: f.path, bytes: typeof f.content === 'string' ? Buffer.byteLength(f.content) : f.content.length })), warnings: site.warnings,
      };
    },
  };

  /** Projeto aberto na sessão (ou erro claro) e o papel da pessoa nele. */
  const here = (sid: string) => need(sid);
  const kindOf = (v: unknown) => (v === 'comment' ? 'COMMENT' : 'DECISION') as 'COMMENT' | 'DECISION';
  const iso = (n: { at: Date }) => ({ ...n, at: n.at.toISOString() });

  Object.assign(PROJECT, {
    async add_note({ text, kind, layer_id, reply_to }: any, sid: string, actor: Actor) {
      const { entry } = here(sid);
      const note = await notes.create(actor, entry.id, { body: text, kind: kindOf(kind), layerId: layer_id, parentId: reply_to });
      return { ok: true, note: iso(note) };
    },
    async list_notes({ layer_id, kind, include_resolved, limit }: any, sid: string) {
      const { entry } = here(sid);
      const list = await notes.list(entry.id, { layerId: layer_id, kind: kind ? kindOf(kind) : undefined, includeResolved: include_resolved !== false, limit });
      return { count: list.length, notes: list.map(iso) };
    },
    async resolve_note({ id, resolved }: any, sid: string) {
      const { entry } = here(sid);
      return { ok: true, note: iso(await notes.resolve(entry.id, String(id), resolved !== false)) };
    },
    async get_activity({ limit, agent }: any, sid: string) {
      const { entry } = here(sid);
      const all = await operations.list(entry.id, { limit: Math.min(Number(limit) || 30, 200) });
      const list = agent ? all.filter((o) => o.who.toLowerCase() === String(agent).toLowerCase()) : all;
      return { count: list.length, activity: list.map((o) => ({ ...o, at: o.at.toISOString() })) };
    },
    async who_is_here() { return presence() as object; },
    async list_members(_a: any, sid: string) { return { members: await sharing.members(here(sid).entry.id) }; },
    async share_project({ email, role }: any, sid: string, actor: Actor) {
      const { entry } = here(sid);
      return { ok: true, member: await sharing.share(actor.userId, entry.id, email, role === 'viewer' ? 'VIEWER' : 'EDITOR') };
    },
    async unshare_project({ email }: any, sid: string, actor: Actor) {
      const { entry } = here(sid);
      return { ok: true, ...(await sharing.unshare(actor.userId, entry.id, email)) };
    },
  });

  /** Camadas que a chamada mexeu (para o log): ids nos argumentos e na resposta. */
  const layerIdsOf = (tool: string, args: any, out: any): string[] => {
    const ids = new Set<string>();
    const take = (v: unknown) => { if (typeof v === 'string' && v) ids.add(v); };
    take(args?.id); take(args?.parent_id);
    for (const id of args?.ids ?? []) take(id);
    if (tool === 'update_layers' && Array.isArray(args?.updates)) {
      for (const update of args.updates) take(update?.id);
    }
    take(out?.created?.id);
    return [...ids].slice(0, tool === 'update_layers' ? 100 : 50);
  };

  /**
   * Executa uma ferramenta pedida por uma sessão MCP.
   * @returns o resultado do executor ({ ok, ... } ou { error }) mais `notice` quando houver aviso
   */
  async function call(tool: string, args: any, { sid, actor, signal }: { sid: string; actor: Actor; signal?: AbortSignal }): Promise<any> {
    try {
      const def = toolByName(tool);
      // ferramenta de PLUGIN: mesmas permissões, validação e registro de atividade das do núcleo
      const plug = plugins?.get(tool);
      if (plug) {
        const pdef = plug.def as any;
        const needs = pdef.needs ?? (pdef.write ? 'write' : 'read');
        if (needs === 'read' && !has(actor, 'read')) throw new Error('Este agente não tem permissão de leitura.');
        if ((needs === 'write' || needs === 'owner') && !has(actor, 'write')) throw new Error('Este agente não tem permissão de escrita.');
        if (needs === 'comment' && !has(actor, 'comment') && !has(actor, 'write')) throw new Error('Este agente não tem permissão de comentar.');
        const invalid = validateToolArgs(tool, args);
        if (invalid) throw new Error(invalid);
        let project = null as any, doc: Doc | null = null;
        if (plug.needsProject) {
          const cur = need(sid);
          if (pdef.write && cur.role === 'VIEWER') throw new Error('Você só pode ler este projeto.');
          if (needs === 'owner' && cur.role !== 'OWNER') throw new Error('Só o dono do projeto faz isto.');
          doc = cur.entry;
          doc.lastUsed = Date.now();
          project = { id: doc.id, file: doc.file, role: cur.role, store: doc.store, commands: doc.commands };
        }
        const out: any = await plug.run(args || {}, { actor, project, services: plugins!.services, signal });
        if (doc && pdef.write) {
          doc.dirty = true;
          doc.store.commit(); // um passo no histórico; o servidor grava sozinho
          onOperation({ projectId: doc.id, actor, tool, args, summary: out?._summary ?? null, layerIds: layerIdsOf(tool, args, out), ok: !out?.error });
        }
        const result = { ok: true, ...out };
        if (doc?.notices.length) result.notice = doc.notices.splice(0).join(' ');
        return result;
      }
      if (PROJECT_TOOLS.has(tool)) {
        const needs = (def as any)?.needs;
        if (needs === 'read' && !has(actor, 'read')) throw new Error('Este agente não tem permissão de leitura.');
        if (needs === 'comment' && !has(actor, 'comment') && !has(actor, 'write')) throw new Error('Este agente não tem permissão de comentar.');
        if (needs === 'owner') {
          if (!has(actor, 'write')) throw new Error('Este agente não tem permissão de escrita.');
          if (need(sid).role !== 'OWNER') throw new Error('Só o dono do projeto faz isto.');
        }
        const result = await PROJECT[tool](args || {}, sid, actor);
        // novo/salvar já registram sozinhos; notas e compartilhamento entram no log de atividade
        if (def?.write && tool !== 'new_project' && tool !== 'save_project' && current.has(sid)) {
          const a = (args || {}) as any;
          const text = String(a.text ?? '').replace(/\s+/g, ' ').slice(0, 80);
          const summary = tool === 'add_note' ? `anotou (${a.kind ?? 'decision'}): ${text}` : tool === 'resolve_note' ? 'resolveu uma nota' : tool === 'share_project' ? `compartilhou com ${a.email}` : tool === 'unshare_project' ? `tirou o acesso de ${a.email}` : null;
          onOperation({ projectId: need(sid).entry.id, actor, tool, args, summary, layerIds: a.layer_id ? [a.layer_id] : [], ok: true });
        }
        return { ...result };
      }
      const { entry, role } = need(sid);
      if (def?.write) {
        if (role === 'VIEWER') throw new Error('Você só pode ler este projeto.');
        if (!has(actor, 'write')) throw new Error('Este agente não tem permissão de escrita.');
      } else if (!has(actor, 'read')) throw new Error('Este agente não tem permissão de leitura.');
      entry.lastUsed = Date.now();
      if (GEOMETRY_READS.has(tool)) await ensureMeasured(entry);
      const out = await entry.runner.run(tool, args, actor.name, { external: true, admin: true, signal });
      if (def?.write) {
        entry.dirty = true;
        // a estrutura recém-criada devolve o tamanho REAL (a altura "hug" só o navegador sabe), não a estimativa
        if (tool === 'build_layout' && out?.created?.id && measureLayout) {
          await ensureMeasured(entry);
          const made = entry.store.get(out.created.id);
          if (made) { out.created.w = made.w; out.created.h = made.h; }
        }
        onOperation({ projectId: entry.id, actor, tool, args, summary: out?._summary ?? null, layerIds: layerIdsOf(tool, args, out), ok: !out?.error && !out?.refused });
      }
      if (entry.notices.length) out.notice = entry.notices.splice(0).join(' ');
      return out;
    } catch (err: any) {
      return { error: err.message || String(err) };
    }
  }

  /** Solta da memória os projetos parados e já gravados. */
  async function sweep() {
    for (const [id, entry] of docs) {
      if (Date.now() - entry.lastUsed < IDLE_MS) continue;
      if ((await entry.store.saveNow()) === false) continue;
      if ([...current.values()].some((c) => c.id === id)) continue;
      docs.delete(id);
    }
  }
  const timer = setInterval(() => sweep().catch(() => {}), 60 * 1000);
  timer.unref();

  return {
    call,
    externalWrite,
    endSession: (sid: string) => { current.delete(sid); },
    /** Gravação imediata de tudo que está pendente (desligar o servidor). */
    flushAll: () => Promise.all([...docs.values()].map((e) => e.store.saveNow())),
    /** Projetos abertos agora. */
    openDocs: () => [...docs.values()].map((e) => ({ id: e.id, file: e.file, name: e.store.state.doc.name, sessions: [...current.values()].filter((c) => c.id === e.id).length })),
  };
}

export type Workspace = ReturnType<typeof createWorkspace>;
