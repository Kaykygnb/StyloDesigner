/** Imagem do design e auditoria estática ou medida pelo renderizador injetado. */
import { BREAKPOINTS } from '../../model.js';
import { auditStatic, overflowIssues, auditReport } from '../../audit.ts';
import { fromBase64 } from '../../image-size.js';
import type { RunnerContext, ToolHandlers } from './types.ts';

export function createInspectionTools(ctx: RunnerContext): ToolHandlers {
  const { store, need, auditLayout, renderImage } = ctx;
  return {
    async check_design({ id, breakpoints } = {}) {
      const doc = store.state.doc;
      const boards = id ? [need(id)] : store.page().children.flatMap((n) => (n.type === 'section' ? n.children : [n])).filter((n) => n.type === 'frame' && n.visible !== false);
      if (!boards.length) throw new Error('Não há telas para conferir nesta página (crie um frame na raiz).');
      const all = doc.breakpoints?.length ? doc.breakpoints : BREAKPOINTS;
      const chosen = breakpoints?.length ? breakpoints.map((b) => all.find((x) => x.id === b) || (() => { throw new Error(`Breakpoint "${b}" não existe. Disponíveis: ${all.map((x) => x.id).join(', ')}.`); })()) : all;
      const issues = auditStatic(boards);
      const widths = boards.flatMap((b) => [{ rootId: b.id, label: `desktop (${Math.round(b.w)}px)`, width: b.w }, ...chosen.map((bp) => ({ rootId: b.id, label: `${bp.name.toLowerCase()} (${bp.preview}px)`, width: bp.preview }))]);
      let overflowChecked = false;
      if (auditLayout) {
        try {
          const found = await auditLayout(boards, doc, widths);
          issues.push(...overflowIssues(found, (nid) => store.get(nid)));
          overflowChecked = true;
        } catch { /* sem navegador: segue só com as regras estáticas */ }
      }
      const report = auditReport(issues);
      return {
        screens: boards.map((b) => b.name), widths: [...new Set(widths.map((w) => w.label))], ...report,
        ...(overflowChecked ? {} : { note: 'Vazamento horizontal NÃO foi conferido (o servidor não tem o navegador de desenho). Use get_image com breakpoint para ver.' }),
        ...(report.issues.length ? {} : { ok: 'Nenhum problema encontrado nas regras conferidas.' }),
      };
    },
    async get_image({ id, scale = 1, breakpoint } = {}) {
      if (!renderImage) throw new Error('get_image precisa de um navegador para desenhar o design: não está disponível neste servidor. Use get_code / export_html para ler o resultado.');
      const sel = store.ui.selection.map((s) => store.get(s)).filter(Boolean);
      const node = id ? need(id) : sel[0] || store.page().children.find((n) => n.type === 'frame');
      if (!node) throw new Error('Nada para mostrar: a página está vazia.');
      const s = Math.max(0.5, Math.min(2, Number(scale) || 1));
      const doc = store.state.doc;
      let bp: (typeof BREAKPOINTS)[number] | null = null;
      if (breakpoint) {
        const list = doc.breakpoints?.length ? doc.breakpoints : BREAKPOINTS;
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
