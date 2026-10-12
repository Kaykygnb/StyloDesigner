/**
 * server/web.js — ENTREGA O EDITOR (apps/web) NO NAVEGADOR
 *
 * - Produção: se existe apps/web/dist (npm run build), serve os arquivos de lá, só de dentro dessa pasta.
 * - Desenvolvimento: sem dist, sobe o Vite em "middleware mode" na MESMA porta (carregado só no 1º pedido de página,
 *   para quem usa só a API/MCP não pagar o custo). Assim há uma única origem e nada de CORS.
 */

import { stat, readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.map': 'application/json',
};

/**
 * @param {object} deps
 * @param {string} deps.webRoot  pasta apps/web
 * @param {import('node:http').Server} deps.httpServer  servidor HTTP (o Vite usa para o recarregamento ao vivo)
 * @param {string} [deps.base]  prefixo onde o app mora ("/" para o editor legado; "/studio/" para o painel novo)
 * @returns {(req, res, pathname: string) => Promise<void>}
 */
/** No modo Vite só estas rotas existem; package.json, vite.config.js e dotfiles da pasta do editor nunca saem. */
const DEV_ALLOWED = /^\/($|index\.html$|src\/|assets\/|@vite\/|@react-refresh$|@fs\/|@id\/|node_modules\/\.vite\/|__vite)/;

export function createWebHandler({ webRoot, httpServer, base = '/' }) {
  const dist = join(webRoot, 'dist');
  /** Caminho sem o prefixo do app ("/studio/src/x" → "/src/x"). */
  const inner = (pathname) => (base === '/' ? pathname : pathname.startsWith(base) ? '/' + pathname.slice(base.length) : pathname === base.slice(0, -1) ? '/' : pathname);
  let mode = null; // 'dist' | 'vite'
  let vite = null;

  async function pickMode() {
    if (mode) return mode;
    mode = process.env.STYLO_DEV !== '1' && (await stat(join(dist, 'index.html')).then(() => true, () => false)) ? 'dist' : 'vite';
    if (mode === 'vite') {
      const { createServer } = await import('vite');
      vite = await createServer({
        root: webRoot, base, appType: 'mpa', clearScreen: false, logLevel: 'warn',
        server: { middlewareMode: true, hmr: { server: httpServer }, fs: { strict: true } },
      });
    }
    return mode;
  }

  async function serveDist(res, pathname) {
    const rel = pathname === '/' ? 'index.html' : normalize(pathname).replace(/^[/\\]+/, '');
    const file = resolve(dist, rel);
    if (!file.startsWith(resolve(dist) + sep)) { res.writeHead(404).end('Not found'); return; }
    try {
      if (!(await stat(file)).isFile()) throw new Error('not a file');
    } catch {
      res.writeHead(404).end('Not found'); // arquivos inexistentes não caem no index.html: o editor não tem rotas de cliente
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  }

  return async function handle(req, res, pathname) {
    if (await pickMode() === 'dist') return serveDist(res, inner(pathname));
    if (!DEV_ALLOWED.test(inner(pathname)) || pathname.includes('..')) { res.writeHead(404).end('Not found'); return; }
    await new Promise((done, fail) => vite.middlewares(req, res, (err) => (err ? fail(err) : done())));
    if (!res.writableEnded) res.writeHead(404).end('Not found');
  };
}
