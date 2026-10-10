// Versão do formato do projeto (.json): projeto sem versão é tratado como v1; projeto de uma versão MAIS NOVA que a
// deste Stylo abre com aviso (nada some em silêncio); a vitrine e um documento novo estão na versão atual.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORMAT_VERSION, makeDoc } from '../src/model.js';
import { sanitizeDoc } from '../src/validate.js';
import { buildSampleShowcase } from '../src/sample-vitrine.js';

test('FORMAT_VERSION existe e o documento novo e a vitrine estão nela', () => {
  assert.equal(typeof FORMAT_VERSION, 'number');
  assert.equal(makeDoc().version, FORMAT_VERSION);
  assert.equal(buildSampleShowcase().version, FORMAT_VERSION);
});

test('projeto sem versão ou com versão inválida vira a versão 1, sem aviso', () => {
  for (const v of [undefined, null, 'x', 0, -3, 1.5]) {
    const doc = { pages: [{ id: 'p', children: [] }], version: v };
    const warnings = sanitizeDoc(doc);
    assert.equal(doc.version, 1, String(v));
    assert.deepEqual(warnings, [], String(v));
  }
});

test('projeto de versão mais nova abre com aviso e mantém a versão original', () => {
  const doc = { pages: [{ id: 'p', children: [] }], version: FORMAT_VERSION + 4 };
  const warnings = sanitizeDoc(doc);
  assert.equal(doc.version, FORMAT_VERSION + 4, 'não rebaixa a versão: regravar não pode fingir que é do formato antigo');
  assert.ok(warnings.some((w) => new RegExp(String(FORMAT_VERSION + 4)).test(w) && /mais nova/i.test(w)), warnings.join(' | '));
});

test('projeto na versão atual não gera aviso de versão', () => {
  const doc = buildSampleShowcase();
  assert.deepEqual(sanitizeDoc(doc).filter((w) => /vers/i.test(w)), []);
});
