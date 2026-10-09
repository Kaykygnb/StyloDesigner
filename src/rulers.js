/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  rulers.js — RÉGUAS E CRIAÇÃO DE GUIAS
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Espessura das réguas em px (a de cima tem 20px de altura; a da esquerda, 20px de largura). */
export const RULER = 20;

/**
 * Cria as RÉGUAS (topo e esquerda) e a criação de GUIAS: arrastar a partir da régua cria uma linha-guia que o snap
 * enxerga; arrastar a guia de volta para a régua a apaga.
 * As réguas são <canvas> 2D desenhados com a vista atual (pan/zoom) e destacam a faixa da seleção em azul.
 * Guias são dados da página (page.guides: [{axis, pos}]); quem as DESENHA é o overlay.js.
 */
export function createRulers({ store, canvas, stage, commands, onManageGuides }) {
  const ui = store.ui;
  // réguas começam ESCONDIDAS (Ctrl+R ou Shift+R alternam; a escolha fica lembrada); guias aparecem quando as réguas estão ligadas
  try { ui.showRulers = localStorage.getItem('pd.rulers') === '1'; } catch { ui.showRulers = false; }
  ui.showGuides = true;
  try { ui.guidesLocked = localStorage.getItem('pd.guidesLocked') === '1'; } catch { ui.guidesLocked = false; }

  // três peças: régua de cima, régua da esquerda e o quadradinho do canto
  const top = document.createElement('canvas');
  const left = document.createElement('canvas');
  const corner = document.createElement('button');
  corner.type = 'button';
  corner.textContent = '+';
  corner.title = 'Gerenciar guias: adicionar e editar posições';
  corner.setAttribute('aria-label', 'Gerenciar guias');
  corner.addEventListener('click', () => onManageGuides?.());
  top.className = 'ruler ruler-top';
  left.className = 'ruler ruler-left';
  corner.className = 'ruler-corner';
  stage.append(top, left, corner);

  /** Lê uma variável CSS do tema atual (as réguas usam as mesmas cores dos painéis, claro ou escuro). */
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  /**
   * Escolhe o intervalo entre marcações (1, 2, 5, 10, 20, 50, 100…) para que fiquem a ≥60px uma da outra na tela,
   * qualquer que seja o zoom — a régua nunca fica poluída nem vazia.
   */
  function step(zoom) {
    const raw = 60 / zoom;
    const pow = 10 ** Math.floor(Math.log10(raw));
    for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
    return 10 * pow;
  }

  /**
   * Redesenha as duas réguas: fundo, faixa translúcida da seleção, marcas e números. Rótulos da régua da esquerda
   * ficam girados em −90°. Considera o devicePixelRatio para ficar nítida em telas HiDPI.
   */
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
      // Subdivisões dão referência visual entre os números sem acrescentar mais rótulos.
      g.globalAlpha = 0.45;
      g.beginPath();
      for (let w = first; w * v.zoom + off < len; w += st / 5) {
        const p = Math.round(w * v.zoom + off) + 0.5;
        if (horiz) { g.moveTo(p, RULER - 3); g.lineTo(p, RULER); }
        else { g.moveTo(RULER - 3, p); g.lineTo(RULER, p); }
      }
      g.stroke();
      g.globalAlpha = 1;
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

  /**
   * Liga o arrasto numa régua: durante o arrasto mostra a guia + a posição; ao soltar, cria a guia — mas só se o mouse
   * estiver DENTRO da área do canvas (soltar em cima da régua cancela).
   * @param {HTMLElement} el  régua
   * @param {'x'|'y'} axis  eixo da guia criada: a régua de cima cria guias horizontais ('y'); a da esquerda, verticais ('x')
   */
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
      const cleanup = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', cancel);
        el.removeEventListener('lostpointercapture', cancel);
        window.removeEventListener('keydown', onKey, true);
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      };
      const cancel = () => { cleanup(); ui.guideDrag = null; store.emit('overlay'); };
      const onKey = (event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); }
      };
      const up = (ev) => {
        cleanup();
        const r = canvas.vpRect();
        const inside = ev.clientX > r.left + RULER && ev.clientX < r.right && ev.clientY > r.top + RULER && ev.clientY < r.bottom;
        const g = ui.guideDrag;
        ui.guideDrag = null;
        if (inside && g) commands.addGuide(g.axis, g.pos);
        store.emit('overlay');
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', cancel);
      el.addEventListener('lostpointercapture', cancel);
      window.addEventListener('keydown', onKey, true);
    });
  }
  // régua de cima → guia horizontal (posição y); régua da esquerda → guia vertical (posição x)
  bind(top, 'y'); // régua de cima cria guia horizontal (posição y)
  bind(left, 'x');

  // redesenha quando a vista, a seleção ou o documento mudam (e quando a janela é redimensionada)
  store.subscribe((reasons) => {
    if (['view', 'selection', 'doc', 'ui'].some((x) => reasons.has(x))) draw();
  });
  window.addEventListener('resize', draw);
  draw();
  return { draw };
}
