/**
 * types.ts — O FORMATO DO DOCUMENTO (tipos)
 *
 * É o contrato entre o editor, o servidor e os agentes: o que existe num projeto. Só tipos, nenhum código.
 * Os campos comuns são tipados; os OPCIONAIS (que só existem quando alguém os define) ficam em `[extra]`, para o modelo
 * poder crescer sem quebrar. Ver model.ts para os valores padrão e a explicação de cada campo.
 */

export type LayerType = 'frame' | 'rect' | 'ellipse' | 'text' | 'group' | 'line' | 'path' | 'section' | 'html' | 'media';

export interface GradientStop { color: string; opacity: number; pos: number }

export interface Fill {
  type: 'solid' | 'linear' | 'radial' | 'image' | 'none';
  color: string;
  opacity: number;
  stops: GradientStop[];
  angle: number;
  /** Imagem de preenchimento: id em `doc.assets`. */
  assetId: string | null;
  fit: string;
  /** Liga a um estilo de cor do projeto (vira `var(--cor)` no CSS). */
  styleId?: string;
  [extra: string]: any;
}

export interface Stroke { color: string; opacity: number; width: number; style: string; position: 'inside' | 'center' | 'outside' }

export interface Shadow { x: number; y: number; blur: number; spread: number; color: string; opacity: number; inset: boolean }

export type Sides = [number, number, number, number];

export interface Layout {
  /** none = filhos livres; row/column = flexbox; grid = CSS grid. */
  mode: 'none' | 'row' | 'column' | 'grid';
  gap: number; cols: number; rows: number; colGap: number; rowGap: number;
  padding: Sides;
  justify: string; align: string;
  [extra: string]: any;
}

export interface Interaction { trigger: string; action: 'navigate' | 'back' | 'url' | string; target?: string; transition?: string }

export interface PathPoint { x: number; y: number; hin: { x: number; y: number } | null; hout: { x: number; y: number } | null }

/** Uma camada do design (qualquer tipo). Posição relativa ao PAI, em px. */
export interface LayerNode {
  id: string;
  type: LayerType;
  name: string;
  x: number; y: number; w: number; h: number;
  /** Graus, sentido horário, em torno do centro. */
  rotation: number;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blend: string;
  fill: Fill;
  stroke: Stroke | null;
  /** [topo-esq, topo-dir, baixo-dir, baixo-esq] */
  radius: Sides;
  shadows: Shadow[];
  blur: number;
  bgBlur: number;
  sizeX: 'fixed' | 'hug' | 'fill';
  sizeY: 'fixed' | 'hug' | 'fill';
  absolute: boolean;
  alignSelf: string;
  justifySelf: string;
  flipX: boolean; flipY: boolean; lockRatio: boolean;
  constraints: { h: string; v: string };
  colSpan: number; rowSpan: number;
  interactions: Interaction[];
  // --- por tipo ---
  children?: LayerNode[];
  clip?: boolean;
  layout?: Layout;
  grids?: unknown[];
  text?: string;
  fontFamily?: string; fontSize?: number; fontWeight?: number; fontStyle?: string;
  lineHeight?: number; letterSpacing?: number;
  textAlign?: string; textDecoration?: string; textTransform?: string; textVAlign?: string;
  points?: PathPoint[]; closed?: boolean; vw?: number; vh?: number;
  html?: string;
  mediaKind?: 'video' | 'audio' | 'model3d' | 'lottie';
  mediaAssetId?: string;
  mediaAutoplay?: boolean;
  mediaControls?: boolean;
  mediaLoop?: boolean;
  mediaMuted?: boolean;
  /** Etiqueta HTML escolhida (div, section, h1...). */
  tag?: string;
  href?: string; alt?: string; note?: string;
  /** Campos opcionais (minW, maxW, aspect, overflow, grow, margin, fx...). */
  [extra: string]: any;
}

export interface Page { id: string; name: string; children: LayerNode[]; guides: { axis: 'x' | 'y'; pos: number }[]; [extra: string]: any }

export interface ColorStyle { id: string; name: string; [extra: string]: any }
export interface TextStyle { id: string; name: string; [extra: string]: any }

export interface Doc {
  version: number;
  /** UUID estável do projeto (acompanha o documento, não o nome). */
  projectId: string;
  name: string;
  pages: Page[];
  /** Imagens ficam FORA das páginas (data URLs), para o histórico não carregar megabytes. */
  assets: Record<string, string>;
  styles: { colors: ColorStyle[]; texts: TextStyle[] };
  comments: unknown[];
  [extra: string]: any;
}
