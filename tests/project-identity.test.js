import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { createProjectId, forkProject, makeDoc } from '../src/model.js';

test('cada novo projeto recebe identidade estável e distinta', () => {
  const first = makeDoc();
  const second = makeDoc();
  assert.match(first.projectId, /^[0-9a-f-]{36}$/i);
  assert.notEqual(first.projectId, second.projectId);
});

test('carregar documento legado cria ID uma vez e mantém o mesmo nas próximas cargas', () => {
  const store = createStore({ initial: { doc: makeDoc() }, persist: async () => 'browser' });
  const legacy = { version: 1, name: 'Legado', pages: [{ id: 'p1', name: 'Página 1', children: [] }] };
  store.loadDoc(legacy);
  const migratedId = legacy.projectId;
  assert.ok(migratedId);
  store.loadDoc(legacy);
  assert.equal(legacy.projectId, migratedId);
});

test('duplicar projeto preserva os dados e cria identidade nova', () => {
  const original = makeDoc();
  const copy = forkProject(original);
  assert.notEqual(copy.projectId, original.projectId);
  assert.equal(copy.name, original.name);
  assert.equal(original.projectId.length, 36);
});

test('fallback de identidade de projeto permanece não vazio sem crypto.randomUUID', () => {
  assert.ok(createProjectId());
});
