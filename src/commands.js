// Comandos de edição: tudo que muda a árvore de camadas (agrupar, duplicar, auto layout, alinhar...).
import { cloneNode, createNode, defaultFill, defaultLayout, hasLayout, nextName, resizeNode, round, uid } from './model.js';
import { generateCode } from './css.js';
import { createInstance, detachInstance, makeComponent, syncInstances, textStyleFrom } from './components.js';

export function createCommands(store, canvas) {
  const ui = store.ui;

  /** Selecionados que não têm um ancestral também selecionado. */
  const topSelection = () => {
    const ids = new Set(ui.selection);
    return store.selected().filter((n) => {
      for (let p = store.parentOf(n.id); p; p = store.parentOf(p.id)) if (ids.has(p.id)) return false;
      return true;
    });
  };

  const parentOrigin = (parent) => (parent ? canvas.originOf(parent.id) : { x: 0, y: 0 });

  /** Congela a posição visual de nós em fluxo flex como x/y absolutos (antes de sair do auto layout). */
  function freezePositions(nodes, parent) {
    const po = parentOrigin(parent);
    for (const n of nodes) {
      const o = canvas.originOf(n.id);
      n.x = round(o.x - po.x);
      n.y = round(o.y - po.y);
    }
  }

  // ------------------------------------------------------------------ básicos
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

  function cut() {
    if (copy()) deleteSelection();
  }

  function paste() {
    const clip = ui.clipboard;
    if (!clip) return;
    clip.count++;
    // com UM frame selecionado (que não é o próprio copiado), cola dentro dele
    const sel = store.selected();
    const into = sel.length === 1 && sel[0].type === 'frame' && !clip.nodes.some((c) => c.id === sel[0].id) ? sel[0] : null;
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
  /** Move/redimensiona o conjunto selecionado pela caixa envolvente (coordenadas de mundo). */
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
  const STYLE_KEYS = ['fill', 'stroke', 'radius', 'shadows', 'blur', 'bgBlur', 'opacity', 'blend'];
  const TEXT_KEYS = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textAlign', 'textDecoration', 'textTransform', 'textStyleId'];

  function copyStyle() {
    const n = store.selected()[0];
    if (!n) return false;
    const keys = n.type === 'text' ? [...STYLE_KEYS, ...TEXT_KEYS] : STYLE_KEYS;
    ui.styleClipboard = { type: n.type, props: JSON.parse(JSON.stringify(Object.fromEntries(keys.filter((k) => n[k] !== undefined).map((k) => [k, n[k]])))) };
    return true;
  }

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
          n[k] = JSON.parse(JSON.stringify(v));
        }
      }
    }, { commit: true });
    return true;
  }

  // ------------------------------------------------------------------ agrupar
  function group() {
    const nodes = topSelection();
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

  /** Desagrupa grupos e também frames (os filhos sobem um nível mantendo a posição visual). */
  function ungroup() {
    const groups = store.selected().filter((n) => n.type === 'group' || (n.type === 'frame' && !n.component && !n.instanceOf));
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
  /** Deduz direção, gap e padding a partir das posições atuais dos filhos. */
  function enableAutoLayout(frame) {
    const kids = frame.children.filter((c) => c.visible);
    const layout = { ...defaultLayout(), mode: 'row', gap: 8 };
    if (kids.length) {
      const xs = kids.map((k) => k.x), ys = kids.map((k) => k.y);
      const spreadX = Math.max(...xs) - Math.min(...xs);
      const spreadY = Math.max(...ys) - Math.min(...ys);
      layout.mode = spreadX >= spreadY ? 'row' : 'column';
      const key = layout.mode === 'row' ? 'x' : 'y';
      const size = layout.mode === 'row' ? 'w' : 'h';
      frame.children.sort((a, b) => a[key] - b[key]);
      const sorted = kids.sort((a, b) => a[key] - b[key]);
      let gaps = 0;
      for (let i = 1; i < sorted.length; i++) gaps += Math.max(0, sorted[i][key] - (sorted[i - 1][key] + sorted[i - 1][size]));
      layout.gap = sorted.length > 1 ? Math.round(gaps / (sorted.length - 1)) : 8;
      const minX = Math.min(...kids.map((k) => k.x)), minY = Math.min(...kids.map((k) => k.y));
      const maxX = Math.max(...kids.map((k) => k.x + k.w)), maxY = Math.max(...kids.map((k) => k.y + k.h));
      layout.padding = [
        Math.max(0, Math.round(minY)),
        Math.max(0, Math.round(frame.w - maxX)),
        Math.max(0, Math.round(frame.h - maxY)),
        Math.max(0, Math.round(minX)),
      ];
    }
    frame.layout = layout;
    frame.children.forEach((c) => { c.absolute = false; });
  }

  function disableAutoLayout(frame) {
    freezePositions(frame.children, frame);
    frame.layout.mode = 'none';
  }

  /** Define o modo (none | row | column) preservando a posição visual dos filhos ao ligar/desligar. */
  function setLayoutMode(frames, mode) {
    for (const f of frames) {
      if (f.type !== 'frame' || f.layout.mode === mode) continue;
      if (mode === 'none') disableAutoLayout(f);
      else {
        const wasNone = f.layout.mode === 'none';
        if (wasNone) enableAutoLayout(f);
        f.layout.mode = mode;
        if (mode === 'grid' && wasNone) f.layout.cols = Math.max(2, Math.min(4, Math.round(Math.sqrt(f.children.length)) + 1));
      }
    }
  }

  /** Shift+A: liga/desliga auto layout num frame, ou envolve a seleção em um frame com auto layout. */
  function toggleAutoLayout() {
    const nodes = topSelection();
    if (!nodes.length) return;
    if (nodes.length === 1 && nodes[0].type === 'frame') {
      const f = nodes[0];
      store.update(() => (hasLayout(f) ? disableAutoLayout(f) : enableAutoLayout(f)));
      store.commit();
      return;
    }
    const parent = store.parentOf(nodes[0].id);
    const list = store.listOf(nodes[0].id);
    const same = nodes.filter((n) => store.listOf(n.id) === list).sort((a, b) => list.indexOf(a) - list.indexOf(b));
    freezePositions(same, parent);
    const x0 = Math.min(...same.map((n) => n.x)), y0 = Math.min(...same.map((n) => n.y));
    const x1 = Math.max(...same.map((n) => n.x + n.w)), y1 = Math.max(...same.map((n) => n.y + n.h));
    const frame = createNode('frame', {
      name: 'Auto layout', x: x0, y: y0, w: x1 - x0, h: y1 - y0, clip: false,
      fill: { ...defaultFill('#FFFFFF'), type: 'none' },
    });
    store.update(() => {
      const at = list.indexOf(same[same.length - 1]);
      same.forEach((n) => list.splice(list.indexOf(n), 1));
      same.forEach((n) => { n.x -= x0; n.y -= y0; n.absolute = false; });
      frame.children = same;
      enableAutoLayout(frame);
      list.splice(at - same.length + 1, 0, frame);
    });
    store.setSelection([frame.id]);
    store.commit();
  }

  // ------------------------------------------------------------------ alinhar / distribuir
  function shift(node, dx, dy) {
    node.x = round(node.x + dx);
    node.y = round(node.y + dy);
  }

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
  /** Move nós para outro pai (ou raiz) mantendo a posição visual. index = posição na lista do novo pai. */
  function reparent(nodes, newParent, index = null) {
    const moves = nodes.filter((n) => n !== newParent && !(newParent && store.isAncestor(n.id, newParent.id)));
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
  /** Lê o arquivo, reduz se for grande e guarda em doc.assets. */
  async function importAsset(file) {
    const { dataUrl, w, h } = await readImage(file);
    const assetId = uid();
    store.addAsset(assetId, dataUrl);
    return { assetId, w, h };
  }

  async function addImageFiles(files, at) {
    const created = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const { assetId, w, h } = await importAsset(file);
      const scale = Math.min(1, 520 / Math.max(w, h));
      const node = createNode('rect', {
        name: file.name?.replace(/\.[^.]+$/, '') || 'Imagem',
        w: Math.round(w * scale), h: Math.round(h * scale),
        fill: { ...defaultFill(), type: 'image', assetId, fit: 'cover' },
      });
      const r = canvas.vpRect();
      const p = at || canvas.toWorld(r.left + r.width / 2, r.top + r.height / 2);
      node.x = Math.round(p.x - node.w / 2 + created.length * 24);
      node.y = Math.round(p.y - node.h / 2 + created.length * 24);
      created.push(node);
    }
    if (!created.length) return false;
    store.update((page) => page.children.push(...created));
    store.setSelection(created.map((n) => n.id));
    store.commit();
    return true;
  }

  function addText(textValue, at) {
    const r = canvas.vpRect();
    const p = at || canvas.toWorld(r.left + r.width / 2, r.top + r.height / 2);
    const node = createNode('text', { name: textValue.slice(0, 24), text: textValue, x: Math.round(p.x), y: Math.round(p.y) });
    store.update((page) => page.children.push(node));
    store.setSelection([node.id]);
    store.commit();
  }


  // ------------------------------------------------------------------ componentes
  /** Envolve nós irmãos num frame (sem layout) do tamanho do conjunto. */
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

  function sameLevel(nodes) {
    const list = store.listOf(nodes[0].id);
    return nodes.filter((n) => store.listOf(n.id) === list).sort((a, b) => list.indexOf(a) - list.indexOf(b));
  }

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

  /** Cria uma instância do componente `mainId` ao lado do principal (ou no centro da vista). */
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

  function detach() {
    const insts = store.selected().filter((n) => n.instanceOf);
    if (!insts.length) return;
    store.update(() => insts.forEach(detachInstance), { commit: true });
  }

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
  /** Usa a camada de baixo como máscara do grupo (clip-path). Com uma camada dentro de grupo: liga/desliga. */
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

  function flip(axis) {
    const nodes = topSelection();
    if (!nodes.length) return;
    const key = axis === 'x' ? 'flipX' : 'flipY';
    store.update(() => nodes.forEach((n) => { n[key] = !n[key]; }), { commit: true });
  }

  // ------------------------------------------------------------------ estilos compartilhados
  function addColorStyle(node, name) {
    const st = { id: uid(), name: name || `Cor ${store.state.doc.styles.colors.length + 1}`, color: node.fill.color, opacity: node.fill.opacity };
    store.state.doc.styles.colors.push(st);
    node.fill.styleId = st.id;
    store.commit();
    return st;
  }
  function addTextStyle(node, name) {
    const st = { id: uid(), name: name || `Texto ${store.state.doc.styles.texts.length + 1}`, ...textStyleFrom(node) };
    store.state.doc.styles.texts.push(st);
    node.textStyleId = st.id;
    store.commit();
    return st;
  }
  function removeStyle(kind, id) {
    const list = store.state.doc.styles[kind];
    const i = list.findIndex((s) => s.id === id);
    if (i >= 0) list.splice(i, 1);
    store.commit();
  }

  // ------------------------------------------------------------------ guias (por página)
  const guides = () => (store.page().guides ||= []);
  function addGuide(axis, pos) {
    store.update((page) => { (page.guides ||= []).push({ axis, pos: Math.round(pos) }); }, { commit: true });
  }
  function removeGuide(i) {
    store.update(() => { guides().splice(i, 1); }, { commit: true });
  }

  // ------------------------------------------------------------------ vetores
  /** Cria um nó `path` a partir de pontos em coordenadas de mundo. Retorna o nó (já inserido). */
  function addPathFromWorld(pts, closed, parent) {
    const po = parent ? canvas.originOf(parent.id) : { x: 0, y: 0 };
    const box = pathBounds(pts);
    const w = Math.max(1, Math.round(box.x1 - box.x0)), h = Math.max(1, Math.round(box.y1 - box.y0));
    const loc = (p) => (p ? { x: round(p.x - box.x0), y: round(p.y - box.y0) } : null);
    const node = createNode('path', {
      name: nextName(store.page(), 'path'),
      x: Math.round(box.x0 - po.x), y: Math.round(box.y0 - po.y), w, h, vw: w, vh: h, closed,
      points: pts.map((p) => ({ ...loc(p), hin: loc(p.hin), hout: loc(p.hout) })),
    });
    if (closed) node.fill = { ...defaultFill('#D9D9D9') };
    store.update((page) => (parent ? parent.children : page.children).push(node));
    store.setSelection([node.id]);
    store.commit();
    return node;
  }

  /** Recalcula a caixa do caminho depois de editar pontos (só sem rotação). */
  function normalizePath(node) {
    if (node.rotation || !node.points.length) return;
    const sx = node.w / (node.vw || 1), sy = node.h / (node.vh || 1);
    const box = pathBounds(node.points);
    const nw = Math.max(1, (box.x1 - box.x0) * sx), nh = Math.max(1, (box.y1 - box.y0) * sy);
    const shiftX = box.x0, shiftY = box.y0;
    const sh = (p) => (p ? { x: round(p.x - shiftX), y: round(p.y - shiftY) } : null);
    node.points = node.points.map((p) => ({ x: round(p.x - shiftX), y: round(p.y - shiftY), hin: sh(p.hin), hout: sh(p.hout) }));
    node.x = round(node.x + shiftX * sx);
    node.y = round(node.y + shiftY * sy);
    node.vw = round(box.x1 - box.x0) || 1;
    node.vh = round(box.y1 - box.y0) || 1;
    node.w = round(nw);
    node.h = round(nh);
  }

  /** Polígono regular ou estrela como caminho editável. */
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

  /** Caixa do nó relativa ao pai, medida no DOM (respeita flexbox/grid). */
  function localBox(node) {
    const parent = store.parentOf(node.id);
    const o = canvas.originOf(node.id);
    const po = parent ? canvas.originOf(parent.id) : { x: 0, y: 0 };
    const el = canvas.els.get(node.id);
    return { x: o.x - po.x, y: o.y - po.y, w: el ? el.offsetWidth : node.w, h: el ? el.offsetHeight : node.h };
  }

  /** Ctrl+Alt+G: envolve a seleção num frame (sem layout). */
  function frameSelection() {
    const nodes = topSelection();
    if (!nodes.length) return;
    let frame;
    store.update(() => { frame = wrapInFrame(sameLevel(nodes), nodes.length === 1 ? `Frame ${nodes[0].name}` : 'Frame'); });
    store.setSelection([frame.id]);
    store.commit();
  }

  // ------------------------------------------------------------------ código
  function cssOf(nodes) {
    return nodes.map((n) => generateCode([n], store.parentOf(n.id), store.state.doc.assets).css).join('\n\n');
  }

  return {
    topSelection, deleteSelection, duplicate, copy, cut, paste, group, ungroup, reorder,
    setSelectionBox, copyStyle, pasteStyle, toggleAutoLayout, setLayoutMode, align, distribute, reparent, addImageFiles, importAsset, addText, cssOf,
    localBox, frameSelection, createComponent, insertInstance, detach, goToMain, toggleMask, flip, addColorStyle, addTextStyle, removeStyle,
    addGuide, removeGuide, addPathFromWorld, normalizePath, addShapePath, syncInstances,
  };
}

/** Lê uma imagem, reduzindo para no máximo 1600px (economiza espaço no localStorage). */
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

/** Caixa que envolve os pontos e as curvas (amostrando as Béziers). */
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
