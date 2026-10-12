// Uma tela do projeto desenhada num iframe isolado (sem scripts) com o mesmo HTML/CSS da exportação.
// O painel só LÊ o DOM do iframe (posição de cada camada) para desenhar a seleção por cima; nada é alterado ali dentro,
// a não ser o texto durante a edição por duplo clique (que volta ao servidor como uma ferramenta) e as "prévias" do arrasto.
// Os eventos do ponteiro sobem para o canvas, que decide o que cada gesto significa.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { findNode } from '../lib/doc';
import { boardHtml } from '../lib/render';
import { handleShortcut, trackModifiers } from './shortcuts';
import type { Doc, LayerNode } from '../lib/types';

/** Caixa de uma camada dentro da tela (px do iframe): `x/y/w/h` é a caixa visual (com rotação); `ow/oh` o tamanho sem girar. */
export interface Box { x: number; y: number; w: number; h: number; ow: number; oh: number }

export interface BoardPointer {
  type: 'down' | 'move' | 'up' | 'dblclick' | 'context' | 'leave';
  e: MouseEvent;
  /** a camada mais funda sob o ponteiro (ou null no vazio da tela) */
  hitId: string | null;
  boardId: string;
}

interface Props {
  board: LayerNode;
  doc: Doc;
  /** Posição da tela no "mundo" do canvas e largura de exibição (a do breakpoint, em modo responsivo). */
  x: number;
  y: number;
  width: number;
  editable: boolean;
  /** Camada de texto que deve entrar em edição assim que aparecer (acabou de ser criada). */
  pendingEdit: string | null;
  onMeasure: (id: string, size: { w: number; h: number }) => void;
  onPointer: (p: BoardPointer) => void;
  onEditText: (id: string, text: string) => void;
  onEditConsumed: () => void;
  onBoxes: (boardId: string, boxes: Record<string, Box>) => void;
}

// atenção: `instanceof Element` é sempre falso para elementos de OUTRO documento (o iframe tem o seu próprio Element)
const closestNode = (t: EventTarget | null) => (t && typeof (t as Element).closest === 'function' ? (t as Element).closest<HTMLElement>('[data-node-id]') : null);

/** Troca o conteúdo da tela sem recarregar o iframe (sem piscar). Devolve false se a estrutura do <head> mudou e é preciso recarregar. */
function patchDocument(d: Document, html: string): boolean {
  const next = new DOMParser().parseFromString(html, 'text/html');
  const cur = Array.from(d.head.querySelectorAll('style'));
  const nxt = Array.from(next.head.querySelectorAll('style'));
  const links = (x: Document) => Array.from(x.head.querySelectorAll('link')).map((l) => l.getAttribute('href')).join('|');
  if (cur.length !== nxt.length || links(d) !== links(next)) return false;
  nxt.forEach((s, i) => { if (cur[i].textContent !== s.textContent) cur[i].textContent = s.textContent; });
  if (d.body.innerHTML !== next.body.innerHTML) d.body.innerHTML = next.body.innerHTML;
  return true;
}

