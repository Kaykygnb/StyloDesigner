import { z } from 'zod';
import { exportTokens } from '@stylo/core/tokens.ts';
import { definePlugin } from '@stylo/core/plugin.ts';
import { defineTool } from '@stylo/core/tools/schema.ts';

export const tailwind = definePlugin({
  id: 'tailwind',
  name: 'Tailwind Export',
  description: 'Exporta tokens do projeto como tailwind.config.js e tokens.css.',
  category: 'exporter',
  version: '1.0.0', author: 'Stylo', license: 'MIT', repository: 'https://tailwindcss.com/',
  permissions: ['read'], dependencies: [], exportCompatibility: ['tokens.css', 'tailwind.config.js'],
  tools: [{
    def: defineTool({
      name: 'tailwind_export', write: false, needs: 'read',
      description: 'Gera os arquivos tailwind.config.js e tokens.css com as cores, tamanhos, tipografia, sombras, gradientes e modos do projeto aberto.',
      input: z.object({}),
    }),
    needsProject: true,
    run: (_args, ctx) => ({ format: 'tailwind', files: exportTokens(ctx.project!.store.state.doc, 'tailwind') }),
  }],
});
