import { sanitizeHtml } from '@stylo/core/html.js';
import type { LayoutInspection } from '@stylo/core/layout-inspection.ts';

/** Reserva marcadores para camadas reais, inclusive quando HTML manual fecha o próprio wrapper. */
export function withoutInspectionMarkers(node: any): any {
  const copy = { ...node };
  if (node.type === 'html') {
    // sanitizeHtml normaliza atributos para aspas duplas e escapa >/< dentro de seus valores.
    // Tokenizar os atributos de cada tag preserva texto/markup e não confunde conteúdo de title com atributo.
    copy.html = sanitizeHtml(node.html).html.replace(/<[^>]*>/g, tag =>
      tag.replace(/\s+([\w:-]+)(?:="[^"]*")?/g, (attribute, name) => name.toLowerCase() === 'data-node-id' ? '' : attribute));
  }
  if (node.children) copy.children = node.children.map(withoutInspectionMarkers);
  return copy;
}

/** rendered informa presença no layout; visible verifica CSS, sem testar oclusão. */
export async function inspectPage(page: any, rootId: string, ids: string[], width: number, opaqueIds: string[] = []): Promise<LayoutInspection> {
  if (ids.length > 100) throw new Error('Inspecione no máximo 100 camadas por pedido.');
  return page.evaluate(({ rootId, ids, width, opaqueIds }: { rootId: string; ids: string[]; width: number; opaqueIds: string[] }) => {
    const elements = new Map<string, HTMLElement>();
    const opaque = new Set(opaqueIds);
    const opaqueWrappers = new Set<Element>();
    for (const element of document.querySelectorAll<HTMLElement>('[data-node-id]')) {
      let ancestor = element.parentElement;
      let untrusted = false;
      while (ancestor) { if (opaqueWrappers.has(ancestor)) { untrusted = true; break; } ancestor = ancestor.parentElement; }
      if (untrusted) continue;
      const id = element.getAttribute('data-node-id')!;
      if (!elements.has(id)) elements.set(id, element);
      if (opaque.has(id)) opaqueWrappers.add(element);
    }
    const root = elements.get(rootId);
    if (!root) return { viewport: { width, height: window.innerHeight }, root: null, layers: ids.map(id => ({ id, parentId: null, rendered: false, visible: false, box: null })) };
    const origin = root.getBoundingClientRect();
    const layers = ids.map((id) => {
      const element = elements.get(id);
      if (!element) return { id, parentId: null, rendered: false, visible: false, box: null };
      const style = getComputedStyle(element);
      let parent = element.parentElement;
      while (parent && !parent.hasAttribute('data-node-id')) parent = parent.parentElement;
      const parentId = parent?.getAttribute('data-node-id') ?? null;
      const rendered = element.getClientRects().length > 0 && style.display !== 'none';
      let visible = rendered && style.visibility !== 'hidden' && style.visibility !== 'collapse';
      for (let current: HTMLElement | null = element; current && visible; current = current.parentElement) {
        if (Number(getComputedStyle(current).opacity) === 0) visible = false;
      }
      if (!rendered) return { id, parentId, rendered, visible, box: null };
      const rect = element.getBoundingClientRect();
      const parentRect = parent?.getBoundingClientRect();
      const hasText = Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim());
      return {
        id, parentId, tag: element.tagName.toLowerCase(), rendered, visible,
        box: { x: rect.x - origin.x, y: rect.y - origin.y, w: rect.width, h: rect.height },
        layout: { display: style.display, direction: style.flexDirection, rowGap: style.rowGap, columnGap: style.columnGap, padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft] },
        ...(hasText ? { typography: { fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight } } : {}),
        overflow: {
          viewportX: rect.left < -1 || rect.right > width + 1,
          parent: !!parentRect && (rect.left < parentRect.left - 1 || rect.right > parentRect.right + 1 || rect.top < parentRect.top - 1 || rect.bottom > parentRect.bottom + 1),
          contentX: element.scrollWidth > element.clientWidth + 1,
          contentY: element.scrollHeight > element.clientHeight + 1,
        },
      };
    });
    return { viewport: { width, height: window.innerHeight }, root: { x: 0, y: 0, w: origin.width, h: origin.height }, layers };
  }, { rootId, ids, width, opaqueIds });
}
