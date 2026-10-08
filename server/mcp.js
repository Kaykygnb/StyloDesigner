/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  server/mcp.js — O PROTOCOLO MCP (Model Context Protocol), SEM DEPENDÊNCIAS
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  MCP é o "padrão de tomada" que programas de IA (Claude Code, Claude Desktop, Codex, Cursor...) usam para
 *  conversar com ferramentas externas. Por baixo é JSON-RPC 2.0: a IA manda { id, method, params } e recebe
 *  { id, result } ou { id, error }. Só precisamos de quatro métodos:
 *    initialize   → "oi, eu sou o Projeto Designer e sei usar ferramentas"
 *    tools/list   → a lista de agent/schema.js
 *    tools/call   → executa uma ferramenta (quem executa de verdade é o EDITOR aberto no navegador; ver server.js)
 *    ping         → "estou vivo"
 *  Mensagens sem `id` são avisos (notifications) e não têm resposta.
 *
 *  Este arquivo só traduz o protocolo; não sabe nada de HTTP nem de navegador (`callTool` vem de fora). Assim ele
 *  é testado direto no Node (tests/mcp.test.js) e usado tanto pelo endereço http://localhost:5173/mcp quanto pelo
 *  scripts/mcp.mjs (para programas que só falam MCP pela entrada/saída padrão, o "stdio").
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { mcpTools, toolByName, AGENT_INSTRUCTIONS } from '../src/agent/schema.js';

/** Versões do protocolo MCP que este servidor entende (a mais nova primeiro). */
export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

/** Resposta de erro do JSON-RPC (códigos padrão: -32601 método inexistente, -32602 parâmetro inválido...). */
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

/**
 * Responde UMA mensagem JSON-RPC do MCP.
 * @param {object} msg  a mensagem já lida (objeto)
 * @param {object} deps
 * @param {(name: string, args: object, client: string) => Promise<object>} deps.callTool  executa a ferramenta (no editor)
 * @param {string} deps.version  versão do app (aparece para a IA)
 * @param {{ name?: string }} [deps.session]  guarda o nome do programa que conectou (vem no initialize)
 * @param {string} [deps.instructions]  quem a IA é e como trabalhar (o servidor lê de docs/AGENTE.md)
 * @returns {Promise<object|null>}  a resposta, ou null quando a mensagem é um aviso (sem id)
 */
export async function handleMcp(msg, { callTool, version = '0.0.0', session = {}, instructions = AGENT_INSTRUCTIONS }) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(msg?.id ?? null, -32600, 'Pedido inválido (esperado JSON-RPC 2.0).');
  }
  const { id, method, params = {} } = msg;
  const isNotification = id === undefined || id === null;
  if (isNotification) return null; // notifications/initialized, notifications/cancelled...

  if (method === 'initialize') {
    const asked = params.protocolVersion;
    session.name = params.clientInfo?.name || session.name || 'IA externa';
    return {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'projeto-designer', title: 'Projeto Designer', version },
        instructions: `${instructions}\n\nO editor precisa estar aberto no navegador (npm start → http://localhost:5173). Cada alteração aparece para a pessoa aprovar.`,
      },
    };
  }
  if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
  if (method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools: mcpTools() } };
  if (method === 'tools/call') {
    const name = params.name;
    if (!toolByName(name)) return rpcError(id, -32602, `Ferramenta desconhecida: ${name}`);
    let out;
    try {
      out = await callTool(name, params.arguments || {}, session.name || 'IA externa');
    } catch (err) {
      // erro de execução (editor fechado, tempo esgotado...): volta como resultado com isError, para a IA ler e explicar
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: err.message || String(err) }], isError: true } };
    }
    const isError = !!(out && (out.error || out.refused));
    // get_image: a imagem vai como conteúdo de IMAGEM do MCP (o Claude/GPT vê o design); o resto, como texto
    const { _image, _summary, ...rest } = out || {};
    const content = [];
    if (_image?.data) content.push({ type: 'image', data: _image.data, mimeType: _image.mimeType || 'image/png' });
    content.push({ type: 'text', text: JSON.stringify(rest, null, 2) });
    return { jsonrpc: '2.0', id, result: { content, isError } };
  }
  return rpcError(id, -32601, `Método não suportado: ${method}`);
}
