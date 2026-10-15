// Atalhos de teclado do editor (os mesmos do editor antigo). O mesmo tratador vale para a janela e para dentro das telas
// (o foco vai para o iframe ao clicar numa camada).
import { tl } from '../lib/i18n';
import { useEffect } from 'react';
import { canEdit, duplicateSelection, groupSelection, redo, removeSelection, undo, ungroupSelection, uploadImage } from '../lib/actions';
import { getClip } from '../lib/clipboard';
import { arrange, copyCss, copySelection, copyStyle, enterSelection, pasteClipboard, pasteStyle, selectAllSiblings, startRename, stepSelection, toggleFlag } from '../lib/editing';
import { app, DEFAULT_SHORTCUTS, run, select, setRulers, setTool, setZoom, toast, type Tool } from '../lib/app';
import { findNode, inFlow, pageOf, parentOf } from '../lib/doc';
import { createShape } from '../lib/shapes';

// sem `instanceof`: o alvo pode vir de dentro de um iframe, que tem as suas próprias classes
/** Botão, link, caixa de marcar… com foco: Espaço, Enter e Tab são dele (teclado e leitor de tela), não do editor. */
const interactive = (t: EventTarget | null) => { const el = t as HTMLElement | null; return !!el && typeof el.tagName === 'string' && (/^(BUTTON|A|SUMMARY)$/.test(el.tagName) || el.getAttribute?.('role') === 'button' || el.getAttribute?.('role') === 'menuitem'); };
const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (el && typeof el.tagName === 'string' && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return true;
  // Text layers are edited inside a same-origin iframe. Some browsers dispatch
  // the first key with the iframe body as target, so inspect the active element
  // and composed path as well before allowing a global tool shortcut.
  const active = el?.ownerDocument?.activeElement as HTMLElement | null;
  if (active?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active?.tagName || '')) return true;
  const event = t as unknown as Event;
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  return path.some((item) => { const node = item as HTMLElement; return !!node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName || '')); });
};

/** Mantém `altDown` e `spaceDown` em dia (a distância entre camadas e a mão temporária dependem deles). */
export function trackModifiers(e: KeyboardEvent): void {
  const down = e.type === 'keydown';
  if (e.key === 'Alt' && app.get().altDown !== down) app.set({ altDown: down });
  if (e.code === 'Space' && app.get().spaceDown !== down && (!down || !typing(e.target))) app.set({ spaceDown: down });
}

/** Move as camadas soltas com as setas (1 px; com Shift, 10 px). */
let nudging: Promise<void> = Promise.resolve();
/** Uma seta por vez: com a tecla repetindo, cada passo espera o anterior gravar (senão todos partem da mesma posição velha). */
function nudge(dx: number, dy: number): Promise<void> {
  nudging = nudging.then(() => nudgeNow(dx, dy)).catch(() => undefined);
  return nudging;
}
async function nudgeNow(dx: number, dy: number) {
  const s = app.get();
  if (!s.doc || s.device !== 'desktop' || !canEdit()) return;
  const page = pageOf(s.doc, s.pageId);
  const updates = s.selection.flatMap((id) => {
    const n = findNode(page.children, id);
    return n && !n.locked && !inFlow(parentOf(page.children, id), n) ? [{ id, props: { x: Number(n.x || 0) + dx, y: Number(n.y || 0) + dy } }] : [];
  });
  if (updates.length) await run('update_layers', { updates });
}

async function setOpacity(value: number) {
  const ids = app.get().selection;
  if (ids.length && canEdit()) await run('update_layers', { updates: ids.map((id) => ({ id, props: { opacity: value } })) });
}

/** Ctrl+V: o que foi copiado no editor; senão uma imagem ou um texto da área de transferência do sistema. */
async function pasteAnything() {
  if (getClip()) { await pasteClipboard(); return; }
  try {
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (type) { await uploadImage(new File([await item.getType(type)], tl('ui.shortcuts.pastedImage'), { type })); return; }
    }
    const text = (await navigator.clipboard.readText()).trim();
    if (text) await createShape('text', { x: 120, y: 120, w: 0, h: 0 }, null, { x: 0, y: 0 }, true).then(async (id) => { if (id) await run('update_layer', { id, props: { text } }); });
  } catch { toast('error', tl('shortcuts.msg.clipboardDenied')); }
}

const TOOL_KEYS: Record<string, Tool> = { v: 'move', f: 'frame', b: 'frame', r: 'rect', e: 'ellipse', t: 'text', h: 'hand', p: 'pen', l: 'line', n: 'node', c: 'comment', i: 'inspect' };

