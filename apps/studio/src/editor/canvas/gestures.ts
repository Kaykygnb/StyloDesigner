// Os gestos do canvas: mover a vista, mover camadas (com encaixe e guias), redimensionar, girar, caixa de seleção e desenhar formas.
// Cada `start*` é chamado no mouse-down e acompanha o ponteiro até soltar (`track`). O que muda o projeto sai como chamada de
// ferramenta (`run`/`setProps`); durante o arrasto só o elemento da tela e o overlay se mexem (prévia).
// O Canvas.tsx cria o `env` (leitura do estado vivo, conversões de coordenadas e prévias) e liga estes gestos ao mouse.
import type { MutableRefObject } from 'react';
import { app, run, select, setTool } from '../../lib/app';
import { setProps } from '../../lib/actions';
import { findNode, flatten, inFlow, isBoard, parentOf, topLevel } from '../../lib/doc';
import { createShape, parentFor, type Drawn, type ShapeTool } from '../../lib/shapes';
import type { Doc, LayerNode, Page } from '../../lib/types';
import type { Tool } from '../../lib/app';
import type { Box as RawBox } from '../BoardFrame';
import type { Breakpoint } from '../devices';
import type { Gesture, ObBox } from '../SelectionOverlay';
import { toParent } from './frame';
import {
  SNAP_PX, angleOf, flowDrop, intersects, normalize, resizeGroupBox, resizeSingle, rotateBy, scaleInto, snapMove, snapResize, union,
  type Box,
} from './geometry';

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const HANDLE_DIR: Record<Handle, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1] };
/** px de tela antes de um clique virar arrasto. */
export const THRESHOLD = 3;

/** O estado vivo do canvas (os gestos rodam depois do render e precisam enxergar sempre o valor atual). */
export interface CanvasSnapshot {
  doc: Doc; page: Page; zoom: number; panX: number; panY: number; selection: string[]; tool: Tool; editable: boolean;
  bp: Breakpoint | null; boxes: Record<string, Record<string, RawBox>>; sizes: Record<string, { w: number; h: number }>;
  boards: LayerNode[]; spaceDown: boolean; showGuides: boolean;
}

/** O que os gestos pedem emprestado ao Canvas. */
export interface GestureEnv {
  S: MutableRefObject<CanvasSnapshot>;
  g: MutableRefObject<Gesture | null>;
  setGesture: (next: Gesture | null) => void;
  /** Acompanha o ponteiro na janela e em cada iframe até soltar o botão. */
  track: (onMove: (e: MouseEvent) => void, onUp: (e: MouseEvent) => void) => void;
  toWorld: (p: { x: number; y: number }) => { x: number; y: number };
  nodeOf: (id: string) => LayerNode | null | undefined;
  parentIdOf: (id: string) => string | null;
  aabbOf: (id: string) => Box | null;
  oboxOf: (id: string) => ObBox | null;
  originOfParent: (parentId: string | null | undefined) => { x: number; y: number };
  preview: (id: string, style: Partial<CSSStyleDeclaration>) => void;
  clearPreviews: () => void;
  snapTargets: (movingIds: string[]) => { rects: Box[]; guidesX: number[]; guidesY: number[] };
}

export function createGestures(env: GestureEnv) {
  const { S, g, setGesture, track, toWorld, nodeOf, parentIdOf, aabbOf, oboxOf, originOfParent, preview, clearPreviews, snapTargets } = env;

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
    // só as destravadas se movem (e se duplicam); as `moves` usam o id da ORIGINAL, o servidor leva a cópia (duplicate_layers)
    const ids = cur.items.filter((i) => !i.locked).map((i) => i.id);
    const moves: { id: string; parent_id?: string; index?: number; x?: number; y?: number }[] = [];
    for (const item of cur.items) {
      if (item.locked) continue;
      const id = item.id;
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
    if (duplicate) {
      // duplicar e levar as cópias é UMA chamada: um único Ctrl+Z desfaz tudo
      const out = await run<{ created?: { id: string }[] }>('duplicate_layers', { ids, ...(moves.length ? { moves } : {}) });
      const created = out?.created?.map((c) => c.id) ?? [];
      if (created.length) select(created);
      return;
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

  return { startPan, startMove, startResize, startRotate, startMarquee, startDraw };
}
