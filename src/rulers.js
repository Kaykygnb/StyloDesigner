// Réguas (topo e esquerda) e criação de guias arrastando a partir delas.
export const RULER = 20;

export function createRulers({ store, canvas, stage, commands }) {
  const ui = store.ui;
  ui.showRulers = true;
  ui.showGuides = true;

  const top = document.createElement('canvas');
  const left = document.createElement('canvas');
  const corner = document.createElement('div');
  top.className = 'ruler ruler-top';
  left.className = 'ruler ruler-left';
  corner.className = 'ruler-corner';
  stage.append(top, left, corner);

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  /** passo "bonito" (1, 2, 5, 10, ...) com pelo menos ~60px de tela entre rótulos */
  function step(zoom) {
    const raw = 60 / zoom;
    const pow = 10 ** Math.floor(Math.log10(raw));
    for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
    return 10 * pow;
  }

  function draw() {
    const show = ui.showRulers;
    top.style.display = left.style.display = corner.style.display = show ? '' : 'none';
    if (!show) return;
    const r = canvas.vpRect();
    const dpr = devicePixelRatio || 1;
    const v = canvas.getView();
    const bg = css('--panel'), fg = css('--muted'), line = css('--border'), acc = css('--accent');
    const st = step(v.zoom);
    const sel = canvas.unionAabb(ui.selection);

    for (const [cv, horiz] of [[top, true], [left, false]]) {
      const len = horiz ? r.width : r.height;
      cv.width = (horiz ? len : RULER) * dpr;
      cv.height = (horiz ? RULER : len) * dpr;
      cv.style.width = `${horiz ? len : RULER}px`;
      cv.style.height = `${horiz ? RULER : len}px`;
      const g = cv.getContext('2d');
      g.scale(dpr, dpr);
      g.fillStyle = bg;
      g.fillRect(0, 0, horiz ? len : RULER, horiz ? RULER : len);
      g.strokeStyle = line;
      g.beginPath();
      g.moveTo(horiz ? 0 : RULER - 0.5, horiz ? RULER - 0.5 : 0);
      g.lineTo(horiz ? len : RULER - 0.5, horiz ? RULER - 0.5 : len);
      g.stroke();

      // faixa da seleção
      if (sel) {
        const a = (horiz ? sel.x : sel.y) * v.zoom + (horiz ? v.x : v.y);
        const b = a + (horiz ? sel.w : sel.h) * v.zoom;
        g.fillStyle = acc;
        g.globalAlpha = 0.18;
        if (horiz) g.fillRect(a, 0, b - a, RULER); else g.fillRect(0, a, RULER, b - a);
        g.globalAlpha = 1;
      }

      g.fillStyle = fg;
      g.strokeStyle = fg;
      g.font = '9px ui-monospace, Menlo, monospace';
      const off = horiz ? v.x : v.y;
      const first = Math.floor(-off / v.zoom / st) * st;
      for (let w = first; w * v.zoom + off < len + st * v.zoom; w += st) {
        const p = Math.round(w * v.zoom + off) + 0.5;
        g.beginPath();
        if (horiz) { g.moveTo(p, RULER - 7); g.lineTo(p, RULER); } else { g.moveTo(RULER - 7, p); g.lineTo(RULER, p); }
        g.stroke();
        const label = String(Math.round(w * 100) / 100);
        if (horiz) g.fillText(label, p + 3, 10);
        else { g.save(); g.translate(10, p - 3); g.rotate(-Math.PI / 2); g.fillText(label, 0, 0); g.restore(); }
      }
    }
  }

  // ---- arrastar da régua cria uma guia (soltar de volta na régua cancela)
  function bind(el, axis) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      ui.showGuides = true;
      const upd = (ev) => {
        const w = canvas.toWorld(ev.clientX, ev.clientY);
        ui.guideDrag = { axis, pos: Math.round(axis === 'x' ? w.x : w.y) };
        store.emit('overlay');
      };
      upd(e);
      const move = (ev) => upd(ev);
      const up = (ev) => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        const r = canvas.vpRect();
        const inside = axis === 'y' ? ev.clientY - r.top > RULER : ev.clientX - r.left > RULER;
        const g = ui.guideDrag;
        ui.guideDrag = null;
        if (inside && g) commands.addGuide(g.axis, g.pos);
        store.emit('overlay');
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    });
  }
  bind(top, 'y'); // régua de cima cria guia horizontal (posição y)
  bind(left, 'x');

  store.subscribe((reasons) => {
    if (['view', 'selection', 'doc', 'ui'].some((x) => reasons.has(x))) draw();
  });
  window.addEventListener('resize', draw);
  draw();
  return { draw };
}
