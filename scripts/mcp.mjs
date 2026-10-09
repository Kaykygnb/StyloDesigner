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
/** Escreve uma resposta (uma linha JSON) na saída. NADA além disso pode ir para a saída: quebraria o protocolo. */
const send = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`);

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', async (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido.' } }); }
  try {
    const r = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: line });
    if (r.status === 202) return; // aviso (notification): sem resposta
    const out = await r.json();
    if (Array.isArray(out)) out.forEach(send); else send(out);
  } catch {
    // servidor desligado: só pedidos (com id) recebem resposta de erro; avisos são ignorados
    if (msg && msg.id !== undefined && msg.id !== null) {
      send({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: `O Stylo não está rodando em ${BASE}. Rode "npm start" na pasta do projeto e abra o editor no navegador.` } });
    }
  }
});
// mensagens para pessoas vão para a saída de ERRO (stderr), que o protocolo ignora
process.stderr.write(`Stylo MCP (stdio) → ${BASE}/mcp\n`);
