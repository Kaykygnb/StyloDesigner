// Camada de interface sobre o canvas (em px de tela): seleção, alças, guias, marquee e nomes dos frames.
import { round } from './model.js';
import { rgba } from './css.js';

const HANDLES = {
  nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5],
};
const BASE_ANGLE = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 };
const CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];

export const handleCursor = (handle, rot) => {
  const a = (((BASE_ANGLE[handle] + rot) % 180) + 180) % 180;
  return CURSORS[Math.round(a / 45) % 4];
};

/** Distâncias entre a seleção A e a camada B (retângulos no mundo), como no "Alt" do Figma. */
export function measures(A, B) {
  const out = [];
  const ov = (a0, a1, b0, b1) => [Math.max(a0, b0), Math.min(a1, b1)];
  const inside = A.x >= B.x && A.y >= B.y && A.x + A.w <= B.x + B.w && A.y + A.h <= B.y + B.h;
  if (inside) {
    const cy = A.y + A.h / 2, cx = A.x + A.w / 2;
    out.push({ x1: B.x, y1: cy, x2: A.x, y2: cy, len: A.x - B.x }, { x1: A.x + A.w, y1: cy, x2: B.x + B.w, y2: cy, len: B.x + B.w - A.x - A.w },
      { x1: cx, y1: B.y, x2: cx, y2: A.y, len: A.y - B.y }, { x1: cx, y1: A.y + A.h, x2: cx, y2: B.y + B.h, len: B.y + B.h - A.y - A.h });
    return out.filter((m) => m.len > 0.01);
  }
  const [oy0, oy1] = ov(A.y, A.y + A.h, B.y, B.y + B.h);
  const [ox0, ox1] = ov(A.x, A.x + A.w, B.x, B.x + B.w);
  const yMid = oy1 > oy0 ? (oy0 + oy1) / 2 : A.y + A.h / 2;
  const xMid = ox1 > ox0 ? (ox0 + ox1) / 2 : A.x + A.w / 2;
  if (A.x + A.w <= B.x) out.push({ x1: A.x + A.w, y1: yMid, x2: B.x, y2: yMid, len: B.x - A.x - A.w });
  else if (B.x + B.w <= A.x) out.push({ x1: B.x + B.w, y1: yMid, x2: A.x, y2: yMid, len: A.x - B.x - B.w });
  if (A.y + A.h <= B.y) out.push({ x1: xMid, y1: A.y + A.h, x2: xMid, y2: B.y, len: B.y - A.y - A.h });
  else if (B.y + B.h <= A.y) out.push({ x1: xMid, y1: B.y + B.h, x2: xMid, y2: A.y, len: A.y - B.y - B.h });
  return out;
}

