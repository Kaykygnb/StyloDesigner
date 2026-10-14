/**
 * main.ts — LIGA O SERVIDOR DO STYLO
 *
 *   npm start   →   http://localhost:5173
 *
 * Monta os serviços (configuração, banco, contas, agentes, projetos, workspace, renderizador), a aplicação HTTP (Hono)
 * e o servidor MCP, e entrega o editor. Uso SOMENTE LOCAL: escuta só em 127.0.0.1. Variáveis: PORT, DESIGNER_CONFIG
 * (arquivo de configuração), DESIGNER_DB (arquivo do banco SQLite), STYLO_AUTH=local (sem login, só testes), STYLO_DEV=1 (Vite).
 * Segurança: ver http/guards.ts (Host/Origin locais, limites de corpo).
 */

import { existsSync } from 'node:fs';
import { readFile, readdir, rm, stat } from 'node:fs/promises';
import './dom-polyfill.js';
import { createServer } from 'node:http';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRequestListener } from '@hono/node-server';
import { VERSION } from '@stylo/core/version.js';
import { AGENT_INSTRUCTIONS } from '@stylo/core/tools/schema.js';
import { createConfigStore, loadConfig } from './config.js';
import { defaultBlobDir, defaultDbFile, legacyDbDir, openDb } from './db.js';
import { importLegacyPglite } from '@stylo/db/legacy.ts';
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
let dbFile = defaultDbFile(configFile);
const inMemory = dbFile === 'memory';
if (!inMemory) await applyPendingRestore(dbFile);

/** Cópias que dá para tentar quando o arquivo principal está ilegível (mais novas primeiro). */
async function recoveryCandidates(file: string) {
  const parent = dirname(resolve(file));
  const base = basename(resolve(file));
  const entries = await readdir(parent, { withFileTypes: true }).catch(() => []);
  const prefix = [`${base}.before-migrations-`, `stylo-backup-${base}-`];
  const candidates = entries
    .filter((entry) => entry.isFile() && entry.name !== base && prefix.some((item) => entry.name.startsWith(item)) && !entry.name.endsWith('-wal') && !entry.name.endsWith('-shm'))
    .map((entry) => join(parent, entry.name));
  return (await Promise.all(candidates.map(async (candidate) => ({ candidate, mtime: (await stat(candidate)).mtimeMs })))).sort((a, b) => b.mtime - a.mtime).map((item) => item.candidate);
}

async function openWithRecovery(file: string) {
  try {
    return await openDb({ file });
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (!/not a database|malformed|corrupt|disk image/i.test(text)) throw error;
    for (const candidate of await recoveryCandidates(file)) {
      try {
        const recovered = await openDb({ file: candidate });
        await recovered.db.user.count();
        console.error(`O banco em ${file} está ilegível; usando a cópia íntegra ${candidate}. O original foi preservado.`);
        dbFile = candidate;
        return recovered;
      } catch {
        // Tenta a próxima cópia sem mascarar o erro original.
      }
    }
    throw error;
  }
}
const opened = await (async () => {
  try {
    const firstRun = !inMemory && !existsSync(dbFile);
    const handle = await openWithRecovery(dbFile);
    // Primeira abertura com o banco novo e existe a pasta do banco antigo (PGlite): traz os dados uma vez.
    const legacy = legacyDbDir(configFile);
    if (firstRun && existsSync(legacy)) {
      console.log(`\n  Trazendo seus dados do banco antigo (${legacy}) para o novo formato…`);
      try {
        await importLegacyPglite(legacy, handle.db, console.log);
        console.log('  Pronto. A pasta antiga não foi alterada; depois de conferir, pode apagá-la.\n');
      } catch (error) {
        await handle.close().catch(() => undefined);
        await Promise.all([dbFile, `${dbFile}-wal`, `${dbFile}-shm`].map((f) => rm(f, { force: true })));
        throw error;
      }
    }
    return handle;
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (/locked|busy/i.test(text)) {
      console.error('Não foi possível abrir o banco: ele está em uso por outro processo. Feche o outro Stylo ou defina DESIGNER_DB para outro arquivo. (' + dbFile + ')');
    } else if (/not a database|malformed|corrupt|disk image/i.test(text)) {
      console.error('O banco não pôde ser lido. Preserve o arquivo e restaure um backup, ou use DESIGNER_DB com uma cópia recuperada. (' + dbFile + ')');
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
/** Só este computador: o servidor nunca escuta na rede. */
const bindHost = '127.0.0.1';
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
const blobs = createBlobStore(defaultBlobDir(dbFile));
const library = createLibrary({ db, blobs });
const secrets = createSecrets(db, await loadSecretKey(configFile.replace(/(\.config)?\.json$/i, '') + '.secret'));
const assetServices = createAssetServices({ library, secrets, sources: createAssetSources(db), config });
const plugins = createPlugins({ plugins: builtinPlugins, enabled: config.get().plugins?.enabled, services: { fetchImage: (url: string) => fetchRemoteImage(url), assets: assetServices } });
const agents = createAgents(db);
const backups = createBackups({ dbFile, db });
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

httpServer.listen(port, bindHost, () => {
  console.log(`\n  Stylo rodando em  http://localhost:${port}/studio/`);
  console.log(`  Banco de dados    ${dbFile}`);
  console.log(`  Acesso            ${authMode === 'local' ? 'modo local (sem login)' : 'contas e senha'} · somente este computador\n`);
});
