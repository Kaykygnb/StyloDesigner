/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  present.js — MODO APRESENTAR (PROTÓTIPO EM TELA CHEIA)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Executa as interações definidas na aba Protótipo (clicar/passar o mouse → navegar, voltar, abrir link)
 *  com transições. Reaproveita css.js, então a apresentação tem exatamente a aparência do design.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { nodeStyle, pathSvg, toCssText } from './css.js';
import { hasStates, isBoard, stateView, walk } from './model.js';

/**
 * Transições entre telas no modo Apresentar. Cada uma tem `enter` (animação da tela que ENTRA) e `leave`
 * (da que SAI), no formato de keyframes da Web Animations API. 'instant' = null (troca seca).
 * Os transforms são combinados com o `scale` de encaixe na tela em show().
 */
const TRANSITIONS = {
  instant: null,
  dissolve: { enter: [{ opacity: 0 }, { opacity: 1 }], leave: null },
  'slide-left': { enter: [{ transform: 'translateX(100%)' }, { transform: 'none' }], leave: [{ transform: 'none' }, { transform: 'translateX(-30%)' }] },
  'slide-right': { enter: [{ transform: 'translateX(-100%)' }, { transform: 'none' }], leave: [{ transform: 'none' }, { transform: 'translateX(30%)' }] },
  'slide-up': { enter: [{ transform: 'translateY(100%)' }, { transform: 'none' }], leave: [{ transform: 'none' }, { transform: 'translateY(-30%)' }] },
  'slide-down': { enter: [{ transform: 'translateY(-100%)' }, { transform: 'none' }], leave: [{ transform: 'none' }, { transform: 'translateY(30%)' }] },
};
/** Lista [valor, rótulo] das transições, para o menu da aba Protótipo. */
export const TRANSITION_OPTIONS = [
  ['instant', 'Instantâneo'], ['dissolve', 'Dissolver'], ['slide-left', 'Deslizar ← (entra pela direita)'],
  ['slide-right', 'Deslizar → (entra pela esquerda)'], ['slide-up', 'Deslizar ↑'], ['slide-down', 'Deslizar ↓'],
];

/**
 * Liga os ESTADOS (hover, pressionado, foco) de uma camada ao elemento da apresentação: ao entrar/sair/pressionar,
 * troca o estilo inline pelo da visão correspondente (o `transition` do próprio estilo anima a troca). Pressionado vale
 * em cima do hover, como a cascata do CSS.
 */
function attachStates(el, node, parent, assets, isRoot) {
  if (!hasStates(node)) return;
  const css = (states) => toCssText(nodeStyle(stateView(node, states), parent, assets, { root: isRoot }));
  const keep = el.style.cursor; // o cursor de "tem interação" sobrevive às trocas
  let hover = false, down = false, focus = false;
  const apply = () => {
    const list = [];
    if (hover && hasStates(node, 'hover')) list.push('hover');
    if (focus && hasStates(node, 'focus')) list.push('focus');
    if (down && hasStates(node, 'active')) list.push('active');
    el.style.cssText = css(list);
    if (keep) el.style.cursor = keep;
    // vetor: preenchimento e contorno moram DENTRO do <svg>, então o desenho precisa ser refeito para o estado
    if (node.type === 'path') el.innerHTML = pathSvg(stateView(node, list), assets);
  };
  el.addEventListener('pointerenter', () => { hover = true; apply(); });
  el.addEventListener('pointerleave', () => { hover = false; down = false; apply(); });
  el.addEventListener('pointerdown', () => { down = true; apply(); });
  el.addEventListener('pointerup', () => { if (down) { down = false; apply(); } });
  if (hasStates(node, 'focus')) {
    el.tabIndex = 0;
    el.addEventListener('focus', () => { focus = true; apply(); });
    el.addEventListener('blur', () => { focus = false; apply(); });
  }
}

/**
 * Monta o DOM de um frame para apresentação a partir do MODELO (não copia o canvas do editor). Usa o MESMO
 * `nodeStyle` do editor, então a apresentação é idêntica ao design. Camadas com interação ganham cursor de mão;
 * `data-id` permite achar a camada (e suas interações) no clique.
 */
