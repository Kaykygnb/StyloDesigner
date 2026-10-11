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
 *   3. IA: o endereço /mcp (programas como Claude Code e Codex usam o editor aberto) e /api/agent/... (o Assistente
 *      fala com a OpenAI usando a chave guardada só aqui). Quem executa as ferramentas é o EDITOR (ver agentApi).
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
import { createPhotosHandler } from './photos.js';
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { writeJsonAtomic } from './atomic.js';
import { homedir } from 'node:os';
import { isAbsolute, join, normalize, parse, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { handleMcp } from './mcp.js';
import { httpError } from './http-error.js';
import { openDb, defaultDbDir } from './db.js';
import { createProjects, checkName } from './services/projects.js';
import { createAuth } from './services/auth.js';
import { createAgents } from './services/agents.js';
import { createOperations } from './services/operations.js';
import { createNotes } from './services/notes.js';
import { createSharing } from './services/sharing.js';
import { createWorkspace } from './workspace/index.js';
import { exportSite } from '@stylo/core/site-export.js';
import { createWebHandler } from './web.js';
import { createZip } from '@stylo/core/zip.js';
import { createPresence, targetsOf, DOCUMENT_LOCK } from './presence.js';
import { mergeAccount, normalizeAccount } from './account.js';
import { VERSION } from '@stylo/core/version.js';
import { AGENT_INSTRUCTIONS, toolByName } from '@stylo/core/tools/schema.js';
import { createImageAi } from './imageai.js';

/** Pasta do projeto (onde está este arquivo). Tudo que o servidor entrega é lido a partir daqui. */
const here = resolve(fileURLToPath(new URL('.', import.meta.url)));
const root = resolve(here, '..', '..', '..');
/** Porta HTTP. Padrão 5173; mude com `PORT=8080 npm start`. */
const port = Number(process.env.PORT) || 5173;
/** Arquivo onde a configuração (pasta escolhida, nº de versões) é lembrada entre execuções. Fica fora do git (.gitignore). */
const configFile = resolve(process.env.DESIGNER_CONFIG || join(root, 'designer.config.json'));
/** Configuração padrão: pasta ./projetos ao lado do app, guardando até 20 versões por projeto. */
// CONTA LOCAL (perfil sem senha): arquivo ao lado da configuração. designer.config.json → designer.account.json
const accountFile = configFile.replace(/(\.config)?\.json$/i, '') + '.account.json';
const DEFAULTS = { folder: join(root, 'projetos'), keepVersions: 20 };
/** Tamanho máximo aceito para um projeto (imagens embutidas deixam o .json grande). */
const MAX_BODY = 200 * 1024 * 1024; // só o PUT de um projeto (pode levar imagens embutidas)
const MAX_JSON = 1024 * 1024; // padrão das rotas JSON: configuração, conta, renomear etc.
const MAX_MEDIUM = 32 * 1024 * 1024; // mensagens do agente e respostas de ferramentas (podem levar imagens), miniaturas, MCP

// ---------------------------------------------------------------- configuração
/** Lê a configuração salva (ou a padrão, se ainda não existir; se estiver corrompida, guarda uma cópia e usa a padrão). */
async function loadConfig() {
  let text;
  try { text = await readFile(configFile, 'utf8'); } catch { return { ...DEFAULTS }; } // ainda não existe: padrão
  try {
    return { ...DEFAULTS, ...JSON.parse(text) };
  } catch {
    // existe mas está quebrada (queda no meio de uma gravação antiga, edição à mão): guarda uma cópia para a pessoa
    // recuperar as chaves em vez de perdê-las em silêncio, e segue com o padrão
    const backup = `${configFile}.corrompido-${Date.now()}`;
    await copyFile(configFile, backup).catch(() => {});
    console.warn(`  Aviso: a configuração estava corrompida. Cópia guardada em ${backup}; usando o padrão.`);
    return { ...DEFAULTS };
  }
}
/** Configuração atual, carregada uma vez ao iniciar e atualizada pelo PUT /api/config. */
let config = await loadConfig();
/**
 * BANCO (server/db.ts): DATABASE_URL = Postgres; sem ele, PGlite (Postgres embutido) numa pasta ao lado da configuração.
 * Tudo que persiste mora aqui: contas, agentes, projetos, versões, log de operações.
 */
const dbDir = defaultDbDir(configFile);
const { db, close: closeDb } = await openDb({ dir: dbDir });
const auth = createAuth(db);
const agents = createAgents(db);
const operations = createOperations(db);
const notes = createNotes(db);
const sharing = createSharing(db);
/** 'local' = sem login (servidor só desta máquina; tudo age como o usuário local). 'accounts' = contas e senha. */
const AUTH_MODE = process.env.STYLO_AUTH === 'accounts' ? 'accounts' : 'local';
const localUser = await auth.localUser();
/** Projetos no banco (server/services/projects.ts); depois de cada gravação os editores abertos são avisados. */
const projects = createProjects({ db, getConfig: () => config, onWrite: (event) => { broadcastProjectChange(event); workspace.externalWrite(event); } });
/** Projetos abertos no servidor: é aqui que o MCP trabalha, sem precisar de navegador (server/workspace). */
const workspace = createWorkspace({
  projects, notes, sharing, operations, presence: () => presence.snapshot(), baseUrl: () => `http://localhost:${port}`,
  onOperation: (op) => { operations.record(op).catch((err) => console.error('log de operações:', err.message)); },
});
const photosRoute = createPhotosHandler({ getKey: (cfg) => cfg.pexels?.apiKey || process.env.PEXELS_API_KEY || '' });

/** Conta local salva (sempre completa; arquivo ausente ou corrompido = conta vazia). */
async function loadAccount() {
  try { return normalizeAccount(JSON.parse(await readFile(accountFile, 'utf8'))); } catch { return normalizeAccount(null); }
}

/** A raiz do disco ou uma pasta do sistema operacional? Não serve como pasta de projetos (a API lista e grava *.json nela). */
function isSystemFolder(folder) {
  const win = process.platform === 'win32';
  const norm = (p) => (win ? resolve(p).toLowerCase() : resolve(p)).replace(/[\\/]+$/, '');
  const f = norm(folder);
  if (f === norm(parse(folder).root)) return true;
  const blocked = win
    ? [process.env.SystemRoot, process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.ProgramData].filter(Boolean)
    : ['/etc', '/usr', '/bin', '/sbin', '/lib', '/lib64', '/var', '/boot', '/sys', '/proc', '/dev', '/System', '/Library', '/private', '/opt'];
  return blocked.some((b) => f === norm(b) || f.startsWith(norm(b) + sep));
}

/** Expande `~/` para a pasta pessoal do usuário, mantendo o restante do caminho. */
const expandHome = (p) => (p === '~' || p.startsWith('~/') || p.startsWith('~\\') ? join(homedir(), p.slice(1)) : p);

/**
 * Valida e aplica uma pasta nova: precisa ser caminho ABSOLUTO; é criada se não existir; e testamos se dá para
 * escrever nela (gravando e apagando um arquivo de teste) ANTES de aceitar — melhor errar agora do que no auto-salvar.
 */
async function useFolder(input) {
  const raw = expandHome(String(input || '').trim());
  if (!raw || !isAbsolute(raw)) throw httpError(400, 'Use um caminho completo para a pasta onde deseja salvar.');
  const folder = resolve(raw);
  if (isSystemFolder(folder)) throw httpError(400, 'Esta pasta é do sistema. Escolha uma pasta sua, por exemplo dentro de Documentos.');
  await mkdir(folder, { recursive: true });
  const probe = join(folder, `.teste-escrita-${process.pid}`);
  await writeFile(probe, 'ok');
  await rm(probe, { force: true });
  return folder;
}

/** O que a configuração mostra para fora: tudo MENOS a chave da IA (ela nunca sai deste computador nem volta ao navegador). */
const publicConfig = () => ({ folder: config.folder, keepVersions: config.keepVersions });

// ---------------------------------------------------------------- utilidades HTTP
function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
/** Lê o corpo do pedido inteiro (com limite de tamanho) e devolve como texto. */
async function readBody(req, max = MAX_JSON) {
  // recusa logo, sem ler nada, quando o cabeçalho já declara mais do que a rota aceita
  if (Number(req.headers['content-length']) > max) throw httpError(413, `Conteúdo grande demais (limite ${Math.round(max / 1048576)} MB para esta rota).`);
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > max) throw httpError(413, `Conteúdo grande demais (limite ${Math.round(max / 1048576)} MB para esta rota).`);
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString('utf8');
}
/** Lê o corpo como JSON e exige um OBJETO (null, lista ou texto solto viram 400 em vez de TypeError lá na frente). */
async function jsonObject(req, max) {
  const text = await readBody(req, max);
  const value = JSON.parse(text || '{}'); // SyntaxError vira 400 "JSON inválido." no tratador central
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, 'Envie um objeto JSON.');
  return value;
}
/** O Host do pedido é esta máquina? (protege contra DNS rebinding) */
const localHost = (host = '') => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
/** A página que fez o pedido (Origin) é ESTE servidor (mesma porta)? Outra porta de localhost é outro programa e é recusada. Pedidos sem Origin (curl, MCP stdio, testes) são aceitos; as escritas de navegador sempre enviam Origin, e GET/HEAD não alteram nada. */
const OWN_ORIGINS = [`http://localhost:${port}`, `http://127.0.0.1:${port}`, `http://[::1]:${port}`];
const localOrigin = (origin) => !origin || OWN_ORIGINS.includes(String(origin).toLowerCase());

