/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  present.js — MODO APRESENTAR (O DESIGN NUM NAVEGADOR DE VERDADE)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Cada tela é o HTML + CSS EXPORTADOS (css.js → exportHtml) dentro de um <iframe>: rolagem, :hover, :focus,
 *  sticky, @media e fontes funcionam como num site publicado. Por cima, uma barra de navegador: voltar/avançar,
 *  recarregar, endereço com a lista de telas, larguras (desenhada, responsiva ou fixas) e "abrir em nova aba".
 *  As interações da aba Protótipo (clicar/passar o mouse → navegar, voltar, link) são ligadas dentro do iframe
 *  pelo atributo data-node-id. Enquanto aberta, a apresentação se atualiza sozinha quando o documento muda.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { exportHtml } from './css.js';
import { isBoard, slugify, walk } from './model.js';

/** Transições entre telas (Web Animations no quadro do iframe). 'instant' = troca seca. */
const TRANSITIONS = {
  instant: null,
  dissolve: [{ opacity: 0 }, { opacity: 1 }],
  'slide-left': [{ translate: '40% 0', opacity: 0 }, { translate: '0 0', opacity: 1 }],
  'slide-right': [{ translate: '-40% 0', opacity: 0 }, { translate: '0 0', opacity: 1 }],
  'slide-up': [{ translate: '0 40%', opacity: 0 }, { translate: '0 0', opacity: 1 }],
  'slide-down': [{ translate: '0 -40%', opacity: 0 }, { translate: '0 0', opacity: 1 }],
};
/** Lista [valor, rótulo] das transições, para o menu da aba Protótipo. */
export const TRANSITION_OPTIONS = [
  ['instant', 'Instantâneo'], ['dissolve', 'Dissolver'], ['slide-left', 'Deslizar ← (entra pela direita)'],
  ['slide-right', 'Deslizar → (entra pela esquerda)'], ['slide-up', 'Deslizar ↑'], ['slide-down', 'Deslizar ↓'],
];
/** Larguras da barra: [valor, rótulo]. 'auto' = largura desenhada da tela; 'fill' = a janela toda (responsivo). */
export const PRESENT_WIDTHS = [['auto', 'Desenhada'], ['fill', 'Responsivo'], ['1440', '1440'], ['1280', '1280'], ['1024', '1024'], ['768', '768'], ['390', '390']];

/**
 * HTML de uma tela para a apresentação: o mesmo da exportação, com `data-node-id` em cada elemento e o corpo
 * sem a moldura cinza da exportação (a página ocupa a janela, como um site).
 */
export function presentHtml(frame, doc) {
  const html = exportHtml(frame, doc.assets, frame.name, doc.styles, { ids: true });
  return html.replace('body { display: grid; place-items: start center; padding: 24px; background: #f3f3f5; }',
    'body { min-height: 100vh; background: #fff; }\nbody > * { margin-inline: auto; }');
}

