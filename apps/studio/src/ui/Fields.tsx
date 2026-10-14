// Campos do painel de propriedades. Cada um mostra o valor atual e só "confirma" (chama onCommit/onChange) ao sair do campo,
// apertar Enter ou escolher: assim cada mudança vira UMA chamada de ferramenta, não uma por tecla digitada.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

// ---------------------------------------------------------------- estrutura
function readOpen(id: string, fallback: boolean): boolean {
  try { const v = localStorage.getItem(`stylo.sec.${id}`); return v == null ? fallback : v === '1'; } catch { return fallback; }
}

/** Seção recolhível do painel; lembra se estava aberta. `right` = botões à direita do título. */
export function Section({ id, title, children, right, defaultOpen = true, badge }: { id: string; title: string; children: ReactNode; right?: ReactNode; defaultOpen?: boolean; badge?: ReactNode }) {
  const [open, setOpen] = useState(() => readOpen(id, defaultOpen));
  const toggle = () => { setOpen(!open); try { localStorage.setItem(`stylo.sec.${id}`, open ? '0' : '1'); } catch { /* sem armazenamento */ } };
  return (
    <section className={`insp-section${open ? '' : ' closed'}`} data-section={id}>
      <header onClick={toggle}>
        <h4>{title}</h4>
        {badge}
        <span className="spacer" />
        {right && <span className="sec-right" onClick={(e) => e.stopPropagation()}>{right}</span>}
        <span className="chev"><Icon name={open ? 'chevrondown' : 'chevron'} size={14} /></span>
      </header>
      {open && <div className="insp-body">{children}</div>}
    </section>
  );
}

export const Row = ({ children, wide }: { children: ReactNode; wide?: boolean }) => <div className={`frow${wide ? ' wide' : ''}`}>{children}</div>;

/** Legenda de um grupo de campos, com o nome da propriedade CSS correspondente ao lado (em fonte mono). */
export function Cap({ label, css, children, right, tip }: { label: string; css?: string; children: ReactNode; right?: ReactNode; tip?: string }) {
  return (
    <div className="cap-group" title={tip}>
      <div className="cap"><span>{label}</span><span className="cap-right">{css && <span className="cap-css">{css}</span>}{right}</span></div>
      {children}
    </div>
  );
}

export const Hint = ({ children, warn }: { children: ReactNode; warn?: boolean }) => <p className={`hint${warn ? ' warn' : ''}`}>{children}</p>;

export function IconBtn({ icon, title, onClick, on, disabled, size = 14, label }: { icon: string; title: string; onClick: () => void; on?: boolean; disabled?: boolean; size?: number; label?: string }) {
  return (
    <button type="button" className={`ibtn${on ? ' on' : ''}`} title={title} aria-label={title} aria-pressed={on} disabled={disabled} onClick={onClick}>
      <Icon name={icon} size={size} />{label}
    </button>
  );
}

// ---------------------------------------------------------------- números
/** Conta simples ("100/3", "24+8", "50%"): só números e + − × ÷ ( ). Devolve null se não entender. */
export function evalExpr(text: string, base = 0): number | null {
  const src = text.replace(/\s+/g, '').replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/');
  if (!src || !/^[0-9+\-*/().%]+$/.test(src)) return null;
  let i = 0;
  const peek = () => src[i];
  const number = (): number => {
    if (peek() === '(') { i++; const v = sum(); if (peek() === ')') i++; return v; }
    const m = /^\d*\.?\d+|^\d+\.?/.exec(src.slice(i));
    if (!m) throw new Error('x');
    i += m[0].length;
    let v = Number(m[0]);
    if (peek() === '%') { i++; v = (base * v) / 100; }
    return v;
  };
  const unary = (): number => { if (peek() === '-') { i++; return -unary(); } if (peek() === '+') { i++; return unary(); } return number(); };
  const product = (): number => { let v = unary(); while (peek() === '*' || peek() === '/') { const op = src[i++]; const r = unary(); v = op === '*' ? v * r : v / r; } return v; };
  const sum = (): number => { let v = product(); while (peek() === '+' || peek() === '-') { const op = src[i++]; const r = product(); v = op === '+' ? v + r : v - r; } return v; };
  try { const v = sum(); return i === src.length && Number.isFinite(v) ? v : null; } catch { return null; }
}

const fmt = (n: number, decimals: number) => String(Number(n.toFixed(decimals)));

export interface NumProps {
  label?: string;
  value: number | null | undefined;
  onCommit: (v: number | null) => void;
  min?: number; max?: number; step?: number; decimals?: number;
  unit?: string; nullable?: boolean; placeholder?: string; disabled?: boolean; title?: string; mixed?: boolean;
}

