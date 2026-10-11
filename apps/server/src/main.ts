/**
 * main.ts — LIGA O SERVIDOR DO STYLO
 *
 *   npm start   →   http://localhost:5173
 *
 * Monta os serviços (configuração, banco, contas, agentes, projetos, workspace, renderizador), a aplicação HTTP (Hono)
 * e o servidor MCP, e entrega o editor. Variáveis: PORT, DESIGNER_CONFIG (arquivo de configuração), DATABASE_URL
 * (Postgres; sem ela, PGlite embutido), DESIGNER_DB_DIR, STYLO_AUTH=accounts (login com contas), STYLO_DEV=1 (força o Vite).
 * Segurança: escuta só em 127.0.0.1; ver http/guards.ts (Host/Origin locais, limites de corpo).
 */

import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
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
import { createWorkspace } from './workspace/index.js';
import { createPresence } from './presence.js';
import { createEvents } from './events.js';
import { createIdentity } from './http/identity.js';
import { createToolCaller } from './mcp/agent-calls.js';
import { createMcpGateway } from './mcp/gateway.js';
import { createApp } from './app.js';
import { createWebHandler } from './web.js';
import type { Services } from './context.js';

const here = resolve(fileURLToPath(new URL('.', import.meta.url)));
const root = resolve(here, '..', '..', '..');
const port = Number(process.env.PORT) || 5173;
const configFile = resolve(process.env.DESIGNER_CONFIG || join(root, 'designer.config.json'));
// perfil da conta local (sem senha): ao lado da configuração. designer.config.json → designer.account.json
const accountFile = configFile.replace(/(\.config)?\.json$/i, '') + '.account.json';

const config = createConfigStore(configFile, await loadConfig(configFile));
const dbDir = defaultDbDir(configFile);
const { db, close: closeDb } = await openDb({ dir: dbDir });

const auth = createAuth(db);
const authMode = process.env.STYLO_AUTH === 'accounts' ? 'accounts' : 'local';
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
workspace = createWorkspace({
  projects, notes, sharing, operations, presence: () => presence.snapshot(),
  renderImage: (node, doc, scale) => renderer.render(node, doc, scale),
  baseUrl: () => `http://localhost:${port}`,
  onOperation: (op) => { operations.record(op).catch((err) => console.error('log de operações:', err.message)); },
});

const services: Services = {
  port, root, here, config, accountFile, db, auth, agents: createAgents(db), operations, notes, sharing, projects, renderer,
  workspace, events, authMode, localUser, presence,
};
const identity = createIdentity(services);
const caller = createToolCaller({ workspace, presence, events });
/** Instruções entregues aos agentes (o arquivo é lido a cada sessão nova: editar muda o comportamento sem reiniciar). */
const instructions = () => readFile(join(here, 'instrucoes-agente.txt'), 'utf8').catch(() => AGENT_INSTRUCTIONS);
const mcp = createMcpGateway({ s: services, identity, caller, instructions, version: VERSION });
const app = createApp(services, identity, mcp);
const api = getRequestListener(app.fetch);

// ---------------------------------------------------------------- servidor
/** /api e /mcp vão para o Hono; o resto é o editor (arquivos de dist em produção, Vite em desenvolvimento). */
const httpServer = createServer((req, res) => {
  const url = req.url || '/';
  if (/^\/(api(\/|$)|mcp\b)/.test(url)) return void api(req, res);
  let path: string;
  try { path = decodeURIComponent(new URL(url, 'http://x').pathname); } catch { res.writeHead(404).end('Not found'); return; }
  web(req, res, path).catch((err: any) => {
    const notFound = err && (err.code === 'ENOENT' || err.code === 'ENOTDIR');
    if (!notFound) console.error(err);
    if (!res.headersSent) res.writeHead(notFound ? 404 : 500).end(notFound ? 'Not found' : 'Internal error');
    else res.end();
  });
});
const web = createWebHandler({ webRoot: join(root, 'apps', 'web'), httpServer });

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

// escuta só em 127.0.0.1 (localhost): ninguém na sua rede consegue acessar o servidor
httpServer.listen(port, '127.0.0.1', () => {
  console.log(`\n  Stylo rodando em  http://localhost:${port}`);
  console.log(`  Banco de dados               ${process.env.DATABASE_URL ? 'Postgres (DATABASE_URL)' : 'PGlite em ' + dbDir}`);
  console.log(`  Acesso                       ${authMode === 'local' ? 'modo local (sem login)' : 'contas e senha'}\n`);
});
