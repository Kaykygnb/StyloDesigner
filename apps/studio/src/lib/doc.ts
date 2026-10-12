// Ajudantes para ler o documento (somente leitura: quem altera é o servidor, por ferramentas).
import type { Doc, LayerNode, Page } from './types';

export const pageOf = (doc: Doc, pageId: string | null): Page => doc.pages.find((p) => p.id === pageId) ?? doc.pages[0];

export function findNode(list: LayerNode[], id: string): LayerNode | null {
  for (const n of list) {
    if (n.id === id) return n;
    const inside = n.children && findNode(n.children, id);
    if (inside) return inside;
  }
  return null;
}

export function parentOf(list: LayerNode[], id: string, parent: LayerNode | null = null): LayerNode | null | undefined {
  for (const n of list) {
    if (n.id === id) return parent;
    const inside = n.children ? parentOf(n.children, id, n) : undefined;
    if (inside !== undefined) return inside;
  }
  return undefined;
}

/** As telas da página: frames na raiz, ou dentro de uma seção. */
export const boardsOf = (page: Page): LayerNode[] =>
  page.children.flatMap((n) => (n.type === 'section' ? n.children ?? [] : [n])).filter((n) => n.type === 'frame' && n.visible !== false);

/** A tela (raiz) que contém a camada. */
export function boardContaining(page: Page, id: string): LayerNode | null {
  for (const b of boardsOf(page)) if (findNode([b], id)) return b;
  return null;
}

export function collectIds(list: LayerNode[], out = new Set<string>()): Set<string> {
  for (const n of list) { out.add(n.id); if (n.children) collectIds(n.children, out); }
  return out;
}

/** Ícone/rótulo curto do tipo de camada, para a árvore. */
export const TYPE_LABEL: Record<string, string> = {
  frame: 'Caixa', rect: 'Retângulo', ellipse: 'Elipse', text: 'Texto', group: 'Grupo', line: 'Linha', path: 'Vetor', section: 'Seção', html: 'Código', media: 'Mídia',
};

/** A camada está dentro de um auto layout (flex/grid)? Então x/y não valem: quem posiciona é o layout do pai. */
export const inFlow = (parent: LayerNode | null | undefined, node: LayerNode) =>
  !!parent && (parent.layout?.mode ?? 'none') !== 'none' && !node.absolute;
