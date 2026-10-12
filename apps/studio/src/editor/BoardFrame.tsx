// Uma tela do projeto desenhada num iframe isolado (sem scripts) com o mesmo HTML/CSS da exportação.
// O painel só LÊ o DOM do iframe (posição de cada camada) para desenhar a seleção por cima; nada é alterado ali dentro,
// a não ser o texto durante a edição por duplo clique (que volta ao servidor como uma ferramenta).
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { findNode } from '../lib/doc';
import { handleShortcut } from './shortcuts';
import { boardHtml } from '../lib/render';
import type { Doc, LayerNode } from '../lib/types';

export interface Box { x: number; y: number; w: number; h: number }

interface Props {
  board: LayerNode;
  doc: Doc;
  /** Posição da tela no "mundo" do canvas e largura de exibição (a do breakpoint, em modo responsivo). */
  x: number;
  y: number;
  width: number;
  selection: string[];
  editable: boolean;
  onMeasure: (id: string, size: { w: number; h: number }) => void;
  onPick: (id: string, additive: boolean) => void;
  onHover: (id: string | null) => void;
  onEditText: (id: string, text: string) => void;
  /** O ponteiro foi apertado sobre uma camada selecionada: o canvas pode iniciar um arrasto. */
  onPressSelected: (id: string, e: MouseEvent) => void;
  onBoxes: (boardId: string, boxes: Record<string, Box>) => void;
}

function BoardFrameImpl({ board, doc, x, y, width, selection, editable, onMeasure, onPick, onHover, onEditText, onPressSelected, onBoxes }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(Math.max(40, board.h || 200));
  const [version, setVersion] = useState(0);
  const html = useMemo(() => boardHtml(board, doc), [board, doc]);

  // os callbacks mudam a cada render do pai; o iframe usa sempre a versão mais nova sem reanexar os ouvintes
  const live = useRef({ doc, board, editable, selection, onPick, onHover, onEditText, onPressSelected });
  live.current = { doc, board, editable, selection, onPick, onHover, onEditText, onPressSelected };

  const rootOf = (d: Document) => d.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(live.current.board.id)}"]`);

  const measure = useCallback(() => {
    const d = frame.current?.contentDocument;
    const root = d && rootOf(d);
    if (!root) return;
    const h = Math.max(1, Math.ceil(root.getBoundingClientRect().height));
    setHeight((prev) => (prev === h ? prev : h));
    onMeasure(live.current.board.id, { w: Math.ceil(root.getBoundingClientRect().width), h });
    setVersion((v) => v + 1);
  }, [onMeasure]);

  const startTextEdit = useCallback((el: HTMLElement, node: LayerNode) => {
    const d = el.ownerDocument;
    const original = String(node.text ?? '');
    el.contentEditable = 'true';
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

  /** Quando o documento do iframe termina de carregar: mede, observa mudanças de tamanho e liga a seleção. */
  const onLoad = useCallback(() => {
    const d = frame.current?.contentDocument;
    if (!d) return;
    // atenção: `instanceof Element` é sempre falso para elementos de OUTRO documento (o iframe tem o seu próprio Element)
    const closest = (t: EventTarget | null) => (t && typeof (t as Element).closest === 'function' ? (t as Element).closest<HTMLElement>('[data-node-id]') : null);
    const idOf = (t: EventTarget | null) => closest(t)?.dataset.nodeId ?? null;
    d.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const id = idOf(e.target);
      if (!id) return;
      e.preventDefault();
      if (e.shiftKey) { live.current.onPick(id, true); return; }
      if (!live.current.selection.includes(id)) live.current.onPick(id, false);
      live.current.onPressSelected(id, e); // pode virar um arrasto
    });
    d.addEventListener('click', (e) => { if (e.target && typeof (e.target as Element).closest === 'function' && (e.target as Element).closest('a')) e.preventDefault(); });
    d.addEventListener('dblclick', (e) => {
      const el = closest(e.target);
      const node = el && findNode([live.current.board], el.dataset.nodeId!);
      if (el && node && node.type === 'text' && live.current.editable) { e.preventDefault(); startTextEdit(el, node); }
    });
    d.addEventListener('keydown', handleShortcut); // o foco fica dentro da tela depois de um clique
    d.addEventListener('mousemove', (e) => live.current.onHover(idOf(e.target)));
    d.addEventListener('mouseleave', () => live.current.onHover(null));
    const root = rootOf(d);
    if (root) new ResizeObserver(() => measure()).observe(root);
    measure();
  }, [measure, startTextEdit]);

  // posição de cada camada dentro da tela (para a seleção e o arrasto); recalcula quando algo muda
  useLayoutEffect(() => {
    const d = frame.current?.contentDocument;
    if (!d) return;
    const out: Record<string, Box> = {};
    for (const el of d.querySelectorAll<HTMLElement>('[data-node-id]')) {
      const r = el.getBoundingClientRect();
      out[el.dataset.nodeId!] = { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    onBoxes(board.id, out);
  }, [version, html, width, board.id, onBoxes]);

  useEffect(() => { measure(); }, [width, measure]);

  return (
    <iframe
      ref={frame}
      title={board.name}
      className="board-frame"
      sandbox="allow-same-origin"
      srcDoc={html}
      onLoad={onLoad}
      style={{ left: x, top: y, width, height }}
    />
  );
}

export const BoardFrame = memo(BoardFrameImpl);