/** Campo numérico: digitar (aceita contas), setas ↑↓ (Shift ×10, Alt ÷10) e arrastar o rótulo para a esquerda/direita. */
export function Num({ label, value, onCommit, min, max, step = 1, decimals = 1, unit, nullable, placeholder, disabled, title, mixed }: NumProps) {
  const shown = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? '' : fmt(v, decimals));
  const [draft, setDraft] = useState(shown(value));
  const editing = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!editing.current) setDraft(mixed ? '' : shown(value)); }, [value, mixed, decimals]); // eslint-disable-line react-hooks/exhaustive-deps
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));

  const commit = (text: string) => {
    editing.current = false;
    if (!text.trim()) { if (nullable) onCommit(null); setDraft(shown(value)); return; }
    const n = evalExpr(text, value ?? 0);
    if (n == null) { setDraft(shown(value)); return; }
    const c = clamp(n);
    setDraft(shown(c));
    if (c !== value) onCommit(c);
  };

  // arrastar o rótulo
  const scrub = (e: React.MouseEvent) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    const start = e.clientX;
    const base = value ?? 0;
    let moved = false, cur = base;
    const move = (ev: MouseEvent) => {
      const d = ev.clientX - start;
      if (!moved && Math.abs(d) < 2) return;
      moved = true;
      const mult = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
      cur = clamp(Number((base + d * step * mult).toFixed(decimals)));
      editing.current = true;
      setDraft(shown(cur));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.classList.remove('scrubbing');
      editing.current = false;
      if (moved && cur !== base) onCommit(cur); else input.current?.focus();
    };
    document.body.classList.add('scrubbing');
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className={`num${disabled ? ' disabled' : ''}`} title={title}>
      {label != null && <span className="num-label" onMouseDown={scrub}>{label}</span>}
      <input
        ref={input} className="field" inputMode="decimal" value={draft} disabled={disabled}
        placeholder={mixed ? 'Misto' : placeholder}
        onFocus={(e) => { editing.current = true; e.target.select(); }}
        onChange={(e) => { editing.current = true; setDraft(e.target.value); }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { commit(draft); input.current?.blur(); }
          else if (e.key === 'Escape') { editing.current = false; setDraft(shown(value)); input.current?.blur(); }
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const dir = e.key === 'ArrowUp' ? 1 : -1;
            const cur = evalExpr(draft, value ?? 0) ?? value ?? 0;
            const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
            const next = clamp(Number((cur + dir * step * mult).toFixed(decimals)));
            editing.current = true;
            setDraft(shown(next));
            onCommit(next);
            editing.current = false;
          }
        }}
      />
      {unit && <span className="num-unit">{unit}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- escolhas
export type Option = [string | number, string];

export function Sel({ value, options, onChange, title, disabled, mixed, label }: { value: string | number | null | undefined; options: Option[]; onChange: (v: string) => void; title?: string; disabled?: boolean; mixed?: boolean; label?: string }) {
  return (
    <div className="sel" title={title}>
      {label && <span className="num-label">{label}</span>}
      <select className="field" value={mixed ? '__mixed' : String(value ?? '')} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label={title}>
        {mixed && <option value="__mixed" disabled>Misto</option>}
        {options.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
      </select>
    </div>
  );
}

export function Seg({ options, value, onChange, title, disabled }: { options: { value: string; icon?: string; label?: string; title?: string }[]; value: string | null | undefined; onChange: (v: string) => void; title?: string; disabled?: boolean }) {
  return (
    <div className="segmented wide" role="group" aria-label={title}>
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? 'on' : ''} aria-pressed={value === o.value} title={o.title ?? o.label} disabled={disabled} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={15} />}{o.label}
        </button>
      ))}
    </div>
  );
}

export function Check({ label, checked, onChange, title, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; title?: string; disabled?: boolean }) {
  return (
    <label className={`check${disabled ? ' disabled' : ''}`} title={title}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

// ---------------------------------------------------------------- texto
export function Txt({ value, onCommit, placeholder, mono, disabled, label }: { value: string; onCommit: (v: string) => void; placeholder?: string; mono?: boolean; disabled?: boolean; label?: string }) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(value); }, [value]);
  const commit = () => { editing.current = false; if (draft !== value) onCommit(draft); };
  return (
    <input
      className={`field${mono ? ' mono' : ''}`} value={draft} placeholder={placeholder} disabled={disabled} aria-label={label}
      onFocus={() => { editing.current = true; }} onChange={(e) => { editing.current = true; setDraft(e.target.value); }} onBlur={commit}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { editing.current = false; setDraft(value); (e.target as HTMLInputElement).blur(); } }}
    />
  );
}

export function Area({ value, onCommit, rows = 4, placeholder, mono, label }: { value: string; onCommit: (v: string) => void; rows?: number; placeholder?: string; mono?: boolean; label?: string }) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(value); }, [value]);
  return (
    <textarea
      className={`field${mono ? ' mono' : ''}`} rows={rows} value={draft} placeholder={placeholder} spellCheck={false} aria-label={label}
      onFocus={() => { editing.current = true; }} onChange={(e) => { editing.current = true; setDraft(e.target.value); }}
      onBlur={() => { editing.current = false; if (draft !== value) onCommit(draft); }}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { editing.current = false; setDraft(value); (e.target as HTMLTextAreaElement).blur(); } }}
    />
  );
}
