// Escolher a fonte: busca pelo nome entre as do sistema, as hospedadas no projeto e as do Google Fonts.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GOOGLE, SYSTEM_FONTS } from '@stylo/core/fonts.ts';
import { Icon } from './Icon';

interface Entry { name: string; group: string }

export function FontPicker({ value, onChange, projectFonts = [], disabled }: { value: string; onChange: (family: string) => void; projectFonts?: string[]; disabled?: boolean }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  return (
    <>
      <button type="button" className="font-btn field" disabled={disabled} title="Fonte" aria-label={`Fonte: ${value}`} onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}>
        <span className="ellipsis" style={{ fontFamily: `'${value}', system-ui` }}>{value || 'Fonte'}</span><Icon name="chevrondown" size={13} />
      </button>
      {anchor && <Popup anchor={anchor} value={value} projectFonts={projectFonts} onPick={(f) => { setAnchor(null); onChange(f); }} onClose={() => setAnchor(null)} />}
    </>
  );
}

function Popup({ anchor, value, projectFonts, onPick, onClose }: { anchor: DOMRect; value: string; projectFonts: string[]; onPick: (f: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: anchor.left, top: anchor.bottom + 4 });
  const all = useMemo<Entry[]>(() => [
    ...projectFonts.map((name) => ({ name, group: 'Neste projeto' })),
    ...SYSTEM_FONTS.map((name) => ({ name, group: 'Do sistema' })),
    ...Array.from(GOOGLE.keys()).map((name) => ({ name, group: 'Google Fonts' })),
  ], [projectFonts]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term ? all.filter((e) => e.name.toLowerCase().includes(term)) : all;
    return list.slice(0, 160);
  }, [all, q]);

  useLayoutEffect(() => {
    const r = box.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.max(8, Math.min(anchor.left, window.innerWidth - r.width - 8)), top: Math.max(8, Math.min(anchor.bottom + 4, window.innerHeight - r.height - 8)) });
  }, [anchor]);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('mousedown', away, true);
    window.addEventListener('keydown', esc, true);
    return () => { window.removeEventListener('mousedown', away, true); window.removeEventListener('keydown', esc, true); };
  }, [onClose]);

  let last = '';
  return createPortal(
    <div ref={box} className="fontpop" style={{ left: pos.left, top: pos.top, minWidth: Math.max(240, anchor.width) }} role="listbox" aria-label="Fontes">
      <div className="search"><Icon name="search" size={14} /><input autoFocus className="field" placeholder="Buscar fonte…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && shown[0]) onPick(shown[0].name); }} /></div>
      <div className="font-list">
        {shown.map((e) => {
          const head = e.group !== last ? <div className="cap font-group"><span>{e.group}</span></div> : null;
          last = e.group;
          return (
            <div key={`${e.group}${e.name}`}>
              {head}
              <button type="button" role="option" aria-selected={e.name === value} className={`font-item${e.name === value ? ' on' : ''}`} onClick={() => onPick(e.name)}>{e.name}</button>
            </div>
          );
        })}
        {!shown.length && <p className="muted small pad">Nenhuma fonte com esse nome. Qualquer família instalada no seu computador também funciona: digite o nome e aperte Enter.</p>}
        {!shown.length && q.trim() && <button type="button" className="font-item" onClick={() => onPick(q.trim())}>Usar “{q.trim()}”</button>}
      </div>
    </div>,
    document.body,
  );
}
