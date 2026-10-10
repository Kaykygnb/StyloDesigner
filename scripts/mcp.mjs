#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  scripts/mcp.mjs — SERVIDOR MCP POR "STDIO" (para Claude Desktop, Codex e outros)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Alguns programas de IA só sabem ligar um servidor MCP como um programa de terminal: eles escrevem os pedidos
 *  (uma mensagem JSON por linha) na ENTRADA dele e leem as respostas na SAÍDA. Este script é só um "repassador":
 *  cada linha que chega vai para o endereço http://localhost:5173/mcp do servidor do app (npm start), e a resposta
 *  volta como uma linha. Toda a lógica fica no servidor (server/mcp.js) e no editor aberto no navegador.
 *
 *  Precisa: `npm start` rodando e o editor aberto no navegador.
 *  Variável opcional: DESIGNER_URL (padrão http://localhost:5173).
 *
 *  Exemplos de configuração (veja o README para todos):
 *    Claude Code:  claude mcp add designer -- node /caminho/do/projeto/scripts/mcp.mjs
 *    Codex:        ~/.codex/config.toml → [mcp_servers.designer] command = "node", args = ["/caminho/scripts/mcp.mjs"]
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { createInterface } from 'node:readline';

const BASE = (process.env.DESIGNER_URL || 'http://localhost:5173').replace(/\/+$/, '');
/**
 * Nome deste agente na presença e na janela de permissão (vários agentes no mesmo projeto): --agente "Nome" ou
 * a variável STYLO_AGENT. Sem isso, vale o nome que o programa manda no initialize (ex.: "claude-code").
 */
const argi = process.argv.indexOf('--agente');
const AGENT = String((argi > 0 && process.argv[argi + 1]) || process.env.STYLO_AGENT || '').slice(0, 40);
/** Sessão MCP deste processo (o servidor cria no initialize): cada janela de agente é uma sessão separada. */
let session = '';
/** Escreve uma resposta (uma linha JSON) na saída. NADA além disso pode ir para a saída: quebraria o protocolo. */
const send = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`);

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
/** Libera a presença e as travas do agente quando o cliente fecha o processo normalmente. */
async function disconnect() {
  if (!session) return;
  const headers = { Accept: 'application/json', 'Mcp-Session-Id': session, ...(AGENT ? { 'X-Stylo-Agent': AGENT } : {}) };
  try { await fetch(`${BASE}/mcp`, { method: 'DELETE', headers }); } catch { /* o servidor pode já ter encerrado */ }
  session = '';
}
let initializeTask = null;
const tasks = new Set();
rl.on('close', () => {
  // Aguarda os pedidos já recebidos antes de encerrar a sessão MCP.
  void Promise.allSettled([...tasks]).then(disconnect).finally(() => process.exit(0));
});
rl.on('SIGINT', () => rl.close());
rl.on('line', (line) => {
  let method = '';
  try { method = JSON.parse(line).method || ''; } catch { /* handleLine devolve o erro JSON-RPC */ }
  let task;
  if (method === 'initialize') {
    task = handleLine(line);
    initializeTask = task;
  } else {
    // A inicialização fornece o id de sessão; depois disso, chamadas independentes ficam concorrentes.
    task = Promise.resolve(initializeTask).then(() => handleLine(line));
  }
  tasks.add(task);
  void task.finally(() => tasks.delete(task));
});

async function handleLine(line) {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido.' } }); }
  try {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json', ...(session ? { 'Mcp-Session-Id': session } : {}), ...(AGENT ? { 'X-Stylo-Agent': AGENT } : {}) };
    const r = await fetch(`${BASE}/mcp`, { method: 'POST', headers, body: line });
    session = r.headers.get('mcp-session-id') || session;
    if (r.status === 202) return; // aviso (notification): sem resposta
    if (!r.ok) {
      const detail = (await r.text()).trim().slice(0, 240);
      throw new Error(`HTTP ${r.status}${detail ? `: ${detail}` : ''}`);
    }
    const out = await r.json();
    if (Array.isArray(out)) out.forEach(send); else send(out);
  } catch (err) {
    // Só pedidos (com id) recebem resposta de erro; avisos falhos são registrados no stderr.
    if (msg && msg.id !== undefined && msg.id !== null) {
      const connectionRefused = err?.cause?.code === 'ECONNREFUSED';
      const message = connectionRefused
        ? `O Stylo não está rodando em ${BASE}. Rode "npm start" na pasta do projeto e abra o editor no navegador.`
        : `Falha ao falar com o Stylo em ${BASE}: ${err.message}`;
      send({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message } });
    } else process.stderr.write(`Falha no aviso MCP: ${err.message}\n`);
  }
}
// mensagens para pessoas vão para a saída de ERRO (stderr), que o protocolo ignora
process.stderr.write(`Stylo MCP (stdio) → ${BASE}/mcp\n`);