function buildDom(node, parent, assets, isRoot) {
  const el = document.createElement('div');
  el.dataset.id = node.id;
  el.style.cssText = toCssText(nodeStyle(node, parent, assets, { root: isRoot }));
  if (node.interactions?.length) el.style.cursor = 'pointer';
  attachStates(el, node, parent, assets, isRoot);
  if (node.type === 'text') el.textContent = node.text;
  else if (node.type === 'path') el.innerHTML = pathSvg(node, assets);
  else node.children?.forEach((c) => c.visible && el.append(buildDom(c, node, assets, false)));
  return el;
}

/**
 * Cria o modo APRESENTAR (protótipo em tela cheia).
 *  - open(id): abre no frame da camada selecionada (ou no marcado como ponto de partida, ou no primeiro)
 *  - cliques/hover disparam as interações da camada (ou do ancestral mais próximo que tenha uma)
 *  - `stack` guarda o histórico de telas visitadas, para a ação "Voltar"
 *  - Esc fecha · R reinicia
 */
export function createPresent({ store, canvas }) {
  // root: container da apresentação (null = fechada) · stack: telas já visitadas (para Voltar) · current: id da tela atual
  let root = null;
  let stack = [];
  let current = null;
  // busy: uma transição está rolando (ignora cliques até acabar, para não empilhar animações)
  let busy = false;

  /** Todos os frames do documento (de todas as páginas) — destinos possíveis das interações. */
  const frames = () => {
    const out = [];
    for (const p of store.state.doc.pages) walk(p.children, (n) => { if (n.type === 'frame') out.push(n); return n.type === 'frame' || n.type === 'section'; });
    return out;
  };
  /** Frame pelo id. */
  const findFrame = (id) => frames().find((f) => f.id === id);
  /** Frame da raiz que contém a camada (sobe os pais). */
  const rootOf = (id) => {
    let n = store.get(id);
    while (n && !isBoard(n, store.parentOf(n.id)) && store.parentOf(n.id)) n = store.parentOf(n.id);
    return n;
  };

  /** Escala a tela para caber na janela (até 200%), centralizada. Devolve o fator usado. */
  function fit(board) {
    const f = findFrame(board.dataset.board);
    const k = Math.min(innerWidth / f.w, innerHeight / f.h, 2);
    board.style.transform = `scale(${k})`;
    return k;
  }

  /** Cria o "quadro" de uma tela: caixa do tamanho do frame + DOM + ouvintes de clique e hover. */
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

  /**
   * Dispara a interação do tipo pedido ('click' | 'hover'). Sobe da camada clicada até um ancestral que tenha uma
   * interação desse tipo (assim clicar no texto dentro de um botão aciona o botão). No hover, ignora movimentos
   * dentro do mesmo elemento (só vale ao ENTRAR).
   */
  function trigger(target, kind, related) {
    for (let el = target.closest?.('[data-id]'); el; el = el.parentElement?.closest('[data-id]')) {
      if (kind === 'hover' && related && el.contains(related)) return; // ainda dentro do mesmo elemento
      const node = store.get(el.dataset.id);
      const it = node?.interactions?.find((i) => i.trigger === kind);
      if (it) { run(it); return; }
    }
  }

  /** Executa uma interação: abrir link, voltar para a tela anterior ou navegar para outro frame (com a transição escolhida). */
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

  /**
   * Mostra uma tela, animando a troca. A tela antiga fica por baixo durante a transição e é removida ao final;
   * `busy` bloqueia novos cliques nesse intervalo (330ms ≈ duração 320ms).
   * @param {string} frameId  frame a mostrar
   * @param {string} transition  chave de TRANSITIONS
   * @param {boolean} [isBack]  true quando vem de "Voltar" (não empilha no histórico)
   */
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

  /** Abre a apresentação. Devolve false se não há nenhum frame para apresentar. */
  function open(startId) {
    close();
    const list = frames().filter((f) => isBoard(f, store.parentOf(f.id)));
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

  /** Teclas na apresentação (captura antes do editor): Esc fecha, R reinicia; as outras são engolidas para não mexer no editor por trás. */
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
  /** Reencaixa as telas quando a janela muda de tamanho. */
  function onResize() {
    root?.querySelectorAll('.present-board').forEach(fit);
  }

  /** Fecha a apresentação e remove os ouvintes globais. */
  function close() {
    if (!root) return;
    root.remove();
    root = null;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
  }

  void canvas;
  // API pública
  return { open, close, isOpen: () => !!root };
}
