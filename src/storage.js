/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  storage.js — ONDE O PROJETO É GUARDADO: NAVEGADOR (IndexedDB) E PASTA DO COMPUTADOR (servidor)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Duas camadas de salvamento, de propósito:
 *
 *   1. CÓPIA NO NAVEGADOR (sempre ligada) — IndexedDB. Rápida, funciona sem servidor e sobrevive a
 *      recarregar a página. Antes usávamos localStorage, que tem limite de ~5 MB (estourava com imagens);
 *      o IndexedDB aceita centenas de MB. Projetos antigos do localStorage são migrados sozinhos.
 *      Ponto fraco: "limpar dados do site" apaga. Por isso existe a camada 2.
 *
 *   2. PASTA NO COMPUTADOR — via API do server.js (`npm start`). Grava arquivos .json de verdade numa pasta
 *      escolhida em Configurações, com versões antigas guardadas. Se a pasta estiver dentro do Google Drive /
 *      OneDrive / Dropbox, o próprio programa deles sobe para a nuvem.
 *
 *  Este módulo só sabe LER/GRAVAR; quem decide QUANDO salvar é o store (auto-salvar) e o main.js (menus).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Nome do banco IndexedDB e da "tabela" chave→valor dentro dele. */
const DB_NAME = 'projeto-designer';
const DB_STORE = 'kv';
/** Chave do registro do projeto atual. */
const DOC_KEY = 'current';
const TAB_KEY_PREFIX = 'tab:';
const CONFLICT_KEY_PREFIX = 'conflict:';
/** Chave antiga do localStorage (versões ≤ 0.5). Lida uma vez para migrar. */
const LEGACY_KEY = 'projeto-designer:v1';
/** Preferências de interface (largura dos painéis, auto-salvar na pasta...) — pequenas, ficam no localStorage. */
const PREF_KEY = 'projeto-designer:prefs';

// ---------------------------------------------------------------- IndexedDB
let dbPromise = null;
let activeDocKey = DOC_KEY;
let activeRevision = null;
let conflictDraft = false;
let tabId = null;
let tabIdPromise = null;
let tabChannel = null;
// Serializa autosave, cópia separada e recuperação: activeDocKey/revision são estado desta aba.
let localWriteQueue = Promise.resolve();
function enqueueLocalWrite(operation) {
  const result = localWriteQueue.then(operation, operation);
  localWriteQueue = result.catch(() => {});
  return result;
}

