/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  server.js — SERVIDOR ESTÁTICO MÍNIMO (opcional)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Por que existe: o app usa módulos ES (`import ... from`), e o navegador não os carrega abrindo o
 *  index.html direto do disco (file://); precisa de http://. Este servidor entrega os arquivos e mais nada.
 *  Qualquer outro servidor estático serve igual (ex.: `python3 -m http.server`).
 *  Uso:  npm start   →   http://localhost:5173
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Pasta do projeto (onde está este arquivo). Tudo que o servidor entrega é lido a partir daqui. */
const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
/** Porta HTTP. Padrão 5173; mude com `PORT=8080 npm start`. */
const port = Number(process.env.PORT) || 5173;
/** Lista branca: SÓ estes caminhos são servidos (o app em si). package.json, .git, tests etc. nunca saem pela rede. */
const allowed = ['index.html', 'src', 'assets'];

/** Tipo MIME por extensão. O de .js precisa ser text/javascript, senão o navegador recusa carregar módulos ES. */
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/**
 * Servidor HTTP mínimo (sem dependências). Para cada pedido: resolve o caminho, confere a lista branca e o
 * "path traversal" (um pedido como /../../etc/passwd não pode sair da pasta), lê o arquivo e devolve com o tipo certo.
 * `Cache-Control: no-cache` para você ver as mudanças do código ao recarregar a página.
 */
createServer(async (req, res) => {
  try {
    // pega só o caminho da URL (sem ?query) e decodifica %xx; "/" vira index.html
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') path = '/index.html';
    // caminho absoluto no disco; `rel` = caminho relativo à pasta do projeto
    const file = resolve(join(root, normalize(path)));
    const rel = file.slice(root.length + 1);
    // Barra: fora da pasta do projeto (path traversal) OU fora da lista branca → 404 (sem revelar que o arquivo existe)
    if (!file.startsWith(root) || !allowed.some((a) => rel === a || rel.startsWith(a + '/'))) {
      res.writeHead(404).end('Not found');
      return;
    }
    if (!(await stat(file)).isFile()) throw new Error('not a file');
    // tudo certo: devolve o arquivo
    res.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end('Not found');
  }
// escuta só em 127.0.0.1 (localhost): ninguém na sua rede consegue acessar o servidor
}).listen(port, '127.0.0.1', () => {
  console.log(`\n  Projeto Designer rodando em  http://localhost:${port}\n`);
});
