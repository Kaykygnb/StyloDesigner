import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatNumber, formatRelativeTime, t, tp } from '../apps/studio/src/lib/i18n';

test('i18n traduz o shell e faz fallback seguro para chave ausente', () => {
  assert.equal(t('pt-BR', 'top.present'), 'Apresentar');
  assert.equal(t('en-US', 'top.present'), 'Present');
  assert.equal(t('en-US', 'tool.inspect'), 'Inspect (F12)');
  assert.equal(t('en-US', 'library.search'), 'Search name, type, tag, or credit');
  assert.equal(t('pt-BR', 'agents.testConnection'), 'Testar conexão');
  assert.equal(t('en-US', 'login.changeTitle'), 'Change your password');
  assert.equal(t('pt-BR', 'login.changeHint', { email: 'dono@exemplo.com' }), 'A senha temporária de dono@exemplo.com precisa ser trocada antes de acessar o painel.');
  assert.equal(t('pt-BR', 'admin.pluginCategory.asset-provider'), 'provedor de assets');
  assert.equal(t('en-US', 'admin.pluginCategory.asset-provider'), 'asset provider');
  assert.equal(t('en-US', 'admin.source'), 'Official source');
  assert.equal(t('pt-BR', 'admin.assetKinds.model3d'), 'modelo 3D');
  assert.equal(t('en-US', 'media.audio'), 'Audio');
  assert.equal(t('pt-BR', 'media.hint'), 'O arquivo fica no asset usado pela camada. O tipo define o player no canvas e na exportação.');
  assert.equal(t('pt-BR', 'missing.key'), 'missing.key');
  assert.equal(t('pt-BR', 'icons.searchLabel'), 'Buscar ícone');
  assert.equal(t('en-US', 'icons.searchLabel'), 'Search icon');
  assert.equal(t('en-US', 'prototype.present'), 'Present (Ctrl+Alt+Enter)');
  assert.equal(t('pt-BR', 'versions.restoreQuestion'), 'Restaurar esta versão?');
});

test('i18n interpola, pluraliza e formata por idioma', () => {
  assert.equal(t('en-US', 'collab.people', { count: 3 }), '3 person|3 people');
  assert.equal(tp('pt-BR', 'collab.people', 1), '1 pessoa');
  assert.equal(tp('en-US', 'collab.people', 3), '3 people');
  assert.equal(formatNumber('en-US', 1234.5), '1,234.5');
  assert.equal(formatNumber('pt-BR', 1234.5), '1.234,5');
  assert.match(formatDate('en-US', '2026-01-02T12:00:00Z'), /1\/2\/2026/);
  const now = Date.parse('2026-01-02T12:00:00Z');
  assert.equal(formatRelativeTime('pt-BR', '2026-01-02T11:58:00Z', now), 'há 2 min');
  assert.equal(formatRelativeTime('en-US', '2026-01-01T12:00:00Z', now), 'yesterday');
});
