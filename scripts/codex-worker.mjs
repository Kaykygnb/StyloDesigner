// Cliente mínimo do `codex app-server` (JSON-RPC por stdio, uma mensagem JSON por linha) para usar o Codex como subagente.
// Uso: node scripts/codex-worker.mjs <worktree> "<tarefa em inglês>" [effort=low] [modelo] [sandbox=workspace-write|read-only]  (sempre numa worktree descartável; veja docs/estado/CODEX.md)
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const [cwd, task, effort = 'low', model = null, sandbox = 'workspace-write'] = process.argv.slice(2);
const child = spawn('codex', ['app-server', '--listen', 'stdio://', '-c', 'windows.sandbox="unelevated"'], { stdio: ['pipe', 'pipe', 'inherit'], shell: process.platform === 'win32' });
const pending = new Map();
let nextId = 1;
const log = { threadId: null, usage: null, diffs: [], messages: [], items: [], completed: null };
const send = (msg) => child.stdin.write(JSON.stringify(msg) + '\n');
const request = (method, params) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  send({ id, method, params });
});

let done;
const finished = new Promise((r) => { done = r; });
createInterface({ input: child.stdout }).on('line', (line) => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id !== undefined && (m.result !== undefined || m.error) && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    return m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  }
  if (m.id !== undefined && m.method) { // pedido do servidor (aprovação etc.): recusamos tudo, a política é "never"
    console.error('PEDIDO DO SERVIDOR (recusado):', m.method);
    return send({ id: m.id, result: { decision: 'decline' } });
  }
  switch (m.method) {
    case 'thread/tokenUsage/updated': log.usage = m.params; break;
    case 'turn/diff/updated': log.diffs.push(m.params); break;
    case 'item/completed': log.items.push(m.params?.item?.type || '?'); if (m.params?.item?.type === 'agentMessage') log.messages.push(m.params.item.text); break;
    case 'turn/completed': log.completed = m.params; done(); break;
    case 'error': console.error('ERRO:', JSON.stringify(m.params)); break;
  }
});

const t0 = Date.now();
await request('initialize', { clientInfo: { name: 'stylo-orquestrador', title: 'Stylo orquestrador', version: '0.1.0' } });
send({ method: 'initialized' });
const started = await request('thread/start', { cwd, ephemeral: true, approvalPolicy: 'never', sandbox, serviceName: 'stylo', ...(model && { model }) });
log.threadId = started?.thread?.id ?? started?.threadId;
await request('turn/start', { threadId: log.threadId, cwd, effort, ...(model && { model }), input: [{ type: 'text', text: task }] });
await Promise.race([finished, new Promise((_, rej) => setTimeout(() => rej(new Error('tempo esgotado')), 300000))]).catch((e) => console.error(e.message));
console.log(JSON.stringify({ seconds: (Date.now() - t0) / 1000, threadId: log.threadId, usage: log.usage, itemTypes: log.items, lastMessage: log.messages.at(-1), status: log.completed?.turn?.status ?? log.completed }, null, 2));
child.kill();
process.exit(0);
