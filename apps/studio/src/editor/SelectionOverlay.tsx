// Tudo que se desenha POR CIMA das telas, no espaço do "mundo": caixas de seleção com alças e giro, nome e tamanho, contorno ao passar o
// mouse, linhas de encaixe, medidas (Alt), caixa de seleção, prévia do que está sendo desenhado e onde uma camada vai cair.
// O tamanho de traços, alças e textos usa `--inv` (1 ÷ zoom) para parecer sempre do mesmo tamanho na tela.
import { useEffect, useState } from 'react';
import { measures, union, type Box, type SnapGuide } from './canvas/geometry';
import type { ShapeTool } from '../lib/shapes';
import type { LayerNode } from '../lib/types';

export interface ObBox extends Box { rot: number }
type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface MoveItem { id: string; name: string; box: Box; flow: boolean; locked: boolean; parentId: string | null; board: boolean; section: boolean }
export type Gesture =
  | { kind: 'pan' }
  | { kind: 'move'; items: MoveItem[]; dx: number; dy: number; moved: boolean; guides: SnapGuide[]; dropFrame: string | null; dropRoot: boolean; dropLine: SnapGuide | null; flowIndex: number | null; duplicate: boolean }
  | { kind: 'resize'; handle: Handle; box: ObBox; boxes: { id: string; x: number; y: number; w: number; h: number }[]; guides: SnapGuide[]; single: boolean }
  | { kind: 'rotate'; ob: ObBox; angle: number }
  | { kind: 'marquee'; rect: Box }
  | { kind: 'draw'; tool: ShapeTool; box: Box; line?: { a: { x: number; y: number }; b: { x: number; y: number } } };

const HANDLES: { h: Handle; x: number; y: number }[] = [
  { h: 'nw', x: 0, y: 0 }, { h: 'n', x: 50, y: 0 }, { h: 'ne', x: 100, y: 0 }, { h: 'e', x: 100, y: 50 },
  { h: 'se', x: 100, y: 100 }, { h: 's', x: 50, y: 100 }, { h: 'sw', x: 0, y: 100 }, { h: 'w', x: 0, y: 50 },
];
const CORNERS: Handle[] = ['nw', 'ne', 'se', 'sw'];
const ROT_ZONES: { h: Handle; x: number; y: number }[] = [{ h: 'nw', x: 0, y: 0 }, { h: 'ne', x: 100, y: 0 }, { h: 'se', x: 100, y: 100 }, { h: 'sw', x: 0, y: 100 }];

/** Cursor da alça levando a rotação em conta: uma alça "leste" numa caixa girada 90° mostra o cursor vertical. */
const BASE_ANGLE: Record<Handle, number> = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 };
const CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
export const handleCursor = (h: Handle, rot: number) => CURSORS[Math.round((((BASE_ANGLE[h] + rot) % 180) + 180) % 180 / 45) % 4];

interface Props {
  /** modo "editar nós": só o contorno, sem alças de tamanho (elas se confundem com os pontos do vetor) */
  nodeMode?: boolean;
  zoom: number;
  gesture: Gesture | null;
  selection: string[];
  editable: boolean;
  hoverBox: Box | null;
  oboxOf: (id: string) => ObBox | null;
  aabbOf: (id: string) => Box | null;
  nameOf: (id: string) => string;
  lockedOf: (id: string) => boolean;
  measureTarget: string | null;
  onResize: (h: Handle) => (e: React.MouseEvent) => void;
  onRotate: (e: React.MouseEvent) => void;
  pageGuides?: unknown;
}

const px = (n: number) => Math.round(n);

