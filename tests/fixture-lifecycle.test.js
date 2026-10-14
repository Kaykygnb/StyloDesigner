import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cleanupFixture, stopChild } from './helpers/fixture-lifecycle.mjs';

test('fixture: encerra processo real antes de remover o diretório', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'stylo-cleanup-'));
  const child = spawn(process.execPath, ['-e', "process.stdout.write('ready'); setInterval(() => {}, 1000)"], { stdio: ['ignore', 'pipe', 'ignore'] });
  t.after(async () => { await stopChild(child); await rm(dir, { recursive: true, force: true }); });
  await once(child.stdout, 'data');
  await writeFile(join(dir, 'marker'), 'owned');
  await cleanupFixture({ children: [child], dir });
  assert.ok(child.exitCode !== null || child.signalCode !== null, 'saída confirmada, não apenas sinal enviado');
  await assert.rejects(stat(dir), { code: 'ENOENT' });
  await stopChild(child); // idempotente após saída
});

test('fixture: falha de parada preserva arquivos e não oculta erro', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'stylo-cleanup-fail-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'marker'), 'owned');
  await assert.rejects(cleanupFixture({ dir, clients: [{ close: async () => { throw new Error('falha de parada'); } }] }), AggregateError);
  assert.equal(await readFile(join(dir, 'marker'), 'utf8'), 'owned');
  await assert.rejects(cleanupFixture({ dir, initializing: true }), AggregateError);
  assert.equal(await readFile(join(dir, 'marker'), 'utf8'), 'owned', 'startup em execução também preserva os dados');
});

test('fixture: processo que ignora SIGTERM é encerrado com prazo e saída confirmada', { skip: process.platform === 'win32' }, async (t) => {
  const child = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); process.stdout.write('ready'); setInterval(() => {}, 1000)"], { stdio: ['ignore', 'pipe', 'ignore'] });
  t.after(() => stopChild(child, 100));
  await once(child.stdout, 'data');
  await stopChild(child, 100);
  assert.equal(child.signalCode, 'SIGKILL');
});
