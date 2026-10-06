// Ferramenta Caneta (vetores) e edição de pontos de caminhos.
//   - Caneta (P): clique = ponto de canto; clique e arraste = ponto suave com alças de Bézier.
//     Clique no primeiro ponto fecha. Enter/Esc/duplo clique termina.
//   - Editar: duplo clique num vetor. Arraste pontos e alças; Alt+clique no traço adiciona ponto;
//     duplo clique num ponto alterna canto/suave; Delete remove o ponto.
import { pathData } from './css.js';

export function createPen({ store, canvas, commands, frameUnder }) {
  const ui = store.ui;
  let drag = null;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const screenOf = (p) => canvas.toScreen(p.x, p.y);

  // ------------------------------------------------------------------ criar com a caneta
  function finish(close = false) {
    const pen = ui.pen;
    ui.pen = null;
    drag = null;
    if (pen && pen.pts.length >= 2) commands.addPathFromWorld(pen.pts, close, pen.parent);
    store.setTool('move');
    store.emit('overlay');
  }

  function down(e) {
    const p = canvas.toWorld(e.clientX, e.clientY);
    if (!ui.pen) ui.pen = { pts: [], cursor: null, parent: frameUnder(e.clientX, e.clientY) };
    const pen = ui.pen;
    if (pen.pts.length >= 2 && dist(screenOf(pen.pts[0]), screenOf(p)) < 9) {
      finish(true);
      return null;
    }
    pen.pts.push({ x: p.x, y: p.y, hin: null, hout: null });
    drag = { kind: 'pen', idx: pen.pts.length - 1, sx: e.clientX, sy: e.clientY };
    store.emit('overlay');
    return drag;
  }

  function move(e) {
    const p = canvas.toWorld(e.clientX, e.clientY);
    if (ui.pen) ui.pen.cursor = p;
    if (drag?.kind === 'pen') {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 3) {
        const pt = ui.pen.pts[drag.idx];
        pt.hout = { x: p.x, y: p.y };
        pt.hin = { x: 2 * pt.x - p.x, y: 2 * pt.y - p.y };
      }
    } else if (drag) {
      moveEditHandle(p, e);
    }
    store.emit('overlay');
  }

  function up() {
    const was = drag;
    drag = null;
    if (was && was.kind !== 'pen') {
      commands.normalizePath(store.get(ui.editPathId));
      store.commit();
    }
  }

  // ------------------------------------------------------------------ editar pontos
  const editNode = () => (ui.editPathId ? store.get(ui.editPathId) : null);

  /** mundo <-> espaço do viewBox do caminho (considera a rotação do próprio nó) */
  function toLocal(n, w) {
    const b = canvas.worldBox(n.id);
    const rad = (b.rot * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const dx = w.x - b.cx, dy = w.y - b.cy;
    const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
    return { x: ((lx + b.w / 2) * n.vw) / b.w, y: ((ly + b.h / 2) * n.vh) / b.h };
  }
  function toWorld(n, p) {
    const b = canvas.worldBox(n.id);
    const rad = (b.rot * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const lx = (p.x * b.w) / n.vw - b.w / 2, ly = (p.y * b.h) / n.vh - b.h / 2;
    return { x: b.cx + lx * cos - ly * sin, y: b.cy + lx * sin + ly * cos };
  }

  function startEdit(id) {
    const n = store.get(id);
    if (!n || n.type !== 'path') return;
    ui.editPathId = id;
    ui.editPt = null;
    store.setSelection([id]);
    store.emit('overlay');
  }

  function exitEdit() {
    if (!ui.editPathId) return;
    ui.editPathId = null;
    ui.editPt = null;
    drag = null;
    store.emit('overlay');
  }

  function downEdit(e, kind, idx) {
    const n = editNode();
    if (!n) return;
    ui.editPt = idx;
    drag = { kind, idx };
    store.emit('overlay');
  }

  function moveEditHandle(world, e) {
    const n = editNode();
    if (!n || !drag) return;
    const l = toLocal(n, world);
    store.update(() => {
      const pt = n.points[drag.idx];
      if (drag.kind === 'pt') {
        const dx = l.x - pt.x, dy = l.y - pt.y;
        pt.x = l.x; pt.y = l.y;
        if (pt.hin) { pt.hin.x += dx; pt.hin.y += dy; }
        if (pt.hout) { pt.hout.x += dx; pt.hout.y += dy; }
      } else {
        pt[drag.kind] = { x: l.x, y: l.y };
        const other = drag.kind === 'hin' ? 'hout' : 'hin';
        if (!e.altKey && pt[other]) pt[other] = { x: 2 * pt.x - l.x, y: 2 * pt.y - l.y }; // alças espelhadas (Alt quebra)
      }
    });
  }

  function togglePointType(idx) {
    const n = editNode();
    if (!n) return;
    store.update(() => {
      const pt = n.points[idx];
      if (pt.hin || pt.hout) { pt.hin = null; pt.hout = null; return; }
      const prev = n.points[(idx - 1 + n.points.length) % n.points.length];
      const next = n.points[(idx + 1) % n.points.length];
      const vx = (next.x - prev.x) / 4, vy = (next.y - prev.y) / 4;
      pt.hout = { x: pt.x + vx, y: pt.y + vy };
      pt.hin = { x: pt.x - vx, y: pt.y - vy };
    });
    commands.normalizePath(editNode());
    store.commit();
  }

  function deletePoint() {
    const n = editNode();
    if (!n || ui.editPt == null || n.points.length <= 2) return false;
    store.update(() => { n.points.splice(ui.editPt, 1); });
    ui.editPt = null;
    commands.normalizePath(n);
    store.commit();
    return true;
  }

  /** Alt+clique no traço: insere um ponto de canto no segmento mais próximo. */
  function addPointAt(e) {
    const n = editNode();
    if (!n) return;
    const l = toLocal(n, canvas.toWorld(e.clientX, e.clientY));
    const pts = n.points;
    const segs = n.closed ? pts.length : pts.length - 1;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const t = Math.max(0, Math.min(1, ((l.x - a.x) * (b.x - a.x) + (l.y - a.y) * (b.y - a.y)) / (((b.x - a.x) ** 2 + (b.y - a.y) ** 2) || 1)));
      const d = Math.hypot(l.x - (a.x + t * (b.x - a.x)), l.y - (a.y + t * (b.y - a.y)));
      if (d < bestD) { bestD = d; best = i; }
    }
    store.update(() => { pts.splice(best + 1, 0, { x: l.x, y: l.y, hin: null, hout: null }); });
    ui.editPt = best + 1;
    commands.normalizePath(n);
    store.commit();
  }

  // ------------------------------------------------------------------ desenho do overlay (SVG em px de tela)
  function overlaySvg() {
    const out = [];
    const S = (p) => {
      const s = canvas.toScreen(p.x, p.y);
      return { x: s.x, y: s.y, hin: p.hin && canvas.toScreen(p.hin.x, p.hin.y), hout: p.hout && canvas.toScreen(p.hout.x, p.hout.y) };
    };
    if (ui.pen) {
      const pts = ui.pen.pts.map(S);
      const live = ui.pen.cursor ? [...pts, { ...S(ui.pen.cursor), hin: null, hout: null }] : pts;
      if (live.length > 1) out.push(`<path d="${pathData(live, false)}" fill="none" stroke="var(--accent)" stroke-width="1.5"/>`);
      pts.forEach((p, i) => {
        if (p.hout) out.push(`<line x1="${p.x}" y1="${p.y}" x2="${p.hout.x}" y2="${p.hout.y}" class="pen-line"/><line x1="${p.x}" y1="${p.y}" x2="${p.hin.x}" y2="${p.hin.y}" class="pen-line"/><circle cx="${p.hout.x}" cy="${p.hout.y}" r="3.5" class="pen-handle"/><circle cx="${p.hin.x}" cy="${p.hin.y}" r="3.5" class="pen-handle"/>`);
        out.push(`<rect x="${p.x - 4}" y="${p.y - 4}" width="8" height="8" class="pen-pt${i === 0 ? ' first' : ''}"/>`);
      });
    }
    const n = editNode();
    if (n) {
      n.points.forEach((pt, i) => {
        const p = S(toWorld(n, pt));
        const hin = pt.hin && S(toWorld(n, pt.hin)), hout = pt.hout && S(toWorld(n, pt.hout));
        const sel = ui.editPt === i;
        for (const [kind, h] of [['hin', hin], ['hout', hout]]) {
          if (!h || !sel) continue;
          out.push(`<line x1="${p.x}" y1="${p.y}" x2="${h.x}" y2="${h.y}" class="pen-line"/><circle cx="${h.x}" cy="${h.y}" r="4" class="pen-handle hit" data-edit="${kind}" data-idx="${i}"/>`);
        }
        out.push(`<rect x="${p.x - 4.5}" y="${p.y - 4.5}" width="9" height="9" class="pen-pt hit${sel ? ' sel' : ''}" data-edit="pt" data-idx="${i}"/>`);
      });
    }
    return out.join('');
  }

  const isDrawing = () => !!ui.pen;
  const isEditing = () => !!ui.editPathId;

  return {
    down, move, up, finish, startEdit, exitEdit, downEdit, togglePointType, deletePoint, addPointAt,
    overlaySvg, isDrawing, isEditing,
  };
}
