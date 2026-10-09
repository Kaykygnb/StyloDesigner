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
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, isAbsolute, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { handleMcp } from './server/mcp.js';
import { createPresence, targetsOf } from './server/presence.js';
import { mergeAccount, normalizeAccount } from './server/account.js';
import { VERSION } from './src/version.js';
import { PROVIDERS, providerOf, isLocalUrl } from './src/agent/providers.js';
import { AGENT_INSTRUCTIONS, toolByName } from './src/agent/schema.js';
import { createChatAccumulator, createSseReader, reasoningParams, rejectsExtras, rejectsTools } from './src/agent/stream.js';
import { JEV_URL, JEV_MODEL, buildJevRequest, readJevAnswer, isJevTool } from './src/agent/jev.js';

/** Pasta do projeto (onde está este arquivo). Tudo que o servidor entrega é lido a partir daqui. */
const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
/** Porta HTTP. Padrão 5173; mude com `PORT=8080 npm start`. */
const port = Number(process.env.PORT) || 5173;
/** Lista branca: SÓ estes caminhos são servidos (o app em si). package.json, .git, tests, projetos etc. nunca saem por aqui. */
const allowed = ['index.html', 'src', 'assets'];
/** Arquivo onde a configuração (pasta escolhida, nº de versões) é lembrada entre execuções. Fica fora do git (.gitignore). */
const configFile = resolve(process.env.DESIGNER_CONFIG || join(root, 'designer.config.json'));
/** Configuração padrão: pasta ./projetos ao lado do app, guardando até 20 versões por projeto. */
// CONTA LOCAL (perfil sem senha): arquivo ao lado da configuração. designer.config.json → designer.account.json
const accountFile = configFile.replace(/(\.config)?\.json$/i, '') + '.account.json';
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

/** Conta local salva (sempre completa; arquivo ausente ou corrompido = conta vazia). */
async function loadAccount() {
  try { return normalizeAccount(JSON.parse(await readFile(accountFile, 'utf8'))); } catch { return normalizeAccount(null); }
}

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

