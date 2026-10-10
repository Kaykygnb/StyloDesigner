/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  commands.js — COMANDOS DE EDIÇÃO
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Tudo o que o usuário "faz" com camadas e que vai além de arrastar: excluir, duplicar, copiar/colar,
 *  agrupar, auto layout, alinhar, distribuir, ordem z, componentes, máscara, guias, vetores, imagens.
 *  Atalhos (tools.js), menus (ui/menus.js) e painéis (ui/*.js) chamam estas funções — a lógica não se repete.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { cloneNode, createNode, defaultFill, defaultLayout, hasLayout, nextName, resizeNode, round, uid } from './model.js';
import { generateCode, joinCss } from './css.js';
import { createInstance, detachInstance, makeComponent, syncInstances, textStyleFrom } from './components.js';
import { importSvg } from './svgimport.js';
import { booleanPolygons, ellipseContour, flattenContour, polygonsToContours, rectContour } from './geom.js';
import { addMode, removeMode, addVar, removeVar, bindVar, unbindVar, syncVars, modesOf, varsOf } from './modes.js';
import { imageAssetCatalog } from './image-assets.js';

/**
 * Cria os COMANDOS de edição: operações que mudam a ÁRVORE de camadas ou várias camadas de uma vez
 * (excluir, duplicar, copiar/colar, agrupar, ordem z, auto layout, alinhar, distribuir, componentes, máscara,
 * guias, vetores, imagens). É chamado por atalhos de teclado (tools.js), menus (menus.js) e painéis (ui/*.js),
 * então a lógica fica em UM lugar só.
 *
 * Padrão de todo comando: (1) descobre as camadas-alvo, (2) `store.update(...)` aplica a mudança, (3) ajusta a
 * seleção, (4) `store.commit()` grava no histórico (um desfazer desfaz o comando inteiro).
 *
 * @param {object} store
 * @param {object} canvas  precisa da geometria do DOM (posições reais em auto layout)
 */
export function createCommands(store, canvas) {
  // atalho para o estado de interface (seleção, clipboard...)
  const ui = store.ui;

  /**
   * Seleção "de topo": camadas selecionadas que NÃO têm um ancestral também selecionado.
   * Se você seleciona um frame e um filho dele, mover/duplicar/excluir deve agir só no frame (o filho vai junto).
   */
  const topSelection = () => {
    const ids = new Set(ui.selection);
    return store.selected().filter((n) => {
      for (let p = store.parentOf(n.id); p; p = store.parentOf(p.id)) if (ids.has(p.id)) return false;
      return true;
    });
  };

  /** Origem (canto superior esquerdo, no mundo) do pai; (0,0) quando a camada está na raiz da página. */
  const parentOrigin = (parent) => (parent ? canvas.originOf(parent.id) : { x: 0, y: 0 });

  /**
   * "Congela" a posição VISUAL atual como x/y. Em auto layout x/y do modelo são ignorados (o navegador posiciona),
   * então, antes de uma camada sair do fluxo (agrupar, desligar auto layout...), lemos onde ela está no DOM e
   * gravamos em x/y — assim nada "pula" de lugar.
   */
  function freezePositions(nodes, parent) {
    const po = parentOrigin(parent);
    for (const n of nodes) {
      const o = canvas.originOf(n.id);
      n.x = round(o.x - po.x);
      n.y = round(o.y - po.y);
    }
  }

  // ------------------------------------------------------------------ básicos
  /** Exclui as camadas selecionadas (e tudo dentro delas). */
  function deleteSelection() {
    const nodes = topSelection();
    if (!nodes.length) return;
    store.update(() => {
      for (const n of nodes) {
        const list = store.listOf(n.id);
        const i = list?.indexOf(n);
        if (i >= 0) list.splice(i, 1);
      }
    });
    store.setSelection([]);
    store.commit();
  }

  /** Duplica a seleção logo acima do original, deslocada 20px (em auto layout entra no fluxo, sem deslocar). */
  function duplicate() {
    const nodes = topSelection();
    if (!nodes.length) return;
    const copies = [];
    store.update(() => {
      for (const n of nodes) {
        const list = store.listOf(n.id);
        const copy = cloneNode(n);
        copy.name = n.name.replace(/ cópia$/, '') + ' cópia';
        if (!hasLayout(store.parentOf(n.id)) || n.absolute) {
          copy.x += 20;
          copy.y += 20;
        }
        list.splice(list.indexOf(n) + 1, 0, copy);
        copies.push(copy);
      }
    });
    store.setSelection(copies.map((c) => c.id));
    store.commit();
  }

  /**
   * Copia a seleção para a área de transferência INTERNA do app (ui.clipboard). Guardamos uma cópia JSON, assim ela
   * sobrevive mesmo que o original seja editado/apagado depois. Devolve false se não havia nada selecionado.
   */
  function copy() {
    const nodes = topSelection();
    if (!nodes.length) return false;
    ui.clipboard = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      parentId: store.parentOf(nodes[0].id)?.id ?? null,
      count: 0,
    };
    return true;
  }

  /** Recortar = copiar + excluir. */
  function cut() {
    if (copy()) deleteSelection();
  }

  /**
   * Cola o que está na área de transferência interna.
   *  - Com UM frame selecionado (que não seja o próprio copiado): cola DENTRO dele, mantendo a posição se couber
   *    ou centralizando se não couber.
   *  - Caso contrário: cola no mesmo pai de onde foi copiado, deslocando 16px a cada colagem seguida.
   */
  function paste() {
    const clip = ui.clipboard;
    if (!clip) return;
    clip.count++;
    // "into" = frame de destino quando há exatamente um frame selecionado
    const sel = store.selected();
    const into = sel.length === 1 && sel[0].type === 'frame' && !clip.nodes.some((c) => c.id === sel[0].id || c.type === 'section') ? sel[0] : null;
    const parent = into || (clip.parentId ? store.get(clip.parentId) : null);
    const list = parent?.children ?? store.page().children;
    const created = [];
    store.update(() => {
      for (const src of clip.nodes) {
        const n = cloneNode(src);
        if (into && !hasLayout(into)) {
          // mantém a posição se couber; senão centraliza
          const fits = n.x >= 0 && n.y >= 0 && n.x + n.w <= into.w && n.y + n.h <= into.h;
          if (!fits || clip.parentId === into.id) {
            n.x = Math.round((into.w - n.w) / 2);
            n.y = Math.round((into.h - n.h) / 2);
          }
          n.x += 16 * (clip.count - 1);
          n.y += 16 * (clip.count - 1);
        } else if (!into) {
          n.x += 16 * clip.count;
          n.y += 16 * clip.count;
        }
        n.absolute = false;
        list.push(n);
        created.push(n);
      }
    });
    store.setSelection(created.map((n) => n.id));
    store.commit();
  }

  // ------------------------------------------------------------------ caixa da seleção (várias camadas)
  /**
   * Move e/ou redimensiona várias camadas como UM conjunto, pelos campos X/Y/W/H do painel.
   * Cada campo é opcional. Mudar W/H escala cada camada e a distância dela até a borda do conjunto (como esticar
   * a caixa de seleção). Camadas dentro de auto layout só mudam de tamanho (a posição é do navegador).
   * `structural:false`: só números mudam, o índice do store continua válido (mais rápido).
   * @param {{x?:number,y?:number,w?:number,h?:number}} box  valores novos da caixa (coordenadas de mundo)
   */
  function setSelectionBox({ x, y, w, h }) {
    const nodes = topSelection();
    const box = canvas.unionAabb(nodes.map((n) => n.id));
    if (!box || !nodes.length) return;
    const sx = w != null && box.w ? Math.max(0.01, w) / box.w : 1;
    const sy = h != null && box.h ? Math.max(0.01, h) / box.h : 1;
    const dx = x != null ? x - box.x : 0, dy = y != null ? y - box.y : 0;
    const aabbs = nodes.map((n) => canvas.aabb(n.id));
    store.update(() => {
      nodes.forEach((n, i) => {
        const free = !(hasLayout(store.parentOf(n.id)) && !n.absolute);
        if (sx !== 1 || sy !== 1) {
          resizeNode(n, n.w * sx, n.h * sy, sx !== 1 ? 'w' : 'h');
          if (sx !== 1 && sy !== 1) { n.h = Math.max(1, round(n.h)); }
        }
        if (free) {
          n.x = round(n.x + dx + (aabbs[i].x - box.x) * (sx - 1));
          n.y = round(n.y + dy + (aabbs[i].y - box.y) * (sy - 1));
        }
      });
    }, { structural: false });
  }

  // ------------------------------------------------------------------ copiar / colar propriedades (visual)
  /**
   * "Copiar propriedades" (Ctrl+Alt+C / Ctrl+Alt+V), como "copiar formato" do Word: leva só a APARÊNCIA
   * (preenchimento, contorno, cantos, sombras, blur, opacidade, mesclagem) e, se a origem é texto, também a tipografia.
   */
  const STYLE_KEYS = ['fill', 'stroke', 'radius', 'shadows', 'blur', 'bgBlur', 'opacity', 'blend', 'fx'];
  const TEXT_KEYS = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing', 'textAlign', 'textDecoration', 'textTransform', 'truncate', 'lines', 'textStyleId'];

  /** Guarda a aparência da 1ª camada selecionada em ui.styleClipboard. */
  function copyStyle() {
    const n = store.selected()[0];
    if (!n) return false;
    const keys = n.type === 'text' ? [...STYLE_KEYS, ...TEXT_KEYS] : STYLE_KEYS;
    // fx entra sempre ({} = sem filtros) para colar também LIMPAR os filtros do destino
    ui.styleClipboard = { type: n.type, props: JSON.parse(JSON.stringify(Object.fromEntries(keys.filter((k) => n[k] !== undefined || k === 'fx').map((k) => [k, n[k] ?? {}])))) };
    return true;
  }

  /**
   * Aplica a aparência guardada a todas as camadas selecionadas, ignorando o que não faz sentido para o tipo do
   * destino (ex.: tipografia em retângulo, cantos em elipse/texto, fill em grupo).
   */
  function pasteStyle() {
    const c = ui.styleClipboard;
    const nodes = topSelection();
    if (!c || !nodes.length) return false;
    store.update(() => {
      for (const n of nodes) {
        for (const [k, v] of Object.entries(c.props)) {
          if (TEXT_KEYS.includes(k) && n.type !== 'text') continue;
          if (k === 'radius' && ['text', 'ellipse', 'group', 'line', 'path'].includes(n.type)) continue;
          if (k === 'fill' && n.type === 'group') continue;
          if (k === 'fx' && !Object.keys(v).length) { delete n.fx; continue; }
          n[k] = JSON.parse(JSON.stringify(v));
        }
      }
    }, { commit: true });
    return true;
  }

  // ------------------------------------------------------------------ agrupar
  /**
   * Agrupa as camadas selecionadas (Ctrl+G). Só agrupa irmãs do MESMO pai (a 1ª selecionada manda). O grupo entra na
   * posição da camada mais alta e os filhos mantêm a ordem z. Antes, congela as posições (ver freezePositions).
   * A caixa do grupo é calculada depois, no commit, por fitGroups.
   */
  function group() {
    const nodes = topSelection().filter((n) => n.type !== 'section'); // seção não entra em grupo
    if (!nodes.length) return;
    const parent = store.parentOf(nodes[0].id);
    const list = store.listOf(nodes[0].id);
    const same = nodes.filter((n) => store.listOf(n.id) === list).sort((a, b) => list.indexOf(a) - list.indexOf(b));
    freezePositions(same, parent);
    const g = createNode('group', { name: nextName(store.page(), 'group') });
    store.update(() => {
      const at = list.indexOf(same[same.length - 1]);
      same.forEach((n) => list.splice(list.indexOf(n), 1));
      g.children = same;
      same.forEach((n) => { n.absolute = false; });
      list.splice(at - same.length + 1, 0, g);
    });
    store.setSelection([g.id]);
    store.commit();
  }

  /**
   * Desagrupa (Ctrl+Shift+G): os filhos sobem um nível, no lugar do grupo, mantendo a posição visual
   * (somamos x/y do grupo). Funciona em grupos e em frames comuns; componentes/instâncias são ignorados.
   */
  function ungroup() {
    const groups = store.selected().filter((n) => n.type === 'group' || n.type === 'section' || (n.type === 'frame' && !n.component && !n.instanceOf));
    if (!groups.length) return;
    const out = [];
    store.update(() => {
      for (const g of groups) {
        const list = store.listOf(g.id);
        const i = list.indexOf(g);
        if (g.type === 'frame') freezePositions(g.children, g);
        for (const c of g.children) {
          c.absolute = false;
          c.x += g.x;
          c.y += g.y;
          out.push(c);
        }
        list.splice(i, 1, ...g.children);
      }
    });
    store.setSelection(out.map((n) => n.id));
    store.commit();
  }

  // ------------------------------------------------------------------ ordem (z-index)
  /**
   * Muda a ordem z (quem fica na frente). A ordem do array É a ordem de desenho: o último é o que fica por cima.
   * @param {'front'|'back'|'forward'|'backward'} mode  frente / fundo / um passo à frente / um passo atrás
   */
  function reorder(mode) {
    const nodes = topSelection();
    store.update(() => {
      const sorted = [...nodes].sort((a, b) => store.listOf(a.id).indexOf(a) - store.listOf(b.id).indexOf(b));
      if (mode === 'front' || mode === 'forward') sorted.reverse();
      for (const n of sorted) {
        const list = store.listOf(n.id);
        const i = list.indexOf(n);
        let j = i;
        if (mode === 'front') j = list.length - 1;
        else if (mode === 'back') j = 0;
        else if (mode === 'forward') j = Math.min(list.length - 1, i + 1);
        else j = Math.max(0, i - 1);
        list.splice(i, 1);
        list.splice(j, 0, n);
      }
    });
    store.commit();
  }

  // ------------------------------------------------------------------ auto layout
  /**
   * Liga o auto layout num frame que tinha filhos livres, DEDUZINDO a configuração a partir de onde eles estão,
   * para nada "pular" de lugar:
   *  - direção: filhos espalhados mais na horizontal → 'row'; senão 'column'. Um filho só: frame alto (ex.: uma
   *    sidebar) → 'column'; largo → 'row';
   *  - gap: média dos vãos entre filhos consecutivos;
   *  - padding: distância entre os filhos e as bordas. Mas se o conteúdo está encostado no início e sobra MUITO
   *    espaço no fim (ex.: um item no topo de uma sidebar), essa sobra é espaço livre, não margem: o padding do fim
   *    fica igual ao do início (senão um padding-bottom de 500px espremeria os próximos itens);
   *  - alinhamento: conteúdo centralizado no frame → 'center'; encostado no fim → 'flex-end'. No eixo cruzado, com
   *    vários filhos, olha se eles estavam alinhados pelo início, pelo centro ou pelo fim.
   * Também reordena os filhos na ordem em que aparecem na tela, e tira o "absoluto" de todos.
   */
  function enableAutoLayout(frame) {
    const kids = frame.children.filter((c) => c.visible);
    // sem filhos: frame alto (ex.: uma sidebar vazia) → coluna; largo → linha
    const layout = { ...defaultLayout(), mode: frame.h > frame.w ? 'column' : 'row', gap: 8 };
    if (kids.length) {
      const xs = kids.map((k) => k.x), ys = kids.map((k) => k.y);
      const spreadX = Math.max(...xs) - Math.min(...xs);
      const spreadY = Math.max(...ys) - Math.min(...ys);
      if (kids.length === 1) layout.mode = frame.h > frame.w ? 'column' : 'row';
      else layout.mode = spreadX >= spreadY ? 'row' : 'column';
      const row = layout.mode === 'row';
      const key = row ? 'x' : 'y';
      const size = row ? 'w' : 'h';
      frame.children.sort((a, b) => a[key] - b[key]);
      const sorted = kids.sort((a, b) => a[key] - b[key]);
      let gaps = 0;
      for (let i = 1; i < sorted.length; i++) gaps += Math.max(0, sorted[i][key] - (sorted[i - 1][key] + sorted[i - 1][size]));
      layout.gap = sorted.length > 1 ? Math.round(gaps / (sorted.length - 1)) : 8;
      const minX = Math.min(...kids.map((k) => k.x)), minY = Math.min(...kids.map((k) => k.y));
      const maxX = Math.max(...kids.map((k) => k.x + k.w)), maxY = Math.max(...kids.map((k) => k.y + k.h));
      // distâncias do conteúdo até cada borda (nunca negativas)
      const d = { top: minY, right: frame.w - maxX, bottom: frame.h - maxY, left: minX };
      for (const k in d) d[k] = Math.max(0, Math.round(d[k]));
      const [ms, me] = row ? [d.left, d.right] : [d.top, d.bottom]; // eixo principal: início, fim
      const [cs, ce] = row ? [d.top, d.bottom] : [d.left, d.right]; // eixo cruzado: início, fim
      const near = (a, b) => Math.abs(a - b) <= 2;
      // ---- eixo principal
      let pms = ms, pme = me;
      if (near(ms, me) && ms > 0) { layout.justify = 'center'; }
      else if (ms > me * 2 + 16) { layout.justify = 'flex-end'; pms = me; }
      else if (me > ms * 2 + 16) { pme = ms; }
      // ---- eixo cruzado
      let pcs = cs, pce = ce;
      const cross = row ? ['y', 'h'] : ['x', 'w'];
      const starts = kids.map((k) => k[cross[0]]), centers = kids.map((k) => k[cross[0]] + k[cross[1]] / 2), ends = kids.map((k) => k[cross[0]] + k[cross[1]]);
      const same = (v) => Math.max(...v) - Math.min(...v) <= 2;
      if (kids.length > 1 && !same(starts) && same(centers)) layout.align = 'center';
      else if (kids.length > 1 && !same(starts) && same(ends)) { layout.align = 'flex-end'; pcs = ce; }
      else if (near(cs, ce) && cs > 0) layout.align = 'center';
      else if (cs > ce * 2 + 16) { layout.align = 'flex-end'; pcs = ce; }
      else if (ce > cs * 2 + 16) pce = cs;
      layout.padding = row ? [pcs, pme, pce, pms] : [pms, pce, pme, pcs];
    }
    frame.layout = layout;
    frame.children.forEach((c) => { c.absolute = false; });
  }

  /** Desliga o auto layout congelando as posições atuais (nada muda visualmente). */
  function disableAutoLayout(frame) {
    freezePositions(frame.children, frame);
    frame.layout.mode = 'none';
  }

  /**
   * Troca o modo do layout (none | row | column | grid). Ao LIGAR numa frame livre, deduz a configuração
   * (enableAutoLayout); ao DESLIGAR, congela as posições. Em grid, sugere um nº de colunas pela raiz da qtd de filhos.
   * Chamado de dentro de `store.update`, por isso não faz commit.
   */
  function setLayoutMode(frames, mode) {
    for (const f of frames) {
      if (f.type !== 'frame' || f.layout.mode === mode) continue;
      if (mode === 'none') disableAutoLayout(f);
      else {
        const wasNone = f.layout.mode === 'none';
        if (wasNone) enableAutoLayout(f);
        f.layout.mode = mode;
        // os valores de alinhamento não são os mesmos no flex e no grid: troca o que não existe no destino
        // (grid não tem space-between/baseline em justify-items/align-items; flex não tem stretch em justify-content)
        const GRIDOK = ['flex-start', 'center', 'flex-end', 'stretch'];
        if (mode === 'grid') {
          if (!GRIDOK.includes(f.layout.justify)) f.layout.justify = 'flex-start';
          if (!GRIDOK.includes(f.layout.align)) f.layout.align = 'flex-start';
        } else if (f.layout.justify === 'stretch') f.layout.justify = 'flex-start';
        if (mode === 'grid' && wasNone) f.layout.cols = Math.max(2, Math.min(4, Math.round(Math.sqrt(f.children.length)) + 1));
      }
    }
  }

  /**
   * Shift+A — "Adicionar auto layout", tentando entender a INTENÇÃO (como no Figma), em vez de só embrulhar:
   *  - FRAME selecionado → liga/desliga o auto layout dele;
   *  - um RETÂNGULO sozinho → ele VIRA um frame com auto layout (mesma cor, cantos, contorno, sombra e id), pronto
   *    para receber camadas. Embrulhar um retângulo num frame não serviria para nada: retângulo não tem filhos;
   *  - um GRUPO → o grupo vira o frame (os filhos dele são os itens do layout);
   *  - várias camadas → um frame novo envolve todas. Se a camada MAIS AO FUNDO for um retângulo que contém todas as
   *    outras (ex.: o fundo de uma sidebar com itens em cima), ele vira o FUNDO do frame em vez de mais um item —
   *    senão o auto layout colocaria o fundo e os itens lado a lado. Sem fundo, o frame abraça o conteúdo (hug).
   */
  function toggleAutoLayout() {
    const nodes = topSelection().filter((n) => n.type !== 'section');
    if (!nodes.length) return;
    if (nodes.length === 1 && nodes[0].type === 'frame') {
      const f = nodes[0];
      store.update(() => (hasLayout(f) ? disableAutoLayout(f) : enableAutoLayout(f)));
      store.commit();
      return;
    }
    const first = nodes[0];
    const parent = store.parentOf(first.id);
    const list = store.listOf(first.id);
    /** Frame com a APARÊNCIA de um retângulo (para o retângulo "virar" o frame). */
    const frameFrom = (r, props) => createNode('frame', {
      id: r.id, name: r.name, fill: r.fill, stroke: r.stroke, radius: r.radius, shadows: r.shadows, blur: r.blur,
      bgBlur: r.bgBlur, opacity: r.opacity, blend: r.blend, rotation: r.rotation, constraints: r.constraints,
      sizeX: r.sizeX, sizeY: r.sizeY, alignSelf: r.alignSelf, justifySelf: r.justifySelf, colSpan: r.colSpan, rowSpan: r.rowSpan, absolute: r.absolute, interactions: r.interactions,
      clip: true, x: r.x, y: r.y, w: r.w, h: r.h, ...props,
    });

    // um retângulo sozinho: vira o próprio frame
    if (nodes.length === 1 && first.type === 'rect') {
      const frame = frameFrom(first);
      store.update(() => {
        list.splice(list.indexOf(first), 1, frame);
        enableAutoLayout(frame);
        frame.layout.mode = frame.h > frame.w ? 'column' : 'row';
        frame.layout.padding = [16, 16, 16, 16];
      });
      store.setSelection([frame.id]);
      store.commit();
      notify('O retângulo virou um frame com auto layout: desenhe ou arraste camadas para dentro dele.');
      return;
    }

    // os ITENS do layout e onde eles estão: num grupo, os filhos dele (coordenadas relativas ao grupo)
    const group = nodes.length === 1 && first.type === 'group' ? first : null;
    let items, ox = 0, oy = 0;
    if (group) {
      items = [...group.children];
      ox = group.x; oy = group.y;
    } else {
      items = nodes.filter((n) => store.listOf(n.id) === list).sort((a, b) => list.indexOf(a) - list.indexOf(b));
      freezePositions(items, parent);
    }
    // fundo: a camada mais ao fundo é um retângulo (sem rotação) que contém todas as outras?
    const inside = (n, r) => n.x >= r.x - 1 && n.y >= r.y - 1 && n.x + n.w <= r.x + r.w + 1 && n.y + n.h <= r.y + r.h + 1;
    const bg = items.length > 1 && items[0].type === 'rect' && !items[0].rotation && items.slice(1).every((n) => inside(n, items[0])) ? items[0] : null;
    const kids = bg ? items.slice(1) : items;
    const x0 = bg ? bg.x : Math.min(...kids.map((n) => n.x)), y0 = bg ? bg.y : Math.min(...kids.map((n) => n.y));
    const x1 = bg ? bg.x + bg.w : Math.max(...kids.map((n) => n.x + n.w)), y1 = bg ? bg.y + bg.h : Math.max(...kids.map((n) => n.y + n.h));
    const frame = bg
      ? frameFrom(bg, { x: round(ox + x0), y: round(oy + y0) })
      : createNode('frame', { name: group ? group.name : 'Auto layout', x: round(ox + x0), y: round(oy + y0), w: round(x1 - x0), h: round(y1 - y0), clip: false, fill: { ...defaultFill('#FFFFFF'), type: 'none' } });
    store.update(() => {
      // o frame entra na posição (camada) do item mais ao fundo, para não passar por cima de vizinhos
      const removed = group ? [group] : items;
      const at = Math.min(...removed.map((n) => list.indexOf(n)));
      removed.forEach((n) => list.splice(list.indexOf(n), 1));
      kids.forEach((n) => { n.x = round(n.x - x0); n.y = round(n.y - y0); n.absolute = false; });
      frame.children = kids;
      enableAutoLayout(frame);
      // sem fundo, o frame é só um "embrulho": abraça o conteúdo (nada transborda); com fundo, mantém o tamanho dele
      if (!bg) { frame.sizeX = 'hug'; frame.sizeY = 'hug'; }
      list.splice(at, 0, frame);
    });
    store.setSelection([frame.id]);
    store.commit();
    if (bg) notify(`"${bg.name}" virou o fundo do frame; as camadas de cima entraram no auto layout.`);
  }

  // ------------------------------------------------------------------ alinhar / distribuir
  /** Soma dx/dy à posição x/y da camada (arredondando). */
  function shift(node, dx, dy) {
    node.x = round(node.x + dx);
    node.y = round(node.y + dy);
  }

  /**
   * Alinha a seleção. Com UMA camada, alinha dentro do pai; com várias, alinha entre si (pela caixa do conjunto).
   * Camadas em auto layout são ignoradas (o navegador decide a posição delas).
   * @param {'left'|'hcenter'|'right'|'top'|'vcenter'|'bottom'} kind
   */
  function align(kind) {
    const nodes = topSelection().filter((n) => !(hasLayout(store.parentOf(n.id)) && !n.absolute));
    if (!nodes.length) return;
    let ref;
    if (nodes.length === 1) {
      const parent = store.parentOf(nodes[0].id);
      if (!parent) return;
      ref = canvas.aabb(parent.id);
    } else {
      ref = canvas.unionAabb(nodes.map((n) => n.id));
    }
    store.update(() => {
      for (const n of nodes) {
        const b = canvas.aabb(n.id);
        let dx = 0, dy = 0;
        if (kind === 'left') dx = ref.x - b.x;
        if (kind === 'hcenter') dx = ref.x + ref.w / 2 - (b.x + b.w / 2);
        if (kind === 'right') dx = ref.x + ref.w - (b.x + b.w);
        if (kind === 'top') dy = ref.y - b.y;
        if (kind === 'vcenter') dy = ref.y + ref.h / 2 - (b.y + b.h / 2);
        if (kind === 'bottom') dy = ref.y + ref.h - (b.y + b.h);
        shift(n, dx, dy);
      }
    });
    store.commit();
  }

  /**
   * Distribui 3+ camadas com vãos IGUAIS entre elas, mantendo a primeira e a última no lugar.
   * @param {'h'|'v'} axis  horizontal ou vertical
   */
  function distribute(axis) {
    const nodes = topSelection().filter((n) => !(hasLayout(store.parentOf(n.id)) && !n.absolute));
    if (nodes.length < 3) return;
    const horizontal = axis === 'h';
    const items = nodes
      .map((n) => ({ n, b: canvas.aabb(n.id) }))
      .sort((a, b) => (horizontal ? a.b.x - b.b.x : a.b.y - b.b.y));
    const first = items[0].b, last = items[items.length - 1].b;
    const start = horizontal ? first.x : first.y;
    const end = horizontal ? last.x + last.w : last.y + last.h;
    const total = items.reduce((s, it) => s + (horizontal ? it.b.w : it.b.h), 0);
    const gap = (end - start - total) / (items.length - 1);
    let cursor = start;
    store.update(() => {
      for (const it of items) {
        const cur = horizontal ? it.b.x : it.b.y;
        if (horizontal) shift(it.n, cursor - cur, 0);
        else shift(it.n, 0, cursor - cur);
        cursor += (horizontal ? it.b.w : it.b.h) + gap;
      }
    });
    store.commit();
  }

  // ------------------------------------------------------------------ mover entre pais
  /**
   * Move camadas para outro pai (ou para a raiz da página) MANTENDO a posição visual: lê a origem de cada uma no DOM
   * antes e recalcula x/y relativo ao novo pai. Usado ao arrastar para dentro de frames e no arrastar da lista de camadas.
   * Não deixa mover uma camada para dentro de si mesma/de um descendente.
   * @param {object[]} nodes  camadas a mover
   * @param {object|null} newParent  novo pai (null = raiz)
   * @param {number|null} [index]  posição na lista do novo pai (null = no topo)
   */
  function reparent(nodes, newParent, index = null) {
    // seção só vive na raiz; dentro de uma seção só entram frames
    const allowed = (n) => (n.type === 'section' ? !newParent : newParent?.type === 'section' ? n.type === 'frame' : true);
    const moves = nodes.filter((n) => n !== newParent && allowed(n) && !(newParent && store.isAncestor(n.id, newParent.id)));
    if (!moves.length) return;
    const origins = new Map(moves.map((n) => [n.id, canvas.originOf(n.id)]));
    store.update(() => {
      const target = newParent ? newParent.children : store.page().children;
      const po = parentOrigin(newParent);
      for (const n of moves) {
        const old = store.listOf(n.id);
        const oi = old.indexOf(n);
        old.splice(oi, 1);
        if (old === target && index !== null && oi < index) index--;
      }
      let at = index === null ? target.length : Math.min(index, target.length);
      for (const n of moves) {
        const o = origins.get(n.id);
        n.x = round(o.x - po.x);
        n.y = round(o.y - po.y);
        n.absolute = false;
        target.splice(at++, 0, n);
      }
    });
  }

  // ------------------------------------------------------------------ imagens
  /** Lê o arquivo de imagem (reduzindo se for grande), guarda em doc.assets e devolve { assetId, w, h }. */
  async function importAsset(file) {
    const { dataUrl, w, h } = await readImage(file);
    const assetId = uid();
    store.addAsset(assetId, dataUrl);
    return { assetId, w, h };
  }

  /**
   * Cria uma camada-retângulo com preenchimento de imagem para cada arquivo (botão, arrastar, colar).
   * A imagem é reduzida para caber em 520px de maior lado e fica centralizada na posição `at` (ou no centro da vista).
   * @returns {Promise<boolean>} true se criou alguma camada
   */
  async function addImageFiles(files, at) {
    const created = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      // .svg entra como VETOR EDITÁVEL (ver svgimport.js); se não der para ler, cai para imagem comum
      if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || '')) {
        try {
          insertSvg(await file.text(), { at: at && { x: at.x + created.length * 24, y: at.y + created.length * 24 }, name: file.name?.replace(/\.svg$/i, '') });
          created.push(null);
          continue;
        } catch (err) {
          notify(`SVG não pôde ser lido como vetor (${err.message}); entrou como imagem.`);
        }
      }
      const { assetId, w, h } = await importAsset(file);
      const scale = Math.min(1, 520 / Math.max(w, h));
      const node = createNode('rect', {
        name: file.name?.replace(/\.[^.]+$/, '') || 'Imagem',
        w: Math.round(w * scale), h: Math.round(h * scale),
        fill: { ...defaultFill(), type: 'image', assetId, fit: 'cover', natW: w, natH: h },
      });
      const r = canvas.vpRect();
      const p = at || canvas.toWorld(r.left + r.width / 2, r.top + r.height / 2);
      node.x = Math.round(p.x - node.w / 2 + created.length * 24);
      node.y = Math.round(p.y - node.h / 2 + created.length * 24);
      created.push(node);
    }
    if (!created.length) return false;
    const images = created.filter(Boolean); // null = SVG já inserido como vetor
    if (!images.length) return true;
    store.update((page) => page.children.push(...images));
    store.setSelection(images.map((n) => n.id));
    store.commit();
    return true;
  }

  /** Reutiliza uma imagem já importada no projeto, sem duplicar seu data URL. */
  async function insertImageAsset(assetId, at, { parentId = null, index, name } = {}) {
    const doc = store.state.doc;
    const src = doc.assets?.[assetId];
    if (typeof src !== 'string' || !src.startsWith('data:image/')) throw new Error('Imagem do projeto não encontrada. Atualize a lista de assets e tente novamente.');
    const meta = imageAssetCatalog(doc).find((a) => a.id === assetId);
    let w = meta?.width, h = meta?.height;
    if (!(w > 0 && h > 0)) {
      const image = new Image();
      image.src = src;
      try { await image.decode(); } catch { throw new Error('Não consegui ler as dimensões desta imagem.'); }
      w = image.naturalWidth;
      h = image.naturalHeight;
    }
    if (!(w > 0 && h > 0)) throw new Error('Esta imagem não tem dimensões válidas.');
    const scale = Math.min(1, 520 / Math.max(w, h));
    const node = createNode('rect', {
      name: String(name || meta?.name || 'Imagem').trim().slice(0, 120) || 'Imagem',
      w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)),
      fill: { ...defaultFill(), type: 'image', assetId, fit: 'cover', natW: w, natH: h },
    });
    const parent = parentId ? store.get(parentId) : null;
    if (parentId && !parent) throw new Error(`Frame "${parentId}" não existe.`);
    if (parent && !parent.children) throw new Error(`“${parent.name}” não pode receber uma imagem.`);
    store.update((page) => {
      if (parent) {
        const origin = canvas.originOf(parent.id);
        const center = at ? { x: at.x - origin.x, y: at.y - origin.y } : { x: parent.w / 2, y: parent.h / 2 };
        node.x = Math.round(center.x - node.w / 2);
        node.y = Math.round(center.y - node.h / 2);
        const list = parent.children;
        list.splice(Number.isInteger(index) ? Math.max(0, Math.min(index, list.length)) : list.length, 0, node);
      } else {
        const rect = canvas.vpRect();
        const point = at || canvas.toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
        node.x = Math.round(point.x - node.w / 2);
        node.y = Math.round(point.y - node.h / 2);
        page.children.push(node);
      }
    });
    store.setSelection([node.id]);
    store.commit();
    return node;
  }

  /** Mostra um aviso ao usuário (main.js liga em `commands.notify = toast`). */
  const notify = (msg) => api.notify?.(msg);

  /**
   * Insere uma camada NOVA já pronta: dentro do frame selecionado (centralizada nele; se o frame tem auto layout,
   * ela entra no fluxo) ou na raiz da página, centralizada em `at` (mundo) ou no meio da tela. Seleciona e grava.
   */
  function placeNew(node, at) {
    const sel = store.selected();
    const frame = !at && sel.length === 1 && sel[0].type === 'frame' ? sel[0] : null;
    store.update((page) => {
      if (frame) {
        node.x = round((frame.w - node.w) / 2);
        node.y = round((frame.h - node.h) / 2);
        frame.children.push(node);
      } else {
        const r = canvas.vpRect();
        const p = at || canvas.toWorld(r.left + r.width / 2, r.top + r.height / 2);
        node.x = round(p.x - node.w / 2);
        node.y = round(p.y - node.h / 2);
        page.children.push(node);
      }
    });
    store.setSelection([node.id]);
    store.commit();
    return node;
  }

  /**
   * Importa um SVG (texto) como vetores editáveis e insere (ver placeNew). Avisa O QUE do SVG ficou de fora
   * (ex.: "sombra interna, máscara"). Lança erro se o texto não for um SVG com formas.
   * @param {string} text
   * @param {{at?: {x,y}, name?: string, currentColor?: string, fill?: string, size?: number}} [opts]
   */
  function insertSvg(text, { at, name, currentColor, fill, size } = {}) {
    const { node, ignored } = importSvg(text, { name, currentColor, fill, size });
    placeNew(node, at);
    if (ignored.length) notify(`SVG importado. Não suportado, ficou de fora: ${ignored.join(', ')}.`);
    return node;
  }

  /**
   * Cria uma camada "Código HTML" (HTML escrito à mão, ver html.js → sanitizeHtml) no frame selecionado ou no meio da
   * tela e abre a aba Código já no modo de edição do HTML.
   */
  function addHtmlEmbed(at) {
    const node = placeNew(createNode('html', { name: 'Código HTML' }), at);
    ui.codeOpen = { tab: 'html', edit: true };
    ui.setRightTab?.('code');
    return node;
  }

  /** Cria uma camada de texto com o texto dado (usado ao colar texto do sistema no canvas). */
  function addText(textValue, at) {
    const r = canvas.vpRect();
    const p = at || canvas.toWorld(r.left + r.width / 2, r.top + r.height / 2);
    const node = createNode('text', { name: textValue.slice(0, 24), text: textValue, x: Math.round(p.x), y: Math.round(p.y) });
    store.update((page) => page.children.push(node));
    store.setSelection([node.id]);
    store.commit();
  }


  // ------------------------------------------------------------------ componentes
  /**
   * Envolve camadas irmãs num frame novo (sem layout, sem preenchimento) do tamanho do conjunto.
   * Base de "Envolver em frame", "Criar componente" de vários itens e "Auto layout" de vários itens.
   * Deve ser chamada dentro de `store.update`.
   */
  function wrapInFrame(same, name) {
    const parent = store.parentOf(same[0].id);
    const list = store.listOf(same[0].id);
    freezePositions(same, parent);
    const x0 = Math.min(...same.map((n) => n.x)), y0 = Math.min(...same.map((n) => n.y));
    const x1 = Math.max(...same.map((n) => n.x + n.w)), y1 = Math.max(...same.map((n) => n.y + n.h));
    const frame = createNode('frame', { name, x: x0, y: y0, w: x1 - x0, h: y1 - y0, clip: false, fill: { ...defaultFill('#FFFFFF'), type: 'none' } });
    const at = list.indexOf(same[same.length - 1]);
    same.forEach((n) => list.splice(list.indexOf(n), 1));
    same.forEach((n) => { n.x -= x0; n.y -= y0; n.absolute = false; });
    frame.children = same;
    list.splice(at - same.length + 1, 0, frame);
    return frame;
  }

  /** Filtra a seleção para as camadas que estão na mesma lista que a primeira (irmãs), ordenadas pela ordem z. */
  function sameLevel(nodes) {
    const list = store.listOf(nodes[0].id);
    return nodes.filter((n) => store.listOf(n.id) === list).sort((a, b) => list.indexOf(a) - list.indexOf(b));
  }

  /**
   * Ctrl+Alt+K: transforma a seleção em COMPONENTE PRINCIPAL. Várias camadas (ou texto/linha soltos) são
   * primeiro envolvidas num frame, porque componente precisa de uma raiz.
   */
  function createComponent() {
    const nodes = topSelection();
    if (!nodes.length) return;
    let target = nodes[0];
    store.update(() => {
      if (nodes.length > 1 || ['text', 'line'].includes(target.type)) {
        target = wrapInFrame(sameLevel(nodes), nodes.length > 1 ? 'Componente' : nodes[0].name);
      }
      makeComponent(target);
    });
    store.setSelection([target.id]);
    store.commit();
    return target;
  }

  /**
   * Cria uma INSTÂNCIA de um componente. Sem posição dada, entra ao lado do principal; com `at`, centralizada ali
   * (usado ao clicar no componente na aba Recursos).
   * @param {string} mainId  id do componente principal
   * @param {{x:number,y:number}} [at]  centro desejado, em coordenadas do mundo
   */
  function insertInstance(mainId, at) {
    const main = store.get(mainId);
    if (!main) return;
    let inst;
    store.update((page) => {
      inst = createInstance(main, store.state.doc.pages);
      inst.name = main.name;
      const parent = store.parentOf(main.id);
      if (at) { inst.x = Math.round(at.x - main.w / 2); inst.y = Math.round(at.y - main.h / 2); (page.children).push(inst); }
      else {
        inst.x = main.x + main.w + 40;
        inst.y = main.y;
        (parent ? parent.children : page.children).push(inst);
      }
    });
    store.setSelection([inst.id]);
    store.commit();
    return inst;
  }

  /** Ctrl+Alt+B: desanexa as instâncias selecionadas (viram camadas comuns). */
  function detach() {
    const insts = store.selected().filter((n) => n.instanceOf);
    if (!insts.length) return;
    store.update(() => insts.forEach(detachInstance), { commit: true });
  }

  /** "Ir ao principal": abre a página do componente principal, seleciona e enquadra. */
  function goToMain(id) {
    const main = store.get(store.get(id)?.instanceOf);
    if (!main) return false;
    const page = store.entry(main.id).page;
    if (page.id !== store.ui.pageId) store.switchPage(page.id);
    store.setSelection([main.id]);
    canvas.fit([main.id], { maxZoom: 1.5, padding: 160 });
    return true;
  }

  // ------------------------------------------------------------------ máscara e espelhar
  /**
   * Ctrl+Alt+M: máscara. Com várias camadas: agrupa e usa a de baixo como máscara (recorta as outras, via clip-path).
   * Com uma camada que já está num grupo: liga/desliga o papel de máscara dela.
   */
  function toggleMask() {
    const nodes = topSelection();
    if (!nodes.length) return;
    const parent = store.parentOf(nodes[0].id);
    if (nodes.length === 1 && parent?.type === 'group') {
      store.update(() => { nodes[0].isMask = !nodes[0].isMask; }, { commit: true });
      return;
    }
    if (nodes.length < 2) return;
    group();
    const g = store.get(ui.selection[0]);
    store.update(() => { g.children[0].isMask = true; g.name = 'Máscara'; }, { commit: true });
  }

  /** Espelha as camadas selecionadas na horizontal ('x') ou vertical ('y'). */
  function flip(axis) {
    const nodes = topSelection();
    if (!nodes.length) return;
    const key = axis === 'x' ? 'flipX' : 'flipY';
    store.update(() => nodes.forEach((n) => { n[key] = !n[key]; }), { commit: true });
  }

  // ------------------------------------------------------------------ estilos compartilhados
  /** Cria um estilo de cor compartilhado a partir do preenchimento de uma camada e já liga a camada a ele. */
  function addColorStyle(node, name) {
    const st = { id: uid(), name: name || `Cor ${store.state.doc.styles.colors.length + 1}`, color: node.fill.color, opacity: node.fill.opacity };
    store.state.doc.styles.colors.push(st);
    node.fill.styleId = st.id;
    store.commit();
    return st;
  }
  /** Cria vários estilos de cor de uma vez (ex.: a partir de uma paleta): [{ name, color }]. Um único passo de desfazer. */
  function addColorStyles(items) {
    for (const { name, color } of items) store.state.doc.styles.colors.push({ id: uid(), name, color, opacity: 1 });
    store.commit();
  }
  // ------------------------------------------------------------------ modos de cor e variáveis de tamanho
  /** Cria um modo de cor (escuro...) e já o mostra no canvas. `auto`: gera os valores invertendo a luminosidade. */
  function addColorMode({ name, scheme = null, auto = false }) {
    const m = addMode(store.state.doc.styles, { name, scheme, auto });
    store.commit();
    store.setMode(m.id);
    return m;
  }
  /** Muda o nome de um modo de cor (o atributo data-theme no CSS acompanha). */
  function renameColorMode(id, name) {
    const m = modesOf(store.state.doc.styles).find((x) => x.id === id);
    if (!m || !String(name || '').trim()) return;
    m.name = String(name).trim();
    store.commit();
  }
  /** Define se o modo vale sozinho pela preferência do sistema ('dark' | 'light' | null = só com data-theme). */
  function setModeScheme(id, scheme) {
    const m = modesOf(store.state.doc.styles).find((x) => x.id === id);
    if (!m) return;
    m.scheme = scheme || null;
    store.commit();
  }
  /** Apaga um modo de cor (os valores dele nos estilos também). */
  function deleteColorMode(id) {
    removeMode(store.state.doc.styles, id);
    if (ui.mode === id) store.setMode(null);
    store.commit();
  }
  /** Cria uma variável de tamanho (espaçamento, raio, fonte). */
  function addSizeVar(name, value) {
    const v = addVar(store.state.doc.styles, name, value);
    store.commit();
    return v;
  }
  /** Muda o valor de uma variável e leva o valor a todas as camadas ligadas a ela. */
  function setSizeVar(id, patch) {
    const v = varsOf(store.state.doc.styles).find((x) => x.id === id);
    if (!v) return;
    if (patch.name != null && String(patch.name).trim()) v.name = String(patch.name).trim();
    if (patch.value != null && Number.isFinite(Number(patch.value))) v.value = Math.max(0, Number(patch.value));
    syncVars(store.state.doc, true);
    store.commit();
  }
  /** Apaga uma variável (as camadas mantêm o valor que tinham). */
  function deleteSizeVar(id) {
    removeVar(store.state.doc.styles, id);
    store.commit();
  }
  /** Liga (ou, com `v` nulo, desliga) um campo de várias camadas a uma variável de tamanho. */
  function bindSizeVar(nodes, prop, v) {
    store.update(() => nodes.forEach((n) => (v ? bindVar(n, prop, v) : unbindVar(n, prop))), { commit: true });
  }

  /** Cria um estilo de texto compartilhado a partir da tipografia de uma camada e já liga a camada a ele. */
  function addTextStyle(node, name) {
    const st = { id: uid(), name: name || `Texto ${store.state.doc.styles.texts.length + 1}`, ...textStyleFrom(node) };
    store.state.doc.styles.texts.push(st);
    node.textStyleId = st.id;
    store.commit();
    return st;
  }
  /** Apaga um estilo ('colors' ou 'texts'); as camadas ligadas mantêm os valores que tinham. */
  function removeStyle(kind, id) {
    const list = store.state.doc.styles[kind];
    const i = list.findIndex((s) => s.id === id);
    if (i >= 0) list.splice(i, 1);
    store.commit();
  }

  // ------------------------------------------------------------------ guias (por página)
  /** Lista de guias da página atual (cria se não existir, para páginas de projetos antigos). */
  const guides = () => (store.page().guides ||= []);
  /** Cria uma guia de régua. axis 'x' = linha vertical na posição x; 'y' = linha horizontal na posição y. */
  function addGuide(axis, pos) {
    store.update((page) => { (page.guides ||= []).push({ axis, pos: Math.round(pos) }); }, { commit: true });
  }
  /** Remove a guia de índice `i`. */
  function removeGuide(i) {
    store.update(() => { guides().splice(i, 1); }, { commit: true });
  }

  // ------------------------------------------------------------------ vetores
  /**
   * Cria uma camada-vetor a partir de pontos em coordenadas do MUNDO (o que a caneta coleta).
   * Calcula a caixa que envolve o desenho (incluindo as curvas) e converte os pontos para o espaço local do vetor.
   * @param {{x,y,hin?,hout?}[]} pts  pontos com alças opcionais
   * @param {boolean} closed  caminho fechado (ganha preenchimento cinza)
   * @param {object|null} parent  frame onde inserir (null = raiz)
   */
  function addPathFromWorld(pts, closed, parent) {
    const po = parent ? canvas.originOf(parent.id) : { x: 0, y: 0 };
    const box = pathBounds(pts);
    const w = Math.max(1, Math.round(box.x1 - box.x0)), h = Math.max(1, Math.round(box.y1 - box.y0));
    const loc = (p) => (p ? { x: round(p.x - box.x0), y: round(p.y - box.y0) } : null);
    const node = createNode('path', {
      name: nextName(store.page(), 'path'),
      x: Math.round(box.x0 - po.x), y: Math.round(box.y0 - po.y), w, h, vw: w, vh: h, closed,
      points: pts.map((p) => ({ ...loc(p), hin: loc(p.hin), hout: loc(p.hout), ...(p.mode ? { mode: p.mode } : {}) })),
    });
    if (closed) node.fill = { ...defaultFill('#D9D9D9') };
    store.update((page) => (parent ? parent.children : page.children).push(node));
    store.setSelection([node.id]);
    store.commit();
    return node;
  }

  /**
   * Atualiza um vetor EXISTENTE com novos pontos (em coordenadas do mundo): usado ao CONTINUAR um caminho aberto com a
   * caneta. Como addPathFromWorld, recalcula a caixa; nome, cor e contorno do vetor continuam.
   */
  function updatePathFromWorld(id, pts, closed) {
    const node = store.get(id);
    if (!node) return;
    const parent = store.parentOf(id);
    const po = parent ? canvas.originOf(parent.id) : { x: 0, y: 0 };
    const box = pathBounds(pts);
    const w = Math.max(1, Math.round(box.x1 - box.x0)), h = Math.max(1, Math.round(box.y1 - box.y0));
    const loc = (p) => (p ? { x: round(p.x - box.x0), y: round(p.y - box.y0) } : null);
    store.update(() => {
      Object.assign(node, {
        x: round(box.x0 - po.x), y: round(box.y0 - po.y), w, h, vw: w, vh: h, closed,
        points: pts.map((p) => ({ ...loc(p), hin: loc(p.hin), hout: loc(p.hout), ...(p.mode ? { mode: p.mode } : {}) })),
      });
      if (closed && node.fill.type === 'none') node.fill = { ...defaultFill('#D9D9D9') };
    });
    store.setSelection([id]);
    store.commit();
  }

  /**
   * Cria um frame de ÍCONE (24×24 por padrão, fundo branco, cortando o que sai) no centro da vista, com a grade de 1px
   * ligada, enquadra com zoom grande, liga o encaixe de 1px e deixa a caneta pronta. É o começo de "desenhar o meu SVG".
   */
  function newIcon(size = 24) {
    const r = canvas.vpRect();
    const c = canvas.toWorld(r.left + r.width / 2, r.top + r.height / 2);
    const node = createNode('frame', {
      name: `Ícone ${size}`, x: Math.round(c.x - size / 2), y: Math.round(c.y - size / 2), w: size, h: size, clip: true,
      fill: defaultFill('#FFFFFF'), // fundo branco: o traço padrão é escuro e sumiria no canvas escuro. Para exportar sem fundo: Preenchimento → Nenhum
    });
    node.grids = [{ type: 'grid', size: 1, count: 12, gutter: 16, margin: 24, color: '#7C5CFF', opacity: 0.16 }];
    store.update((page) => { page.children.push(node); });
    store.setSelection([node.id]);
    store.commit();
    // enquadra pela geometria conhecida (o elemento ainda nem foi desenhado no DOM, então canvas.fit não serve aqui)
    const vw = r.width || innerWidth - 560, vh = r.height || innerHeight - 100; // painel escondido mede 0: usa a janela
    const z = Math.max(1, Math.min(32, (vw - 280) / size, (vh - 280) / size));
    canvas.setView({ zoom: z, x: vw / 2 - (node.x + size / 2) * z, y: vh / 2 - (node.y + size / 2) * z });
    store.ui.penSnap = 1;
    store.setTool('pen');
    return node;
  }

  /**
   * Reajusta a caixa do vetor depois de editar pontos: recalcula o retângulo que envolve o desenho e desloca os
   * pontos/posição para a caixa "colar" no desenho. Pula se o vetor está girado (a conta ficaria imprecisa).
   */
  function normalizePath(node) {
    if (node.rotation || !node.points.length) return;
    const sx = node.w / (node.vw || 1), sy = node.h / (node.vh || 1);
    // limites de TODOS os contornos (vetores importados de SVG podem ter vários: ver css.js → nodePathData)
    const boxes = [pathBounds(node.points, node.closed), ...(node.contours || []).map((c) => pathBounds(c.points, c.closed))];
    const box = { x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)), x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)) };
    const nw = Math.max(1, (box.x1 - box.x0) * sx), nh = Math.max(1, (box.y1 - box.y0) * sy);
    const shiftX = box.x0, shiftY = box.y0;
    const sh = (p) => (p ? { x: round(p.x - shiftX), y: round(p.y - shiftY) } : null);
    const shiftAll = (pts) => pts.map((p) => ({ x: round(p.x - shiftX), y: round(p.y - shiftY), hin: sh(p.hin), hout: sh(p.hout), ...(p.mode ? { mode: p.mode } : {}) }));
    node.points = shiftAll(node.points);
    if (node.contours) node.contours = node.contours.map((c) => ({ ...c, points: shiftAll(c.points) }));
    node.x = round(node.x + shiftX * sx);
    node.y = round(node.y + shiftY * sy);
    node.vw = round(box.x1 - box.x0) || 1;
    node.vh = round(box.y1 - box.y0) || 1;
    node.w = round(nw);
    node.h = round(nh);
  }

  /**
   * Cria um polígono regular (`sides` lados) ou estrela (pontas alternando raio 100% e 45%) já como vetor editável.
   * @param {'polygon'|'star'} kind
   * @param {{x,y,w,h}} box  caixa em coordenadas do mundo
   */
  function addShapePath(kind, box, parent, sides = 5) {
    const { x, y, w, h } = box;
    const cx = x + w / 2, cy = y + h / 2;
    const pts = [];
    const n = kind === 'star' ? sides * 2 : sides;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const r = kind === 'star' && i % 2 ? 0.45 : 1;
      pts.push({ x: cx + (Math.cos(a) * w * r) / 2, y: cy + (Math.sin(a) * h * r) / 2, hin: null, hout: null });
    }
    const node = addPathFromWorld(pts, true, parent);
    store.update(() => { node.name = nextName(store.page(), 'path').replace('Vetor', kind === 'star' ? 'Estrela' : 'Polígono'); }, { commit: true });
    return node;
  }

  // ------------------------------------------------------------------ booleanas
  /** Tipos que entram numa operação booleana. */
  const BOOL_TYPES = ['path', 'rect', 'ellipse', 'frame'];
  const BOOL_NAMES = { union: 'União', subtract: 'Subtração', intersect: 'Interseção', exclude: 'Exclusão' };

  /**
   * Contornos de uma camada em coordenadas do MUNDO (rotação e espelhamento aplicados), ainda com curvas.
   * Retângulo/frame (com cantos arredondados), elipse e vetor (com todos os contornos). Devolve { contours, rule }.
   */
  function worldContours(n) {
    const b = canvas.worldBox(n.id);
    if (!b) return null;
    const { w, h } = b;
    let local, rule = 'nonzero';
    if (n.type === 'ellipse') local = [ellipseContour(w, h)];
    else if (n.type === 'path') {
      const sx = w / (n.vw || 1), sy = h / (n.vh || 1);
      const S = (p) => p && { x: p.x * sx, y: p.y * sy };
      const conv = (pts) => pts.map((p) => ({ ...S(p), hin: S(p.hin), hout: S(p.hout) }));
      local = [conv(n.points), ...(n.contours || []).map((c) => conv(c.points))];
      rule = n.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
    } else local = [rectContour(w, h, n.radius)];
    const rad = ((b.rot || 0) * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const T = (p) => {
      if (!p) return null;
      const lx = (n.flipX ? w - p.x : p.x) - w / 2, ly = (n.flipY ? h - p.y : p.y) - h / 2;
      return { x: b.cx + lx * cos - ly * sin, y: b.cy + lx * sin + ly * cos };
    };
    return { rule, contours: local.map((pts) => pts.map((p) => ({ ...T(p), hin: T(p.hin), hout: T(p.hout) }))) };
  }

  /**
   * OPERAÇÃO BOOLEANA com a seleção (2+ vetores/retângulos/elipses/frames): 'union' unir, 'subtract' subtrair (a camada
   * de BAIXO menos as de cima, como no Figma), 'intersect' interseção, 'exclude' excluir a sobreposição.
   * As curvas são achatadas em polígonos (geom.js) e o resultado é reajustado em curvas onde era curvo: o vetor final
   * pode ter alguns pontos a mais que o original. O resultado fica no lugar da camada de baixo, com o estilo dela.
   * @returns {{node?: object, error?: string}}
   */
  function booleanOp(op) {
    if (!BOOL_NAMES[op]) return { error: 'Operação desconhecida.' };
    const sel = topSelection().filter((n) => n.type !== 'section');
    if (sel.length < 2) return { error: 'Selecione duas ou mais formas para combinar.' };
    const bad = sel.find((n) => !BOOL_TYPES.includes(n.type) || (n.type === 'frame' && n.children?.length));
    if (bad) return { error: `“${bad.name}” não pode entrar na operação: use vetores, retângulos, elipses ou frames vazios.` };
    // ordem de empilhamento: a de baixo primeiro (mesmo pai: pela posição na lista; senão, pela ordem da seleção)
    const order = (n) => { const l = store.listOf(n.id); return l ? l.indexOf(n) : 0; };
    const sameParent = sel.every((n) => store.parentOf(n.id) === store.parentOf(sel[0].id));
    const nodes = sameParent ? [...sel].sort((a, b) => order(a) - order(b)) : sel;
    const z = canvas.getView().zoom || 1;
    const tol = Math.max(0.05, 0.25 / z);
    const shapes = [];
    for (const n of nodes) {
      const wc = worldContours(n);
      if (!wc) return { error: 'Não consegui medir as formas (estão visíveis?).' };
      const closedOf = (i) => (n.type !== 'path' ? true : i === 0 ? true : n.contours[i - 1].closed !== false);
      shapes.push({ rule: wc.rule, rings: wc.contours.map((pts, i) => flattenContour(pts, closedOf(i), tol)) });
    }
    const rings = booleanPolygons(shapes, op);
    if (!rings.length) return { error: 'O resultado ficou vazio: as formas não se sobrepõem.' };
    const contours = polygonsToContours(rings, { tol: tol * 0.6, smooth: true });
    // caixa do desenho e conversão para o espaço do vetor novo
    const boxes = contours.map((c) => pathBounds(c.points, true));
    const box = { x0: Math.min(...boxes.map((q) => q.x0)), y0: Math.min(...boxes.map((q) => q.y0)), x1: Math.max(...boxes.map((q) => q.x1)), y1: Math.max(...boxes.map((q) => q.y1)) };
    const loc = (p) => (p ? { x: round(p.x - box.x0), y: round(p.y - box.y0) } : null);
    const conv = (c) => ({ closed: true, points: c.points.map((p) => ({ ...loc(p), hin: loc(p.hin), hout: loc(p.hout), ...(p.mode ? { mode: p.mode } : {}) })) });
    const [main, ...rest] = contours.map(conv);
    const base = nodes[0];
    const parent = store.parentOf(base.id);
    const po = parent ? canvas.originOf(parent.id) : { x: 0, y: 0 };
    const w = Math.max(1, round(box.x1 - box.x0)), h = Math.max(1, round(box.y1 - box.y0));
    const node = createNode('path', {
      name: nextName(store.page(), 'path').replace('Vetor', BOOL_NAMES[op]),
      x: round(box.x0 - po.x), y: round(box.y0 - po.y), w, h, vw: w, vh: h, closed: true,
      points: main.points, fillRule: 'nonzero',
    });
    if (rest.length) node.contours = rest;
    // estilo da camada de baixo (preenchimento, contorno, sombras, opacidade)
    node.fill = JSON.parse(JSON.stringify(base.fill || defaultFill('#D9D9D9')));
    if (node.fill.type === 'none') node.fill = defaultFill('#D9D9D9');
    node.stroke = base.stroke ? JSON.parse(JSON.stringify(base.stroke)) : null;
    if (node.stroke && base.type !== 'path') node.stroke.align = base.stroke.position || 'inside';
    if (base.shadows) node.shadows = JSON.parse(JSON.stringify(base.shadows));
    if (base.opacity != null) node.opacity = base.opacity;
    if (hasLayout(parent) && !base.absolute) node.absolute = true; // a forma final continua onde estava
    store.update(() => {
      const list = store.listOf(base.id);
      const at = list.indexOf(base);
      for (const n of nodes) { const l = store.listOf(n.id); const i = l?.indexOf(n); if (i >= 0) l.splice(i, 1); }
      list.splice(Math.min(at, list.length), 0, node);
    });
    store.setSelection([node.id]);
    store.commit();
    return { node };
  }

  /** Caixa da camada relativa ao PAI, medida no DOM (respeita flexbox/grid). Usada pela exportação SVG. */
  function localBox(node) {
    const parent = store.parentOf(node.id);
    const o = canvas.originOf(node.id);
    const po = parent ? canvas.originOf(parent.id) : { x: 0, y: 0 };
    const el = canvas.els.get(node.id);
    return { x: o.x - po.x, y: o.y - po.y, w: el ? el.offsetWidth : node.w, h: el ? el.offsetHeight : node.h };
  }

  /** Ctrl+Alt+G: envolve a seleção num frame novo, sem layout. */
  function frameSelection() {
    const nodes = topSelection().filter((n) => n.type !== 'section');
    if (!nodes.length) return;
    let frame;
    store.update(() => { frame = wrapInFrame(sameLevel(nodes), nodes.length === 1 ? `Frame ${nodes[0].name}` : 'Frame'); });
    store.setSelection([frame.id]);
    store.commit();
  }

  // ------------------------------------------------------------------ código
  /** CSS (só o CSS, sem HTML) das camadas dadas — usado por "Copiar CSS". */
  function cssOf(nodes) {
    const doc = store.state.doc;
    return joinCss(nodes.map((n) => generateCode([n], store.parentOf(n.id), doc.assets, { styles: doc.styles })));
  }

  // API pública dos comandos
  const api = {
    insertSvg, placeNew, booleanOp,
    topSelection, deleteSelection, duplicate, copy, cut, paste, group, ungroup, reorder,
    setSelectionBox, copyStyle, pasteStyle, toggleAutoLayout, setLayoutMode, align, distribute, reparent, addImageFiles, importAsset, addText, addHtmlEmbed, cssOf,
    localBox, frameSelection, createComponent, insertInstance, detach, goToMain, toggleMask, flip, addColorStyle, addColorStyles, addTextStyle,
    addColorMode, renameColorMode, setModeScheme, deleteColorMode, addSizeVar, setSizeVar, deleteSizeVar, bindSizeVar, removeStyle,
    addGuide, removeGuide, addPathFromWorld, updatePathFromWorld, newIcon, normalizePath, addShapePath, syncInstances,
    notify: null, // função de aviso (toast); main.js liga
    insertImageAsset,
  };
  return api;
}

