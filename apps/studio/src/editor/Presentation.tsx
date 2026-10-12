// Modo Apresentar: percorre as telas como um protótipo clicável. O iframe não tem scripts; quem liga os cliques/passar do mouse às
// interações da camada é o painel. Esc fecha · R reinicia · Alt+← / Alt+→ voltam e avançam.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { exportHtml } from '@stylo/core/css.js';
import { inlineFontFaces } from '@stylo/core/site-export.ts';
import { app, useApp } from '../lib/app';
import { boardsOf, findNode, flatten } from '../lib/doc';
import type { Doc, LayerNode } from '../lib/types';
import { Icon } from '../ui/Icon';

const WIDTHS: [string, string][] = [['auto', 'Desenhada'], ['fill', 'Responsivo'], ['1440', '1440'], ['1280', '1280'], ['1024', '1024'], ['768', '768'], ['390', '390']];
const ANIM: Record<string, Keyframe[]> = {
  dissolve: [{ opacity: 0 }, { opacity: 1 }],
  'slide-left': [{ transform: 'translateX(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
  'slide-right': [{ transform: 'translateX(-40px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
  'slide-up': [{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
  'slide-down': [{ transform: 'translateY(-40px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
};
interface Interaction { trigger: string; action: string; target?: string; transition?: string; url?: string }

function presentHtml(frame: LayerNode, doc: Doc): string {
  const selfHosted = new Set(((doc as unknown as { fonts?: { family: string }[] }).fonts ?? []).map((f) => f.family));
  const html: string = exportHtml(frame, doc.assets || {}, frame.name, doc.styles as never, { ids: true, selfHosted } as never);
  return html.replace('</head>', `<style>${inlineFontFaces(doc)}</style></head>`);
}

export function Presentation() {
  const open = useApp((s) => s.presenting);
  return open ? <Player /> : null;
}

function Player() {
  const doc = useApp((s) => s.doc)!;
  const selection = useApp((s) => s.selection);
  const pageId = useApp((s) => s.pageId);
  const boards = useMemo(() => doc.pages.flatMap((p) => boardsOf(p)), [doc]);
  const all = useMemo(() => doc.pages.flatMap((p) => flatten(p.children)).filter((n) => n.type === 'frame'), [doc]);
  const rootOf = (id: string): LayerNode | null => {
    for (const p of doc.pages) for (const b of boardsOf(p)) if (findNode([b], id)) return b;
    return null;
  };
  const first = useMemo(() => (selection[0] && rootOf(selection[0])) || boards.find((b) => b.flowStart) || boards[0] || null, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [current, setCurrent] = useState<string | null>(first?.id ?? null);
  const [back, setBack] = useState<string[]>([]);
  const [fwd, setFwd] = useState<string[]>([]);
  const [width, setWidth] = useState(first?.fluid ? 'fill' : 'auto');
  const [anim, setAnim] = useState<string>('instant');
  const [size, setSize] = useState({ w: 800, h: 600, k: 1 });
  const [reload, setReload] = useState(0);
  const view = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const frameEl = useRef<HTMLIFrameElement>(null);
  const live = useRef({ doc, all, current, back, fwd });
  live.current = { doc, all, current, back, fwd };
  void pageId;

  const frame = all.find((f) => f.id === current) ?? null;
  const html = useMemo(() => (frame ? presentHtml(frame, doc) : ''), [frame, doc]);
  const close = useCallback(() => app.set({ presenting: false }), []);

  const show = useCallback((id: string, transition = 'instant', push = true) => {
    const cur = live.current.current;
    if (push && cur && cur !== id) { setBack((b) => [...b, cur]); setFwd([]); }
    setCurrent(id); setAnim(transition); setReload((n) => n + 1);
  }, []);
  const goBack = useCallback(() => { const { back: b, current: c } = live.current; const prev = b[b.length - 1]; if (prev) { setBack(b.slice(0, -1)); setFwd((f) => [...f, c!]); setCurrent(prev); setAnim('dissolve'); setReload((n) => n + 1); } }, []);
  const goFwd = useCallback(() => { const { fwd: f, current: c } = live.current; const next = f[f.length - 1]; if (next) { setFwd(f.slice(0, -1)); setBack((b) => [...b, c!]); setCurrent(next); setAnim('dissolve'); setReload((n) => n + 1); } }, []);
  const restart = useCallback(() => { const start = boards.find((b) => b.flowStart) ?? boards[0]; setBack([]); setFwd([]); if (start) { setCurrent(start.id); setAnim('instant'); setReload((n) => n + 1); } }, [boards]);

  const run = useCallback((it: Interaction) => {
    if (it.action === 'url') { if (it.url) window.open(it.url, '_blank', 'noopener'); return; }
    if (it.action === 'back') { goBack(); return; }
    if (it.target && live.current.all.some((f) => f.id === it.target)) show(it.target, it.transition || 'instant');
  }, [goBack, show]);

  // ajusta o tamanho do iframe à janela
  useEffect(() => {
    const fit = () => {
      const vp = view.current;
      if (!vp || !frame) return;
      const availW = Math.max(200, vp.clientWidth - 32), availH = Math.max(200, vp.clientHeight - 32);
      const w = width === 'fill' ? availW : width === 'auto' ? frame.w : Number(width);
      const k = Math.min(1, availW / w);
      setSize({ w, h: Math.round(availH / k), k });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [frame, width]);

  // transição ao trocar de tela
  useEffect(() => {
    const t = ANIM[anim];
    if (t && board.current && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) board.current.animate(t, { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }, [reload, anim]);

  // liga os cliques do protótipo dentro do iframe
  const wire = useCallback(() => {
    const d = frameEl.current?.contentDocument;
    if (!d) return;
    const find = (target: EventTarget | null, kind: string, related?: EventTarget | null): Interaction | null => {
      for (let el = (target as Element | null)?.closest?.('[data-node-id]') ?? null; el; el = el.parentElement?.closest('[data-node-id]') ?? null) {
        if (kind === 'hover' && related && el.contains(related as Node)) return null;
        const node = live.current.all.map((f) => findNode([f], (el as HTMLElement).dataset.nodeId!)).find(Boolean);
        const it = (node?.interactions as Interaction[] | undefined)?.find((i) => i.trigger === kind);
        if (it) return it;
      }
      return null;
    };
    d.querySelectorAll<HTMLElement>('[data-node-id]').forEach((el) => {
      const node = live.current.all.map((f) => findNode([f], el.dataset.nodeId!)).find(Boolean);
      if (node?.interactions?.length) el.style.cursor = 'pointer';
    });
    d.addEventListener('click', (e) => { const it = find(e.target, 'click'); if (it) { e.preventDefault(); run(it); } else if ((e.target as Element).closest?.('a')) e.preventDefault(); });
    d.addEventListener('pointerover', (e) => { const it = find(e.target, 'hover', (e as PointerEvent).relatedTarget); if (it) run(it); });
  }, [run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if ((e.altKey || !typing) && e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
      else if ((e.altKey || !typing) && e.key === 'ArrowRight') { e.preventDefault(); goFwd(); }
      else if (!typing && e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) restart();
      if (e.key !== 'Tab') e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [close, goBack, goFwd, restart]);

  const openTab = () => { if (!frame) return; const url = URL.createObjectURL(new Blob([html], { type: 'text/html' })); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60000); };

  if (!frame) return null;
  const slug = frame.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tela';

  return (
    <div className="present" role="dialog" aria-modal="true" aria-label="Apresentação">
      <div className="present-bar">
        <button className="present-ib" title="Sair da apresentação (Esc)" aria-label="Sair" onClick={close}><Icon name="close" size={16} /></button>
        <button className="present-ib" title="Voltar (Alt+←)" aria-label="Voltar" disabled={!back.length} onClick={goBack}><Icon name="chevron" size={16} /></button>
        <button className="present-ib" title="Avançar (Alt+→)" aria-label="Avançar" disabled={!fwd.length} onClick={goFwd}><Icon name="chevron" size={16} /></button>
        <button className="present-ib" title="Recarregar" aria-label="Recarregar" onClick={() => show(frame.id, 'instant', false)}><Icon name="rotate" size={16} /></button>
        <label className="present-url"><Icon name="lock" size={13} /><span className="faint">stylo.local/</span><span className="present-title">{frame.name}</span><span className="faint present-slug">{slug}</span>
          <select aria-label="Ir para a tela" value={frame.id} onChange={(e) => show(e.target.value, 'dissolve')}>{boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <div className="present-tabs" role="tablist" aria-label="Telas">
          {boards.map((b) => <button key={b.id} role="tab" aria-selected={b.id === frame.id} className={`present-tab${b.id === frame.id ? ' on' : ''}`} onClick={() => show(b.id, 'dissolve')}>{b.name}</button>)}
        </div>
        <div className="present-widths" role="group" aria-label="Largura da janela">
          {WIDTHS.map(([v, l]) => <button key={v} type="button" data-w={v} aria-pressed={width === v} onClick={() => setWidth(v)}>{l}</button>)}
        </div>
        <span className="present-size" aria-live="polite">{Math.round(size.w)} × {size.h}{size.k < 1 ? ` · ${Math.round(size.k * 100)}%` : ''}</span>
        <button className="present-ib" title="Abrir em nova aba do navegador" aria-label="Abrir em nova aba" onClick={openTab}><Icon name="link" size={16} /></button>
      </div>
      <div className="present-viewport" ref={view}>
        <div ref={board} className="present-board" style={{ width: size.w, height: size.h, transform: size.k < 1 ? `scale(${size.k})` : undefined, marginBottom: size.k < 1 ? -Math.round(size.h * (1 - size.k)) : undefined }}>
          <iframe key={`${frame.id}:${reload}`} ref={frameEl} className="present-frame" title={`Tela ${frame.name}`} sandbox="allow-same-origin" srcDoc={html} onLoad={wire} />
        </div>
      </div>
    </div>
  );
}