export function createOverlay(store, canvas, viewport, hooks = {}) {
  const ui = store.ui;
  const root = document.createElement('div');
  root.className = 'overlay';
  viewport.append(root);

  const pool = new Map();
  let used = new Set();

  function get(key, cls, parent = root) {
    let el = pool.get(key);
    if (!el) {
      el = document.createElement('div');
      pool.set(key, el);
      parent.append(el);
    }
    if (el.className !== cls) el.className = cls;
    if (el.parentNode !== parent) parent.append(el);
    used.add(key);
    return el;
  }

  function place(el, x, y, w, h, rot = 0) {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.transform = rot ? `rotate(${rot}deg)` : '';
  }

  /** Caixa (centro/tamanho/rotação) do nó, em px de tela. */
  function screenBox(id) {
    const b = canvas.worldBox(id);
    if (!b) return null;
    const z = canvas.getView().zoom;
    const c = canvas.toScreen(b.cx, b.cy);
    return { cx: c.x, cy: c.y, w: b.w * z, h: b.h * z, rot: b.rot };
  }

  function drawBox(key, box, cls, handles) {
    const el = get(key, cls);
    place(el, box.cx - box.w / 2, box.cy - box.h / 2, box.w, box.h, box.rot);
    if (!handles) return el;
    for (const [name, [fx, fy]] of Object.entries(HANDLES)) {
      if (handles === 'line' && name !== 'e' && name !== 'w') continue;
      const hEl = get(`${key}:h:${name}`, 'handle', el);
      hEl.dataset.handle = name;
      hEl.style.left = `${fx * 100}%`;
      hEl.style.top = `${fy * 100}%`;
      hEl.style.cursor = handleCursor(name, box.rot);
      // alças pequenas somem quando a caixa fica minúscula (evita cobrir o objeto)
      const tiny = name === 'n' || name === 's' ? box.w < 24 : name === 'e' || name === 'w' ? box.h < 24 : false;
      hEl.style.display = tiny ? 'none' : '';
    }
    if (handles === 'full' || handles === 'line') {
      for (const name of handles === 'line' ? [] : ['nw', 'ne', 'se', 'sw']) {
        const [fx, fy] = HANDLES[name];
        const r = get(`${key}:r:${name}`, 'rotate-zone', el);
        r.dataset.rotate = name;
        r.style.left = `${fx * 100}%`;
        r.style.top = `${fy * 100}%`;
      }
    }
    return el;
  }

  function render() {
    used = new Set();
    const page = store.page();
    const z = canvas.getView().zoom;
    const sel = ui.selection.filter((id) => store.get(id));
    const editing = !!ui.editingId;

    // ---- nomes dos frames raiz
    for (const n of page.children) {
      if (n.type !== 'frame' || !n.visible) continue;
      const b = canvas.aabb(n.id);
      if (!b) continue;
      const p = canvas.toScreen(b.x, b.y);
      const el = get(`label:${n.id}`, `board-label${sel.includes(n.id) ? ' selected' : ''}`);
      if (el.textContent !== n.name) el.textContent = n.name;
      el.dataset.label = n.id;
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y - 22}px`;
      el.style.maxWidth = `${Math.max(40, b.w * z)}px`;
    }

    // ---- hover
    if (ui.hoverId && ui.tool === 'move' && !sel.includes(ui.hoverId) && !ui.dragIds) {
      const box = screenBox(ui.hoverId);
      if (box) drawBox('hover', box, 'sel-box hover');
    }

    // ---- alvo de soltura
    if (ui.dropTarget) {
      const box = screenBox(ui.dropTarget);
      if (box) drawBox('drop', box, 'sel-box drop');
    }

    // ---- seleção
    if (sel.length === 1) {
      const box = screenBox(sel[0]);
      if (box) {
        const type = store.get(sel[0]).type;
        drawBox('sel', box, 'sel-box', editing || ui.editPathId ? null : type === 'line' ? 'line' : 'full');
        pill(canvas.aabb(sel[0]), `${round(canvas.worldBox(sel[0]).w, 1)} × ${round(canvas.worldBox(sel[0]).h, 1)}`);
      }
    } else if (sel.length > 1) {
      for (const id of sel) {
        const box = screenBox(id);
        if (box) drawBox(`sel:${id}`, box, 'sel-box thin');
      }
      const u = canvas.unionAabb(sel);
      if (u) {
        const c = canvas.toScreen(u.x + u.w / 2, u.y + u.h / 2);
        drawBox('sel-group', { cx: c.x, cy: c.y, w: u.w * z, h: u.h * z, rot: 0 }, 'sel-box', 'plain');
        pill(u, `${round(u.w, 1)} × ${round(u.h, 1)}`);
      }
    }

    // ---- guias de snap
    (ui.guides || []).forEach((g, i) => {
      const a = canvas.toScreen(g.axis === 'x' ? g.pos : g.from, g.axis === 'x' ? g.from : g.pos);
      const b = canvas.toScreen(g.axis === 'x' ? g.pos : g.to, g.axis === 'x' ? g.to : g.pos);
      const el = get(`guide:${i}`, 'guide');
      place(el, a.x, a.y, g.axis === 'x' ? 1 : b.x - a.x, g.axis === 'x' ? b.y - a.y : 1);
    });

    // ---- grades de layout (colunas / linhas / quadrículas)
    if (ui.showGrids !== false) {
      let n = 0;
      const addRect = (x, y, w, h, color) => {
        const el = get(`lg:${n++}`, 'layout-grid');
        place(el, x, y, w, h);
        el.style.background = color;
      };
      const walkGrids = (list) => {
        for (const f of list) {
          if (!f.visible) continue;
          if (f.type === 'frame' && f.grids?.length) {
            const b = canvas.aabb(f.id);
            const o = canvas.toScreen(b.x, b.y);
            for (const g of f.grids) {
              const color = rgba(g.color || '#ff3d3d', g.opacity ?? 0.12);
              if (g.type === 'grid') {
                const sz = Math.max(2, g.size || 8) * z;
                const el = get(`lg:${n++}`, 'layout-grid');
                place(el, o.x, o.y, b.w * z, b.h * z);
                el.style.background = 'none';
                el.style.backgroundImage = `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`;
                el.style.backgroundSize = `${sz}px ${sz}px`;
                continue;
              }
              const cols = g.type === 'columns';
              const total = (cols ? b.w : b.h) - 2 * (g.margin || 0);
              const count = Math.min(64, Math.max(1, g.count || 4));
              const gut = g.gutter || 0;
              const size = (total - gut * (count - 1)) / count;
              for (let i = 0; i < count; i++) {
                const start = (g.margin || 0) + i * (size + gut);
                if (cols) addRect(o.x + start * z, o.y, size * z, b.h * z, color);
                else addRect(o.x, o.y + start * z, b.w * z, size * z, color);
              }
            }
          }
          if (f.children) walkGrids(f.children);
        }
      };
      walkGrids(page.children);
    }

    // ---- guias manuais
    if (ui.showGuides !== false && ui.showRulers !== false) {
      const v = canvas.getView();
      (page.guides || []).forEach((g, i) => {
        const vert = g.axis === 'x';
        const el = get(`gl:${i}`, `guide-line ${vert ? 'v' : 'h'}`);
        el.dataset.guide = i;
        const pos = g.pos * z + (vert ? v.x : v.y);
        if (vert) place(el, pos - 3, 0, 7, 99999); else place(el, 0, pos - 3, 99999, 7);
      });
      if (ui.guideDrag) {
        const g = ui.guideDrag, vert = g.axis === 'x';
        const el = get('gl:drag', `guide-line drag ${vert ? 'v' : 'h'}`);
        const pos = g.pos * z + (vert ? v.x : v.y);
        if (vert) place(el, pos - 3, 0, 7, 99999); else place(el, 0, pos - 3, 99999, 7);
        const tag = get('gl:tag', 'size-pill');
        tag.textContent = String(g.pos);
        tag.style.left = `${vert ? pos : 40}px`;
        tag.style.top = `${vert ? 40 : pos + 8}px`;
      }
    }

    // ---- grade de pixels (zoom >= 800%)
    const v0 = canvas.getView();
    const pix = v0.zoom >= 8;
    root.classList.toggle('pixels', pix);
    if (pix) {
      root.style.backgroundSize = `${v0.zoom}px ${v0.zoom}px`;
      root.style.backgroundPosition = `${v0.x}px ${v0.y}px`;
    } else root.style.backgroundSize = '';

    // ---- medidas (segure Alt e passe o mouse sobre outra camada)
    if (ui.altDown && sel.length && ui.hoverId && !sel.includes(ui.hoverId) && !ui.dragIds) {
      const A = canvas.unionAabb(sel), B = canvas.aabb(ui.hoverId);
      if (A && B) {
        const ms = measures(A, B);
        if (ms.length) {
          let layer = pool.get('measure');
          if (!layer) {
            layer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            layer.setAttribute('class', 'pen-layer');
            root.append(layer);
            pool.set('measure', layer);
          }
          used.add('measure');
          const S = (x, y) => canvas.toScreen(x, y);
          layer.innerHTML = [
            `<rect x="${S(B.x, B.y).x}" y="${S(B.x, B.y).y}" width="${B.w * z}" height="${B.h * z}" class="measure-box"/>`,
            ...ms.map((m) => {
              const a = S(m.x1, m.y1), b = S(m.x2, m.y2);
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
              const t = String(round(m.len, 1));
              return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="measure-line"/>` +
                `<rect x="${mx - t.length * 3.6 - 4}" y="${my - 8}" width="${t.length * 7.2 + 8}" height="16" rx="4" class="measure-pill"/>` +
                `<text x="${mx}" y="${my + 4}" text-anchor="middle" class="measure-text">${t}</text>`;
            }),
          ].join('');
        }
      }
    }

    // ---- caneta / edição de pontos (SVG)
    const penSvg = hooks.penSvg?.() || '';
    if (penSvg) {
      let layer = pool.get('pen');
      if (!layer) {
        layer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        layer.setAttribute('class', 'pen-layer');
        root.append(layer);
        pool.set('pen', layer);
      }
      used.add('pen');
      layer.innerHTML = penSvg;
    }

    // ---- setas do protótipo
    {
      const arrows = [];
      const all = ui.rightTab === 'proto';
      const consider = (n) => {
        for (const it of n.interactions || []) {
          if (it.action !== 'navigate' || !it.target) continue;
          const t = store.get(it.target);
          if (!t) continue;
          const a = canvas.aabb(n.id), b = canvas.aabb(t.id);
          if (!a || !b) continue;
          const p1 = canvas.toScreen(a.x + a.w, a.y + a.h / 2);
          const p2 = canvas.toScreen(b.x, b.y + b.h / 2);
          const dx = Math.max(60, Math.abs(p2.x - p1.x) / 2);
          arrows.push(`<circle cx="${p1.x}" cy="${p1.y}" r="4" class="proto-arrow"/><path d="M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y} ${p2.x - dx} ${p2.y} ${p2.x} ${p2.y}" class="proto-path"/><path d="M ${p2.x} ${p2.y} l -10 -5 l 0 10 z" class="proto-arrow"/>`);
        }
      };
      const visit = (list) => list.forEach((n) => { if (all || sel.includes(n.id)) consider(n); if (n.children) visit(n.children); });
      visit(page.children);
      if (arrows.length) {
        let layer = pool.get('proto');
        if (!layer) {
          layer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          layer.setAttribute('class', 'pen-layer');
          root.append(layer);
          pool.set('proto', layer);
        }
        used.add('proto');
        layer.innerHTML = arrows.join('');
      }
    }

    // ---- marquee
    if (ui.marquee) {
      const m = ui.marquee;
      const p = canvas.toScreen(m.x, m.y);
      place(get('marquee', 'marquee'), p.x, p.y, m.w * z, m.h * z);
    }

    for (const [key, el] of pool) {
      if (!used.has(key)) {
        el.remove();
        pool.delete(key);
      }
    }
  }

  function pill(aabb, text) {
    if (!aabb) return;
    const p = canvas.toScreen(aabb.x + aabb.w / 2, aabb.y + aabb.h);
    const el = get('pill', 'size-pill');
    if (el.textContent !== text) el.textContent = text;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y + 12}px`;
  }

  store.subscribeSync((reason) => {
    if (['doc', 'selection', 'view', 'overlay', 'hover'].includes(reason)) render();
  });
  render();

  return { render, root };
}
