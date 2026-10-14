// Um menu simples que abre ao clicar e fecha ao clicar fora ou apertar Esc.
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Popover({ trigger, children, align = 'right', label }: { trigger: ReactNode; children: ReactNode | ((close: () => void) => ReactNode); align?: 'left' | 'right'; label: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="popover" ref={box}>
      <button className={`btn ghost${open ? ' active' : ''}`} aria-haspopup="true" aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen(!open)}>{trigger}</button>
      {open && <div className={`popover-card ${align}`} role="menu">{typeof children === 'function' ? children(() => setOpen(false)) : children}</div>}
    </div>
  );
}
