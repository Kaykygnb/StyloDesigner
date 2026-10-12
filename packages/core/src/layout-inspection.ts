/** Medidas de leitura em pixels CSS. Nunca são gravadas nas dimensões base do documento. */
import type { LayerNode, Doc } from './types.ts';
export interface LayoutBox { x: number; y: number; w: number; h: number }
export interface LayoutRow {
  id: string;
  parentId: string | null;
  rendered: boolean;
  visible: boolean;
  box: LayoutBox | null;
  layout?: { display: string; direction: string; rowGap: string; columnGap: string; padding: string[] };
  typography?: { fontFamily: string; fontSize: string; fontWeight: string; lineHeight: string };
  overflow?: { viewportX: boolean; parent: boolean; contentX: boolean; contentY: boolean };
}
export interface LayoutInspection {
  viewport: { width: number; height: number };
  root: LayoutBox | null;
  layers: LayoutRow[];
}
export type InspectLayout = (root: LayerNode, doc: Doc, options: { width: number; ids: string[]; opaqueIds: string[] }) => Promise<LayoutInspection>;
