// Teste HTTP do server.js: sobe o servidor real numa porta livre e confere o que ele entrega e o que bloqueia.
// Protege contra a regressão do Windows (assets em subpastas davam 404 → tela em branco).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 5900 + Math.floor(Math.random() * 90);
let child;
test.before(async () => {
  child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok) => child.stdout.once('data', ok)); // espera a mensagem "rodando em ..."
});
test.after(() => child.kill());
const get = (p) => fetch(`http://127.0.0.1:${port}${p}`);

test('entrega a página e os assets em subpastas', async () => {
  for (const p of ['/', '/src/main.js', '/src/styles/app.css', '/src/ui/props.js']) assert.equal((await get(p)).status, 200, p);
});
test('bloqueia arquivos privados e path traversal', async () => {
  for (const p of ['/package.json', '/.git/config', '/server.js', '/tests/css.test.js', '/src/../package.json', '/%2e%2e/package.json', '/src/%5c..%5cpackage.json']) {
    assert.equal((await get(p)).status, 404, p);
  }
});
test('arquivo inexistente é 404', async () => assert.equal((await get('/src/nao-existe.js')).status, 404));
