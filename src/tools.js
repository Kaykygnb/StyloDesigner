/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  tools.js — INTERAÇÃO: MOUSE E TECLADO NO CANVAS
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Seleção, mover (com snap e reordenação de auto layout), redimensionar, rotacionar, desenhar, marquee,
 *  pan/zoom, edição de texto, guias e TODOS os atalhos de teclado.
 *
 *  PADRÃO DE UM GESTO
 *    pointerdown → escolhe o gesto e guarda o estado inicial em `drag`
 *    pointermove → recalcula a partir do estado inicial (nunca acumula) e atualiza o documento ao vivo
 *    pointerup   → `store.commit()` UMA vez: um Ctrl+Z desfaz o gesto inteiro
 *
 *  Este arquivo NÃO desenha nada (isso é overlay.js/canvas.js) e delega operações que mexem na árvore
 *  (agrupar, duplicar, alinhar...) para commands.js.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { applyConstraints, createNode, hasLayout, isFlow, nextName, round, scaleNode, uid } from './model.js';
import { createPen } from './pen.js';
import { RULER } from './rulers.js';

/** Ferramentas em que clicar/arrastar no canvas CRIA uma camada nova. */
const DRAW_TOOLS = ['frame', 'rect', 'ellipse', 'text', 'line', 'polygon', 'star'];
/** Atalho de teclado → ferramenta (V mover, F/B frame, R retângulo, E elipse, T texto, H mão, P caneta, L linha). */
const TOOL_KEYS = { v: 'move', f: 'frame', b: 'frame', r: 'rect', e: 'ellipse', t: 'text', h: 'hand', p: 'pen', l: 'line' };
/** Quantos px de tela o mouse precisa andar para um clique virar ARRASTO (evita mover sem querer ao clicar). */
const THRESHOLD = 3; // px de tela antes de considerar que é um arrasto
/** Cópia profunda via JSON (usada para guardar o estado inicial de um gesto). */
const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * Cria as FERRAMENTAS: toda a interação do usuário com o canvas via mouse e teclado.
 *
 * Funciona como uma máquina de estados simples: `drag` guarda o gesto em andamento
 * (null | 'pan' | 'move' | 'resize' | 'rotate' | 'draw' | 'marquee' | 'pen' | 'guide'):
 *   pointerdown → decide o que o clique significa e preenche `drag`
 *   pointermove → atualiza o documento ao vivo conforme o tipo de `drag` (sem histórico)
 *   pointerup   → encerra o gesto e dá UM `store.commit()` (um Ctrl+Z desfaz o gesto inteiro)
 *
 * @param {{store, canvas, commands, viewport: HTMLElement, toast: (msg:string)=>void}} deps
 * @returns {{startEdit, finishEdit, copyCss, toggleProp, zoomTo, pen}} funções que a interface (menus/botões) também usa
 */