export function handleShortcut(e: KeyboardEvent): void {
  trackModifiers(e);
  if (typing(e.target) || app.get().screen !== 'editor' || e.type !== 'keydown') return;
  if (app.get().dialog) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  const code = e.code;
  const act = (fn: () => unknown) => { e.preventDefault(); void fn(); };
  const fit = (name: string) => window.dispatchEvent(new Event(name));

  if (e.key === 'Alt') { e.preventDefault(); return; }
  if (code === 'Space') { if (!interactive(e.target)) e.preventDefault(); return; }

  // ---- com Ctrl / ⌘
  if (mod) {
    if (e.altKey) {
      if (code === 'KeyC') return act(copyStyle);
      if (code === 'KeyV') return act(pasteStyle);
      if (code === 'KeyG') return act(() => arrange('wrap_in_frame'));
      if (code === 'KeyK') return act(() => arrange('create_component'));
      if (code === 'KeyB') return act(() => arrange('detach_instance'));
      if (code === 'KeyM') return act(() => arrange('toggle_mask'));
      if (code === 'KeyU') return act(() => arrange('boolean_union'));
      if (code === 'KeyI') return act(() => arrange('boolean_intersect'));
      if (code === 'KeyX') return act(() => arrange('boolean_exclude'));
      if (code === 'KeyS') return act(() => arrange('boolean_subtract'));
      if (code === 'Enter') return act(() => window.dispatchEvent(new Event('stylo:present')));
      return;
    }
    if (key === 'z') return act(e.shiftKey ? redo : undo);
    if (key === 'y') return act(redo);
    if (key === 'd') return act(duplicateSelection);
    if (key === 'a') return act(selectAllSiblings);
    if (key === 'c') return act(e.shiftKey ? copyCss : () => copySelection());
    if (key === 'x') return act(() => copySelection(true));
    if (key === 'v') return act(pasteAnything);
    if (key === 'g') return act(e.shiftKey ? ungroupSelection : groupSelection);
    if (key === 's') return act(() => toast('ok', tl('shortcuts.msg.autosave')));
    if (key === 'r') return act(() => setRulers(!app.get().rulers));
    if (key === '\\') return act(() => window.dispatchEvent(new Event('stylo:panels')));
    if (key === ',') return act(() => window.dispatchEvent(new Event('stylo:settings')));
    if (code === 'BracketRight' || key === ']') return act(() => arrange(e.shiftKey ? 'front' : 'forward'));
    if (code === 'BracketLeft' || key === '[') return act(() => arrange(e.shiftKey ? 'back' : 'backward'));
    if (key === 'l' && e.shiftKey) return act(() => toggleFlag('locked'));
    if (key === 'h' && e.shiftKey) return act(() => toggleFlag('visible'));
    if (key === '0') return act(() => fit('stylo:zoom100'));
    if (key === '=' || key === '+') return act(() => window.dispatchEvent(new Event('stylo:zoom-in')));
    if (key === '-') return act(() => window.dispatchEvent(new Event('stylo:zoom-out')));
    return;
  }

  // ---- números: opacidade (1 = 10% … 9 = 90%, 0 = 100%); com Shift: zoom
  if (/^Digit[0-9]$/.test(code)) {
    const d = Number(code.slice(5));
    if (e.shiftKey) {
      if (d === 1) return act(() => fit('stylo:fit'));
      if (d === 2) return act(() => fit('stylo:fit-selection'));
      if (d === 0) return act(() => fit('stylo:zoom100'));
      return;
    }
    if (!e.altKey) return act(() => setOpacity(d === 0 ? 1 : d / 10));
  }

  // ---- letras com Shift
  if (e.shiftKey && !e.altKey) {
    if (key === 'h') return act(() => arrange('flip_h'));
    if (key === 'v') return act(() => arrange('flip_v'));
    if (key === 'a') return act(() => arrange('toggle_auto_layout'));
    if (key === 's') return act(() => setTool('section'));
    if (key === 'e') return act(() => setTool('html'));
    if (key === 'p') return act(() => setTool('move'));
    if (key === 'tab') return act(() => stepSelection(true));
    if (key === 'enter') return act(() => enterSelection(true));
  }

  if (e.altKey) return;
  if (key === 'delete' || key === 'backspace') return act(removeSelection);
  if (key === 'escape') return act(() => { if (app.get().tool !== 'move') setTool('move'); else select([]); });
  if ((key === 'tab' || key === 'enter') && interactive(e.target)) return; // o foco está num botão: deixa o navegador ativar/navegar
  if (key === 'tab') return act(() => stepSelection(false));
  if (key === 'enter') return act(() => enterSelection(false));
  if (key === 'f2') return act(() => { const id = app.get().selection[0]; if (id) startRename(id); });
  if (key === '?') return act(() => window.dispatchEvent(new Event('stylo:help')));
  const step = e.shiftKey ? 10 : 1;
  if (key === 'arrowleft') return act(() => nudge(-step, 0));
  if (key === 'arrowright') return act(() => nudge(step, 0));
  if (key === 'arrowup') return act(() => nudge(0, -step));
  if (key === 'arrowdown') return act(() => nudge(0, step));
  if (!e.shiftKey) {
    const shortcuts = { ...DEFAULT_SHORTCUTS, ...(app.get().user?.preferences?.shortcuts || {}) };
    const action = Object.keys(shortcuts).find((name) => shortcuts[name].toLowerCase() === key);
    if (action && action in TOOL_KEYS) return act(() => setTool(TOOL_KEYS[action]));
    if (TOOL_KEYS[key]) return act(() => setTool(TOOL_KEYS[key]));
  }
}

export function useShortcuts() {
  useEffect(() => {
    const clearKeys = () => app.set({ altDown: false, spaceDown: false });
    window.addEventListener('keydown', handleShortcut);
    window.addEventListener('keyup', trackModifiers);
    window.addEventListener('blur', clearKeys);
    const present = () => app.set({ presenting: true });
    window.addEventListener('stylo:present', present);
    return () => { window.removeEventListener('keydown', handleShortcut); window.removeEventListener('keyup', trackModifiers); window.removeEventListener('blur', clearKeys); window.removeEventListener('stylo:present', present); };
  }, []);
}
