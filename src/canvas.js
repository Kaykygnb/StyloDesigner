// Canvas: cada camada é um elemento HTML estilizado com CSS real, dentro de um "mundo" com pan/zoom.
import { nodeStyle, pathSvg, toCssText } from './css.js';
import { round } from './model.js';

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 64;

export function createCanvas(store, viewport) {
  const ui = store.ui;
  const world = document.createElement('div');
  world.className = 'world';
  viewport.prepend(world);
  const els = new Map();

  // ------------------------------------------------------------------ vista (pan/zoom)
  const getView = () => (ui.views[ui.pageId] ||= { x: 120, y: 120, zoom: 1, fresh: true });

  function applyView() {
    const v = getView();
    world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
    // grade de pontos que acompanha o zoom
    const g = 24 * v.zoom;
    viewport.style.backgroundSize = `${g}px ${g}px`;
    viewport.style.backgroundPosition = `${v.x}px ${v.y}px`;
    viewport.style.setProperty('--dot-alpha', v.zoom < 0.4 ? '0' : '1');
  }

  function setView(patch) {
    const v = getView();
    delete v.fresh;
    Object.assign(v, patch);
    v.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom));
    applyView();
    store.emit('view');
  }

  /** Zoom mantendo o ponto (cx, cy), em px do viewport, parado. */
  function zoomAt(newZoom, cx, cy) {
    const v = getView();
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
    setView({ zoom: z, x: cx - ((cx - v.x) * z) / v.zoom, y: cy - ((cy - v.y) * z) / v.zoom });
  }

  const vpRect = () => viewport.getBoundingClientRect();
  const toWorld = (clientX, clientY) => {
    const r = vpRect();
    const v = getView();
    return { x: (clientX - r.left - v.x) / v.zoom, y: (clientY - r.top - v.y) / v.zoom };
  };
  /** Mundo -> px relativos ao viewport. */
  const toScreen = (wx, wy) => {
    const v = getView();
    return { x: wx * v.zoom + v.x, y: wy * v.zoom + v.y };
  };

  // ------------------------------------------------------------------ geometria
  /** Origem (canto superior esquerdo, sem rotação) do elemento em coordenadas de mundo. */
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

  const ancestorRotated = (id) => {
    for (let p = store.parentOf(id); p; p = store.parentOf(p.id)) if (p.rotation) return true;
    return false;
  };

  /** Caixa da camada no mundo: centro, tamanho e rotação (a rotação própria é preservada). */
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

  /** Retângulo envolvente alinhado aos eixos (considera rotação) em coordenadas de mundo. */
  function aabb(id) {
    const el = els.get(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const a = toWorld(r.left, r.top);
    const b = toWorld(r.right, r.bottom);
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  }

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
  function syncNode(node, parent, parentEl, index) {
    let el = els.get(node.id);
    if (!el) {
      el = document.createElement('div');
      el.dataset.id = node.id;
      els.set(node.id, el);
    }
    el.className = `node node-${node.type}${ui.dragIds?.has(node.id) ? ' dragging' : ''}`;
    const editing = ui.editingId === node.id;
    let css = toCssText(nodeStyle(node, parent, store.state.doc.assets));
    if (!node.visible) css += ';display:none';
    css += `;pointer-events:${node.locked ? 'none' : 'auto'}`;
    if (editing) css += ';user-select:text;cursor:text';
    if (el.style.cssText !== css) el.style.cssText = css;

    if (node.type === 'path') {
      const svg = pathSvg(node, store.state.doc.assets);
      if (el._svg !== svg) { el.innerHTML = svg; el._svg = svg; }
      el.toggleAttribute('data-locked', node.locked);
    }

    if (node.type === 'text') {
      if (!editing && el.textContent !== node.text) el.textContent = node.text;
      if (editing && !el.isContentEditable) {
        el.contentEditable = 'plaintext-only';
        if (!el.isContentEditable) el.contentEditable = 'true';
      }
      if (!editing && el.isContentEditable) el.contentEditable = 'false';
    }

    if (parentEl.children[index] !== el) parentEl.insertBefore(el, parentEl.children[index] || null);

    if (node.children) node.children.forEach((c, i) => syncNode(c, node, el, i));
  }

  function measureBack(list) {
    for (const n of list) {
      const el = els.get(n.id);
      if (el && n.visible) {
        if (n.sizeX !== 'fixed' || (store.parentOf(n.id)?.layout?.mode ?? 'none') !== 'none') {
          const w = el.offsetWidth;
          if (Math.abs(w - n.w) > 0.01) n.w = round(w);
        }
        if (n.sizeY !== 'fixed' || (store.parentOf(n.id)?.layout?.mode ?? 'none') !== 'none') {
          const h = el.offsetHeight;
          if (Math.abs(h - n.h) > 0.01) n.h = round(h);
        }
      }
      if (n.children) measureBack(n.children);
    }
  }

  function render() {
    const page = store.page();
    page.children.forEach((n, i) => syncNode(n, null, world, i));
    // remove elementos de nós que não existem mais
    for (const [id, el] of els) {
      if (!store.get(id) || store.entry(id).page !== page) {
        el.remove();
        els.delete(id);
      }
    }
    measureBack(page.children);

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

  store.subscribeSync((reason) => {
    if (reason === 'doc' || reason === 'selection') render();
    if (reason === 'doc' || reason === 'view') applyView();
  });
  applyView();
  render();

  return {
    world, els, getView, setView, zoomAt, toWorld, toScreen, originOf, worldBox, aabb, unionAabb, fit,
    render, applyView,
    vpRect,
  };
}