function BoardFrameImpl({ board, doc, x, y, width, editable, pendingEdit, onMeasure, onPointer, onEditText, onEditConsumed, onBoxes }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(Math.max(40, board.h || 200));
  const [version, setVersion] = useState(0);
  const html = useMemo(() => boardHtml(board, doc), [board, doc]);
  const initialHtml = useRef(html); // o srcDoc só vale para o primeiro desenho; as mudanças entram por patchDocument
  const [reloadKey, setReloadKey] = useState(0);
  const editing = useRef(false);
  const ready = useRef(false);
  const observer = useRef<ResizeObserver | null>(null);

  // os callbacks mudam a cada render do pai; o iframe usa sempre a versão mais nova sem reanexar os ouvintes
  const live = useRef({ doc, board, editable, onPointer, onEditText });
  live.current = { doc, board, editable, onPointer, onEditText };

  const rootOf = (d: Document) => d.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(live.current.board.id)}"]`);

  const measure = useCallback(() => {
    const d = frame.current?.contentDocument;
    const root = d && rootOf(d);
    if (!root) return;
    const r = root.getBoundingClientRect();
    const h = Math.max(1, Math.ceil(r.height));
    setHeight((prev) => (prev === h ? prev : h));
    onMeasure(live.current.board.id, { w: Math.ceil(r.width), h });
    setVersion((v) => v + 1);
  }, [onMeasure]);

  const observe = useCallback(() => {
    const d = frame.current?.contentDocument;
    observer.current?.disconnect();
    if (!d) return;
    observer.current = new ResizeObserver(() => measure());
    observer.current.observe(d.body);
    const root = rootOf(d);
    if (root) observer.current.observe(root);
  }, [measure]);

  const startTextEdit = useCallback((el: HTMLElement, node: LayerNode) => {
    const d = el.ownerDocument;
    const original = String(node.text ?? '');
    editing.current = true;
    el.contentEditable = 'plaintext-only';
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
    el.style.outline = 'none';
    el.style.cursor = 'text';
    el.focus();
    const sel = d.getSelection();
    const range = d.createRange();
    range.selectNodeContents(el);
    sel?.removeAllRanges();
    sel?.addRange(range);
    let done = false;
    const finish = (commit: boolean) => {
      if (done) return;
      done = true;
      editing.current = false;
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('blur', onBlur);
      el.contentEditable = 'false';
      el.style.cursor = '';
      const text = el.innerText.replace(/ /g, ' ').replace(/\n$/, '');
      if (commit && text !== original) live.current.onEditText(node.id, text);
      else el.textContent = original;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
      e.stopPropagation();
    };
    const onBlur = () => finish(true);
    el.addEventListener('keydown', onKey);
    el.addEventListener('blur', onBlur);
  }, []);

  /** Quando o documento do iframe termina de carregar: mede, observa mudanças de tamanho e liga o ponteiro. */
  const onLoad = useCallback(() => {
    const d = frame.current?.contentDocument;
    if (!d) return;
    const send = (type: BoardPointer['type']) => (e: MouseEvent) => {
      if (editing.current && type !== 'move' && type !== 'leave') return; // clicar no texto em edição só move o cursor
      if (type === 'down' && e.button === 0) e.preventDefault(); // sem seleção de texto nem arrastar de imagem
      if (type === 'context') e.preventDefault();
      live.current.onPointer({ type, e, hitId: closestNode(e.target)?.dataset.nodeId ?? null, boardId: live.current.board.id });
    };
    d.addEventListener('mousedown', send('down'));
    d.addEventListener('mousemove', send('move'));
    d.addEventListener('mouseup', send('up'));
    d.addEventListener('contextmenu', send('context'));
    d.addEventListener('mouseleave', send('leave'));
    d.addEventListener('click', (e) => { if (e.target && typeof (e.target as Element).closest === 'function' && (e.target as Element).closest('a')) e.preventDefault(); });
    d.addEventListener('dblclick', (e) => {
      const el = closestNode(e.target);
      const node = el && findNode([live.current.board], el.dataset.nodeId!);
      if (el && node && node.type === 'text' && live.current.editable && !node.locked) { e.preventDefault(); startTextEdit(el, node); return; }
      send('dblclick')(e);
    });
    d.addEventListener('keydown', handleShortcut); // o foco fica dentro da tela depois de um clique
    d.addEventListener('keyup', trackModifiers);
    d.addEventListener('wheel', (e) => {
      // a roda sobre a tela rola/dá zoom no canvas (o iframe não rola sozinho)
      e.preventDefault();
      const fe = d.defaultView?.frameElement as HTMLIFrameElement | null;
      const r = fe?.getBoundingClientRect();
      const k = fe && fe.offsetWidth ? (r!.width / fe.offsetWidth) : 1;
      window.dispatchEvent(new CustomEvent('stylo:wheel', { detail: { dx: e.deltaX, dy: e.deltaY, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, x: (r?.left ?? 0) + e.clientX * k, y: (r?.top ?? 0) + e.clientY * k } }));
    }, { passive: false });
    ready.current = true;
    observe();
    measure();
    d.fonts?.addEventListener?.('loadingdone', measure);
    void d.fonts?.ready?.then(measure);
  }, [measure, observe, startTextEdit]);

  // mudanças do projeto: troca o conteúdo no lugar; só recarrega o iframe se a estrutura do <head> mudou
  useEffect(() => {
    const d = frame.current?.contentDocument;
    if (!ready.current || !d || editing.current) return;
    if (!patchDocument(d, html)) { initialHtml.current = html; ready.current = false; setReloadKey((k) => k + 1); return; }
    observe();
    measure();
  }, [html, observe, measure]);

  // posição de cada camada dentro da tela (para a seleção e o arrasto); recalcula quando algo muda
  useLayoutEffect(() => {
    const d = frame.current?.contentDocument;
    if (!d) return;
    const out: Record<string, Box> = {};
    for (const el of d.querySelectorAll<HTMLElement>('[data-node-id]')) {
      const r = el.getBoundingClientRect();
      out[el.dataset.nodeId!] = { x: r.left, y: r.top, w: r.width, h: r.height, ow: el.offsetWidth || r.width, oh: el.offsetHeight || r.height };
    }
    onBoxes(board.id, out);
  }, [version, html, width, board.id, onBoxes]);

  useEffect(() => { measure(); }, [width, measure]);

  // texto recém-criado: entra direto em edição
  useEffect(() => {
    if (!pendingEdit) return;
    const d = frame.current?.contentDocument;
    const el = d?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(pendingEdit)}"]`);
    const node = findNode([board], pendingEdit);
    if (el && node?.type === 'text') { onEditConsumed(); startTextEdit(el, node); }
  }, [pendingEdit, html, board, onEditConsumed, startTextEdit]);

  useEffect(() => () => observer.current?.disconnect(), []);

  return (
    <iframe
      key={reloadKey}
      ref={frame}
      title={board.name}
      className="board-frame"
      sandbox="allow-same-origin"
      srcDoc={initialHtml.current}
      onLoad={onLoad}
      style={{ left: x, top: y, width, height }}
    />
  );
}

export const BoardFrame = memo(BoardFrameImpl);
