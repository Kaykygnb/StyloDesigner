/**
 * main.ts — LIGA O SERVIDOR DO STYLO
 *
 *   npm start   →   http://localhost:5173
 *
 * Monta os serviços (configuração, banco, contas, agentes, projetos, workspace, renderizador), a aplicação HTTP (Hono)
 * e o servidor MCP, e entrega o editor. Variáveis: PORT, DESIGNER_CONFIG (arquivo de configuração), DATABASE_URL
 * (Postgres; sem ela, PGlite embutido), DESIGNER_DB_DIR, STYLO_AUTH=accounts (login com contas), STYLO_DEV=1 (força o Vite).
 * Segurança: escuta na rede local; ver http/guards.ts (Host/Origin privados, limites de corpo).
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import './dom-polyfill.js';
import { createServer } from 'node:http';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRequestListener } from '@hono/node-server';
import { VERSION } from '@stylo/core/version.js';
import { AGENT_INSTRUCTIONS } from '@stylo/core/tools/schema.js';
import { createConfigStore, loadConfig } from './config.js';
import { defaultDbDir, openDb } from './db.js';
import { createAuth } from './services/auth.js';
import { createAgents } from './services/agents.js';
import { createOperations } from './services/operations.js';
import { createNotes } from './services/notes.js';
import { createSharing } from './services/sharing.js';
import { createProjects } from './services/projects.js';
import { createRenderer } from './services/renderer.js';
import { createImageOperations } from './services/image-operations.ts';
import { fetchRemoteImage } from './services/remote-image.js';
import { createWorkspace } from './workspace/index.js';
import { createPlugins } from './plugins.js';
import { createBlobStore } from './services/blobs.js';
import { createLibrary } from './services/library.js';
import { createSecrets, loadSecretKey } from './services/secrets.js';
import { createAssetServices, createAssetSources } from './services/asset-services.js';
import { builtinPlugins } from '@stylo/plugins/index.ts';
import { createPresence } from './presence.js';
import { createEvents } from './events.js';
import { createIdentity } from './http/identity.js';
import { createToolCaller } from './mcp/agent-calls.js';
import { createMcpGateway } from './mcp/gateway.js';
import { createApp } from './app.js';
import { createWebHandler } from './web.js';
import { createStudioCaller } from './studio/studio-calls.js';
import type { Services } from './context.js';
import { applyPendingRestore, createBackups } from './services/backups.js';

const here = resolve(fileURLToPath(new URL('.', import.meta.url)));
const root = resolve(here, '..', '..', '..');
const port = Number(process.env.PORT) || 5173;
const configFile = resolve(process.env.DESIGNER_CONFIG || join(root, 'designer.config.json'));
// perfil da conta local (sem senha): ao lado da configuração. designer.config.json → designer.account.json
const accountFile = configFile.replace(/(\.config)?\.json$/i, '') + '.account.json';

const config = createConfigStore(configFile, await loadConfig(configFile));
let dbDir = defaultDbDir(configFile);
if (!process.env.DATABASE_URL) await applyPendingRestore(dbDir);

async function recoveryCandidates(dir: string) {
  const parent = dirname(resolve(dir));
  const base = basename(resolve(dir));
  const entries = await readdir(parent, { withFileTypes: true }).catch(() => []);
  const prefix = [`${base}.before-migrations-`, `${base}.backup-`, `stylo-backup-${base}-`];
  const candidates = entries
    .filter((entry) => entry.isDirectory() && entry.name !== base && prefix.some((item) => entry.name.startsWith(item)))
    .map((entry) => join(parent, entry.name));
  return (await Promise.all(candidates.map(async (candidate) => ({ candidate, mtime: (await stat(candidate)).mtimeMs })))).sort((a, b) => b.mtime - a.mtime).map((item) => item.candidate);
}

async function openWithRecovery(dir: string) {
  try {
    return await openDb({ dir });
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (!/Aborted\(\)|RuntimeError|corrupt|invalid|malformed/i.test(text)) throw error;
    for (const candidate of await recoveryCandidates(dir)) {
      try {
        const recovered = await openDb({ dir: candidate });
        await recovered.db.$queryRaw`SELECT 1`;
        console.error(`Banco PGlite ilegível em ${dir}; usando backup íntegro ${candidate}. O original foi preservado.`);
        dbDir = candidate;
        return recovered;
      } catch {
        // Tenta o próximo snapshot sem mascarar o erro original.
      }
    }
    throw error;
  }
}
const opened = await (async () => {
  try {
    return await openWithRecovery(dbDir);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (/mutex|lock|locked|timeout/i.test(text)) {
      console.error('Não foi possível abrir o banco PGlite em uso por outro processo. Feche o outro Stylo ou defina DESIGNER_DB_DIR para outro diretório. (' + dbDir + ')');
    } else if (/Aborted\(\)|RuntimeError|corrupt|invalid|malformed/i.test(text)) {
      console.error('O banco PGlite não pôde ser lido. Preserve a pasta e restaure um backup ou use DESIGNER_DB_DIR com uma cópia recuperada. (' + dbDir + ')');
    } else {
      console.error('Não foi possível iniciar o banco do Stylo: ' + text);
    }
    process.exit(1);
  }
})();
const { db, close: closeDb } = opened;

const auth = createAuth(db);
// O servidor sempre inicia com autenticação por contas. O modo local não é mais o padrão de produção;
// STYLO_AUTH=local continua reservado para testes/desenvolvimento explícito.
const authMode = process.env.STYLO_AUTH === 'local' ? 'local' : 'accounts';
/** 0.0.0.0 mantém acesso pela rede local; 127.0.0.1 bloqueia interfaces remotas explicitamente. */
const bindHost = process.env.STYLO_HOST === '127.0.0.1' || process.env.STYLO_HOST === 'localhost' ? '127.0.0.1' : '0.0.0.0';
const localUser = await auth.localUser();
const presence = createPresence();
const events = createEvents({ presence });
const operations = createOperations(db);
const renderer = createRenderer();