/** O que a configuração mostra para fora: tudo MENOS a chave da IA (ela nunca sai deste computador nem volta ao navegador). */
const publicConfig = () => ({ folder: config.folder, keepVersions: config.keepVersions });

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
/** Miniatura (SVG) de um projeto, mostrada na página inicial: <pasta>/.miniaturas/<nome-sem-.json>.svg */
const thumbPath = (name) => join(config.folder, '.miniaturas', name.replace(/\.json$/i, '.svg'));
/** Tamanho máximo de uma miniatura (o app já tira imagens grandes antes de mandar). */
const MAX_THUMB = 3 * 1024 * 1024;
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
  const write = req.method !== 'GET' && req.method !== 'HEAD';
  if (write) {
    if (!localOrigin(req.headers.origin)) throw httpError(403, 'Acesso negado.');
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw httpError(415, 'Envie JSON.');
  }
  const parts = path.split('/').filter(Boolean).slice(1); // ['projects', 'nome.json', 'versions', ...]

  if (parts[0] === 'status' && parts.length === 1 && req.method === 'GET') return sendJson(res, 200, { ok: true, ...publicConfig() });

  if (parts[0] === 'config' && parts.length === 1 && req.method === 'PUT') {
    const body = JSON.parse((await readBody(req)) || '{}');
    const next = { ...config };
    if (body.folder !== undefined) next.folder = await useFolder(body.folder);
    if (body.keepVersions !== undefined) next.keepVersions = Math.max(0, Math.min(200, Math.round(Number(body.keepVersions) || 0)));
    await writeFile(configFile, JSON.stringify(next, null, 2));
    config = next;
    return sendJson(res, 200, { ok: true, ...publicConfig() });
  }

  // CONTA LOCAL: GET devolve o perfil; PUT mescla os campos enviados (validados em server/account.js)
  if (parts[0] === 'account' && parts.length === 1 && req.method === 'GET') return sendJson(res, 200, await loadAccount());
  if (parts[0] === 'account' && parts.length === 1 && req.method === 'PUT') {
    const body = JSON.parse((await readBody(req)) || '{}');
    let next;
    try { next = mergeAccount(await loadAccount(), body); } catch (err) { throw httpError(400, err.message); }
    await writeFile(accountFile, JSON.stringify(next, null, 2));
    return sendJson(res, 200, next);
  }

  if (parts[0] === 'agent') return agentApi(req, res, parts.slice(1));
  // quem está no projeto agora (pessoas com o editor aberto e agentes do MCP) e o que fizeram por último
  if (parts[0] === 'presence' && req.method === 'GET') return sendJson(res, 200, presence.snapshot());

  if (parts[0] === 'projects' && parts.length === 1 && req.method === 'GET') {
    await mkdir(config.folder, { recursive: true });
    const names = (await readdir(config.folder)).filter((f) => FILE_RE.test(f));
    const list = await Promise.all(names.map(async (file) => {
      const s = await stat(projectPath(file));
      if (!s.isFile()) return null;
      const thumb = await stat(thumbPath(file)).then((t) => t.mtimeMs, () => 0);
      return { file, modified: s.mtimeMs, size: s.size, thumb };
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
    if (parts[2] === 'thumb' && parts.length === 3 && req.method === 'GET') {
      const data = await readFile(thumbPath(name));
      // SVG pode conter <script>: a política de segurança abaixo impede que rode, mesmo se alguém abrir a URL direto
      res.writeHead(200, {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache',
        'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
      });
      return res.end(data);
    }
    if (parts[2] === 'thumb' && parts.length === 3 && req.method === 'PUT') {
      const { svg } = JSON.parse((await readBody(req)) || '{}');
      if (typeof svg !== 'string' || !svg.trimStart().startsWith('<svg')) throw httpError(400, 'Miniatura inválida.');
      if (svg.length > MAX_THUMB) throw httpError(413, 'Miniatura grande demais.');
      await stat(projectPath(name)); // só aceita miniatura de projeto que existe (senão: 404)
      await mkdir(join(config.folder, '.miniaturas'), { recursive: true });
      await writeFile(thumbPath(name), svg);
      return sendJson(res, 200, { ok: true });
    }
    if (parts[2] === 'rename' && parts.length === 3 && req.method === 'POST') {
      const { to } = JSON.parse((await readBody(req)) || '{}');
      const target = checkName(String(to || ''));
      if (target === name) return sendJson(res, 200, { ok: true, file: name });
      await stat(projectPath(name)); // origem precisa existir (senão: 404)
      if (await stat(projectPath(target)).catch(() => null)) throw httpError(409, `Já existe "${target}" na pasta.`);
      await rename(projectPath(name), projectPath(target));
      // versões e miniatura acompanham o projeto (se existirem)
      await rename(versionsDir(name), versionsDir(target)).catch(() => {});
      await rename(thumbPath(name), thumbPath(target)).catch(() => {});
      return sendJson(res, 200, { ok: true, file: target, modified: (await stat(projectPath(target))).mtimeMs });
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

// ---------------------------------------------------------------- IA: ponte com o editor, MCP e agente interno
/**
 * PONTE COM O EDITOR. Quem executa as ferramentas da IA é o editor aberto no navegador (é lá que o projeto está vivo,
 * com desfazer e a janela de permissão). O editor se conecta em GET /api/agent/events (Server-Sent Events: uma
 * conexão que fica aberta e pela qual o servidor manda mensagens); o servidor manda "use a ferramenta X" e espera a
 * resposta em POST /api/agent/reply. Com várias abas abertas, vale a última que conectou.
 */
const editors = new Set();
/** Pedidos esperando resposta do editor: id → { resolve, timer }. */
const pending = new Map();
let callSeq = 0;
/** Tempo máximo esperando o editor (inclui a pessoa decidir na janela de permissão). */
const EDITOR_TIMEOUT_MS = 3 * 60 * 1000;

/** Pede ao editor aberto para rodar uma ferramenta; devolve o resultado (ou erro claro se não houver editor). */
function callEditor(tool, args, client) {
  const editor = [...editors].pop();
  if (!editor) return Promise.reject(new Error(`O editor não está aberto. Abra http://localhost:${port} no navegador (com o npm start rodando) e tente de novo.`));
  const id = String(++callSeq);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('O editor não respondeu a tempo (a pessoa não decidiu na janela de permissão em 3 minutos).')); }, EDITOR_TIMEOUT_MS);
    pending.set(id, { resolve, timer });
    // admin: a pessoa ligou o "Acesso de administrador" do MCP → o editor executa sem a janela de permissão
    editor.write(`event: call\ndata: ${JSON.stringify({ id, tool, args, client, admin: !!config.mcp?.admin })}\n\n`);
  });
}

/**
 * VÁRIOS AGENTES AO MESMO TEMPO. Cada conexão MCP ganha uma sessão (cabeçalho Mcp-Session-Id, criado no
 * "initialize") com o nome do programa. A presença guarda quem está conectado, o que fez e as TRAVAS: alterar uma
 * camada a reserva por alguns segundos para aquela sessão; outro agente que tentar mexer nela recebe um aviso.
 */
const presence = createPresence();
/** Sessões MCP: id → { name } (o nome vem do initialize ou do cabeçalho X-Stylo-Agent). */
const mcpSessions = new Map();
/** Manda o retrato da presença para todas as abas do editor (evento SSE "presence"). */
function broadcastPresence() {
  const data = JSON.stringify(presence.snapshot());
  for (const ed of editors) ed.write(`event: presence
data: ${data}

`);
}
/** Executa uma ferramenta pedida por uma sessão MCP: presença, trava das camadas e registro da atividade. */
async function callAgentTool(sid, tool, args, name) {
  presence.touchAgent(sid, name);
  const def = toolByName(tool);
  if (def?.write) {
    const lock = presence.lock(sid, targetsOf(args));
    if (!lock.ok) {
      presence.done(sid, tool, `esperou a camada ${lock.id} (em uso por ${lock.by})`, false);
      broadcastPresence();
      return { error: `A camada ${lock.id} está sendo alterada por ${lock.by} agora. Espere uns ${lock.wait}s e tente de novo, ou trabalhe em outra parte do design.` };
    }
  }
  broadcastPresence();
  try {
    const out = await callEditor(tool, args, name);
    presence.done(sid, tool, def?.write ? (out?._summary || `usou ${tool}`) : null, !(out?.error || out?.refused));
    return out;
  } catch (err) {
    presence.done(sid, tool, `${tool}: ${err.message}`, false);
    throw err;
  } finally {
    broadcastPresence();
  }
}

