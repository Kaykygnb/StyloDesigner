// O estado do painel e as operações básicas (abrir projeto, atualizar o documento, mostrar avisos).
import * as api from './api';
import { collectIds, pageOf } from './doc';
import { saveThumbnail } from './thumbnail';
import { createStore, useStore } from './store';
import type { MenuState } from '../ui/ContextMenu';
import type { DialogState } from '../ui/Dialog';
import type { AuthState, DesignIssue, Device, Doc, Presence, ProjectInfo, PublicUser } from './types';

export type Panel = 'design' | 'prototype' | 'code' | 'comments' | 'inspect' | 'issues' | 'agents' | 'versions' | 'export';
export type LeftTab = 'layers' | 'assets' | 'icons';
export type StateName = 'hover' | 'active' | 'focus';
/** Caixa de uma camada no "mundo" (px do projeto): x/y/w/h visuais (com rotação) e ow/oh sem girar. */
export interface WorldBox { x: number; y: number; w: number; h: number; ow: number; oh: number }
export type Theme = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';
export type Language = 'pt-BR' | 'en-US';
export const DEFAULT_SHORTCUTS: Record<string, string> = { move: 'v', frame: 'f', rect: 'r', ellipse: 'e', text: 't', hand: 'h', comment: 'c', inspect: 'i', node: 'n' };
/** A ferramenta do canvas: mover/selecionar, mão (arrastar a vista) ou uma forma para desenhar. */
export type Tool = 'move' | 'hand' | 'frame' | 'section' | 'rect' | 'ellipse' | 'line' | 'polygon' | 'star' | 'text' | 'html' | 'comment' | 'inspect' | 'node' | 'pen' | 'pencil';

export interface AppState {
  boot: 'loading' | 'ready' | 'error';
  bootError: string | null;
  auth: AuthState | null;
  user: PublicUser | null;
  screen: 'home' | 'editor';
  projects: ProjectInfo[] | null;
  projectsError: string | null;
  file: string | null;
  doc: Doc | null;
  pageId: string | null;
  role: string;
  selection: string[];
  hover: string | null;
  device: Device;
  zoom: number;
  busy: number;
  toast: { id: number; kind: 'error' | 'ok'; text: string } | null;
  syncNotice: { by: string; at: number } | null;
  presence: Presence | null;
  live: boolean;
  liveStatus: 'connected' | 'reconnecting';
  panel: Panel;
  worldBoxes: Record<string, WorldBox>;
  /** estado (hover, pressionado, foco) cujas sobrescritas o painel está editando; null = Normal */
  editState: StateName | null;
  leftTab: LeftTab;
  /** modo de cor do projeto (escuro...) em edição; null = o padrão */
  colorMode: string | null;
  panelsHidden: boolean;
  /** editor de código grande embaixo do canvas (a aba que ele mostra) */
  dock: 'css' | 'html' | 'page' | null;
  /** rascunho de comentário: camada e ponto (0..1) onde o pino vai */
  commentDraft: { nodeId: string; rx: number; ry: number } | null;
  activeComment: string | null;
  help: boolean;
  settings: boolean;
  presenting: boolean;
  picker: { resolve: (v: { assetId: string; w: number; h: number } | null) => void } | null;
  issues: DesignIssue[] | null;
  issuesRunning: boolean;
  issuesNote: string | null;
  theme: Theme;
  accent: string;
  density: Density;
  language: Language;
  menu: MenuState | null;
  dialog: DialogState | null;
  /** camada cujo nome está sendo editado na lista */
  renaming: string | null;
  tool: Tool;
  /** deslocamento da visão (px de tela) — a posição do "mundo" dentro do canvas */
  panX: number;
  panY: number;
  altDown: boolean;
  spaceDown: boolean;
  /** camada de texto recém-criada, para entrar em edição */
  pendingEdit: string | null;
  rulers: boolean;
  guides: boolean;
}

export const ACCENTS = ['#4c8dff', '#7c5cff', '#0f9d8a', '#2f9e44', '#d9822b', '#d6409f', '#e5484d', '#8b8d98'];

export function readPref<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
export function writePref(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sem armazenamento: a preferência vale só nesta aba */ }
}

export const app = createStore<AppState>({
  boot: 'loading', bootError: null, auth: null, user: null,
  screen: 'home', projects: null, projectsError: null,
  file: null, doc: null, pageId: null, role: 'OWNER',
  selection: [], hover: null, device: 'desktop', zoom: 1,
  busy: 0, toast: null, syncNotice: null, presence: null, live: false, liveStatus: 'reconnecting', panel: 'design',
  worldBoxes: {}, editState: null, leftTab: 'layers', colorMode: null, panelsHidden: false, picker: null, dock: null, commentDraft: null, activeComment: null, help: false, settings: false, presenting: false,
  issues: null, issuesRunning: false, issuesNote: null,
  theme: readPref<Theme>('stylo.theme', 'dark'), accent: readPref<string>('stylo.accent', ACCENTS[0]), density: readPref<Density>('stylo.density', 'comfortable'), language: readPref<Language>('stylo.language', 'pt-BR'),
  menu: null, dialog: null, renaming: null, tool: 'move',
  panX: 0, panY: 0, altDown: false, spaceDown: false, pendingEdit: null,
  rulers: readPref<boolean>('stylo.rulers', true), guides: readPref<boolean>('stylo.guides', true),
});