// ---------------------------------------------------------------- identidade
const bearerOf = (req) => (/^Bearer\s+(\S+)$/i.exec(String(req.headers.authorization || '')) || [])[1] || '';
const cookieOf = (req, name) => (String(req.headers.cookie || '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === name) || [])[1] || '';
/** A pessoa dona deste pedido: no modo local, o usuário local; com contas, quem tem a sessão (cookie ou Bearer). */
async function userOf(req) {
  if (AUTH_MODE === 'local') return localUser;
  const user = await auth.userFromToken(bearerOf(req) || cookieOf(req, 'stylo_session'));
  if (!user) throw httpError(401, 'Entre com a sua conta.');
  return user;
}
const ownerOf = async (req) => {
  const user = await userOf(req);
  if (user.role !== 'OWNER') throw httpError(403, 'Só a conta mestre faz isto.');
  return user;
};
/** Política de entrada de agentes sem token: configurável; padrão aberta no modo local e fechada com contas. */
const agentPolicy = () => ['open', 'approval', 'closed'].includes(config.mcp?.agentPolicy) ? config.mcp.agentPolicy : AUTH_MODE === 'local' ? 'open' : 'closed';
const sessionCookie = (token, maxAge) => `stylo_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

// ---------------------------------------------------------------- API
/**
 * Rotas da API (todas respondem JSON):
 *   GET  /api/status                         → { ok, folder, keepVersions }
 *   PUT  /api/config        { folder?, keepVersions? }  → muda a pasta / nº de versões
 *   GET  /api/account                        → conta local { name, email, role, color, avatar, language, createdAt }
 *   PUT  /api/account       { campos... }    → atualiza o perfil (400 com mensagem se algo for inválido)
 *   GET  /api/projects                       → [{ file, modified, size }]
 *   GET  /api/projects/<arquivo>             → o projeto (+ cabeçalho X-Modified com a data de modificação)
 *   PUT  /api/projects/<arquivo>             → grava; responde { modified }. Envie X-Base-Modified com a data
 *        que você leu: se o arquivo mudou desde então (outra aba, outro programa), responde 409 em vez de apagar o
 *        trabalho alheio. Envie X-Overwrite: 1 para gravar mesmo assim (ex.: "Salvar como" sobre um nome existente,
 *        depois de o usuário confirmar).
 *   GET  /api/projects/<arquivo>/versions            → versões guardadas
 *   GET  /api/projects/<arquivo>/versions/<versão>   → conteúdo de uma versão
 *   GET  /api/projects/<arquivo>/thumb               → miniatura SVG (página inicial)
 *   PUT  /api/projects/<arquivo>/thumb   { svg }     → grava a miniatura
 *   POST /api/projects/<arquivo>/rename  { to }      → renomeia (leva junto versões e miniatura); 409 se o nome existe
 */
async function api(req, res, path) {
  if (!localHost(req.headers.host)) throw httpError(403, 'Acesso negado.');
  if (path.startsWith('/api/photos/')) return photosRoute(req, res, config);
  const write = req.method !== 'GET' && req.method !== 'HEAD';
  if (write) {
    if (!localOrigin(req.headers.origin)) throw httpError(403, 'Acesso negado.');
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw httpError(415, 'Envie JSON.');
  }
  const parts = path.split('/').filter(Boolean).slice(1); // ['projects', 'nome.json', 'versions', ...]

  if (parts[0] === 'status' && parts.length === 1 && req.method === 'GET') return sendJson(res, 200, { ok: true, ...publicConfig() });

  if (parts[0] === 'config' && parts.length === 1 && req.method === 'PUT') {
    const body = await jsonObject(req);
    const next = { ...config };
    if (body.folder !== undefined) next.folder = await useFolder(body.folder);
    if (body.keepVersions !== undefined) next.keepVersions = Math.max(0, Math.min(200, Math.round(Number(body.keepVersions) || 0)));
    await writeJsonAtomic(configFile, next);
    config = next;
    return sendJson(res, 200, { ok: true, ...publicConfig() });
  }

  // CONTA LOCAL: GET devolve o perfil; PUT mescla os campos enviados (validados em server/account.js)
  if (parts[0] === 'account' && parts.length === 1 && req.method === 'GET') return sendJson(res, 200, await loadAccount());
  if (parts[0] === 'account' && parts.length === 1 && req.method === 'PUT') {
    const body = await jsonObject(req);
    let next;
    try { next = mergeAccount(await loadAccount(), body); } catch (err) { throw httpError(400, err.message); }
    await writeJsonAtomic(accountFile, next);
    return sendJson(res, 200, next);
  }

  if (parts[0] === 'agent') return agentApi(req, res, parts.slice(1));
  // IA DE FOTO: edição generativa (preencher, expandir, trocar objeto) com a chave guardada aqui (server/imageai.js)
  if (parts[0] === 'imageai') return imageAi(req, res, parts.slice(1));
  // quem está no projeto agora (pessoas com o editor aberto e agentes do MCP) e o que fizeram por último
  if (parts[0] === 'presence' && req.method === 'GET') return sendJson(res, 200, presence.snapshot());

  // ---- contas, login e agentes
  if (parts[0] === 'auth') {
    if (parts[1] === 'state' && req.method === 'GET') {
      const user = AUTH_MODE === 'local' ? localUser : await auth.userFromToken(bearerOf(req) || cookieOf(req, 'stylo_session'));
      return sendJson(res, 200, { mode: AUTH_MODE, hasAccounts: AUTH_MODE === 'local' ? true : await auth.hasAccounts(), user });
    }
    if (AUTH_MODE === 'local') throw httpError(404, 'Este servidor está no modo local (sem login). Ligue STYLO_AUTH=accounts para usar contas.');
    if (parts[1] === 'setup' && req.method === 'POST') {
      const b = await jsonObject(req);
      await auth.setup({ email: String(b.email || ''), name: String(b.name || ''), password: String(b.password || '') });
      const { token, user } = await auth.login(String(b.email), String(b.password));
      res.setHeader('Set-Cookie', sessionCookie(token, 30 * 86400));
      return sendJson(res, 201, { user, token });
    }
    if (parts[1] === 'login' && req.method === 'POST') {
      const b = await jsonObject(req);
      const { token, user } = await auth.login(String(b.email || ''), String(b.password || ''));
      res.setHeader('Set-Cookie', sessionCookie(token, 30 * 86400));
      return sendJson(res, 200, { user, token });
    }
    if (parts[1] === 'logout' && req.method === 'POST') {
      await auth.logout(bearerOf(req) || cookieOf(req, 'stylo_session'));
      res.setHeader('Set-Cookie', sessionCookie('', 0));
      return sendJson(res, 200, { ok: true });
    }
  }
  if (parts[0] === 'me' && req.method === 'GET') return sendJson(res, 200, await userOf(req));
  if (parts[0] === 'users' && parts.length === 1) {
    await ownerOf(req);
    if (req.method === 'GET') return sendJson(res, 200, await auth.users());
    if (req.method === 'POST') {
      const b = await jsonObject(req);
      return sendJson(res, 201, await auth.createUser({ email: String(b.email || ''), name: String(b.name || ''), password: String(b.password || '') }));
    }
  }
  if (parts[0] === 'agents') {
    const owner = await ownerOf(req);
    if (parts.length === 1 && req.method === 'GET') return sendJson(res, 200, await agents.list());
    if (parts.length === 1 && req.method === 'POST') {
      const b = await jsonObject(req);
      return sendJson(res, 201, await agents.create(owner.id, { name: String(b.name || ''), scopes: Array.isArray(b.scopes) ? b.scopes.map(String) : undefined }));
    }
    if (parts.length === 3 && parts[2] === 'approve' && req.method === 'POST') return sendJson(res, 200, await agents.approve(parts[1]));
    if (parts.length === 3 && parts[2] === 'revoke' && req.method === 'POST') return sendJson(res, 200, await agents.revoke(parts[1]));
  }

  // ---- projetos
  if (parts[0] === 'projects' && parts.length === 1 && req.method === 'GET') return sendJson(res, 200, await projects.list(await userOf(req)));

  if (parts[0] === 'projects' && parts[1]) {
    const user = await userOf(req);
    const name = checkName(parts[1]);
    if (parts.length === 2 && req.method === 'GET') {
      const { doc, modified, contentHash } = await projects.load(user, name);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Modified': String(modified), 'X-Content-Hash': contentHash });
      return res.end(JSON.stringify(doc));
    }
    if (parts.length === 2 && req.method === 'PUT') {
      const text = await readBody(req, MAX_BODY);
      let doc;
      try { doc = JSON.parse(text); } catch { throw httpError(400, 'O conteúdo não é JSON válido.'); }
      if (!Array.isArray(doc?.pages)) throw httpError(400, 'Isso não parece um projeto (faltam as páginas).');
      try {
        const saved = await projects.write(user, name, doc, {
          base: { hash: String(req.headers['x-base-hash'] || '') },
          overwrite: req.headers['x-overwrite'] === '1', by: String(req.headers['x-editor-id'] || ''), size: text.length,
        });
        return sendJson(res, 200, { ok: true, ...saved });
      } catch (err) {
        if (err.status === 409) return sendJson(res, 409, { error: err.message, ...err.body });
        throw err;
      }
    }
    if (parts[2] === 'site.zip' && parts.length === 3 && req.method === 'GET') {
      // o site inteiro em .zip (HTML estruturado, uma página por prancheta visível)
      const { doc } = await projects.load(user, name);
      const site = exportSite(doc);
      const zip = Buffer.from(createZip(site.files.map(({ path, content }) => ({ path, content }))));
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${name.replace(/\.json$/i, '')}-site.zip"`, 'Cache-Control': 'no-store' });
      return res.end(zip);
    }
    if (parts[2] === 'thumb' && parts.length === 3 && req.method === 'GET') {
      const svg = await projects.readThumb(user, name);
      // SVG pode conter <script>: a política de segurança abaixo impede que rode, mesmo se alguém abrir a URL direto
      res.writeHead(200, {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache',
        'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
      });
      return res.end(svg);
    }
    if (parts[2] === 'thumb' && parts.length === 3 && req.method === 'PUT') {
      const { svg } = await jsonObject(req, MAX_MEDIUM);
      await projects.writeThumb(user, name, svg);
      return sendJson(res, 200, { ok: true });
    }
    if (parts[2] === 'rename' && parts.length === 3 && req.method === 'POST') {
      const { to } = await jsonObject(req);
      return sendJson(res, 200, { ok: true, ...(await projects.rename(user, name, to)) });
    }
    if (parts[2] === 'versions' && parts.length <= 4 && req.method === 'GET') {
      if (parts.length === 3) return sendJson(res, 200, await projects.versions(user, name));
      return sendJson(res, 200, await projects.readVersion(user, name, parts[3]));
    }
    if (parts[2] === 'activity' && parts.length === 3 && req.method === 'GET') {
      const { id } = await projects.load(user, name);
      const limit = Number(new URL(req.url, 'http://x').searchParams.get('limit')) || 50;
      return sendJson(res, 200, await operations.list(id, { limit }));
    }
  }
  throw httpError(404, 'Rota não encontrada.');
}

