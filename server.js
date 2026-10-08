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
import { handleMcp } from './server/mcp.js';
import { VERSION } from './src/version.js';
import { PROVIDERS, providerOf, isLocalUrl } from './src/agent/providers.js';
import { AGENT_INSTRUCTIONS } from './src/agent/schema.js';

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

  if (parts[0] === 'agent') return agentApi(req, res, parts.slice(1));

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

/** Nome do programa de IA conectado pelo MCP (vem no "initialize"), mostrado na janela de permissão. */
const mcpSession = {};

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
  const one = (m) => handleMcp(m, { callTool: callEditor, version: VERSION, session: mcpSession, instructions });
  const out = Array.isArray(body) ? (await Promise.all(body.map(one))).filter(Boolean) : await one(body);
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
  return { baseUrl, model, apiKey, provider };
};
/**
 * Instruções da IA (quem ela é, o que pode fazer, como a ferramenta funciona): o arquivo docs/AGENTE.md, lido a cada
 * conversa (editar o arquivo muda o comportamento na hora, sem reiniciar). Sem o arquivo, vale o texto curto embutido.
 */
const agentInstructions = () => readFile(join(root, 'docs', 'AGENTE.md'), 'utf8').catch(() => AGENT_INSTRUCTIONS);
/** Monta o cabeçalho de autorização (servidores locais, como o Ollama, não usam chave). */
const authHeader = (a) => (a.apiKey ? { Authorization: `Bearer ${a.apiKey}` } : {});

/**
 * Rotas da IA:
 *   GET  /api/agent/events   → o editor fica ouvindo os pedidos de ferramenta (Server-Sent Events)
 *   POST /api/agent/reply    { id, result } → o editor devolve o resultado de um pedido
 *   GET  /api/agent/config   → { baseUrl, model, hasKey, editors } (a chave NUNCA é devolvida)
 *   PUT  /api/agent/config   { apiKey?, model?, baseUrl? } → grava (apiKey "" apaga a chave)
 *   POST /api/agent/chat     { messages, tools } → repassa à API de chat (OpenAI, NVIDIA NIM, Ollama...) com a SUA chave e as
 *                            instruções de docs/AGENTE.md como mensagem de sistema
 *   GET  /api/agent/models   → { models } a lista de modelos da conta (testa a chave)
 *   PUT  /api/agent/mcp      { admin } → liga/desliga o "Acesso de administrador" do MCP (só programas deste computador)
 */
async function agentApi(req, res, parts) {
  const [what] = parts;
  if (what === 'events' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(': conectado\n\n');
    editors.add(res);
    // "batimento" a cada 25 s: sem tráfego, alguns navegadores/antivírus derrubam a conexão parada
    const beat = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => { clearInterval(beat); editors.delete(res); });
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
    config = { ...config, agent: next };
    await writeFile(configFile, JSON.stringify(config, null, 2));
    const a = agentConfig();
    return sendJson(res, 200, { ok: true, baseUrl: a.baseUrl, model: a.model, hasKey: !!a.apiKey });
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
    const { messages, tools } = JSON.parse((await readBody(req)) || '{}');
    if (!Array.isArray(messages) || !messages.length) throw httpError(400, 'Mensagens vazias.');
    const a = agentConfig();
    if (!a.apiKey && !isLocalUrl(a.baseUrl)) throw httpError(400, `Configure a chave de ${a.provider?.name || 'API'} em Configurações → Assistente de IA.`);
    // as instruções (docs/AGENTE.md) entram aqui, no servidor: sempre as mais novas, e o navegador não consegue trocá-las
    const system = { role: 'system', content: await agentInstructions() };
    let r;
    try {
      r = await fetch(`${a.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(a) },
        body: JSON.stringify({ model: a.model, messages: [system, ...messages.filter((m) => m.role !== 'system')], ...(tools?.length ? { tools, tool_choice: 'auto' } : {}) }),
        signal: AbortSignal.timeout(120000),
      });
    } catch (err) {
      throw httpError(502, `Não consegui falar com ${a.baseUrl} (${err.name === 'TimeoutError' ? 'demorou demais' : err.cause?.code || err.message}). Confira a internet e o endereço em Configurações.`);
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const detail = data.error?.message || data.detail || data.title || r.status;
      // modelo que não aceita ferramentas: diga o que fazer em vez de só repassar o erro técnico
      const noTools = /tool|function/i.test(String(detail)) && r.status === 400;
      throw httpError(r.status === 401 ? 401 : 502, `A API respondeu: ${detail}${r.status === 401 ? ' (chave inválida?)' : ''}${noTools ? ` — o modelo "${a.model}" parece não aceitar ferramentas; escolha outro em Configurações.` : ''}`);
    }
    const message = data.choices?.[0]?.message;
    if (!message) throw httpError(502, 'A API respondeu sem mensagem.');
    return sendJson(res, 200, { message, usage: data.usage || null });
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
  console.log(`\n  Projeto Designer rodando em  http://localhost:${port}`);
  console.log(`  Projetos salvos em           ${config.folder}\n`);
});