/** Identifica esta aba durante a sessão para separar seus rascunhos e projetos depois de um conflito. */
async function editorTabId() {
  if (tabId) return tabId;
  tabIdPromise ||= (async () => {
    const randomId = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    let candidate;
    try { candidate = sessionStorage.getItem('stylo:editor-tab-id') || randomId(); }
    catch { candidate = randomId(); }
    const nonce = randomId();
    if (typeof BroadcastChannel !== 'function') {
      tabId = candidate;
      try { sessionStorage.setItem('stylo:editor-tab-id', tabId); } catch { /* memória local basta nesta sessão */ }
      return tabId;
    }

    const activePeers = new Set();
    tabChannel = new BroadcastChannel('stylo:editor-tabs');
    tabChannel.onmessage = ({ data }) => {
      if (!data || data.id !== candidate || data.nonce === nonce) return;
      if (data.type === 'probe') tabChannel.postMessage({ type: 'active', id: candidate, nonce });
      if (data.type === 'active') activePeers.add(data.nonce);
    };
    tabChannel.postMessage({ type: 'probe', id: candidate, nonce });
    // sessionStorage pode ser copiado ao duplicar uma aba; dá tempo para a titular atual responder.
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (activePeers.size) candidate = randomId();
    tabId = candidate;
    try { sessionStorage.setItem('stylo:editor-tab-id', tabId); } catch { /* continua com o id em memória */ }
    tabChannel.onmessage = ({ data }) => {
      if (data?.type === 'probe' && data.id === tabId && data.nonce !== nonce) {
        tabChannel.postMessage({ type: 'active', id: tabId, nonce });
      }
    };
    tabChannel.postMessage({ type: 'active', id: tabId, nonce });
    return tabId;
  })();
  return tabIdPromise;
}
const tabDocKey = () => `${TAB_KEY_PREFIX}${tabId}`;
const tabConflictKey = () => `${CONFLICT_KEY_PREFIX}${tabId}`;
/** Abre (uma vez) o banco IndexedDB. Rejeita se o navegador não oferecer (ex.: algumas janelas anônimas). */
function db() {
  if (dbPromise) return dbPromise;
  const attempt = new Promise((ok, fail) => {
    if (!globalThis.indexedDB) return fail(new Error('IndexedDB indisponível'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
    req.onblocked = () => fail(new Error('IndexedDB bloqueado por outra aba'));
  });
  dbPromise = attempt;
  // falha transitória não pode ficar guardada para sempre: a próxima chamada tenta abrir de novo
  attempt.catch(() => { if (dbPromise === attempt) dbPromise = null; });
  return attempt;
}
/** Executa uma operação numa transação e devolve o resultado como Promise. */
async function tx(mode, fn) {
  const d = await db();
  return new Promise((ok, fail) => {
    const t = d.transaction(DB_STORE, mode);
    const req = fn(t.objectStore(DB_STORE));
    // só resolvemos quando a transação TERMINA (dado realmente gravado), não quando o pedido é aceito
    t.oncomplete = () => ok(req?.result);
    t.onerror = () => fail(t.error);
    t.onabort = () => fail(t.error || new Error('transação abortada'));
  });
}

/** Usa o IndexedDB? Se falhar uma vez, caímos para o localStorage pelo resto da sessão. */
let useIdb = true;

/**
 * Cópia do localStorage (gravada quando o IndexedDB falhou no meio da sessão) mais nova que a do IndexedDB?
 * Só vence com `revision` estritamente maior E `savedAt` não anterior. Devolve a cópia do localStorage ou null (a do IndexedDB vale).
 * A revisão esperada (activeRevision) continua a do IndexedDB, para o próximo salvamento não virar conflito.
 */
function newerLocalCopy(idbRec, lsKey) {
  try {
    const ls = JSON.parse(localStorage.getItem(lsKey) || 'null');
    if (!ls?.doc?.pages?.length) return null;
    const lr = Number(ls.revision) || 0;
    const ir = Number(idbRec.revision) || 0;
    // REVISÃO estritamente maior E gravada depois: empate não é decidido pelo relógio (cópia divergente de outra aba)
    // e uma cópia velha com revisão alta não vence um salvamento posterior no IndexedDB
    if (lr > ir && (Number(ls.savedAt) || 0) >= (Number(idbRec.savedAt) || 0)) return ls;
  } catch { /* corrompido: fica com o IndexedDB */ }
  return null;
}

/**
 * Lê o projeto guardado no navegador. Ordem: IndexedDB → (migração) localStorage antigo → null.
 * @returns {Promise<{doc, views?, theme?, link?, savedAt?}|null>}
 */
export async function loadLocal() {
  try {
    await editorTabId();
    const ownKey = tabDocKey();
    const own = await tx('readonly', (s) => s.get(ownKey));
    useIdb = true; // o IndexedDB respondeu: uma falha anterior era transitória
    if (own?.doc?.pages?.length) {
      activeDocKey = ownKey;
      activeRevision = Number(own.revision) || 0;
      conflictDraft = false;
      // se o IndexedDB caiu durante a sessão, as edições seguintes ficaram no localStorage: abre a mais nova
      const newer = newerLocalCopy(own, ownKey);
      if (newer) { newer.migrated = true; return newer; }
      return own;
    }
    const rec = await tx('readonly', (s) => s.get(DOC_KEY));
    const draft = await tx('readonly', (s) => s.get(tabConflictKey()));
    if (draft?.doc?.pages?.length) {
      activeDocKey = tabConflictKey();
      activeRevision = Number(draft.revision) || 0;
      conflictDraft = true;
      return { ...draft, storageConflict: true };
    }
    if (rec?.doc?.pages?.length) {
      activeDocKey = DOC_KEY;
      activeRevision = Number(rec.revision) || 0;
      conflictDraft = false;
      const newer = newerLocalCopy(rec, LEGACY_KEY);
      if (newer) { newer.migrated = true; return newer; }
      return rec;
    }
    activeDocKey = DOC_KEY;
    activeRevision = 0;
    conflictDraft = false;
  } catch {
    useIdb = false;
  }
  // Recupera primeiro cópias de conflito e projetos separados desta aba no fallback antigo.
  try {
    const own = JSON.parse(localStorage.getItem(tabDocKey()) || 'null');
    if (own?.doc?.pages?.length) {
      activeDocKey = tabDocKey(); activeRevision = Number(own.revision) || 0; conflictDraft = false;
      return own;
    }
    const draft = JSON.parse(localStorage.getItem(tabConflictKey()) || 'null');
    if (draft?.doc?.pages?.length) {
      activeDocKey = tabConflictKey(); activeRevision = Number(draft.revision) || 0; conflictDraft = true;
      return { ...draft, storageConflict: true };
    }
  } catch { /* armazenamento antigo indisponível ou corrompido */ }
  // migração: projeto salvo por versões antigas no localStorage
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    if (legacy?.doc?.pages?.length) {
      activeDocKey = DOC_KEY; activeRevision = 0; conflictDraft = false;
      legacy.migrated = true;
      return legacy;
    }
  } catch { /* corrompido: ignora */ }
  return null;
}

/**
 * Grava o projeto no navegador. `record` = { doc, views, theme, link }.
 * No IndexedDB o objeto é copiado na hora da chamada (structured clone), então pode continuar sendo editado.
 * Depois da primeira gravação bem-sucedida no IndexedDB, apaga a cópia antiga do localStorage (migração concluída).
 */
export function saveLocal(record) {
  return enqueueLocalWrite(() => saveLocalUnlocked(record));
}

async function saveLocalUnlocked(record) {
  await editorTabId();
  const rec = { ...record, savedAt: Date.now() };
  if (useIdb) {
    try {
      const database = await db();
      const expectedRevision = activeRevision ?? 0;
      let nextRevision = expectedRevision;
      let conflict = null;
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(DB_STORE, 'readwrite');
        const store = transaction.objectStore(DB_STORE);
        const current = store.get(activeDocKey);
        current.onsuccess = () => {
          const actualRevision = Number(current.result?.revision) || 0;
          if (conflictDraft) {
            conflict = Object.assign(new Error('Esta cópia foi separada para resolver um conflito entre abas.'), {
              name: 'LocalConflictError', code: 'LOCAL_CONFLICT', expectedRevision, actualRevision,
            });
            nextRevision = actualRevision + 1;
            store.put({ ...rec, revision: nextRevision, storageConflict: true, baseRevision: current.result?.baseRevision }, activeDocKey);
            return;
          }
          if (actualRevision !== expectedRevision) {
            conflict = Object.assign(new Error('Outra aba salvou uma versão mais recente deste projeto.'), {
              name: 'LocalConflictError',
              code: 'LOCAL_CONFLICT',
              expectedRevision,
              actualRevision,
            });
            // Salva o rascunho nesta transação sem alterar `current`; ele poderá ser recuperado após recarregar.
            nextRevision = 1;
            store.put({ ...rec, revision: nextRevision, storageConflict: true, baseRevision: actualRevision }, tabConflictKey());
            return;
          }
          nextRevision = actualRevision + 1;
          store.put({ ...rec, revision: nextRevision }, activeDocKey);
        };
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(conflict || transaction.error || new Error('transação abortada'));
        transaction.onerror = () => reject(conflict || transaction.error || new Error('falha ao gravar no IndexedDB'));
      });
      activeRevision = nextRevision;
      if (conflict) {
        if (!conflictDraft) { activeDocKey = tabConflictKey(); conflictDraft = true; }
        conflict.draftSaved = true;
        throw conflict;
      }
      // duas remoções independentes: se uma falhar, a outra ainda acontece
      try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
      try { if (activeDocKey !== DOC_KEY) localStorage.removeItem(activeDocKey); } catch { /* ignore */ } // cópia de queda já incorporada
      return 'browser';
    } catch (err) {
      // Conflito não é indisponibilidade: cair para localStorage permitiria sobrescrever o outro documento.
      if (err?.code === 'LOCAL_CONFLICT') throw err;
      // cota cheia de verdade → erro para o usuário; outros problemas → tenta o localStorage
      if (err?.name === 'QuotaExceededError') throw err;
      useIdb = false;
    }
  }
  const fallbackKey = conflictDraft ? tabConflictKey() : activeDocKey === DOC_KEY ? LEGACY_KEY : activeDocKey;
  localStorage.setItem(fallbackKey, JSON.stringify({ ...rec, revision: (activeRevision || 0) + 1, storageConflict: conflictDraft || undefined }));
  activeRevision = (activeRevision || 0) + 1;
  if (conflictDraft) {
    const err = Object.assign(new Error('Outra aba salvou uma versão mais recente deste projeto.'), { code: 'LOCAL_CONFLICT', draftSaved: true });
    throw err;
  }
  return 'browser';
}

