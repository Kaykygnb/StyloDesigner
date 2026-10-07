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
/** Chave antiga do localStorage (versões ≤ 0.5). Lida uma vez para migrar. */
const LEGACY_KEY = 'projeto-designer:v1';
/** Preferências de interface (largura dos painéis, auto-salvar na pasta...) — pequenas, ficam no localStorage. */
const PREF_KEY = 'projeto-designer:prefs';

// ---------------------------------------------------------------- IndexedDB
let dbPromise = null;
/** Abre (uma vez) o banco IndexedDB. Rejeita se o navegador não oferecer (ex.: algumas janelas anônimas). */
function db() {
  dbPromise ||= new Promise((ok, fail) => {
    if (!globalThis.indexedDB) return fail(new Error('IndexedDB indisponível'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
    req.onblocked = () => fail(new Error('IndexedDB bloqueado por outra aba'));
  });
  return dbPromise;
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
 * Lê o projeto guardado no navegador. Ordem: IndexedDB → (migração) localStorage antigo → null.
 * @returns {Promise<{doc, views?, theme?, link?, savedAt?}|null>}
 */
export async function loadLocal() {
  try {
    const rec = await tx('readonly', (s) => s.get(DOC_KEY));
    if (rec?.doc?.pages?.length) return rec;
  } catch {
    useIdb = false;
  }
  // migração: projeto salvo por versões antigas no localStorage
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    if (legacy?.doc?.pages?.length) {
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
export async function saveLocal(record) {
  const rec = { ...record, savedAt: Date.now() };
  if (useIdb) {
    try {
      await tx('readwrite', (s) => s.put(rec, DOC_KEY));
      try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
      return 'browser';
    } catch (err) {
      // cota cheia de verdade → erro para o usuário; outros problemas → tenta o localStorage
      if (err?.name === 'QuotaExceededError') throw err;
      useIdb = false;
    }
  }
  localStorage.setItem(LEGACY_KEY, JSON.stringify(rec)); // pode lançar QuotaExceededError (~5 MB)
  return 'browser';
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
    return { doc: await res.json(), modified: Number(res.headers.get('X-Modified')) };
  },
  /**
   * Grava um projeto. `base` = data de modificação que conhecemos (de load/save anterior); se o arquivo mudou
   * desde então, o servidor responde 409 (ServerError com status 409). `overwrite` grava mesmo assim.
   * @returns {Promise<{modified: number}>}
   */
  save: (file, doc, { base, overwrite = false } = {}) => call('/projects/' + encodeURIComponent(file), {
    method: 'PUT',
    body: serialize(doc),
    headers: { ...(base ? { 'X-Base-Modified': String(base) } : {}), ...(overwrite ? { 'X-Overwrite': '1' } : {}) },
  }),
  /** Versões antigas guardadas de um projeto: [{ id, modified, size }]. */
  versions: (file) => call(`/projects/${encodeURIComponent(file)}/versions`),
  /** Conteúdo de uma versão antiga. */
  loadVersion: (file, id) => call(`/projects/${encodeURIComponent(file)}/versions/${encodeURIComponent(id)}`),
};
