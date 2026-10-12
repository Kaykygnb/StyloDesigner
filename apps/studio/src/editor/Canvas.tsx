// A área de trabalho: as telas do projeto num "mundo" com zoom, a seleção por cima delas, arrastar para mover e alças para redimensionar.
// Tudo que muda o projeto sai daqui como UMA chamada de ferramenta (setProps → update_layer / set_responsive).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { canEdit, insert, setProps } from '../lib/actions';
import { app, hoverLayer, run, select, setZoom, useApp } from '../lib/app';
import { boardContaining, boardsOf, findNode, inFlow, pageOf, parentOf } from '../lib/doc';
import type { LayerNode } from '../lib/types';
import { Icon } from '../ui/Icon';
import { BoardFrame, type Box } from './BoardFrame';
import { breakpointsOf } from './devices';

const PAD = 96;
type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface Drag {
  kind: 'move' | 'resize';
  handle?: Handle;
  ids: string[];
  startX: number;
  startY: number;
  moved: boolean;
  dx: number;
  dy: number;
}

export function Canvas() {
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const device = useApp((s) => s.device);
  const zoom = useApp((s) => s.zoom);
  const selection = useApp((s) => s.selection);
  const hover = useApp((s) => s.hover);
  const file = useApp((s) => s.file);
  const page = pageOf(doc, pageId);
  const editable = canEdit();

  const viewport = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [boxes, setBoxes] = useState<Record<string, Record<string, Box>>>({});
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;

  const allBoards = boardsOf(page);
  const bp = device === 'desktop' ? null : breakpointsOf(doc).find((b) => b.id === device) ?? null;
  // em modo responsivo mostra UMA tela (a da seleção, ou a primeira) na largura do breakpoint
  const target = bp ? boardContaining(page, selection[0] ?? '') ?? allBoards[0] ?? null : null;
  const boards = bp ? (target ? [target] : []) : allBoards;
  const widthOf = (b: LayerNode) => (bp ? bp.preview : b.w);
  const heightOf = (b: LayerNode) => sizes[b.id]?.h ?? b.h;

  const layout = useMemo(() => {
    if (bp) return { ox: PAD, oy: PAD, w: (boards[0] ? bp.preview : 0) + PAD * 2, h: (boards[0] ? (sizes[boards[0].id]?.h ?? boards[0].h) : 0) + PAD * 2 };
    if (!boards.length) return { ox: PAD, oy: PAD, w: 0, h: 0 };
    const minX = Math.min(...boards.map((b) => b.x));
    const minY = Math.min(...boards.map((b) => b.y));
    const maxX = Math.max(...boards.map((b) => b.x + b.w));
    const maxY = Math.max(...boards.map((b) => b.y + (sizes[b.id]?.h ?? b.h)));
    return { ox: PAD - minX, oy: PAD - minY, w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2 };
  }, [bp, boards, sizes]);

  const posOf = (b: LayerNode) => (bp ? { x: layout.ox, y: layout.oy } : { x: b.x + layout.ox, y: b.y + layout.oy });

  const onMeasure = useCallback((id: string, size: { w: number; h: number }) => {
    setSizes((prev) => (prev[id]?.h === size.h && prev[id]?.w === size.w ? prev : { ...prev, [id]: size }));
  }, []);
  const onBoxes = useCallback((boardId: string, b: Record<string, Box>) => setBoxes((prev) => ({ ...prev, [boardId]: b })), []);

  // ---------------------------------------------------------------- zoom
  const fit = useCallback(() => {
    const el = viewport.current;
    if (!el || !layout.w) return;
    setZoom(Math.min(1, (el.clientWidth - 32) / layout.w, (el.clientHeight - 32) / layout.h) || 1);
    el.scrollTo({ left: 0, top: 0 });
  }, [layout.w, layout.h]);

  // ajusta ao abrir um projeto e quando a primeira medida chega
  const fitted = useRef<string>('');
  useEffect(() => {
    const key = `${file}|${device}|${pageId}`;
    if (fitted.current !== key && layout.w > 0 && Object.keys(sizes).length > 0) { fitted.current = key; fit(); }
  }, [file, device, pageId, layout.w, sizes, fit]);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      const before = app.get().zoom;
      const next = Math.min(4, Math.max(0.1, before * factor));
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left + el.scrollLeft;
      const py = e.clientY - rect.top + el.scrollTop;
      setZoom(next);
      el.scrollLeft = px * (next / before) - (e.clientX - rect.left);
      el.scrollTop = py * (next / before) - (e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // arrastar com o botão do meio move a visão
  const panStart = useRef<{ x: number; y: number; l: number; t: number } | null>(null);
  const onViewportDown = (e: React.MouseEvent) => {
    const el = viewport.current;
    if (!el) return;
    if (e.button === 1) {
      e.preventDefault();
      panStart.current = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
      const move = (ev: MouseEvent) => { if (panStart.current) { el.scrollLeft = panStart.current.l - (ev.clientX - panStart.current.x); el.scrollTop = panStart.current.t - (ev.clientY - panStart.current.y); } };
      const up = () => { panStart.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    } else if (e.button === 0 && (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-sizer') || (e.target as HTMLElement).classList.contains('canvas-world'))) {
      select([]);
    }
  };

  // ---------------------------------------------------------------- arrastar / redimensionar
  const nodeOf = (id: string) => findNode(page.children, id);
  const movable = (id: string) => {
    const n = nodeOf(id);
    if (!n || n.locked || !editable) return false;
    return !inFlow(parentOf(page.children, id), n);
  };

  /** Liga o arrasto: ouve o ponteiro na janela e dentro de cada iframe (o mouse pode passar por cima deles). */
  const beginDrag = useCallback((d: Drag) => {
    dragRef.current = d; // já vale para o próximo evento do mouse (o estado do React só chega no próximo quadro)
    setDrag(d);
    const targets: Document[] = [document, ...Array.from(viewport.current?.querySelectorAll('iframe') ?? []).map((f) => f.contentDocument).filter((x): x is Document => !!x)];
    const move = (e: MouseEvent) => {
      const cur = dragRef.current;
      if (!cur) return;
      const dx = (e.screenX - cur.startX) / app.get().zoom;
      const dy = (e.screenY - cur.startY) / app.get().zoom;
      const moved = cur.moved || Math.abs(dx) + Math.abs(dy) > 3 / app.get().zoom;
      const next = { ...cur, dx, dy, moved };
      dragRef.current = next;
      setDrag(next);
    };
    const up = () => {
      targets.forEach((t) => { t.removeEventListener('mousemove', move as EventListener); t.removeEventListener('mouseup', up); });
      const cur = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (cur?.moved) void commitRef.current(cur); // sempre a versão MAIS NOVA (o documento muda enquanto se desenha)
    };
    targets.forEach((t) => { t.addEventListener('mousemove', move as EventListener); t.addEventListener('mouseup', up); });
  }, []);

  const commitDrag = async (d: Drag) => {
    const round = (v: number) => Math.round(v);
    if (d.kind === 'move') {
      const updates = d.ids.filter(movable).map((id) => { const n = nodeOf(id)!; return { id, props: { x: round(n.x + d.dx), y: round(n.y + d.dy) } }; });
      if (!updates.length) return;
      if (updates.length === 1) await setProps([updates[0].id], updates[0].props);
      else await run('update_layers', { updates });
      return;
    }
    const id = d.ids[0];
    const n = nodeOf(id);
    const h = d.handle!;
    if (!n) return;
    const box = boxOf(id);
    let { w, h: height } = { w: box?.w ?? n.w, h: box?.h ?? n.h };
    let x = n.x, y = n.y;
    if (h.includes('e')) w += d.dx;
    if (h.includes('s')) height += d.dy;
    if (h.includes('w')) { w -= d.dx; x += d.dx; }
    if (h.includes('n')) { height -= d.dy; y += d.dy; }
    const props: Record<string, unknown> = { w: Math.max(4, round(w)), h: Math.max(4, round(height)) };
    if (movable(id) && (h.includes('w') || h.includes('n'))) { props.x = round(x); props.y = round(y); }
    await setProps([id], props);
  };

  // o fim do arrasto roda dentro de um ouvinte criado uma vez só: precisa enxergar o documento atual, não o de quando o ouvinte nasceu
  const commitRef = useRef(commitDrag);
  commitRef.current = commitDrag;

  const onPressSelected = useCallback((id: string, e: MouseEvent) => {
    const ids = app.get().selection.includes(id) ? app.get().selection : [id];
    if (!ids.some(movable)) return;
    beginDrag({ kind: 'move', ids, startX: e.screenX, startY: e.screenY, moved: false, dx: 0, dy: 0 });
  }, [beginDrag, page, editable]);

  const startResize = (handle: Handle) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    beginDrag({ kind: 'resize', handle, ids: [selection[0]], startX: e.screenX, startY: e.screenY, moved: false, dx: 0, dy: 0 });
  };

  // ---------------------------------------------------------------- caixas de seleção em coordenadas do mundo
  const boxOf = (id: string): Box | null => {
    const b = boardContaining(page, id);
    const inner = b && boxes[b.id]?.[id];
    if (!b || !inner) return null;
    const p = posOf(b);
    return { x: p.x + inner.x, y: p.y + inner.y, w: inner.w, h: inner.h };
  };

  const inv = 1 / zoom;
  /** O menor lado da caixa na tela: caixas pequenas só ganham as alças dos cantos (ou nenhuma). */
  const small = (b: Box) => Math.min(b.w, b.h) * zoom;
  const selBoxes = selection.map((id) => ({ id, box: boxOf(id) })).filter((s): s is { id: string; box: Box } => !!s.box);
  const hoverBox = hover && !selection.includes(hover) ? boxOf(hover) : null;
  const single = selection.length === 1 ? selBoxes[0] : undefined;

  const onPick = useCallback((id: string, additive: boolean) => {
    const cur = app.get().selection;
    select(additive ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id]);
  }, []);
  const onEditText = useCallback((id: string, text: string) => { void setProps([id], { text }); }, []);

  if (!allBoards.length) {
    return (
      <div className="canvas-viewport">
        <div className="canvas-empty">
          <h3>Esta página está vazia</h3>
          <p className="muted">Crie uma tela para começar. Um agente conectado também pode montar a estrutura para você.</p>
          {editable && <button className="btn primary" onClick={() => void insert('screen')}><Icon name="plus" /> Criar uma tela</button>}
        </div>
      </div>
    );
  }

  const live = (box: Box, id: string): Box => {
    if (!drag?.moved) return box;
    if (drag.kind === 'move' && drag.ids.includes(id) && movable(id)) return { ...box, x: box.x + drag.dx, y: box.y + drag.dy };
    if (drag.kind === 'resize' && drag.ids[0] === id) {
      let { x, y, w, h } = box;
      const hd = drag.handle!;
      if (hd.includes('e')) w += drag.dx;
      if (hd.includes('s')) h += drag.dy;
      if (hd.includes('w')) { x += drag.dx; w -= drag.dx; }
      if (hd.includes('n')) { y += drag.dy; h -= drag.dy; }
      return { x, y, w: Math.max(4, w), h: Math.max(4, h) };
    }
    return box;
  };

  return (
    <div className="canvas-area">
      <div className="canvas-viewport" ref={viewport} onMouseDown={onViewportDown}>
        <div className="canvas-sizer" style={{ width: layout.w * zoom, height: layout.h * zoom }}>
          <div className="canvas-world" style={{ width: layout.w, height: layout.h, transform: `scale(${zoom})`, ['--inv' as string]: inv }}>
            {boards.map((b) => {
              const p = posOf(b);
              return (
                <div key={b.id}>
                  <div className="board-label" style={{ left: p.x, top: p.y - 18 * inv }}>{b.name}{bp ? ` · ${bp.name} ${bp.preview}px` : ''}</div>
                  <BoardFrame
                    board={b} doc={doc} x={p.x} y={p.y} width={widthOf(b)} selection={selection} editable={editable}
                    onMeasure={onMeasure} onPick={onPick} onHover={hoverLayer} onEditText={onEditText}
                    onPressSelected={onPressSelected} onBoxes={onBoxes}
                  />
                </div>
              );
            })}

            {hoverBox && <div className="sel-hover" style={{ left: hoverBox.x, top: hoverBox.y, width: hoverBox.w, height: hoverBox.h }} />}
            {selBoxes.map(({ id, box }) => {
              const b = live(box, id);
              const node = nodeOf(id);
              return (
                <div key={id} className={`sel-box${drag?.moved ? ' dragging' : ''}`} style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
                  {single?.id === id && <span className="sel-label" style={{ top: -22 * inv }}>{node?.name}{node && <span className="faint"> · {Math.round(b.w)}×{Math.round(b.h)}</span>}</span>}
                </div>
              );
            })}
            {single && editable && !nodeOf(single.id)?.locked && (small(single.box) < 14 ? [] : small(single.box) < 44 ? HANDLES.filter((h) => h.length === 2) : HANDLES).map((h) => {
              const b = live(single.box, single.id);
              const cx = h.includes('w') ? b.x : h.includes('e') ? b.x + b.w : b.x + b.w / 2;
              const cy = h.includes('n') ? b.y : h.includes('s') ? b.y + b.h : b.y + b.h / 2;
              return <div key={h} className={`handle h-${h}`} style={{ left: cx, top: cy }} onMouseDown={startResize(h)} />;
            })}
          </div>
        </div>
        {drag?.moved && <div className="drag-shield" />}
      </div>

      <div className="zoom-controls">
        <button className="btn ghost icon sm" title="Diminuir" onClick={() => setZoom(zoom / 1.2)}>−</button>
        <button className="btn ghost sm" title="Ajustar à tela" onClick={fit}>{Math.round(zoom * 100)}%</button>
        <button className="btn ghost icon sm" title="Aumentar" onClick={() => setZoom(zoom * 1.2)}>+</button>
      </div>
    </div>
  );
}
