// Seletor de cor: quadrado de saturação/brilho, matiz, opacidade, valor em hexadecimal, conta-gotas e as cores do projeto.
// Enquanto se arrasta, só a amostra muda; a mudança vai para o projeto (uma chamada de ferramenta) ao soltar.
import { useApp } from '../lib/app';
import { t } from '../lib/i18n';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from '@stylo/core/color.ts';
import { Icon } from './Icon';
import { Num, Txt } from './Fields';

export interface ColorGroup { title: string; colors: string[] }

const PRESETS = ['#000000', '#FFFFFF', '#111827', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#F3F4F6', '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#D946EF', '#EC4899', '#F43F5E', '#5B5BD6', '#0D99FF'];

const normalize = (v: string): string | null => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return `#${h.toUpperCase()}`;
};
const toHsv = (hex: string) => { const rgb = hexToRgb(hex); return rgb ? rgbToHsv(rgb) : { h: 0, s: 0, v: 0 }; };
const toHex = (h: number, s: number, v: number) => rgbToHex(hsvToRgb({ h, s, v }));

type Drag = (clientX: number, clientY: number, done: boolean) => void;
/** Arrasto dentro de um elemento: chama `fn` a cada movimento (com `done` ao soltar). */
function useDrag(fn: Drag) {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    ref.current(e.clientX, e.clientY, false);
    const move = (ev: MouseEvent) => ref.current(ev.clientX, ev.clientY, false);
    const up = (ev: MouseEvent) => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); ref.current(ev.clientX, ev.clientY, true); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, []);
}

