/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  pen.js — FERRAMENTA CANETA (VETORES) E EDIÇÃO DE PONTOS
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Cria e edita vetores com curvas de Bézier cúbicas. Cada ponto é { x, y, hin, hout }: hin/hout são as
 *  "alças" (pontos de controle) de entrada/saída; null significa ponto de canto (segmento reto).
 *  Os pontos vivem no espaço próprio do vetor (vw×vh) e a camada só estica esse espaço (ver model.js).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { nodePathData, pathData } from './css.js';
import { defaultFill, round } from './model.js';
import { contoursBounds, parsePathD } from './svgimport.js';

/**
 * Cria a CANETA. Dois modos, que não ficam ativos ao mesmo tempo:
 *
 *  A) DESENHAR (ui.pen): cada clique adiciona um ponto. Clicar e ARRASTAR cria um ponto "suave": o arrasto define a
 *     alça de saída (hout) e a de entrada (hin) é o espelho dela — é isso que faz a curva de Bézier. Clicar no 1º
 *     ponto fecha o caminho; Enter/Esc/duplo clique termina deixando-o aberto.
 *  B) EDITAR PONTOS (ui.editPathId): depois de criado, duplo clique no vetor mostra os pontos. Arrastar ponto/alça
 *     altera a forma; Alt+clique no traço adiciona ponto (SEGUINDO a curva, sem deformá-la); duplo clique no ponto
 *     alterna canto↔suave; Delete remove; setas movem o ponto (Shift = 10); Shift ao arrastar/desenhar trava em 45°.
 *     O painel Design (seção Vetor) edita o ponto selecionado (tipo, X/Y) e mostra/aceita o `d` do SVG.
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
  // ---- vários pontos selecionados (edição): `ui.editPts` = índices; `ui.editPt` = o principal (o último clicado)
  /** Índices dos pontos selecionados (sempre inclui o principal). */
  const selPts = () => (ui.editPts?.length ? ui.editPts : ui.editPt != null ? [ui.editPt] : []);
  /** Define a seleção de pontos e o ponto principal (por padrão, o último da lista). */
  const setSel = (arr, primary) => {
    ui.editPts = arr;
    ui.editPt = primary !== undefined ? primary : arr.length ? arr[arr.length - 1] : null;
  };
  // ---- encaixe na grade de pixels (ui.penSnap = 0 livre, ou 1, 2, 4, 8 px), medido a partir do canto do frame pai
  /** Origem (mundo) do pai do vetor em edição, ou do caminho em desenho: é daqui que a grade de encaixe conta. */
  const gridOrigin = (n) => {
    const p = n ? store.parentOf(n.id) : ui.pen?.parent;
    return p ? canvas.originOf(p.id) : { x: 0, y: 0 };
  };
  /** Arredonda um ponto do mundo para a grade de encaixe (sem encaixe ligado, devolve o próprio ponto). */
  const snapW = (w, o) => {
    const g = Number(ui.penSnap) || 0;
    return g ? { x: o.x + Math.round((w.x - o.x) / g) * g, y: o.y + Math.round((w.y - o.y) / g) * g } : w;
  };
  /** Com Shift: trava `p` em múltiplos de 45° a partir de `from` (mantém a distância). */
  const snap45 = (from, p) => {
    const dx = p.x - from.x, dy = p.y - from.y;
    const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const len = Math.hypot(dx, dy);
    return { x: from.x + Math.cos(ang) * len, y: from.y + Math.sin(ang) * len };
  };
  /** Ponto da curva de Bézier cúbica (a, c1, c2, b) no parâmetro t (0..1). */
  const cubicAt = (a, c1, c2, b, t) => {
    const u = 1 - t;
    return {
      x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
      y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
    };
  };
  /**
   * Ponto do traço MAIS PERTO de `l` (espaço do vetor), medindo na curva de verdade (não na corda reta).
   * Amostra 48 pontos por segmento. Devolve { i: segmento, t, d: distância, pt: ponto } ou null.
   */
  function nearestOnPath(n, l) {
    const pts = n.points;
    const segs = n.closed ? pts.length : pts.length - 1;
    let best = null;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const c1 = a.hout || a, c2 = b.hin || b;
      for (let k = 0; k <= 48; k++) {
        const t = k / 48, q = cubicAt(a, c1, c2, b, t);
        const d = Math.hypot(q.x - l.x, q.y - l.y);
        if (!best || d < best.d) best = { i, t, d, pt: q };
      }
    }
    return best;
  }
  /**
   * Divide o segmento a→b em `t` (algoritmo de De Casteljau) e devolve o ponto novo JÁ com as alças certas; ajusta as
   * alças de a e b. O desenho não muda: só ganha um ponto a mais no meio da curva.
   */
  function splitSegment(a, b, t) {
    const lerp = (p, q) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    if (!a.hout && !b.hin) { const m = lerp(a, b); return { x: m.x, y: m.y, hin: null, hout: null }; } // reto: ponto de canto
    const c1 = a.hout || a, c2 = b.hin || b;
    const p01 = lerp(a, c1), p12 = lerp(c1, c2), p23 = lerp(c2, b), p012 = lerp(p01, p12), p123 = lerp(p12, p23), m = lerp(p012, p123);
    if (a.hout) a.hout = p01;
    if (b.hin) b.hin = p23;
    return { x: m.x, y: m.y, hin: p012, hout: p123 };
  }

  // ------------------------------------------------------------------ criar com a caneta
  /**
   * Termina o desenho: cria a camada-vetor se há 2+ pontos e volta para a ferramenta Mover.
   * @param {boolean} [close=false]  true fecha o caminho (liga o último ponto ao primeiro)
   */
  function finish(close = false) {
    const pen = ui.pen;
    ui.pen = null;
    drag = null;
    if (pen && pen.pts.length >= 2) {
      // caminho CONTINUADO (partiu da ponta de um vetor existente): atualiza aquele vetor em vez de criar outro
      if (pen.replaceId && store.get(pen.replaceId)) commands.updatePathFromWorld(pen.replaceId, pen.pts, close);
      else commands.addPathFromWorld(pen.pts, close, pen.parent);
    }
    store.setTool('move');
    store.emit('overlay');
  }

  /**
   * Clique da caneta. Clicar perto (<9px de tela) do 1º ponto, com 2+ pontos, FECHA o caminho.
   * Senão adiciona um ponto de canto e começa um possível arrasto (que viraria alças de Bézier).
   * O frame sob o primeiro clique vira o pai da camada final.
   * Clicar na PONTA de um vetor aberto selecionado CONTINUA aquele caminho (como a caneta do Illustrator).
   * @returns o gesto de arrasto, ou null se o caminho foi fechado
   */
  function down(e) {
    let p = canvas.toWorld(e.clientX, e.clientY);
    if (!ui.pen) {
      const cont = continueAt(e);
      if (cont) {
        ui.pen = cont;
        drag = { kind: 'cont' };
        store.emit('overlay');
        return drag;
      }
      ui.pen = { pts: [], cursor: null, parent: frameUnder(e.clientX, e.clientY) };
    }
    const pen = ui.pen;
    if (pen.pts.length >= 2 && dist(screenOf(pen.pts[0]), screenOf(p)) < 9) {
      finish(true);
      return null;
    }
    if (e.shiftKey && pen.pts.length) p = snap45(pen.pts[pen.pts.length - 1], p); // Shift: segmento em múltiplos de 45°
    p = snapW(p, gridOrigin(null)); // encaixe na grade de pixels (se ligado)
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
    if (ui.pen) {
      const c = e.shiftKey && ui.pen.pts.length && drag?.kind !== 'pen' ? snap45(ui.pen.pts[ui.pen.pts.length - 1], p) : p;
      ui.pen.cursor = drag?.kind === 'pen' ? c : snapW(c, gridOrigin(null)); // o "elástico" também gruda na grade
    }
    if (drag?.kind === 'cont') { store.emit('overlay'); return; }
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
    if (was?.collapseTo != null && !was.moved) {
      setSel([was.collapseTo], was.collapseTo);
      store.emit('overlay');
      store.emit('selection');
    }
    if (was && was.kind !== 'pen' && was.kind !== 'cont') {
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
    setSel([], null);
    store.setSelection([id]);
    store.emit('overlay');
  }

  /** Sai da edição de pontos. */
  function exitEdit() {
    if (!ui.editPathId) return;
    ui.editPathId = null;
    setSel([], null);
    drag = null;
    store.emit('overlay');
  }

  /**
   * Clicou num ponto ou alça. `kind`: 'pt' (ponto), 'hin' ou 'hout' (alças).
   *  - Shift+clique num ponto: soma/tira o ponto da seleção (sem arrastar).
   *  - Alt+clique num ponto: converte canto ↔ suave (como a ferramenta "converter ponto" do Illustrator).
   *  - Clique/arrasto: seleciona o ponto (se já está num grupo selecionado, o grupo todo vai junto).
   */
  function downEdit(e, kind, idx) {
    const n = editNode();
    if (!n) return;
    const cur = selPts();
    if (kind === 'pt' && e.altKey) { setSel([idx], idx); togglePointType(idx); store.emit('selection'); return; }
    if (kind === 'pt' && e.shiftKey) {
      setSel(cur.includes(idx) ? cur.filter((i) => i !== idx) : [...cur, idx], idx);
      store.emit('overlay');
      store.emit('selection');
      return;
    }
    if (!cur.includes(idx)) setSel([idx], idx); else ui.editPt = idx;
    // clicou num ponto que já fazia parte de um GRUPO: se for só um clique (sem arrastar), a seleção reduz a esse ponto
    const collapseTo = kind === 'pt' && cur.length > 1 && cur.includes(idx) ? idx : null;
    drag = { kind, idx, collapseTo, moved: false, origin: { x: n.points[idx].x, y: n.points[idx].y } }; // origin: para travar o eixo com Shift
    store.emit('overlay');
    store.emit('selection'); // o painel Design mostra o ponto selecionado
  }

  /**
   * Arrasta ponto ou alça (converte o mouse para o espaço do vetor).
   *  - Ponto: leva as próprias alças junto.
   *  - Alça: a alça oposta é espelhada (curva suave) — segure Alt para quebrar o espelho e fazer um bico.
   */
  function moveEditHandle(world, e) {
    const n = editNode();
    if (!n || !drag) return;
    drag.moved = true;
    // pontos encaixam na grade de pixels (alças ficam livres); com vários selecionados, o principal é quem encaixa
    let l = toLocal(n, drag.kind === 'pt' ? snapW(world, gridOrigin(n)) : world);
    const ref = drag.kind === 'pt' ? drag.origin : n.points[drag.idx];
    if (e.shiftKey && ref) l = snap45(ref, l); // Shift: trava em múltiplos de 45° (ponto: a partir de onde estava; alça: a partir do ponto)
    store.update(() => {
      const pt = n.points[drag.idx];
      if (drag.kind === 'pt') {
        const dx = l.x - pt.x, dy = l.y - pt.y;
        // todos os pontos selecionados andam juntos (cada um leva as próprias alças)
        for (const i of selPts()) {
          const q = n.points[i];
          if (!q) continue;
          q.x += dx; q.y += dy;
          if (q.hin) { q.hin.x += dx; q.hin.y += dy; }
          if (q.hout) { q.hout.x += dx; q.hout.y += dy; }
        }
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

  /** Remove os pontos selecionados (o caminho mantém no mínimo 2 pontos). */
  function deletePoint() {
    const n = editNode();
    const sel = [...selPts()].sort((a, b) => b - a);
    if (!n || !sel.length || n.points.length - sel.length < 2) return false;
    store.update(() => { for (const i of sel) n.points.splice(i, 1); });
    setSel([], null);
    commands.normalizePath(n);
    store.commit();
    store.emit('selection');
    return true;
  }

  /**
   * Alt+clique no traço: insere um ponto no lugar do traço mais perto do clique, MEDINDO NA CURVA (nearestOnPath) e
   * dividindo o segmento (splitSegment): num trecho curvo o ponto novo nasce com as alças certas e o desenho não muda.
   */
  function addPointAt(e) {
    const n = editNode();
    if (!n) return;
    const hit = nearestOnPath(n, toLocal(n, canvas.toWorld(e.clientX, e.clientY)));
    if (!hit) return;
    const pts = n.points;
    store.update(() => {
      const m = splitSegment(pts[hit.i], pts[(hit.i + 1) % pts.length], hit.t);
      pts.splice(hit.i + 1, 0, m);
    });
    setSel([hit.i + 1], hit.i + 1);
    commands.normalizePath(n);
    store.commit();
    store.emit('selection');
  }

  /** Com Alt pressionado, mostra um pontinho no traço onde o clique adicionaria um ponto (feedback antes de clicar). */
  function hover(e) {
    const n = editNode();
    let ghost = null;
    if (n && e.altKey) {
      const w = canvas.toWorld(e.clientX, e.clientY);
      const hit = nearestOnPath(n, toLocal(n, w));
      if (hit) {
        const gw = toWorld(n, hit.pt);
        if (dist(screenOf(gw), screenOf(w)) < 18) ghost = gw;
      }
    }
    if (ghost || ui.penGhost) { ui.penGhost = ghost; store.emit('overlay'); }
  }

  // ------------------------------------------------------------------ ponto selecionado: tipo, posição, setas
  /** Escala do espaço do vetor (vw×vh) para px da camada. */
  const scaleOf = (n) => ({ sx: n.w / (n.vw || 1), sy: n.h / (n.vh || 1) });

  /** Tipo do ponto selecionado: 'corner' (sem alças), 'smooth' (alças alinhadas e iguais) ou 'free' (qualquer outra). */
  function pointType() {
    const n = editNode();
    const pt = n && ui.editPt != null ? n.points[ui.editPt] : null;
    if (!pt) return null;
    if (!pt.hin && !pt.hout) return 'corner';
    if (pt.hin && pt.hout) {
      const a = { x: pt.hout.x - pt.x, y: pt.hout.y - pt.y }, b = { x: pt.x - pt.hin.x, y: pt.y - pt.hin.y };
      if (Math.hypot(a.x - b.x, a.y - b.y) < 0.01 * (Math.hypot(a.x, a.y) || 1)) return 'smooth';
    }
    return 'free';
  }

  /** Define o tipo dos pontos selecionados: 'corner' tira as alças; 'smooth' deixa as duas alças iguais e opostas. */
  function setPointType(type) {
    const n = editNode();
    if (!n || ui.editPt == null) return;
    store.update(() => {
      for (const idx of selPts()) {
        const pt = n.points[idx];
        if (!pt) continue;
        if (type === 'corner') { pt.hin = null; pt.hout = null; continue; }
        let v;
        if (pt.hout) v = { x: pt.hout.x - pt.x, y: pt.hout.y - pt.y };
        else if (pt.hin) v = { x: pt.x - pt.hin.x, y: pt.y - pt.hin.y };
        else {
          const prev = n.points[(idx - 1 + n.points.length) % n.points.length], next = n.points[(idx + 1) % n.points.length];
          v = { x: (next.x - prev.x) / 4, y: (next.y - prev.y) / 4 };
        }
        pt.hout = { x: pt.x + v.x, y: pt.y + v.y };
        pt.hin = { x: pt.x - v.x, y: pt.y - v.y };
      }
      commands.normalizePath(n);
    });
    store.commit();
    store.emit('selection');
  }

  /** Posição do ponto selecionado em px, relativa ao PAI da camada (como o X/Y da camada): { x, y } ou null. */
  function pointPos() {
    const n = editNode();
    const pt = n && ui.editPt != null ? n.points[ui.editPt] : null;
    if (!pt) return null;
    const { sx, sy } = scaleOf(n);
    return { x: round(n.x + pt.x * sx, 1), y: round(n.y + pt.y * sy, 1) };
  }

  /**
   * Move o ponto selecionado para X ou Y (px relativos ao pai), levando as alças junto. NÃO grava no histórico:
   * quem chama (o campo numérico do painel) faz o commit ao terminar.
   */
  function setPointPos(axis, v) {
    const n = editNode();
    if (!n || ui.editPt == null) return;
    const { sx, sy } = scaleOf(n);
    store.update(() => {
      const pt = n.points[ui.editPt];
      const dx = axis === 'x' ? (v - n.x) / sx - pt.x : 0, dy = axis === 'y' ? (v - n.y) / sy - pt.y : 0;
      pt.x += dx; pt.y += dy;
      if (pt.hin) { pt.hin.x += dx; pt.hin.y += dy; }
      if (pt.hout) { pt.hout.x += dx; pt.hout.y += dy; }
      commands.normalizePath(n);
    });
  }

  /** Setas movem o ponto selecionado (px do pai; Shift = 10). Devolve true se tratou a tecla. */
  function nudge(dx, dy) {
    const n = editNode();
    if (!n || ui.editPt == null) return false;
    const { sx, sy } = scaleOf(n);
    store.update(() => {
      const mx = dx / sx, my = dy / sy;
      for (const i of selPts()) {
        const pt = n.points[i];
        if (!pt) continue;
        pt.x += mx; pt.y += my;
        if (pt.hin) { pt.hin.x += mx; pt.hin.y += my; }
        if (pt.hout) { pt.hout.x += mx; pt.hout.y += my; }
      }
      commands.normalizePath(n);
    });
    store.commit();
    return true;
  }

  /** Inverte a direção do caminho (o primeiro ponto vira o último). O desenho não muda; setas de preenchimento e animações de traço sim. */
  function reverse(id) {
    const n = store.get(id || ui.editPathId);
    if (!n || n.type !== 'path') return;
    store.update(() => {
      n.points = n.points.reverse().map((p) => ({ x: p.x, y: p.y, hin: p.hout, hout: p.hin }));
      if (ui.editPt != null && ui.editPathId === n.id) {
        const last = n.points.length - 1;
        setSel(selPts().map((i) => last - i), last - ui.editPt);
      }
    });
    store.commit();
    store.emit('selection');
  }

  // ------------------------------------------------------------------ SVG: o `d` do caminho, para ler e colar
  /** O atributo `d` do SVG deste vetor (todos os contornos), no espaço próprio dele (viewBox 0 0 vw vh). */
  const pathD = (id) => {
    const n = store.get(id);
    return n?.type === 'path' ? nodePathData(n) : '';
  };

  /**
   * Substitui o desenho do vetor pelo `d` de um SVG (aceita M L H V C S Q T A Z, absolutos e relativos). Só mexe na
   * geometria: cor, contorno, nome e posição continuam. A caixa passa a ter o tamanho do desenho colado.
   * @returns {boolean} false se o texto não tem nenhum caminho
   */
  function applyPathD(id, d) {
    const n = store.get(id);
    if (!n || n.type !== 'path') return false;
    const contours = parsePathD(d);
    if (!contours.length || !contours[0].points.length) return false;
    // texto sem números de verdade (ex.: "abc") não vira forma: recusa em vez de gravar coordenadas NaN
    const ok = (p) => !p || (Number.isFinite(p.x) && Number.isFinite(p.y));
    if (!contours.every((c) => c.points.every((p) => ok(p) && ok(p.hin) && ok(p.hout)))) return false;
    const b = contoursBounds(contours);
    const sh = (p) => p && { x: round(p.x - b.x0), y: round(p.y - b.y0) };
    const fix = (c) => ({ closed: c.closed, points: c.points.map((p) => ({ x: round(p.x - b.x0), y: round(p.y - b.y0), hin: sh(p.hin), hout: sh(p.hout) })) });
    const [main, ...rest] = contours.map(fix);
    store.update(() => {
      n.points = main.points;
      n.closed = main.closed;
      if (rest.length) n.contours = rest; else delete n.contours;
      n.vw = round(b.x1 - b.x0) || 1;
      n.vh = round(b.y1 - b.y0) || 1;
      n.w = n.vw;
      n.h = n.vh;
      if (n.closed && n.fill.type === 'none') n.fill = defaultFill('#D9D9D9');
    });
    setSel([], null);
    store.commit();
    store.emit('selection');
    return true;
  }

  // ------------------------------------------------------------------ continuar caminho, seleção por caixa, cortar
  /**
   * Cliques da caneta na PONTA de um vetor aberto que está selecionado CONTINUAM aquele caminho: devolve um caminho
   * em desenho (ui.pen) já com os pontos do vetor, com a ponta clicada no fim. Não vale para vetor girado ou com furos.
   */
  function continueAt(e) {
    const click = canvas.toWorld(e.clientX, e.clientY);
    for (const n of store.selected()) {
      if (n.type !== 'path' || n.closed || n.rotation || n.contours?.length || n.points.length < 2 || !n.visible || n.locked) continue;
      const W = (pt) => ({ ...toWorld(n, pt), hin: pt.hin && toWorld(n, pt.hin), hout: pt.hout && toWorld(n, pt.hout) });
      const pts = n.points.map(W);
      const parent = store.parentOf(n.id);
      if (dist(screenOf(pts[pts.length - 1]), screenOf(click)) < 9) return { pts, cursor: null, parent, replaceId: n.id };
      if (dist(screenOf(pts[0]), screenOf(click)) < 9) {
        // clicou no INÍCIO: inverte a ordem (e troca hin/hout) para a ponta clicada ficar no fim
        return { pts: pts.reverse().map((p) => ({ x: p.x, y: p.y, hin: p.hout, hout: p.hin })), cursor: null, parent, replaceId: n.id };
      }
    }
    return null;
  }

  /** Começa um retângulo de seleção de PONTOS (arrastar no vazio durante a edição). Shift soma à seleção atual. */
  function marqueeStart(e, onBody) {
    return {
      type: 'penmarquee', onBody, sx: e.clientX, sy: e.clientY, moved: false,
      p0: canvas.toWorld(e.clientX, e.clientY), base: e.shiftKey ? [...selPts()] : [],
    };
  }
  /** Atualiza o retângulo e seleciona os pontos que caem dentro dele. */
  function marqueeMove(e, d) {
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
    d.moved = true;
    const n = editNode();
    if (!n) return;
    const p = canvas.toWorld(e.clientX, e.clientY);
    const m = { x: Math.min(d.p0.x, p.x), y: Math.min(d.p0.y, p.y), w: Math.abs(p.x - d.p0.x), h: Math.abs(p.y - d.p0.y) };
    ui.marquee = m;
    const hit = [];
    n.points.forEach((pt, i) => {
      const w = toWorld(n, pt);
      if (w.x >= m.x && w.x <= m.x + m.w && w.y >= m.y && w.y <= m.y + m.h) hit.push(i);
    });
    setSel([...new Set([...d.base, ...hit])]);
    store.emit('overlay');
    store.emit('selection');
  }
  /** Soltou: sem arrastar, clicar no vazio limpa os pontos (e, fora do vetor, sai da edição e desmarca). */
  function marqueeEnd(d) {
    ui.marquee = null;
    if (!d.moved) {
      if (d.onBody) { if (!d.base.length) { setSel([], null); store.emit('selection'); } }
      else { exitEdit(); store.setSelection([]); }
    }
    store.emit('overlay');
  }
  /** Seleciona todos os pontos do vetor em edição (Ctrl+A). */
  function selectAll() {
    const n = editNode();
    if (!n) return;
    setSel(n.points.map((_, i) => i));
    store.emit('overlay');
    store.emit('selection');
  }
  /** Quantos pontos estão selecionados. */
  const selectedCount = () => selPts().length;

  /**
   * "Abrir aqui": num caminho FECHADO, corta o segmento logo DEPOIS do ponto selecionado e o caminho vira aberto
   * (o ponto seguinte passa a ser o início). É a tesoura do Illustrator, em versão simples.
   */
  function openAfter() {
    const n = editNode();
    if (!n || !n.closed || ui.editPt == null) return;
    const i = ui.editPt;
    store.update(() => {
      const pts = n.points;
      n.points = [...pts.slice(i + 1), ...pts.slice(0, i + 1)];
      n.closed = false;
    });
    setSel([], null);
    commands.normalizePath(n);
    store.commit();
    store.emit('selection');
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
    if (ui.penGhost) {
      const g = S(ui.penGhost);
      out.push(`<circle cx="${g.x}" cy="${g.y}" r="5" class="pen-ghost"/>`);
    }
    const n = editNode();
    if (n) {
      n.points.forEach((pt, i) => {
        const p = S(toWorld(n, pt));
        const hin = pt.hin && S(toWorld(n, pt.hin)), hout = pt.hout && S(toWorld(n, pt.hout));
        const sel = selPts().includes(i);
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
    down, move, up, finish, startEdit, exitEdit, downEdit, togglePointType, deletePoint, addPointAt, hover,
    pointType, setPointType, pointPos, setPointPos, nudge, reverse, pathD, applyPathD,
    marqueeStart, marqueeMove, marqueeEnd, selectAll, selectedCount, openAfter,
    overlaySvg, isDrawing, isEditing,
  };
}
