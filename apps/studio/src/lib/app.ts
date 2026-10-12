// O estado do painel e as operações básicas (abrir projeto, atualizar o documento, mostrar avisos).
import * as api from './api';
import { collectIds, pageOf } from './doc';
import { saveThumbnail } from './thumbnail';
import { createStore, useStore } from './store';
import type { MenuState } from '../ui/ContextMenu';
import type { DialogState } from '../ui/Dialog';
import type { AuthState, DesignIssue, Device, Doc, Presence, ProjectInfo, PublicUser } from './types';

export type Panel = 'issues' | 'agents' | 'export' | null;
export type Theme = 'light' | 'dark' | 'system';
/** A ferramenta do canvas: mover/selecionar, mão (arrastar a vista) ou uma forma para desenhar. */
export type Tool = 'move' | 'hand' | 'frame' | 'section' | 'rect' | 'ellipse' | 'line' | 'polygon' | 'star' | 'text' | 'html' | 'comment' | 'inspect';

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
  presence: Presence | null;
  live: boolean;
  panel: Panel;
  issues: DesignIssue[] | null;
  issuesRunning: boolean;
  issuesNote: string | null;
  theme: Theme;
  accent: string;
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

export const ACCENTS = ['#5b5bd6', '#2f7de1', '#0f9d8a', '#2f9e44', '#d9822b', '#d6409f', '#c2410c', '#6b7280'];

function readPref<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function writePref(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sem armazenamento: a preferência vale só nesta aba */ }
}

export const app = createStore<AppState>({
  boot: 'loading', bootError: null, auth: null, user: null,
  screen: 'home', projects: null, projectsError: null,
  file: null, doc: null, pageId: null, role: 'OWNER',
  selection: [], hover: null, device: 'desktop', zoom: 1,
  busy: 0, toast: null, presence: null, live: false, panel: null,
  issues: null, issuesRunning: false, issuesNote: null,
  theme: readPref<Theme>('stylo.theme', 'system'), accent: readPref<string>('stylo.accent', ACCENTS[0]),
  menu: null, dialog: null, renaming: null, tool: 'move',
  panX: 0, panY: 0, altDown: false, spaceDown: false, pendingEdit: null,
  rulers: readPref<boolean>('stylo.rulers', true), guides: readPref<boolean>('stylo.guides', true),
});

export const useApp = <T,>(selector: (s: AppState) => T): T => useStore(app, selector);

// ---------------------------------------------------------------- aparência (preferência pessoal, fora do projeto)
export function applyPrefs() {
  const { theme, accent } = app.get();
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.setProperty('--accent', accent);
}
export function setTheme(theme: Theme) { app.set({ theme }); writePref('stylo.theme', theme); applyPrefs(); }
export function setAccent(accent: string) { app.set({ accent }); writePref('stylo.accent', accent); applyPrefs(); }

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
    app.set({ screen: 'editor', selection: [], pageId: null, device: 'desktop', issues: null, panel: null });
    await refreshDoc();
    history.replaceState(null, '', `#/p/${encodeURIComponent(file)}`);
  } catch (e) { toast('error', messageOf(e)); } finally { app.set({ busy: app.get().busy - 1 }); }
}

export async function createProject(name: string): Promise<void> {
  try {
    app.set({ busy: app.get().busy + 1 });
    const out = await api.tool<{ file: string }>('new_project', { name: name.trim() || 'Sem título' });
    lastDocKey = '';
    app.set({ screen: 'editor', selection: [], pageId: null, device: 'desktop', issues: null, panel: null });
    await refreshDoc();
    history.replaceState(null, '', `#/p/${encodeURIComponent(out.file)}`);
    void loadProjects();
  } catch (e) { toast('error', messageOf(e)); } finally { app.set({ busy: app.get().busy - 1 }); }
}

export function closeProject() {
  const { file, doc, pageId, busy } = app.get();
  app.set({ screen: 'home', selection: [], hover: null });
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
export async function run<T = any>(toolName: string, args: Record<string, unknown> = {}): Promise<T | undefined> {
  app.set({ busy: app.get().busy + 1 });
  try {
    const out = await api.tool<T>(toolName, args, app.get().pageId ?? undefined);
    await refreshDoc();
    return out;
  } catch (e) {
    toast('error', messageOf(e));
    await refreshDoc().catch(() => {});
    return undefined;
  } finally { app.set({ busy: app.get().busy - 1 }); }
}

// ---------------------------------------------------------------- seleção e visão
export function select(ids: string[]) { app.set({ selection: ids }); }
export const setTool = (tool: Tool) => app.set({ tool });
export const hoverLayer = (id: string | null) => { if (app.get().hover !== id) app.set({ hover: id }); };
export const setDevice = (device: Device) => app.set({ device });
export const setZoom = (zoom: number) => app.set({ zoom: Math.min(16, Math.max(0.02, zoom)) });
export const setRulers = (rulers: boolean) => { app.set({ rulers }); writePref('stylo.rulers', rulers); };
export const setGuides = (guides: boolean) => { app.set({ guides }); writePref('stylo.guides', guides); };
export const setPanel = (panel: Panel) => app.set({ panel: app.get().panel === panel ? null : panel });
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
let refreshTimer: number | undefined;

export async function boot(): Promise<void> {
  applyPrefs();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPrefs);
  try {
    const auth = await api.authState();
    app.set({ auth, user: auth.user });
    if (auth.mode === 'accounts' && !auth.user) { app.set({ boot: 'ready' }); return; }
    await afterLogin(auth.user);
  } catch (e) { app.set({ boot: 'error', bootError: messageOf(e) }); }
}

export async function afterLogin(user: PublicUser | null): Promise<void> {
  app.set({ user });
  stopLive?.();
  stopLive = api.connectLive(user?.name || 'Pessoa', {
    onPresence: (presence) => app.set({ presence }),
    onState: (live) => app.set({ live }),
    onProject: (event) => {
      const s = app.get();
      if (s.screen === 'editor' && event.file === s.file) {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => { if (app.get().busy === 0) void refreshDoc().catch(() => {}); }, 250);
      }
    },
  });
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