// o workspace e os projetos se conhecem: gravar avisa os editores e o workspace; o workspace grava pelos projetos
// eslint-disable-next-line prefer-const
let workspace: ReturnType<typeof createWorkspace>;
const projects = createProjects({
  db, getConfig: () => config.get(),
  onWrite: (event) => { events.broadcastProject(event); void workspace.externalWrite(event); },
});
const notes = createNotes(db);
const sharing = createSharing(db);
/** Plugins embutidos: acrescentam ferramentas MCP (identidade visual...). Os serviços são o que eles podem usar do servidor. */
// biblioteca da conta: fichas no banco, bytes no armazenamento de blobs (pasta ao lado do banco; STYLO_BLOB_DIR muda)
const blobs = createBlobStore(process.env.STYLO_BLOB_DIR || dbDir.replace(/\.db$/i, '') + '.blobs');
const library = createLibrary({ db, blobs });
const secrets = createSecrets(db, await loadSecretKey(configFile.replace(/(\.config)?\.json$/i, '') + '.secret'));
const assetServices = createAssetServices({ library, secrets, sources: createAssetSources(db), config });
const plugins = createPlugins({ plugins: builtinPlugins, enabled: config.get().plugins?.enabled, services: { fetchImage: (url: string) => fetchRemoteImage(url), assets: assetServices } });
const agents = createAgents(db);
const backups = createBackups({ dbDir, db, postgres: !!process.env.DATABASE_URL });
workspace = createWorkspace({
  projects, notes, sharing, operations, agentProjectAccess: (agentId, projectId) => authMode === 'local' ? Promise.resolve(true) : agents.projectAccess(agentId, projectId), grantAgentProject: (agentId, projectId) => agents.grantProject(agentId, projectId), plugins, presence: () => presence.snapshot(),
  renderImage: (node, doc, scale, opts) => renderer.render(node, doc, scale, opts),
  inspectLayout: (root, doc, opts) => renderer.inspect(root, doc, opts),
  measureLayout: (roots, doc) => renderer.measure(roots, doc),
  auditLayout: (roots, doc, widths) => renderer.overflow(roots, doc, widths),
  fetchImage: (url) => fetchRemoteImage(url),
  imageOps: createImageOperations(renderer),
  baseUrl: () => `http://localhost:${port}`,
  onOperation: (op) => { operations.record(op).catch((err) => console.error('log de operações:', err.message)); },
});

const services: Services = {
  port, root, here, config, accountFile, db, auth, agents, operations, notes, sharing, projects, renderer,
  workspace, events, authMode, localUser, presence, library, blobs, secrets, backups, plugins,
};
const identity = createIdentity(services);
const caller = createToolCaller({ workspace, presence, events });
/** Instruções entregues aos agentes (o arquivo é lido a cada sessão nova: editar muda o comportamento sem reiniciar). */
const instructions = () => readFile(join(here, 'instrucoes-agente.txt'), 'utf8').catch(() => AGENT_INSTRUCTIONS);
const mcp = createMcpGateway({ s: services, identity, caller, instructions, version: VERSION });
const studio = createStudioCaller({ workspace, presence, events });
const app = createApp(services, identity, mcp, assetServices, studio);
const api = getRequestListener(app.fetch);

// ---------------------------------------------------------------- servidor
/** /api e /mcp vão para o Hono; o resto é o painel (arquivos de dist em produção, Vite em desenvolvimento). */
const httpServer = createServer((req, res) => {
  const url = req.url || '/';
  if (/^\/(api(\/|$)|mcp\b)/.test(url)) return void api(req, res);
  if (url === '/studio') { res.writeHead(302, { Location: '/studio/' }).end(); return; }
  if (url === '/' || url === '') { res.writeHead(302, { Location: '/studio/' }).end(); return; }
  let path: string;
  try { path = decodeURIComponent(new URL(url, 'http://x').pathname); } catch { res.writeHead(404).end('Not found'); return; }
  studioWeb(req, res, path).catch((err: any) => {
    const notFound = err && (err.code === 'ENOENT' || err.code === 'ENOTDIR');
    if (!notFound) console.error(err);
    if (!res.headersSent) res.writeHead(notFound ? 404 : 500).end(notFound ? 'Not found' : 'Internal error');
    else res.end();
  });
});
/** O painel mora em /studio/. */
const studioWeb = createWebHandler({ webRoot: join(root, 'apps', 'studio'), httpServer, base: '/studio/' });

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  try {
    await workspace.flushAll();
    await operations.idle();
    await mcp.closeAll();
    await renderer.close();
    await closeDb();
  } finally { process.exit(0); }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Rede local ativa por padrão; a autenticação continua obrigatória fora do modo de testes.
httpServer.listen(port, bindHost, () => {
  console.log(`\n  Stylo rodando em  http://localhost:${port}/studio/`);
  console.log(`  Acesso pela rede local      http://<IP-da-maquina>:${port}/studio/`);
  console.log(`  Banco de dados               ${process.env.DATABASE_URL ? 'Postgres (DATABASE_URL)' : 'PGlite em ' + dbDir}`);
  console.log(`  Acesso                       ${authMode === 'local' ? 'modo local (sem login)' : 'contas e senha'}`);
  console.log(`  Interface                   ${bindHost}${bindHost === '127.0.0.1' ? ' (somente este computador)' : ' (rede local habilitada)'}\n`);
});
