/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  store.js — ESTADO CENTRAL, HISTÓRICO (DESFAZER) E SALVAMENTO
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  É o "cérebro" do app: guarda o documento e o estado da interface, expõe como consultar (get, parentOf,
 *  selected...) e como alterar (update/commit), mantém o histórico de desfazer/refazer e salva sozinho no
 *  (via `persist`, ver storage.js). Nenhum outro módulo guarda estado próprio do documento; todos pedem ao store.
 *
 *  REGRA DE OURO: nunca altere uma camada "por fora". Use `store.update(fn)` e, ao terminar o gesto,
 *  `store.commit()` — é isso que faz o desfazer, o salvamento e os painéis funcionarem.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { makeDoc, makePage, fitGroups, walk, uid } from './model.js';
import { buildSample } from './sample.js';
import { syncInstances, syncStyles } from './components.js';
import { syncVars } from './modes.js';
import { pruneComments } from './comments.js';


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
 * @param {object} [opts]
 * @param {object|null} [opts.initial]  projeto já carregado do navegador ({ doc, views, theme, link }) — ver storage.loadLocal.
 *        null/ausente = abre o projeto de exemplo.
 * @param {(record) => Promise<string>} [opts.persist]  grava o projeto (navegador e, se ligado, a pasta). Devolve onde
 *        gravou ('browser' | 'folder'). O store só decide QUANDO salvar; o COMO fica em main.js/storage.js.
 * @returns {object} a API do store (get, update, commit, undo, setSelection, subscribe...)
 */
