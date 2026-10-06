/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  pen.js — FERRAMENTA CANETA (VETORES) E EDIÇÃO DE PONTOS
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Cria e edita vetores com curvas de Bézier cúbicas. Cada ponto é { x, y, hin, hout }: hin/hout são as
 *  "alças" (pontos de controle) de entrada/saída; null significa ponto de canto (segmento reto).
 *  Os pontos vivem no espaço próprio do vetor (vw×vh) e a camada só estica esse espaço (ver model.js).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { pathData } from './css.js';

/**
 * Cria a CANETA. Dois modos, que não ficam ativos ao mesmo tempo:
 *
 *  A) DESENHAR (ui.pen): cada clique adiciona um ponto. Clicar e ARRASTAR cria um ponto "suave": o arrasto define a
 *     alça de saída (hout) e a de entrada (hin) é o espelho dela — é isso que faz a curva de Bézier. Clicar no 1º
 *     ponto fecha o caminho; Enter/Esc/duplo clique termina deixando-o aberto.
 *  B) EDITAR PONTOS (ui.editPathId): depois de criado, duplo clique no vetor mostra os pontos. Arrastar ponto/alça
 *     altera a forma; Alt+clique no traço adiciona ponto; duplo clique no ponto alterna canto↔suave; Delete remove.
 *
 * Este módulo não desenha: `overlaySvg()` devolve o SVG (em px de tela) que o overlay.js exibe.
 *
 * @param {{store, canvas, commands, frameUnder: (x:number,y:number)=>object|null}} deps
 */
