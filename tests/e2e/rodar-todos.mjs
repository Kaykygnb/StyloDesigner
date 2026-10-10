// Roda todas as suítes de navegador em sequência e sai com código ≠ 0 se QUALQUER uma falhar
// (assim o terminal/CI não ficam "verdes" quando uma verificação falha).
//
// Uso:
//   npm run test:e2e                 sobe um servidor ISOLADO (porta livre, pasta de projetos temporária) e roda tudo
//   npm run test:e2e -- foto vitrine roda só as suítes cujo nome contém algum dos textos
//   APP_URL=http://localhost:5173/ npm run test:e2e   usa um servidor que você já subiu (não sobe nem apaga nada)
// Variáveis: E2E_TIMEOUT_MS (limite por suíte, padrão 240000). Precisa do Playwright instalado.
//
// O servidor isolado existe para que os testes nunca leiam nem gravem nos SEUS projetos e para que a bateria não
// dependa da porta 5173 estar livre.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
const timeout = Number(process.env.E2E_TIMEOUT_MS) || 240000;
const filters = process.argv.slice(2);
const suites = readdirSync(dir)
  .filter((f) => f.endsWith('.mjs') && f !== 'rodar-todos.mjs')
  .filter((f) => !filters.length || filters.some((t) => f.includes(t)))
  .sort();

/** Pede ao sistema uma porta livre. */
const freePort = () => new Promise((resolve, reject) => {
  const s = createServer();
  s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

/** Espera o servidor responder (até ~15 s). */
async function waitReady(url) {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(new URL('api/status', url))).ok) return; } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`O servidor isolado não respondeu em ${url}`);
}

let server = null;
let tmp = null;
let appUrl = process.env.APP_URL;
if (!appUrl) {
  tmp = mkdtempSync(join(tmpdir(), 'stylo-e2e-'));
  const port = await freePort();
  appUrl = `http://localhost:${port}/`;
  // pasta de projetos e conta DENTRO do diretório temporário: nada toca em ./projetos nem em designer.*.json do repositório
  writeFileSync(join(tmp, 'config.json'), JSON.stringify({ folder: join(tmp, 'projetos'), keepVersions: 5 }));
  server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DESIGNER_CONFIG: join(tmp, 'config.json') },
    stdio: 'ignore',
  });
  server.on('exit', (code) => { if (code) console.error(`servidor isolado encerrou com código ${code}`); });
  await waitReady(appUrl);
  console.log(`Servidor isolado em ${appUrl} (dados em ${tmp})`);
}

const failed = [];
try {
  for (const s of suites) {
    console.log(`\n=== ${s} ===`);
    // stdio herdado: a saída de cada suíte aparece em tempo real; o limite evita que uma suíte travada (rede, por
    // exemplo) pare a bateria inteira
    const r = spawnSync(process.execPath, [dir + s], { stdio: 'inherit', env: { ...process.env, APP_URL: appUrl }, timeout });
    if (r.error?.code === 'ETIMEDOUT' || r.signal) { console.error(`TEMPO ESGOTADO (${timeout} ms): ${s}`); failed.push(`${s} (tempo esgotado)`); }
    else if (r.status !== 0) failed.push(s);
  }
} finally {
  if (server) server.kill();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
}
console.log(failed.length ? `\n${failed.length}/${suites.length} suíte(s) falharam: ${failed.join(', ')}` : `\nTodas as ${suites.length} suítes passaram.`);
process.exitCode = failed.length ? 1 : 0;