function Picker({ color, opacity, onChange, groups, anchor, onClose }: {
  color: string; opacity: number; onChange: (hex: string, opacity: number) => void; groups: ColorGroup[]; anchor: DOMRect; onClose: () => void;
}) {
  const language = useApp((s) => s.language);
  const [hsv, setHsv] = useState(() => toHsv(color));
  const [alpha, setAlpha] = useState(opacity);
  const box = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const hue = useRef<HTMLDivElement>(null);
  const alp = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: anchor.left, top: anchor.bottom + 6 });
  const hex = toHex(hsv.h, hsv.s, hsv.v);
  const current = useRef({ hex, alpha });
  current.current = { hex, alpha };

  useLayoutEffect(() => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ left: Math.max(8, Math.min(anchor.left - 8, window.innerWidth - r.width - 8)), top: Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - r.height - 8)) });
  }, [anchor]);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('mousedown', away, true);
    window.addEventListener('keydown', esc, true);
    return () => { window.removeEventListener('mousedown', away, true); window.removeEventListener('keydown', esc, true); };
  }, [onClose]);

  const commit = (h = current.current.hex, a = current.current.alpha) => onChange(h, a);
  const frac = (el: HTMLElement | null, x: number, y: number) => { const r = el!.getBoundingClientRect(); return { fx: Math.min(1, Math.max(0, (x - r.left) / r.width)), fy: Math.min(1, Math.max(0, (y - r.top) / r.height)) }; };
  const dragArea = useDrag((x, y, done) => { const { fx, fy } = frac(area.current, x, y); const next = { h: hsv.h, s: fx, v: 1 - fy }; setHsv(next); if (done) commit(toHex(next.h, next.s, next.v)); });
  const dragHue = useDrag((x, _y, done) => { const { fx } = frac(hue.current, x, 0); const next = { ...hsv, h: fx * 360 }; setHsv(next); if (done) commit(toHex(next.h, next.s, next.v)); });
  const dragAlpha = useDrag((x, _y, done) => { const { fx } = frac(alp.current, x, 0); const a = Math.round(fx * 100) / 100; setAlpha(a); if (done) commit(current.current.hex, a); });
  const pick = (c: string) => { const n = normalize(c); if (n) { setHsv(toHsv(n)); commit(n); } };
  const eyedropper = async () => {
    try {
      const Dropper = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
      if (Dropper) pick((await new Dropper().open()).sRGBHex);
    } catch { /* a pessoa cancelou */ }
  };
  const hasDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

  return createPortal(
    <div ref={box} className="colorpop" style={{ left: pos.left, top: pos.top }} role="dialog" aria-label={t(language, 'ui.color.picker')}>
      <div ref={area} className="cp-area" style={{ backgroundColor: toHex(hsv.h, 1, 1) }} onMouseDown={dragArea}>
        <div className="cp-knob" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
      </div>
      <div className="cp-sliders">
        <div className="cp-sliders-col">
          <div ref={hue} className="cp-hue" onMouseDown={dragHue}><div className="cp-thumb" style={{ left: `${(hsv.h / 360) * 100}%` }} /></div>
          <div ref={alp} className="cp-alpha" onMouseDown={dragAlpha}>
            <div className="cp-alpha-fill" style={{ background: `linear-gradient(90deg, transparent, ${hex})` }} />
            <div className="cp-thumb" style={{ left: `${alpha * 100}%` }} />
          </div>
        </div>
        {hasDropper && <button type="button" className="ibtn" title={t(language, 'ui.color.eyedropper')} onClick={() => void eyedropper()}><Icon name="eyedropper" size={16} /></button>}
      </div>
      <div className="cp-inputs">
        <Txt value={hex} mono label={t(language, 'ui.color.hex')} onCommit={(v) => { const n = normalize(v); if (n) pick(n); }} />
        <Num value={Math.round(alpha * 100)} min={0} max={100} decimals={0} unit="%" onCommit={(v) => { const a = (v ?? 100) / 100; setAlpha(a); commit(current.current.hex, a); }} />
      </div>
      {groups.filter((g) => g.colors.length).map((g) => (
        <div key={g.title} className="cp-group">
          <div className="cap"><span>{g.title}</span></div>
          <div className="cp-swatches">{g.colors.map((c, i) => <button key={`${c}${i}`} type="button" className="chip" title={c} style={{ background: c }} onClick={() => pick(c)} />)}</div>
        </div>
      ))}
      <div className="cp-group">
        <div className="cap"><span>{t(language, 'ui.color.palette')}</span></div>
        <div className="cp-swatches">{PRESETS.map((c) => <button key={c} type="button" className="chip" title={c} style={{ background: c }} onClick={() => pick(c)} />)}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Amostra + hexadecimal + opacidade, numa linha; a amostra abre o seletor. */
export function ColorRow({ color, opacity = 1, onChange, groups = [], mixed, hideOpacity, disabled }: {
  color: string; opacity?: number; onChange: (hex: string, opacity: number) => void; groups?: ColorGroup[]; mixed?: boolean; hideOpacity?: boolean; disabled?: boolean;
}) {
  const language = useApp((s) => s.language);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const close = useCallback(() => setAnchor(null), []);
  const valid = normalize(color) ?? '#000000';
  return (
    <div className="colorrow">
      <button type="button" className="swatch-btn" disabled={disabled} aria-label={t(language, 'ui.color.choose')} onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}>
        <span className="swatch-fill" style={{ background: mixed ? 'transparent' : valid, opacity: mixed ? 1 : Math.max(0.15, opacity) }} />
      </button>
      <Txt value={mixed ? '' : valid} mono placeholder={mixed ? t(language, 'ui.color.mixed') : undefined} disabled={disabled} label={t(language, 'ui.color.hexLabel')} onCommit={(v) => { const n = normalize(v); if (n) onChange(n, opacity); }} />
      {!hideOpacity && <Num value={Math.round(opacity * 100)} min={0} max={100} decimals={0} unit="%" disabled={disabled} onCommit={(v) => onChange(valid, (v ?? 100) / 100)} />}
      {anchor && <Picker color={valid} opacity={opacity} groups={groups} anchor={anchor} onClose={close} onChange={onChange} />}
    </div>
  );
}
