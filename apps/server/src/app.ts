/**
 * app.ts — A APLICAÇÃO HTTP (Hono): proteções, rotas da API e o endereço /mcp
 * Quem não é /api nem /mcp (o editor) é entregue por web.js. Tudo que entra passa primeiro pelas proteções locais.
 */

import { Hono } from 'hono';
import type { HttpBindings } from '@hono/node-server';
import type { Services } from './context.js';
import type { Identity } from './http/identity.js';
import type { McpGateway } from './mcp/gateway.js';
import { errorHandler, limit, localOnly, MAX_JSON, MAX_MEDIUM, MAX_PROJECT } from './http/guards.js';
import { authRoutes } from './routes/auth.js';
import { MAX_UPLOAD } from './routes/library.js';
import { projectRoutes } from './routes/projects.js';
import { systemRoutes } from './routes/system.js';
import { legacyRoutes } from './routes/legacy.js';
import { libraryRoutes } from './routes/library.js';
import { pluginRoutes } from './routes/plugins.js';
import { studioRoutes } from './routes/studio.js';
import type { StudioCaller } from './studio/studio-calls.js';
import type { AssetServices } from '@stylo/plugins/assets/types.ts';

/** Tamanho máximo do corpo por rota: um projeto aceita muito (imagens embutidas); miniaturas e MCP, médio; o resto, pouco. */
function bodyLimitFor(method: string, path: string): number {
  if (method === 'GET' || method === 'HEAD') return MAX_PROJECT;
  if (/^\/api\/projects\/[^/]+$/.test(path) && method === 'PUT') return MAX_PROJECT;
  if (method === 'POST' && path === '/api/library') return MAX_UPLOAD;
  if (method === 'POST' && path === '/api/studio/call') return MAX_MEDIUM; // ferramentas com imagem em base64
  if (/\/thumb$/.test(path) || path.startsWith('/api/imageai/')) return MAX_MEDIUM;
  return MAX_JSON;
}

export function createApp(s: Services, identity: Identity, mcp: McpGateway, assetServices: AssetServices, studio: StudioCaller) {
  const app = new Hono<{ Bindings: HttpBindings }>();
  app.onError(errorHandler);
  app.notFound((c) => c.json({ error: 'Rota não encontrada.' }, 404));

  // escritas na API exigem JSON, exceto o envio de arquivo da biblioteca (os bytes do arquivo são o corpo)
  const jsonOnly = localOnly(s.port, { requireJson: true });
  const binaryOk = localOnly(s.port, { requireJson: false });
  app.use('/api/*', (c, next) => (c.req.method === 'POST' && (c.req.path === '/api/library' || /^\/api\/library\/[^/]+\/replace$/.test(c.req.path)) ? binaryOk(c, next) : jsonOnly(c, next)));
  app.use('/api/*', (c, next) => limit(bodyLimitFor(c.req.method, c.req.path))(c, next));
  app.route('/api', authRoutes(s, identity));
  app.route('/api', projectRoutes(s, identity));
  app.route('/api', systemRoutes(s, identity));
  app.route('/api', legacyRoutes(s));
  app.route('/api', libraryRoutes(s, identity, assetServices));
  app.route('/api', pluginRoutes(s, identity, assetServices));
  app.route('/api', studioRoutes(s, identity, studio));

  app.use('/mcp', localOnly(s.port, { originAlways: true }), limit(MAX_MEDIUM));
  app.all('/mcp', (c) => mcp.handle(c));

  return app;
}
