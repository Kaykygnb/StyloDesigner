// A Referência do código (docs/REFERENCIA.md) é gerada dos comentários /** ... */. Este teste falha quando alguém
// muda um comentário ou uma função e esquece de regenerar: rode `npm run docs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('docs/REFERENCIA.md está em dia com os comentários do código (npm run docs)', () => {
  const script = fileURLToPath(new URL('../scripts/gerar-referencia.mjs', import.meta.url));
  assert.doesNotThrow(() => execFileSync(process.execPath, [script, '--check'], { stdio: 'pipe' }),
    'docs/REFERENCIA.md está desatualizado. Rode: npm run docs');
});
