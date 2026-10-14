// Menu de botão direito: aparece onde o ponteiro está, anda por teclado (↑ ↓ Home End Enter Esc) e fecha ao clicar fora.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { app, useApp } from '../lib/app';
import { Icon } from './Icon';

export type MenuItem =
  | 'sep'
  | { label: string; hint?: string; icon?: string; disabled?: boolean; danger?: boolean; checked?: boolean; onClick: () => void };

export interface MenuState { x: number; y: number; items: MenuItem[] }

export function showMenu(items: MenuItem[], x: number, y: number) { app.set({ menu: { x, y, items } }); }
export const closeMenu = () => { if (app.get().menu) app.set({ menu: null }); };

export function MenuHost() {
  const menu = useApp((s) => s.menu);
  return menu ? <Menu key={`${menu.x}:${menu.y}`} menu={menu} /> : null;
}

function Menu({ menu }: { menu: MenuState }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: menu.x, top: menu.y, ready: false });

  // não deixa o menu sair da janela
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(6, Math.min(menu.x, window.innerWidth - r.width - 6));
    const top = Math.max(6, Math.min(menu.y, window.innerHeight - r.height - 6));
    setPos({ left, top, ready: true });
    el.querySelector<HTMLElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [menu]);

  useEffect(() => {
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) closeMenu(); };
    const close = () => closeMenu();
    window.addEventListener('mousedown', away, true);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    window.addEventListener('wheel', close, { passive: true });
    return () => {
      window.removeEventListener('mousedown', away, true);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('wheel', close);
    };
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    const list = Array.from(box.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? []);
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); return; }
    const go = ({ ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: list.length - 1 } as Record<string, number>)[e.key];
    if (go === undefined || !list.length) return;
    e.preventDefault();
    e.stopPropagation();
    list[(go + list.length) % list.length].focus();
  };

  return createPortal(
    <div ref={box} className="ctx-menu" role="menu" style={{ left: pos.left, top: pos.top, visibility: pos.ready ? 'visible' : 'hidden' }} onKeyDown={onKey} onContextMenu={(e) => e.preventDefault()}>
      {menu.items.map((it, i) => it === 'sep'
        ? <div key={i} className="ctx-sep" role="separator" />
        : (
          <button key={i} role="menuitem" className={`ctx-item${it.danger ? ' danger' : ''}`} disabled={it.disabled}
            onClick={() => { closeMenu(); it.onClick(); }}>
            <span className="ctx-icon">{it.checked ? <Icon name="check" size={14} /> : it.icon ? <Icon name={it.icon} size={14} /> : null}</span>
            <span className="ctx-label">{it.label}</span>
            {it.hint && <span className="ctx-hint">{it.hint}</span>}
          </button>
        ))}
    </div>,
    document.body,
  );
}
