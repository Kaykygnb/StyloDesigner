/**
 * routes/legacy.ts — FOTOS E IA DE IMAGEM (ainda escritas sobre req/res do Node)
 *   /api/photos/*    busca de fotos livres e proxy de imagem (photos.js)
 *   /api/imageai/*   edição generativa de foto com a chave guardada aqui (imageai.js)
 * São recursos do editor atual. Viram plugins MCP (ferramentas search_photos / generate_image) quando refizermos o editor;
 * até lá o Hono só entrega o req/res original a eles.
 */

import { Hono } from 'hono';
import { RESPONSE_ALREADY_SENT } from '@hono/node-server/utils/response';
import type { HttpBindings } from '@hono/node-server';
import { createPhotosHandler } from '../photos.js';
import { createImageAi } from '../imageai.js';
import type { Services } from '../context.js';

export function legacyRoutes(s: Services) {
  const r = new Hono<{ Bindings: HttpBindings }>();
  const photos = createPhotosHandler({ getKey: (cfg: any) => cfg.pexels?.apiKey || process.env.PEXELS_API_KEY || '' });
  const imageAi = createImageAi({ getConfig: () => s.config.get(), saveConfig: (next: any) => s.config.set(next) });

  r.all('/photos/*', async (c) => {
    await photos(c.env.incoming as any, c.env.outgoing as any, s.config.get());
    return RESPONSE_ALREADY_SENT;
  });

  r.all('/imageai/*', async (c) => {
    const parts = c.req.path.split('/').filter(Boolean).slice(2); // ['api', 'imageai', ...resto]
    try {
      await imageAi(c.env.incoming as any, c.env.outgoing as any, parts);
      return RESPONSE_ALREADY_SENT;
    } catch (err: any) {
      if (c.env.outgoing.headersSent) { c.env.outgoing.end(); return RESPONSE_ALREADY_SENT; }
      throw err; // o tratador central responde (status e mensagem do erro, ou 500 genérico)
    }
  });

  return r;
}
