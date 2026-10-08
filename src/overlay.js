/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  overlay.js — INTERFACE POR CIMA DO CANVAS (seleção, alças, guias, medidas...)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Desenha, em pixels de tela, tudo o que acompanha o canvas mas não faz parte do design: caixa de seleção
 *  com alças de redimensionar/rotacionar, nomes dos frames, guias de snap e de régua, grades de layout,
 *  medidas com Alt, a caneta e as setas do protótipo.
 *
 *  Importante: o overlay NÃO trata o mouse (quem trata é tools.js). Aqui só se desenha e se marca cada
 *  alça com data-handle / data-rotate / data-label / data-guide para o tools.js saber o que foi clicado.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { round, walk } from './model.js';
import { rgba, generateCode } from './css.js';

/**
 * As 8 alças de redimensionar. Valor = posição relativa dentro da caixa (0..1): [0,0] canto superior esquerdo,
 * [1,0.5] meio da borda direita... Como as alças são FILHAS da caixa de seleção (que pode estar girada), elas
 * giram junto sem nenhuma conta extra — só posicionamos por porcentagem.
 */
const HANDLES = {
  nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5],
};
/** Ângulo (graus) para o qual cada alça "aponta" com a caixa sem rotação. Base para escolher o cursor certo. */
const BASE_ANGLE = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 };
/** Cursores de redimensionar, indexados por múltiplos de 45° (módulo 180). */
const CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];

/**
 * Escolhe o cursor da alça levando a ROTAÇÃO da camada em conta: uma alça "leste" numa caixa girada 90° deve mostrar
 * o cursor vertical. Soma o ângulo base da alça + rotação e arredonda para o múltiplo de 45° mais próximo.
 */
export const handleCursor = (handle, rot) => {
  const a = (((BASE_ANGLE[handle] + rot) % 180) + 180) % 180;
  return CURSORS[Math.round(a / 45) % 4];
};

/**
 * Distâncias entre a seleção A e a camada B (retângulos {x,y,w,h} no mundo) — o "Alt" do Figma.
 * Casos: (1) A dentro de B → as 4 margens internas; (2) separadas → o vão horizontal e/ou vertical, desenhado
 * no meio da faixa onde os dois se sobrepõem; (3) sobrepostas parcialmente → nada.
 * Função PURA (testada em tests/features.test.js).
 * @returns {{x1:number,y1:number,x2:number,y2:number,len:number}[]} segmentos a desenhar
 */
