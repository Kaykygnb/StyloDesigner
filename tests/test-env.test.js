import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { isolatedServerEnv } from './helpers/test-env.mjs';

const hostile = { ...process.env, DESIGNER_DB: '/nao-usar-banco', STYLO_BLOB_DIR: '/nao-usar-blobs', STYLO_SECRET_KEY: 'segredo-herdado', PEXELS_API_KEY: 'chave-herdada', PIXABAY_API_KEY: 'chave-herdada' };

test('setup global limpa banco, blobs e credenciais herdados sem conectar a banco', () => {
  const result = execFileSync(process.execPath, ['--import', './tests/_setup.mjs', '--input-type=module', '-e', 'console.log(JSON.stringify(Object.fromEntries(["DESIGNER_DB", "STYLO_BLOB_DIR", "STYLO_SECRET_KEY", "PEXELS_API_KEY", "PIXABAY_API_KEY"].map(key => [key, process.env[key]]))))'], { env: hostile, encoding: 'utf8' });
  const env = JSON.parse(result);
  assert.equal(env.DESIGNER_DB, 'memory');
  assert.equal(env.STYLO_BLOB_DIR, 'memory');
  assert.equal(Buffer.from(env.STYLO_SECRET_KEY, 'base64').length, 32);
  assert.notEqual(env.STYLO_SECRET_KEY, hostile.STYLO_SECRET_KEY);
  assert.equal(env.PEXELS_API_KEY, '');
  assert.equal(env.PIXABAY_API_KEY, '');
});

test('fixture isolado exige configuração própria e preserva overrides explícitos', () => {
  assert.throws(() => isolatedServerEnv({}, hostile), /DESIGNER_CONFIG próprio/);
  const env = isolatedServerEnv({ DESIGNER_CONFIG: '/fixture/config.json', STYLO_AUTH: 'accounts', STYLO_DEV: '1' }, hostile);
  assert.equal(env.DESIGNER_DB, 'memory');
  assert.equal(env.STYLO_BLOB_DIR, 'memory');
  assert.equal(env.STYLO_AUTH, 'accounts');
  assert.equal(env.STYLO_DEV, '1');
  assert.equal(env.PEXELS_API_KEY, '');
  assert.equal(env.PIXABAY_API_KEY, '');
  assert.notEqual(env.STYLO_SECRET_KEY, hostile.STYLO_SECRET_KEY);
  assert.equal(hostile.DESIGNER_DB, '/nao-usar-banco', 'não muta o ambiente recebido');
});