/** Separa uma cópia conflitante depois que a pessoa a salvou explicitamente como outro projeto. */
export function forkLocalProject(record) {
  return enqueueLocalWrite(() => forkLocalProjectUnlocked(record));
}

async function forkLocalProjectUnlocked(record) {
  await editorTabId();
  const key = tabDocKey();
  let revision = 1;
  if (useIdb) {
    const database = await db();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, 'readwrite');
      const store = transaction.objectStore(DB_STORE);
      const current = store.get(key);
      current.onsuccess = () => {
        revision = (Number(current.result?.revision) || 0) + 1;
        store.put({ ...record, revision }, key);
        if (conflictDraft) store.delete(tabConflictKey());
      };
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Não consegui separar a cópia local.'));
      transaction.onabort = () => reject(transaction.error || new Error('A cópia local não foi separada.'));
    });
  } else {
    const previous = JSON.parse(localStorage.getItem(key) || 'null');
    revision = (Number(previous?.revision) || 0) + 1;
    localStorage.setItem(key, JSON.stringify({ ...record, revision }));
    if (conflictDraft) localStorage.removeItem(tabConflictKey());
  }
  activeDocKey = key;
  activeRevision = revision;
  conflictDraft = false;
  return 'browser';
}

/** Lista projetos e rascunhos locais recuperáveis, inclusive os de abas já fechadas. */
export async function listLocalProjects() {
  const projects = [];
  try {
    await editorTabId();
    if (useIdb) {
      const database = await db();
      const entries = await new Promise((resolve, reject) => {
        const transaction = database.transaction(DB_STORE, 'readonly');
        const store = transaction.objectStore(DB_STORE);
        const keys = store.getAllKeys();
        const values = store.getAll();
        transaction.oncomplete = () => resolve(keys.result.map((key, i) => [String(key), values.result[i]]));
        transaction.onerror = () => reject(transaction.error || new Error('Não consegui listar projetos locais.'));
        transaction.onabort = () => reject(transaction.error || new Error('A lista local foi cancelada.'));
      });
      for (const [key, record] of entries) {
        if (!key.startsWith(TAB_KEY_PREFIX) && !key.startsWith(CONFLICT_KEY_PREFIX)) continue;
        if (!record?.doc?.pages?.length) continue;
        projects.push({ key, name: record.doc.name || 'Projeto sem nome', revision: Number(record.revision) || 0,
          savedAt: Number(record.savedAt) || 0, conflict: key.startsWith(CONFLICT_KEY_PREFIX) || !!record.storageConflict });
      }
      return projects.sort((a, b) => b.savedAt - a.savedAt);
    }
  } catch { useIdb = false; }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(TAB_KEY_PREFIX) && !key?.startsWith(CONFLICT_KEY_PREFIX)) continue;
      const record = JSON.parse(localStorage.getItem(key) || 'null');
      if (!record?.doc?.pages?.length) continue;
      projects.push({ key, name: record.doc.name || 'Projeto sem nome', revision: Number(record.revision) || 0,
        savedAt: Number(record.savedAt) || 0, conflict: key.startsWith(CONFLICT_KEY_PREFIX) || !!record.storageConflict });
    }
  } catch { /* armazenamento local indisponível ou corrompido */ }
  return projects.sort((a, b) => b.savedAt - a.savedAt);
}

