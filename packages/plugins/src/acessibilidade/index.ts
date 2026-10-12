import { z } from 'zod';
import { auditStatic } from '@stylo/core/audit.ts';
import { definePlugin } from '@stylo/core/plugin.ts';
import { defineTool } from '@stylo/core/tools/schema.ts';

export const acessibilidade = definePlugin({
  id: 'acessibilidade',
  name: 'Acessibilidade',
  description: 'Audita contraste, tipografia, textos alternativos, títulos e alvos clicáveis.',
  category: 'quality',
  version: '1.0.0', author: 'Stylo', license: 'MIT', repository: 'https://github.com/Kaykygnb/StyloDesigner',
  permissions: ['read'], dependencies: [],
  tools: [{
    def: defineTool({
      name: 'accessibility_audit', write: false, needs: 'read',
      description: 'Audita o projeto aberto por problemas de acessibilidade que podem ser detectados sem navegador: contraste, texto pequeno, alt ausente, títulos e alvos clicáveis pequenos.',
      input: z.object({ page_id: z.string().optional(), include_warnings: z.boolean().optional() }),
    }),
    needsProject: true,
    run: ({ page_id, include_warnings }, ctx) => {
      const pages = ctx.project!.store.state.doc.pages || [];
      const roots = pages.filter((page: any) => !page_id || page.id === page_id);
      if (!roots.length) throw new Error(`Página "${page_id}" não existe.`);
      const issues = auditStatic(roots);
      const filtered = include_warnings === false ? issues.filter((issue) => issue.severity === 'erro') : issues;
      return { count: filtered.length, errors: filtered.filter((issue) => issue.severity === 'erro').length, warnings: filtered.filter((issue) => issue.severity === 'aviso').length, issues: filtered };
    },
  }],
});
