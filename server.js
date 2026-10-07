/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  server.js — SERVIDOR LOCAL: ENTREGA O APP E SALVA OS PROJETOS NUMA PASTA DO SEU COMPUTADOR
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Duas funções:
 *   1. ESTÁTICO: entrega index.html, src/ e assets/. O app usa módulos ES (`import ... from`), e o navegador
 *      não os carrega abrindo o index.html direto do disco (file://); precisa de http://.
 *   2. API /api/...: grava e lê projetos (.json) numa PASTA que você escolhe em Configurações (padrão:
 *      ./projetos). Guarda também VERSÕES antigas de cada projeto (no máximo 1 a cada 10 minutos).
 *      Dica: aponte a pasta para dentro do Google Drive/OneDrive/Dropbox para ter cópia na nuvem.
 *
 *  Uso:  npm start   →   http://localhost:5173
 *  Variáveis: PORT (porta), DESIGNER_CONFIG (arquivo de configuração; padrão ./designer.config.json).
 *
 *  SEGURANÇA (o servidor escreve no seu disco, então isto importa):
 *   - escuta só em 127.0.0.1: ninguém da sua rede alcança;
 *   - a API recusa pedidos cujo cabeçalho Host não seja localhost/127.0.0.1 (bloqueia "DNS rebinding":
 *     um site malicioso fingindo ser localhost);
 *   - pedidos que ESCREVEM exigem Content-Type JSON e, se vierem de uma página, Origin local. Assim um site
 *     aberto em outra aba não consegue mandar o servidor gravar nada (o navegador bloqueia antes);
 *   - nomes de arquivo passam por uma lista estrita (letras, números, - _ .) e terminam em .json: não dá para
 *     escapar da pasta com "../" nem sobrescrever outros tipos de arquivo.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { createServer } from 'node:http';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, isAbsolute, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Pasta do projeto (onde está este arquivo). Tudo que o servidor entrega é lido a partir daqui. */
const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
/** Porta HTTP. Padrão 5173; mude com `PORT=8080 npm start`. */
const port = Number(process.env.PORT) || 5173;
/** Lista branca: SÓ estes caminhos são servidos (o app em si). package.json, .git, tests, projetos etc. nunca saem por aqui. */
const allowed = ['index.html', 'src', 'assets'];
/** Arquivo onde a configuração (pasta escolhida, nº de versões) é lembrada entre execuções. Fica fora do git (.gitignore). */
const configFile = resolve(process.env.DESIGNER_CONFIG || join(root, 'designer.config.json'));
/** Configuração padrão: pasta ./projetos ao lado do app, guardando até 20 versões por projeto. */
const DEFAULTS = { folder: join(root, 'projetos'), keepVersions: 20 };
/** Intervalo mínimo entre duas versões guardadas do mesmo projeto (o auto-salvar grava a cada poucos segundos; versões não). */
const VERSION_EVERY_MS = 10 * 60 * 1000;
/** Tamanho máximo aceito para um projeto (imagens embutidas deixam o .json grande). */
const MAX_BODY = 200 * 1024 * 1024;
/** Nome de arquivo aceito: começa com letra/número, só usa letras, números, ponto, - e _, e termina em .json. */
const FILE_RE = /^[a-z0-9][a-z0-9._-]{0,90}\.json$/i;

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

// ---------------------------------------------------------------- configuração
/** Lê a configuração salva (ou a padrão, se ainda não existir / estiver corrompida). */
async function loadConfig() {
  try {
    const saved = JSON.parse(await readFile(configFile, 'utf8'));
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}
/** Configuração atual, carregada uma vez ao iniciar e atualizada pelo PUT /api/config. */
let config = await loadConfig();

/** "~/Designer" → "/home/voce/Designer" (atalho comum para a pasta do usuário). */
const expandHome = (p) => (p === '~' || p.startsWith('~/') || p.startsWith('~\\') ? join(homedir(), p.slice(1)) : p);

/**
 * Valida e aplica uma pasta nova: precisa ser caminho ABSOLUTO; é criada se não existir; e testamos se dá para
 * escrever nela (gravando e apagando um arquivo de teste) ANTES de aceitar — melhor errar agora do que no auto-salvar.
 */
async function useFolder(input) {
  const raw = expandHome(String(input || '').trim());
  if (!raw || !isAbsolute(raw)) throw httpError(400, 'Use um caminho completo, ex.: C:\\Users\\voce\\Designer ou /home/voce/Designer.');
  const folder = resolve(raw);
  await mkdir(folder, { recursive: true });
  const probe = join(folder, `.teste-escrita-${process.pid}`);
  await writeFile(probe, 'ok');
  await rm(probe, { force: true });
  return folder;
}

// ---------------------------------------------------------------- utilidades HTTP
/** Erro com status HTTP e mensagem que pode ir para a tela do usuário. */
function httpError(status, message) {
  return Object.assign(new Error(message), { status, expose: true });
}
/** Responde JSON. */
function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
/** Lê o corpo do pedido inteiro (com limite de tamanho) e devolve como texto. */
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw httpError(413, 'Projeto grande demais (limite 200 MB).');
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString('utf8');
}
/** O Host do pedido é esta máquina? (protege contra DNS rebinding) */
const localHost = (host = '') => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
/** A página que fez o pedido (Origin) é local? Pedidos sem Origin (curl, testes) são aceitos: não vêm de um site. */
const localOrigin = (origin) => !origin || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);