export function measures(A, B) {
  const out = [];
  // ov: faixa de sobreposição entre dois intervalos [a0,a1] e [b0,b1]
  const ov = (a0, a1, b0, b1) => [Math.max(a0, b0), Math.min(a1, b1)];
  // (1) A inteiramente dentro de B
  const inside = A.x >= B.x && A.y >= B.y && A.x + A.w <= B.x + B.w && A.y + A.h <= B.y + B.h;
  if (inside) {
    const cy = A.y + A.h / 2, cx = A.x + A.w / 2;
    out.push({ x1: B.x, y1: cy, x2: A.x, y2: cy, len: A.x - B.x }, { x1: A.x + A.w, y1: cy, x2: B.x + B.w, y2: cy, len: B.x + B.w - A.x - A.w },
      { x1: cx, y1: B.y, x2: cx, y2: A.y, len: A.y - B.y }, { x1: cx, y1: A.y + A.h, x2: cx, y2: B.y + B.h, len: B.y + B.h - A.y - A.h });
    return out.filter((m) => m.len > 0.01);
  }
  // (2) vão horizontal/vertical: a linha de medida fica no meio da sobreposição no outro eixo (ou no centro de A)
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

/**
 * Cria o OVERLAY: tudo o que é desenhado POR CIMA do canvas e que não pode escalar com o zoom
 * (alças sempre com 9px, bordas sempre finas): caixa de seleção, alças, zona de rotação, etiqueta de tamanho,
 * nomes dos frames, guias de snap, réguas de guia, grades de layout, medidas, caneta e setas do protótipo.
 *
 * Tudo vive em PIXELS DE TELA (converte do mundo com canvas.toScreen) dentro de `.overlay`, que tem
 * pointer-events:none — só alças, rótulos e guias reativam o mouse.
 *
 * @param {object} store
 * @param {object} canvas  geometria (aabb, worldBox, toScreen...)
 * @param {HTMLElement} viewport
 * @param {{penSvg?: () => string}} [hooks]  `penSvg` devolve o SVG da caneta/edição de pontos (vem de pen.js)
 */
export function createOverlay(store, canvas, viewport, hooks = {}) {
  const ui = store.ui;
  const root = document.createElement('div');
  root.className = 'overlay';
  viewport.append(root);

  // "pool" de elementos reutilizáveis por chave: em vez de recriar o overlay inteiro a cada movimento do mouse
  // (e perder o :hover/cursor), reaproveitamos os elementos e removemos só os que sobraram no fim do render.
  const pool = new Map();
  let used = new Set();

  /**
   * Pega (ou cria) o elemento do overlay identificado por `key`, com a classe `cls`, dentro de `parent`.
   * Marca a chave como usada neste render; as não usadas são removidas no final.
   */
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

  /** Posiciona/dimensiona um elemento em px de tela, com rotação opcional. */
  function place(el, x, y, w, h, rot = 0) {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.transform = rot ? `rotate(${rot}deg)` : '';
  }

  /** Caixa da camada em px de TELA: { cx, cy, w, h, rot } (centro + tamanho + rotação própria). */
  function screenBox(id) {
    const b = canvas.worldBox(id);
    if (!b) return null;
    const z = canvas.getView().zoom;
    const c = canvas.toScreen(b.cx, b.cy);
    return { cx: c.x, cy: c.y, w: b.w * z, h: b.h * z, rot: b.rot };
  }

  /**
   * Desenha uma caixa de seleção e, conforme `handles`, as alças:
   *   falsy → só a borda · 'plain' → 8 alças · 'full' → 8 alças + 4 zonas de rotação · 'line' → só as 2 pontas (linhas)
   * Alças de borda somem quando a caixa é minúscula (<24px), para não cobrirem o objeto.
   */
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

  /**
   * Redesenha o overlay inteiro (barato graças ao pool). Camadas, de baixo para cima:
   * nomes dos frames → hover → alvo de soltura → seleção → guias de snap → grades de layout → guias manuais →
   * grade de pixels → medidas (Alt) → caneta → setas do protótipo → marquee.
   */
  function render() {
    used = new Set();
    const page = store.page();
    const z = canvas.getView().zoom;
    const sel = ui.selection.filter((id) => store.get(id));
    const editing = !!ui.editingId;

    // ---- nome de cada frame da raiz, acima do canto superior esquerdo (clicar nele seleciona/arrasta o frame)
    // (frames da raiz, seções e as telas dentro das seções)
    const boards = page.children.flatMap((n) => (n.type === 'section' ? [n, ...n.children] : [n]));
    for (const n of boards) {
      if ((n.type !== 'frame' && n.type !== 'section') || !n.visible) continue;
      const b = canvas.aabb(n.id);
      if (!b) continue;
      const p = canvas.toScreen(b.x, b.y);
      const el = get(`label:${n.id}`, `board-label${n.type === 'section' ? ' section' : ''}${sel.includes(n.id) ? ' selected' : ''}`);
      if (el.textContent !== n.name) el.textContent = n.name;
      el.dataset.label = n.id;
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y - 22}px`;
      el.style.maxWidth = `${Math.max(40, b.w * z)}px`;
    }

    // ---- pinos de COMENTÁRIO: um por comentário aberto da página (o que está em destaque aparece mesmo resolvido) e o
    // rascunho (ferramenta Comentar). O número é a posição do comentário na lista do painel.
    {
      const list = (store.state.doc.comments || []).filter((c) => store.get(c.nodeId));
      const pin = (key, cls, text, nodeId, rx, ry, id) => {
        const b = canvas.aabb(nodeId);
        if (!b) return;
        const p = canvas.toScreen(b.x + b.w * rx, b.y + b.h * ry);
        const el = get(key, cls);
        if (id) el.dataset.comment = id; else delete el.dataset.comment;
        if (el.textContent !== text) el.textContent = text;
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
      };
      list.forEach((c, i) => {
        if (c.resolved && ui.activeComment !== c.id) return;
        pin(`cm:${c.id}`, `comment-pin${c.resolved ? ' resolved' : ''}${ui.activeComment === c.id ? ' active' : ''}`, String(i + 1), c.nodeId, c.rx, c.ry, c.id);
      });
      const dr = ui.commentDraft;
      if (dr && store.get(dr.nodeId)) pin('cm:draft', 'comment-pin draft', '+', dr.nodeId, dr.rx, dr.ry, null);
    }

    // ---- NOTAS: um post-it amarelo acima do canto direito de cada camada que tem nota (ligar/desligar em Exibir → Notas).
    // A camada selecionada mostra a nota inteira; as outras mostram só a 1ª linha. Clicar abre a nota no painel.
    if (ui.showNotes !== false) {
      walk(page.children, (n) => {
        if (!n.note || !n.visible) return;
        const b = canvas.aabb(n.id);
        if (!b) return;
        const p = canvas.toScreen(b.x + b.w, b.y);
        const open = sel.includes(n.id);
        const el = get(`note:${n.id}`, `note-chip${open ? ' open' : ''}`);
        el.dataset.note = n.id;
        // com pouco zoom os post-its viram só o ícone (senão cobririam o design)
        const text = open ? n.note : z < 0.5 ? '' : n.note.split('\n')[0];
        el.classList.toggle('mini', !open && z < 0.5);
        if (el.textContent !== text) el.textContent = text;
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
        el.style.maxWidth = `${open ? 260 : Math.max(120, Math.min(220, b.w * z))}px`;
      });
    }

    // ---- contorno fino da camada sob o mouse (só com a ferramenta Mover, e não durante arrastos)
    if (ui.hoverId && ui.tool === 'move' && !sel.includes(ui.hoverId) && !ui.dragIds) {
      const box = screenBox(ui.hoverId);
      if (box) drawBox('hover', box, 'sel-box hover');
    }

    // ---- INSPECIONAR (como o F12): margem, padding e conteúdo coloridos + etiqueta com o CSS de verdade
    if (ui.tool === 'inspect' && ui.hoverId && store.get(ui.hoverId)) drawInspect(ui.hoverId);

    // ---- frame de destino destacado enquanto você arrasta algo para dentro dele
    if (ui.dropTarget) {
      const box = screenBox(ui.dropTarget);
      if (box) drawBox('drop', box, 'sel-box drop');
    }

    // enquanto as medidas do Alt estão visíveis, a etiqueta de tamanho some (as duas se sobreporiam)
    const measuring = ui.altDown && sel.length && ui.hoverId && !sel.includes(ui.hoverId) && !ui.dragIds;
    // ---- seleção: 1 camada = caixa (girada se preciso) com alças e etiqueta "L × A"; várias = contorno fino de cada
    // uma + caixa geral (sem rotação) com alças que escalam o conjunto
    if (sel.length === 1) {
      const box = screenBox(sel[0]);
      if (box) {
        const type = store.get(sel[0]).type;
        drawBox('sel', box, 'sel-box', editing || ui.editPathId ? null : type === 'line' ? 'line' : 'full');
        if (!measuring) pill(canvas.aabb(sel[0]), `${round(canvas.worldBox(sel[0]).w, 1)} × ${round(canvas.worldBox(sel[0]).h, 1)}`);
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
        if (!measuring) pill(u, `${round(u.w, 1)} × ${round(u.h, 1)}`);
      }
    }

    // ---- linhas rosa de SNAP que aparecem durante o arrasto quando bordas/centros se alinham
    (ui.guides || []).forEach((g, i) => {
      const a = canvas.toScreen(g.axis === 'x' ? g.pos : g.from, g.axis === 'x' ? g.from : g.pos);
      const b = canvas.toScreen(g.axis === 'x' ? g.pos : g.to, g.axis === 'x' ? g.to : g.pos);
      const el = get(`guide:${i}`, 'guide');
      place(el, a.x, a.y, g.axis === 'x' ? 1 : b.x - a.x, g.axis === 'x' ? b.y - a.y : 1);
    });

    // ---- CELAS DO CSS GRID: com um frame em modo grid selecionado (ou um item dele), desenha as células reais
    // (tamanhos lidos do estilo calculado do navegador, então valem até para linhas automáticas e span)
    {
      const owners = new Set();
      for (const id of sel) {
        const n = store.get(id), p = store.parentOf(id);
        if (n?.type === 'frame' && n.layout?.mode === 'grid') owners.add(n.id);
        if (p?.type === 'frame' && p.layout?.mode === 'grid') owners.add(p.id);
      }
      let gi = 0;
      for (const oid of owners) {
        const gel = canvas.els.get(oid);
        if (!gel) continue;
        const cs = getComputedStyle(gel);
        const tracks = (v) => (v && v !== 'none' ? v.split(' ').map(parseFloat).filter(Number.isFinite) : []);
        const cols = tracks(cs.gridTemplateColumns), rows = tracks(cs.gridTemplateRows);
        if (!cols.length || !rows.length) continue;
        const cg = parseFloat(cs.columnGap) || 0, rg = parseFloat(cs.rowGap) || 0;
        const o = canvas.originOf(oid);
        let y = o.y + (parseFloat(cs.paddingTop) || 0);
        const x0 = o.x + (parseFloat(cs.paddingLeft) || 0);
        for (const rh of rows) {
          let x = x0;
          for (const cw of cols) {
            const p = canvas.toScreen(x, y);
            place(get(`gc:${gi++}`, 'grid-cell'), p.x, p.y, cw * z, rh * z);
            x += cw + cg;
          }
          y += rh + rg;
        }
      }
    }

    // ---- grades de layout do frame (colunas/linhas/quadrícula): só guia visual, não geram CSS.
    // colunas: largura = (total - gutters) / quantidade; começa depois da margem.
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
                if (sz < 4) continue; // células de menos de 4px de tela viram uma mancha: não desenha
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

    // ---- guias manuais (criadas arrastando das réguas). Faixa de 7px de largura para ser fácil de pegar;
    // a linha visível (1px) é desenhada pelo CSS. Também mostra a guia sendo criada + etiqueta com a posição.
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

    // ---- grade de pixels: a partir de 800% de zoom, mostra a malha de 1px (ajuda em ícones/pixel-perfect)
    const v0 = canvas.getView();
    const pix = v0.zoom >= 8;
    root.classList.toggle('pixels', pix);
    if (pix) {
      root.style.backgroundSize = `${v0.zoom}px ${v0.zoom}px`;
      root.style.backgroundPosition = `${v0.x}px ${v0.y}px`;
    } else root.style.backgroundSize = '';

    // ---- medidas: com Alt pressionado e o mouse sobre OUTRA camada, mostra as distâncias até ela (função measures)
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

    // ---- caneta e edição de pontos: o SVG vem de pen.js (por um gancho) para este arquivo não depender dele
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

    // ---- setas do protótipo: curva de Bézier da camada com interação até o frame de destino (todas na aba
    // Protótipo; só as da seleção nas outras abas)
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
          // Escolhe o lado de SAÍDA e de ENTRADA conforme onde o destino está: à direita (direita→esquerda), à esquerda
          // (esquerda→direita) ou, se estiverem alinhados na horizontal, embaixo/em cima (vertical). Sem isso, uma seta
          // que volta para uma tela à esquerda daria um laço atravessando o desenho.
          const sepX = b.x >= a.x + a.w || b.x + b.w <= a.x;
          let p1, p2, c1, c2, head;
          if (sepX) {
            const dir = b.x >= a.x + a.w ? 1 : -1;
            p1 = canvas.toScreen(dir === 1 ? a.x + a.w : a.x, a.y + a.h / 2);
            p2 = canvas.toScreen(dir === 1 ? b.x : b.x + b.w, b.y + b.h / 2);
            const k = Math.max(60, Math.abs(p2.x - p1.x) / 2) * dir;
            c1 = { x: p1.x + k, y: p1.y }; c2 = { x: p2.x - k, y: p2.y };
            head = `M ${p2.x} ${p2.y} l ${-10 * dir} -5 l 0 10 z`;
          } else {
            const dir = b.y >= a.y + a.h ? 1 : -1;
            p1 = canvas.toScreen(a.x + a.w / 2, dir === 1 ? a.y + a.h : a.y);
            p2 = canvas.toScreen(b.x + b.w / 2, dir === 1 ? b.y : b.y + b.h);
            const k = Math.max(60, Math.abs(p2.y - p1.y) / 2) * dir;
            c1 = { x: p1.x, y: p1.y + k }; c2 = { x: p2.x, y: p2.y - k };
            head = `M ${p2.x} ${p2.y} l -5 ${-10 * dir} l 10 0 z`;
          }
          arrows.push(`<circle cx="${p1.x}" cy="${p1.y}" r="4" class="proto-arrow"/><path d="M ${p1.x} ${p1.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}" class="proto-path"/><path d="${head}" class="proto-arrow"/>`);
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

    // ---- retângulo de seleção por arrasto (marquee)
    if (ui.marquee) {
      const m = ui.marquee;
      const p = canvas.toScreen(m.x, m.y);
      place(get('marquee', 'marquee'), p.x, p.y, m.w * z, m.h * z);
    }

    // limpeza: remove do DOM o que não foi usado neste render
    for (const [key, el] of pool) {
      if (!used.has(key)) {
        el.remove();
        pool.delete(key);
      }
    }
  }

  // ------------------------------------------------------------------ inspecionar (F12)
  /** Muda a cada alteração do documento: invalida o "mapa de classes" do inspetor. */
  let docVersion = 0;
  /** Cache do mapa id → { tag, cls } da tela inspecionada (gerar o HTML da tela inteira a cada movimento seria caro). */
  let classCache = { key: '', map: new Map() };
  /**
   * Etiqueta HTML e classe CSS que a camada recebe NO CÓDIGO EXPORTADO. As classes dependem da tela inteira (nomes
   * repetidos ganham -2, -3...), então gera o código da tela onde a camada está (uma vez por versão do documento).
   */
  function exportedName(id) {
    let screen = store.get(id);
    for (let p = store.parentOf(screen.id); p && p.type !== 'section'; p = store.parentOf(p.id)) screen = p;
    const key = `${screen.id}:${docVersion}`;
    if (classCache.key !== key) {
      const doc = store.state.doc;
      const { html } = generateCode([screen], null, doc.assets, { root: true, styles: doc.styles, ids: true });
      const map = new Map();
      for (const m of html.matchAll(/<([a-z0-9]+) class="([^"]*)"[^>]*? data-node-id="([^"]*)"/g)) map.set(m[3], { tag: m[1], cls: m[2] });
      classCache = { key, map };
    }
    return classCache.map.get(id) || null;
  }

  /**
   * Desenha o "box model" da camada como o DevTools: margem (laranja), padding (verde) e conteúdo (azul), medidos
   * no próprio elemento do canvas (getComputedStyle = o CSS que o navegador está aplicando de verdade), e a etiqueta
   * com etiqueta HTML, classe, tamanho e as propriedades principais.
   */
  function drawInspect(id) {
    const el = canvas.els.get(id);
    if (!el || !el.isConnected) return;
    const z = canvas.getView().zoom;
    const vp = viewport.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const px = (v) => parseFloat(v) || 0;
    const side = (prop) => ['Top', 'Right', 'Bottom', 'Left'].map((s) => px(cs[`${prop}${s}`]));
    const m = side('margin'), pd = side('padding');
    const bw = ['Top', 'Right', 'Bottom', 'Left'].map((s) => px(cs[`border${s}Width`]));
    const x = r.left - vp.left, y = r.top - vp.top;
    // margem: a caixa de fora (só quando existe)
    if (m.some(Boolean)) place(get('insp:m', 'insp-margin'), x - m[3] * z, y - m[0] * z, r.width + (m[1] + m[3]) * z, r.height + (m[0] + m[2]) * z);
    // a caixa do elemento (fundo verde = padding) e, por cima, a área do conteúdo (azul)
    place(get('insp:b', 'insp-box'), x, y, r.width, r.height);
    const cx = x + (bw[3] + pd[3]) * z, cy = y + (bw[0] + pd[0]) * z;
    const cw = Math.max(0, r.width - (bw[1] + bw[3] + pd[1] + pd[3]) * z), ch = Math.max(0, r.height - (bw[0] + bw[2] + pd[0] + pd[2]) * z);
    place(get('insp:c', 'insp-content'), cx, cy, cw, ch);
    drawInspectInside(id, cs, { cx, cy, cw, ch, z, vp });

    // etiqueta: <tag>.classe  L × A  + o CSS que importa
    const node = store.get(id);
    const name = exportedName(id);
    const fmt = (arr) => (arr.every((v) => v === arr[0]) ? `${Math.round(arr[0])}` : arr.map((v) => Math.round(v)).join(' '));
    const rows = [];
    const display = cs.display === 'flex' ? `flex · ${cs.flexDirection}` : cs.display;
    rows.push(['display', display]);
    if (cs.display === 'flex' || cs.display === 'grid') {
      if (px(cs.rowGap) || px(cs.columnGap)) rows.push(['gap', cs.rowGap === cs.columnGap ? cs.rowGap : `${cs.rowGap} ${cs.columnGap}`]);
      // no grid o que alinha cada item na célula é justify-items; no flex, justify-content
      if (cs.display === 'grid') {
        rows.push(['justify / align', `${cs.justifyItems} / ${cs.alignItems}`]);
        const cols = cs.gridTemplateColumns.split(' ').map((v) => `${Math.round(parseFloat(v))}px`);
        rows.push(['colunas', `${cols.length} (${cols.length > 6 ? `${cols.slice(0, 6).join(' ')} …` : cols.join(' ')})`]);
      } else rows.push(['justify / align', `${cs.justifyContent} / ${cs.alignItems}`]);
    }
    if (node.children?.length) rows.push(['filhos', `${node.children.length}`]);
    if (pd.some(Boolean)) rows.push(['padding', fmt(pd)]);
    if (m.some(Boolean)) rows.push(['margin', fmt(m)]);
    rows.push(['position', cs.position]);
    if (node.type === 'text') {
      rows.push(['font', `${cs.fontSize} / ${cs.fontWeight} · ${cs.fontFamily.split(',')[0].replace(/["']/g, '')}`]);
      rows.push(['color', cs.color]);
    } else if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') rows.push(['background', cs.backgroundColor]);
    if (cs.borderRadius && cs.borderRadius !== '0px') rows.push(['border-radius', cs.borderRadius]);
    const tip = get('insp:tip', 'insp-tip');
    const head = `<b>${name ? name.tag : 'div'}</b><i>.${name ? name.cls : ''}</i><span>${Math.round(r.width / z)} × ${Math.round(r.height / z)}</span>`;
    const body = rows.map(([k, v]) => `<div><em>${k}</em>${String(v).replace(/</g, '&lt;')}</div>`).join('');
    const htmlTip = `<header>${head}</header>${body}`;
    if (tip.innerHTML !== htmlTip) tip.innerHTML = htmlTip;
    // abaixo da caixa; se não couber, acima; sempre dentro da tela
    const tw = tip.offsetWidth || 240, th = tip.offsetHeight || 120;
    let ty = y + r.height + 8;
    if (ty + th > vp.height - 8) ty = Math.max(8, y - th - 8);
    tip.style.left = `${Math.max(8, Math.min(vp.width - tw - 8, x))}px`;
    tip.style.top = `${ty}px`;
  }

  /**
   * O que está DENTRO do elemento inspecionado, como o DevTools mostra num flex/grid:
   *  - contorno tracejado de cada filho visível (para ver onde cada item começa e termina);
   *  - GRID: as linhas de cada coluna e linha (lidas do CSS calculado: grid-template-columns/rows já em px) e os
   *    espaços entre elas (gap) hachurados;
   *  - FLEX: o espaço entre itens vizinhos (gap) hachurado.
   */
  function drawInspectInside(id, cs, { cx, cy, cw, ch, z, vp }) {
    const node = store.get(id);
    const kids = (node.children || []).slice(0, 300);
    const boxes = [];
    kids.forEach((c, i) => {
      const ce = canvas.els.get(c.id);
      if (!ce || !ce.isConnected) return;
      const cr = ce.getBoundingClientRect();
      if (!cr.width && !cr.height) return; // escondido (display: none)
      const b = { x: cr.left - vp.left, y: cr.top - vp.top, w: cr.width, h: cr.height };
      boxes.push(b);
      place(get(`insp:k:${i}`, 'insp-child'), b.x, b.y, b.w, b.h);
    });
    const gap = (key, x, y, w, h) => { if (w > 0.5 && h > 0.5) place(get(key, 'insp-gap'), x, y, w, h); };
    if (cs.display === 'grid') {
      // trilhas em px de verdade (o navegador já resolveu fr, repeat, minmax); começa no início do conteúdo
      const tracks = (v) => v.split(' ').map(parseFloat).filter((n) => !Number.isNaN(n));
      const cols = tracks(cs.gridTemplateColumns), rows = tracks(cs.gridTemplateRows);
      const cg = parseFloat(cs.columnGap) || 0, rg = parseFloat(cs.rowGap) || 0;
      let gx = cx;
      cols.forEach((w, i) => {
        place(get(`insp:gc:${i}a`, 'insp-line v'), gx, cy, 0, ch);
        gx += w * z;
        place(get(`insp:gc:${i}b`, 'insp-line v'), gx, cy, 0, ch);
        if (i < cols.length - 1) { gap(`insp:gg:c${i}`, gx, cy, cg * z, ch); gx += cg * z; }
      });
      let gy = cy;
      rows.forEach((hh, i) => {
        place(get(`insp:gr:${i}a`, 'insp-line h'), cx, gy, cw, 0);
        gy += hh * z;
        place(get(`insp:gr:${i}b`, 'insp-line h'), cx, gy, cw, 0);
        if (i < rows.length - 1) { gap(`insp:gg:r${i}`, cx, gy, cw, rg * z); gy += rg * z; }
      });
    } else if (cs.display === 'flex' && boxes.length > 1 && (parseFloat(cs.columnGap) || parseFloat(cs.rowGap))) {
      // gap entre vizinhos (na ordem do DOM) no eixo principal; com quebra de linha, só entre itens da mesma linha/coluna
      const row = cs.flexDirection.startsWith('row');
      for (let i = 1; i < boxes.length; i++) {
        const a = boxes[i - 1], b = boxes[i];
        if (row && b.x > a.x + a.w) gap(`insp:fg:${i}`, a.x + a.w, cy, b.x - (a.x + a.w), ch);
        if (!row && b.y > a.y + a.h) gap(`insp:fg:${i}`, cx, a.y + a.h, cw, b.y - (a.y + a.h));
      }
    }
  }

  /** Etiqueta azul "L × A" logo abaixo da seleção. */
  function pill(aabb, text) {
    if (!aabb) return;
    const p = canvas.toScreen(aabb.x + aabb.w / 2, aabb.y + aabb.h);
    const el = get('pill', 'size-pill');
    if (el.textContent !== text) el.textContent = text;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y + 12}px`;
  }

  // o overlay precisa estar sempre em dia com o canvas: redesenha de forma síncrona nesses eventos
  store.subscribeSync((reason) => {
    if (reason === 'doc' || reason === 'history' || reason === 'bp') docVersion++;
    if (['doc', 'selection', 'view', 'overlay', 'hover', 'bp', 'tool'].includes(reason)) render();
  });
  render();

  return { render, root };
}