export function SelectionOverlay({ zoom, gesture, selection, editable, hoverBox, oboxOf, aabbOf, nameOf, lockedOf, measureTarget, onResize, onRotate, nodeMode }: Props) {
  const inv = 1 / zoom;
  const moving = gesture?.kind === 'move' ? gesture : null;
  const resizing = gesture?.kind === 'resize' ? gesture : null;
  const rotating = gesture?.kind === 'rotate' ? gesture : null;

  // as caixas das camadas selecionadas, com o gesto em andamento aplicado
  const items = selection.map((id) => {
    let ob = oboxOf(id);
    if (!ob) return null;
    if (moving) { const m = moving.items.find((i) => i.id === id); if (m && !m.locked) ob = { ...ob, x: ob.x + moving.dx, y: ob.y + moving.dy }; }
    if (resizing && !resizing.single) { const r = resizing.boxes.find((b) => b.id === id); if (r) ob = { ...ob, x: r.x, y: r.y, w: r.w, h: r.h }; }
    return { id, ob };
  }).filter((x): x is { id: string; ob: ObBox } => !!x);

  const single = items.length === 1 ? items[0] : null;
  const live: ObBox | null = rotating ? rotating.ob : resizing?.single ? resizing.box : single?.ob ?? null;
  const group = items.length > 1 ? (resizing ? resizing.box : union(items.map((i) => i.ob))) : null;
  const locked = !!single && lockedOf(single.id);
  const sizeOf = (b: Box) => Math.min(b.w, b.h) * zoom;
  const showHandles = editable && !nodeMode && !gesture?.kind?.match(/move|draw|marquee|pan/) && !locked;
  const handleList = (b: Box) => (sizeOf(b) < 14 ? [] : sizeOf(b) < 44 ? HANDLES.filter((h) => CORNERS.includes(h.h)) : HANDLES);

  // linha de medida (Alt)
  const measure = (() => {
    if (!measureTarget || !items.length) return [];
    const a = union(items.map((i) => aabbOf(i.id)).filter((x): x is Box => !!x));
    const b = aabbOf(measureTarget);
    return a && b ? measures(a, b) : [];
  })();

  const pillAt = (box: Box, text: string, below = true) => (
    <div className="pill" style={{ left: box.x + box.w / 2, top: below ? box.y + box.h + 8 * inv : box.y - 28 * inv }}>{text}</div>
  );

  const aabbOfOb = (o: ObBox): Box => {
    if (!o.rot) return o;
    const r = (o.rot * Math.PI) / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
    const w = o.w * c + o.h * s, h = o.w * s + o.h * c;
    return { x: o.x + o.w / 2 - w / 2, y: o.y + o.h / 2 - h / 2, w, h };
  };

  return (
    <>
      {hoverBox && <div className="sel-hover" style={{ left: hoverBox.x, top: hoverBox.y, width: hoverBox.w, height: hoverBox.h }} />}

      {moving?.dropFrame && (() => { const b = aabbOf(moving.dropFrame!); return b ? <div className="sel-drop" style={{ left: b.x, top: b.y, width: b.w, height: b.h }} /> : null; })()}

      {items.map(({ id, ob }) => (
        <div key={id} className={`sel-box${moving?.moved ? ' dragging' : ''}${locked && single?.id === id ? ' locked' : ''}`}
          style={{ left: ob.x, top: ob.y, width: ob.w, height: ob.h, transform: ob.rot ? `rotate(${ob.rot}deg)` : undefined }} />
      ))}

      {/* uma camada: alças, giro, nome e tamanho */}
      {single && live && (() => {
        const box = rotating ? live : resizing?.single ? live : single.ob;
        const a = aabbOfOb(box);
        return (
          <>
            <div className="sel-label" style={{ left: a.x, top: a.y - 22 * inv }}>{nameOf(single.id)}{locked && ' 🔒'}</div>
            {pillAt(a, rotating ? `${rotating.angle}°` : `${px(box.w)} × ${px(box.h)}`)}
            {showHandles && (
              <div className="sel-handles" style={{ left: box.x, top: box.y, width: box.w, height: box.h, transform: box.rot ? `rotate(${box.rot}deg)` : undefined }}>
                {sizeOf(box) >= 24 && ROT_ZONES.map((z) => (
                  <div key={`r${z.h}`} className={`rot-zone rz-${z.h}`} style={{ left: `${z.x}%`, top: `${z.y}%` }} onMouseDown={onRotate} />
                ))}
                {handleList(box).map((h) => (
                  <div key={h.h} className={`handle h-${h.h}`} style={{ left: `${h.x}%`, top: `${h.y}%`, cursor: handleCursor(h.h, box.rot) }} onMouseDown={onResize(h.h)} />
                ))}
              </div>
            )}
          </>
        );
      })()}

      {/* várias camadas: uma caixa só */}
      {group && (
        <>
          <div className="sel-box group" style={{ left: group.x, top: group.y, width: group.w, height: group.h }} />
          {pillAt(group, `${px(group.w)} × ${px(group.h)}`)}
          {showHandles && (
            <div className="sel-handles" style={{ left: group.x, top: group.y, width: group.w, height: group.h }}>
              {handleList(group).map((h) => <div key={h.h} className={`handle h-${h.h}`} style={{ left: `${h.x}%`, top: `${h.y}%`, cursor: handleCursor(h.h, 0) }} onMouseDown={onResize(h.h)} />)}
            </div>
          )}
        </>
      )}

      {/* linhas de encaixe */}
      {(moving?.guides ?? resizing?.guides ?? []).map((gd, i) => (
        <div key={i} className={`snap-line ${gd.axis}`} style={gd.axis === 'x' ? { left: gd.pos, top: gd.from, height: gd.to - gd.from } : { top: gd.pos, left: gd.from, width: gd.to - gd.from }} />
      ))}
      {moving?.dropLine && (
        <div className={`drop-line ${moving.dropLine.axis}`} style={moving.dropLine.axis === 'x' ? { left: moving.dropLine.pos, top: moving.dropLine.from, height: moving.dropLine.to - moving.dropLine.from } : { top: moving.dropLine.pos, left: moving.dropLine.from, width: moving.dropLine.to - moving.dropLine.from }} />
      )}
      {moving?.moved && moving.items.length === 1 && !moving.items[0].locked && pillAt({ x: moving.items[0].box.x + moving.dx, y: moving.items[0].box.y + moving.dy, w: moving.items[0].box.w, h: moving.items[0].box.h }, `${px(moving.items[0].box.x + moving.dx)}, ${px(moving.items[0].box.y + moving.dy)}`)}

      {/* medidas com Alt */}
      {measureTarget && (() => { const b = aabbOf(measureTarget); return b ? <div className="sel-hover measure-target" style={{ left: b.x, top: b.y, width: b.w, height: b.h }} /> : null; })()}
      {measure.map((m, i) => {
        const horizontal = Math.abs(m.y1 - m.y2) < 0.01;
        return (
          <div key={i}>
            <div className="measure-line" style={horizontal ? { left: Math.min(m.x1, m.x2), top: m.y1, width: Math.abs(m.x2 - m.x1), height: 0, borderTopWidth: inv } : { left: m.x1, top: Math.min(m.y1, m.y2), height: Math.abs(m.y2 - m.y1), width: 0, borderLeftWidth: inv }} />
            <div className="pill measure" style={{ left: (m.x1 + m.x2) / 2, top: (m.y1 + m.y2) / 2 - (horizontal ? 14 * inv : 0) }}>{Math.round(m.len)}</div>
          </div>
        );
      })}

      {gesture?.kind === 'marquee' && <div className="marquee" style={{ left: gesture.rect.x, top: gesture.rect.y, width: gesture.rect.w, height: gesture.rect.h }} />}

      {gesture?.kind === 'draw' && (gesture.tool === 'line' && gesture.line
        ? <svg className="draw-line" style={{ left: 0, top: 0 }} width="1" height="1" overflow="visible"><line x1={gesture.line.a.x} y1={gesture.line.a.y} x2={gesture.line.b.x} y2={gesture.line.b.y} stroke="var(--accent)" strokeWidth={2 * inv} /></svg>
        : <div className={`draw-box ${gesture.tool}`} style={{ left: gesture.box.x, top: gesture.box.y, width: gesture.box.w, height: gesture.box.h, borderRadius: gesture.tool === 'ellipse' ? '50%' : undefined }} />)}
      {gesture?.kind === 'draw' && gesture.box.w > 0 && pillAt(gesture.box, `${px(gesture.box.w)} × ${px(gesture.box.h)}`)}
    </>
  );
}

