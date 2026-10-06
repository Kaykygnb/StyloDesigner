/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  store.js — ESTADO CENTRAL, HISTÓRICO (DESFAZER) E SALVAMENTO
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  É o "cérebro" do app: guarda o documento e o estado da interface, expõe como consultar (get, parentOf,
 *  selected...) e como alterar (update/commit), mantém o histórico de desfazer/refazer e salva sozinho no
 *  navegador. Nenhum outro módulo guarda estado próprio do documento; todos pedem ao store.
 *
 *  REGRA DE OURO: nunca altere uma camada "por fora". Use `store.update(fn)` e, ao terminar o gesto,
 *  `store.commit()` — é isso que faz o desfazer, o salvamento e os painéis funcionarem.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { makeDoc, makePage, fitGroups, walk, uid } from './model.js';
import { buildSample } from './sample.js';
import { syncInstances, syncStyles } from './components.js';

/** Chave do localStorage onde o projeto é salvo automaticamente. O sufixo ":v1" permite mudar o formato no futuro sem ler dados antigos por engano. */
const STORAGE_KEY = 'projeto-designer:v1';

/**
 * Cria o STORE: a única fonte de verdade do app. Tudo que o usuário vê (canvas, painéis, menus) é uma
 * função do que está aqui; e toda mudança passa por aqui. Fluxo:
 *
 *   ação do usuário → store.update(...)/commit() → emit(motivo) → quem assina (canvas, painéis) redesenha
 *
 * O que o store guarda:
 *   state.doc  → o DOCUMENTO (o que é salvo): páginas, camadas, imagens, estilos
 *   state.ui   → estado de INTERFACE (não é salvo no .json): seleção, ferramenta, zoom, painel aberto...
 *
 * @returns {object} a API do store (get, update, commit, undo, setSelection, subscribe...)
 */
