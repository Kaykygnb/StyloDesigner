// A área de trabalho: as telas do projeto num "mundo" com zoom e pan livres, a seleção por cima delas e todos os gestos
// (mover com encaixe e guias, redimensionar, girar, desenhar formas, caixa de seleção, mão, medidas com Alt).
// Tudo que muda o projeto sai daqui como chamadas de ferramenta (update_layer(s), move_layers, create_layer…): o canvas só desenha.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { canEdit, insert, setProps } from '../lib/actions';
import { commentOn } from '../lib/editing';
import { app, hoverLayer, run, select, setTool, toast, useApp, type WorldBox } from '../lib/app';
import { boardContaining, boardsOf, findNode, flatten, inFlow, isAncestor, isBoard, pageOf, parentOf, topLevel } from '../lib/doc';
import { createShape, parentFor, SHAPE_TOOLS, type Drawn, type ShapeTool } from '../lib/shapes';
import type { LayerNode } from '../lib/types';
import { Icon } from '../ui/Icon';
import { t } from '../lib/i18n';
import { showMenu } from '../ui/ContextMenu';
import { BoardFrame, type Box as RawBox, type BoardPointer } from './BoardFrame';
import { breakpointsOf } from './devices';
import { canvasMenuItems, layerMenuItems } from './menus';
import { Rulers } from './Rulers';
import { PenOverlay, type PenPoint } from './PenOverlay';
import { SelectionOverlay, VectorNodeOverlay, type Gesture, type ObBox } from './SelectionOverlay';
import {
  SNAP_PX, angleOf, flowDrop, intersects, normalize, resizeGroupBox, resizeSingle, rotateBy, scaleInto, snapMove, snapResize, union,
  type Box,
} from './canvas/geometry';

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const HANDLE_DIR: Record<Handle, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1] };
const THRESHOLD = 3; // px de tela antes de um clique virar arrasto
const MAX_ZOOM = 16, MIN_ZOOM = 0.02;

/** Converte as coordenadas de um evento (da janela ou de dentro de um iframe) para a janela. */
function toParent(e: MouseEvent): { x: number; y: number } {
  const fe = (e.view as Window | null)?.frameElement as HTMLIFrameElement | null | undefined;
  if (!fe) return { x: e.clientX, y: e.clientY };
  const r = fe.getBoundingClientRect();
  const k = fe.offsetWidth ? r.width / fe.offsetWidth : 1;
  return { x: r.left + e.clientX * k, y: r.top + e.clientY * k };
}

