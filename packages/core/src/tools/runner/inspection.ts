/** Imagem do design e auditoria estática ou medida pelo renderizador injetado. */
import { inspectLayoutReport } from './layout-inspection.ts';
import { DEFAULT_BREAKPOINTS } from '../../model.js';
import { checkDesign } from './design-audit.ts';
import { fromBase64 } from '../../image-size.js';
import type { RunnerContext, ToolHandlers } from './types.ts';

export function createInspectionTools(ctx: RunnerContext): ToolHandlers {
  const { store, need, auditLayout, renderImage } = ctx;
  return {
    inspect_layout(args) { return inspectLayoutReport(ctx, args); },
    check_design(args = {}) { return checkDesign(ctx, args); },
    async get_image({ id, scale = 1, breakpoint } = {}) {
      if (!renderImage) throw new Error('get_image precisa de um navegador para desenhar o design: não está disponível neste servidor. Use get_code / export_html para ler o resultado.');
      const sel = store.ui.selection.map((s) => store.get(s)).filter(Boolean);
      const node = id ? need(id) : sel[0] || store.page().children.find((n) => n.type === 'frame');
      if (!node) throw new Error('Nada para mostrar: a página está vazia.');
      const s = Math.max(0.5, Math.min(2, Number(scale) || 1));
      const doc = store.state.doc;
      let bp: (typeof DEFAULT_BREAKPOINTS)[number] | null = null;
      if (breakpoint) {
        const list = doc.breakpoints?.length ? doc.breakpoints : DEFAULT_BREAKPOINTS;
        bp = list.find((b) => b.id === breakpoint);
        if (!bp) throw new Error(`Breakpoint "${breakpoint}" não existe. Disponíveis: ${list.map((b) => b.id).join(', ')}.`);
      }
      const data = await renderImage(node, doc, s, bp ? { width: bp.preview } : undefined);
      if (bp) {
        // nesse modo a altura é a que o navegador calculou naquela largura: lê do cabeçalho do PNG
        const head = fromBase64(data.slice(0, 48));
        const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
        return { id: node.id, name: node.name, breakpoint: bp.id, width: bp.preview, w: view.getUint32(16), h: view.getUint32(20), _image: { data, mimeType: 'image/png' }, note: `Desenhado na largura do breakpoint "${bp.name}" (${bp.preview}px), com as regras responsivas aplicadas.` };
      }
      // _image: o servidor MCP transforma em conteúdo de imagem; o Assistente interno descarta (o modelo de chat não recebe imagem)
      return { id: node.id, name: node.name, w: Math.round(node.w * s), h: Math.round(node.h * s), _image: { data, mimeType: 'image/png' }, note: 'Fontes hospedadas no projeto são usadas na imagem. Fontes externas não hospedadas podem usar uma substituta do sistema; o efeito vidro pode não aparecer.' };
    }
  };
}