export function createStore({ initial = null, persist = async () => 'browser' } = {}) {
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
  // salvamento em andamento (Promise) e "mudou de novo enquanto salvava?" — garante 1 gravação por vez, sem perder a última
  let saving = null;
  let dirtyAgain = false;
  // há mudanças ainda NÃO gravadas? Evita gravar à toa (ex.: ao trocar de aba sem ter editado nada) — gravar sem
  // necessidade ao fechar a página já causou "conflito" falso com o arquivo da pasta
  let dirty = false;

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
      // estado interativo sendo editado no painel Design ('hover' | 'active' | 'focus'; null = a camada normal)
      editState: null,
      // modo responsivo: null = Desktop (o desenho base) · 'tablet' | 'mobile' = editando/vendo aquela largura
      bp: null,
      // modo de cor visto no canvas (null = padrão)
      mode: null,
      // comentários: rascunho ({ nodeId, rx, ry }) esperando o texto · comentário em destaque (id) · filtro da lista
      commentDraft: null,
      activeComment: null,
      commentFilter: 'open',
      marquee: null,
      views: {},
      clipboard: null,
      collapsed: {},
      theme: 'dark',
      rightTab: 'design',
      // ARQUIVO NA PASTA ligado a este projeto: { file: 'meu-app.json', modified: <data do disco> } ou null.
      // Com ele, o auto-salvar também grava na pasta. `modified` serve para detectar se outro programa mexeu no arquivo.
      link: null,
      // projeto "intocado": exemplo ou em branco que ninguém editou ainda. Trocar de projeto não precisa perguntar nada.
      pristine: false,
      // situação do salvamento: saveState 'saving' | 'saved' | 'error' · savedWhere 'browser' | 'folder'
      saveState: 'saved',
      savedWhere: 'browser',
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
  // (os comentários entram na foto: criar, resolver ou apagar um comentário também se desfaz com Ctrl+Z)
  const snapshot = () => JSON.stringify({ name: state.doc.name, pages: state.doc.pages, styles: state.doc.styles, comments: state.doc.comments || [] });

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
    syncVars(state.doc); // variáveis de tamanho (gap, padding, raio, fonte) → camadas ligadas
    pruneComments(state.doc); // camada apagada leva os comentários dela (desfazer traz de volta)
    version++;
    const snap = snapshot();
    if (snap !== history.stack[history.i]) {
      state.ui.pristine = false;
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
    state.doc.comments = data.comments || [];
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

  /** Liga/desliga as réguas (Ctrl+R / Shift+R). A escolha fica lembrada no navegador. */
  api.toggleRulers = () => {
    state.ui.showRulers = !state.ui.showRulers;
    try { localStorage.setItem('pd.rulers', state.ui.showRulers ? '1' : '0'); } catch { /* sem armazenamento */ }
    emit('ui');
    emit('overlay');
  };

  /** Entra no modo responsivo (null = Desktop, 'tablet', 'mobile'). Sai de qualquer estado (hover...) em edição. */
  /** Escolhe o MODO DE COR visto no canvas (null = padrão; ou o id de um modo: escuro...). */
  api.setMode = (mode) => {
    const next = mode || null;
    if (state.ui.mode === next) return;
    state.ui.mode = next;
    emit('bp'); // mesma "visão" do modo responsivo: o canvas e o painel redesenham
  };
  api.setBp = (bp) => {
    const next = bp || null;
    if (state.ui.bp === next) return;
    state.ui.bp = next;
    state.ui.editState = null;
    emit('bp');
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
   * `pristine` = exemplo/em branco ainda não editado (trocar de projeto não pergunta nada).
   * `link` = arquivo da pasta de onde o projeto veio ({ file, modified }); sem ele (novo, exemplo, importado),
   * o projeto fica só no navegador até você usar "Salvar na pasta" — assim um exemplo nunca sobrescreve seu arquivo.
   */
  api.loadDoc = (doc, { keepAssets = false, link = null, pristine = false } = {}) => {
    doc.assets = keepAssets ? { ...state.doc?.assets, ...doc.assets } : doc.assets || {};
    doc.styles ||= { colors: [], texts: [] };
    doc.comments ||= []; // projetos antigos não têm comentários
    state.doc = doc;
    state.ui.link = link;
    state.ui.pristine = pristine;
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
  api.newDoc = () => api.loadDoc(makeDoc(), { pristine: true });
  api.loadSample = () => api.loadDoc(buildSample(), { pristine: true });

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
    dirty = true;
    clearTimeout(saveTimer);
    if (state.ui.saveState !== 'saving') {
      state.ui.saveState = 'saving';
      emit('ui');
    }
    saveTimer = setTimeout(save, 400);
  }
  /**
   * Grava o projeto chamando `persist` (navegador + pasta, ver main.js). Só UMA gravação por vez: se algo mudar
   * enquanto grava, marcamos `dirtyAgain` e gravamos de novo ao terminar (a última versão nunca se perde).
   * Se falhar, saveState vira 'error' e `onSaveError` avisa o usuário.
   * @returns {Promise<void>} resolve quando o projeto (como estava) terminou de ser gravado
   */
  function save() {
    clearTimeout(saveTimer);
    if (saving) {
      dirtyAgain = true;
      return saving;
    }
    if (!dirty) return Promise.resolve();
    dirty = false;
    saving = (async () => {
      try {
        const where = await persist({ doc: state.doc, views: state.ui.views, theme: state.ui.theme, link: state.ui.link });
        state.ui.saveState = 'saved';
        state.ui.savedWhere = where;
      } catch (err) {
        state.ui.saveState = 'error';
        dirty = true; // continua pendente: a próxima tentativa grava de novo
        api.onSaveError?.(err);
      }
    })();
    return saving.then(() => {
      saving = null;
      emit('ui');
      if (dirtyAgain) {
        dirtyAgain = false;
        return save();
      }
    });
  }
  /** Salva imediatamente, sem esperar o atraso (ao esconder/fechar a aba, ou antes de trocar de projeto). */
  api.saveNow = save;
  /** Marca o projeto como "precisa gravar" e agenda o salvamento (ex.: o servidor voltou e a pasta está atrasada). */
  api.touch = scheduleSave;
  /** Liga (ou desliga, com null) o projeto a um arquivo da pasta e salva. Ver `state.ui.link`. */
  api.setLink = (link) => {
    state.ui.link = link;
    emit('ui');
    scheduleSave();
  };
  /** Troca o tema ('dark' | 'light') e lembra a escolha. */
  api.setTheme = (theme) => {
    state.ui.theme = theme;
    document.documentElement.dataset.theme = theme;
    scheduleSave();
    emit('ui');
  };

  /**
   * Estado inicial: usa o projeto que main.js já leu do navegador (`initial`); se não houver, abre o exemplo.
   * Campos novos (assets, styles) são preenchidos para aceitar projetos salvos por versões antigas do app.
   */
  function init() {
    if (initial?.doc?.pages?.length) {
      state.doc = initial.doc;
      state.doc.assets ||= {};
      state.doc.styles ||= { colors: [], texts: [] };
      state.ui.views = initial.views || {};
      state.ui.theme = initial.theme || 'dark';
      state.ui.link = initial.link || null;
      state.ui.pageId = state.doc.pages[0].id;
      history.stack = [snapshot()];
      history.i = 0;
      // veio do localStorage antigo: grava logo no IndexedDB (conclui a migração)
      if (initial.migrated) scheduleSave();
    } else {
      api.loadDoc(buildSample(), { pristine: true });
    }
    globalThis.document && (document.documentElement.dataset.theme = state.ui.theme);
  }
  init();

  return api;
}
