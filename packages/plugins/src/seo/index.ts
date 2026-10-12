import { z } from 'zod';
import { definePlugin } from '@stylo/core/plugin.ts';
import { defineTool } from '@stylo/core/tools/schema.ts';

const schema = z.object({ title: z.string().max(160).optional(), description: z.string().max(320).optional(), canonical: z.string().max(500).optional(), image: z.string().max(2000).optional(), favicon: z.string().max(2000).optional(), lang: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).optional() });

export const seo = definePlugin({
  id: 'seo', name: 'SEO e Open Graph', description: 'Define metadata, descrição, canonical, favicon e Open Graph para a publicação.', category: 'exporter', version: '1.0.0', author: 'Stylo', license: 'MIT', repository: 'https://ogp.me/', permissions: ['read', 'write'], dependencies: [], exportCompatibility: ['HTML', 'React', 'site.zip'],
  tools: [
    { def: defineTool({ name: 'get_site_metadata', write: false, needs: 'read', description: 'Lê metadata SEO/Open Graph do projeto aberto.', input: z.object({}) }), needsProject: true, run: (_args, ctx) => ({ site: ctx.project!.store.state.doc.site || {} }) },
    { def: defineTool({ name: 'set_site_metadata', write: true, needs: 'write', description: 'Define metadata da publicação: title, description, canonical HTTPS, image, favicon e idioma. Campos omitidos permanecem; string vazia remove.', input: schema }), needsProject: true, run: (args, ctx) => { const store = ctx.project!.store; store.update(() => { const next = { ...(store.state.doc.site || {}) }; for (const [key, value] of Object.entries(args)) { if (value === '') delete next[key]; else next[key] = value; } if (Object.keys(next).length) store.state.doc.site = next; else delete store.state.doc.site; }, { commit: true }); return { site: store.state.doc.site || {} }; } },
  ],
});