export function createTools({ store, canvas, commands, viewport, toast }) {
  // atalho para o estado de interface
  const ui = store.ui;
  // gesto em andamento (ver descrição acima); null = nenhum
  let drag = null;
  // Espaço pressionado = a Mão temporária (arrastar move a vista)
  let spaceDown = false;
  // alvo do último pointerdown. Com "pointer capture" o evento dblclick chega com alvo = viewport, então guardamos o alvo real aqui
  let downTarget = null; // com pointer capture, o dblclick chega com alvo = viewport; guardamos o alvo real

  // ------------------------------------------------------------------ utilidades
  /** id da camada sob um elemento do DOM (sobe até o .node mais próximo), ou null se for fundo/overlay. */
  const nodeAt = (target) => target.closest?.('.node')?.dataset.id || null;

  /**
   * Qual camada um CLIQUE seleciona. Regra do Figma: grupos são uma peça só — clicar num filho seleciona o GRUPO;
   * duplo clique (ou Ctrl+clique) "entra" e seleciona o filho. Se algo dentro do grupo já está selecionado,
   * clicar noutro filho do mesmo grupo seleciona esse filho direto.
   */
  function pickSelectable(id) {
    let result = id;
    for (let p = store.parentOf(id); p; p = store.parentOf(p.id)) {
      const inside = ui.selection.some((s) => s === p.id || store.isAncestor(p.id, s));
      if (p.type === 'group' && !inside) result = p.id;
    }
    return result;
  }

  /**
   * Frame mais fundo sob o ponteiro (ou null = fundo do canvas). Usa `elementsFromPoint` e IGNORA o overlay
   * (alças, rótulos: eles ficam embaixo do cursor durante o arrasto e atrapalhariam) e o que está sendo arrastado.
   * Serve para saber em qual frame uma camada foi solta/desenhada.
   */
  const frameUnder = (clientX, clientY) => {
    for (const el of document.elementsFromPoint(clientX, clientY)) {
      const node = el.closest?.('.node');
      if (!node || node.classList.contains('dragging') || node.closest('.dragging')) continue;
      const frame = node.closest('.node-frame');
      return frame ? store.get(frame.dataset.id) : null;
    }
    return null;
  };

  /**
   * Cor (sólida) que está VISÍVEL sob o ponteiro: a da camada mais de cima ali (ou de um pai dela) com preenchimento
   * sólido e opaco. null = o fundo do canvas. Usada para a forma nova não nascer da mesma cor do que está embaixo.
   */
  const colorUnder = (clientX, clientY) => {
    for (const el of document.elementsFromPoint(clientX, clientY)) {
      const id = el.closest?.('.node')?.dataset.id;
      if (!id) continue;
      for (let n = store.get(id); n; n = store.parentOf(n.id)) {
        if (n.visible && n.fill?.type === 'solid' && n.fill.opacity > 0.5 && n.opacity > 0.5) return n.fill.color;
      }
      return null;
    }
    return null;
  };
  /** Brilho percebido de uma cor #RRGGBB (0 = preto, 1 = branco). */
  const luma = (hex) => {
    const v = parseInt(String(hex).slice(1, 7), 16);
    return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
  };
  /**
   * Cor inicial de uma forma nova: a padrão, a não ser que ela fique INVISÍVEL sobre o que está embaixo (ex.: um
   * retângulo cinza desenhado em cima de outro cinza; um frame branco dentro de outro branco). Aí usa um tom que
   * contrasta: mais escuro sobre fundo claro, branco sobre fundo escuro.
   */
  function contrastingFill(color, under) {
    if (!under || Math.abs(luma(color) - luma(under)) >= 0.12) return color;
    if (luma(under) < 0.45) return '#FFFFFF';
    return luma(under) > 0.93 ? '#EDEDF2' : '#A9A9B6';
  }

  // a ferramenta caneta (vetores) vive em pen.js; aqui só a conectamos
  const pen = createPen({ store, canvas, commands, frameUnder });

  /**
   * Marca as camadas arrastadas (e descendentes): recebem a classe CSS 'dragging' (pointer-events:none), assim
   * `elementsFromPoint` enxerga o que está EMBAIXO delas. Aplica direto no DOM (o próximo render só vem depois).
   */
  const setDragIds = (nodes) => {
    ui.dragIds = nodes ? new Set(nodes.flatMap((n) => collectIds(n))) : null;
    // aplica já (o próximo render só roda depois que o item se mexer)
    for (const [id, el] of canvas.els) el.classList.toggle('dragging', !!ui.dragIds?.has(id));
  };
  /** ids de uma camada e de todos os descendentes. */
  const collectIds = (n) => [n.id, ...(n.children || []).flatMap(collectIds)];

  /** "Pointer capture": faz o viewport continuar recebendo o mouse mesmo que ele saia da janela durante o arrasto. */
  function capture(e) {
    try {
      viewport.setPointerCapture(e.pointerId);
    } catch { /* ignore */ }
  }

  // ------------------------------------------------------------------ texto
  /** Entra no modo de edição de texto da camada (o canvas dá foco e seleciona tudo; ver canvas.js → render). */
  function startEdit(id) {
    store.setSelection([id]);
    ui.editingId = id;
    store.emit('doc');
  }

  /**
   * Sai da edição de texto. Texto vazio apaga a camada (sem sobrar caixa invisível); senão grava no histórico.
   */
  function finishEdit() {
    const id = ui.editingId;
    if (!id) return;
    ui.editingId = null;
    const node = store.get(id);
    if (node && !node.text.trim()) {
      store.setSelection([id]);
      commands.deleteSelection(); // texto vazio = camada removida
    } else {
      store.commit();
    }
    store.emit('doc');
    store.emit('selection');
  }

  // Enquanto digita, copia o texto do elemento para o modelo (sem commit; o commit vem ao sair da edição).
  canvas.world.addEventListener('input', (e) => {
    if (!ui.editingId || nodeAt(e.target) !== ui.editingId) return;
    const text = e.target.textContent;
    store.update(() => { store.get(ui.editingId).text = text; });
  });
  // Perder o foco (clicar fora) encerra a edição.
  canvas.world.addEventListener('focusout', (e) => {
    if (ui.editingId && nodeAt(e.target) === ui.editingId) finishEdit();
  });

  // ------------------------------------------------------------------ pan e zoom
  /** Começa a arrastar a vista (botão do meio, Espaço+arrastar ou ferramenta Mão). */
  function startPan(e) {
    const v = canvas.getView();
    drag = { type: 'pan', x: e.clientX, y: e.clientY, vx: v.x, vy: v.y };
    viewport.classList.add('panning');
    capture(e);
  }

  // RODA DO MOUSE: Ctrl/⌘+roda (ou o modo "roda = zoom") dá zoom ancorado no cursor; sem Ctrl rola a vista
  // (Shift+roda rola na horizontal). O delta é limitado a ±25 para o zoom não "explodir" com mouses de roda dentada.
  viewport.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const r = canvas.vpRect();
      const v = canvas.getView();
      const zoomMode = e.ctrlKey || e.metaKey || ui.wheelMode === 'zoom';
      if (zoomMode) {
        const d = Math.max(-25, Math.min(25, e.deltaY));
        canvas.zoomAt(v.zoom * Math.exp(-d * 0.01), e.clientX - r.left, e.clientY - r.top);
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        canvas.setView({ x: v.x - dx, y: v.y - dy });
      }
    },
    { passive: false },
  );

  // ------------------------------------------------------------------ pointer down
  /**
   * POINTER DOWN — o começo de todo gesto. Decide o que o clique significa, nesta ordem de prioridade:
   *  1. pan (botão do meio / Espaço / ferramenta Mão)
   *  2. clicar fora do texto em edição → encerra a edição
   *  3. caneta: adiciona ponto · editando vetor: arrasta ponto/alça · guia de régua: arrasta a guia
   *  4. ferramenta de desenho: cria a camada
   *  5. alça de redimensionar / zona de rotação
   *  6. ferramenta Mover: seleciona e começa a mover; fundo vazio começa o marquee
   */
  viewport.addEventListener('pointerdown', (e) => {
    // guarda o alvo real (ver downTarget acima)
    downTarget = e.target;
    const tool = ui.tool;
    // 1) pan: botão do meio, ou botão esquerdo com Espaço pressionado / ferramenta Mão
    if (e.button === 1 || (e.button === 0 && (spaceDown || tool === 'hand'))) {
      e.preventDefault();
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    const hitId = nodeAt(e.target);
    // 2) se há texto em edição: clicar DENTRO dele só posiciona o cursor; clicar fora encerra a edição
    if (ui.editingId) {
      if (hitId === ui.editingId) return; // clique dentro do texto: só posiciona o cursor
      document.activeElement?.blur?.();
      finishEdit();
    } else {
      document.activeElement?.blur?.();
    }
    // evita seleção de texto do navegador e foco indesejado durante o arrasto
    e.preventDefault();
    capture(e);

    const t = e.target;
    // 3) caneta: cada clique adiciona um ponto (clicar no primeiro ponto fecha o caminho)
    if (tool === 'pen') {
      drag = { type: 'pen' };
      return pen.down(e) ? undefined : (drag = null);
    }
    // editando os pontos de um vetor: arrastar um ponto/alça, Alt+clique no traço adiciona ponto, clicar fora sai da edição
    if (pen.isEditing()) {
      if (t.dataset?.edit) {
        drag = { type: 'pen' };
        return pen.downEdit(e, t.dataset.edit, Number(t.dataset.idx));
      }
      if (hitId === ui.editPathId) {
        if (e.altKey) pen.addPointAt(e);
        return;
      }
      pen.exitEdit();
    }
    // arrastar uma guia de régua já criada (soltar em cima da régua apaga)
    if (t.dataset?.guide !== undefined && t.dataset.guide !== '') {
      const i = Number(t.dataset.guide);
      drag = { type: 'guide', i, axis: store.page().guides[i].axis };
      return;
    }
    // 4) ferramenta de desenho ativa: tem prioridade sobre alças (senão não dá para desenhar em cima da seleção)
    if (DRAW_TOOLS.includes(tool)) return startDraw(e, tool);
    // 5) alça de redimensionar / zona de rotação (elementos do overlay marcados com data-handle / data-rotate)
    if (t.dataset.handle) return startResize(e, t.dataset.handle);
    if (t.dataset.rotate) return startRotate(e);

    // 6) ferramenta MOVER. `labelId` = clicou no NOME de um frame (acima dele), que seleciona/arrasta o frame todo.
    // Clicar no vazio: limpa a seleção (Shift mantém) e começa o marquee.
    const labelId = t.dataset.label || null;
    if (!labelId && !hitId) {
      if (!e.shiftKey) store.setSelection([]);
      return startMarquee(e, null, null);
    }
    // Ctrl/⌘+clique = seleção "profunda" (atravessa grupos); clique normal respeita grupos (pickSelectable)
    const id = labelId || (e.ctrlKey || e.metaKey ? hitId : pickSelectable(hitId));
    const node = store.get(id);
    const inSel = ui.selection.includes(id);

    // Frame da RAIZ não clicado antes: um clique simples o seleciona, mas ARRASTAR faz marquee dentro dele
    // (estilo Figma: não dá para arrastar um frame "puxando" pelo fundo, só pelo nome ou depois de selecionado).
    if (!labelId && node.type === 'frame' && !store.parentOf(id) && !inSel) {
      // frame raiz: clique seleciona, arrasto faz marquee dentro dele
      return startMarquee(e, id, id);
    }
    // Shift+clique alterna a camada na seleção; clique numa não selecionada passa a selecionar só ela
    if (e.shiftKey) {
      store.setSelection(inSel ? ui.selection.filter((s) => s !== id) : [...ui.selection, id]);
      if (inSel) return;
    } else if (!inSel) {
      store.setSelection([id]);
    }
    startMove(e, { collapseTo: inSel && !e.shiftKey && ui.selection.length > 1 ? id : null });
  });

  // ------------------------------------------------------------------ mover
  /** Prepara o arrasto de mover as camadas selecionadas. `collapseTo`: se for só um clique (sem arrastar) numa seleção múltipla, reduz a seleção a essa camada. */
  function startMove(e, { collapseTo }) {
    const nodes = commands.topSelection();
    if (!nodes.length) return;
    drag = {
      type: 'move', sx: e.clientX, sy: e.clientY, moved: false, collapseTo,
      alt: e.altKey, items: [], p0: canvas.toWorld(e.clientX, e.clientY), box0: null,
    };
    rebase(nodes);
  }

  /**
   * Guarda o ponto de partida dos itens em coordenadas de MUNDO (origem + caixa). A posição final é sempre
   * "origem inicial + deslocamento do ponteiro − origem do pai atual", então continua certa mesmo que o pai
   * mude no meio do arrasto (quando a camada passa por cima de outro frame).
   */
  function rebase(nodes) {
    drag.items = nodes.map((n) => ({ id: n.id, w0: canvas.originOf(n.id), a0: canvas.aabb(n.id) }));
    drag.box0 = canvas.unionAabb(nodes.map((n) => n.id));
    drag.snapRects = null;
  }

  /**
   * Retângulos com os quais o item que se move pode "grudar" (snap): os irmãos e o pai. Calculado uma vez por arrasto
   * (cache em drag.snapRects) porque os vizinhos não mudam enquanto você arrasta.
   */
  function snapCandidates() {
    if (drag.snapRects) return drag.snapRects;
    const first = store.get(drag.items[0].id);
    const parent = store.parentOf(first.id);
    const moving = new Set(drag.items.map((i) => i.id));
    const sibs = (parent ? parent.children : store.page().children).filter((s) => !moving.has(s.id) && s.visible);
    const rects = sibs.map((s) => canvas.aabb(s.id)).filter(Boolean);
    if (parent) rects.push(canvas.aabb(parent.id));
    drag.snapRects = rects;
    return rects;
  }

  /**
   * SNAP: ajusta o deslocamento (dx, dy) para que bordas e centros do item alinhem com os dos vizinhos e com as
   * guias de régua, quando estiverem a menos de 6px de TELA (6/zoom no mundo). Devolve também as linhas-guia rosa
   * a desenhar onde houve alinhamento exato. Ctrl desliga o snap (no chamador).
   * @returns {{dx:number, dy:number, guides:object[]}}
   */
  function snapMove(dx, dy) {
    const b = drag.box0;
    const z = canvas.getView().zoom;
    const thr = 6 / z;
    const rects = snapCandidates();
    const xs = [], ys = [];
    if (ui.showGuides !== false && ui.showRulers !== false) {
      for (const g of store.page().guides || []) (g.axis === 'x' ? xs : ys).push(g.pos);
    }
    for (const r of rects) {
      xs.push(r.x, r.x + r.w / 2, r.x + r.w);
      ys.push(r.y, r.y + r.h / 2, r.y + r.h);
    }
    // best: dentre os candidatos, o mais próximo (dentro do limite) de alguma das 3 bordas do item (início/centro/fim)
    const best = (cands, edges) => {
      let delta = 0, min = thr;
      for (const c of cands) for (const m of edges) if (Math.abs(c - m) < min) { min = Math.abs(c - m); delta = c - m; }
      return min < thr ? delta : 0;
    };
    dx += best(xs, [b.x + dx, b.x + b.w / 2 + dx, b.x + b.w + dx]);
    dy += best(ys, [b.y + dy, b.y + b.h / 2 + dy, b.y + b.h + dy]);

    // linhas-guia: onde, depois do ajuste, uma borda do item coincide (±0.5px) com a de um vizinho
    const guides = [];
    const mx = [b.x + dx, b.x + b.w / 2 + dx, b.x + b.w + dx];
    const my = [b.y + dy, b.y + b.h / 2 + dy, b.y + b.h + dy];
    for (const r of rects) {
      const rx = [r.x, r.x + r.w / 2, r.x + r.w], ry = [r.y, r.y + r.h / 2, r.y + r.h];
      for (const m of mx) for (const c of rx) if (Math.abs(m - c) < 0.5)
        guides.push({ axis: 'x', pos: c, from: Math.min(r.y, b.y + dy), to: Math.max(r.y + r.h, b.y + b.h + dy) });
      for (const m of my) for (const c of ry) if (Math.abs(m - c) < 0.5)
        guides.push({ axis: 'y', pos: c, from: Math.min(r.x, b.x + dx), to: Math.max(r.x + r.w, b.x + b.w + dx) });
    }
    return { dx, dy, guides };
  }

  /**
   * Dentro de um auto layout o item NÃO tem posição livre; arrastar significa REORDENAR. Acha o irmão cujo centro
   * está mais perto do ponteiro e põe o item antes ou depois dele (conforme o ponteiro esteja antes/depois do centro
   * dele no eixo principal). Funciona também com flex-wrap, porque usa distância 2D.
   */
  function flowReorder(node, p, parent = store.parentOf(node.id)) {
    // `parent` pode vir de fora: uma camada recém-criada ainda não está no índice do store (ver finishDraw)
    const row = parent.layout.mode === 'row';
    const sibs = parent.children.filter((c) => c !== node && c.visible && !c.absolute);
    let idx = 0;
    if (sibs.length) {
      let bestD = Infinity, bestI = 0, bestBox = null;
      sibs.forEach((s, i) => {
        const b = canvas.aabb(s.id);
        const d = (b.x + b.w / 2 - p.x) ** 2 + (b.y + b.h / 2 - p.y) ** 2;
        if (d < bestD) { bestD = d; bestI = i; bestBox = b; }
      });
      const after = row ? p.x > bestBox.x + bestBox.w / 2 : p.y > bestBox.y + bestBox.h / 2;
      idx = bestI + (after ? 1 : 0);
    }
    const list = parent.children;
    list.splice(list.indexOf(node), 1);
    const ref = sibs[idx];
    const at = ref ? list.indexOf(ref) : sibs.length ? list.indexOf(sibs[sibs.length - 1]) + 1 : list.length;
    list.splice(at, 0, node);
  }

  /**
   * Cada movimento do mouse durante o gesto "mover". Passos:
   *  1. passou do limiar? Se Alt estava pressionado, duplica e passa a arrastar as cópias
   *  2. se o ponteiro entrou noutro frame, troca o pai da camada (mantendo a posição visual)
   *  3. calcula o deslocamento (Shift trava o eixo), aplica snap (Ctrl desliga)
   *  4. aplica: camadas livres recebem x/y; camadas em auto layout são reordenadas
   *  5. camadas em auto layout ganham um "fantasma" (CSS `translate`) que segue o ponteiro
   */
  function moveDrag(e) {
    const d = drag;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < THRESHOLD) return;
      d.moved = true;
      // Alt+arrastar: deixa o original no lugar e arrasta uma CÓPIA (ids novos)
      if (d.alt) {
        // Alt+arrastar: duplica no lugar e arrasta as cópias
        const nodes = commands.topSelection();
        const copies = [];
        store.update(() => {
          for (const n of nodes) {
            const list = store.listOf(n.id);
            const c = clone(n);
            const reid = (x) => { x.id = uid(); x.children?.forEach(reid); };
            reid(c);
            list.splice(list.indexOf(n) + 1, 0, c);
            copies.push(c);
          }
        });
        store.setSelection(copies.map((c) => c.id));
        rebase(copies);
      }
      setDragIds(commands.topSelection());
    }
    const p = canvas.toWorld(e.clientX, e.clientY);
    const nodes = d.items.map((i) => store.get(i.id)).filter(Boolean);
    if (!nodes.length) return;

    // Troca de pai ao passar sobre outro frame. Frames da raiz não "entram" em outros ao serem arrastados (evita aninhar sem querer).
    const canReparent = nodes.every((n) => !(n.type === 'frame' && !store.parentOf(n.id)));
    if (canReparent) {
      const target = frameUnder(e.clientX, e.clientY);
      const currentId = store.parentOf(nodes[0].id)?.id ?? null;
      if ((target?.id ?? null) !== currentId) {
        commands.reparent(nodes, target);
        store.emit('doc');
        drag.snapRects = null; // os "vizinhos" agora são outros
      }
    }

    // deslocamento do ponteiro desde o início; Shift trava no eixo que mais andou
    let dx = p.x - d.p0.x, dy = p.y - d.p0.y;
    if (e.shiftKey) (Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0));
    ui.guides = [];
    // snap só vale para camadas livres (em auto layout a posição é do navegador)
    const anyFree = nodes.some((n) => !isFlow(n, store.parentOf(n.id)));
    if (anyFree && !(e.ctrlKey || e.metaKey)) {
      const s = snapMove(dx, dy);
      dx = s.dx; dy = s.dy; ui.guides = s.guides;
    }
    ui.dropTarget = null;
    // `reordered` diz ao store se a estrutura mudou (reordenação) ou se foram só números (rápido)
    let reordered = false;
    store.update(() => {
      // livre → x/y = origem inicial + deslocamento − origem do pai; em fluxo → reordena conforme o ponteiro
      for (const it of d.items) {
        const n = store.get(it.id);
        if (!n) continue;
        const parent = store.parentOf(n.id);
        if (isFlow(n, parent)) { flowReorder(n, p); reordered = true; }
        else {
          const po = parent ? canvas.originOf(parent.id) : { x: 0, y: 0 };
          n.x = round(it.w0.x + dx - po.x);
          n.y = round(it.w0.y + dy - po.y);
        }
      }
    }, { structural: reordered });
    // "fantasma": o item em auto layout fica na vaga que o navegador deu, mas visualmente segue o ponteiro (CSS translate)
    for (const it of d.items) {
      const n = store.get(it.id);
      if (n && isFlow(n, store.parentOf(n.id))) {
        const o = canvas.originOf(n.id);
        canvas.els.get(n.id).style.translate = `${it.a0.x + dx - o.x}px ${it.a0.y + dy - o.y}px`;
      }
    }
    store.emit('overlay');
  }

  // ------------------------------------------------------------------ redimensionar
  /**
   * Prepara o redimensionar. `hx`/`hy` dizem qual lado a alça move: hx=+1 direita, −1 esquerda; hy=+1 baixo, −1 cima
   * (0 = não mexe nesse eixo; alça 'e' é hx=1,hy=0; canto 'nw' é hx=−1,hy=−1). Guarda o estado inicial para
   * recalcular tudo a partir dele a cada movimento (evita acumular erro de arredondamento).
   */
  function startResize(e, handle) {
    const nodes = commands.topSelection();
    if (!nodes.length) return;
    const hx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
    const hy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
    drag = {
      type: 'resize', hx, hy, sx: e.clientX, sy: e.clientY, p0: canvas.toWorld(e.clientX, e.clientY),
      single: nodes.length === 1,
      items: nodes.map((n) => ({
        id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, rot: n.rotation || 0,
        sizeX: n.sizeX, sizeY: n.sizeY, children: n.children ? clone(n.children) : null,
        a0: canvas.aabb(n.id),
      })),
      box0: canvas.unionAabb(nodes.map((n) => n.id)),
    };
    setDragIds(null);
  }

  /**
   * Cada movimento do mouse ao redimensionar.
   *  - UMA camada: converte o deslocamento do mouse para os eixos LOCAIS da camada (desfazendo a rotação), muda w/h e
   *    recalcula x/y para que o lado OPOSTO (a âncora) fique parado no mundo — funciona com a camada girada.
   *    Shift mantém a proporção; Alt redimensiona a partir do centro.
   *  - VÁRIAS camadas: escala o conjunto pela caixa envolvente.
   *  - Grupos escalam os filhos; frames reaplicam as constraints dos filhos a partir do tamanho original.
   */
  function resizeDrag(e) {
    const d = drag;
    const p = canvas.toWorld(e.clientX, e.clientY);
    const dxw = p.x - d.p0.x, dyw = p.y - d.p0.y;
    const { hx, hy } = d;
    store.update(() => {
      // ---- uma camada ----
      if (d.single) {
        const it = d.items[0];
        const n = store.get(it.id);
        // (ldx, ldy) = deslocamento do mouse nos eixos da própria camada (rotação inversa)
        const rad = (it.rot * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
        const ldx = dxw * cos + dyw * sin, ldy = -dxw * sin + dyw * cos;
        // com Alt, cada lado anda o dobro (o oposto anda junto, mantendo o centro)
        const k = e.altKey ? 2 : 1;
        let nw = it.w + hx * ldx * k, nh = it.h + hy * ldy * k;
        if (e.shiftKey || n.lockRatio) {
          const ratio = it.w / it.h;
          if (hx && hy) { const s = Math.max(nw / it.w, nh / it.h); nw = it.w * s; nh = it.h * s; }
          else if (hx) nh = nw / ratio;
          else nw = nh * ratio;
        }
        nw = Math.max(1, Math.round(nw));
        nh = Math.max(1, Math.round(nh));
        // âncora = ponto fixo (lado oposto à alça, ou o centro com Alt): posição antes e depois, em coordenadas locais.
        // Depois do novo tamanho, achamos o novo centro que mantém essa âncora no mesmo lugar do mundo.
        const a0x = e.altKey ? 0 : (-hx * it.w) / 2, a0y = e.altKey ? 0 : (-hy * it.h) / 2;
        const a1x = e.altKey ? 0 : (-hx * nw) / 2, a1y = e.altKey ? 0 : (-hy * nh) / 2;
        const c0x = it.x + it.w / 2, c0y = it.y + it.h / 2;
        const ax = c0x + a0x * cos - a0y * sin, ay = c0y + a0x * sin + a0y * cos;
        const c1x = ax - (a1x * cos - a1y * sin), c1y = ay - (a1x * sin + a1y * cos);
        n.x = round(c1x - nw / 2);
        n.y = round(c1y - nh / 2);
        n.w = nw;
        n.h = nh;
        if (n.type === 'group') {
          n.children = clone(it.children);
          n.children.forEach((c) => scaleNode(c, nw / it.w, nh / it.h));
        } else if (n.type === 'frame' && it.children) {
          n.children = clone(it.children); // volta ao estado inicial e aplica as constraints a partir do tamanho original
          applyConstraints(n, it.w, it.h);
        }
        if (hx) n.sizeX = 'fixed';
        if (hy) n.sizeY = 'fixed';
        if (n.type === 'text' && hx && !hy) n.sizeY = it.sizeY === 'fixed' ? 'fixed' : 'hug';
        return;
      }
      // ---- várias camadas: escala tudo pela caixa envolvente (posição relativa e tamanho multiplicados por sx/sy)
      const b = d.box0;
      let nw = b.w + hx * dxw, nh = b.h + hy * dyw;
      if (e.shiftKey && hx && hy) { const s = Math.max(nw / b.w, nh / b.h); nw = b.w * s; nh = b.h * s; }
      nw = Math.max(1, nw); nh = Math.max(1, nh);
      const sx = hx ? nw / b.w : 1, sy = hy ? nh / b.h : 1;
      const nx = hx === -1 ? b.x + b.w - nw : b.x, ny = hy === -1 ? b.y + b.h - nh : b.y;
      for (const it of d.items) {
        const n = store.get(it.id);
        const free = !isFlow(n, store.parentOf(n.id));
        if (free) {
          n.x = round(it.x + (nx + (it.a0.x - b.x) * sx - it.a0.x));
          n.y = round(it.y + (ny + (it.a0.y - b.y) * sy - it.a0.y));
        }
        n.w = Math.max(1, round(it.w * sx));
        n.h = Math.max(1, round(it.h * sy));
        if (hx) n.sizeX = 'fixed';
        if (hy) n.sizeY = 'fixed';
        if (n.type === 'group') {
          n.children = clone(it.children);
          n.children.forEach((c) => scaleNode(c, sx, sy));
        } else if (n.type === 'frame' && it.children) {
          n.children = clone(it.children);
          applyConstraints(n, it.w, it.h);
        }
      }
    });
    store.emit('overlay');
  }

  // ------------------------------------------------------------------ rotacionar
  /** Prepara a rotação: guarda o centro da camada (em px de tela), a rotação inicial e o ângulo do mouse em relação ao centro. */
  function startRotate(e) {
    const id = ui.selection[0];
    const node = store.get(id);
    const b = canvas.worldBox(id);
    if (!node || !b) return;
    const r = canvas.vpRect();
    const c = canvas.toScreen(b.cx, b.cy);
    const cx = r.left + c.x, cy = r.top + c.y;
    drag = {
      type: 'rotate', id, cx, cy, rot0: node.rotation || 0,
      a0: Math.atan2(e.clientY - cy, e.clientX - cx),
    };
    viewport.style.cursor = 'grabbing';
  }

  /** Rotação = rotação inicial + (ângulo atual do mouse − ângulo inicial). Shift prende em múltiplos de 15°. Resultado em −180..180. */
  function rotateDrag(e) {
    const d = drag;
    const a = Math.atan2(e.clientY - d.cy, e.clientX - d.cx);
    let rot = d.rot0 + ((a - d.a0) * 180) / Math.PI;
    if (e.shiftKey) rot = Math.round(rot / 15) * 15;
    rot = round(((((rot + 180) % 360) + 360) % 360) - 180, 1);
    store.update(() => { store.get(d.id).rotation = rot; }, { structural: false });
  }

  // ------------------------------------------------------------------ desenhar
  /**
   * Começa a desenhar com a ferramenta ativa. O frame sob o cursor vira o PAI da camada nova (posição relativa a ele).
   * Retângulo/elipse/frame/linha já nascem no documento (tamanho 1) e crescem durante o arrasto, para você ver ao vivo.
   * Texto, polígono e estrela só são criados ao soltar.
   */
  function startDraw(e, tool) {
    const p = canvas.toWorld(e.clientX, e.clientY);
    const parent = frameUnder(e.clientX, e.clientY);
    const po = parent ? canvas.originOf(parent.id) : { x: 0, y: 0 };
    drag = { type: 'draw', tool, p0: p, po, parent, node: null, sx: e.clientX, sy: e.clientY, moved: false };
    if (tool === 'line') {
      const node = createNode('line', { name: nextName(store.page(), 'line'), x: round(p.x - po.x), y: round(p.y - po.y - 6), w: 1 });
      if (parent && hasLayout(parent)) { node.absolute = true; drag.flow = true; }
      store.update((page) => (parent ? parent.children : page.children).push(node));
      drag.node = node;
      store.setSelection([node.id]);
    } else if (tool !== 'text' && tool !== 'polygon' && tool !== 'star') {
      const node = createNode(tool, {
        name: nextName(store.page(), tool),
        x: round(p.x - po.x), y: round(p.y - po.y), w: 1, h: 1,
      });
      // não nascer "invisível" (mesma cor do que está embaixo do cursor)
      if (node.fill?.type === 'solid') node.fill.color = contrastingFill(node.fill.color, colorUnder(e.clientX, e.clientY));
      // Dentro de um frame com AUTO LAYOUT: enquanto arrasta, a forma fica "solta" (absoluta) exatamente sob o mouse;
      // ao soltar, entra na fila NA POSIÇÃO onde foi desenhada (finishDraw → enterFlow). Sem isso ela ia para o fim
      // da fila durante o próprio desenho, longe do cursor.
      if (parent && hasLayout(parent)) { node.absolute = true; drag.flow = true; }
      if (tool === 'frame') node.name = parent ? 'Frame' : nextName(store.page(), 'frame');
      store.update((page) => (parent ? parent.children : page.children).push(node));
      drag.node = node;
      store.setSelection([node.id]);
    }
  }

  /**
   * Durante o desenho: ajusta a camada ao retângulo arrastado (Shift = quadrado/ângulos de 15°; Alt = a partir do centro).
   * A linha é um segmento girado; polígono/estrela mostram só o retângulo-guia (marquee) até soltar.
   */
  function drawDrag(e) {
    const d = drag;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < THRESHOLD) return;
    d.moved = true;
    const p = canvas.toWorld(e.clientX, e.clientY);
    if (d.tool === 'line') {
      let dx = p.x - d.p0.x, dy = p.y - d.p0.y;
      let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (e.shiftKey) ang = Math.round(ang / 15) * 15;
      const len = Math.max(1, Math.round(Math.hypot(dx, dy)));
      const rad = (ang * Math.PI) / 180;
      dx = Math.cos(rad) * len; dy = Math.sin(rad) * len;
      const mx = d.p0.x + dx / 2, my = d.p0.y + dy / 2;
      store.update(() => {
        Object.assign(d.node, { w: len, rotation: round(ang, 1), x: round(mx - len / 2 - d.po.x), y: round(my - d.node.h / 2 - d.po.y) });
      });
      return;
    }
    if (d.tool === 'polygon' || d.tool === 'star') {
      const w0 = p.x - d.p0.x, h0 = p.y - d.p0.y;
      const sq = e.shiftKey ? Math.max(Math.abs(w0), Math.abs(h0)) : null;
      const ww = sq ?? Math.abs(w0), hh = sq ?? Math.abs(h0);
      ui.marquee = { x: w0 < 0 ? d.p0.x - ww : d.p0.x, y: h0 < 0 ? d.p0.y - hh : d.p0.y, w: ww, h: hh };
      store.emit('overlay');
      return;
    }
    if (!d.node) return;
    let w = p.x - d.p0.x, h = p.y - d.p0.y;
    if (e.shiftKey) { const s = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * s; h = Math.sign(h || 1) * s; }
    let x = d.p0.x, y = d.p0.y;
    if (e.altKey) { x -= w; y -= h; w *= 2; h *= 2; }
    const nx = Math.min(x, x + w), ny = Math.min(y, y + h);
    store.update(() => {
      Object.assign(d.node, {
        x: round(nx - d.po.x), y: round(ny - d.po.y), w: Math.max(1, Math.round(Math.abs(w))), h: Math.max(1, Math.round(Math.abs(h))),
      });
    });
  }

  /**
   * Ao soltar o mouse com uma ferramenta de desenho. Um clique SEM arrastar cria o tamanho padrão
   * (frame 320×240, retângulo/elipse 100×100, linha 100px, polígono/estrela 100×100). Texto entra direto em edição.
   * A ferramenta volta para Mover (como no Figma).
   */
  function finishDraw(d, e) {
    store.setTool('move');
    if (d.tool === 'text') {
      const p = canvas.toWorld(e.clientX, e.clientY);
      const node = createNode('text', {
        name: 'Texto', x: round(Math.min(d.p0.x, p.x) - d.po.x), y: round(Math.min(d.p0.y, p.y) - d.po.y),
      });
      node.name = nextName(store.page(), 'text');
      node.fill.color = contrastingFill(node.fill.color, colorUnder(d.sx, d.sy)); // texto preto sobre fundo escuro sumiria
      if (d.moved && Math.abs(p.x - d.p0.x) > 12) {
        node.w = Math.round(Math.abs(p.x - d.p0.x));
        node.sizeX = 'fixed';
      }
      store.update((page) => {
        (d.parent ? d.parent.children : page.children).push(node);
        if (d.parent && hasLayout(d.parent)) flowReorder(node, p, d.parent); // em auto layout: entra onde você clicou
      });
      store.setSelection([node.id]);
      store.commit();
      startEdit(node.id);
      return;
    }
    if (d.tool === 'polygon' || d.tool === 'star') {
      const m = ui.marquee || { x: d.p0.x, y: d.p0.y, w: 0, h: 0 };
      ui.marquee = null;
      const box = m.w < 4 || m.h < 4 ? { x: d.p0.x, y: d.p0.y, w: 100, h: 100 } : m;
      commands.addShapePath(d.tool, box, d.parent, ui.polygonSides || 5);
      return;
    }
    if (d.tool === 'line' && !d.moved) {
      store.update(() => { d.node.w = 100; });
    } else if (!d.moved && d.node && d.tool !== 'line') {
      const defaults = { frame: [320, 240], rect: [100, 100], ellipse: [100, 100] }[d.tool];
      store.update(() => { d.node.w = defaults[0]; d.node.h = defaults[1]; });
    }
    if (d.flow && d.node) enterFlow(d.node);
    store.commit();
  }

  /**
   * Forma recém-desenhada dentro de um auto layout (estava "solta" durante o arrasto): entra na fila na posição
   * mais próxima de onde foi desenhada — entre os dois itens em volta do centro dela (flowReorder).
   */
  function enterFlow(node) {
    const b = canvas.aabb(node.id);
    store.update(() => {
      node.absolute = false;
      flowReorder(node, { x: b.x + b.w / 2, y: b.y + b.h / 2 });
    });
  }

  // ------------------------------------------------------------------ guias
  /** Arrasta uma guia de régua já existente (atualiza a posição ao vivo; soltar sobre a régua apaga — ver endDrag). */
  function guideDrag(e) {
    const d = drag;
    const w = canvas.toWorld(e.clientX, e.clientY);
    const pos = Math.round(d.axis === 'x' ? w.x : w.y);
    store.update((page) => { page.guides[d.i].pos = pos; });
    ui.guideDrag = { axis: d.axis, pos };
    store.emit('overlay');
  }

  // ------------------------------------------------------------------ marquee
  /**
   * Começa o retângulo de seleção por arrasto. `scope` = id do frame raiz onde o arrasto começou (seleciona só
   * filhos dele) ou null (seleciona camadas da raiz). `clickId` = camada a selecionar se foi só um clique.
   */
  function startMarquee(e, scope, clickId) {
    drag = {
      type: 'marquee', scope, clickId, sx: e.clientX, sy: e.clientY, moved: false,
      p0: canvas.toWorld(e.clientX, e.clientY), base: e.shiftKey ? [...ui.selection] : [],
    };
  }

  /**
   * Atualiza o marquee e a seleção. Regra do Figma: frames da raiz só entram se estiverem TOTALMENTE dentro do
   * retângulo; as demais camadas entram ao serem tocadas. Shift soma à seleção anterior.
   */
  function marqueeDrag(e) {
    const d = drag;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < THRESHOLD) return;
    d.moved = true;
    const p = canvas.toWorld(e.clientX, e.clientY);
    const m = {
      x: Math.min(d.p0.x, p.x), y: Math.min(d.p0.y, p.y), w: Math.abs(p.x - d.p0.x), h: Math.abs(p.y - d.p0.y),
    };
    ui.marquee = m;
    const scopeNode = d.scope ? store.get(d.scope) : null;
    const list = scopeNode ? scopeNode.children : store.page().children;
    const hit = [];
    for (const n of list) {
      if (!n.visible || n.locked) continue;
      const b = canvas.aabb(n.id);
      if (!b) continue;
      // intersects: toca no retângulo · inside: está totalmente dentro dele
      const intersects = b.x < m.x + m.w && b.x + b.w > m.x && b.y < m.y + m.h && b.y + b.h > m.y;
      const inside = b.x >= m.x && b.y >= m.y && b.x + b.w <= m.x + m.w && b.y + b.h <= m.y + m.h;
      if (n.type === 'frame' && !scopeNode ? inside : intersects) hit.push(n.id);
    }
    store.setSelection([...new Set([...d.base, ...hit])]);
    store.emit('overlay');
  }

  // ------------------------------------------------------------------ ponteiro (mover/soltar)
  /**
   * POINTER MOVE: com gesto em andamento, despacha para a função do tipo (moveDrag, resizeDrag...). Sem gesto,
   * só atualiza o "hover" (contorno da camada sob o mouse) e o preview da caneta.
   */
  viewport.addEventListener('pointermove', (e) => {
    if (!drag) {
      if (pen.isDrawing()) pen.move(e);
      if (ui.tool === 'move' && !ui.editingId) {
        const id = e.target.dataset?.label || nodeAt(e.target);
        const next = id ? (e.target.dataset?.label ? id : pickSelectable(id)) : null;
        if (next !== ui.hoverId) {
          ui.hoverId = next;
          store.emit('hover');
        }
      }
      return;
    }
    switch (drag.type) {
      case 'pan': {
        canvas.setView({ x: drag.vx + e.clientX - drag.x, y: drag.vy + e.clientY - drag.y });
        break;
      }
      case 'move': moveDrag(e); break;
      case 'resize': resizeDrag(e); break;
      case 'rotate': rotateDrag(e); break;
      case 'draw': drawDrag(e); break;
      case 'marquee': marqueeDrag(e); break;
      case 'pen': pen.move(e); break;
      case 'guide': guideDrag(e); break;
      default: break;
    }
  });

  // Mouse saiu do canvas: tira o contorno de hover.
  viewport.addEventListener('pointerleave', () => {
    if (ui.hoverId && !drag) {
      ui.hoverId = null;
      store.emit('hover');
    }
  });

  /**
   * POINTER UP / CANCEL: encerra o gesto. Cada tipo faz sua limpeza e quase todos terminam com UM `store.commit()` —
   * por isso um Ctrl+Z desfaz o arrasto/redimensionamento INTEIRO, não pixel a pixel. Também limpa guias, marquee e
   * destaque temporários do overlay.
   */
  function endDrag(e) {
    const d = drag;
    if (!d) return;
    drag = null;
    viewport.classList.remove('panning');
    viewport.style.cursor = '';
    ui.guides = [];
    ui.dropTarget = null;
    ui.marquee = null;
    setDragIds(null);
    if (d.type === 'pan') { store.emit('overlay'); return; }
    if (d.type === 'pen') { pen.up(); return; }
    if (d.type === 'guide') {
      const r = canvas.vpRect();
      const outside = d.axis === 'y' ? e.clientY - r.top < RULER : e.clientX - r.left < RULER;
      if (outside) commands.removeGuide(d.i);
      else store.commit();
      ui.guideDrag = null;
      store.emit('overlay');
      return;
    }
    if (d.type === 'draw') { finishDraw(d, e); return; }
    if (d.type === 'marquee') {
      if (!d.moved && d.clickId) store.setSelection([d.clickId]);
      store.emit('overlay');
      store.emit('doc');
      return;
    }
    if (d.type === 'move') {
      if (!d.moved) {
        if (d.collapseTo) store.setSelection([d.collapseTo]);
        store.emit('doc');
        return;
      }
      store.commit();
      return;
    }
    store.commit();
  }
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  // ------------------------------------------------------------------ duplo clique
  /**
   * DUPLO CLIQUE: no nome de um frame → renomear; em texto → editar; em vetor → editar pontos;
   * num ponto do vetor → alterna canto/suave; em camada dentro de grupo → entra e seleciona a camada.
   * Durante a caneta, termina o caminho.
   */
  viewport.addEventListener('dblclick', (e) => {
    const t = downTarget && viewport.contains(downTarget) ? downTarget : e.target;
    if (pen.isDrawing()) { ui.pen.pts.pop(); pen.finish(false); return; }
    if (ui.tool !== 'move') return;
    const label = t.dataset?.label;
    if (label) {
      ui.renamingId = label;
      store.emit('doc');
      return;
    }
    if (t.dataset?.edit === 'pt') { pen.togglePointType(Number(t.dataset.idx)); return; }
    const id = nodeAt(t);
    if (!id) return;
    const node = store.get(id);
    if (node.type === 'path') { pen.startEdit(id); return; }
    if (node.type === 'text') startEdit(id);
    else if (ui.selection[0] !== id) store.setSelection([id]);
  });

  /** BOTÃO DIREITO: seleciona o que está sob o cursor (se ainda não estava) e pede ao app para abrir o menu de contexto. */
  viewport.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const id = nodeAt(e.target);
    if (id) {
      const pick = e.target.dataset?.label || pickSelectable(id);
      if (!ui.selection.includes(pick)) store.setSelection([pick]);
    } else if (!e.target.dataset?.label) {
      store.setSelection([]);
    }
    store.ui.contextMenu = { x: e.clientX, y: e.clientY };
    store.emit('contextmenu');
  });

  // ------------------------------------------------------------------ arrastar imagens para o canvas
  // Arrastar ARQUIVOS de imagem do computador para o canvas: aceita o "soltar" e cria uma camada de imagem na posição.
  viewport.addEventListener('dragover', (e) => {
    if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault();
  });
  // (o soltar propriamente dito)
  viewport.addEventListener('drop', (e) => {
    const files = [...(e.dataTransfer?.files || [])];
    if (!files.length) return;
    e.preventDefault();
    commands.addImageFiles(files, canvas.toWorld(e.clientX, e.clientY)).catch(() => toast('Não consegui abrir a imagem.'));
  });

  // ------------------------------------------------------------------ teclado
  /** O foco está num campo onde o usuário DIGITA (input, select, texto editável)? Então os atalhos do canvas não devem agir. */
  const isTyping = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  /**
   * O canvas está "coberto"? (página inicial aberta ou uma janela modal: Configurações, Projetos, pergunta...)
   * Então NENHUM atalho do canvas pode agir — senão um Delete com o foco num botão da janela apagaria camadas
   * escondidas atrás dela.
   */
  const covered = () => ui.homeOpen || !!document.querySelector('.modal-backdrop');

  /**
   * TECLADO — todos os atalhos do editor. Ordem importa (do mais específico ao mais geral):
   * Esc → Alt (medidas) → formatação de texto (Ctrl+B/I/U) → [sai se estiver digitando num campo] → Tab → Espaço (mão)
   * → caneta → Ctrl+Alt+… → Ctrl+… → Shift+… → ferramentas (V, F, R…) → Delete → F2/Enter → setas.
   * A lista completa para o usuário está em ui/menus.js (tecla ?) e no README.
   */
  window.addEventListener('keydown', (e) => {
    if (covered()) return;
    // mod = Ctrl (Windows/Linux) ou ⌘ (Mac); key = tecla em minúsculas
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // Esc: termina caneta/edição de pontos/edição de texto; depois volta para Mover; depois limpa a seleção
    if (e.key === 'Escape') {
      if (pen.isDrawing()) { pen.finish(false); return; }
      if (pen.isEditing()) { pen.exitEdit(); return; }
      if (ui.editingId) { document.activeElement?.blur?.(); finishEdit(); return; }
      if (isTyping(e.target)) { e.target.blur(); return; }
      if (ui.tool !== 'move') store.setTool('move');
      else store.setSelection([]);
      return;
    }
    // Alt pressionado: liga as medidas de distância (overlay.js → measures). Desliga no keyup.
    if (e.key === 'Alt' && !isTyping(e.target)) {
      if (!ui.altDown) { ui.altDown = true; store.emit('overlay'); }
      return;
    }
    // atalhos de formatação enquanto edita o texto: Ctrl+B / I / U (aplicam à caixa toda)
    if (ui.editingId && mod && ['b', 'i', 'u'].includes(key)) {
      e.preventDefault();
      store.update(() => {
        const n = store.get(ui.editingId);
        if (key === 'b') n.fontWeight = n.fontWeight >= 600 ? 400 : 700;
        if (key === 'i') n.fontStyle = n.fontStyle === 'italic' ? 'normal' : 'italic';
        if (key === 'u') n.textDecoration = n.textDecoration === 'underline' ? 'none' : 'underline';
      });
      return;
    }
    // a partir daqui, se o usuário está digitando num campo, ignora (os atalhos do canvas não devem roubar as teclas)
    if (isTyping(e.target)) return;

    // Tab / Shift+Tab: próxima / anterior camada no mesmo nível, na ordem da lista de camadas (de cima para baixo)
    if (e.key === 'Tab') {
      // Tab / Shift+Tab: próxima / anterior camada no mesmo nível (na ordem da lista de camadas)
      e.preventDefault();
      const cur = store.get(ui.selection[0]);
      const list = (cur ? store.listOf(cur.id) : store.page().children).filter((n) => n.visible && !n.locked);
      if (!list.length) return;
      const i = cur ? list.indexOf(cur) : list.length;
      const next = e.shiftKey ? list[(i + 1) % list.length] : list[(i - 1 + list.length) % list.length];
      store.setSelection([next.id]);
      canvas.ensureVisible?.(next.id);
      return;
    }

    // Espaço: mão temporária (enquanto pressionado, arrastar move a vista)
    if (e.code === 'Space') {
      e.preventDefault();
      if (!spaceDown) { spaceDown = true; viewport.classList.add('space'); }
      return;
    }

    // com a caneta: Enter termina o caminho aberto; editando pontos: Enter sai; Delete remove o ponto selecionado
    if (e.key === 'Enter' && pen.isDrawing()) { e.preventDefault(); pen.finish(false); return; }
    if (e.key === 'Enter' && pen.isEditing()) { pen.exitEdit(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && pen.isEditing()) { e.preventDefault(); pen.deletePoint(); return; }

    // Ctrl+Alt+…: K criar componente · B desanexar · M máscara · G envolver em frame · C/V copiar/colar propriedades
    if (mod && e.altKey) {
      if (key === 'k') { e.preventDefault(); commands.createComponent(); return; }
      if (key === 'b') { e.preventDefault(); commands.detach(); return; }
      if (key === 'm') { e.preventDefault(); commands.toggleMask(); return; }
      if (key === 'g') { e.preventDefault(); commands.frameSelection(); return; }
      if (key === 'c') { e.preventDefault(); if (commands.copyStyle()) toast('Propriedades copiadas'); return; }
      if (key === 'v') { e.preventDefault(); if (commands.pasteStyle()) toast('Propriedades coladas'); return; }
    }
    // Ctrl/⌘+…: Z/Y desfazer/refazer · D duplicar · G agrupar (Shift desagrupa) · A selecionar tudo no nível ·
    // Shift+C copiar CSS · Shift+L travar · Shift+H ocultar · ] [ ordem z · +/−/0 zoom
    if (mod) {
      if (key === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); return; }
      if (key === 'y') { e.preventDefault(); store.redo(); return; }
      if (key === 'd') { e.preventDefault(); commands.duplicate(); return; }
      if (key === 'g') { e.preventDefault(); e.shiftKey ? commands.ungroup() : commands.group(); return; }
      if (key === 'a') {
        e.preventDefault();
        const first = store.get(ui.selection[0]);
        const list = first ? store.listOf(first.id) : store.page().children;
        store.setSelection(list.filter((n) => n.visible && !n.locked).map((n) => n.id));
        return;
      }
      if (e.shiftKey && key === 'c') { e.preventDefault(); copyCss(); return; }
      if (e.shiftKey && key === 'l') { e.preventDefault(); toggleProp('locked'); return; }
      if (e.shiftKey && key === 'h') { e.preventDefault(); toggleProp('visible'); return; }
      if (e.key === ']') { e.preventDefault(); commands.reorder(e.shiftKey ? 'front' : 'forward'); return; }
      if (e.key === '[') { e.preventDefault(); commands.reorder(e.shiftKey ? 'back' : 'backward'); return; }
      if (e.key === '=' || e.key === '+' || e.key === '-') {
        e.preventDefault();
        const r = canvas.vpRect();
        canvas.zoomAt(canvas.getView().zoom * (e.key === '-' ? 1 / 1.25 : 1.25), r.width / 2, r.height / 2);
        return;
      }
      if (e.key === '0') { e.preventDefault(); zoomTo(1); return; }
      return; // deixa copy/cut/paste/save com os handlers próprios
    }

    // Shift+1 ajusta tudo na tela · Shift+2 ajusta à seleção · Shift+0 zoom 100% · Shift+A auto layout ·
    // Shift+H/V espelhar · Shift+R réguas · teclas 0–9 definem a opacidade (1 = 10% … 0 = 100%)
    if (e.shiftKey && e.code === 'Digit1') { canvas.fit(null); return; }
    if (e.shiftKey && e.code === 'Digit2') { canvas.fit(ui.selection); return; }
    if (e.shiftKey && e.code === 'Digit0') { zoomTo(1); return; }
    if (e.shiftKey && key === 'a') { e.preventDefault(); commands.toggleAutoLayout(); return; }
    if (e.shiftKey && key === 'h') { commands.flip('x'); return; }
    if (e.shiftKey && key === 'v') { commands.flip('y'); return; }
    if (e.shiftKey && key === 'r') { ui.showRulers = !ui.showRulers; store.emit('ui'); store.emit('overlay'); return; }
    if (!e.shiftKey && !e.altKey && /^[0-9]$/.test(e.key) && ui.selection.length) {
      const op = e.key === '0' ? 1 : Number(e.key) / 10;
      store.update(() => store.selected().forEach((n) => { n.opacity = op; }), { commit: true });
      return;
    }

    // letras de ferramenta (V, F, R, E, T, H, P, L)
    if (TOOL_KEYS[key] && !e.shiftKey && !e.altKey) { store.setTool(TOOL_KEYS[key]); return; }

    // Delete/Backspace exclui · F2 renomeia a camada
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); commands.deleteSelection(); return; }
    if (e.key === 'F2' && ui.selection.length === 1) { e.preventDefault(); ui.renamingId = ui.selection[0]; store.emit('doc'); return; }

    // Enter: texto → editar; vetor → editar pontos; frame/grupo → seleciona os filhos. Shift+Enter → seleciona o pai.
    if (e.key === 'Enter') {
      const n = store.get(ui.selection[0]);
      if (ui.selection.length === 1 && n) {
        e.preventDefault();
        if (e.shiftKey) { const p = store.parentOf(n.id); if (p) store.setSelection([p.id]); }
        else if (n.type === 'text') startEdit(n.id);
        else if (n.type === 'path') pen.startEdit(n.id);
        else if (n.children?.length) store.setSelection(n.children.map((c) => c.id));
      }
      return;
    }

    // Setas movem 1px (Shift = 10px); camadas em auto layout são ignoradas (a posição é do navegador)
    if (e.key.startsWith('Arrow') && ui.selection.length) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      store.update(() => {
        for (const n of commands.topSelection()) {
          if (hasLayout(store.parentOf(n.id)) && !n.absolute) continue;
          n.x += dx; n.y += dy;
        }
      }, { commit: true });
    }
  });

  // soltar Espaço desliga a mão; soltar Alt desliga as medidas
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') { spaceDown = false; viewport.classList.remove('space'); }
    if (e.key === 'Alt' && ui.altDown) { ui.altDown = false; store.emit('overlay'); }
  });
  // se a janela perde o foco com Espaço/Alt pressionados, o keyup nunca chega — então reseta o estado aqui
  window.addEventListener('blur', () => {
    spaceDown = false;
    viewport.classList.remove('space');
    if (ui.altDown) { ui.altDown = false; store.emit('overlay'); }
  });

  // ------------------------------------------------------------------ copiar / colar do sistema
  /**
   * COPIAR/COLAR com a área de transferência do sistema. Camadas copiadas ficam na memória do app (ui.clipboard);
   * no sistema colocamos só este texto-marcador, para o "colar" saber que é para colar CAMADAS e não texto.
   */
  const MARKER = 'projeto-designer:clip';
  // Ctrl+C: copia as camadas (se o foco não está num campo de texto)
  document.addEventListener('copy', (e) => {
    if (isTyping(e.target) || covered()) return;
    if (commands.copy()) { e.clipboardData.setData('text/plain', MARKER); e.preventDefault(); }
  });
  // Ctrl+X: copia e apaga
  document.addEventListener('cut', (e) => {
    if (isTyping(e.target) || covered()) return;
    if (commands.copy()) { e.clipboardData.setData('text/plain', MARKER); e.preventDefault(); commands.deleteSelection(); }
  });
  // Ctrl+V: imagem da área de transferência → cria camada de imagem; texto do sistema → cria camada de texto; marcador → cola camadas
  document.addEventListener('paste', (e) => {
    if (isTyping(e.target) || covered()) return;
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    const text = e.clipboardData?.getData('text/plain') || '';
    e.preventDefault();
    if (files.length) commands.addImageFiles(files).catch(() => toast('Não consegui abrir a imagem.'));
    // SVG copiado como TEXTO (Figma "Copiar como SVG", sites de ícones, código) → vetor editável
    else if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) {
      try { commands.insertSvg(text); } catch (err) { toast(err.message); }
    } else if (text && text !== MARKER) commands.addText(text.slice(0, 2000));
    else commands.paste();
  });

  // ------------------------------------------------------------------ helpers de comando
  /** Alterna 'locked' ou 'visible' nas camadas selecionadas: se alguma não está no estado alvo, aplica a todas; senão desfaz em todas. */
  function toggleProp(prop) {
    const nodes = store.selected();
    if (!nodes.length) return;
    const next = !nodes.every((n) => (prop === 'visible' ? !n.visible : n[prop]));
    store.update(() => nodes.forEach((n) => { n[prop] = prop === 'visible' ? !next : next; }), { commit: true });
  }

  /** Ctrl+Shift+C: copia o CSS das camadas selecionadas para a área de transferência do sistema. */
  async function copyCss() {
    const nodes = commands.topSelection();
    if (!nodes.length) return;
    try {
      await navigator.clipboard.writeText(commands.cssOf(nodes));
      toast('CSS copiado!');
    } catch {
      toast('O navegador bloqueou a cópia. Use a aba Código.');
    }
  }

  /** Define o zoom (1 = 100%) ancorado no centro da vista. */
  function zoomTo(z) {
    const r = canvas.vpRect();
    canvas.zoomAt(z, r.width / 2, r.height / 2);
  }

  /** Reflete a ferramenta ativa no DOM (muda o cursor por CSS: [data-tool=…]). */
  const applyTool = () => {
    viewport.dataset.tool = ui.tool;
  };
  // Ao trocar de ferramenta: atualiza o cursor e encerra a caneta/edição de pontos se saímos dela.
  store.subscribeSync((reason) => {
    if (reason !== 'tool') return;
    applyTool();
    if (ui.tool !== 'pen' && pen.isDrawing()) pen.finish(false);
    if (ui.tool !== 'move' && pen.isEditing()) pen.exitEdit();
  });
  applyTool();

  return { startEdit, finishEdit, copyCss, toggleProp, zoomTo, pen };
}
