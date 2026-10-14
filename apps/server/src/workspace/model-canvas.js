/**
 * server/workspace/model-canvas.js — GEOMETRIA SEM NAVEGADOR
 *
 * `commands.js` pergunta ao canvas "onde esta camada está?" (originOf, aabb...). No editor, quem responde é o DOM.
 * No servidor não há DOM: este módulo responde a partir do próprio modelo.
 *   - camada livre: posição = soma de x/y dos ancestrais;
 *   - filhos de auto layout row/column: empilhados com padding e gap (aproximação: hug/fill usam w/h guardados);
 *   - grid e rotação de ancestrais: aproximados (o editor continua sendo a referência exata).
 * Só implementa o que `commands.js` usa. Funções puras sobre `store`.
 */

const pad4 = (p) => (Array.isArray(p) ? p : [p || 0, p || 0, p || 0, p || 0]);

export function createModelCanvas(store, { width = 1280, height = 800 } = {}) {
  let view = { zoom: 1, x: 0, y: 0, fresh: true };
  const rect = { left: 0, top: 0, width, height, right: width, bottom: height };

  /** Posição do filho dentro do pai quando o pai tem auto layout row/column. */
  function flowOffset(parent, child) {
    const mode = parent.layout?.mode;
    const gap = parent.layout?.gap || 0;
    const [pt, pr, pb, pl] = pad4(parent.layout?.padding);
    let x = pl, y = pt;
    for (const c of parent.children || []) {
      if (c.visible === false || c.absolute) continue;
      if (c.id === child.id) return { x, y };
      if (mode === 'row') x += (c.w || 0) + gap;
      else y += (c.h || 0) + gap;
    }
    return { x: pl, y: pt };
  }

  function originOf(id) {
    const chain = [];
    for (let n = store.get(id); n; n = store.parentOf(n.id)) chain.unshift(n);
    let x = 0, y = 0;
    for (let i = 0; i < chain.length; i++) {
      const n = chain[i];
      const parent = chain[i - 1];
      const flows = parent && (parent.layout?.mode === 'row' || parent.layout?.mode === 'column') && !n.absolute;
      const off = flows ? flowOffset(parent, n) : { x: n.x || 0, y: n.y || 0 };
      x += off.x;
      y += off.y;
    }
    return { x, y };
  }

  function aabb(id) {
    const n = store.get(id);
    if (!n) return null;
    const o = originOf(id);
    const w = n.w || 0, h = n.h || 0;
    if (!n.rotation) return { x: o.x, y: o.y, w, h };
    const r = (n.rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(r)), sin = Math.abs(Math.sin(r));
    const bw = w * cos + h * sin, bh = w * sin + h * cos;
    return { x: o.x + w / 2 - bw / 2, y: o.y + h / 2 - bh / 2, w: bw, h: bh };
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

  function worldBox(id) {
    const n = store.get(id);
    if (!n) return null;
    const o = originOf(id);
    return { x: o.x, y: o.y, w: n.w || 0, h: n.h || 0, cx: o.x + (n.w || 0) / 2, cy: o.y + (n.h || 0) / 2, rot: n.rotation || 0 };
  }

  return {
    els: new Map(), // sem elementos: quem pergunta usa o tamanho do modelo
    originOf, aabb, unionAabb, worldBox,
    vpRect: () => rect,
    toWorld: (cx, cy) => ({ x: (cx - view.x) / view.zoom, y: (cy - view.y) / view.zoom }),
    toScreen: (wx, wy) => ({ x: wx * view.zoom + view.x, y: wy * view.zoom + view.y }),
    getView: () => view,
    setView: (next) => { view = { ...view, ...next, fresh: false }; },
    fit: () => {},
    ensureVisible: () => {},
  };
}