/**
 * Lê um arquivo de imagem e devolve { dataUrl, w, h }. Imagens grandes (>1600px ou >400KB) são redesenhadas num
 * <canvas> menor: o projeto inteiro é regravado a cada mudança (navegador e pasta), então imagem enorme deixaria
 * o salvamento lento e o .json gigante.
 * PNG continua PNG (preserva transparência); o resto vira JPEG 88%.
 */
function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const max = 1600;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        if (k === 1 && file.size < 400_000) {
          resolve({ dataUrl: reader.result, w: img.width, h: img.height });
          return;
        }
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve({ dataUrl: c.toDataURL(type, 0.88), w: c.width, h: c.height });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Retângulo { x0, y0, x1, y1 } que envolve TODOS os pontos e também as curvas de Bézier (amostradas a cada 5%),
 * já que uma curva pode "sair" para fora dos pontos de ancoragem.
 * @param {{x,y,hin?,hout?}[]} pts
 * @param {boolean} [closed]  considera o segmento de volta ao primeiro ponto
 */
export function pathBounds(pts, closed = false) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  const cubic = (a, b, c, d, t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
  const n = pts.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < n; i++) add(pts[i].x, pts[i].y);
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    if (!a.hout && !b.hin) continue;
    const c1 = a.hout || a, c2 = b.hin || b;
    for (let t = 0.05; t < 1; t += 0.05) add(cubic(a.x, c1.x, c2.x, b.x, t), cubic(a.y, c1.y, c2.y, b.y, t));
  }
  return { x0, y0, x1, y1 };
}
