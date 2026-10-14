// Liga o Stylo: prepara o editor na primeira vez (ou quando o código dele mudou) e sobe o servidor.
//   npm start       → editor já compilado (rápido e leve)
//   npm run dev     → editor em modo desenvolvimento (Vite, recarrega sozinho; mais pesado) — igual a `node scripts/start.mjs --dev`
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const studio = join(root, 'apps', 'studio');
const built = join(studio, 'dist', 'index.html');

const newest = (dir) => {
  let latest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    latest = Math.max(latest, entry.isDirectory() ? newest(path) : statSync(path).mtimeMs);
  }
  return latest;
};
const sources = () => Math.max(newest(join(studio, 'src')), newest(join(studio, 'public')), statSync(join(studio, 'index.html')).mtimeMs, newest(join(root, 'packages', 'core', 'src')));

const dev = process.argv.includes('--dev');
if (!dev && (!existsSync(built) || statSync(built).mtimeMs < sources())) {
  console.log('\n  Preparando o editor (só na primeira vez ou depois de uma atualização)…');
  const build = spawnSync(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], { cwd: studio, stdio: 'inherit' });
  if (build.status !== 0) { console.error('\n  Não consegui preparar o editor. Veja o erro acima.'); process.exit(build.status || 1); }
}

const server = spawn(process.execPath, ['--import', 'tsx', join(root, 'apps', 'server', 'src', 'main.ts')], { cwd: root, stdio: 'inherit', env: dev ? { ...process.env, STYLO_DEV: '1' } : process.env });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
