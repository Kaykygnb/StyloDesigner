import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { isolatedServerEnv } from './helpers/test-env.mjs';

const hostile = { ...process.env, DATABASE_URL: 'sentinela-invalida', DESIGNER_DB_DIR: '/nao-usar-banco', STYLO_BLOB_DIR: '/nao-usar-blobs', STYLO_SECRET_KEY: 'segredo-herdado', PEXELS_API_KEY: 'chave-herdada', PIXABAY_API_KEY: 'chave-herdada' };

test('setup global limpa URL, blobs e credenciais herdados sem conectar a banco', () => {
  const result = execFileSync(process.execPath, ['--import', './tests/_setup.mjs', '--input-type=module', '-e', 'console.log(JSON.stringify(Object.fromEntries(["DATABASE_URL", "DESIGNER_DB_DIR", "STYLO_BLOB_DIR", "STYLO_SECRET_KEY", "PEXELS_API_KEY", "PIXABAY_API_KEY"].map(key => [key, process.env[key]]))))'], { env: hostile, encoding: 'utf8' });
  const env = JSON.parse(result);
  assert.equal(env.DATABASE_URL, '');
  assert.equal(env.DESIGNER_DB_DIR, 'memory');
  assert.equal(env.STYLO_BLOB_DIR, 'memory');
  assert.equal(Buffer.from(env.STYLO_SECRET_KEY, 'base64').length, 32);
  assert.notEqual(env.STYLO_SECRET_KEY, hostile.STYLO_SECRET_KEY);
  assert.equal(env.PEXELS_API_KEY, '');
  assert.equal(env.PIXABAY_API_KEY, '');
});

test('fixture isolado exige configuração própria e preserva overrides explícitos', () => {
  assert.throws(() => isolatedServerEnv({}, hostile), /DESIGNER_CONFIG próprio/);
  const env = isolatedServerEnv({ DESIGNER_CONFIG: '/fixture/config.json', STYLO_AUTH: 'accounts', STYLO_DEV: '1' }, hostile);
  assert.equal(env.DATABASE_URL, '');
  assert.equal(env.DESIGNER_DB_DIR, 'memory');
  assert.equal(env.STYLO_BLOB_DIR, 'memory');
  assert.equal(env.STYLO_AUTH, 'accounts');
  assert.equal(env.STYLO_DEV, '1');
  assert.equal(env.PEXELS_API_KEY, '');
  assert.equal(env.PIXABAY_API_KEY, '');
  assert.notEqual(env.STYLO_SECRET_KEY, hostile.STYLO_SECRET_KEY);
  const ownedUrl = 'postgresql://127.0.0.1:1/fixture-owned';
  assert.equal(isolatedServerEnv({ DESIGNER_CONFIG: '/fixture/config.json', DATABASE_URL: ownedUrl }, hostile).DATABASE_URL, ownedUrl);
  assert.equal(hostile.DATABASE_URL, 'sentinela-invalida', 'não muta o ambiente recebido');
});
