/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  canvas.js — DESENHA O DOCUMENTO EM HTML/CSS + PAN, ZOOM E GEOMETRIA
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Cada camada vira um <div> real, estilizado pelo CSS que css.js gera. Por isso flexbox, grid, sombras,
 *  gradientes e blur funcionam "de graça": quem renderiza é o motor do navegador, não código nosso.
 *
 *  Este módulo é a ÚNICA ponte entre o modelo (dados) e o DOM. Quando precisamos saber "onde a camada está
 *  de verdade" (ex.: dentro de um auto layout), lemos do DOM aqui, em vez de recalcular layout na mão.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { nodeStyle, pathSvg, toCssText } from './css.js';
import { round, stateView } from './model.js';

/** Limites do zoom: 2% (para ver pranchas enormes) até 6400% (para conferir pixels). */
const MIN_ZOOM = 0.02;
const MAX_ZOOM = 64;

/**
 * Cria o CANVAS: transforma as camadas do documento em elementos HTML reais dentro do `viewport`.
 *
 * Estrutura do DOM:
 *   .viewport  (a janela visível: recorta, recebe mouse/teclado, desenha o fundo pontilhado)
 *     ├─ .world   (um "mundo" gigante; recebe translate+scale para fazer pan e zoom)
 *     │    └─ .node  um <div> por camada, estilizado por css.js → nodeStyle (CSS de verdade!)
 *     └─ .overlay (seleção, alças, guias — criado por overlay.js, em pixels de TELA, fora do zoom)
 *
 * Também oferece a GEOMETRIA: onde cada camada está no mundo (lida do DOM, porque em auto layout quem decide a
 * posição é o navegador, não o modelo), conversões tela↔mundo, zoom ancorado no cursor e "ajustar à tela".
 *
 * @param {object} store  o store do app
 * @param {HTMLElement} viewport  elemento que vira a janela do canvas
 */
