import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeAccount, normalizeAccount, emptyAccount, MAX_AVATAR } from '../server/account.js';

test('conta local: valida, limita e carimba datas', () => {
  const a = mergeAccount(emptyAccount(), { name: '  Kayky\n Silva  ' + 'x'.repeat(100), email: 'k@exemplo.com', role: 'Designer', color: '#5CC98F', language: 'en', foo: 1 });
  assert.equal(a.name.length, 60);
  assert.ok(!a.name.includes('\n'));
  assert.equal(a.email, 'k@exemplo.com');
  assert.equal(a.color, '#5cc98f');
  assert.equal(a.language, 'en');
  assert.equal(a.foo, undefined);
  assert.ok(a.createdAt && a.updatedAt);
  const b = mergeAccount(a, { role: 'Dev' });
  assert.equal(b.createdAt, a.createdAt);
  assert.equal(b.name, a.name);
});

test('conta local: recusa valores inválidos', () => {
  assert.throws(() => mergeAccount({}, { email: 'sem-arroba' }), /E-mail/);
  assert.throws(() => mergeAccount({}, { color: 'red' }), /Cor/);
  assert.throws(() => mergeAccount({}, { language: 'xx' }), /Idioma/);
  assert.throws(() => mergeAccount({}, { avatar: 'javascript:alert(1)' }), /imagem/);
  assert.throws(() => mergeAccount({}, { avatar: 'data:image/png;base64,' + 'A'.repeat(MAX_AVATAR) }), /grande/);
  assert.equal(mergeAccount({}, { email: '', avatar: '' }).email, '');
});

test('conta local: arquivo corrompido não derruba os outros campos', () => {
  const a = normalizeAccount({ name: 'Ana', color: 'roxo', email: 'ruim' });
  assert.equal(a.name, 'Ana');
  assert.equal(a.color, '#4c8dff');
  assert.equal(a.email, '');
  assert.deepEqual(normalizeAccount(null), emptyAccount());
});