export function createStore() {
  // Quem assina o store. `listeners` são chamados no máximo 1x por frame (painéis); `syncListeners` na hora (canvas).
  const listeners = new Set();
  const syncListeners = new Set();
  // Motivos de mudança acumulados desde o último frame (ex.: 'doc', 'selection', 'view'); entregues juntos aos `listeners`.
  const pending = new Set();
  let scheduled = false;
  // `version` sobe quando a ESTRUTURA da árvore muda (inserir/remover/reordenar). O índice id→nó é refeito só então.
  let version = 0;
  let indexCache = null;
  let indexVersion = -1;
  // timer do salvamento automático (debounce de 400 ms)
  let saveTimer = 0;

  // Estado completo. `doc` é preenchido por init() logo abaixo.
  const state = {
    doc: null,
    // ---- estado de interface (efêmero) ----
    // pageId: página aberta · selection: ids selecionados · tool: ferramenta ativa
    // editingId: texto em edição · renamingId: camada sendo renomeada · hoverId: camada sob o mouse
    // guides/dropTarget/marquee: desenhos temporários do overlay durante um arrasto
    // views: { [pageId]: {x, y, zoom} } zoom/posição da vista de cada página · clipboard: copiar/colar de camadas
    // collapsed: { [id]: bool } pastas da lista de camadas abertas/fechadas · theme: 'dark' | 'light'
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

  // `api` é o objeto que o resto do app recebe. As funções são penduradas nele mais abaixo.
  const api = { state, ui: state.ui, onSaveError: null };

  // ---------------------------------------------------------------- eventos
  /**
   * Avisa que algo mudou, dizendo o MOTIVO ('doc' | 'selection' | 'view' | 'tool' | 'history' | 'ui' | 'overlay' | 'hover'...).
   * Dois canais de entrega, de propósito:
   *  - síncrono (subscribeSync): o canvas e o overlay precisam estar em dia ANTES do próximo evento do mouse,
   *    senão medem o DOM desatualizado durante um arrasto;
   *  - 1x por frame (subscribe): painéis pesados (camadas, propriedades) juntam vários motivos em uma só atualização.
   */
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
  /** Assina mudanças, com entrega agrupada por frame. `fn(reasons: Set<string>)`. Devolve a função para cancelar. */
  api.subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
  /** Assina mudanças com entrega imediata. `fn(reason: string)`. Usado pelo canvas e pelo overlay. */
  api.subscribeSync = (fn) => (syncListeners.add(fn), () => syncListeners.delete(fn));

  // ---------------------------------------------------------------- índice
  /**
   * Índice id → { node, parent, list, i, page } de TODAS as camadas de todas as páginas.
   * É reconstruído só quando `version` mudou (estrutura nova), o que torna get(id) barato mesmo com milhares de camadas.
   * `list` é o array onde o nó vive (page.children ou parent.children) e `i` a posição dele nesse array.
   */
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
  /** Camada pelo id (ou null). */
  api.get = (id) => index().get(id)?.node || null;
  /** Pai da camada (null se estiver na raiz da página). */
  api.parentOf = (id) => index().get(id)?.parent || null;
  /** Array que contém a camada (use para inserir/remover/reordenar irmãs). */
  api.listOf = (id) => index().get(id)?.list || null;
  /** Registro completo do índice (node, parent, list, i, page). */
  api.entry = (id) => index().get(id) || null;
  /** Página aberta no momento. */
  api.page = () => state.doc.pages.find((p) => p.id === state.ui.pageId) || state.doc.pages[0];
  /** Camadas selecionadas, já como objetos (ids que não existem mais são ignorados). */
  api.selected = () => state.ui.selection.map((id) => api.get(id)).filter(Boolean);
  /** `ancestorId` é pai, avô... de `id`? */
  api.isAncestor = (ancestorId, id) => {
    for (let p = api.parentOf(id); p; p = api.parentOf(p.id)) if (p.id === ancestorId) return true;
    return false;
  };

  // ---------------------------------------------------------------- mutação
  /**
   * ÚNICA porta para alterar o documento. Roda `fn(page, store)` (onde você muda os objetos) e avisa a interface.
   *
   * @param {(page, store) => void} fn  a mudança
   * @param {object} [opts]
   * @param {boolean} [opts.commit=false]  true ao FINAL de um gesto/edição: grava no histórico (desfazer) e salva.
   *        Durante um arrasto chamamos sem commit (só redesenha) e damos 1 commit ao soltar o mouse.
   * @param {boolean} [opts.structural=true]  false quando só VALORES mudaram (mover, girar, digitar um número):
   *        o índice id→nó continua válido e não precisa ser refeito — é o que mantém o arrasto fluido.
   */
  api.update = (fn, { commit = false, structural = true } = {}) => {
    fn(api.page(), api);
    // structural:false = só valores mudaram (mover, girar, editar número): o índice id→nó continua válido
    if (structural) version++;
    if (commit) api.commit();
    else emit('doc');
  };

  // ---------------------------------------------------------------- histórico
  // ---- histórico (desfazer/refazer) ----
  // Guardamos FOTOS completas (JSON) do documento, até 200. Imagens ficam fora da foto (doc.assets), então a foto é pequena.
  // `i` aponta para a foto atual; desfazer anda para trás, refazer para frente.
  const history = { stack: [], i: -1 };
  /** Foto do documento para o histórico. Não inclui `assets` (imagens só entram, nunca saem) para ser leve. */
  const snapshot = () => JSON.stringify({ name: state.doc.name, pages: state.doc.pages, styles: state.doc.styles });

  /**
   * Fecha uma edição: "arruma a casa" e grava no histórico.
   *  1. fitGroups   → recalcula a caixa dos grupos
   *  2. syncInstances → propaga mudanças dos componentes principais para as instâncias
   *  3. syncStyles  → propaga mudanças de estilos de cor/texto
   *  4. grava a foto no histórico (se algo mudou de fato) e agenda o salvamento automático
   */
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

  /** Volta o documento para uma foto do histórico (usado por desfazer/refazer). Mantém a seleção do que ainda existe. */
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
  /** Desfazer / refazer / pode? — só andam pelo histórico; o resto do app reage ao evento 'history'. */
  api.undo = () => history.i > 0 && restore(history.stack[--history.i]);
  api.redo = () => history.i < history.stack.length - 1 && restore(history.stack[++history.i]);
  api.canUndo = () => history.i > 0;
  api.canRedo = () => history.i < history.stack.length - 1;

  // ---------------------------------------------------------------- seleção
  /**
   * Define a seleção. Ignora ids que não existem e não emite evento se nada mudou (evita redesenhos à toa).
   * @param {string[]} ids
   */
  api.setSelection = (ids) => {
    const next = ids.filter((id) => api.get(id));
    const cur = state.ui.selection;
    if (next.length === cur.length && next.every((id, i) => id === cur[i])) return;
    state.ui.selection = next;
    emit('selection');
  };

  /** Troca a ferramenta ativa ('move', 'frame', 'rect', 'pen'...). */
  api.setTool = (tool) => {
    state.ui.tool = tool;
    emit('tool');
  };

  // ---------------------------------------------------------------- páginas
  /** Cria uma página nova ("Página N"), abre e grava no histórico. */
  api.addPage = () => {
    const page = makePage(`Página ${state.doc.pages.length + 1}`);
    state.doc.pages.push(page);
    api.switchPage(page.id);
    api.commit();
  };
  /** Duplica uma página inteira (com ids novos em todas as camadas) e abre a cópia. */
  api.duplicatePage = (id) => {
    const src = state.doc.pages.find((p) => p.id === id);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    const reid = (n) => { n.id = uid(); n.children?.forEach(reid); };
    copy.id = uid();
    copy.name = `${src.name} cópia`;
    copy.children.forEach(reid);
    state.doc.pages.splice(state.doc.pages.indexOf(src) + 1, 0, copy);
    /** Abre outra página. Limpa seleção e edição (camadas de outra página não podem continuar selecionadas). */
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
  /**
   * Substitui o documento inteiro (novo projeto, abrir arquivo, exemplo). Zera o histórico: o estado carregado
   * vira o primeiro item. `keepAssets` junta as imagens novas às que já existiam.
   */
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
  /** Projeto em branco / projeto de exemplo. */
  api.newDoc = () => api.loadDoc(makeDoc());
  api.loadSample = () => api.loadDoc(buildSample());

  /** Guarda uma imagem (data URL) em doc.assets sob o id dado. */
  api.addAsset = (id, dataUrl) => {
    state.doc.assets[id] = dataUrl;
  };

  // ---------------------------------------------------------------- persistência
  /**
   * Agenda o salvamento automático para 400 ms depois da ÚLTIMA mudança (debounce): editar 50 vezes seguidas grava só 1 vez.
   * Marca saveState='saving' para o topo mostrar "Salvando…".
   */
  function scheduleSave() {
    clearTimeout(saveTimer);
    if (state.ui.saveState !== 'saving') {
      state.ui.saveState = 'saving';
      emit('ui');
    }
    saveTimer = setTimeout(save, 400);
  }
  /**
   * Grava o projeto no localStorage do navegador. O limite do navegador é ~5 MB; se estourar (muitas imagens),
   * saveState vira 'error' e `onSaveError` avisa o usuário para usar Arquivo → Salvar projeto.
   */
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
  /** Salva imediatamente (usado ao fechar a aba). */
  api.saveNow = save;
  /** Troca o tema ('dark' | 'light') e lembra a escolha. */
  api.setTheme = (theme) => {
    state.ui.theme = theme;
    document.documentElement.dataset.theme = theme;
    scheduleSave();
    emit('ui');
  };

  /**
   * Estado inicial: lê o projeto salvo no localStorage; se não houver (ou estiver corrompido), abre o projeto de exemplo.
   * Campos novos (assets, styles) são preenchidos para aceitar projetos salvos por versões antigas do app.
   */
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
