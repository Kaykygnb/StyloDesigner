// Campos do painel de propriedades. Cada um mostra o valor atual e só "confirma" (chama onCommit) ao sair do campo, apertar Enter
// ou escolher: assim cada mudança vira UMA chamada de ferramenta, não uma por tecla digitada.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Section({ title, children, open = true, right }: { title: string; children: ReactNode; open?: boolean; right?: ReactNode }) {
  const [isOpen, setOpen] = useState(open);
  return (
    <section className="insp-section">
      <header onClick={() => setOpen(!isOpen)}>
        <Icon name={isOpen ? 'chevrondown' : 'chevron'} size={14} />
        <h4>{title}</h4>
        <span className="spacer" />
        {right && <span onClick={(e) => e.stopPropagation()}>{right}</span>}
      </header>
      {isOpen && <div className="insp-body">{children}</div>}
    </section>
  );
}

export function Labeled({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`labeled${wide ? ' wide' : ''}`}>
      <span className="faint">{label}</span>
      {children}
    </label>
  );
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

export function NumField({ label, value, onCommit, min, max, step = 1, disabled, suffix, placeholder }: {
  label: string; value: number | undefined; onCommit: (v: number) => void; min?: number; max?: number; step?: number; disabled?: boolean; suffix?: string; placeholder?: string;
}) {
  const [draft, setDraft] = useState<string>(value === undefined ? '' : fmt(value));
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(value === undefined ? '' : fmt(value)); }, [value]);
  const commit = (text: string) => {
    editing.current = false;
    const n = Number(text.replace(',', '.'));
    if (text.trim() === '' || !Number.isFinite(n)) { setDraft(value === undefined ? '' : fmt(value)); return; }
    const v = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    setDraft(fmt(v));
    if (v !== value) onCommit(v);
  };
  return (
    <label className="num">
      <span className="faint">{label}</span>
      <input
        className="field" inputMode="decimal" value={draft} disabled={disabled} placeholder={placeholder}
        onFocus={(e) => { editing.current = true; e.currentTarget.select(); }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.currentTarget.blur(); }
          else if (e.key === 'Escape') { editing.current = false; setDraft(value === undefined ? '' : fmt(value)); e.currentTarget.blur(); }
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const base = Number(draft.replace(',', '.'));
            const next = (Number.isFinite(base) ? base : 0) + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            setDraft(fmt(next));
          }
        }}
      />
      {suffix && <span className="suffix faint">{suffix}</span>}
    </label>
  );
}

export function TextField({ value, onCommit, placeholder, multiline, disabled }: { value: string; onCommit: (v: string) => void; placeholder?: string; multiline?: boolean; disabled?: boolean }) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(value); }, [value]);
  const common = {
    className: 'field', value: draft, disabled, placeholder,
    onFocus: () => { editing.current = true; },
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: () => { editing.current = false; if (draft !== value) onCommit(draft); },
  };
  return multiline
    ? <textarea {...common} rows={3} />
    : <input {...common} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(value); e.currentTarget.blur(); } }} />;
}

export function SelectField({ value, options, onCommit, disabled }: { value: string; options: { value: string; label: string }[]; onCommit: (v: string) => void; disabled?: boolean }) {
  const known = options.some((o) => o.value === value);
  return (
    <select className="field" value={value} disabled={disabled} onChange={(e) => onCommit(e.target.value)}>
      {!known && <option value={value}>{value || '—'}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Segmented<T extends string>({ value, options, onCommit, disabled }: { value: T | undefined; options: { value: T; label: ReactNode; title?: string }[]; onCommit: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" title={o.title} disabled={disabled} className={value === o.value ? 'on' : ''} onClick={() => onCommit(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

export function ColorField({ value, onCommit, onClear, disabled }: { value: string | undefined; onCommit: (hex: string) => void; onClear?: () => void; disabled?: boolean }) {
  const [draft, setDraft] = useState(value ?? '');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => setDraft(value ?? ''), [value]);
  const push = (hex: string) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { if (HEX.test(hex) && hex.toLowerCase() !== (value ?? '').toLowerCase()) onCommit(hex.toUpperCase()); }, 250); };
  return (
    <div className="colorfield">
      <input type="color" disabled={disabled} value={HEX.test(draft) ? draft : '#000000'} onChange={(e) => { setDraft(e.target.value); push(e.target.value); }} aria-label="Escolher cor" />
      <input
        className="field" value={draft} placeholder="Sem cor" disabled={disabled} spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (HEX.test(draft)) { if (draft.toLowerCase() !== (value ?? '').toLowerCase()) onCommit(draft.toUpperCase()); } else setDraft(value ?? ''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
      {onClear && value && <button type="button" className="btn ghost icon sm" title="Remover" onClick={onClear} disabled={disabled}><Icon name="close" size={14} /></button>}
    </div>
  );
}
