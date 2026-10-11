// O servidor MCP conversa com o CLIENTE OFICIAL do SDK (o mesmo protocolo que Claude Code, Codex etc. usam):
// initialize com instruções, lista de ferramentas, chamada, imagem como conteúdo, erro como isError e sessão encerrada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const freePort = () => new Promise((resolve) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

async function startServer(t) {
  const tmp = await mkdtemp(join(tmpdir(), 'stylo-sdk-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../apps/server/src/main.ts', import.meta.url))], {
    env: { ...process.env, PORT: String(port), DESIGNER_CONFIG: join(tmp, 'config.json'), DESIGNER_DB_DIR: 'memory' }, stdio: 'ignore',
  });
  t.after(() => child.kill());
  const base = `http://127.0.0.1:${port}`;
  // espera o servidor subir (até 60 s: sob carga o PGlite e o Vite demoram) e falha clara se não subir
  for (let i = 0, up = false; !up; i++) {
    if (i > 2400) throw new Error('o servidor de teste não subiu em 60 s');
    try { up = (await fetch(base + '/api/status')).ok; } catch { /* ainda subindo */ }
    if (!up) await new Promise((r) => setTimeout(r, 25));
  }
  return base;
}

async function connect(base, name = 'Claude Code') {
  const client = new Client({ name, version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp')));
  return client;
}
const text = (r) => JSON.parse(r.content.find((c) => c.type === 'text').text);

test('cliente oficial: initialize traz as instruções, tools/list as 79 ferramentas, e uma sessão trabalha de ponta a ponta', async (t) => {
  const base = await startServer(t);
  const client = await connect(base);
  t.after(() => client.close());

  assert.equal(client.getServerVersion().name, 'projeto-designer');
  assert.match(client.getInstructions(), /new_project/);
  const { tools } = await client.listTools();
  assert.equal(tools.length, 79, "61 do núcleo + 8 de identidade + 10 de assets");
  assert.ok(tools.find((x) => x.name === 'get_document').annotations.readOnlyHint);
  assert.ok(tools.find((x) => x.name === 'delete_layers').annotations.destructiveHint);

  // ferramenta de plugin pelo cliente oficial: calcula sem projeto aberto
  const scale = await client.callTool({ name: 'color_scale', arguments: { color: '#2F6AE0' } });
  assert.equal(scale.isError, false);
  assert.equal(text(scale).scale.length, 11);
  assert.ok(tools.find((x) => x.name === 'color_contrast').annotations.readOnlyHint);

  const created = await client.callTool({ name: 'new_project', arguments: { name: 'Pelo SDK' } });
  assert.equal(created.isError, false);
  assert.equal(text(created).file, 'pelo-sdk.json');
  const layer = await client.callTool({ name: 'create_layer', arguments: { type: 'frame', props: { name: 'Hero', w: 300, h: 200 } } });
  assert.equal(text(layer).ok, true);

  // erro da ferramenta volta como resultado com isError (a IA lê e corrige), não como falha do protocolo
  const bad = await client.callTool({ name: 'get_layer', arguments: { id: 'nao-existe' } });
  assert.equal(bad.isError, true);
  assert.match(text(bad).error, /não existe/);
  // ferramenta inexistente é erro de protocolo
  await assert.rejects(client.callTool({ name: 'rm_rf', arguments: {} }), /Ferramenta desconhecida/);
  // ping do protocolo
  await client.ping();

  // o servidor registrou o agente pelo nome do programa e o log mostra a alteração
  const agents = await (await fetch(base + '/api/projects/pelo-sdk.json/activity')).json();
  assert.ok(agents.some((a) => a.who === 'Claude Code' && a.tool === 'create_layer'));
});

test('cliente oficial: sessões diferentes não misturam o projeto atual e cada uma tem o seu agente', async (t) => {
  const base = await startServer(t);
  const a = await connect(base, 'Claude Code');
  const b = await connect(base, 'Codex');
  t.after(() => Promise.all([a.close(), b.close()]));
  await a.callTool({ name: 'new_project', arguments: { name: 'Isolado' } });
  const semProjeto = await b.callTool({ name: 'get_document', arguments: {} });
  assert.equal(semProjeto.isError, true);
  assert.match(text(semProjeto).error, /Nenhum projeto aberto/);
  const op = await b.callTool({ name: 'open_project', arguments: { file: 'isolado.json' } });
  assert.equal(op.isError, false, JSON.stringify(op.content));
  const opened = await b.callTool({ name: 'get_document', arguments: {} });
  assert.equal(opened.isError, false, JSON.stringify(opened.content));
  const presence = await (await fetch(base + '/api/presence')).json();
  assert.deepEqual(presence.agents.map((x) => x.name).sort(), ['Claude Code', 'Codex']);
});

test('encerrar a sessão (DELETE) tira o agente da presença', async (t) => {
  const base = await startServer(t);
  const client = await connect(base, 'Cursor');
  await client.callTool({ name: 'list_projects', arguments: {} });
  assert.equal((await (await fetch(base + '/api/presence')).json()).agents.length, 1);
  await client.transport.terminateSession();
  await client.close();
  await new Promise((r) => setTimeout(r, 200));
  assert.equal((await (await fetch(base + '/api/presence')).json()).agents.length, 0);
});
