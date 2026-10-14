// A área de trabalho: as telas do projeto num "mundo" com zoom e pan livres, a seleção por cima delas e todos os gestos
// (mover com encaixe e guias, redimensionar, girar, desenhar formas, caixa de seleção, mão, medidas com Alt).
// Tudo que muda o projeto sai daqui como chamadas de ferramenta (update_layer(s), move_layers, create_layer…): o canvas só desenha.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { canEdit, insert, setProps } from '../lib/actions';
import { commentOn } from '../lib/editing';
import { app, hoverLayer, run, select, setTool, useApp, type WorldBox } from '../lib/app';
import { boardContaining, boardsOf, findNode, flatten, isAncestor, isBoard, pageOf, parentOf, topLevel } from '../lib/doc';
import { SHAPE_TOOLS, type ShapeTool } from '../lib/shapes';
import type { LayerNode } from '../lib/types';
import { Icon } from '../ui/Icon';
import { t } from '../lib/i18n';
import { showMenu } from '../ui/ContextMenu';
import { BoardFrame, type Box as RawBox, type BoardPointer } from './BoardFrame';
import { breakpointsOf } from './devices';
import { canvasMenuItems, layerMenuItems } from './menus';
import { Rulers } from './Rulers';
import { LayoutGrids } from './canvas/LayoutGrids';
import { PenOverlay, type PenPoint } from './PenOverlay';
import { toParent } from './canvas/frame';
import { pathD, pathFromStroke } from './canvas/path';
import { createGestures } from './canvas/gestures';
import { SelectionOverlay, VectorNodeOverlay, type Gesture, type ObBox } from './SelectionOverlay';
import { union, type Box } from './canvas/geometry';