// ---------------------------------------------------------------- IA: ponte com o editor, MCP e agente interno
/**
 * PONTE COM O EDITOR. Quem executa as ferramentas da IA é o editor aberto no navegador (é lá que o projeto está vivo,
 * com desfazer e a janela de permissão). O editor se conecta em GET /api/agent/events (Server-Sent Events: uma
 * conexão que fica aberta e pela qual o servidor manda mensagens); o servidor manda "use a ferramenta X" e espera a
 * resposta em POST /api/agent/reply. Com várias abas abertas, vale a última que conectou.
 */
const editors = new Set();
/** Identidade visual (aba e pessoa) de cada conexão SSE do editor. */
const editorSessions = new Map();

/**
 * VÁRIOS AGENTES AO MESMO TEMPO. Cada conexão MCP ganha uma sessão (cabeçalho Mcp-Session-Id, criado no
 * "initialize") com o nome do programa. A presença guarda quem está conectado, o que fez e as TRAVAS: alterar uma
 * camada a reserva por alguns segundos para aquela sessão; outro agente que tentar mexer nela recebe um aviso.
 */
const presence = createPresence();
/** Tetos de conexões simultâneas (um editor local usa 1–3; sem teto, um laço de pedidos cresceria sem fim). */
const MAX_MCP_SESSIONS = 64;
const MAX_EDITORS = 32;
/** Sessões MCP: identidade e chamadas em voo, para o DELETE não soltar travas antes do fim de uma edição. */
const mcpSessions = new Map();
/** Chamadas JSON-RPC ativas, indexadas por sessão e id para notifications/cancelled. */
const activeMcpCalls = new Map();
/** Remove sessões abandonadas pelo cliente sem expirar operações ainda em andamento. */
const mcpSessionSweep = setInterval(() => {
  const expired = [];
  for (const [id, state] of mcpSessions) {
    if (!state.activeCalls && state.lastSeen && Date.now() - state.lastSeen > 10 * 60 * 1000) {
      mcpSessions.delete(id);
      expired.push(id);
    }
  }
  if (expired.length) { expired.forEach((id) => { presence.removeAgent(id); workspace.endSession(id); }); broadcastPresence(); }
}, 60 * 1000);
mcpSessionSweep.unref();
/** Manda o retrato da presença para todas as abas do editor (evento SSE "presence"). */
function broadcastPresence() {
  const data = JSON.stringify(presence.snapshot());
  for (const ed of editors) {
    try { ed.write(`event: presence
data: ${data}

`); }
    catch { editors.delete(ed); editorSessions.delete(ed); }
  }
}
/** Avisa os editores abertos que um projeto foi gravado (evento SSE "project"): quem não tem alterações pendentes recarrega. */
function broadcastProjectChange(event) {
  const data = JSON.stringify(event);
  for (const ed of editors) {
    try { ed.write(`event: project
data: ${data}

`); } catch { editors.delete(ed); editorSessions.delete(ed); }
  }
}
/** Executa uma ferramenta pedida por uma sessão MCP: presença, trava das camadas e registro da atividade. */
async function callAgentTool(sid, state, tool, args, name, signal) {
  state.activeCalls = (state.activeCalls || 0) + 1;
  state.lastSeen = Date.now();
  presence.touchAgent(sid, name);
  const def = toolByName(tool);
  const locking = def?.write && !def.noLock;
  const writeTargets = locking ? targetsOf(args) : [];
  const lockTargets = locking ? (writeTargets.length ? writeTargets : [DOCUMENT_LOCK]) : [];
  let locked = false;
  // Trave por chamada, não por sessão: uma mesma IA pode disparar ferramentas em paralelo.
  // Chamadas diferentes do mesmo agente não podem escrever ao mesmo tempo na mesma camada.
  const lockId = randomUUID();
  if (locking) {
    const lock = presence.lock(lockId, lockTargets, 0, { agentId: sid, name });
    if (!lock.ok) {
      presence.done(sid, tool, `esperou a camada ${lock.id} (em uso por ${lock.by})`, false);
      state.activeCalls--;
      if (state.closing && state.activeCalls === 0) { presence.removeAgent(sid); workspace.endSession(sid); };
      broadcastPresence();
      const message = lock.id === DOCUMENT_LOCK ? 'O documento inteiro está sendo alterado' : `A camada ${lock.id} está sendo alterada`;
      return { error: `${message} por ${lock.by} agora. Espere uns ${lock.wait}s e tente de novo, ou trabalhe em outra parte do design.` };
    }
    locked = true;
  }
  broadcastPresence();
  try {
    const actor = { type: 'AGENT', userId: state.agent.ownerId, agentId: state.agent.id, name, scopes: state.agent.scopes };
    const out = await workspace.call(tool, args, { sid, actor, signal });
    presence.done(sid, tool, def?.write ? (out?._summary || `usou ${tool}`) : null, !(out?.error || out?.refused));
    return out;
  } catch (err) {
    presence.done(sid, tool, `${tool}: ${err.message}`, false);
    throw err;
  } finally {
    if (locked) presence.finishLocks(lockId, lockTargets);
    state.activeCalls--;
    if (state.closing && state.activeCalls === 0) {
      { presence.removeAgent(sid); workspace.endSession(sid); };
    }
    broadcastPresence();
  }
}

