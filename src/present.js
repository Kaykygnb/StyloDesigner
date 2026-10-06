// Modo Apresentar: roda o protótipo em tela cheia usando o mesmo CSS do editor.
import { nodeStyle, pathSvg, toCssText } from './css.js';
import { walk } from './model.js';

const TRANSITIONS = {
  instant: null,
  dissolve: { enter: [{ opacity: 0 }, { opacity: 1 }], leave: null },
  'slide-left': { enter: [{ transform: 'translateX(100%)' }, { transform: 'none' }], leave: [{ transform: 'none' }, { transform: 'translateX(-30%)' }] },
  'slide-right': { enter: [{ transform: 'translateX(-100%)' }, { transform: 'none' }], leave: [{ transform: 'none' }, { transform: 'translateX(30%)' }] },
  'slide-up': { enter: [{ transform: 'translateY(100%)' }, { transform: 'none' }], leave: [{ transform: 'none' }, { transform: 'translateY(-30%)' }] },
  'slide-down': { enter: [{ transform: 'translateY(-100%)' }, { transform: 'none' }], leave: [{ transform: 'none' }, { transform: 'translateY(30%)' }] },
};
export const TRANSITION_OPTIONS = [
  ['instant', 'Instantâneo'], ['dissolve', 'Dissolver'], ['slide-left', 'Deslizar ← (entra pela direita)'],
  ['slide-right', 'Deslizar → (entra pela esquerda)'], ['slide-up', 'Deslizar ↑'], ['slide-down', 'Deslizar ↓'],
];

/** Constrói o DOM de um frame raiz a partir do modelo (com data-id para achar as interações). */
function buildDom(node, parent, assets, isRoot) {
  const el = document.createElement('div');
  el.dataset.id = node.id;
  el.style.cssText = toCssText(nodeStyle(node, parent, assets, { root: isRoot }));
  if (node.interactions?.length) el.style.cursor = 'pointer';
  if (node.type === 'text') el.textContent = node.text;
  else if (node.type === 'path') el.innerHTML = pathSvg(node, assets);
  else node.children?.forEach((c) => c.visible && el.append(buildDom(c, node, assets, false)));
  return el;
}

export function createPresent({ store, canvas }) {
  let root = null;
  let stack = [];
  let current = null;
  let busy = false;

  const frames = () => {
    const out = [];
    for (const p of store.state.doc.pages) walk(p.children, (n) => { if (n.type === 'frame') out.push(n); return n.type === 'frame'; });
    return out;
  };
  const findFrame = (id) => frames().find((f) => f.id === id);
  const rootOf = (id) => {
    let n = store.get(id);
    while (n && store.parentOf(n.id)) n = store.parentOf(n.id);
    return n;
  };

  function fit(board) {
    const f = findFrame(board.dataset.board);
    const k = Math.min(innerWidth / f.w, innerHeight / f.h, 2);
    board.style.transform = `scale(${k})`;
    return k;
  }

  function makeBoard(frame) {
    const wrap = document.createElement('div');
    wrap.className = 'present-board';
    wrap.dataset.board = frame.id;
    wrap.style.width = `${frame.w}px`;
    wrap.style.height = `${frame.h}px`;
    const dom = buildDom(frame, null, store.state.doc.assets, true);
    dom.style.overflow = frame.clip ? 'hidden' : 'visible';
    wrap.append(dom);
    wrap.addEventListener('click', (e) => trigger(e.target, 'click'));
    wrap.addEventListener('pointerover', (e) => {
      if (e.target === e.relatedTarget) return;
      trigger(e.target, 'hover', e.relatedTarget);
    });
    return wrap;
  }

  /** Procura (subindo na árvore) a primeira camada com uma interação do tipo pedido. */
  function trigger(target, kind, related) {
    for (let el = target.closest?.('[data-id]'); el; el = el.parentElement?.closest('[data-id]')) {
      if (kind === 'hover' && related && el.contains(related)) return; // ainda dentro do mesmo elemento
      const node = store.get(el.dataset.id);
      const it = node?.interactions?.find((i) => i.trigger === kind);
      if (it) { run(it); return; }
    }
  }

  function run(it) {
    if (busy) return;
    if (it.action === 'url') { if (it.url) window.open(it.url, '_blank', 'noopener'); return; }
    if (it.action === 'back') {
      const prev = stack.pop();
      if (prev) show(prev, 'dissolve', true);
      return;
    }
    const target = findFrame(it.target);
    if (target) show(target.id, it.transition || 'instant');
  }

  function show(frameId, transition, isBack = false) {
    const frame = findFrame(frameId);
    if (!frame) return;
    const stage = root.querySelector('.present-stage');
    const board = makeBoard(frame);
    fit(board);
    const old = current ? stage.querySelector(`[data-board="${current}"]`) : null;
    if (current && !isBack && current !== frameId) stack.push(current);
    current = frameId;
    root.querySelector('.present-title').textContent = frame.name;
    stage.append(board);
    const t = TRANSITIONS[transition];
    if (!old) return;
    if (!t) { old.remove(); return; }
    busy = true;
    const k = fit(board);
    const tf = (x) => (x && x !== 'none' ? `${x} scale(${k})` : `scale(${k})`);
    const opts = { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' };
    if (t.enter) board.animate(t.enter.map((f) => ({ ...f, transform: tf(f.transform) })), opts);
    if (t.leave) old.animate(t.leave.map((f) => ({ ...f, transform: tf(f.transform) })), { ...opts, fill: 'forwards' });
    setTimeout(() => { old.remove(); busy = false; }, 330);
  }

  function open(startId) {
    close();
    const list = frames().filter((f) => !store.parentOf(f.id));
    const start =
      (startId && rootOf(startId)) ||
      list.find((f) => f.flowStart) ||
      list[0];
    if (!start) return false;
    stack = [];
    current = null;
    root = document.createElement('div');
    root.className = 'present';
    root.innerHTML = `<div class="present-bar"><strong class="present-title"></strong><span class="present-hint">Esc sai · R reinicia</span><button class="btn" data-act="restart" type="button">Reiniciar</button><button class="btn" data-act="close" type="button">Fechar</button></div><div class="present-stage"></div>`;
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'close') close();
      if (act === 'restart') { stack = []; root.querySelector('.present-stage').replaceChildren(); current = null; show(start.id, 'instant'); }
    });
    document.body.append(root);
    show(start.id, 'instant');
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    return true;
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
      e.stopPropagation();
      stack = [];
      const start = rootOf(current);
      root.querySelector('.present-stage').replaceChildren();
      current = null;
      show(start.id, 'instant');
    } else e.stopPropagation();
  }
  function onResize() {
    root?.querySelectorAll('.present-board').forEach(fit);
  }

  function close() {
    if (!root) return;
    root.remove();
    root = null;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
  }

  void canvas;
  return { open, close, isOpen: () => !!root };
}
