import test from 'node:test';
import assert from 'node:assert/strict';

// ---- fakes mínimos de IndexedDB / localStorage / sessionStorage (restaurados no final) ----
const GLOBALS = ['indexedDB', 'localStorage', 'sessionStorage', 'BroadcastChannel'];
const saved = {};
for (const k of GLOBALS) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
const setGlobal = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });

function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    _m: m,
  };
}

function makeIdb() {
  const ctl = { failOpen: 0, failTx: false, data: new Map() };
  const later = (fn) => setTimeout(fn, 0);
  const db = {
    createObjectStore() {},
    transaction() {
      if (ctl.failTx) throw new Error('IDB caiu no meio da sessão');
      const t = {};
      const req = (compute) => { const r = {}; later(() => { r.result = compute(); r.onsuccess?.(); }); return r; };
      const store = {
        get: (k) => req(() => structuredClone(ctl.data.get(k))),
        put: (v, k) => { ctl.data.set(k, structuredClone(v)); },
        delete: (k) => { ctl.data.delete(k); },
        getAll: () => req(() => [...ctl.data.values()].map((v) => structuredClone(v))),
        getAllKeys: () => req(() => [...ctl.data.keys()]),
      };
      t.objectStore = () => store;
      setTimeout(() => t.oncomplete?.(), 5);
      return t;
    },
  };
  ctl.indexedDB = {
    open() {
      const r = {};
      later(() => {
        if (ctl.failOpen > 0) { ctl.failOpen--; r.error = new Error('falha transitória'); r.onerror?.(); return; }
        r.result = db; r.onupgradeneeded?.(); r.onsuccess?.();
      });
      return r;
    },
  };
  return ctl;
}

let n = 0;
const freshStorage = () => import(`../src/storage.js?t=${++n}`);
const D = (name) => ({ doc: { name, pages: [{ id: 'p1' }] } });

function setup(t) {
  const ctl = makeIdb();
  setGlobal('indexedDB', ctl.indexedDB);
  setGlobal('localStorage', makeStorage());
  setGlobal('sessionStorage', makeStorage());
  setGlobal('BroadcastChannel', undefined);
  t.after(() => {
    for (const k of GLOBALS) {
      if (saved[k]) Object.defineProperty(globalThis, k, saved[k]); else delete globalThis[k];
    }
  });
  return ctl;
}

test('A: IndexedDB cai no meio da sessão; ao recarregar abre a cópia mais nova do localStorage', async (t) => {
  const ctl = setup(t);
  const s1 = await freshStorage();
  assert.equal(await s1.loadLocal(), null);
  await s1.saveLocal(D('antigo'));
  ctl.failTx = true;
  await s1.saveLocal(D('novo depois da falha'));
  ctl.failTx = false;

  const s2 = await freshStorage();
  const loaded = await s2.loadLocal();
  assert.equal(loaded.doc.name, 'novo depois da falha');
  // o próximo salvamento (IndexedDB de volta) não pode virar conflito e deve limpar a cópia antiga do localStorage
  await s2.saveLocal(D('mais novo ainda'));
  assert.equal(globalThis.localStorage.getItem('projeto-designer:v1'), null);
  const s3 = await freshStorage();
  assert.equal((await s3.loadLocal()).doc.name, 'mais novo ainda');
});

test('A: sem falha, a cópia do IndexedDB continua sendo aberta', async (t) => {
  setup(t);
  const s1 = await freshStorage();
  await s1.loadLocal();
  await s1.saveLocal(D('so idb'));
  const s2 = await freshStorage();
  assert.equal((await s2.loadLocal()).doc.name, 'so idb');
});

test('B: falha transitória ao abrir o IndexedDB não o desliga para sempre', async (t) => {
  const ctl = setup(t);
  const s = await freshStorage();
  ctl.failOpen = 1;
  assert.equal(await s.loadLocal(), null);
  ctl.data.set('current', { ...D('guardado'), revision: 3 });
  const loaded = await s.loadLocal();
  assert.equal(loaded?.doc.name, 'guardado');
});

test('B: falha permanente não entra em loop e não apaga dados', async (t) => {
  const ctl = setup(t);
  const s = await freshStorage();
  ctl.failOpen = 1000;
  localStorage.setItem('projeto-designer:v1', JSON.stringify({ ...D('legado'), revision: 0 }));
  assert.equal((await s.loadLocal()).doc.name, 'legado');
  assert.equal((await s.loadLocal()).doc.name, 'legado');
  assert.ok(localStorage.getItem('projeto-designer:v1'));
});