/**
 * MCP por HTTP (http://localhost:5173/mcp, transporte "Streamable HTTP" do MCP, respondendo JSON simples).
 * POST com uma mensagem JSON-RPC (ou uma lista delas). GET não é usado (405), como o protocolo permite.
 */
async function mcpRoute(req, res) {
  if (!localHost(req.headers.host) || !localOrigin(req.headers.origin)) throw httpError(403, 'Acesso negado.');
  if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }).end(); return; }
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw httpError(415, 'Envie JSON.');
  const body = JSON.parse((await readBody(req)) || 'null');
  const instructions = await agentInstructions();
  // sessão: a do cabeçalho; no "initialize" sem cabeçalho, uma nova (devolvida em Mcp-Session-Id)
  const isInit = (Array.isArray(body) ? body : [body]).some((m) => m?.method === 'initialize');
  let sid = String(req.headers['mcp-session-id'] || '').slice(0, 80);
  if (!sid && isInit) sid = randomUUID();
  if (!sid) sid = 'mcp-sem-sessao'; // programas antigos que não guardam a sessão dividem esta
  const session = mcpSessions.get(sid) || {};
  mcpSessions.set(sid, session);
  const forced = String(req.headers['x-stylo-agent'] || '').slice(0, 40);
  const callTool = (name, args, client) => callAgentTool(sid, name, args, forced || client);
  const one = (m) => handleMcp(m, { callTool, version: VERSION, session, instructions });
  const out = Array.isArray(body) ? (await Promise.all(body.map(one))).filter(Boolean) : await one(body);
  if (isInit) { presence.touchAgent(sid, forced || session.name); broadcastPresence(); }
  // programa que não reenvia o cabeçalho de sessão: as próximas chamadas sem cabeçalho usam o nome deste initialize
  if (isInit && !req.headers['mcp-session-id']) mcpSessions.set('mcp-sem-sessao', { name: session.name });
  res.setHeader('Mcp-Session-Id', sid);
  if (!out || (Array.isArray(out) && !out.length)) { res.writeHead(202).end(); return; } // só avisos: nada a responder
  sendJson(res, 200, out);
}

/** Provedor padrão do Assistente (o 1º da lista: OpenAI). Troque em Configurações (OpenAI, NVIDIA NIM, Ollama, outro). */
const DEFAULT_PROVIDER = PROVIDERS[0];
/**
 * Configuração do Assistente: endereço da API, modelo e a chave DAQUELE endereço. Cada provedor guarda a sua chave
 * (config.agent.keys[endereço]); a chave também pode vir da variável de ambiente do provedor (OPENAI_API_KEY,
 * NVIDIA_API_KEY). `config.agent.apiKey` é o formato antigo (uma chave só) e continua valendo.
 */
const agentConfig = () => {
  const baseUrl = (config.agent?.baseUrl || DEFAULT_PROVIDER.baseUrl).replace(/\/+$/, '');
  const provider = providerOf(baseUrl);
  const model = config.agent?.model || provider?.model || DEFAULT_PROVIDER.model;
  const legacy = baseUrl === DEFAULT_PROVIDER.baseUrl ? config.agent?.apiKey : '';
  const apiKey = config.agent?.keys?.[baseUrl] || legacy || (provider?.envKey && process.env[provider.envKey]) || '';
  // tempos e raciocínio (Configurações → Agente de IA): sem 1º pedaço em firstTokenSec → erro claro; pensando há mais
  // de maxThinkSec sem responder → para; limitReasoning pede à NVIDIA NIM para pensar menos; maxTokens só na NIM
  const num = (v, d, lo, hi) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.max(lo, Math.min(hi, Math.round(Number(v)))) : d);
  return {
    baseUrl, model, apiKey, provider,
    firstTokenSec: num(config.agent?.firstTokenSec, 60, 5, 600),
    maxThinkSec: num(config.agent?.maxThinkSec, 120, 10, 1800),
    maxTokens: num(config.agent?.maxTokens, 4096, 0, 65536),
    limitReasoning: config.agent?.limitReasoning !== false,
  };
};
/**
 * Chave e endereço do Jev (TypeSafe): a chave vem de Configurações → Chaves de API (config.jev.apiKey) ou da variável
 * de ambiente JEV_API_KEY, e NUNCA volta ao navegador. O endereço pode ser trocado por JEV_API_URL ou, só para um
 * servidor DESTA máquina (testes), por config.jev.url.
 */