const ICONS = {
  close: '<path d="M6 6l12 12M18 6L6 18"/>', back: '<path d="M15 6l-6 6 6 6"/>', fwd: '<path d="M9 6l6 6-6 6"/>',
  reload: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
};
const svg = (k, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

/**
 * Cria o modo APRESENTAR.
 *  - open(id): abre na tela da camada selecionada (ou na marcada como ponto de partida, ou na primeira)
 *  - Esc fecha · R reinicia · Alt+← / Alt+→ voltam e avançam
 */
export function createPresent({ store }) {
  // current: id da tela aberta · back/fwd: histórico · width: largura escolhida · busy: transição em curso
  let root = null, current = null, back = [], fwd = [], width = 'auto', unsub = null, timer = 0, busy = false;

  const doc = () => store.state.doc;
  /** Todos os frames do documento (de todas as páginas): destinos possíveis das interações. */
  const frames = () => {
    const out = [];
    for (const p of doc().pages) walk(p.children, (n) => { if (n.type === 'frame') out.push(n); return n.type === 'frame' || n.type === 'section'; });
    return out;
  };
  const boards = () => frames().filter((f) => isBoard(f, store.parentOf(f.id)));
  const findFrame = (id) => frames().find((f) => f.id === id);
  /** Tela (frame raiz) que contém a camada. */
  const rootOf = (id) => {
    let n = store.get(id);
    while (n && !isBoard(n, store.parentOf(n.id)) && store.parentOf(n.id)) n = store.parentOf(n.id);
    return n?.type === 'frame' ? n : null;
  };
  const q = (sel) => root.querySelector(sel);

  /** Largura do iframe e escala para caber no espaço disponível. */
  function layout() {
    if (!root || !current) return;
    const frame = findFrame(current);
    const vp = q('.present-viewport');
    const board = q('.present-board');
    if (!frame || !board) return;
    const availW = Math.max(200, vp.clientWidth - 32), availH = Math.max(200, vp.clientHeight - 32);
    const w = width === 'fill' ? availW : width === 'auto' ? frame.w : Number(width);
    const k = Math.min(1, availW / w);
    board.style.width = `${w}px`;
    board.style.height = `${Math.round(availH / k)}px`;
    board.style.transform = k < 1 ? `scale(${k})` : '';
    board.style.marginBottom = k < 1 ? `${Math.round(availH / k - availH) * -1}px` : '';
    q('.present-size').textContent = `${Math.round(w)} × ${Math.round(availH / k)}${k < 1 ? ` · ${Math.round(k * 100)}%` : ''}`;
    root.querySelectorAll('[data-w]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.w === width)));
  }

  /** Liga as interações do protótipo dentro do documento do iframe. */
  function wire(frameEl) {
    const d = frameEl.contentDocument;
    if (!d) return;
    const find = (target, kind, related) => {
      for (let el = target?.closest?.('[data-node-id]'); el; el = el.parentElement?.closest('[data-node-id]')) {
        if (kind === 'hover' && related && el.contains(related)) return null;
        const it = store.get(el.dataset.nodeId)?.interactions?.find((i) => i.trigger === kind);
        if (it) return it;
      }
      return null;
    };
    d.querySelectorAll('[data-node-id]').forEach((el) => { if (store.get(el.dataset.nodeId)?.interactions?.length) el.style.cursor = 'pointer'; });
    d.addEventListener('click', (e) => { const it = find(e.target, 'click'); if (it) { e.preventDefault(); run(it); } });
    d.addEventListener('pointerover', (e) => { const it = find(e.target, 'hover', e.relatedTarget); if (it) run(it); });
    d.addEventListener('keydown', onKey, true);
  }

  /** Executa uma interação: link externo, voltar, ou navegar para outra tela. */
  function run(it) {
    if (busy) return;
    if (it.action === 'url') { if (it.url) window.open(it.url, '_blank', 'noopener'); return; }
    if (it.action === 'back') { goBack(); return; }
    if (findFrame(it.target)) show(it.target, it.transition || 'instant');
  }

  /** Monta o iframe da tela. `push` = entra no histórico (navegação normal). */
  function show(frameId, transition = 'instant', push = true) {
    const frame = findFrame(frameId);
    if (!frame) return;
    if (push && current && current !== frameId) { back.push(current); fwd = []; }
    current = frameId;
    const board = document.createElement('div');
    board.className = 'present-board';
    board.dataset.board = frame.id;
    const iframe = document.createElement('iframe');
    iframe.className = 'present-frame';
    iframe.title = `Tela ${frame.name}`;
    iframe.addEventListener('load', () => wire(iframe));
    iframe.srcdoc = presentHtml(frame, doc());
    board.append(iframe);
    q('.present-viewport').replaceChildren(board);
    q('.present-title').textContent = frame.name;
    q('.present-path').textContent = slugify(frame.name) || 'tela';
    q('.present-pages').value = frame.id;
    q('[data-act="back"]').disabled = !back.length;
    q('[data-act="fwd"]').disabled = !fwd.length;
    layout();
    const t = TRANSITIONS[transition];
    if (t) {
      busy = true;
      board.animate(t, { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished.finally(() => { busy = false; });
    }
  }

  function goBack() { const prev = back.pop(); if (prev) { fwd.push(current); show(prev, 'dissolve', false); } }
  function goFwd() { const next = fwd.pop(); if (next) { back.push(current); show(next, 'dissolve', false); } }
  function restart() {
    const start = boards().find((f) => f.flowStart) || rootOf(current) || boards()[0];
    back = []; fwd = []; current = null;
    if (start) show(start.id);
  }

  /** Abre numa aba nova do navegador a tela atual, como página HTML independente. */
  function openTab() {
    const frame = findFrame(current);
    if (!frame) return;
    const url = URL.createObjectURL(new Blob([presentHtml(frame, doc())], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  /** Abre a apresentação. Devolve false se não há nenhuma tela. */
  function open(startId) {
    close();
    const list = boards();
    const first = (startId && rootOf(startId)) || list.find((f) => f.flowStart) || list[0];
    if (!first) return false;
    back = []; fwd = []; current = null;
    width = first.fluid ? 'fill' : 'auto';
    root = document.createElement('div');
    root.className = 'present';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Apresentação');
    const btn = (act, label, icon) => `<button type="button" class="present-ib" data-act="${act}" aria-label="${label}" title="${label}">${svg(icon)}</button>`;
    root.innerHTML = `<div class="present-bar">
      ${btn('close', 'Sair da apresentação (Esc)', 'close')}${btn('back', 'Voltar (Alt+←)', 'back')}${btn('fwd', 'Avançar (Alt+→)', 'fwd')}${btn('reload', 'Recarregar', 'reload')}
      <label class="present-url">${svg('lock', 13)}<span class="present-host">stylo.local/</span><span class="present-path"></span>
        <select class="present-pages" aria-label="Ir para a tela"></select></label>
      <strong class="present-title" hidden></strong>
      <div class="present-widths" role="group" aria-label="Largura da janela">${PRESENT_WIDTHS.map(([v, l]) => `<button type="button" data-w="${v}" aria-pressed="false">${l}</button>`).join('')}</div>
      <span class="present-size" aria-live="polite"></span>
      ${btn('tab', 'Abrir em nova aba do navegador', 'ext')}
    </div><div class="present-viewport"></div>`;
    const pages = q('.present-pages');
    list.forEach((f) => { const o = document.createElement('option'); o.value = f.id; o.textContent = f.name; pages.append(o); });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.w) { width = b.dataset.w; layout(); return; }
      ({ close, back: goBack, fwd: goFwd, reload: () => show(current, 'instant', false), tab: openTab })[b.dataset.act]?.();
    });
    pages.addEventListener('change', (e) => show(e.target.value, 'dissolve'));
    document.body.append(root);
    show(first.id);
    q('[data-act="close"]').focus();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', layout);
    // o documento mudou (outra pessoa ou um agente editando): recarrega a tela atual, sem mexer no histórico
    unsub = store.subscribe((reasons) => {
      const has = (r) => (reasons?.has ? reasons.has(r) : reasons?.includes?.(r));
      if (!has('doc')) return;
      clearTimeout(timer);
      timer = setTimeout(() => { if (root && findFrame(current)) show(current, 'instant', false); }, 250);
    });
    return true;
  }

  /** Teclas (captura antes do editor). As demais são engolidas para não mexer no editor por trás. */
  function onKey(e) {
    if (!root) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
    else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goFwd(); }
    else if (!typing && e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) restart();
    if (e.currentTarget === window && e.key !== 'Tab') e.stopPropagation();
  }

  /** Fecha a apresentação e remove os ouvintes globais. */
  function close() {
    if (!root) return;
    root.remove();
    root = null;
    unsub?.(); unsub = null; clearTimeout(timer);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', layout);
  }

  return { open, close, isOpen: () => !!root };
}