export const useApp = <T,>(selector: (s: AppState) => T): T => useStore(app, selector);

// ---------------------------------------------------------------- aparência (preferência pessoal, fora do projeto)
export function applyPrefs() {
  const { theme, accent, density } = app.get();
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.dataset.density = density;
}
export function setTheme(theme: Theme) { app.set({ theme }); writePref('stylo.theme', theme); applyPrefs(); }
export function setAccent(accent: string) { app.set({ accent }); writePref('stylo.accent', accent); applyPrefs(); }
export function setDensity(density: Density) { app.set({ density }); writePref('stylo.density', density); applyPrefs(); }
export function setLanguage(language: Language) { app.set({ language }); writePref('stylo.language', language); }
function hydrateAccountPreferences(user: PublicUser | null) {
  const p = user?.preferences;
  if (!p) return;
  const next: Partial<AppState> = {};
  if (p.theme) next.theme = p.theme;
  if (p.accent) next.accent = p.accent;
  if (p.density) next.density = p.density;
  if (p.language) next.language = p.language;
  if (Object.keys(next).length) { app.set(next); applyPrefs(); }
}
export function persistAccountPreferences(patch: PublicUser['preferences']) {
  const user = app.get().user;
  if (user) void api.updateMe({ preferences: { ...(user.preferences || {}), ...patch } }).then((updated) => app.set({ user: updated })).catch(() => undefined);
}

// ---------------------------------------------------------------- avisos
let toastId = 0;
let toastTimer: number | undefined;
export function toast(kind: 'error' | 'ok', text: string) {
  const id = ++toastId;
  app.set({ toast: { id, kind, text } });
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { if (app.get().toast?.id === id) app.set({ toast: null }); }, kind === 'error' ? 8000 : 3000);
}
export const dismissToast = () => app.set({ toast: null });
export const dismissSyncNotice = () => app.set({ syncNotice: null });
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------- documento
let lastDocKey = '';

/** Busca o projeto aberto no servidor. Só atualiza a tela se algo mudou de verdade (evita piscar). */
export async function refreshDoc(): Promise<void> {
  const snap = await api.snapshot();
  if (!snap) return;
  const key = JSON.stringify(snap.doc) + '|' + snap.file;
  const s = app.get();
  const pageId = s.pageId && snap.doc.pages.some((p) => p.id === s.pageId) ? s.pageId : snap.pageId;
  if (key !== lastDocKey) {
    lastDocKey = key;
    const alive = collectIds(pageOf(snap.doc, pageId).children);
    app.set({ doc: snap.doc, file: snap.file, role: snap.role, pageId, selection: s.selection.filter((id) => alive.has(id)) });
  } else if (pageId !== s.pageId) app.set({ pageId });
}

export async function openProject(file: string): Promise<void> {
  try {
    app.set({ busy: app.get().busy + 1 });
    await api.tool('open_project', { file });
    lastDocKey = '';
    app.set({ screen: 'editor', selection: [], pageId: null, device: 'desktop', issues: null, panel: 'design', editState: null, syncNotice: null });
    await refreshDoc();
    reconnectLiveForProject(file);
    history.replaceState(null, '', `#/p/${encodeURIComponent(file)}`);
  } catch (e) { toast('error', messageOf(e)); } finally { app.set({ busy: app.get().busy - 1 }); }
}

export async function createProject(name: string): Promise<void> {
  try {
    app.set({ busy: app.get().busy + 1 });
    const out = await api.tool<{ file: string }>('new_project', { name: name.trim() || 'Sem título' });
    lastDocKey = '';
    app.set({ screen: 'editor', selection: [], pageId: null, device: 'desktop', issues: null, panel: 'design', editState: null, syncNotice: null });
    await refreshDoc();
    reconnectLiveForProject(app.get().file);
    history.replaceState(null, '', `#/p/${encodeURIComponent(out.file)}`);
    void loadProjects();
  } catch (e) { toast('error', messageOf(e)); } finally { app.set({ busy: app.get().busy - 1 }); }
}

export function closeProject() {
  const { file, doc, pageId, busy } = app.get();
  app.set({ screen: 'home', selection: [], hover: null, syncNotice: null });
  history.replaceState(null, '', '#/');
  // guarda a miniatura da primeira tela e só então recarrega a lista (para ela já aparecer)
  const thumb = file && doc && busy === 0 ? saveThumbnail(file, doc, pageId) : Promise.resolve();
  void thumb.finally(() => loadProjects());
}

export async function loadProjects(): Promise<void> {
  try { app.set({ projects: await api.projectsList(), projectsError: null }); }
  catch (e) { app.set({ projectsError: messageOf(e) }); }
}

