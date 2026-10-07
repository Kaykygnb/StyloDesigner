// Roda todas as suítes de navegador em sequência e sai com código ≠ 0 se QUALQUER uma falhar
// (assim o terminal/CI não ficam "verdes" quando uma verificação falha).
// Uso: npm run test:e2e   (precisa do servidor em http://localhost:5173 ou APP_URL, e do Playwright instalado)
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const suites = readdirSync(dir).filter((f) => f.endsWith('.mjs') && f !== 'rodar-todos.mjs').sort();
const failed = [];
for (const s of suites) {
  console.log(`\n=== ${s} ===`);
  // stdio herdado: a saída de cada suíte aparece em tempo real
  const r = spawnSync(process.execPath, [dir + s], { stdio: 'inherit' });
  if (r.status !== 0) failed.push(s);
}
console.log(failed.length ? `\n${failed.length}/${suites.length} suíte(s) falharam: ${failed.join(', ')}` : `\nTodas as ${suites.length} suítes passaram.`);
process.exitCode = failed.length ? 1 : 0;
