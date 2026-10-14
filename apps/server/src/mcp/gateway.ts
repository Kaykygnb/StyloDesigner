/**
 * mcp/gateway.ts — O SERVIDOR MCP (protocolo do SDK oficial + sessões, identidade e limites do Stylo)
 *
 * O protocolo (initialize, tools/list, tools/call, ping, cancelamento, Streamable HTTP) vem do SDK oficial
 * `@modelcontextprotocol/sdk`. Este arquivo cuida do que é nosso:
 *   - QUEM é o agente: `Authorization: Bearer stylo_agt_...`; sem token o canal não abre;
 *   - uma sessão por cliente (cabeçalho Mcp-Session-Id), no máximo 64, e a limpeza das paradas há 10 min;
 *   - as ferramentas: a lista vem de @stylo/core/tools/schema.js e cada chamada passa pelo `ToolCaller` (presença e travas).
 * Um `Server` do SDK por sessão: o agente da sessão vive no fechamento dos handlers.
 */

import type { Context } from 'hono';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { mcpTools, mcpToolByName } from '@stylo/core/tools/schema.js';
import { httpError } from '../http-error.js';
import type { Services } from '../context.js';
import { bearerOf } from '../http/identity.js';
import { sha256 } from '../services/auth.js';
import type { McpSession, ToolCaller } from './agent-calls.js';

export const MAX_MCP_SESSIONS = 64;
const IDLE_MS = 10 * 60 * 1000;

interface Entry { session: McpSession; server: Server; transport: WebStandardStreamableHTTPServerTransport }

/** Resposta de uma ferramenta no formato do MCP: imagem como conteúdo de IMAGEM (o modelo vê o design), o resto como texto. */
export function toolResult(out: any) {
  const isError = !!(out && (out.error || out.refused));
  const { _image, _summary, ...rest } = out || {};
  const content: any[] = [];
  if (_image?.data) content.push({ type: 'image', data: _image.data, mimeType: _image.mimeType || 'image/png' });
  content.push({ type: 'text', text: JSON.stringify(rest, null, 2) });
  return { content, isError };
}

