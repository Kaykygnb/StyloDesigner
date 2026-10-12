// Caneta (clique = ponto, arrastar = curva) e lápis (traço livre). Ficam numa camada por cima do canvas, então funcionam também sobre as telas.
// Enter ou duplo clique termina um caminho aberto; clicar no 1º ponto fecha; Esc cancela; Backspace volta um ponto.
import { useEffect, useRef, useState } from 'react';

export interface PenPoint { x: number; y: number; hin?: { x: number; y: number } | null; hout?: { x: number; y: number } | null }
type P = { x: number; y: number };

interface Props {
  mode: 'pen' | 'pencil';
  zoom: number;
  panX: number;
  panY: number;
  /** ponto da janela → mundo */
  toWorld: (p: P) => P;
  onDone: (points: PenPoint[], closed: boolean) => void;
  onCancel: () => void;
}

/** Ramer–Douglas–Peucker: tira os pontos que não mudam a forma do traço. */
export function simplifyStroke(points: P[], tolerance: number): P[] {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points[points.length - 1]];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1e-9;
  let far = 0, at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = Math.abs((b.x - a.x) * (a.y - points[i].y) - (a.x - points[i].x) * (b.y - a.y)) / len;
    if (d > far) { far = d; at = i; }
  }
  if (far <= tolerance) return [a, b];
  return [...simplifyStroke(points.slice(0, at + 1), tolerance).slice(0, -1), ...simplifyStroke(points.slice(at), tolerance)];
}

export function PenOverlay({ mode, zoom, panX, panY, toWorld, onDone, onCancel }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<PenPoint[]>([]);
  const [cursor, setCursor] = useState<P | null>(null);
  const [stroke, setStroke] = useState<P[]>([]);
  const live = useRef({ points, stroke });
  live.current = { points, stroke };
  const dragging = useRef<number | null>(null);
  const near = useRef(false);

  const screen = (w: P): P => ({ x: w.x * zoom + panX, y: w.y * zoom + panY });
  const world = (e: { clientX: number; clientY: number }) => toWorld({ x: e.clientX, y: e.clientY });

  const finish = (closed: boolean) => {
    const pts = live.current.points;
    if (pts.length >= 2 || (closed && pts.length >= 3)) onDone(pts, closed && pts.length >= 3);
    else onCancel();
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
      else if (e.key === 'Enter' && mode === 'pen') { e.preventDefault(); e.stopPropagation(); finish(false); }
      else if (e.key === 'Backspace' && mode === 'pen') { e.preventDefault(); e.stopPropagation(); setPoints((p) => p.slice(0, -1)); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation(); // sem isso o canvas começa uma seleção por caixa por baixo
    const w = world(e);
    if (mode === 'pencil') { setStroke([w]); return; }
    const pts = live.current.points;
    if (pts.length >= 3 && Math.hypot(screen(pts[0]).x - screen(w).x, screen(pts[0]).y - screen(w).y) < 9) { finish(true); return; }
    setPoints([...pts, { x: w.x, y: w.y, hin: null, hout: null }]);
    dragging.current = pts.length;
  };
  const onMove = (e: React.MouseEvent) => {
    const w = world(e);
    setCursor(w);
    if (mode === 'pencil') { if (e.buttons === 1 && live.current.stroke.length) setStroke((s) => [...s, w]); return; }
    const first = live.current.points[0];
    near.current = !!first && live.current.points.length >= 3 && Math.hypot(screen(first).x - screen(w).x, screen(first).y - screen(w).y) < 9;
    const i = dragging.current;
    if (i === null || e.buttons !== 1) return;
    setPoints((pts) => pts.map((p, k) => k === i && Math.hypot(w.x - p.x, w.y - p.y) * zoom > 3
      ? { ...p, hout: { x: w.x, y: w.y }, hin: { x: 2 * p.x - w.x, y: 2 * p.y - w.y } } : p));
  };
  const onUp = () => {
    dragging.current = null;
    if (mode !== 'pencil') return;
    const s = live.current.stroke;
    setStroke([]);
    if (s.length < 2) return;
    const simple = simplifyStroke(s, 1.5 / zoom);
    if (simple.length >= 2) onDone(simple.map((p) => ({ x: p.x, y: p.y, hin: null, hout: null })), false);
  };

  const pen = points.map((p) => ({ ...p, s: screen(p) }));
  const path = pen.length
    ? pen.map((p, i) => {
      if (i === 0) return `M ${p.s.x} ${p.s.y}`;
      const q = pen[i - 1];
      const c1 = q.hout ? screen(q.hout) : q.s, c2 = p.hin ? screen(p.hin) : p.s;
      return `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p.s.x} ${p.s.y}`;
    }).join(' ')
    : '';
  const last = pen.at(-1);
  const rubber = last && cursor && mode === 'pen' ? `M ${last.s.x} ${last.s.y} L ${screen(cursor).x} ${screen(cursor).y}` : '';

  return (
    <div ref={box} className="pen-overlay" onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onDoubleClick={() => { if (mode !== 'pen') return; const pts = live.current.points.slice(0, -1); if (pts.length >= 2) onDone(pts, false); else onCancel(); }}>
      <svg width="100%" height="100%">
        {path && <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />}
        {rubber && <path d={rubber} fill="none" stroke="var(--accent)" strokeWidth="1" strokeDasharray="4 3" />}
        {stroke.length > 1 && <polyline points={stroke.map((p) => `${screen(p).x},${screen(p).y}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />}
        {pen.map((p, i) => <g key={i}>
          {p.hout && p.hin && <path d={`M ${screen(p.hin).x} ${screen(p.hin).y} L ${screen(p.hout).x} ${screen(p.hout).y}`} stroke="var(--accent)" strokeWidth="1" />}
          <rect x={p.s.x - 4} y={p.s.y - 4} width="8" height="8" fill={i === 0 && near.current ? 'var(--accent)' : '#fff'} stroke="var(--accent)" strokeWidth="1.5" />
        </g>)}
      </svg>
    </div>
  );
}