export function createPen({ store, canvas, commands, frameUnder }) {
  // atalho para o estado de interface (ui.pen = caminho em desenho; ui.editPathId = vetor em edição; ui.editPt = ponto selecionado)
  const ui = store.ui;
  // gesto em andamento do ponteiro: { kind: 'pen' } criando um ponto, ou { kind: 'pt'|'hin'|'hout', idx } editando
  let drag = null;

  /** Distância entre dois pontos (px). */
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  /** Ponto do mundo → px de tela (para medir distâncias na tela, independentes do zoom). */
  const screenOf = (p) => canvas.toScreen(p.x, p.y);

  // ------------------------------------------------------------------ criar com a caneta
  /**
   * Termina o desenho: cria a camada-vetor se há 2+ pontos e volta para a ferramenta Mover.
   * @param {boolean} [close=false]  true fecha o caminho (liga o último ponto ao primeiro)
   */
  function finish(close = false) {
    const pen = ui.pen;
    ui.pen = null;
    drag = null;
    if (pen && pen.pts.length >= 2) commands.addPathFromWorld(pen.pts, close, pen.parent);
    store.setTool('move');
    store.emit('overlay');
  }

  /**
   * Clique da caneta. Clicar perto (<9px de tela) do 1º ponto, com 2+ pontos, FECHA o caminho.
   * Senão adiciona um ponto de canto e começa um possível arrasto (que viraria alças de Bézier).
   * O frame sob o primeiro clique vira o pai da camada final.
   * @returns o gesto de arrasto, ou null se o caminho foi fechado
   */
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

  /**
   * Movimento do mouse: atualiza o "elástico" até o cursor (preview do próximo segmento) e, se está arrastando
   * após o clique, define as alças: hout segue o mouse e hin é o ESPELHO em torno do ponto (curva suave).
   * Só vira arrasto após 3px (cliques tremidos continuam sendo pontos de canto).
   */
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

  /** Soltou o mouse: se estava editando um ponto/alça, ajusta a caixa do vetor e grava no histórico (1 desfazer). */
  function up() {
    const was = drag;
    drag = null;
    if (was && was.kind !== 'pen') {
      commands.normalizePath(store.get(ui.editPathId));
      store.commit();
    }
  }

  // ------------------------------------------------------------------ editar pontos
  /** Vetor em edição (ou null). */
  const editNode = () => (ui.editPathId ? store.get(ui.editPathId) : null);

  /**
   * Mundo → espaço do vetor (o "viewBox" vw×vh). Desfaz a rotação da camada (rotação inversa em torno do centro)
   * e converte a posição na caixa para o sistema de coordenadas dos pontos.
   */
  function toLocal(n, w) {
    const b = canvas.worldBox(n.id);
    const rad = (b.rot * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const dx = w.x - b.cx, dy = w.y - b.cy;
    const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
    return { x: ((lx + b.w / 2) * n.vw) / b.w, y: ((ly + b.h / 2) * n.vh) / b.h };
  }
  /** Espaço do vetor → mundo (o inverso de toLocal), considerando a rotação da camada. Usado para desenhar os pontos na tela. */
  function toWorld(n, p) {
    const b = canvas.worldBox(n.id);
    const rad = (b.rot * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const lx = (p.x * b.w) / n.vw - b.w / 2, ly = (p.y * b.h) / n.vh - b.h / 2;
    return { x: b.cx + lx * cos - ly * sin, y: b.cy + lx * sin + ly * cos };
  }

  /** Entra no modo de edição de pontos de um vetor (duplo clique ou Enter). */
  function startEdit(id) {
    const n = store.get(id);
    if (!n || n.type !== 'path') return;
    ui.editPathId = id;
    ui.editPt = null;
    store.setSelection([id]);
    store.emit('overlay');
  }

  /** Sai da edição de pontos. */
  function exitEdit() {
    if (!ui.editPathId) return;
    ui.editPathId = null;
    ui.editPt = null;
    drag = null;
    store.emit('overlay');
  }

  /** Clicou num ponto ou alça: seleciona o ponto e prepara o arrasto. `kind`: 'pt' (ponto), 'hin' ou 'hout' (alças). */
  function downEdit(e, kind, idx) {
    const n = editNode();
    if (!n) return;
    ui.editPt = idx;
    drag = { kind, idx };
    store.emit('overlay');
  }

  /**
   * Arrasta ponto ou alça (converte o mouse para o espaço do vetor).
   *  - Ponto: leva as próprias alças junto.
   *  - Alça: a alça oposta é espelhada (curva suave) — segure Alt para quebrar o espelho e fazer um bico.
   */
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

  /**
   * Alterna o ponto entre CANTO (sem alças) e SUAVE. Ao suavizar, cria alças opostas e proporcionais à direção entre
   * o ponto anterior e o próximo (quarto da distância), que dá uma curva natural.
   */
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

  /** Remove o ponto selecionado (mantém no mínimo 2 pontos). */
  function deletePoint() {
    const n = editNode();
    if (!n || ui.editPt == null || n.points.length <= 2) return false;
    store.update(() => { n.points.splice(ui.editPt, 1); });
    ui.editPt = null;
    commands.normalizePath(n);
    store.commit();
    return true;
  }

  /**
   * Alt+clique no traço: insere um ponto de canto no SEGMENTO mais próximo do clique. Para cada segmento calcula a
   * projeção do clique (parâmetro t entre 0 e 1) e a distância até esse ponto da reta; vence o menor.
   */
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
  /**
   * Markup SVG (em px de tela) do que a caneta mostra: o caminho em construção com o "elástico" até o cursor, os pontos
   * (o primeiro em rosa, indica onde fechar) e as alças; ou, na edição, os pontos do vetor (e as alças do ponto selecionado).
   * Elementos com data-edit/data-idx são clicáveis (tools.js os reconhece).
   */
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

  /** Está desenhando um caminho novo? */
  const isDrawing = () => !!ui.pen;
  /** Está editando os pontos de um vetor? */
  const isEditing = () => !!ui.editPathId;

  // API pública
  return {
    down, move, up, finish, startEdit, exitEdit, downEdit, togglePointType, deletePoint, addPointAt,
    overlaySvg, isDrawing, isEditing,
  };
}
