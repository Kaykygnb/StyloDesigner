// Criar camadas desenhando no canvas (ferramentas de forma): cada uma vira UMA chamada create_layer.
import { app, run, select } from './app';
import { findNode, pageOf, parentOf } from './doc';
import type { LayerNode } from './types';

export type ShapeTool = 'frame' | 'section' | 'rect' | 'ellipse' | 'line' | 'polygon' | 'star' | 'text' | 'html';
export const SHAPE_TOOLS: ShapeTool[] = ['frame', 'section', 'rect', 'ellipse', 'line', 'polygon', 'star', 'text', 'html'];

/** A caixa desenhada, em coordenadas do mundo; `line` guarda os dois pontos (a, b). */
export interface Drawn { x: number; y: number; w: number; h: number; a?: { x: number; y: number }; b?: { x: number; y: number } }

const DEFAULT_SIZE: Record<ShapeTool, { w: number; h: number }> = {
  frame: { w: 320, h: 240 }, section: { w: 800, h: 600 }, rect: { w: 120, h: 120 }, ellipse: { w: 120, h: 120 },
  line: { w: 160, h: 0 }, polygon: { w: 120, h: 120 }, star: { w: 120, h: 120 }, text: { w: 0, h: 0 }, html: { w: 320, h: 160 },
};

const NAME: Record<ShapeTool, string> = { frame: 'Frame', section: 'Seção', rect: 'Retângulo', ellipse: 'Elipse', line: 'Linha', polygon: 'Polígono', star: 'Estrela', text: 'Texto', html: 'Código HTML' };

const luma = (hex: string) => {
  const v = parseInt(hex.slice(1, 7), 16);
  return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
};

/** Cor de uma forma nova: a padrão, a não ser que fique invisível sobre o fundo (cinza sobre cinza): aí contrasta. */
function fillOver(parent: LayerNode | null, base: string): string {
  const bg = parent?.fill?.type === 'solid' ? String(parent.fill.color) : null;
  if (!bg || Math.abs(luma(base) - luma(bg)) >= 0.12) return base;
  if (luma(bg) < 0.45) return '#FFFFFF';
  return luma(bg) > 0.93 ? '#EDEDF2' : '#A9A9B6';
}

/** Pontos de um polígono regular (5 lados) ou estrela (5 pontas) que cabe em w × h. */
export function shapePoints(kind: 'polygon' | 'star', w: number, h: number, sides = 5, innerRatio = 0.45) {
  const n = kind === 'star' ? sides * 2 : sides;
  const pts: { x: number; y: number; hin: null; hout: null }[] = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const r = kind === 'star' && i % 2 ? innerRatio : 1;
    pts.push({ x: Math.round((w / 2 + (Math.cos(a) * w * r) / 2) * 100) / 100, y: Math.round((h / 2 + (Math.sin(a) * h * r) / 2) * 100) / 100, hin: null, hout: null });
  }
  return pts;
}

/**
 * Cria a camada desenhada. `parent` = o frame/grupo onde cai (null = raiz da página); `origin` = a posição dele no mundo,
 * para guardar x/y relativos ao pai. Num pai com auto layout, x/y não valem (entra no fim).
 */
export async function createShape(tool: ShapeTool, drawn: Drawn, parent: LayerNode | null, origin: { x: number; y: number }, clicked: boolean): Promise<string | null> {
  const s = app.get();
  const page = s.doc ? pageOf(s.doc, s.pageId) : null;
  if (!page) return null;
  const size = DEFAULT_SIZE[tool];
  const inFlow = !!parent && (parent.layout?.mode ?? 'none') !== 'none';
  // clique sem arrastar: tamanho padrão, com o ponto do clique no centro
  let { x, y, w, h } = drawn;
  if (clicked) {
    w = size.w; h = size.h;
    x = drawn.x - (w ? w / 2 : 0); y = drawn.y - (h ? h / 2 : 0);
    if (tool === 'text') { x = drawn.x; y = drawn.y; }
  }
  const props: Record<string, unknown> = { name: NAME[tool] };
  let type: string = tool;
  if (!inFlow) { props.x = Math.round(x - origin.x); props.y = Math.round(y - origin.y); }
  switch (tool) {
    case 'frame': Object.assign(props, { w: Math.max(8, Math.round(w)), h: Math.max(8, Math.round(h)), fill: parent ? fillOver(parent, '#FFFFFF') : '#FFFFFF' }); if (!parent) props.name = `Tela ${(page.children.length || 0) + 1}`; break;
    case 'section': Object.assign(props, { w: Math.max(40, Math.round(w)), h: Math.max(40, Math.round(h)) }); break;
    case 'rect': case 'ellipse': Object.assign(props, { w: Math.max(2, Math.round(w)), h: Math.max(2, Math.round(h)), fill: fillOver(parent, '#D9D9D9') }); break;
    case 'html': Object.assign(props, { w: Math.max(40, Math.round(w)), h: Math.max(40, Math.round(h)) }); break;
    case 'text':
      props.fill = fillOver(parent, '#111111');
      if (!clicked && w > 24) Object.assign(props, { w: Math.round(w), sizeX: 'fixed' });
      break;
    case 'line': {
      const a = drawn.a ?? { x: x, y: y }, b = drawn.b ?? { x: x + size.w, y };
      const len = Math.max(2, Math.round(clicked ? size.w : Math.hypot(b.x - a.x, b.y - a.y)));
      const angle = clicked ? 0 : (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      const cx = clicked ? drawn.x : (a.x + b.x) / 2, cy = clicked ? drawn.y : (a.y + b.y) / 2;
      Object.assign(props, { w: len, h: 12, rotation: Math.round(angle * 10) / 10 });
      if (!inFlow) { props.x = Math.round(cx - len / 2 - origin.x); props.y = Math.round(cy - 6 - origin.y); }
      break;
    }
    case 'polygon': case 'star': {
      const pw = Math.max(8, Math.round(w)), ph = Math.max(8, Math.round(h));
      type = 'path';
      Object.assign(props, { points: shapePoints(tool, pw, ph), closed: true, vw: pw, vh: ph, w: pw, h: ph, shape: { kind: tool, sides: 5, innerRatio: tool === 'star' ? 0.45 : 1 }, fill: fillOver(parent, '#D9D9D9'), stroke: null });
      break;
    }
  }
  const root = tool === 'section' || (tool === 'frame' && !parent);
  const out = await run<{ created?: { id: string } }>('create_layer', { type, ...(parent && !root ? { parent_id: parent.id } : {}), props });
  const id = out?.created?.id ?? null;
  if (id) {
    select([id]);
    if (tool === 'text') app.set({ pendingEdit: id });
  }
  return id;
}

export const isContainer = (n: LayerNode | null | undefined) => !!n && (n.type === 'frame' || n.type === 'group' || n.type === 'section');

/** O frame/grupo mais fundo que contém a camada (ou ela mesma, se for um): onde uma forma desenhada ali deve entrar. */
export function parentFor(rootChildren: LayerNode[], hitId: string | null): LayerNode | null {
  let n = hitId ? findNode(rootChildren, hitId) : null;
  while (n && !(n.type === 'frame' || n.type === 'group' || n.type === 'section')) n = parentOf(rootChildren, n.id) ?? null;
  return n;
}