export function createCanvas(store, viewport) {
  // atalho para o estado de interface
  const ui = store.ui;
  // o "mundo": todos os elementos das camadas moram aqui dentro; pan/zoom = transform neste único elemento
  const world = document.createElement('div');
  world.className = 'world';
  viewport.prepend(world);
  // els: id da camada → elemento DOM. `alive`: ids vistos no render atual (o resto é removido).
  const els = new Map();
  let alive = new Set();

  // ------------------------------------------------------------------ vista (pan/zoom)
  /**
   * Vista (pan/zoom) da página atual: { x, y, zoom }. x/y = deslocamento do mundo em px de tela.
   * Cada página lembra a sua. `fresh: true` marca "nunca foi ajustada" — o app então faz "ajustar tudo" sozinho.
   */
  const getView = () => (ui.views[ui.pageId] ||= { x: 120, y: 120, zoom: 1, fresh: true });

  /** Aplica a vista ao DOM: transforma o mundo e faz o fundo pontilhado acompanhar (some quando o zoom é muito baixo). */
  function applyView() {
    const v = getView();
    world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
    // grade de pontos que acompanha o zoom
    const g = 24 * v.zoom;
    viewport.style.backgroundSize = `${g}px ${g}px`;
    viewport.style.backgroundPosition = `${v.x}px ${v.y}px`;
    viewport.style.setProperty('--dot-alpha', v.zoom < 0.4 ? '0' : '1');
  }

  /** Atualiza parte da vista ({x, y, zoom}), limitando o zoom ao intervalo permitido, e avisa o app ('view'). */
  function setView(patch) {
    const v = getView();
    delete v.fresh;
    Object.assign(v, patch);
    v.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom));
    applyView();
    store.emit('view');
  }

  /**
   * Muda o zoom MANTENDO O PONTO (cx, cy) parado na tela — é o que faz o zoom "ir para onde o mouse está".
   * Matemática: queremos que o ponto do mundo sob o cursor continue sob o cursor, então deslocamos x/y na proporção da mudança.
   * @param {number} newZoom  zoom desejado (1 = 100%)
   * @param {number} cx  x do ponto fixo, em px relativos ao viewport
   * @param {number} cy  y do ponto fixo
   */
  function zoomAt(newZoom, cx, cy) {
    const v = getView();
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
    setView({ zoom: z, x: cx - ((cx - v.x) * z) / v.zoom, y: cy - ((cy - v.y) * z) / v.zoom });
  }

  /** Retângulo do viewport na tela (px da janela do navegador). */
  const vpRect = () => viewport.getBoundingClientRect();
  /** Converte um ponto da TELA (clientX/clientY de um evento) para coordenadas do MUNDO (as do documento). */
  const toWorld = (clientX, clientY) => {
    const r = vpRect();
    const v = getView();
    return { x: (clientX - r.left - v.x) / v.zoom, y: (clientY - r.top - v.y) / v.zoom };
  };
  /** Converte coordenadas do MUNDO para px relativos ao viewport (o oposto de toWorld). */
  const toScreen = (wx, wy) => {
    const v = getView();
    return { x: wx * v.zoom + v.x, y: wy * v.zoom + v.y };
  };

  // ------------------------------------------------------------------ geometria
  /**
   * Origem (canto superior esquerdo, sem rotação) da camada em coordenadas do mundo.
   * Soma offsetLeft/offsetTop subindo a cadeia de pais posicionados — esses valores ignoram transform, então
   * não são afetados por rotação/zoom. É por LER o DOM (e não o modelo) que isso também funciona em flex/grid.
   */
  function originOf(id) {
    const el = els.get(id);
    if (!el) return { x: 0, y: 0 };
    let x = 0, y = 0;
    for (let e = el; e && e !== world; e = e.offsetParent) {
      x += e.offsetLeft;
      y += e.offsetTop;
    }
    return { x, y };
  }

  /** Algum ancestral está rotacionado? (Nesse caso a soma de offsets deixa de valer e usamos o retângulo envolvente.) */
  const ancestorRotated = (id) => {
    for (let p = store.parentOf(id); p; p = store.parentOf(p.id)) if (p.rotation) return true;
    return false;
  };

  /**
   * Caixa da camada no mundo: { x, y, w, h, cx, cy, rot } — centro, tamanho e a rotação PRÓPRIA da camada.
   * É o que o overlay usa para desenhar a seleção girada. Se um ancestral está girado, devolve o retângulo
   * envolvente com rot=0 (simplificação aceita).
   */
  function worldBox(id) {
    const el = els.get(id);
    const node = store.get(id);
    if (!el || !node) return null;
    if (ancestorRotated(id)) {
      const b = aabb(id);
      return { x: b.x, y: b.y, w: b.w, h: b.h, cx: b.x + b.w / 2, cy: b.y + b.h / 2, rot: 0 };
    }
    const o = originOf(id);
    const w = el.offsetWidth, h = el.offsetHeight;
    return { x: o.x, y: o.y, w, h, cx: o.x + w / 2, cy: o.y + h / 2, rot: node.rotation || 0 };
  }

  /**
   * AABB = retângulo envolvente alinhado aos eixos (considera rotação), em coordenadas do mundo.
   * Calculado com getBoundingClientRect, que já inclui qualquer transform. Usado em snap, alinhar, marquee e medidas.
   */
  function aabb(id) {
    const el = els.get(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const a = toWorld(r.left, r.top);
    const b = toWorld(r.right, r.bottom);
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  }

  /** Menor retângulo que envolve as AABBs de várias camadas (ou null se nenhuma existir). */
  function unionAabb(ids) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of ids) {
      const b = aabb(id);
      if (!b) continue;
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
    }
    return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /** Rola a vista só o necessário para a camada ficar visível (com 60px de folga), sem mexer no zoom. Usado pelo Tab. */
  function ensureVisible(id) {
    const b = aabb(id);
    if (!b) return;
    const r = vpRect();
    const v = getView();
    const m = 60;
    const x0 = b.x * v.zoom + v.x, x1 = (b.x + b.w) * v.zoom + v.x;
    const y0 = b.y * v.zoom + v.y, y1 = (b.y + b.h) * v.zoom + v.y;
    let dx = 0, dy = 0;
    if (x0 < m) dx = m - x0; else if (x1 > r.width - m) dx = r.width - m - x1;
    if (y0 < m) dy = m - y0; else if (y1 > r.height - m) dy = r.height - m - y1;
    if (dx || dy) setView({ x: v.x + dx, y: v.y + dy });
  }

  /**
   * "Ajustar à tela": enquadra as camadas dadas (ou todas, se vazio) no centro do viewport.
   * @param {string[]} [ids]  camadas a enquadrar; vazio/null = todas as da página
   * @param {{maxZoom?: number, padding?: number}} [opts]  zoom máximo (padrão 200%) e margem em px
   */
  function fit(ids, { maxZoom = 2, padding = 80 } = {}) {
    const all = ids?.length ? ids : store.page().children.map((n) => n.id);
    const box = unionAabb(all);
    const r = vpRect();
    if (!box || !box.w || !box.h) {
      setView({ zoom: 1, x: r.width / 2, y: r.height / 2 });
      return;
    }
    const z = Math.min(maxZoom, (r.width - padding * 2) / box.w, (r.height - padding * 2) / box.h);
    setView({
      zoom: z,
      x: r.width / 2 - (box.x + box.w / 2) * z,
      y: r.height / 2 - (box.y + box.h / 2) * z,
    });
  }

  // ------------------------------------------------------------------ renderização
  /**
   * Sincroniza UMA camada (e, recursivamente, os filhos) com o DOM: cria o elemento se não existe, atualiza o
   * estilo, o texto e a posição na lista de irmãos. É um "diff" simples: só toca no DOM quando algo mudou
   * (comparamos o CSS novo com o último aplicado, guardado em `el._css` — ler `style.cssText` seria caro).
   * @param {object} node  a camada
   * @param {object|null} parent  o pai (decide se é item de flex/grid)
   * @param {HTMLElement} parentEl  elemento DOM do pai
   * @param {number} index  posição desejada entre os irmãos (a ordem do array é a ordem z)
   */
  function syncNode(node, parent, parentEl, index) {
    // marca como "ainda existe": o que não for marcado neste render é removido do DOM em render()
    alive.add(node.id);
    let el = els.get(node.id);
    if (!el) {
      el = document.createElement('div');
      el.dataset.id = node.id;
      els.set(node.id, el);
    }
    // classe 'dragging' = camada sendo arrastada → pointer-events:none, para detectar o que está EMBAIXO dela
    el.className = `node node-${node.type}${ui.dragIds?.has(node.id) ? ' dragging' : ''}`;
    const editing = ui.editingId === node.id;
    // CSS final = estilo calculado em css.js + extras só do editor (oculta, bloqueada, em edição de texto)
    // editando um ESTADO (hover...) no painel: a camada selecionada aparece com as sobrescritas desse estado
    const view = ui.editState && ui.selection.includes(node.id) ? stateView(node, ui.editState) : node;
    let css = toCssText(nodeStyle(view, parent, store.state.doc.assets));
    css += ';transition:none;cursor:inherit'; // no editor nada anima nem muda o cursor das ferramentas
    if (!node.visible) css += ';display:none';
    css += `;pointer-events:${node.locked ? 'none' : 'auto'}`;
    // editando: mostra o texto inteiro (sem reticências nem limite de linhas), senão o que se digita sumiria
    if (editing) css += ';user-select:text;cursor:text;display:block;overflow:visible;text-overflow:clip;white-space:pre-wrap';
    if (el._css !== css) {
      el.style.cssText = css;
      el._css = css;
    }

    // Vetores: o desenho é um <svg> dentro do elemento; só reescreve se o markup mudou.
    if (node.type === 'path') {
      const svg = pathSvg(view, store.state.doc.assets);
      if (el._svg !== svg) { el.innerHTML = svg; el._svg = svg; }
      el.toggleAttribute('data-locked', node.locked);
    }

    // Texto: o conteúdo vem do modelo, EXCETO durante a edição (aí o usuário digita direto no elemento,
    // contentEditable 'plaintext-only' para não aceitar formatação colada).
    if (node.type === 'text') {
      if (!editing && el.textContent !== node.text) el.textContent = node.text;
      if (editing && !el.isContentEditable) {
        el.contentEditable = 'plaintext-only';
        if (!el.isContentEditable) el.contentEditable = 'true';
      }
      if (!editing && el.isContentEditable) el.contentEditable = 'false';
    }

    // garante a ordem dos irmãos no DOM igual à do array (ordem z = ordem de desenho)
    if (parentEl.children[index] !== el) parentEl.insertBefore(el, parentEl.children[index] || null);

    if (node.children) node.children.forEach((c, i) => syncNode(c, node, el, i));
  }

  /**
   * "Medida de volta": para camadas com tamanho 'hug'/'fill' (ou dentro de auto layout), o tamanho real só o
   * navegador sabe. Lemos offsetWidth/Height e gravamos em node.w/h, para o painel, o SVG e o 'ajustar' mostrarem
   * o tamanho verdadeiro. Não cria entrada no histórico (é dado derivado).
   */
  function measureBack(list, parent) {
    const flow = (parent?.layout?.mode ?? 'none') !== 'none';
    for (const n of list) {
      const el = els.get(n.id);
      if (el && n.visible) {
        // com limites (min/max) ou proporção, o tamanho real pode diferir do guardado mesmo em medida fixa: mede também
        const limited = n.minW > 0 || n.maxW > 0 || n.minH > 0 || n.maxH > 0 || n.aspect > 0;
        if (n.sizeX !== 'fixed' || flow || limited) {
          const w = el.offsetWidth;
          if (Math.abs(w - n.w) > 0.01) n.w = round(w);
        }
        if (n.sizeY !== 'fixed' || flow || limited) {
          const h = el.offsetHeight;
          if (Math.abs(h - n.h) > 0.01) n.h = round(h);
        }
      }
      if (n.children) measureBack(n.children, n);
    }
  }

  /**
   * Desenha a página atual: sincroniza todas as camadas, remove elementos órfãos (camada apagada ou de outra
   * página), mede de volta os tamanhos e, se há texto em edição, dá foco e seleciona o conteúdo.
   */
  function render() {
    const page = store.page();
    alive = new Set();
    page.children.forEach((n, i) => syncNode(n, null, world, i));
    // remove elementos de nós que não existem mais (ou que são de outra página)
    for (const [id, el] of els) {
      if (!alive.has(id)) {
        el.remove();
        els.delete(id);
      }
    }
    measureBack(page.children, null);

    // entrar em modo de edição de texto: foca e seleciona tudo
    const editEl = ui.editingId && els.get(ui.editingId);
    if (editEl && document.activeElement !== editEl) {
      editEl.focus();
      const range = document.createRange();
      range.selectNodeContents(editEl);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  // Redesenha na hora (síncrono) quando o documento ou a seleção mudam; reaplica a vista quando o doc/zoom mudam.
  store.subscribeSync((reason) => {
    if (reason === 'doc' || reason === 'selection') render();
    if (reason === 'doc' || reason === 'view') applyView();
  });
  applyView();
  render();

  // API pública do canvas (usada por overlay, tools, commands, rulers...)
  return {
    world, els, getView, setView, zoomAt, toWorld, toScreen, originOf, worldBox, aabb, unionAabb, fit, ensureVisible,
    render, applyView,
    vpRect,
  };
}