/** Caminho do projeto `name` dentro da pasta configurada (o nome já foi validado por FILE_RE). */
const projectPath = (name) => join(config.folder, name);
/** Pasta onde ficam as versões antigas de um projeto: <pasta>/.versoes/<nome-sem-.json>/ */
const versionsDir = (name) => join(config.folder, '.versoes', name.replace(/\.json$/i, ''));
/** Valida o nome vindo da URL. */
function checkName(name) {
  if (!FILE_RE.test(name) || name.includes('..')) throw httpError(400, 'Nome de arquivo inválido.');
  return name;
}

/** Lista as versões guardadas de um projeto, da mais nova para a mais antiga. */
async function listVersions(name) {
  try {
    const files = (await readdir(versionsDir(name))).filter((f) => FILE_RE.test(f)).sort().reverse();
    return await Promise.all(files.map(async (f) => {
      const s = await stat(join(versionsDir(name), f));
      return { id: f, modified: s.mtimeMs, size: s.size };
    }));
  } catch {
    return [];
  }
}

/**
 * Antes de sobrescrever um projeto, guarda o conteúdo ANTERIOR como versão — mas só se a última versão tiver
 * mais de 10 min (senão o auto-salvar criaria centenas). Depois apaga as mais antigas além de `keepVersions`.
 */
async function snapshotVersion(name) {
  const keep = config.keepVersions;
  if (!keep) return;
  let current;
  try { current = await readFile(projectPath(name)); } catch { return; } // projeto novo: nada a guardar
  const versions = await listVersions(name);
  if (versions[0] && Date.now() - versions[0].modified < VERSION_EVERY_MS) return;
  await mkdir(versionsDir(name), { recursive: true });
  // nome = data/hora ordenável com milissegundos (2026-10-07T14-03-22-517.json): a lista sai em ordem cronológica
  // e duas versões no mesmo segundo não se sobrescrevem
  const id = new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, '') + '.json';
  await writeFile(join(versionsDir(name), id), current);
  for (const old of (await listVersions(name)).slice(keep)) await rm(join(versionsDir(name), old.id), { force: true });
}

// ---------------------------------------------------------------- API
/**
 * Rotas da API (todas respondem JSON):
 *   GET  /api/status                         → { ok, folder, keepVersions }
 *   PUT  /api/config        { folder?, keepVersions? }  → muda a pasta / nº de versões
 *   GET  /api/projects                       → [{ file, modified, size }]
 *   GET  /api/projects/<arquivo>             → o projeto (+ cabeçalho X-Modified com a data de modificação)
 *   PUT  /api/projects/<arquivo>             → grava; responde { modified }. Envie X-Base-Modified com a data
 *        que você leu: se o arquivo mudou desde então (outra aba, outro programa), responde 409 em vez de apagar o
 *        trabalho alheio. Envie X-Overwrite: 1 para gravar mesmo assim (ex.: "Salvar como" sobre um nome existente,
 *        depois de o usuário confirmar).
 *   GET  /api/projects/<arquivo>/versions            → versões guardadas
 *   GET  /api/projects/<arquivo>/versions/<versão>   → conteúdo de uma versão
 */