export function Canvas() {
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const device = useApp((s) => s.device);
  const zoom = useApp((s) => s.zoom);
  const panX = useApp((s) => s.panX);
  const panY = useApp((s) => s.panY);
  const selection = useApp((s) => s.selection);
  const hover = useApp((s) => s.hover);
  const file = useApp((s) => s.file);
  const tool = useApp((s) => s.tool);
  const spaceDown = useApp((s) => s.spaceDown);
  const altDown = useApp((s) => s.altDown);
  const pendingEdit = useApp((s) => s.pendingEdit);
  const rulers = useApp((s) => s.rulers);
  const showGuides = useApp((s) => s.guides);
  const language = useApp((s) => s.language);
  const page = pageOf(doc, pageId);
  const editable = canEdit();

  const viewport = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [boxes, setBoxes] = useState<Record<string, Record<string, RawBox>>>({});
  const [gesture, setGestureState] = useState<Gesture | null>(null);
  const g = useRef<Gesture | null>(null);
  const setGesture = (next: Gesture | null) => { g.current = next; setGestureState(next); };

  const allBoards = boardsOf(page);
  const bp = device === 'desktop' ? null : breakpointsOf(doc).find((b) => b.id === device) ?? null;
  // em modo responsivo mostra UMA tela (a da seleção, ou a primeira) na largura do breakpoint
  const target = bp ? boardContaining(page, selection[0] ?? '') ?? allBoards[0] ?? null : null;
  const boards = bp ? (target ? [target] : []) : allBoards;
  const widthOf = (b: LayerNode) => (bp ? bp.preview : b.w);

  // tudo que os ouvintes (criados uma vez só) precisam enxergar fica aqui, sempre atualizado
  const S = useRef({ doc, page, zoom, panX, panY, selection, tool, editable, bp, boxes, sizes, boards, spaceDown, showGuides });
  S.current = { doc, page, zoom, panX, panY, selection, tool, editable, bp, boxes, sizes, boards, spaceDown, showGuides };

  const onMeasure = useCallback((id: string, size: { w: number; h: number }) => {
    setSizes((prev) => (prev[id]?.h === size.h && prev[id]?.w === size.w ? prev : { ...prev, [id]: size }));
  }, []);
  const onBoxes = useCallback((boardId: string, b: Record<string, RawBox>) => setBoxes((prev) => ({ ...prev, [boardId]: b })), []);

  // publica as caixas medidas (no mundo) para o painel de propriedades e as outras telas
  const boardsKey = boards.map((b) => `${b.id}:${b.x}:${b.y}`).join('|');
  useEffect(() => {
    const out: Record<string, WorldBox> = {};
    for (const b of S.current.boards) {
      const inner = boxes[b.id];
      if (inner) for (const [id, r] of Object.entries(inner)) out[id] = { x: b.x + r.x, y: b.y + r.y, w: r.w, h: r.h, ow: r.ow, oh: r.oh };
    }
    app.set({ worldBoxes: out });
  }, [boxes, boardsKey]);

  // ---------------------------------------------------------------- coordenadas
  const vpRect = () => viewport.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 800, height: 600 };
  const toWorld = (p: { x: number; y: number }) => { const r = vpRect(); const s = S.current; return { x: (p.x - r.left - s.panX) / s.zoom, y: (p.y - r.top - s.panY) / s.zoom }; };
  const nodeOf = (id: string) => findNode(S.current.page.children, id);
  /** A caixa visual (com rotação) de uma camada, no mundo. */
  const aabbOf = (id: string): Box | null => {
    const s = S.current;
    const b = boardContaining(s.page, id);
    const inner = b && s.boxes[b.id]?.[id];
    if (!b || !inner) return null;
    return { x: b.x + inner.x, y: b.y + inner.y, w: inner.w, h: inner.h };
  };
  /** Caixa orientada: o retângulo sem girar, o centro e a rotação. */
  const oboxOf = (id: string): ObBox | null => {
    const a = aabbOf(id);
    const n = nodeOf(id);
    if (!a || !n) return null;
    const inner = S.current.boxes[boardContaining(S.current.page, id)!.id]?.[id];
    const rot = n.rotation || 0;
    const w = rot ? inner.ow : a.w, h = rot ? inner.oh : a.h;
    return { x: a.x + a.w / 2 - w / 2, y: a.y + a.h / 2 - h / 2, w, h, rot };
  };
  /** Origem (no mundo) do espaço onde x/y de uma camada são medidos: o canto do pai (ou 0,0 na raiz). */
  const originOfParent = (parentId: string | null | undefined): { x: number; y: number } => {
    if (!parentId) return { x: 0, y: 0 };
    const a = aabbOf(parentId);
    const n = nodeOf(parentId);
    if (!a) return { x: 0, y: 0 };
    // pai girado: usa o canto da caixa sem girar
    if (n?.rotation) { const o = oboxOf(parentId)!; return { x: o.x, y: o.y }; }
    return { x: a.x, y: a.y };
  };
  const parentIdOf = (id: string): string | null => parentOf(S.current.page.children, id)?.id ?? null;

  // ---------------------------------------------------------------- layout, zoom e pan
  const worldBounds = (): Box | null => {
    const s = S.current;
    const rects = s.boards.map((b) => ({ x: b.x, y: b.y, w: s.bp ? s.bp.preview : b.w, h: s.sizes[b.id]?.h ?? b.h }));
    return union(rects);
  };

  const fitBox = useCallback((box: Box | null, { max = 1, margin = 72 }: { max?: number; margin?: number } = {}) => {
    const r = viewport.current?.getBoundingClientRect();
    if (!box || !r || !box.w || !box.h) return;
    const z = Math.max(MIN_ZOOM, Math.min(max, (r.width - margin * 2) / box.w, (r.height - margin * 2) / box.h));
    app.set({ zoom: z, panX: (r.width - box.w * z) / 2 - box.x * z, panY: (r.height - box.h * z) / 2 - box.y * z });
  }, []);

  const zoomTo = useCallback((next: number, cx?: number, cy?: number) => {
    const r = viewport.current?.getBoundingClientRect();
    if (!r) return;
    const s = S.current;
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    const px = (cx ?? r.left + r.width / 2) - r.left, py = (cy ?? r.top + r.height / 2) - r.top;
    app.set({ zoom: z, panX: px - ((px - s.panX) / s.zoom) * z, panY: py - ((py - s.panY) / s.zoom) * z });
  }, []);

  // ajusta ao abrir um projeto e quando a primeira medida chega
  const fitted = useRef('');
  useEffect(() => {
    const key = `${file}|${device}|${pageId}`;
    if (fitted.current !== key && boards.length && boards.every((b) => sizes[b.id])) { fitted.current = key; fitBox(worldBounds()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, device, pageId, sizes, boards, fitBox]);

  useEffect(() => {
    const fitAll = () => fitBox(worldBounds());
    const fitSel = () => { const b = union(S.current.selection.map(aabbOf).filter((x): x is Box => !!x)); if (b) fitBox(b, { max: 2 }); else fitAll(); };
    const z100 = () => zoomTo(1);
    window.addEventListener('stylo:fit', fitAll);
    window.addEventListener('stylo:fit-selection', fitSel);
    window.addEventListener('stylo:reveal-selection', fitSel);
    window.addEventListener('stylo:zoom100', z100);
    return () => { window.removeEventListener('stylo:fit', fitAll); window.removeEventListener('stylo:fit-selection', fitSel); window.removeEventListener('stylo:reveal-selection', fitSel); window.removeEventListener('stylo:zoom100', z100); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Roda do mouse: Ctrl/⌘ dá zoom no ponteiro; sem Ctrl rola a vista (Shift = horizontal). Vale também para a roda sobre as telas. */
  const onWheel = useCallback((d: { dx: number; dy: number; ctrl: boolean; shift: boolean; x: number; y: number }) => {
    const s = S.current;
    if (d.ctrl) zoomTo(s.zoom * Math.exp(-Math.max(-25, Math.min(25, d.dy)) * 0.01), d.x, d.y);
    else {
      const horizontal = d.shift && !d.dx;
      app.set({ panX: s.panX - (horizontal ? d.dy : d.dx), panY: s.panY - (horizontal ? 0 : d.dy) });
    }
  }, [zoomTo]);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); onWheel({ dx: e.deltaX, dy: e.deltaY, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, x: e.clientX, y: e.clientY }); };
    const custom = (e: Event) => onWheel((e as CustomEvent).detail);
    el.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('stylo:wheel', custom);
    return () => { el.removeEventListener('wheel', wheel); window.removeEventListener('stylo:wheel', custom); };
  }, [onWheel]);

  // ---------------------------------------------------------------- acompanhar o ponteiro durante um gesto (a janela e cada iframe)
  const track = (onMove: (e: MouseEvent) => void, onUp: (e: MouseEvent) => void) => {
    const targets: Document[] = [document, ...Array.from(viewport.current?.querySelectorAll('iframe') ?? []).map((f) => f.contentDocument).filter((x): x is Document => !!x)];
    const move = (e: MouseEvent) => { if (e.buttons === 0 && e.type === 'mousemove') { up(e); return; } onMove(e); };
    const up = (e: MouseEvent) => {
      targets.forEach((t) => { t.removeEventListener('mousemove', move as EventListener, true); t.removeEventListener('mouseup', up as EventListener, true); });
      onUp(e);
    };
    targets.forEach((t) => { t.addEventListener('mousemove', move as EventListener, true); t.addEventListener('mouseup', up as EventListener, true); });
  };

  // ---------------------------------------------------------------- prévias dentro das telas (o elemento de verdade se mexe)
  const previews = useRef<Map<HTMLElement, string | null>>(new Map());
  const elementOf = (id: string): HTMLElement | null => {
    for (const f of Array.from(viewport.current?.querySelectorAll('iframe') ?? [])) {
      const el = f.contentDocument?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
      if (el) return el;
    }
    return null;
  };
  const preview = (id: string, style: Partial<CSSStyleDeclaration>) => {
    const el = elementOf(id);
    if (!el) return;
    if (!previews.current.has(el)) previews.current.set(el, el.getAttribute('style'));
    Object.assign(el.style, style);
  };
  const clearPreviews = () => {
    for (const [el, original] of previews.current) {
      if (!el.isConnected) continue;
      if (original == null) el.removeAttribute('style'); else el.setAttribute('style', original);
    }
    previews.current.clear();
  };

  // ---------------------------------------------------------------- alvos de encaixe
  const snapTargets = (movingIds: string[]) => {
    const s = S.current;
    const first = movingIds[0];
    const parent = parentOf(s.page.children, first);
    const moving = new Set(movingIds.flatMap((id) => { const n = findNode(s.page.children, id); return n ? flatten([n]).map((x) => x.id) : []; }));
    const sibs = (parent ? parent.children ?? [] : s.page.children).filter((n) => !moving.has(n.id) && n.visible !== false);
    const rects = sibs.map((n) => aabbOf(n.id)).filter((x): x is Box => !!x);
    if (parent) { const pb = aabbOf(parent.id); if (pb) rects.push(pb); }
    const gs = s.showGuides && app.get().rulers ? s.page.guides ?? [] : [];
    return { rects, guidesX: gs.filter((x) => x.axis === 'x').map((x) => x.pos), guidesY: gs.filter((x) => x.axis === 'y').map((x) => x.pos) };
  };

  // ---------------------------------------------------------------- escolher o que um clique seleciona
  /** Camada travada não é clicável (vale a de cima dela, ou nenhuma); grupos são uma peça só, a não ser com Ctrl. */
  const resolveHit = (hitId: string | null, deep: boolean): string | null => {
    const s = S.current;
    let n = hitId ? findNode(s.page.children, hitId) : null;
    while (n && n.locked) n = parentOf(s.page.children, n.id) ?? null;
    if (!n) return null;
    if (deep) return n.id;
    let result = n.id;
    for (let p = parentOf(s.page.children, n.id); p; p = parentOf(s.page.children, p.id)) {
      const inside = s.selection.some((x) => x === p!.id || isAncestor(s.page.children, p!.id, x));
      if (p.type === 'group' && !inside) result = p.id;
    }
    return result;
  };

  // ---------------------------------------------------------------- gesto: mover a vista
  const startPan = (e: MouseEvent) => {
    const start = toParent(e);
    const s = S.current;
    const p0 = { x: s.panX, y: s.panY };
    setGesture({ kind: 'pan' });
    track((ev) => { const p = toParent(ev); app.set({ panX: p0.x + p.x - start.x, panY: p0.y + p.y - start.y }); }, () => setGesture(null));
  };

  // ---------------------------------------------------------------- gesto: mover camadas
  const startMove = (e: MouseEvent, ids: string[], collapseTo: string | null) => {
    const s = S.current;
    if (!s.editable || s.bp) return;
    const top = topLevel(s.page.children, ids);
    const items = top.map((id) => {
      const node = findNode(s.page.children, id)!;
      const parent = parentOf(s.page.children, id) ?? null;
      return { id, name: node.name, box: aabbOf(id)!, flow: inFlow(parent, node), locked: !!node.locked, parentId: parent?.id ?? null, board: isBoard(s.page.children, node), section: node.type === 'section' };
    }).filter((i) => i.box);
    if (!items.length) return;
    const start = toParent(e);
    const p0 = toWorld(start);
    let moved = false, duplicate = e.altKey;
    const targets = snapTargets(top);
    const moving = items.filter((i) => !i.locked);

    track((ev) => {
      const now = toParent(ev);
      if (!moved && Math.hypot(now.x - start.x, now.y - start.y) < THRESHOLD) return;
      moved = true;
      const p = toWorld(now);
      let dx = p.x - p0.x, dy = p.y - p0.y;
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const free = moving.filter((i) => !i.flow);
      let guides: ReturnType<typeof snapMove>['guides'] = [];
      if (free.length && !(ev.ctrlKey || ev.metaKey)) {
        const sn = snapMove(union(free.map((i) => i.box))!, dx, dy, targets, SNAP_PX / S.current.zoom);
        dx = sn.dx; dy = sn.dy; guides = sn.guides;
      }
      // soltar dentro de outro frame (telas e seções não trocam de pai)
      const canReparent = moving.every((i) => !i.section && !i.board);
      let dropFrame: string | null = null;
      let dropRoot = false;
      if (canReparent && moved) {
        const under = frameUnder(p, moving.map((i) => i.id));
        dropFrame = under?.id ?? null;
        dropRoot = !under;
      }
      // em auto layout arrastar REORDENA: acha onde o item entra
      let dropLine: ReturnType<typeof flowDrop>['line'] = null;
      let flowIndex: number | null = null;
      const destId = canReparent ? dropFrame : moving[0].parentId;
      const dest = destId ? nodeOf(destId) : null;
      if (dest && (dest.layout?.mode ?? 'none') !== 'none' && moving.length === 1) {
        const others = (dest.children ?? []).filter((c) => c.id !== moving[0].id && c.visible !== false && !c.absolute);
        const r = flowDrop(others.map((c) => aabbOf(c.id)).filter((b): b is Box => !!b), p, dest.layout!.mode === 'row');
        dropLine = r.line; flowIndex = r.index;
      }
      for (const i of moving) preview(i.id, { translate: `${dx}px ${dy}px` } as Partial<CSSStyleDeclaration>);
      setGesture({ kind: 'move', items, dx, dy, moved: true, guides, dropFrame, dropRoot, dropLine, flowIndex, duplicate });
    }, async (ev) => {
      const cur = g.current;
      setGesture(null);
      if (!moved || cur?.kind !== 'move') {
        clearPreviews();
        // clique sem arrastar numa seleção múltipla: fica só essa camada
        if (collapseTo && !ev.shiftKey) select([collapseTo]);
        return;
      }
      try { await commitMove(cur, duplicate); } finally { clearPreviews(); }
    });
  };

  /** O frame mais fundo sob o ponto (ignora as camadas que estão sendo arrastadas e o que há dentro delas). */
  const frameUnder = (p: { x: number; y: number }, ignore: string[]): LayerNode | null => {
    const s = S.current;
    const skip = new Set(ignore.flatMap((id) => { const n = findNode(s.page.children, id); return n ? flatten([n]).map((x) => x.id) : []; }));
    let best: LayerNode | null = null, bestDepth = -1;
    const walk = (list: LayerNode[], depth: number) => {
      for (const n of list) {
        if (skip.has(n.id) || n.visible === false) continue;
        if (n.type === 'frame' || n.type === 'section') {
          const b = aabbOf(n.id);
          if (b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h && n.type === 'frame' && depth >= bestDepth) { best = n; bestDepth = depth; }
        }
        if (n.children) walk(n.children, depth + 1);
      }
    };
    walk(s.page.children, 0);
    return best;
  };

  const commitMove = async (cur: Extract<Gesture, { kind: 'move' }>, duplicate: boolean) => {
    const s = S.current;
    let ids = cur.items.filter((i) => !i.locked).map((i) => i.id);
    if (duplicate) {
      const out = await run<{ created?: { id: string }[] }>('duplicate_layers', { ids });
      const created = out?.created?.map((c) => c.id) ?? [];
      if (created.length !== ids.length) return;
      ids = created;
      select(created);
    }
    const byId = new Map(cur.items.map((i, k) => [i.id, ids[k] ?? i.id]));
    const moves: { id: string; parent_id?: string; index?: number; x?: number; y?: number }[] = [];
    for (const item of cur.items) {
      if (item.locked) continue;
      const id = byId.get(item.id)!;
      const node = findNode(s.page.children, item.id);
      if (!node) continue;
      const canReparent = !item.board && !item.section;
      const newParent = canReparent ? cur.dropFrame : item.parentId;
      const reparent = canReparent && (newParent ?? null) !== item.parentId;
      const move: (typeof moves)[number] = { id };
      if (reparent) move.parent_id = newParent ?? 'root';
      const dest = newParent ? findNode(s.page.children, newParent) : null;
      const destFlow = !!dest && (dest.layout?.mode ?? 'none') !== 'none';
      if (destFlow && cur.flowIndex != null) {
        // posição entre as irmãs de destino, sem contar o próprio item
        const list = (dest!.children ?? []).filter((c) => c.id !== item.id);
        const others = list.filter((c) => c.visible !== false && !c.absolute);
        const ref = others[cur.flowIndex];
        move.index = ref ? list.indexOf(ref) : others.length ? list.indexOf(others[others.length - 1]) + 1 : list.length;
      } else if (!item.flow || reparent) {
        const po = originOfParent(newParent);
        const o = oboxOf(item.id)!;
        move.x = Math.round(o.x + cur.dx - po.x);
        move.y = Math.round(o.y + cur.dy - po.y);
      }
      if (move.parent_id === undefined && move.index === undefined && move.x === undefined) continue;
      if (move.parent_id === undefined && move.index === undefined && Math.abs(cur.dx) + Math.abs(cur.dy) < 0.5) continue;
      moves.push(move);
    }
    if (!moves.length) return;
    // uma só chamada: mudar de pai, de ordem e de posição vale um único desfazer
    if (moves.every((m) => m.parent_id === undefined && m.index === undefined)) {
      const updates = moves.map((m) => ({ id: m.id, props: { x: m.x, y: m.y } }));
      if (updates.length === 1) await setProps([updates[0].id], updates[0].props);
      else await run('update_layers', { updates });
    } else await run('move_layers', { moves });
  };

  // ---------------------------------------------------------------- gesto: redimensionar
  const startResize = (handle: Handle) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const s = S.current;
    if (!s.editable || s.bp) return;
    const ids = topLevel(s.page.children, s.selection).filter((id) => !nodeOf(id)?.locked);
    if (!ids.length) return;
    const [hx, hy] = HANDLE_DIR[handle];
    const start = toParent(e.nativeEvent);
    const p0 = toWorld(start);
    const single = ids.length === 1;
    const items = ids.map((id) => {
      const n = nodeOf(id)!;
      const ob = oboxOf(id)!;
      const parentId = parentIdOf(id);
      return { id, node: n, ob, flow: inFlow(parentOf(s.page.children, id), n), parentId };
    });
    const box0 = single ? { x: items[0].ob.x, y: items[0].ob.y, w: items[0].ob.w, h: items[0].ob.h } : union(items.map((i) => aabbOf(i.id)!))!;
    const targets = snapTargets(ids);
    let moved = false;
    setGesture({ kind: 'resize', handle, box: items[0].ob, boxes: [], guides: [], single });

    const compute = (ev: MouseEvent) => {
      const p = toWorld(toParent(ev));
      let dx = p.x - p0.x, dy = p.y - p0.y;
      let guides: ReturnType<typeof snapResize>['guides'] = [];
      const unrotated = items.every((i) => !i.ob.rot);
      if (unrotated && !ev.altKey && !(ev.ctrlKey || ev.metaKey)) {
        const sn = snapResize(box0, dx, dy, hx, hy, targets, SNAP_PX / S.current.zoom);
        dx = sn.dx; dy = sn.dy; guides = sn.guides;
      }
      if (single) {
        const it = items[0];
        const n = it.node;
        const r = resizeSingle({
          x: it.ob.x, y: it.ob.y, w: it.ob.w, h: it.ob.h, rotation: it.ob.rot, hx, hy, dx, dy, shift: ev.shiftKey, alt: ev.altKey,
          lockRatio: !!n.lockRatio, aspect: n.aspect ? Number(n.aspect) : undefined,
          min: { w: n.minW, h: n.minH }, max: { w: n.maxW, h: n.maxH },
        });
        return { guides, ob: { x: r.x, y: r.y, w: r.w, h: r.h, rot: it.ob.rot } as ObBox, list: [{ id: it.id, x: r.x, y: r.y, w: r.w, h: r.h }] };
      }
      const { box } = resizeGroupBox(box0, hx, hy, dx, dy, ev.shiftKey);
      const list = items.map((it) => { const a = aabbOf(it.id)!; const nb = scaleInto(a, box0, box); return { id: it.id, x: nb.x, y: nb.y, w: nb.w, h: nb.h }; });
      return { guides, ob: { ...box, rot: 0 } as ObBox, list };
    };

    track((ev) => {
      const now = toParent(ev);
      if (!moved && Math.hypot(now.x - start.x, now.y - start.y) < 2) return;
      moved = true;
      const r = compute(ev);
      for (const l of r.list) {
        const it = items.find((i) => i.id === l.id)!;
        const style: Partial<CSSStyleDeclaration> = {};
        if (hx || !single) { style.width = `${Math.round(l.w)}px`; style.flex = 'none'; style.maxWidth = 'none'; }
        if (hy || !single) { style.height = `${Math.round(l.h)}px`; style.flex = 'none'; style.maxHeight = 'none'; }
        if (!it.flow) {
          const po = originOfParent(it.parentId);
          style.left = `${Math.round(l.x - po.x)}px`; style.top = `${Math.round(l.y - po.y)}px`;
        }
        preview(l.id, style);
      }
      setGesture({ kind: 'resize', handle, box: r.ob, boxes: r.list, guides: r.guides, single });
    }, async (ev) => {
      setGesture(null);
      if (!moved) { clearPreviews(); return; }
      const r = compute(ev);
      try {
        const updates = r.list.map((l) => {
          const it = items.find((i) => i.id === l.id)!;
          const props: Record<string, unknown> = {};
          if (hx || !single) props.w = Math.max(1, Math.round(l.w));
          if (hy || !single) props.h = Math.max(1, Math.round(l.h));
          if (!it.flow) { const po = originOfParent(it.parentId); props.x = Math.round(l.x - po.x); props.y = Math.round(l.y - po.y); }
          return { id: l.id, props };
        });
        if (updates.length === 1) await setProps([updates[0].id], updates[0].props);
        else await run('update_layers', { updates });
      } finally { clearPreviews(); }
    });
  };

  // ---------------------------------------------------------------- gesto: girar
  const startRotate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const s = S.current;
    const id = s.selection[0];
    const ob = id && oboxOf(id);
    if (!id || !ob || !s.editable || s.bp || nodeOf(id)?.locked) return;
    const c = { x: ob.x + ob.w / 2, y: ob.y + ob.h / 2 };
    const a0 = angleOf(c.x, c.y, toWorld(toParent(e.nativeEvent)).x, toWorld(toParent(e.nativeEvent)).y);
    const r0 = ob.rot;
    let angle = r0, moved = false;
    setGesture({ kind: 'rotate', ob, angle });
    track((ev) => {
      const p = toWorld(toParent(ev));
      angle = rotateBy(r0, a0, angleOf(c.x, c.y, p.x, p.y), ev.shiftKey);
      moved = true;
      preview(id, { rotate: `${angle - r0}deg` } as Partial<CSSStyleDeclaration>);
      setGesture({ kind: 'rotate', ob: { ...ob, rot: angle }, angle });
    }, async () => {
      setGesture(null);
      try { if (moved && angle !== r0) await setProps([id], { rotation: angle }); } finally { clearPreviews(); }
    });
  };

  // ---------------------------------------------------------------- gesto: caixa de seleção
  const startMarquee = (e: MouseEvent, scope: string | null, clickId: string | null, additive: boolean) => {
    const start = toParent(e);
    const a = toWorld(start);
    const base = additive ? S.current.selection : [];
    let moved = false;
    const pick = (rect: Box): string[] => {
      const s = S.current;
      const list = scope ? (findNode(s.page.children, scope)?.children ?? []) : s.boards;
      return list.filter((n) => n.visible !== false && !n.locked).filter((n) => { const b = aabbOf(n.id); return b && intersects(rect, b); }).map((n) => n.id);
    };
    track((ev) => {
      const now = toParent(ev);
      if (!moved && Math.hypot(now.x - start.x, now.y - start.y) < THRESHOLD) return;
      moved = true;
      const rect = normalize(a, toWorld(now));
      setGesture({ kind: 'marquee', rect });
      select([...new Set([...base, ...pick(rect)])]);
    }, () => {
      setGesture(null);
      if (!moved && clickId) select(additive && base.includes(clickId) ? base.filter((x) => x !== clickId) : [...new Set([...base, clickId])]);
    });
  };

  // ---------------------------------------------------------------- gesto: desenhar uma forma
  const startDraw = (e: MouseEvent, shape: ShapeTool, hitId: string | null, boardId: string) => {
    const s = S.current;
    if (!s.editable || s.bp) return;
    const start = toParent(e);
    const a = toWorld(start);
    const root = shape === 'section' || shape === 'frame' && !hitId;
    // um frame novo cai dentro do frame sob o ponteiro (se houver); seção só na raiz
    const parent = root ? null : parentFor(s.page.children, hitId);
    let moved = false;
    let cur = a;
    const drawn = (ev?: MouseEvent): Drawn => {
      let b = cur;
      if (shape === 'line') {
        let { x, y } = cur;
        if (ev?.shiftKey) { const ang = Math.round(Math.atan2(y - a.y, x - a.x) / (Math.PI / 4)) * (Math.PI / 4); const len = Math.hypot(x - a.x, y - a.y); x = a.x + Math.cos(ang) * len; y = a.y + Math.sin(ang) * len; }
        b = { x, y };
        return { ...normalize(a, b), a, b };
      }
      let box = normalize(a, b);
      if (ev?.shiftKey && shape !== 'text') { const side = Math.max(box.w, box.h); box = { x: b.x < a.x ? a.x - side : a.x, y: b.y < a.y ? a.y - side : a.y, w: side, h: side }; }
      if (ev?.altKey) box = { x: a.x - (b.x - a.x), y: a.y - (b.y - a.y), w: Math.abs(b.x - a.x) * 2, h: Math.abs(b.y - a.y) * 2 };
      return box;
    };
    setGesture({ kind: 'draw', tool: shape, box: { x: a.x, y: a.y, w: 0, h: 0 } });
    track((ev) => {
      const now = toParent(ev);
      if (!moved && Math.hypot(now.x - start.x, now.y - start.y) < THRESHOLD) return;
      moved = true;
      cur = toWorld(now);
      const d = drawn(ev);
      setGesture({ kind: 'draw', tool: shape, box: { x: d.x, y: d.y, w: d.w, h: d.h }, line: shape === 'line' ? { a: d.a!, b: d.b! } : undefined });
    }, async (ev) => {
      const d = drawn(ev);
      setGesture(null);
      setTool('move');
      void boardId;
      const origin = originOfParent(parent?.id ?? null);
      await createShape(shape, moved ? d : { x: a.x, y: a.y, w: 0, h: 0 }, parent, origin, !moved);
    });
  };

  /** Cria o vetor desenhado com a caneta/lápis (pontos em coordenadas do mundo) dentro da tela onde ele começa. */
  const createPath = async (pts: PenPoint[], closed: boolean) => {
    const s = S.current;
    setTool('move');
    const xs = pts.flatMap((p) => [p.x, ...(p.hin ? [p.hin.x] : []), ...(p.hout ? [p.hout.x] : [])]);
    const ys = pts.flatMap((p) => [p.y, ...(p.hin ? [p.hin.y] : []), ...(p.hout ? [p.hout.y] : [])]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    const w = Math.max(1, Math.round(Math.max(...xs) - x0)), h = Math.max(1, Math.round(Math.max(...ys) - y0));
    const host = boardsOf(s.page).find((b) => b.type === 'frame' && pts[0].x >= b.x && pts[0].x <= b.x + b.w && pts[0].y >= b.y && pts[0].y <= b.y + (s.boxes[b.id]?.[b.id]?.oh ?? b.h));
    if (!host) { toast('error', 'Desenhe dentro de uma tela (frame): vetores soltos fora das telas não aparecem.'); return; }
    const origin = originOfParent(host.id);
    const rel = (p?: { x: number; y: number } | null) => (p ? { x: Math.round((p.x - x0) * 100) / 100, y: Math.round((p.y - y0) * 100) / 100 } : null);
    const points = pts.map((p) => ({ x: rel(p)!.x, y: rel(p)!.y, hin: rel(p.hin), hout: rel(p.hout) }));
    const out = await run<{ created?: { id: string } }>('create_layer', {
      type: 'path', parent_id: host.id,
      props: { name: 'Vetor', x: Math.round(x0 - origin.x), y: Math.round(y0 - origin.y), w, h, vw: w, vh: h, points, closed,
        fill: closed ? '#D9D9D9' : 'none', stroke: { color: '#111111', width: 2, style: 'solid', position: 'center', cap: 'round', join: 'round' } },
    });
    if (out?.created?.id) select([out.created.id]);
  };

  // ---------------------------------------------------------------- ponteiro vindo das telas
  const onPointer = useCallback((p: BoardPointer) => {
    const s = S.current;
    const e = p.e;
    if (p.type === 'move') {
      if (g.current) return;
      const id = resolveHit(p.hitId, e.ctrlKey || e.metaKey);
      if (s.tool === 'inspect') hoverLayer(p.hitId); else hoverLayer(id);
      return;
    }
    if (p.type === 'leave') { if (!g.current) hoverLayer(null); return; }
    if (p.type === 'context') {
      e.preventDefault();
      const id = resolveHit(p.hitId, e.ctrlKey || e.metaKey);
      const pt = toParent(e);
      if (id && !s.selection.includes(id)) select([id]);
      const raw = id ?? null;
      showMenu(raw ? layerMenuItems() : canvasMenuItems(), pt.x, pt.y);
      return;
    }
    if (p.type === 'dblclick') {
      // entra no grupo/frame: seleciona o filho que contém o ponto (ou a camada mais funda)
      const hit = p.hitId ? findNode(s.page.children, p.hitId) : null;
      if (!hit) return;
      const cur = s.selection[0];
      if (cur && cur !== p.hitId && isAncestor(s.page.children, cur, p.hitId!)) {
        let child: LayerNode | null = hit;
        for (let q: LayerNode | null | undefined = hit; q && q.id !== cur; q = parentOf(s.page.children, q.id)) child = q;
        if (child && !child.locked) select([child.id]);
      } else if (!s.selection.includes(hit.id)) select([hit.id]);
      return;
    }
    if (p.type !== 'down' || e.button !== 0) return;
    if (document.activeElement && document.activeElement !== document.body) (document.activeElement as HTMLElement).blur?.();
    if (s.spaceDown || s.tool === 'hand') { startPan(e); return; }
    if (s.tool === 'comment') {
      const id = resolveHit(p.hitId, true);
      setTool('move');
      const b = id ? aabbOf(id) : null;
      if (id && b) {
        const w = toWorld(toParent(e));
        const clamp = (v: number) => Math.max(0, Math.min(1, v));
        select([id]);
        commentOn(id, { rx: clamp((w.x - b.x) / (b.w || 1)), ry: clamp((w.y - b.y) / (b.h || 1)) });
      }
      return;
    }
    if (s.tool === 'inspect' || s.tool === 'node') { select(p.hitId ? [p.hitId] : []); if (p.hitId && s.tool === 'inspect') app.set({ panel: 'inspect' }); return; }
    if (SHAPE_TOOLS.includes(s.tool as ShapeTool)) { startDraw(e, s.tool as ShapeTool, p.hitId, p.boardId); return; }
    const id = resolveHit(p.hitId, e.ctrlKey || e.metaKey);
    if (s.bp) { select(id ? (e.shiftKey ? [...new Set([...s.selection, id])] : [id]) : []); return; }
    if (!id) { if (!e.shiftKey) select([]); startMarquee(e, null, null, e.shiftKey); return; }
    const node = findNode(s.page.children, id)!;
    const inSel = s.selection.includes(id);
    // tela (frame da raiz) ainda não selecionada: o clique a seleciona; arrastar faz a caixa de seleção dentro dela
    if (isBoard(s.page.children, node) && !inSel) { startMarquee(e, id, id, e.shiftKey); return; }
    if (e.shiftKey) {
      select(inSel ? s.selection.filter((x) => x !== id) : [...s.selection, id]);
      if (inSel) return;
    } else if (!inSel) select([id]);
    const ids = e.shiftKey ? [...s.selection.filter((x) => x !== id), id] : inSel ? s.selection : [id];
    startMove(e, ids, inSel && !e.shiftKey && s.selection.length > 1 ? id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onEditText = useCallback((id: string, text: string) => { void setProps([id], { text }); }, []);
  const onEditConsumed = useCallback(() => app.set({ pendingEdit: null }), []);

  // clicar no nome da tela seleciona e arrasta a tela inteira
  const onLabelDown = (b: LayerNode) => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (S.current.spaceDown || S.current.tool === 'hand') { startPan(e.nativeEvent); return; }
    const inSel = selection.includes(b.id);
    if (e.shiftKey) select(inSel ? selection.filter((x) => x !== b.id) : [...selection, b.id]);
    else if (!inSel) select([b.id]);
    if (b.locked) return;
    startMove(e.nativeEvent, e.shiftKey ? [...selection, b.id] : inSel ? selection : [b.id], null);
  };
  const onLabelContext = (b: LayerNode) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selection.includes(b.id)) select([b.id]);
    showMenu(layerMenuItems(), e.clientX, e.clientY);
  };

  // clicar no vazio do canvas (fora das telas)
  const onViewportDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && (S.current.spaceDown || S.current.tool === 'hand'))) { e.preventDefault(); startPan(e.nativeEvent); return; }
    const target = e.target as HTMLElement;
    if (e.button !== 0 || !!target.closest('button, input, a')) return;
    const s = S.current;
    if (SHAPE_TOOLS.includes(s.tool as ShapeTool)) { startDraw(e.nativeEvent, s.tool as ShapeTool, null, ''); return; }
    if (s.tool === 'comment' || s.tool === 'inspect') { select([]); return; }
    if (!e.shiftKey) select([]);
    startMarquee(e.nativeEvent, null, null, e.shiftKey);
  };
  const onViewportContext = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.board-frame, .board-label, .handle')) return;
    e.preventDefault();
    showMenu(canvasMenuItems(), e.clientX, e.clientY);
  };

  // ---------------------------------------------------------------- derivados para o desenho
  const sel = useMemo(() => topLevel(page.children, selection), [page, selection]);
  const hoverBox = hover && !selection.includes(hover) && !gesture ? aabbOf(hover) : null;

  const selUnion = useMemo(() => union(sel.map(aabbOf).filter((x): x is Box => !!x)), [sel, boxes, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // distância (Alt) entre a seleção e a camada sob o ponteiro
  const measureTarget = altDown && !gesture && hover && !selection.includes(hover) && sel.length ? hover : null;

  const cursorClass = gesture?.kind === 'pan' || spaceDown || tool === 'hand' ? 'grab' : SHAPE_TOOLS.includes(tool as ShapeTool) ? 'cross' : tool === 'node' ? 'node-edit' : tool === 'comment' ? 'comment' : '';
  const vectorNode = (tool === 'inspect' || tool === 'node') && selection.length === 1 ? nodeOf(selection[0]) : null;
  const vectorBox = vectorNode?.type === 'path' ? oboxOf(vectorNode.id) : null;

  const dotStep = 24 * zoom;

  if (!allBoards.length) {
    return (
      <div className={`canvas-area ${cursorClass}`}>
        <div
          className="canvas-viewport"
          ref={viewport}
          onMouseDown={onViewportDown}
          onContextMenu={onViewportContext}
          style={{ backgroundSize: `${dotStep}px ${dotStep}px`, backgroundPosition: `${panX}px ${panY}px`, backgroundImage: zoom < 0.3 ? 'none' : undefined }}
        >
          <div className="canvas-empty">
            <h3>{t(language, 'canvas.empty')}</h3>
            <p className="muted">{t(language, 'canvas.emptyHint')}</p>
            {editable && <button className="btn primary" onClick={() => void insert('screen')}><Icon name="plus" /> {t(language, 'canvas.createScreen')}</button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`canvas-area ${cursorClass}`}>
      <div
        className="canvas-viewport" ref={viewport} onMouseDown={onViewportDown} onContextMenu={onViewportContext}
        style={{ backgroundSize: `${dotStep}px ${dotStep}px`, backgroundPosition: `${panX}px ${panY}px`, backgroundImage: zoom < 0.3 ? 'none' : undefined }}
      >
        <div className="canvas-world" style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, ['--inv' as string]: 1 / zoom }}>
          {boards.map((b) => (
            <div key={b.id}>
              <div className={`board-label${selection.includes(b.id) ? ' on' : ''}`} style={{ left: b.x, top: b.y - 22 / zoom }} onMouseDown={onLabelDown(b)} onContextMenu={onLabelContext(b)}>
                {b.name}{bp ? ` · ${bp.name} ${bp.preview}px` : ''}
              </div>
              <BoardFrame
                board={b} doc={doc} x={b.x} y={b.y} width={widthOf(b)} editable={editable} pendingEdit={pendingEdit}
                onMeasure={onMeasure} onPointer={onPointer} onEditText={onEditText} onEditConsumed={onEditConsumed} onBoxes={onBoxes}
              />
            </div>
          ))}

          <SelectionOverlay
            zoom={zoom} gesture={gesture} selection={sel} editable={editable && !bp} hoverBox={hoverBox}
            pageGuides={showGuides && rulers ? page.guides ?? [] : []}
            oboxOf={oboxOf} aabbOf={aabbOf} nameOf={(id) => nodeOf(id)?.name ?? ''} lockedOf={(id) => !!nodeOf(id)?.locked}
            measureTarget={measureTarget}
            onResize={startResize} onRotate={startRotate}
          />
          {editable && vectorNode && vectorBox && <VectorNodeOverlay node={vectorNode} box={vectorBox} zoom={zoom} worldFromClient={(x, y) => toWorld({ x, y })} onCommit={(points) => void setProps([vectorNode.id], { points })} />}
        </div>
        {editable && !bp && (tool === 'pen' || tool === 'pencil') && <PenOverlay key={tool} mode={tool} zoom={zoom} panX={panX} panY={panY} toWorld={toWorld} onCancel={() => setTool('move')} onDone={(pts, closed) => void createPath(pts, closed)} />}
        {gesture && gesture.kind !== 'pan' && <div className="drag-shield" />}
        {rulers && <Rulers viewport={viewport} guides={page.guides ?? []} highlight={selUnion} />}
      </div>

      <div className="zoom-controls">
        <button className="btn ghost icon sm" title="Diminuir" onClick={() => zoomTo(zoom / 1.25)}><Icon name="minus" size={14} /></button>
        <button className="btn ghost sm" title="Ajustar tudo à tela (⇧1) · 100% (⇧0)" onClick={() => window.dispatchEvent(new Event('stylo:fit'))}>{Math.round(zoom * 100)}%</button>
        <button className="btn ghost icon sm" title="Aumentar" onClick={() => zoomTo(zoom * 1.25)}><Icon name="plus" size={14} /></button>
        <button className="btn ghost icon sm" title="Ajustar à seleção (⇧2)" onClick={() => window.dispatchEvent(new Event('stylo:fit-selection'))}><Icon name="fit" size={14} /></button>
      </div>
    </div>
  );
}