/**
 * MCP por HTTP (http://localhost:5173/mcp, transporte "Streamable HTTP" do MCP, respondendo JSON simples).
 * POST com uma mensagem JSON-RPC (ou uma lista delas). GET não é usado (405), como o protocolo permite.
 */
async function mcpRoute(req, res) {
  if (!localHost(req.headers.host) || !localOrigin(req.headers.origin)) throw httpError(403, 'Acesso negado.');
  const requestSid = String(req.headers['mcp-session-id'] || '').slice(0, 80);
  if (req.method === 'DELETE') {
    if (!requestSid || !mcpSessions.has(requestSid)) { res.writeHead(404).end(); return; }
    const closingSession = mcpSessions.get(requestSid);
    mcpSessions.delete(requestSid);
    closingSession.closing = true;
    for (const [key, controller] of activeMcpCalls) if (key.startsWith(`${requestSid}:`)) controller.abort();
    if (!closingSession.activeCalls) { presence.removeAgent(requestSid); workspace.endSession(requestSid); };
    broadcastPresence();
    res.writeHead(204).end();
    return;
  }
  if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST, DELETE' }).end(); return; }
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw httpError(415, 'Envie JSON.');
  const body = JSON.parse((await readBody(req, MAX_MEDIUM)) || 'null');
  const instructions = await agentInstructions();
  // sessão: a do cabeçalho; no "initialize" sem cabeçalho, uma nova (devolvida em Mcp-Session-Id)
  const isInit = (Array.isArray(body) ? body : [body]).some((m) => m?.method === 'initialize');
  const messages = Array.isArray(body) ? body : [body];
  // tools/call precisa da sessão devolvida no initialize. Um alias global para clientes sem cabeçalho
  // mistura identidade, cancelamento e travas de clientes MCP independentes.
  if (!requestSid && !isInit && messages.some((m) => m?.method === 'tools/call')) {
    return sendJson(res, 400, { error: 'Mcp-Session-Id ausente. Envie o cabeçalho devolvido pelo initialize para executar ferramentas sem misturar sessões MCP.' });
  }
  let sid = requestSid;
  if (!sid && isInit) sid = randomUUID();
  if (!sid) sid = 'mcp-sem-sessao'; // programas antigos que não guardam a sessão dividem esta
  if (!isInit && requestSid && !mcpSessions.has(requestSid)) { res.writeHead(404).end(); return; }
  if (!mcpSessions.has(sid) && mcpSessions.size >= MAX_MCP_SESSIONS) {
    return sendJson(res, 429, { error: `Há ${MAX_MCP_SESSIONS} sessões MCP abertas. Feche alguma (DELETE /mcp com Mcp-Session-Id) ou aguarde 10 min sem uso.` });
  }
  const session = mcpSessions.get(sid) || { activeCalls: 0, closing: false, lastSeen: Date.now() };
  // QUEM é o agente: token (Authorization: Bearer) ou, no modo local, o nome do programa (política de agentes)
  const bearer = bearerOf(req);
  if (bearer) session.agent = await agents.authenticate(bearer); // confere a cada pedido: revogar vale na hora
  else if (!session.agent) {
    if (AUTH_MODE === 'accounts') throw httpError(401, 'Envie o token do agente: Authorization: Bearer stylo_agt_...');
    const init = messages.find((m) => m?.method === 'initialize');
    session.agent = await agents.forClient(localUser.id, String(req.headers['x-stylo-agent'] || init?.params?.clientInfo?.name || 'IA externa'), agentPolicy());
  }
  session.lastSeen = Date.now();
  mcpSessions.set(sid, session);
  const forced = String(req.headers['x-stylo-agent'] || '').slice(0, 40);
  const requestControllers = [];
  const one = async (m) => {
    if (m?.method === 'notifications/cancelled') {
      activeMcpCalls.get(`${sid}:${String(m.params?.requestId ?? '')}`)?.abort();
      return null;
    }
    if (m?.method !== 'tools/call' || m.id == null) return handleMcp(m, { version: VERSION, session, instructions });
    const key = `${sid}:${String(m.id)}`;
    const controller = new AbortController();
    requestControllers.push(controller);
    activeMcpCalls.set(key, controller);
    try {
      const callTool = (name, args, client, signal) => {
        return callAgentTool(sid, session, name, args, forced || client, signal);
      };
      return await handleMcp(m, { callTool, version: VERSION, session, instructions, signal: controller.signal });
    } finally { if (activeMcpCalls.get(key) === controller) activeMcpCalls.delete(key); }
  };
  res.once('close', () => { if (!res.writableEnded) requestControllers.forEach((controller) => controller.abort()); });
  const out = Array.isArray(body) ? (await Promise.all(body.map(one))).filter(Boolean) : await one(body);
  if (isInit) { presence.touchAgent(sid, forced || session.name); broadcastPresence(); }
  res.setHeader('Mcp-Session-Id', sid);
  if (!out || (Array.isArray(out) && !out.length)) { res.writeHead(202).end(); return; } // só avisos: nada a responder
  sendJson(res, 200, out);
}

