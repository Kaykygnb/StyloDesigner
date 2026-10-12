// Réguas nas bordas do canvas (em px do projeto) e as GUIAS: arraste de uma régua para criar uma guia, arraste a guia para
// movê-la, solte-a sobre a régua para apagar. O arrasto da camada gruda nas guias. As guias ficam na página (set_guides).
import { useEffect, useRef, useState } from 'react';
import { run, useApp } from '../lib/app';
import { canEdit } from '../lib/actions';
import type { Box } from './canvas/geometry';

interface Guide { axis: 'x' | 'y'; pos: number }
const R = 20; // espessura da régua
const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function Rulers({ viewport, guides, highlight }: { viewport: React.RefObject<HTMLDivElement | null>; guides: Guide[]; highlight: Box | null }) {
  const zoom = useApp((s) => s.zoom);
  const panX = useApp((s) => s.panX);
  const panY = useApp((s) => s.panY);
  const pageId = useApp((s) => s.pageId);
  const theme = useApp((s) => s.theme);
  const top = useRef<HTMLCanvasElement>(null);
  const left = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [drag, setDrag] = useState<{ axis: 'x' | 'y'; pos: number; index: number | null; over: boolean } | null>(null);
  const editable = canEdit();

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [viewport]);

  useEffect(() => {
    const step = STEPS.find((s) => s * zoom >= 60) ?? STEPS[STEPS.length - 1];
    const minor = step / (step >= 10 ? 5 : 1);
    const draw = (cv: HTMLCanvasElement | null, horizontal: boolean) => {
      if (!cv) return;
      const dpr = window.devicePixelRatio || 1;
      const len = horizontal ? size.w : size.h;
      cv.width = (horizontal ? len : R) * dpr; cv.height = (horizontal ? R : len) * dpr;
      cv.style.width = `${horizontal ? len : R}px`; cv.style.height = `${horizontal ? R : len}px`;
      const c = cv.getContext('2d')!;
      c.scale(dpr, dpr);
      c.fillStyle = css('--surface') || '#fff'; c.fillRect(0, 0, horizontal ? len : R, horizontal ? R : len);
      const offset = horizontal ? panX : panY;
      if (highlight) {
        const a = (horizontal ? highlight.x : highlight.y) * zoom + offset, b = a + (horizontal ? highlight.w : highlight.h) * zoom;
        c.fillStyle = css('--accent-soft') || 'rgba(91,91,214,.2)';
        if (horizontal) c.fillRect(a, 0, b - a, R); else c.fillRect(0, a, R, b - a);
      }
      c.strokeStyle = css('--border') || '#ddd'; c.fillStyle = css('--text-3') || '#888'; c.font = '10px system-ui, sans-serif';
      c.lineWidth = 1;
      const first = Math.floor(-offset / zoom / minor) * minor, last = (len - offset) / zoom;
      c.beginPath();
      for (let v = first; v <= last; v += minor) {
        const p = Math.round(v * zoom + offset) + 0.5;
        const major = Math.abs(v % step) < 1e-6;
        const t = major ? R : R * 0.35;
        if (horizontal) { c.moveTo(p, R - t); c.lineTo(p, R); } else { c.moveTo(R - t, p); c.lineTo(R, p); }
        if (major) {
          const label = String(Math.round(v));
          if (horizontal) c.fillText(label, p + 3, 10);
          else { c.save(); c.translate(10, p - 3); c.rotate(-Math.PI / 2); c.fillText(label, 0, 0); c.restore(); }
        }
      }
      c.stroke();
      c.strokeStyle = css('--border') || '#ddd';
      c.beginPath();
      if (horizontal) { c.moveTo(0, R - 0.5); c.lineTo(len, R - 0.5); } else { c.moveTo(R - 0.5, 0); c.lineTo(R - 0.5, len); }
      c.stroke();
    };
    draw(top.current, true);
    draw(left.current, false);
  }, [zoom, panX, panY, size, highlight, theme]);

  const save = (next: Guide[]) => run('set_guides', { page_id: pageId, guides: next });

  /** Começa a arrastar: uma guia nova (de uma régua) ou uma existente (index). */
  const begin = (axis: 'x' | 'y', index: number | null) => (e: React.MouseEvent) => {
    if (e.button !== 0 || !editable) return;
    e.preventDefault();
    e.stopPropagation();
    const el = viewport.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const posOf = (ev: MouseEvent) => {
      const s = (axis === 'x' ? ev.clientX - rect.left - panX : ev.clientY - rect.top - panY) / zoom;
      return Math.round(s);
    };
    const overRuler = (ev: MouseEvent) => (axis === 'x' ? ev.clientX - rect.left < R : ev.clientY - rect.top < R);
    let cur = { axis, pos: index != null ? guides[index].pos : posOf(e.nativeEvent), index, over: overRuler(e.nativeEvent) };
    setDrag(cur);
    const move = (ev: MouseEvent) => { cur = { axis, pos: posOf(ev), index, over: overRuler(ev) }; setDrag(cur); };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      setDrag(null);
      const rest = index != null ? guides.filter((_, i) => i !== index) : guides.slice();
      if (cur.over) { if (index != null) void save(rest); return; } // soltou sobre a régua: apaga (ou nem chegou a criar)
      void save([...rest, { axis, pos: cur.pos }]);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const shown = guides.map((g, i) => (drag && drag.index === i ? null : { g, i })).filter((x): x is { g: Guide; i: number } => !!x);
  const line = (g: Guide, key: string, dragging = false, index: number | null = null) => {
    const p = g.axis === 'x' ? g.pos * zoom + panX : g.pos * zoom + panY;
    return (
      <div key={key} className={`guide ${g.axis}${dragging ? ' dragging' : ''}`} style={g.axis === 'x' ? { left: p, top: R } : { top: p, left: R }}>
        {!dragging && index != null && <div className="guide-hit" onMouseDown={begin(g.axis, index)} title="Arraste para mover; solte sobre a régua para apagar" />}
        {dragging && <span className="guide-pos">{g.pos}</span>}
      </div>
    );
  };

  return (
    <>
      <canvas ref={top} className="ruler ruler-top" onMouseDown={begin('y', null)} />
      <canvas ref={left} className="ruler ruler-left" onMouseDown={begin('x', null)} />
      <div className="ruler-corner" />
      {shown.map(({ g, i }) => line(g, `g${i}`, false, i))}
      {drag && !drag.over && line({ axis: drag.axis, pos: drag.pos }, 'drag', true)}
    </>
  );
}