/** Nós e alças do path selecionado. Fica fora do iframe e só aparece no modo Inspecionar. */
export function VectorNodeOverlay({ node, box, zoom, worldFromClient, onCommit }: {
  node: LayerNode; box: ObBox; zoom: number; worldFromClient: (x: number, y: number) => { x: number; y: number };
  onCommit: (points: NonNullable<LayerNode['points']>) => void;
}) {
  const [draft, setDraft] = useState(node.points ?? []);
  const [selectedNodes, setSelectedNodes] = useState<Set<number>>(new Set());
  useEffect(() => setDraft(node.points ?? []), [node.id, node.points]);
  useEffect(() => setSelectedNodes(new Set()), [node.id]);
  if (node.type !== 'path' || !draft.length) return null;
  const vw = Number(node.vw || node.w || 1), vh = Number(node.vh || node.h || 1);
  // relativo ao contêiner (que já está em box.x/box.y)
  const px = (p: { x: number; y: number }) => ({ left: p.x / vw * box.w, top: p.y / vh * box.h });
  const movePoint = (p: NonNullable<LayerNode['points']>[number], dx: number, dy: number) => ({
    ...p, x: p.x + dx, y: p.y + dy,
    ...(p.hin ? { hin: { x: p.hin.x + dx, y: p.hin.y + dy } } : {}),
    ...(p.hout ? { hout: { x: p.hout.x + dx, y: p.hout.y + dy } } : {}),
  });
  const nudge = (index: number, dx: number, dy: number) => {
    const active = selectedNodes.has(index) ? selectedNodes : new Set([index]);
    setSelectedNodes(active);
    const next = draft.map((p, i) => active.has(i) ? movePoint(p, dx, dy) : p);
    setDraft(next); onCommit(next);
  };
  const onNodeKey = (index: number) => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    const delta = e.key === 'ArrowLeft' ? { x: -step, y: 0 } : e.key === 'ArrowRight' ? { x: step, y: 0 } : e.key === 'ArrowUp' ? { x: 0, y: -step } : e.key === 'ArrowDown' ? { x: 0, y: step } : null;
    if (!delta) return;
    e.preventDefault(); e.stopPropagation(); nudge(index, delta.x, delta.y);
  };
  const begin = (index: number, field: 'point' | 'hin' | 'hout') => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const active = field === 'point'
      ? (e.shiftKey ? new Set([...selectedNodes, index]) : selectedNodes.has(index) ? new Set(selectedNodes) : new Set([index]))
      : new Set([index]);
    setSelectedNodes(active);
    const start = draft[index];
    const origin = field === 'point' ? start : start[field] || start;
    let latest = draft;
    const move = (ev: MouseEvent) => {
      const w = worldFromClient(ev.clientX, ev.clientY);
      const x = Math.max(-100000, Math.min(100000, (w.x - box.x) / box.w * vw));
      const y = Math.max(-100000, Math.min(100000, (w.y - box.y) / box.h * vh));
      const delta = { x: x - origin.x, y: y - origin.y };
      const next = node.points!.map((p, i) => {
        if (!active.has(i)) return p;
        if (field === 'point') return movePoint(p, delta.x, delta.y);
        return { ...p, [field]: { x, y } };
      });
      latest = next;
      setDraft(next);
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); if (latest !== draft) onCommit(latest); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up, { once: true });
  };
  return <div className="vector-node-overlay" style={{ left: box.x, top: box.y, width: box.w, height: box.h, transform: box.rot ? `rotate(${box.rot}deg)` : undefined }}>
    <svg className="vector-handle-lines" width="100%" height="100%" viewBox={`0 0 ${box.w} ${box.h}`} preserveAspectRatio="none" aria-hidden="true">
      {draft.map((p, i) => (['hin', 'hout'] as const).map((field) => p[field] && (() => { const a = px(p); const b = px(p[field]!); return <line key={`${field}-line-${i}`} x1={a.left - box.x} y1={a.top - box.y} x2={b.left - box.x} y2={b.top - box.y} />; })()))}
    </svg>
    {draft.map((p, i) => <button type="button" key={`n${i}`} className={`vector-node${selectedNodes.has(i) ? ' selected' : ''}`} style={px(p)} onMouseDown={begin(i, 'point')} onKeyDown={onNodeKey(i)} aria-pressed={selectedNodes.has(i)} aria-label={`Nó ${i + 1}`} title={`Nó ${i + 1}: Shift seleciona vários; setas movem 1px, Shift+setas 10px`} />)}
    {draft.map((p, i) => (['hin', 'hout'] as const).map((field) => p[field] && <button type="button" key={`${field}${i}`} className={`vector-handle ${field}`} style={px(p[field]!)} onMouseDown={begin(i, field)} aria-label={`${field === 'hin' ? 'Alça de entrada' : 'Alça de saída'} ${i + 1}`} title={`${field === 'hin' ? 'Alça de entrada' : 'Alça de saída'} ${i + 1}`} />))}
  </div>;
}