/** IA de foto (server/imageai.js): lê a configuração atual e grava as mudanças no mesmo arquivo. */
const imageAi = createImageAi({ getConfig: () => config, saveConfig: async (next) => { config = next; await writeJsonAtomic(configFile, config); } });

/**
 * Instruções da IA (quem ela é, o que pode fazer, como a ferramenta funciona): o arquivo server/instrucoes-agente.txt, lido a cada
 * conversa (editar o arquivo muda o comportamento na hora, sem reiniciar). Sem o arquivo, vale o texto curto embutido.
 */
const agentInstructions = () => readFile(join(here, 'instrucoes-agente.txt'), 'utf8').catch(() => AGENT_INSTRUCTIONS);
/**
 * Rotas da IA:
 *   GET  /api/agent/events   → o editor fica ouvindo os pedidos de ferramenta (Server-Sent Events)
 *   POST /api/agent/reply    { id, result } → o editor devolve o resultado de um pedido
 *   GET  /api/agent/config   → { editors, mcpUrl, mcpScript, mcpAdmin, pexels } (chaves NUNCA são devolvidas)
 *   PUT  /api/agent/config   { pexelsKey? } → grava (vazio apaga)
 */
async function agentApi(req, res, parts) {
  const [what] = parts;
  if (what === 'events' && req.method === 'GET') {
    if (editors.size >= MAX_EDITORS) return sendJson(res, 429, { error: 'Editores conectados demais.' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(': conectado\n\n');
    editors.add(res);
    // a aba diz quem é (nome e cor do perfil): aparece na presença para os outros
    const q = new URL(req.url, 'http://x').searchParams;
    const personId = String(q.get('id') || randomUUID()).slice(0, 60);
    const personName = String(q.get('user') || 'Pessoa').slice(0, 40);
    editorSessions.set(res, { id: personId, name: personName });
    presence.addPerson(personId, personName, q.get('color'));
    broadcastPresence();
    // "batimento" a cada 25 s: sem tráfego, alguns navegadores/antivírus derrubam a conexão parada
    const beat = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => {
      clearInterval(beat);
      editors.delete(res);
      editorSessions.delete(res);
      presence.removePerson(personId);
      broadcastPresence();
    });
    return;
  }
  if (what === 'config' && req.method === 'GET') {
    return sendJson(res, 200, {
      editors: editors.size, mcpUrl: `http://localhost:${port}/mcp`, mcpScript: join(root, 'apps', 'server', 'bin', 'mcp.mjs'), instructions: join(here, 'instrucoes-agente.txt'),
      pexels: !!(config.pexels?.apiKey || process.env.PEXELS_API_KEY), pexelsSource: config.pexels?.apiKey ? 'config' : process.env.PEXELS_API_KEY ? 'env' : '',
    });
  }
  if (what === 'config' && req.method === 'PUT') {
    const body = await jsonObject(req);
    const pexels = { ...(config.pexels || {}) };
    if (body.pexelsKey !== undefined) { const k = String(body.pexelsKey).trim(); if (k) pexels.apiKey = k.slice(0, 400); else delete pexels.apiKey; }
    config = { ...config, ...(Object.keys(pexels).length ? { pexels } : {}) };
    if (!Object.keys(pexels).length) delete config.pexels;
    await writeJsonAtomic(configFile, config);
    return sendJson(res, 200, { ok: true, pexels: !!(config.pexels?.apiKey || process.env.PEXELS_API_KEY) });
  }
  throw httpError(404, 'Rota não encontrada.');
}

// ---------------------------------------------------------------- servidor
/**
 * Para cada pedido: /api/... vai para a API; o resto é arquivo estático. No estático, resolve o caminho, confere a
 * lista branca e o "path traversal" (um pedido como /../../etc/passwd não pode sair da pasta) e devolve o arquivo.
 * `Cache-Control: no-cache` para você ver as mudanças do código ao recarregar a página.
 */
const httpServer = createServer(async (req, res) => {
  const isApi = /^\/(api(\/|$)|mcp\b)/.test(req.url);
  try {
    // pega só o caminho da URL (sem ?query) e decodifica %xx; "/" vira index.html
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/mcp') return await mcpRoute(req, res);
    if (isApi) return await api(req, res, path);
    return await web(req, res, path);
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
      const msg = notFound ? 'Não encontrado.' : denied ? 'Sem permissão para usar esta pasta.' : 'Erro interno. Veja o terminal do servidor para o detalhe.';
      return sendJson(res, notFound ? 404 : denied ? 403 : 500, { error: msg });
    }
    res.writeHead(notFound ? 404 : 500).end(notFound ? 'Not found' : 'Internal error');
  }
});
/** Entrega o editor (apps/web): arquivos de dist em produção, Vite em desenvolvimento. */
const web = createWebHandler({ webRoot: join(root, 'apps', 'web'), httpServer });
// escuta só em 127.0.0.1 (localhost): ninguém na sua rede consegue acessar o servidor
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  try { await workspace.flushAll(); await operations.idle(); await closeDb(); } finally { process.exit(0); }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
httpServer.listen(port, '127.0.0.1', () => {
  console.log(`\n  Stylo rodando em  http://localhost:${port}`);
  console.log(`  Banco de dados               ${process.env.DATABASE_URL ? 'Postgres (DATABASE_URL)' : 'PGlite em ' + dbDir}`);
  console.log(`  Acesso                       ${AUTH_MODE === 'local' ? 'modo local (sem login)' : 'contas e senha'}\n`);
});
