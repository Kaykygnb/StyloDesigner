// Atalhos de teclado do editor. O mesmo tratador vale para a janela e para dentro das telas (o foco vai para o iframe ao clicar numa camada).
import { useEffect } from 'react';
import { canEdit, duplicateSelection, groupSelection, insert, redo, removeSelection, undo, ungroupSelection } from '../lib/actions';
import { app, run, select, setZoom } from '../lib/app';
import { findNode, inFlow, pageOf, parentOf } from '../lib/doc';

// sem `instanceof`: o alvo pode vir de dentro de um iframe, que tem as suas próprias classes
const typing = (t: EventTarget | null) => { const el = t as HTMLElement | null; return !!el && typeof el.tagName === 'string' && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); };

/** Move as camadas soltas com as setas (1 px; com Shift, 10 px). */
async function nudge(dx: number, dy: number) {
  const s = app.get();
  if (!s.doc || s.device !== 'desktop' || !canEdit()) return;
  const page = pageOf(s.doc, s.pageId);
  const updates = s.selection.flatMap((id) => {
    const n = findNode(page.children, id);
    return n && !n.locked && !inFlow(parentOf(page.children, id), n) ? [{ id, props: { x: n.x + dx, y: n.y + dy } }] : [];
  });
  if (updates.length) await run('update_layers', { updates });
}

export function handleShortcut(e: KeyboardEvent): void {
  if (typing(e.target) || app.get().screen !== 'editor') return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  const act = (fn: () => unknown) => { e.preventDefault(); void fn(); };

  if (mod && key === 'z') return act(e.shiftKey ? redo : undo);
  if (mod && key === 'y') return act(redo);
  if (mod && key === 'd') return act(duplicateSelection);
  if (mod && key === 'g') return act(e.shiftKey ? ungroupSelection : groupSelection);
  if (mod && key === '0') return act(() => window.dispatchEvent(new Event('stylo:fit')));
  if (mod && (key === '=' || key === '+')) return act(() => setZoom(app.get().zoom * 1.2));
  if (mod && key === '-') return act(() => setZoom(app.get().zoom / 1.2));
  if (mod) return;
  if (key === 'delete' || key === 'backspace') return act(removeSelection);
  if (key === 'escape') return act(() => select([]));
  const step = e.shiftKey ? 10 : 1;
  if (key === 'arrowleft') return act(() => nudge(-step, 0));
  if (key === 'arrowright') return act(() => nudge(step, 0));
  if (key === 'arrowup') return act(() => nudge(0, -step));
  if (key === 'arrowdown') return act(() => nudge(0, step));
  if (key === 't') return act(() => insert('text'));
  if (key === 'r') return act(() => insert('rect'));
  if (key === 'o') return act(() => insert('ellipse'));
  if (key === 'f') return act(() => insert('frame'));
  if (key === 'l') return act(() => insert('line'));
}

export function useShortcuts() {
  useEffect(() => {
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);
}
