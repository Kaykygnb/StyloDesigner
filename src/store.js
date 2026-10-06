// Estado central: documento, seleção, histórico (undo/redo) e persistência local.
import { makeDoc, makePage, fitGroups, walk, uid } from './model.js';
import { buildSample } from './sample.js';
import { syncInstances, syncStyles } from './components.js';

const STORAGE_KEY = 'projeto-designer:v1';

export function createStore() {
  const listeners = new Set();
  const syncListeners = new Set();
  const pending = new Set();
  let scheduled = false;
  let version = 0;
  let indexCache = null;
  let indexVersion = -1;
  let saveTimer = 0;

  const state = {
    doc: null,
    ui: {
      pageId: null,
      selection: [],
      tool: 'move',
      editingId: null,
      renamingId: null,
      hoverId: null,
      guides: [],
      dropTarget: null,
      marquee: null,
      views: {},
      clipboard: null,
      collapsed: {},
      theme: 'dark',
      rightTab: 'design',
    },
  };

  const api = { state, ui: state.ui, onSaveError: null };

  // ---------------------------------------------------------------- eventos
  function emit(reason) {
    syncListeners.forEach((fn) => fn(reason));
    pending.add(reason);
    if (scheduled) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      const reasons = new Set(pending);
      pending.clear();
      listeners.forEach((fn) => fn(reasons));
    };
    (globalThis.requestAnimationFrame || ((f) => setTimeout(f, 0)))(run);
  }
  api.emit = emit;
  /** Chamado uma vez por frame, com o conjunto de motivos (doc, selection, view, ...). */
  api.subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
  /** Chamado imediatamente a cada mudança (usado pelo canvas). */
  api.subscribeSync = (fn) => (syncListeners.add(fn), () => syncListeners.delete(fn));

  // ---------------------------------------------------------------- índice
  function index() {
    if (indexCache && indexVersion === version) return indexCache;
    const map = new Map();
    for (const page of state.doc.pages) {
      walk(page.children, (node, parent, list, i) => {
        map.set(node.id, { node, parent, list, i, page });
      });
    }
    indexCache = map;
    indexVersion = version;
    return map;
  }
  api.get = (id) => index().get(id)?.node || null;
  api.parentOf = (id) => index().get(id)?.parent || null;
  api.listOf = (id) => index().get(id)?.list || null;
  api.entry = (id) => index().get(id) || null;
  api.page = () => state.doc.pages.find((p) => p.id === state.ui.pageId) || state.doc.pages[0];
  api.selected = () => state.ui.selection.map((id) => api.get(id)).filter(Boolean);
  api.isAncestor = (ancestorId, id) => {
    for (let p = api.parentOf(id); p; p = api.parentOf(p.id)) if (p.id === ancestorId) return true;
    return false;
  };

  // ---------------------------------------------------------------- mutação
  /** Aplica uma mudança no documento. Use { commit: true } ao final de um gesto/edição. */
  api.update = (fn, { commit = false, structural = true } = {}) => {
    fn(api.page(), api);
    // structural:false = só valores mudaram (mover, girar, editar número): o índice id→nó continua válido
    if (structural) version++;
    if (commit) api.commit();
    else emit('doc');
  };

  // ---------------------------------------------------------------- histórico
  const history = { stack: [], i: -1 };
  const snapshot = () => JSON.stringify({ name: state.doc.name, pages: state.doc.pages, styles: state.doc.styles });

  api.commit = () => {
    fitGroups(api.page().children);
    syncInstances(state.doc.pages);
    syncStyles(state.doc);
    version++;
    const snap = snapshot();
    if (snap !== history.stack[history.i]) {
      history.stack.length = history.i + 1;
      history.stack.push(snap);
      if (history.stack.length > 200) history.stack.shift();
      history.i = history.stack.length - 1;
    }
    scheduleSave();
    emit('doc');
    emit('history');
  };

  function restore(snap) {
    const data = JSON.parse(snap);
    state.doc.name = data.name;
    state.doc.pages = data.pages;
    state.doc.styles = data.styles || { colors: [], texts: [] };
    if (!state.doc.pages.some((p) => p.id === state.ui.pageId)) state.ui.pageId = state.doc.pages[0].id;
    version++;
    api.setSelection(state.ui.selection.filter((id) => api.get(id)));
    state.ui.editingId = null;
    scheduleSave();
    emit('doc');
    emit('history');
  }
  api.undo = () => history.i > 0 && restore(history.stack[--history.i]);
  api.redo = () => history.i < history.stack.length - 1 && restore(history.stack[++history.i]);
  api.canUndo = () => history.i > 0;
  api.canRedo = () => history.i < history.stack.length - 1;

  // ---------------------------------------------------------------- seleção
  api.setSelection = (ids) => {
    const next = ids.filter((id) => api.get(id));
    const cur = state.ui.selection;
    if (next.length === cur.length && next.every((id, i) => id === cur[i])) return;
    state.ui.selection = next;
    emit('selection');
  };

  api.setTool = (tool) => {
    state.ui.tool = tool;
    emit('tool');
  };

  // ---------------------------------------------------------------- páginas
  api.addPage = () => {
    const page = makePage(`Página ${state.doc.pages.length + 1}`);
    state.doc.pages.push(page);
    api.switchPage(page.id);
    api.commit();
  };
  api.duplicatePage = (id) => {
    const src = state.doc.pages.find((p) => p.id === id);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    const reid = (n) => { n.id = uid(); n.children?.forEach(reid); };
    copy.id = uid();
    copy.name = `${src.name} cópia`;
    copy.children.forEach(reid);
    state.doc.pages.splice(state.doc.pages.indexOf(src) + 1, 0, copy);
    api.switchPage(copy.id);
    api.commit();
  };
  api.switchPage = (id) => {
    state.ui.pageId = id;
    state.ui.selection = [];
    state.ui.editingId = null;
    version++;
    emit('doc');
    emit('selection');
    emit('view');
  };

  // ---------------------------------------------------------------- documento
  api.loadDoc = (doc, { keepAssets = false } = {}) => {
    doc.assets = keepAssets ? { ...state.doc?.assets, ...doc.assets } : doc.assets || {};
    doc.styles ||= { colors: [], texts: [] };
    state.doc = doc;
    state.ui.pageId = doc.pages[0].id;
    state.ui.selection = [];
    state.ui.editingId = null;
    version++;
    history.stack = [snapshot()];
    history.i = 0;
    scheduleSave();
    emit('doc');
    emit('selection');
    emit('view');
    emit('history');
  };
  api.newDoc = () => api.loadDoc(makeDoc());
  api.loadSample = () => api.loadDoc(buildSample());

  api.addAsset = (id, dataUrl) => {
    state.doc.assets[id] = dataUrl;
  };

  // ---------------------------------------------------------------- persistência
  function scheduleSave() {
    clearTimeout(saveTimer);
    if (state.ui.saveState !== 'saving') {
      state.ui.saveState = 'saving';
      emit('ui');
    }
    saveTimer = setTimeout(save, 400);
  }
  function save() {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ doc: state.doc, views: state.ui.views, theme: state.ui.theme }),
      );
      state.ui.saveState = 'saved';
    } catch (err) {
      state.ui.saveState = 'error';
      api.onSaveError?.(err);
    }
    emit('ui');
  }
  api.saveNow = save;
  api.setTheme = (theme) => {
    state.ui.theme = theme;
    document.documentElement.dataset.theme = theme;
    scheduleSave();
    emit('ui');
  };

  function init() {
    let loaded = null;
    try {
      loaded = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      loaded = null;
    }
    if (loaded?.doc?.pages?.length) {
      state.doc = loaded.doc;
      state.doc.assets ||= {};
      state.doc.styles ||= { colors: [], texts: [] };
      state.ui.views = loaded.views || {};
      state.ui.theme = loaded.theme || 'dark';
      state.ui.pageId = state.doc.pages[0].id;
      history.stack = [snapshot()];
      history.i = 0;
    } else {
      api.loadDoc(buildSample());
    }
    document.documentElement.dataset.theme = state.ui.theme;
  }
  init();

  return api;
}