const jevConfig = () => {
  const apiKey = config.jev?.apiKey || process.env.JEV_API_KEY || '';
  const local = config.jev?.url && isLocalUrl(config.jev.url) ? config.jev.url : '';
  return { apiKey, url: local || process.env.JEV_API_URL || JEV_URL, source: config.jev?.apiKey ? 'config' : process.env.JEV_API_KEY ? 'env' : '' };
};
/**
 * Instruções da IA (quem ela é, o que pode fazer, como a ferramenta funciona): o arquivo docs/AGENTE.md, lido a cada
 * conversa (editar o arquivo muda o comportamento na hora, sem reiniciar). Sem o arquivo, vale o texto curto embutido.
 */
const agentInstructions = () => readFile(join(root, 'docs', 'AGENTE.md'), 'utf8').catch(() => AGENT_INSTRUCTIONS);
/** Monta o cabeçalho de autorização (servidores locais, como o Ollama, não usam chave). */
const authHeader = (a) => (a.apiKey ? { Authorization: `Bearer ${a.apiKey}` } : {});

/** Erro de uma conversa com a IA, com um código para a tela (first_token, thinking, no_tools, http, network). */
const chatError = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });

/**
 * Uma rodada de chat em STREAMING com a API (OpenAI, NVIDIA NIM, Ollama...). Repassa os pedaços em `onDelta`
 * ({ text, reasoning }) enquanto chegam e devolve a mensagem completa ({ content, reasoning, tool_calls, ... }).
 * Tempos: sem nenhum pedaço em `firstTokenMs` → erro "first_token"; só raciocínio por mais de `maxThinkMs` →
 * erro "thinking"; parado sem receber nada por `firstTokenMs` no meio → erro "stalled". `signal` aborta tudo
 * (botão Parar). Servidores que ignoram stream:true e mandam JSON inteiro também funcionam.
 */
