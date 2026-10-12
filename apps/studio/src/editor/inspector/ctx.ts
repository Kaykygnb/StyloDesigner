// O que todas as seções do painel de propriedades precisam saber sobre a seleção: as camadas, a "visão" delas na largura/estado
// em edição (Desktop, Tablet, Celular; Normal, Hover…), e como escrever (sempre por ferramenta: update_layer, set_responsive, set_state).
import { useMemo } from 'react';
import { bpView, hasLayout, stateView } from '@stylo/core/model.js';
import { withDocumentBreakpoints } from '@stylo/core/document-breakpoints.ts';
import { canEdit, setProps } from '../../lib/actions';
import { run, useApp, type StateName } from '../../lib/app';
import { findNode, inFlow, pageOf, parentOf, topLevel } from '../../lib/doc';
import type { Doc, LayerNode, Page } from '../../lib/types';
import { breakpointsOf, type Breakpoint } from '../devices';

export interface Ctx {
  doc: Doc;
  page: Page;
  /** camadas selecionadas (de topo) como estão no projeto */
  nodes: LayerNode[];
  ids: string[];
  single: boolean;
  /** a primeira camada, já na largura/estado em edição */
  n: LayerNode;
  /** a primeira camada como está no projeto (Desktop, sem estado) */
  base: LayerNode;
  parent: LayerNode | null;
  /** o pai tem auto layout e a camada não é absoluta: x/y não valem */
  flow: boolean;
  parentLayout: 'none' | 'row' | 'column' | 'grid';
  bp: Breakpoint | null;
  editState: StateName | null;
  readOnly: boolean;
  /** muda propriedades de todas as camadas selecionadas (no breakpoint/estado em edição) */
  set: (props: Record<string, unknown>) => Promise<void>;
  /** o valor de `get` é diferente entre as camadas selecionadas? */
  mixed: (get: (n: LayerNode) => unknown) => boolean;
  /** isso só vale no Desktop base (não varia por largura nem por estado) */
  baseOnly: boolean;
}

/** A visão de uma camada na largura/estado em edição. */
export function viewOf(doc: Doc, node: LayerNode, bpId: string | null, state: StateName | null): LayerNode {
  let v = node;
  if (bpId) v = withDocumentBreakpoints(doc as never, () => bpView(v, bpId));
  if (state) v = stateView(v, state);
  return v;
}

export function useInspector(): Ctx | null {
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const selection = useApp((s) => s.selection);
  const device = useApp((s) => s.device);
  const editState = useApp((s) => s.editState);
  return useMemo(() => {
    const page = pageOf(doc, pageId);
    const ids = topLevel(page.children, selection);
    const nodes = ids.map((id) => findNode(page.children, id)).filter((n): n is LayerNode => !!n);
    if (!nodes.length) return null;
    const bp = device === 'desktop' ? null : breakpointsOf(doc).find((b) => b.id === device) ?? null;
    const state = bp ? null : editState;
    const base = nodes[0];
    const parent = parentOf(page.children, base.id) ?? null;
    const n = viewOf(doc, base, bp?.id ?? null, state);
    const views = nodes.map((x) => viewOf(doc, x, bp?.id ?? null, state));
    return {
      doc, page, nodes, ids, single: nodes.length === 1, n, base, parent,
      flow: inFlow(parent, base),
      parentLayout: parent && hasLayout(parent as never) ? (parent.layout!.mode as Ctx['parentLayout']) : 'none',
      bp, editState: state, readOnly: !canEdit(),
      set: (props) => setProps(ids, props),
      mixed: (get) => { const first = JSON.stringify(get(views[0])); return views.some((v) => JSON.stringify(get(v)) !== first); },
      baseOnly: !bp && !state,
    };
  }, [doc, pageId, selection, device, editState]);
}

/** Muda só o `layout` (mesclando as chaves que vierem). */
export const layoutProps = (patch: Record<string, unknown>) => ({ layout: patch });

export { run };
