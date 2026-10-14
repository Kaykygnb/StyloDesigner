/** Exportação HTML, React e tokens; conteúdo grande em trechos. */
import { slugify } from '../../model.js';
import { exportHtml } from '../../css.js';
import { withDocumentBreakpoints } from '../../document-breakpoints.ts';
import { exportSite } from '../../site-export.js';
import { exportReact } from '../../export-react.ts';
import { exportTokens } from '../../tokens.ts';
import { agentContentLimit, boundedUtf8Chunk, DEFAULT_AGENT_CONTENT_BYTES } from '../content.js';
import type { RunnerContext, ToolHandlers } from './types.ts';

export function createExportTools(ctx: RunnerContext): ToolHandlers {
  const { store, need, vendor } = ctx;
  return {
    export_html({ id, offset = 0, maxBytes = DEFAULT_AGENT_CONTENT_BYTES } = {}) {
      const n = need(id);
      const doc = store.state.doc;
      const html = withDocumentBreakpoints(doc, () => exportHtml(n, doc.assets, n.name, doc.styles));
      const { content, ...chunk } = boundedUtf8Chunk(html, { offset, maxBytes });
      return { file: `${slugify(n.name || 'pagina')}.html`, html: content, ...chunk };
    },
    export_tokens({ format }) {
      const files = exportTokens(store.state.doc, format);
      if (files.every((f) => !f.content.trim() || f.content.trim() === '{}')) throw new Error('O projeto ainda não tem estilos de cor, de texto ou variáveis. Crie com create_color_styles, create_text_styles ou create_size_variables.');
      return { format, files };
    },
    export_site({ includeContent = false, path, maxBytes = DEFAULT_AGENT_CONTENT_BYTES, offset = 0, format = 'html' } = {}) {
      if (!['html', 'react'].includes(format)) throw new Error('format precisa ser "html" ou "react".');
      const site = format === 'react' ? exportReact(store.state.doc) : exportSite(store.state.doc, { vendor });
      const files = path ? site.files.filter((file) => file.path === path) : site.files;
      if (path && !files.length) throw new Error(`O arquivo “${path}” não existe no pacote de site.`);
      // imagens são arquivos binários em assets/: aparecem na lista (com binary:true), mas o conteúdo vai pelo zip
      const isText = (item) => typeof item.content === 'string';
      const metadata = files.map((item) => ({ path: item.path, bytes: typeof item.content === 'string' ? new TextEncoder().encode(item.content).byteLength : item.content.length, ...(isText(item) ? {} : { binary: true }) }));
      const totalBytes = metadata.reduce((sum, file) => sum + file.bytes, 0);
      const textBytes = metadata.filter((file) => !file.binary).reduce((sum, file) => sum + file.bytes, 0);
      if (includeContent) {
        if (!path && offset) throw new Error('Informe path para continuar o conteúdo de uma página específica.');
        if (!path && textBytes > agentContentLimit(maxBytes)) throw new Error(`O conteúdo total tem ${textBytes} bytes. Consulte os caminhos e solicite uma página por vez com path; use offset e nextOffset para páginas maiores.`);
        for (const file of metadata) {
          if (file.binary) continue; // imagem: baixe pelo export_zip
          const source = files.find((item) => item.path === file.path)!.content as string;
          Object.assign(file, boundedUtf8Chunk(source, { offset: path ? offset : 0, maxBytes }));
        }
      }
      return { files: metadata, totalBytes, warnings: site.warnings, ...(metadata.some((file) => file.binary) ? { hint: 'As imagens saem como arquivos em assets/ (binary: true); o conteúdo delas vem no .zip (export_zip).' } : {}) };
    }
  };
}