async function streamChat({ a, model, messages, tools, extras = {}, signal, onDelta = () => {}, firstTokenMs, maxThinkMs }) {
  const ctrl = new AbortController();
  let reason = null;
  const fail = (err) => { if (!reason) { reason = err; ctrl.abort(); } };
  const onOuter = () => fail(chatError('aborted', 'Parado.'));
  if (signal?.aborted) onOuter(); else signal?.addEventListener('abort', onOuter, { once: true });
  const started = Date.now();
  let firstAt = 0;
  let idle = setTimeout(() => fail(chatError('first_token', `O modelo “${model}” não começou a responder em ${Math.round(firstTokenMs / 1000)} s.`)), firstTokenMs);
  const acc = createChatAccumulator();
  const emit = (d) => {
    if (!d.text && !d.reasoning) return;
    if (!firstAt) firstAt = Date.now();
    onDelta(d);
  };
  const tick = () => {
    clearTimeout(idle);
    idle = setTimeout(() => fail(chatError('stalled', `O modelo “${model}” parou de mandar a resposta no meio (${Math.round(firstTokenMs / 1000)} s sem nada).`)), firstTokenMs);
    if (firstAt && !acc.answering() && Date.now() - firstAt > maxThinkMs) fail(chatError('thinking', `O modelo “${model}” ficou ${Math.round((Date.now() - firstAt) / 1000)} s só pensando, sem responder.`));
  };
  try {
    let r;
    try {
      r = await fetch(`${a.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream, application/json', ...authHeader(a) },
        body: JSON.stringify({ model, messages, ...(tools?.length ? { tools, tool_choice: 'auto' } : {}), stream: true, ...extras }),
        signal: ctrl.signal,
      });
    } catch (err) {
      if (reason) throw reason;
      throw chatError('network', `Não consegui falar com ${a.baseUrl} (${err.cause?.code || err.message}). Confira a internet e o endereço em Configurações.`);
    }
    if (!r.ok) {
      const raw = await r.text().catch(() => '');
      let data = {};
      try { data = JSON.parse(raw); } catch { /* texto puro */ }
      const detail = String(data.error?.message || data.detail || data.title || data.message || raw.slice(0, 300) || r.status);
      throw chatError(rejectsTools(r.status, detail) ? 'no_tools' : 'http', detail, { status: r.status, detail });
    }
    if (/application\/json/i.test(r.headers.get('content-type') || '')) {
      // servidor que ignorou o streaming: a resposta inteira de uma vez
      const data = await r.json().catch(() => ({}));
      tick();
      emit(acc.add(data));
    } else {
      const decoder = new TextDecoder();
      const sse = createSseReader((data) => {
        if (!data) return;
        let json;
        try { json = JSON.parse(data); } catch { return; }
        if (json.error) fail(chatError('http', String(json.error.message || json.error)));
        emit(acc.add(json));
        tick();
      });
      for await (const chunk of r.body) {
        tick();
        sse.push(decoder.decode(chunk, { stream: true }));
        if (reason) break;
      }
      sse.end();
    }
    if (reason) throw reason;
    emit(acc.end());
    const out = acc.result();
    return { ...out, firstTokenMs: firstAt ? firstAt - started : null, totalMs: Date.now() - started };
  } catch (err) {
    throw reason || err;
  } finally {
    clearTimeout(idle);
    signal?.removeEventListener('abort', onOuter);
  }
}

/**
 * Chat com as tentativas certas: manda os extras de raciocínio da NIM (reasoningParams) e, se a API recusar algum
 * campo extra, tenta de novo sem eles. Devolve o mesmo que streamChat e `note` (aviso para a tela, se houver).
 */
async function chatWithRetry({ a, model, system, messages, tools, signal, onDelta }) {
  const rp = reasoningParams(model, { provider: a.provider?.id, limit: a.limitReasoning, maxTokens: a.maxTokens });
  const sys = { role: 'system', content: rp.system ? `${rp.system}\n\n${system}` : system };
  const opts = { a, model, tools, signal, onDelta, firstTokenMs: a.firstTokenSec * 1000, maxThinkMs: a.maxThinkSec * 1000 };
  try {
    return { ...(await streamChat({ ...opts, messages: [sys, ...messages], extras: rp.body })), note: rp.note };
  } catch (err) {
    if (!(err.code === 'http' && Object.keys(rp.body).length && rejectsExtras(err.status, err.detail))) throw err;
    return { ...(await streamChat({ ...opts, messages: [{ role: 'system', content: system }, ...messages], extras: {} })), note: rp.note };
  }
}

/** Frase para a tela a partir do erro de chat (com o que fazer). */
function chatErrorText(err, model, a) {
  const nim = a.provider?.id === 'nvidia';
  const tip = nim ? ' Tente de novo (na NVIDIA NIM, modelos grandes às vezes ficam na fila) ou troque por um menor e rápido (ex.: meta/llama-3.3-70b-instruct); “Testar modelo” em Configurações compara os modelos.' : ' Tente de novo ou troque o modelo no topo do painel.';
  switch (err.code) {
    case 'first_token': return `${err.message}${tip} Se o modelo for lento mesmo, aumente “Esperar o 1º pedaço” em Configurações → Agente de IA.`;
    case 'stalled': return `${err.message}${tip}`;
    case 'thinking': return `${err.message} Ligue “Pedir menos raciocínio” em Configurações → Agente de IA, aumente o “Tempo máximo pensando” ou use um modelo “instruct” (sem raciocínio).`;
    case 'no_tools': return `A API respondeu: ${err.detail} — o modelo “${model}” não aceita ferramentas (tool calling), então não consegue mexer no design. Escolha outro no topo do painel (use “Testar modelo” em Configurações para achar um que funcione).`;
    case 'http': return `A API respondeu: ${err.detail || err.message}${err.status === 401 ? ' (chave inválida? Confira em Configurações → Chaves de API)' : err.status === 404 ? ` (o modelo “${model}” existe nesta conta? Use “Ver modelos”)` : ''}`;
    default: return err.message;
  }
}

/** Ferramenta mínima usada por "Testar modelo" (mede se o modelo chama ferramentas). */
const PING_TOOL = { type: 'function', function: { name: 'ping', description: 'Responde "pong". Use quando pedirem para testar.', parameters: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } } };

/**
 * Rotas da IA:
 *   GET  /api/agent/events   → o editor fica ouvindo os pedidos de ferramenta (Server-Sent Events)
 *   POST /api/agent/reply    { id, result } → o editor devolve o resultado de um pedido
 *   GET  /api/agent/config   → { baseUrl, model, hasKey, editors } (a chave NUNCA é devolvida)
 *   PUT  /api/agent/config   { apiKey?, model?, baseUrl? } → grava (apiKey "" apaga a chave)
 *   POST /api/agent/chat     { messages, tools, model?, memory?, subagent? } → repassa à API de chat (OpenAI, NVIDIA NIM,
 *                            Ollama...) com a SUA chave e as instruções de docs/AGENTE.md, em STREAMING: responde NDJSON
 *                            (um JSON por linha): {type:"start"} · {type:"reasoning", text} · {type:"text", text} ·
 *                            {type:"done", message, model, firstTokenMs, totalMs} · {type:"error", error, code}.
 *                            Fechar a conexão (botão Parar) aborta o pedido à API na hora.
 *   POST /api/agent/test     { model? } → testa o modelo: tempo até o 1º pedaço e se ele chama ferramentas (guarda)
 *   POST /api/agent/jev      { tool, args } → roda jev_choose / jev_score / jev_check na API do Jev (chave só aqui)
 *   GET  /api/agent/models   → { models } a lista de modelos da conta (testa a chave)
 *   PUT  /api/agent/mcp      { admin } → liga/desliga o "Acesso de administrador" do MCP (só programas deste computador)
 */
async function agentApi(req, res, parts) {
  const [what] = parts;
  if (what === 'events' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(': conectado\n\n');
    editors.add(res);
    // a aba diz quem é (nome e cor do perfil): aparece na presença para os outros
    const q = new URL(req.url, 'http://x').searchParams;
    const personId = String(q.get('id') || randomUUID()).slice(0, 60);
    presence.addPerson(personId, q.get('user') || 'Pessoa', q.get('color'));
    broadcastPresence();
    // "batimento" a cada 25 s: sem tráfego, alguns navegadores/antivírus derrubam a conexão parada
    const beat = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => { clearInterval(beat); editors.delete(res); presence.removePerson(personId); broadcastPresence(); });
    return;
  }
  if (what === 'reply' && req.method === 'POST') {
    const { id, result } = JSON.parse((await readBody(req)) || '{}');
    const p = pending.get(String(id));
    if (p) { clearTimeout(p.timer); pending.delete(String(id)); p.resolve(result ?? {}); }
    return sendJson(res, 200, { ok: !!p });
  }
  if (what === 'config' && req.method === 'GET') {
    const a = agentConfig();
    // caminho do script stdio e endereço HTTP do MCP: a janela de Configurações mostra os comandos prontos para copiar
    return sendJson(res, 200, {
      baseUrl: a.baseUrl, model: a.model, provider: a.provider?.id || 'custom', hasKey: !!a.apiKey, needsKey: !a.apiKey && !isLocalUrl(a.baseUrl),
      editors: editors.size, mcpUrl: `http://localhost:${port}/mcp`, mcpScript: join(root, 'scripts', 'mcp.mjs'), instructions: join(root, 'docs', 'AGENTE.md'),
      mcpAdmin: !!config.mcp?.admin, pluginDir: join(root, 'integrations', 'claude-code'),
      firstTokenSec: a.firstTokenSec, maxThinkSec: a.maxThinkSec, maxTokens: a.maxTokens, limitReasoning: a.limitReasoning,
      tested: config.agent?.tested || {},
      // Jev: só se há chave e de onde ela vem (a chave em si nunca sai daqui)
      jev: !!jevConfig().apiKey, jevSource: jevConfig().source,
    });
  }
  if (what === 'config' && req.method === 'PUT') {
    const body = JSON.parse((await readBody(req)) || '{}');
    const next = { ...(config.agent || {}), keys: { ...(config.agent?.keys || {}) } };
    if (body.baseUrl !== undefined) {
      const u = String(body.baseUrl).trim().replace(/\/+$/, '');
      if (u && !/^https?:\/\/[^\s]+$/i.test(u)) throw httpError(400, 'Endereço inválido: use algo como https://integrate.api.nvidia.com/v1 ou http://localhost:11434/v1.');
      if (u) next.baseUrl = u; else delete next.baseUrl;
    }
    if (body.model !== undefined) { const m = String(body.model).trim(); if (m) next.model = m.slice(0, 120); else delete next.model; }
    // a chave vale para o endereço ESCOLHIDO (já com a troca acima): cada provedor guarda a sua
    if (body.apiKey !== undefined) {
      const k = String(body.apiKey).trim();
      const url = (next.baseUrl || DEFAULT_PROVIDER.baseUrl).replace(/\/+$/, '');
      if (k) next.keys[url] = k; else { delete next.keys[url]; if (url === DEFAULT_PROVIDER.baseUrl) delete next.apiKey; }
    }
    if (!Object.keys(next.keys).length) delete next.keys;
    // tempos e raciocínio (números fora da faixa são ajustados em agentConfig)
    for (const k of ['firstTokenSec', 'maxThinkSec', 'maxTokens']) {
      if (body[k] === undefined) continue;
      if (body[k] === '' || body[k] === null) delete next[k];
      else if (!Number.isFinite(Number(body[k]))) throw httpError(400, `${k}: use um número.`);
      else next[k] = Number(body[k]);
    }
    if (body.limitReasoning !== undefined) next.limitReasoning = !!body.limitReasoning;
    // CHAVE DO JEV (TypeSafe): "" apaga. jevUrl só aceita endereço desta máquina (servidor de teste).
    let jev = { ...(config.jev || {}) };
    if (body.jevKey !== undefined) { const k = String(body.jevKey).trim(); if (k) jev.apiKey = k.slice(0, 400); else delete jev.apiKey; }
    if (body.jevUrl !== undefined) {
      const u = String(body.jevUrl).trim();
      if (u && !isLocalUrl(u)) throw httpError(400, 'jevUrl só aceita um endereço desta máquina (localhost). Para outro, use a variável JEV_API_URL.');
      if (u) jev.url = u; else delete jev.url;
    }
    config = { ...config, agent: next, ...(Object.keys(jev).length ? { jev } : {}) };
    if (!Object.keys(jev).length) delete config.jev;
    await writeFile(configFile, JSON.stringify(config, null, 2));
    const a = agentConfig();
    return sendJson(res, 200, { ok: true, baseUrl: a.baseUrl, model: a.model, hasKey: !!a.apiKey, jev: !!jevConfig().apiKey });
  }
  if (what === 'mcp' && req.method === 'PUT') {
    // { admin: boolean } — "Acesso de administrador" do MCP: programas de IA DESTE computador agem sem a janela de
    // permissão e podem abrir/salvar/criar projetos. O /mcp continua aceitando só pedidos desta máquina.
    const body = JSON.parse((await readBody(req)) || '{}');
    const next = { ...(config.mcp || {}) };
    if (body.admin !== undefined) next.admin = !!body.admin;
    config = { ...config, mcp: next };
    await writeFile(configFile, JSON.stringify(config, null, 2));
    return sendJson(res, 200, { ok: true, mcpAdmin: !!next.admin });
  }
  if (what === 'models' && req.method === 'GET') {
    // lista os modelos da conta (GET /models, padrão da OpenAI que a NVIDIA e o Ollama também têm): ajuda a escolher
    // o nome certo e, de quebra, testa se a chave funciona
    const a = agentConfig();
    if (!a.apiKey && !isLocalUrl(a.baseUrl)) throw httpError(400, `Salve a chave de ${a.provider?.name || 'API'} antes.`);
    let r;
    try { r = await fetch(`${a.baseUrl}/models`, { headers: authHeader(a), signal: AbortSignal.timeout(20000) }); } catch (err) {
      throw httpError(502, `Não consegui falar com ${a.baseUrl} (${err.cause?.code || err.message}).`);
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw httpError(r.status === 401 ? 401 : 502, `A API respondeu: ${data.error?.message || data.detail || r.status}${r.status === 401 ? ' (chave inválida?)' : ''}`);
    const ids = (data.data || data.models || []).map((m) => m.id || m.name).filter(Boolean).sort();
    return sendJson(res, 200, { models: ids });
  }
  if (what === 'chat' && req.method === 'POST') {
    const { messages, tools, model: wanted, memory, subagent } = JSON.parse((await readBody(req)) || '{}');
    if (!Array.isArray(messages) || !messages.length) throw httpError(400, 'Mensagens vazias.');
    const a = agentConfig();
    if (!a.apiKey && !isLocalUrl(a.baseUrl)) throw httpError(400, `Configure a chave de ${a.provider?.name || 'API'} em Configurações → Chaves de API.`);
    // as instruções (docs/AGENTE.md) entram aqui, no servidor: sempre as mais novas, e o navegador não consegue trocá-las
    // memória do projeto (notas que o agente guardou com "remember" ou que você escreveu): vai junto das instruções
    const notes = Array.isArray(memory) ? memory.map((m) => String(m).slice(0, 500)).slice(0, 60) : [];
    const memoryText = notes.length
      ? `\n\n## Memória deste projeto\nCoisas que você já combinou com a pessoa ou anotou (use a ferramenta remember para guardar novas):\n${notes.map((n) => `- ${n}`).join('\n')}`
      : '';
    const subText = subagent ? '\n\n## Você é um SUBAGENTE\nVocê recebeu UMA tarefa do agente principal. Faça só ela, sem perguntar nada, e termine com um resumo de 1 a 3 frases.' : '';
    const system = (await agentInstructions()) + memoryText + subText;
    // modelo escolhido na aba do agente (por conversa); sem escolha, vale o das Configurações
    const model = typeof wanted === 'string' && /^[\w.:/@+-]{1,120}$/.test(wanted) ? wanted : a.model;
    // ferramentas do Jev só com chave (sem ela, nem aparecem para o modelo)
    const hasJev = !!jevConfig().apiKey;
    const offered = Array.isArray(tools) ? tools.filter((t) => hasJev || !isJevTool(t?.function?.name)) : [];
    // só os campos que a API conhece (o navegador guarda outros, como o raciocínio, que não voltam para a IA)
    const clean = messages.filter((m) => m && m.role !== 'system').map((m) => ({
      role: m.role, content: m.content ?? '',
      ...(m.tool_calls?.length ? { tool_calls: m.tool_calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.function?.name, arguments: typeof c.function?.arguments === 'string' ? c.function.arguments : JSON.stringify(c.function?.arguments ?? {}) } })) } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
    }));
    // STREAMING para o navegador: NDJSON (um evento por linha), enviado assim que cada pedaço chega
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
    const send = (ev) => { if (!res.writableEnded && !res.destroyed) res.write(`${JSON.stringify(ev)}\n`); };
    // botão Parar: o navegador fecha a conexão → aborta o pedido à API (não fica gastando tokens à toa)
    const stop = new AbortController();
    res.on('close', () => { if (!res.writableFinished) stop.abort(); });
    send({ type: 'start', model });
    // batimento: mantém a conexão viva e deixa a tela contar o tempo mesmo sem pedaços
    const beat = setInterval(() => send({ type: 'wait' }), 5000);
    try {
      const out = await chatWithRetry({ a, model, system, messages: clean, tools: offered, signal: stop.signal, onDelta: (d) => {
        if (d.reasoning) send({ type: 'reasoning', text: d.reasoning });
        if (d.text) send({ type: 'text', text: d.text });
      } });
      if (out.note) send({ type: 'note', text: out.note });
      const message = { role: 'assistant', content: out.content || '', ...(out.tool_calls.length ? { tool_calls: out.tool_calls } : {}) };
      send({ type: 'done', message, reasoning: out.reasoning || '', model, finishReason: out.finish_reason, firstTokenMs: out.firstTokenMs, totalMs: out.totalMs, usage: out.usage || null });
    } catch (err) {
      if (err.code !== 'aborted') send({ type: 'error', code: err.code || 'error', error: chatErrorText(err, model, a) });
    } finally {
      clearInterval(beat);
      if (!res.writableEnded) res.end();
    }
    return;
  }
  if (what === 'test' && req.method === 'POST') {
    // TESTAR MODELO: pede para chamar uma ferramenta "ping" e mede o tempo até o 1º pedaço. O resultado fica guardado
    // (config.agent.tested) para marcar na lista de modelos quais funcionaram.
    const body = JSON.parse((await readBody(req)) || '{}');
    const a = agentConfig();
    if (!a.apiKey && !isLocalUrl(a.baseUrl)) throw httpError(400, `Salve a chave de ${a.provider?.name || 'API'} antes.`);
    const model = typeof body.model === 'string' && /^[\w.:/@+-]{1,120}$/.test(body.model.trim()) ? body.model.trim() : a.model;
    const stop = new AbortController();
    res.on('close', () => { if (!res.writableFinished) stop.abort(); });
    const t0 = Date.now();
    let result;
    try {
      const out = await chatWithRetry({
        a: { ...a, firstTokenSec: Math.min(a.firstTokenSec, 90), maxThinkSec: Math.min(a.maxThinkSec, 90) }, model,
        system: 'Você está sendo testado. Quando pedirem, chame a ferramenta indicada, sem escrever texto.',
        messages: [{ role: 'user', content: 'Chame a ferramenta ping com {"ok": true}.' }], tools: [PING_TOOL], signal: stop.signal,
      });
      const tools = out.tool_calls.some((c) => c.function?.name === 'ping');
      result = { ok: tools, tools, firstTokenMs: out.firstTokenMs ?? out.totalMs, totalMs: out.totalMs, reasoning: !!out.reasoning,
        ...(tools ? {} : { error: out.content ? 'Respondeu em texto em vez de chamar a ferramenta (não serve para mexer no design).' : 'Não chamou a ferramenta.' }) };
    } catch (err) {
      if (err.code === 'aborted') return;
      result = { ok: false, tools: err.code === 'no_tools' ? false : null, totalMs: Date.now() - t0, code: err.code || 'error', error: chatErrorText(err, model, a) };
    }
    result = { ...result, model, at: Date.now() };
    // guarda (no máximo 80 modelos testados, os mais recentes)
    const tested = Object.entries({ ...(config.agent?.tested || {}), [model]: result }).sort((x, y) => y[1].at - x[1].at).slice(0, 80);
    config = { ...config, agent: { ...(config.agent || {}), tested: Object.fromEntries(tested) } };
    await writeFile(configFile, JSON.stringify(config, null, 2));
    return sendJson(res, 200, result);
  }
  if (what === 'jev' && req.method === 'POST') {
    // JEV: o servidor chama a API da TypeSafe com a chave guardada aqui; o navegador só vê a resposta
    const { tool, args } = JSON.parse((await readBody(req)) || '{}');
    const j = jevConfig();
    if (!j.apiKey) throw httpError(400, 'O Jev não está configurado: coloque a chave em Configurações → Chaves de API (ou a variável JEV_API_KEY).');
    if (!isJevTool(tool)) throw httpError(400, `Ferramenta do Jev desconhecida: ${tool}.`);
    let q;
    try { q = buildJevRequest(tool, args || {}); } catch (err) { return sendJson(res, 200, { error: err.message }); }
    const t0 = Date.now();
    let r;
    try {
      r = await fetch(j.url, {
        method: 'POST', headers: { Authorization: `Bearer ${j.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: q.state, model: process.env.JEV_MODEL || JEV_MODEL, questions: q.questions }), signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      return sendJson(res, 200, { error: err.name === 'TimeoutError' ? 'O Jev não respondeu em 20 s. Siga sem ele.' : `Não consegui falar com o Jev (${err.cause?.code || err.message}). Siga sem ele.` });
    }
    if (!r.ok) {
      const detail = (await r.text().catch(() => '')).slice(0, 300);
      return sendJson(res, 200, { error: r.status === 401 || r.status === 403 ? 'O Jev recusou a chave (confira JEV_API_KEY em Configurações → Chaves de API).' : `O Jev respondeu ${r.status}${detail ? `: ${detail}` : ''}.` });
    }
    try {
      return sendJson(res, 200, { ...readJevAnswer(tool, await r.json(), q), latencyMs: Date.now() - t0 });
    } catch (err) { return sendJson(res, 200, { error: err.message }); }
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
  const isApi = /^\/(api(\/|$)|mcp\b)/.test(req.url);
  try {
    // pega só o caminho da URL (sem ?query) e decodifica %xx; "/" vira index.html
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/mcp') return await mcpRoute(req, res);
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
  console.log(`\n  Stylo rodando em  http://localhost:${port}`);
  console.log(`  Projetos salvos em           ${config.folder}\n`);
});