export function createMcpGateway({ s, caller, instructions, version }: {
  s: Pick<Services, 'agents' | 'events'> & { presence: any };
  caller: ToolCaller;
  /** Texto de instruções entregue ao agente (lido do arquivo a cada sessão nova). */
  instructions: () => Promise<string>;
  version: string;
}) {
  const sessions = new Map<string, Entry>();
  /** Sessão encerrada por revogação/rotação/suspensão: o próximo pedido recebe 401, não 404. */
  const ended = new Map<string, number>();
  const rememberEnded = (id: string) => { if (id) ended.set(id, Date.now()); };

  function closeSession(id: string) {
    const entry = sessions.get(id);
    if (!entry) return;
    sessions.delete(id);
    entry.session.closing = true;
    if (!entry.session.activeCalls) caller.endSession(entry.session);
  }

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const entry of sessions.values()) {
      if (!entry.session.activeCalls && now - entry.session.lastSeen > IDLE_MS) void entry.transport.close();
    }
    for (const [id, at] of ended) if (now - at > IDLE_MS) ended.delete(id);
  }, 60_000);
  sweep.unref();
  // Revogação, rotação e suspensão fecham o canal mesmo sem um POST novo. Não cancela o passo que já passou da checagem do sinal.
  const recheck = setInterval(() => {
    for (const entry of [...sessions.values()]) void revalidate(null, entry).catch(() => {});
  }, 2_000);
  recheck.unref();

  /** Quem é o agente deste pedido e o hash da credencial presa à sessão. Sem token, não entra. */
  async function bindAgent(c: Context) {
    const token = bearerOf(c);
    if (!token) throw httpError(401, 'Envie o token do agente: Authorization: Bearer stylo_agt_...');
    const agent = await s.agents.authenticate(token);
    return { agent, credentialHash: sha256(token) };
  }

  /** Bearer de outro agente não troca a sessão. Sem bearer, a credencial presa é revalidada. Falha da credencial fecha o canal. */
  async function revalidate(c: Context | null, entry: Entry) {
    const token = c ? bearerOf(c) : '';
    const drop = () => {
      rememberEnded(entry.session.id);
      entry.session.abort.abort();
      void entry.transport.close().catch(() => {});
    };
    if (token) {
      let agent;
      try { agent = await s.agents.authenticate(token); } catch (err) {
        try { entry.session.agent = await s.agents.revalidateBound(entry.session.agent.id, entry.session.credentialHash); } catch (bound) {
          drop();
          throw bound;
        }
        throw err;
      }
      if (agent.id !== entry.session.agent.id) throw httpError(401, 'Esta sessão MCP pertence a outro agente.');
      entry.session.agent = agent;
      entry.session.credentialHash = sha256(token);
      return;
    }
    try { entry.session.agent = await s.agents.revalidateBound(entry.session.agent.id, entry.session.credentialHash); } catch (err) {
      drop();
      throw err;
    }
  }

  async function open(c: Context, request: Request, body: any, initMessage: any): Promise<Response> {
    if (sessions.size >= MAX_MCP_SESSIONS) throw httpError(429, `Há ${MAX_MCP_SESSIONS} sessões MCP abertas. Feche alguma (DELETE /mcp com Mcp-Session-Id) ou aguarde 10 min sem uso.`);
    const { agent, credentialHash } = await bindAgent(c);
    const forced = (c.req.header('x-stylo-agent') || '').slice(0, 40);
    const session: McpSession = { id: '', agent, credentialHash, abort: new AbortController(), name: forced || agent.name, activeCalls: 0, closing: false, lastSeen: Date.now() };

    const server = new Server(
      { name: 'projeto-designer', title: 'Stylo', version },
      {
        capabilities: { tools: { listChanged: false } },
        instructions: `${await instructions()}\n\nO servidor mantém os projetos e grava sozinho: não é preciso ter o editor aberto no navegador. Comece com list_projects/open_project ou new_project.`,
      },
    );
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpTools() as any }));
    server.setRequestHandler(CallToolRequestSchema, async (req, extra) => {
      const name = req.params.name;
      if (!mcpToolByName(name)) throw new McpError(ErrorCode.InvalidParams, `Ferramenta desconhecida: ${name}`);
      // A credencial é revalidada de novo aqui: suspensão ou revogação no meio do pedido não segue para a ferramenta.
      try { session.agent = await s.agents.revalidateBound(session.agent.id, session.credentialHash); } catch (err: any) {
        session.abort.abort();
        throw new McpError(ErrorCode.InvalidRequest, err?.message || 'Sessão revogada.');
      }
      if (session.abort.signal.aborted) throw new McpError(ErrorCode.InvalidRequest, 'Sessão revogada.');
      const signal = extra.signal ? AbortSignal.any([session.abort.signal, extra.signal]) : session.abort.signal;
      let out: any;
      try { out = await caller.call(session, name, req.params.arguments || {}, signal); } catch (err: any) {
        // erro de execução (cancelado, falha interna...): volta como resultado com isError, para a IA ler e explicar
        return { content: [{ type: 'text', text: err.message || String(err) }], isError: true };
      }
      return toolResult(out);
    });

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (id) => {
        session.id = id;
        sessions.set(id, { session, server, transport });
        s.presence.touchAgent(id, session.name, '');
        s.events.broadcastPresence();
      },
      onsessionclosed: (id) => closeSession(id),
    });
    server.onclose = () => { if (session.id) closeSession(session.id); };
    await server.connect(transport);
    return transport.handleRequest(request, { parsedBody: body });
  }

  /** Aceita clientes que esquecem o `Accept` (curl): o protocolo exige os dois tipos, nós completamos. */
  const lenient = (request: Request, text?: string) => {
    const headers = new Headers(request.headers);
    const accept = headers.get('accept') || '';
    if (!/application\/json/.test(accept) || !/text\/event-stream/.test(accept)) headers.set('accept', 'application/json, text/event-stream');
    return new Request(request.url, { method: request.method, headers, ...(text !== undefined ? { body: text } : {}) });
  };

  /** Entrada de /mcp (POST, GET e DELETE). */
  async function handle(c: Context): Promise<Response> {
    const request = c.req.raw;
    const sid = request.headers.get('mcp-session-id') || '';
    if (request.method === 'POST') {
      const text = await request.text();
      let body: any;
      try { body = JSON.parse(text); } catch { return c.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido.' } }, 400); }
      const messages = Array.isArray(body) ? body : [body];
      const initMessage = messages.find((m) => m?.method === 'initialize');
      if (!sid) {
        if (!initMessage) throw httpError(400, 'Mcp-Session-Id ausente. Envie o cabeçalho devolvido pelo initialize para executar ferramentas sem misturar sessões MCP.');
        return open(c, lenient(request, text), body, initMessage);
      }
      const entry = sessions.get(sid);
      if (!entry) {
        if (ended.has(sid)) throw httpError(401, 'Esta sessão MCP foi encerrada.');
        return new Response(null, { status: 404 });
      }
      await revalidate(c, entry);
      entry.session.lastSeen = Date.now();
      return entry.transport.handleRequest(lenient(request, text), { parsedBody: body });
    }
    if (request.method === 'GET' || request.method === 'DELETE') {
      const entry = sid ? sessions.get(sid) : undefined;
      if (!entry) {
        if (sid && ended.has(sid)) throw httpError(401, 'Esta sessão MCP foi encerrada.');
        return new Response(null, { status: 404 });
      }
      await revalidate(c, entry);
      entry.session.lastSeen = Date.now();
      return entry.transport.handleRequest(lenient(request));
    }
    return new Response(null, { status: 405, headers: { Allow: 'POST, GET, DELETE' } });
  }

  function closeMatching(match: (entry: Entry) => boolean) {
    for (const entry of [...sessions.values()]) {
      if (!match(entry)) continue;
      rememberEnded(entry.session.id);
      entry.session.abort.abort();
      void entry.transport.close().catch(() => {});
    }
  }

  return {
    handle,
    sessionCount: () => sessions.size,
    closeForOwner: (ownerId: string) => closeMatching((entry) => entry.session.agent.ownerId === ownerId),
    closeForAgent: (agentId: string) => closeMatching((entry) => entry.session.agent.id === agentId),
    closeAll: async () => { for (const e of [...sessions.values()]) await e.transport.close().catch(() => {}); },
  };
}

export type McpGateway = ReturnType<typeof createMcpGateway>;