const MAX_ZOOM = 16, MIN_ZOOM = 0.02;

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
  const showGrids = useApp((s) => s.layoutGrids);
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
  const rootVectors = !bp ? flatten(page.children).filter((node) => node.type === 'path' && !boardContaining(page, node.id)) : [];
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
  const worldPositionOf = (id: string): { x: number; y: number } => {
    const s = S.current;
    const node = nodeOf(id);
    if (!node) return { x: 0, y: 0 };
    let x = Number(node.x || 0), y = Number(node.y || 0);
    for (let parent = parentOf(s.page.children, id); parent; parent = parentOf(s.page.children, parent.id)) {
      x += Number(parent.x || 0); y += Number(parent.y || 0);
    }
    return { x, y };
  };
  /** A caixa visual (com rotação) de uma camada, no mundo. */
  const aabbOf = (id: string): Box | null => {
    const s = S.current;
    const b = boardContaining(s.page, id);
    const inner = b && s.boxes[b.id]?.[id];
    // Camadas na raiz da página não pertencem a uma prancheta, mas continuam
    // sendo elementos visíveis e editáveis do documento.
    if (!b) {
      const root = findNode(s.page.children, id);
      if (!root) return null;
      const pos = worldPositionOf(id);
      return { x: pos.x, y: pos.y, w: Number(root.w || 0), h: Number(root.h || 0) };
    }
    if (!inner) return null;
    return { x: b.x + inner.x, y: b.y + inner.y, w: inner.w, h: inner.h };
  };
  /** Caixa orientada: o retângulo sem girar, o centro e a rotação. */
  const oboxOf = (id: string): ObBox | null => {
    const a = aabbOf(id);
    const n = nodeOf(id);
    if (!a || !n) return null;
    const board = boardContaining(S.current.page, id);
    const inner = board ? S.current.boxes[board.id]?.[id] : null;
    const rot = n.rotation || 0;
    const w = rot ? (inner?.ow ?? a.w) : a.w, h = rot ? (inner?.oh ?? a.h) : a.h;
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
    // Vetores na raiz também fazem parte do mundo. Sem eles, “ajustar tudo”
    // podia enquadrar só as pranchetas e deixar uma forma solta fora da vista.
    for (const n of flatten(s.page.children).filter((node) => node.type === 'path' && !boardContaining(s.page, node.id))) {
      const box = aabbOf(n.id);
      if (box) rects.push(box);
    }
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
    const hasVisualWorld = boards.length > 0 || rootVectors.length > 0;
    const boardsMeasured = boards.length === 0 || boards.every((b) => sizes[b.id]);
    if (fitted.current !== key && hasVisualWorld && boardsMeasured) { fitted.current = key; fitBox(worldBounds()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, device, pageId, sizes, boards, rootVectors, fitBox]);

  useEffect(() => {
    const fitAll = () => fitBox(worldBounds());
    const fitSel = () => { const b = union(S.current.selection.map(aabbOf).filter((x): x is Box => !!x)); if (b) fitBox(b, { max: 2 }); else fitAll(); };
    const z100 = () => zoomTo(1);
    const zIn = () => zoomTo(S.current.zoom * 1.2);
    const zOut = () => zoomTo(S.current.zoom / 1.2);
    window.addEventListener('stylo:fit', fitAll);
    window.addEventListener('stylo:fit-selection', fitSel);
    window.addEventListener('stylo:reveal-selection', fitSel);
    window.addEventListener('stylo:zoom100', z100);
    window.addEventListener('stylo:zoom-in', zIn);
    window.addEventListener('stylo:zoom-out', zOut);
    return () => { window.removeEventListener('stylo:zoom-in', zIn); window.removeEventListener('stylo:zoom-out', zOut); window.removeEventListener('stylo:fit', fitAll); window.removeEventListener('stylo:fit-selection', fitSel); window.removeEventListener('stylo:reveal-selection', fitSel); window.removeEventListener('stylo:zoom100', z100); };
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
    if (!app.get().snap) return { rects: [] as Box[], guidesX: [] as number[], guidesY: [] as number[] };
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

  // ---------------------------------------------------------------- gestos (ver canvas/gestures.ts)
  const { startPan, startResize, startRotate, startMarquee, startDraw, startMove } = createGestures({
    S, g, setGesture, track, toWorld, nodeOf, parentIdOf, aabbOf, oboxOf, originOfParent, preview, clearPreviews, snapTargets,
  });

  /** Bordas e centros de todas as camadas (mais as guias da página): onde a caneta gruda. */
  const penTargets = () => {
    const s = S.current;
    const x: number[] = [], y: number[] = [];
    for (const n of flatten(s.page.children).slice(0, 600)) {
      const r = aabbOf(n.id);
      if (r) { x.push(r.x, r.x + r.w / 2, r.x + r.w); y.push(r.y, r.y + r.h / 2, r.y + r.h); }
    }
    for (const g of s.page.guides ?? []) (g.axis === 'x' ? x : y).push(g.pos);
    return { x, y };
  };

  /** Cria o vetor desenhado com a caneta/lápis (pontos em coordenadas do mundo) dentro da tela onde ele começa. */
  const createPath = async (pts: PenPoint[], closed: boolean) => {
    const s = S.current;
    setTool('move');
    const { x0, y0, w, h, points } = pathFromStroke(pts, closed);
    const host = boardsOf(s.page).find((b) => b.type === 'frame' && pts[0].x >= b.x && pts[0].x <= b.x + b.w && pts[0].y >= b.y && pts[0].y <= b.y + (s.boxes[b.id]?.[b.id]?.oh ?? b.h));
    // Um vetor pode existir na raiz da página, assim como retângulos e textos.
    // Só o posicionamento relativo muda quando o primeiro ponto está dentro de uma tela.
    const parentId = host?.id ?? null;
    const origin = host ? originOfParent(host.id) : { x: 0, y: 0 };
    const out = await run<{ created?: { id: string } }>('create_layer', {
      type: 'path', parent_id: parentId,
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

  if (!allBoards.length && !rootVectors.length) {
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

          {rootVectors.length > 0 && <svg className="root-vector-layer" width="1" height="1" overflow="visible" aria-label={t(language, 'ui.canvas.looseVectorElements')}>
            {rootVectors.map((node) => {
              const d = pathD(node);
              if (!d) return null;
              const stroke = node.stroke?.color || 'currentColor';
              const strokeWidth = Number(node.stroke?.width || 2);
              const fill = node.closed && node.fill && 'color' in node.fill ? node.fill.color : 'none';
              const pos = worldPositionOf(node.id);
              return <path key={node.id} d={d} transform={`translate(${pos.x} ${pos.y})`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity={node.opacity ?? 1} onMouseDown={(e) => { e.stopPropagation(); onPointer({ type: 'down', e: e.nativeEvent, hitId: node.id, boardId: '' }); }} />;
            })}
          </svg>}

          {showGrids && <LayoutGrids frames={flatten(boards).filter((n) => n.type === 'frame' && Array.isArray(n.grids) && n.grids.length > 0)} aabbOf={aabbOf} />}
          <SelectionOverlay
            zoom={zoom} gesture={gesture} selection={sel} editable={editable && !bp} hoverBox={hoverBox}
            pageGuides={showGuides && rulers ? page.guides ?? [] : []}
            oboxOf={oboxOf} aabbOf={aabbOf} nameOf={(id) => nodeOf(id)?.name ?? ''} lockedOf={(id) => !!nodeOf(id)?.locked}
            measureTarget={measureTarget}
            onResize={startResize} onRotate={startRotate} nodeMode={tool === 'node' && !!vectorBox}
          />
          {editable && vectorNode && vectorBox && <VectorNodeOverlay node={vectorNode} box={vectorBox} zoom={zoom} language={language} spaceDown={spaceDown} onPanStart={startPan} worldFromClient={(x, y) => toWorld({ x, y })} onCommit={(points) => void setProps([vectorNode.id], { points })} />}
        </div>
        {editable && !bp && (tool === 'pen' || tool === 'pencil') && <PenOverlay key={tool} mode={tool} zoom={zoom} panX={panX} panY={panY} spaceDown={spaceDown} toWorld={toWorld} targets={tool === 'pen' ? penTargets() : undefined} onPanStart={startPan} onCancel={() => setTool('move')} onDone={(pts, closed) => void createPath(pts, closed)} />}
        {gesture && gesture.kind !== 'pan' && <div className="drag-shield" />}
        {rulers && <Rulers viewport={viewport} guides={page.guides ?? []} highlight={selUnion} />}
      </div>

      <div className="zoom-controls">
        <button className="btn ghost icon sm" title={t(language, 'ui.canvas.zoomOut')} onClick={() => zoomTo(zoom / 1.25)}><Icon name="minus" size={14} /></button>
        <button className="btn ghost sm" title={t(language, 'ui.canvas.fitAll')} onClick={() => window.dispatchEvent(new Event('stylo:fit'))}>{Math.round(zoom * 100)}%</button>
        <button className="btn ghost icon sm" title={t(language, 'ui.canvas.zoomIn')} onClick={() => zoomTo(zoom * 1.25)}><Icon name="plus" size={14} /></button>
        <button className="btn ghost icon sm" title={t(language, 'ui.canvas.fitSelection')} onClick={() => window.dispatchEvent(new Event('stylo:fit-selection'))}><Icon name="fit" size={14} /></button>
      </div>
    </div>
  );
}