// ---------------------------------------------------------------- C: saveNow informa sucesso; open não descarta
import { createStore } from '../src/store.js';
import { makeDoc } from '../src/model.js';
import { createSaving } from '../src/saving.js';

test('C: saveNow resolve true quando grava e false quando falha', async () => {
  let fail = false;
  const store = createStore({ initial: { doc: makeDoc() }, persist: async () => { if (fail) throw new Error('x'); return 'browser'; } });
  store.touch();
  assert.equal(await store.saveNow(), true);
  fail = true;
  store.touch();
  assert.equal(await store.saveNow(), false);
  assert.equal(await store.saveNow(), false, 'continua pendente: nova tentativa também falha');
  fail = false;
  assert.equal(await store.saveNow(), true);
});

test('C: saveNow durante uma gravação só resolve depois do re-save', async () => {
  const writes = [];
  const store = createStore({ initial: { doc: makeDoc() }, persist: () => new Promise((r) => writes.push(r)) });
  store.touch();
  store.saveNow();
  store.touch();
  let done = false;
  const second = store.saveNow().then((ok) => { done = true; return ok; });
  writes[0]('browser');
  await new Promise((r) => setImmediate(r));
  assert.equal(writes.length, 2);
  assert.equal(done, false, 'não pode resolver antes do re-save terminar');
  writes[1]('browser');
  assert.equal(await second, true);
});

function savingWith(saveOk) {
  const loaded = [];
  const store = { ui: {}, state: { doc: {} }, saveNow: async () => saveOk, loadDoc: (...a) => loaded.push(a), emit() {}, touch() {} };
  const saving = createSaving({ prefs: {}, toast() {} });
  saving.attach(store);
  return { saving, loaded };
}
const withFolder = (t, fn) => {
  const orig = globalThis.fetch;
  globalThis.fetch = fn;
  t.after(() => { globalThis.fetch = orig; });
};
const okFetch = async () => ({ ok: true, headers: { get: () => '1' }, json: async () => ({ pages: [{ id: 'p' }] }) });

test('C: open/openVersion não carregam outro projeto se o salvamento falhou', async (t) => {
  withFolder(t, okFetch);
  const { saving, loaded } = savingWith(false);
  await assert.rejects(() => saving.open('a.json'), /O projeto atual não foi salvo/);
  await assert.rejects(() => saving.openVersion('a.json', 'v1'), /O projeto atual não foi salvo/);
  assert.equal(loaded.length, 0);
});

test('C: open/openVersion seguem o fluxo normal quando salvou', async (t) => {
  withFolder(t, okFetch);
  const { saving, loaded } = savingWith(true);
  await saving.open('a.json');
  await saving.openVersion('a.json', 'v1');
  assert.equal(loaded.length, 2);
});

// ---- achados da revisão independente (empate de revisão, cópia velha com revisão alta, callback de erro que lança)
const LEGACY = 'projeto-designer:v1';
const putFallback = (rec) => globalThis.localStorage.setItem(LEGACY, JSON.stringify({ doc: { name: rec.name, pages: [{ id: 'p1' }] }, revision: rec.revision, savedAt: rec.savedAt }));

test('A: empate de revisão NÃO é decidido pelo relógio (o IndexedDB vence)', async (t) => {
  setup(t);
  const s1 = await freshStorage();
  await s1.loadLocal();
  await s1.saveLocal(D('do IndexedDB')); // revisão 1
  putFallback({ name: 'divergente', revision: 1, savedAt: Date.now() + 60000 }); // mesma revisão, relógio "mais novo"
  const loaded = await (await freshStorage()).loadLocal();
  assert.equal(loaded.doc.name, 'do IndexedDB');
});

test('A: cópia velha do localStorage com revisão alta não vence um salvamento posterior no IndexedDB', async (t) => {
  setup(t);
  const s1 = await freshStorage();
  await s1.loadLocal();
  await s1.saveLocal(D('salvo depois')); // revisão 1, savedAt agora
  putFallback({ name: 'restos de uma queda antiga', revision: 13, savedAt: Date.now() - 3600000 });
  const loaded = await (await freshStorage()).loadLocal();
  assert.equal(loaded.doc.name, 'salvo depois');
});

test('C: onSaveError que lança não trava os próximos salvamentos', async () => {
  let fail = true;
  const store = createStore({ initial: { doc: makeDoc() }, persist: async () => { if (fail) throw new Error('x'); return 'browser'; } });
  store.onSaveError = () => { throw new Error('o aviso também falhou'); };
  store.touch();
  assert.equal(await store.saveNow(), false);
  fail = false;
  store.touch();
  assert.equal(await store.saveNow(), true, 'a próxima tentativa acontece de verdade');
});