/** Abre uma cópia recuperável listada por listLocalProjects. */
export async function openLocalProject(key) {
  if (typeof key !== 'string' || (!key.startsWith(TAB_KEY_PREFIX) && !key.startsWith(CONFLICT_KEY_PREFIX))) {
    throw new Error('Projeto local inválido.');
  }
  await editorTabId();
  let record = null;
  if (useIdb) {
    try { record = await tx('readonly', (store) => store.get(key)); }
    catch { useIdb = false; }
  }
  if (!record) {
    try { record = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* corrompido */ }
  }
  if (!record?.doc?.pages?.length) throw new Error('A cópia local não existe mais.');
  activeDocKey = key;
  activeRevision = Number(record.revision) || 0;
  conflictDraft = key.startsWith(CONFLICT_KEY_PREFIX) || !!record.storageConflict;
  return { ...record, storageConflict: conflictDraft || undefined };
}

/** Remove uma cópia local antiga; protege o documento que a aba está editando agora. */
export async function deleteLocalProject(key) {
  if (typeof key !== 'string' || (!key.startsWith(TAB_KEY_PREFIX) && !key.startsWith(CONFLICT_KEY_PREFIX))) {
    throw new Error('Projeto local inválido.');
  }
  await editorTabId();
  if (key === activeDocKey) throw new Error('Não é possível apagar a cópia que está aberta nesta aba.');
  if (useIdb) {
    try { await tx('readwrite', (store) => store.delete(key)); return; }
    catch { useIdb = false; }
  }
  try { localStorage.removeItem(key); } catch { throw new Error('Não consegui apagar a cópia local.'); }
}

/** Informa se a chave aponta para o documento que esta aba está editando. */
export async function isActiveLocalProject(key) {
  await editorTabId();
  return key === activeDocKey;
}