/** Executa uma ferramenta que ALTERA o projeto e mostra o resultado. Em caso de erro, avisa e ressincroniza com o servidor. */
/** Quando esta aba gravou algo por último: o aviso "projeto atualizado por…" é só para mudanças de OUTRA sessão. */
let lastLocalWrite = 0;

export async function run<T = any>(toolName: string, args: Record<string, unknown> = {}): Promise<T | undefined> {
  lastLocalWrite = Date.now();
  app.set({ busy: app.get().busy + 1 });
  try {
    const out = await api.tool<T>(toolName, args, app.get().pageId ?? undefined);
    await refreshDoc();
    return out;
  } catch (e) {
    toast('error', messageOf(e));
    await refreshDoc().catch(() => {});
    return undefined;
  } finally { lastLocalWrite = Date.now(); app.set({ busy: app.get().busy - 1 }); }
}

// ---------------------------------------------------------------- seleção e visão
export function select(ids: string[]) { app.set({ selection: ids }); }
/** Seleciona a camada a partir de um painel e pede ao canvas para enquadrá-la. */
export function selectAndReveal(ids: string[]) {
  select(ids);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('stylo:reveal-selection'));
}
export const setTool = (tool: Tool) => app.set({ tool });
export const hoverLayer = (id: string | null) => { if (app.get().hover !== id) app.set({ hover: id }); };
export const setDevice = (device: Device) => app.set({ device });
export const setZoom = (zoom: number) => app.set({ zoom: Math.min(16, Math.max(0.02, zoom)) });
export const setRulers = (rulers: boolean) => { app.set({ rulers }); writePref('stylo.rulers', rulers); };
export const setGuides = (guides: boolean) => { app.set({ guides }); writePref('stylo.guides', guides); };
export const setPanel = (panel: Panel) => app.set({ panel });
export function setPage(id: string) { app.set({ pageId: id, selection: [], hover: null }); }

// ---------------------------------------------------------------- conferência do design
export async function runChecks(): Promise<void> {
  const s = app.get();
  app.set({ issuesRunning: true, panel: 'issues' });
  try {
    const out = await api.tool<{ issues: DesignIssue[]; note?: string }>('check_design', {}, s.pageId ?? undefined);
    app.set({ issues: out.issues, issuesNote: out.note ?? null });
  } catch (e) { toast('error', messageOf(e)); } finally { app.set({ issuesRunning: false }); }
}

// ---------------------------------------------------------------- partida
let stopLive: (() => void) | null = null;
let liveUserName = 'Pessoa';
let liveHandlers: api.LiveHandlers | null = null;
function reconnectLiveForProject(file: string | null) {
  stopLive?.();
  if (liveHandlers) stopLive = api.connectLive(liveUserName, liveHandlers, file);
}
let refreshTimer: number | undefined;

export async function boot(): Promise<void> {
  applyPrefs();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPrefs);
  try {
    const auth = await api.authState();
    app.set({ auth, user: auth.user });
    hydrateAccountPreferences(auth.user);
    if (auth.mode === 'accounts' && !auth.user) { app.set({ boot: 'ready' }); return; }
    await afterLogin(auth.user);
  } catch (e) { app.set({ boot: 'error', bootError: messageOf(e) }); }
}

export async function afterLogin(user: PublicUser | null): Promise<void> {
  app.set({ user });
  hydrateAccountPreferences(user);
  liveUserName = user?.name || 'Pessoa';
  liveHandlers = {
    onPresence: (presence) => app.set({ presence }),
    onState: (live) => app.set({ live, liveStatus: live ? 'connected' : 'reconnecting' }),
    onProject: (event) => {
      const s = app.get();
      if (s.screen === 'editor' && event.file === s.file) {
        if (s.busy === 0 && Date.now() - lastLocalWrite > 3000) app.set({ syncNotice: { by: event.by || 'outra sessão', at: Date.now() } });
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => { if (app.get().busy === 0) void refreshDoc().catch(() => {}); }, 250);
      }
    },
  };
  stopLive = api.connectLive(liveUserName, liveHandlers, app.get().file);
  await loadProjects();
  app.set({ boot: 'ready' });
  window.addEventListener('hashchange', onHashChange);
  const wanted = /^#\/p\/(.+)$/.exec(location.hash)?.[1];
  if (wanted) { await openProject(decodeURIComponent(wanted)); return; }
  // recarregou a página com um projeto ainda aberto no servidor (a sessão desta aba continua lá): volta para ele
  if (location.hash === '') {
    const open = await api.snapshot().catch(() => null);
    if (open) await openProject(open.file);
  }
}

/** O botão voltar/avançar do navegador (ou um endereço colado) troca o projeto mostrado. */
function onHashChange() {
  const s = app.get();
  const wanted = /^#\/p\/(.+)$/.exec(location.hash)?.[1];
  if (wanted) { const file = decodeURIComponent(wanted); if (file !== s.file || s.screen !== 'editor') void openProject(file); }
  else if (s.screen === 'editor') closeProject();
}

export async function signedOut() {
  stopLive?.();
  app.set({ user: null, screen: 'home', doc: null, file: null, projects: null });
  const auth = await api.authState().catch(() => null);
  app.set({ auth });
}