async function api(req, res, path) {
  if (!localHost(req.headers.host)) throw httpError(403, 'Acesso negado.');
  const write = req.method !== 'GET' && req.method !== 'HEAD';
  if (write) {
    if (!localOrigin(req.headers.origin)) throw httpError(403, 'Acesso negado.');
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw httpError(415, 'Envie JSON.');
  }
  const parts = path.split('/').filter(Boolean).slice(1); // ['projects', 'nome.json', 'versions', ...]

  if (parts[0] === 'status' && parts.length === 1 && req.method === 'GET') return sendJson(res, 200, { ok: true, ...config });

  if (parts[0] === 'config' && parts.length === 1 && req.method === 'PUT') {
    const body = JSON.parse((await readBody(req)) || '{}');
    const next = { ...config };
    if (body.folder !== undefined) next.folder = await useFolder(body.folder);
    if (body.keepVersions !== undefined) next.keepVersions = Math.max(0, Math.min(200, Math.round(Number(body.keepVersions) || 0)));
    await writeFile(configFile, JSON.stringify(next, null, 2));
    config = next;
    return sendJson(res, 200, { ok: true, ...config });
  }

  if (parts[0] === 'projects' && parts.length === 1 && req.method === 'GET') {
    await mkdir(config.folder, { recursive: true });
    const names = (await readdir(config.folder)).filter((f) => FILE_RE.test(f));
    const list = await Promise.all(names.map(async (file) => {
      const s = await stat(projectPath(file));
      return s.isFile() ? { file, modified: s.mtimeMs, size: s.size } : null;
    }));
    return sendJson(res, 200, list.filter(Boolean).sort((a, b) => b.modified - a.modified));
  }

  if (parts[0] === 'projects' && parts[1]) {
    const name = checkName(parts[1]);
    if (parts.length === 2 && req.method === 'GET') {
      const [data, s] = await Promise.all([readFile(projectPath(name)), stat(projectPath(name))]);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Modified': String(s.mtimeMs) });
      return res.end(data);
    }
    if (parts.length === 2 && req.method === 'PUT') {
      const text = await readBody(req);
      let doc;
      try { doc = JSON.parse(text); } catch { throw httpError(400, 'O conteúdo não é JSON válido.'); }
      if (!Array.isArray(doc?.pages)) throw httpError(400, 'Isso não parece um projeto (faltam as páginas).');
      // proteção contra sobrescrever trabalho alheio: compara a data que o editor conhece com a do disco
      const cur = await stat(projectPath(name)).catch(() => null);
      const base = Number(req.headers['x-base-modified']);
      if (cur && req.headers['x-overwrite'] !== '1' && (!base || Math.abs(cur.mtimeMs - base) > 1)) {
        return sendJson(res, 409, { error: 'O arquivo foi alterado fora deste editor.', modified: cur.mtimeMs });
      }
      await mkdir(config.folder, { recursive: true });
      await snapshotVersion(name);
      // grava num arquivo temporário e só então renomeia: se a luz cair no meio, o projeto antigo continua inteiro
      const tmp = projectPath(`.${name}.${process.pid}.tmp`);
      await writeFile(tmp, text);
      await rename(tmp, projectPath(name));
      return sendJson(res, 200, { ok: true, file: name, modified: (await stat(projectPath(name))).mtimeMs });
    }
    if (parts[2] === 'versions' && parts.length <= 4 && req.method === 'GET') {
      if (parts.length === 3) return sendJson(res, 200, await listVersions(name));
      const v = checkName(parts[3]);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(await readFile(join(versionsDir(name), v)));
    }
  }
  throw httpError(404, 'Rota não encontrada.');
}

// ---------------------------------------------------------------- servidor
/**
 * Para cada pedido: /api/... vai para a API; o resto é arquivo estático. No estático, resolve o caminho, confere a
 * lista branca e o "path traversal" (um pedido como /../../etc/passwd não pode sair da pasta) e devolve o arquivo.
 * `Cache-Control: no-cache` para você ver as mudanças do código ao recarregar a página.
 */
createServer(async (req, res) => {
  const isApi = /^\/api(\/|$)/.test(req.url);
  try {
    // pega só o caminho da URL (sem ?query) e decodifica %xx; "/" vira index.html
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (isApi) return await api(req, res, path);
    if (path === '/') path = '/index.html';
    // caminho absoluto no disco; `rel` = caminho relativo à pasta do projeto
    const file = resolve(join(root, normalize(path)));
    // No Windows o separador é \ e não /: normaliza para / antes de comparar com a lista branca
    // (sem isso /src/main.js dava 404 e a tela ficava em branco).
    const rel = file.slice(root.length + 1).split(sep).join('/');
    // Barra: fora da pasta do projeto (path traversal) OU fora da lista branca → 404 (sem revelar que o arquivo existe)
    if (!(file === root || file.startsWith(root + sep)) || !allowed.some((a) => rel === a || rel.startsWith(a + '/'))) {
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
  } catch (err) {
    if (res.headersSent) return void res.end();
    // Arquivo inexistente / pedido inválido = 404; erro com mensagem própria (API) = o status dele;
    // qualquer outra falha (permissão, disco cheio...) = 500 e vai pro log.
    const notFound = err && (err.code === 'ENOENT' || err.code === 'ENOTDIR' || err.message === 'not a file' || err instanceof URIError);
    if (err?.expose) return sendJson(res, err.status, { error: err.message });
    if (isApi && err instanceof SyntaxError) return sendJson(res, 400, { error: 'JSON inválido.' });
    if (!notFound) console.error(err);
    if (isApi) {
      const denied = err.code === 'EACCES' || err.code === 'EPERM' || err.code === 'EROFS';
      const msg = notFound ? 'Não encontrado.' : denied ? 'Sem permissão para usar esta pasta.' : `Erro interno (${err.code || err.message}).`;
      return sendJson(res, notFound ? 404 : denied ? 403 : 500, { error: msg });
    }
    res.writeHead(notFound ? 404 : 500).end(notFound ? 'Not found' : 'Internal error');
  }
// escuta só em 127.0.0.1 (localhost): ninguém na sua rede consegue acessar o servidor
}).listen(port, '127.0.0.1', () => {
  console.log(`\n  Projeto Designer rodando em  http://localhost:${port}`);
  console.log(`  Projetos salvos em           ${config.folder}\n`);
});