/** Espaço usado/disponível para este site (quando o navegador informa). */
export async function browserUsage() {
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage, quota, engine: useIdb ? 'IndexedDB' : 'localStorage' };
  } catch {
    return { engine: useIdb ? 'IndexedDB' : 'localStorage' };
  }
}

/**
 * Pede ao navegador para NÃO apagar os dados deste site quando faltar espaço (armazenamento "persistente").
 * O Chrome costuma aceitar sozinho para sites usados com frequência; o Firefox pode perguntar.
 */
export async function requestPersistence() {
  try { return (await navigator.storage.persisted()) || (await navigator.storage.persist()); } catch { return false; }
}

// ---------------------------------------------------------------- preferências
/** Lê as preferências de interface (objeto vazio se não houver ou estiverem corrompidas). */
export function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch { return {}; }
}
/** Grava as preferências (falha em silêncio: são só conveniências). */
export function savePrefs(prefs) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- pasta do computador (server.js)
/** Erro de servidor com o status HTTP (409 = conflito, 404 = não existe...). */
class ServerError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.data = data; }
}

/** Faz um pedido à API e devolve o JSON (ou lança ServerError com a mensagem do servidor). */
async function call(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    let data = {};
    try { data = await res.json(); } catch { /* resposta não-JSON (ex.: outro servidor) */ }
    throw new ServerError(res.status, data.error || `Erro ${res.status}`, data);
  }
  return raw ? res : res.json();
}

/** Converte o nome do projeto num nome de arquivo aceito pelo servidor: "Meu App!" → "meu-app.json". */
export function fileNameFor(name) {
  const base = String(name || 'projeto')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'projeto';
  return `${base}.json`;
}

/** Projeto pronto para gravar em arquivo: o MESMO formato do "Baixar .json" (um arquivo baixado pode ir para a pasta e vice-versa). */
const serialize = (doc) => JSON.stringify(doc);

/**
 * API da pasta. Todas as funções lançam ServerError quando o servidor recusa e TypeError quando não há servidor
 * (ex.: o app foi aberto por outro servidor estático, como `python -m http.server`).
 */
export const folder = {
  /** { ok, folder, keepVersions } ou null se não houver servidor com API. */
  async status() {
    try { return await call('/status'); } catch { return null; }
  },
  /** Muda a pasta e/ou o nº de versões guardadas. */
  setConfig: (cfg) => call('/config', { method: 'PUT', body: cfg }),
  /** Lista [{ file, modified, size }] da pasta, do mais recente para o mais antigo. */
  list: () => call('/projects'),
  /** Lê um projeto: { doc, modified }. `modified` é usado depois para detectar conflito ao gravar. */
  async load(file) {
    const res = await call('/projects/' + encodeURIComponent(file), { raw: true });
    return { doc: await res.json(), modified: Number(res.headers.get('X-Modified')), contentHash: res.headers.get('X-Content-Hash') || '' };
  },
  /**
   * Grava um projeto. `base` e `baseHash` identificam a revisão carregada; se ela mudou, o servidor responde 409.
   * `overwrite` grava mesmo assim. @returns {Promise<{modified: number, contentHash: string}>}
   */
  save: async (file, doc, { base, baseHash, overwrite = false } = {}) => {
    const result = await call('/projects/' + encodeURIComponent(file), {
      method: 'PUT',
      body: serialize(doc),
      headers: { ...(base ? { 'X-Base-Modified': String(base) } : {}), ...(baseHash ? { 'X-Base-Hash': baseHash } : {}), ...(overwrite ? { 'X-Overwrite': '1' } : {}) },
    });
    return result;
  },
  /** Versões antigas guardadas de um projeto: [{ id, modified, size }]. */
  versions: (file) => call(`/projects/${encodeURIComponent(file)}/versions`),
  /** Conteúdo de uma versão antiga. */
  loadVersion: (file, id) => call(`/projects/${encodeURIComponent(file)}/versions/${encodeURIComponent(id)}`),
  /** Grava a miniatura (SVG) mostrada na página inicial. */
  saveThumb: (file, svg) => call(`/projects/${encodeURIComponent(file)}/thumb`, { method: 'PUT', body: { svg } }),
  /** URL da miniatura; `version` (data da miniatura) entra na URL para o navegador não mostrar uma antiga do cache. */
  thumbUrl: (file, version) => `/api/projects/${encodeURIComponent(file)}/thumb?v=${Math.round(version || 0)}`,
  /** Renomeia um projeto da pasta (versões e miniatura vão junto). @returns {Promise<{file, modified}>} */
  rename: (file, to) => call(`/projects/${encodeURIComponent(file)}/rename`, { method: 'POST', body: { to } }),
};
