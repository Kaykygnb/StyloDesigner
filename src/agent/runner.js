/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  agent/runner.js — EXECUTA AS FERRAMENTAS DO AGENTE NO EDITOR ABERTO
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Recebe "use a ferramenta X com estes argumentos" (do agente interno ou do MCP, ver agent/schema.js) e faz
 *  com o store e os comandos do editor, como se você tivesse clicado. Regras de segurança:
 *    - ferramentas de LEITURA rodam direto;
 *    - ferramentas que ALTERAM o projeto chamam `approve(...)` antes: a pessoa vê o que vai mudar e decide
 *      (Permitir / Permitir tudo nesta sessão / Recusar). Recusado = nada muda;
 *    - cada alteração aprovada termina com UM `store.commit()`: um Ctrl+Z desfaz a alteração inteira;
 *    - só as propriedades conhecidas são aceitas (veja PROPS): a IA não consegue gravar lixo no projeto.
 *  Erros viram mensagens em português devolvidas à IA (ela lê e corrige), nunca quebram o editor.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { createNode, defaultFill, defaultStroke, resizeNode, tagOf, TEXT_TAGS, BOX_TAGS, walk, uid } from '../model.js';
import { generateCode, joinCss } from '../css.js';
import { importSvg } from '../svgimport.js';
import { GOOGLE, SYSTEM_FONTS } from '../fonts.js';
import { iconUrl, iconExists, searchIcons } from '../ui/googleicons.js';
import { toolByName } from './schema.js';

/** Campos simples (número, texto ou booleano) que podem ser copiados direto para a camada. */
const SIMPLE = [
  'name', 'x', 'y', 'rotation', 'opacity', 'visible', 'locked', 'blend', 'note', 'sizeX', 'sizeY', 'minW', 'maxW', 'minH',
  'maxH', 'aspect', 'blur', 'bgBlur', 'clip', 'absolute', 'alignSelf', 'justifySelf', 'grow', 'colSpan', 'rowSpan', 'overflow',
  'href', 'alt', 'fluid',
  'text', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing', 'textAlign',
  'textDecoration', 'textTransform', 'textVAlign', 'truncate', 'lines',
];
/** Campos com tratamento próprio (ver applyProps). */
const SPECIAL = ['w', 'h', 'fill', 'stroke', 'radius', 'margin', 'shadows', 'layout', 'tag'];
/** Tudo que update_layer / create_layer aceitam. */
export const PROPS = [...SIMPLE, ...SPECIAL];
/** Valores válidos de alguns campos (o resto é conferido pelo tipo). */
const ENUMS = {
  sizeX: ['fixed', 'hug', 'fill'], sizeY: ['fixed', 'hug', 'fill'],
  textAlign: ['left', 'center', 'right', 'justify'], fontStyle: ['normal', 'italic'],
};
const LAYOUT_MODES = ['none', 'row', 'column', 'grid'];
const LAYOUT_KEYS = ['mode', 'gap', 'padding', 'justify', 'align', 'wrap', 'cols', 'rows', 'colGap', 'rowGap', 'colsTemplate', 'rowsTemplate'];

/** "#abc" / "#AABBCC" → "#AABBCC"; outra coisa → null. */
const hex = (v) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(v || '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return `#${h.toUpperCase()}`;
};
/** Número ou lista de 4 → lista de 4 (padding, margin, radius). */
const four = (v, what) => {
  if (typeof v === 'number') return [v, v, v, v];
  if (Array.isArray(v) && v.length === 4 && v.every((x) => typeof x === 'number')) return v.slice();
  if (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number')) return [v[0], v[1], v[0], v[1]];
  throw new Error(`${what}: use um número ou uma lista [topo, direita, baixo, esquerda].`);
};

/**
 * Aplica `props` numa camada (dentro de um store.update). Lança Error com mensagem clara se algo não vale.
 * @param {object} node
 * @param {object} props
 * @param {{ setLayoutMode: (node, mode) => void }} ctx  liga/desliga o layout com a mesma lógica do painel
 */
export function applyProps(node, props, ctx = {}) {
  if (!props || typeof props !== 'object' || Array.isArray(props)) throw new Error('props precisa ser um objeto, ex.: {"fill": "#FF0000"}.');
  const unknown = Object.keys(props).filter((k) => !PROPS.includes(k));
  if (unknown.length) throw new Error(`Propriedade desconhecida: ${unknown.join(', ')}. Aceitas: ${PROPS.join(', ')}.`);
  for (const [k, v] of Object.entries(props)) {
    if (!SIMPLE.includes(k)) continue;
    if (ENUMS[k] && !ENUMS[k].includes(v)) throw new Error(`${k} precisa ser um destes: ${ENUMS[k].join(', ')}.`);
    if (['text'].includes(k) && node.type !== 'text') throw new Error('text só vale para camadas de texto.');
    node[k] = v;
  }
  if ('w' in props || 'h' in props) {
    const w = 'w' in props ? Number(props.w) : node.w, h = 'h' in props ? Number(props.h) : node.h;
    if (!(w > 0) || !(h > 0)) throw new Error('w e h precisam ser números maiores que zero.');
    if ('w' in props) resizeNode(node, w, node.h, 'w');
    if ('h' in props) resizeNode(node, node.w, h, 'h');
  }
  if ('fill' in props) {
    const f = props.fill;
    if (f === 'none' || f === null) node.fill = { ...(node.fill || defaultFill()), type: 'none' };
    else if (typeof f === 'string') {
      const c = hex(f);
      if (!c) throw new Error('fill: use uma cor "#RRGGBB", "none" ou um objeto de preenchimento.');
      node.fill = { ...(node.fill || defaultFill()), type: 'solid', color: c, opacity: node.fill?.opacity ?? 1 };
      delete node.fill.styleId; // cor escolhida à mão desliga o estilo de cor
    } else if (typeof f === 'object' && f.styleId) {
      // ligar a um ESTILO de cor do projeto (vira var(--cor-...) no CSS): a cor vem do estilo
      const st = ctx.colorStyle?.(f.styleId);
      if (!st) throw new Error(`Estilo de cor "${f.styleId}" não existe. Veja colorStyles em get_document ou crie com create_color_styles.`);
      node.fill = { ...(node.fill || defaultFill()), type: 'solid', color: st.color, opacity: st.opacity ?? 1, styleId: f.styleId };
    } else if (typeof f === 'object') {
      const next = { ...(node.fill || defaultFill()), ...f };
      if (f.color) next.color = hex(f.color) || next.color;
      node.fill = next;
    }
  }
  if ('stroke' in props) {
    const s = props.stroke;
    if (s === null || s === 'none') node.stroke = null;
    else if (typeof s === 'string') {
      const c = hex(s);
      if (!c) throw new Error('stroke: use uma cor "#RRGGBB", null ou um objeto {color, width, style, position}.');
      node.stroke = { ...(node.stroke || defaultStroke()), color: c };
    } else if (typeof s === 'object') node.stroke = { ...(node.stroke || defaultStroke()), ...s, ...(s.color ? { color: hex(s.color) || s.color } : {}) };
  }
  if ('radius' in props) node.radius = four(props.radius, 'radius').map((x) => Math.max(0, x));
  if ('margin' in props) node.margin = four(props.margin, 'margin');
  if ('shadows' in props) {
    if (!Array.isArray(props.shadows)) throw new Error('shadows precisa ser uma lista de sombras.');
    node.shadows = props.shadows.map((s) => ({ x: 0, y: 4, blur: 16, spread: 0, color: '#000000', opacity: 0.25, inset: false, ...s, color: hex(s.color) || '#000000' }));
  }
  if ('layout' in props) {
    if (node.type !== 'frame') throw new Error('layout só vale para frames (o que vira flex/grid). Para uma forma, crie um frame.');
    const L = props.layout || {};
    const bad = Object.keys(L).filter((k) => !LAYOUT_KEYS.includes(k));
    if (bad.length) throw new Error(`layout: chave desconhecida ${bad.join(', ')}. Aceitas: ${LAYOUT_KEYS.join(', ')}.`);
    if ('mode' in L) {
      if (!LAYOUT_MODES.includes(L.mode)) throw new Error(`layout.mode precisa ser um destes: ${LAYOUT_MODES.join(', ')}.`);
      if (L.mode !== node.layout.mode) ctx.setLayoutMode ? ctx.setLayoutMode(node, L.mode) : (node.layout.mode = L.mode);
    }
    for (const [k, v] of Object.entries(L)) {
      if (k === 'mode') continue;
      node.layout[k] = k === 'padding' ? four(v, 'layout.padding') : v;
    }
  }
  if ('tag' in props) {
    const list = node.type === 'text' ? TEXT_TAGS : BOX_TAGS;
    if (props.tag !== null && !list.includes(props.tag)) throw new Error(`tag para ${node.type === 'text' ? 'texto' : 'esta camada'}: ${list.join(', ')}.`);
    delete node.tag;
    if (props.tag && props.tag !== tagOf(node)) node.tag = props.tag;
  }
}

/** Resumo curto de uma camada (o que a IA precisa para se orientar, sem o peso de todos os campos). */
export function summarize(n, depth = 0) {
  const out = { id: n.id, name: n.name, type: n.type, tag: tagOf(n), w: Math.round(n.w), h: Math.round(n.h) };
  if (n.x || n.y) Object.assign(out, { x: Math.round(n.x), y: Math.round(n.y) });
  if (n.sizeX !== 'fixed' || n.sizeY !== 'fixed') out.size = `${n.sizeX}/${n.sizeY}`;
  if (n.layout && n.layout.mode !== 'none') {
    const L = n.layout;
    out.layout = L.mode === 'grid'
      ? { mode: 'grid', cols: L.cols, colGap: L.colGap, rowGap: L.rowGap, padding: L.padding }
      : { mode: L.mode, gap: L.gap, padding: L.padding, justify: L.justify, align: L.align, ...(L.wrap ? { wrap: true } : {}) };
  }
  if (n.fill && n.fill.type !== 'none') out.fill = n.fill.type === 'solid' ? n.fill.color : n.fill.type;
  if (n.type === 'text') out.text = n.text.length > 80 ? `${n.text.slice(0, 80)}…` : n.text;
  if (!n.visible) out.visible = false;
  if (n.absolute) out.absolute = true;
  if (n.component) out.component = true;
  if (n.instanceOf) out.instanceOf = n.instanceOf;
  if (n.children?.length) {
    if (depth > 0) out.children = n.children.map((c) => summarize(c, depth - 1));
    else out.childCount = n.children.length;
  }
  return out;
}

/** Descrição em português de uma alteração, para a janela de permissão. */
export function describeCall(tool, args, store) {
  const nm = (id) => { const n = id && store.get(id); return n ? `“${n.name}”` : `(camada ${id})`; };
  switch (tool) {
    case 'update_layer': {
      const keys = Object.entries(args.props || {}).map(([k, v]) => (k === 'layout' && v && typeof v === 'object' ? Object.keys(v).map((x) => `layout.${x}`).join(', ') : k));
      return `Alterar ${nm(args.id)}: ${keys.join(', ') || '(nada)'}`;
    }
    case 'create_layer': return `Criar ${args.type === 'text' ? 'um texto' : `um ${args.type}`}${args.props?.name ? ` “${args.props.name}”` : ''}${args.parent_id ? ` dentro de ${nm(args.parent_id)}` : ' na página'}`;
    case 'delete_layers': return `Apagar ${(args.ids || []).map(nm).join(', ')}`;
    case 'move_layer': return `Mover ${nm(args.id)}${args.parent_id ? ` para ${args.parent_id === 'root' ? 'a raiz da página' : `dentro de ${nm(args.parent_id)}`}` : ''}${Number.isInteger(args.index) ? ` (posição ${args.index})` : ''}`;
    case 'undo': return 'Desfazer a última alteração (Ctrl+Z)';
    case 'build_layout': {
      let count = 0;
      const walkSpec = (s) => { if (s && typeof s === 'object') { count++; (s.children || []).forEach(walkSpec); } };
      walkSpec(args.tree);
      return `Montar “${args.tree?.props?.name || args.tree?.type || 'estrutura'}” (${count} camada${count === 1 ? '' : 's'})${args.parent_id ? ` dentro de ${nm(args.parent_id)}` : ' como tela nova na página'}`;
    }
    case 'insert_icon': return `Inserir o ícone “${args.name}”${args.parent_id ? ` dentro de ${nm(args.parent_id)}` : ' na página'}`;
    case 'create_color_styles': return `Criar ${(args.colors || []).length} estilo(s) de cor: ${(args.colors || []).map((c) => `${c.name} ${c.color}`).join(', ')}`;
    case 'create_page': return `Criar a página “${args.name}”`;
    default: return tool;
  }
}

/**
 * Cria o executor.
 * @param {object} deps
 * @param {object} deps.store
 * @param {object} deps.commands
 * @param {(req: {client: string, tool: string, args: object, summary: string}) => Promise<boolean>} deps.approve
 *        pergunta à pessoa (true = pode). Sem `approve`, alterações são recusadas.
 * @returns {{ run: (tool: string, args: object, client?: string) => Promise<object> }}
 */
export function createRunner({ store, commands, approve }) {
  /** Camada pelo id ou erro claro (a IA às vezes inventa ids: a mensagem manda ela procurar antes). */
  const need = (id) => {
    const n = id && store.get(id);
    if (!n) throw new Error(`Camada "${id}" não existe. Use get_document ou find_layers para achar o id certo.`);
    return n;
  };
  /** Liga/desliga o layout com a lógica do painel (deduz direção, gap e padding ao ligar). */
  const setLayoutMode = (node, mode) => commands.setLayoutMode([node], mode);

  const READ = {
    get_document({ depth = 3 } = {}) {
      const d = Math.max(0, Math.min(8, Number(depth) || 3));
      const doc = store.state.doc;
      const page = store.page();
      return {
        project: doc.name,
        pages: doc.pages.map((p) => ({ id: p.id, name: p.name, current: p.id === page.id, layers: p.children.length })),
        page: { id: page.id, name: page.name, layers: page.children.map((n) => summarize(n, d - 1)) },
        selection: store.ui.selection,
        colorStyles: (doc.styles?.colors || []).map((c) => ({ id: c.id, name: c.name, color: c.color })),
        textStyles: (doc.styles?.texts || []).map((t) => ({ id: t.id, name: t.name })),
        sizeVars: (doc.styles?.vars || []).map((v) => ({ id: v.id, name: v.name, value: v.value })),
        hint: 'x/y são relativos ao pai. Camadas dentro de frames com layout são posicionadas pelo navegador (flex/grid).',
      };
    },
    get_layer({ id }) {
      const n = need(id);
      const { children, ...rest } = n;
      const parent = store.parentOf(id);
      return { ...rest, tag: tagOf(n), parent: parent ? { id: parent.id, name: parent.name, layout: parent.layout?.mode || null } : null, children: (children || []).map((c) => summarize(c, 0)) };
    },
    get_code({ id }) {
      const n = need(id);
      const doc = store.state.doc;
      const gen = generateCode([n], store.parentOf(id), doc.assets, { styles: doc.styles });
      return { html: gen.html, css: joinCss([gen]) };
    },
    find_layers({ query = '', type } = {}) {
      const q = String(query).toLowerCase();
      const found = [];
      for (const page of store.state.doc.pages) {
        walk(page.children, (n) => {
          if (type && n.type !== type) return;
          if (q && !(n.name || '').toLowerCase().includes(q) && !(n.type === 'text' && n.text.toLowerCase().includes(q))) return;
          if (found.length < 60) found.push({ ...summarize(n, 0), page: page.name });
        });
      }
      return { count: found.length, layers: found };
    },
    get_selection() {
      return { layers: store.ui.selection.map((id) => store.get(id)).filter(Boolean).map((n) => summarize(n, 1)) };
    },
    select_layers({ ids = [] }) {
      const ok = ids.filter((id) => store.get(id));
      store.setSelection(ok);
      return { selected: ok };
    },
    search_icons({ query = '', limit = 20 }) {
      const all = searchIcons(query);
      return { count: all.length, icons: all.slice(0, Math.max(1, Math.min(60, Number(limit) || 20))) };
    },
    list_fonts({ query = '', category } = {}) {
      const q = String(query).toLowerCase();
      const out = [];
      for (const [name, info] of GOOGLE) {
        if (category && info.category !== category) continue;
        if (q && !name.toLowerCase().includes(q)) continue;
        out.push({ name, category: info.category, weights: info.weights });
        if (out.length >= 40) break;
      }
      const system = SYSTEM_FONTS.filter((f) => !q || f.toLowerCase().includes(q));
      return { google: out, system, hint: 'Use o nome exato em fontFamily e um peso da lista em fontWeight.' };
    },
    switch_page({ id }) {
      const page = store.state.doc.pages.find((p) => p.id === id);
      if (!page) throw new Error(`Página "${id}" não existe (veja pages em get_document).`);
      store.switchPage(id);
      return { page: { id: page.id, name: page.name } };
    },
  };

  // ------------------------------------------------------------------ ícones e estruturas
  /** SVGs de ícones já baixados (não baixa o mesmo duas vezes). */
  const iconCache = new Map();
  /** Baixa o SVG de um ícone do Google (precisa de internet; depois de inserido, é um desenho do projeto). */
  async function fetchIcon(name, style = 'outlined', filled = false) {
    if (!iconExists(name)) {
      const like = searchIcons(name).slice(0, 5);
      throw new Error(`Ícone "${name}" não existe.${like.length ? ` Parecidos: ${like.join(', ')}.` : ' Use search_icons.'}`);
    }
    const st = ['outlined', 'rounded', 'sharp'].includes(style) ? style : 'outlined';
    const url = iconUrl(name, st, !!filled);
    if (!iconCache.has(url)) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Não consegui baixar o ícone "${name}" (internet?).`);
      iconCache.set(url, await r.text());
    }
    return iconCache.get(url);
  }
  /** Ícone (SVG já baixado) → camada de vetor, na cor e no tamanho pedidos. */
  function iconNode(svg, { name, color = '#111111', size = 24 }) {
    const c = hex(color) || '#111111';
    const { node } = importSvg(svg, { name, fill: c, currentColor: c, size: Math.max(8, Math.min(512, Number(size) || 24)) });
    return node;
  }
  /** Cor e opacidade de um estilo de cor do projeto (ou null). */
  const colorStyle = (id) => (store.state.doc.styles?.colors || []).find((c) => c.id === id) || null;
  /** Lista onde uma camada nova entra (filhos do pai ou a raiz da página), conferindo se o pai aceita filhos. */
  const targetList = (parent_id) => {
    const parent = parent_id ? need(parent_id) : null;
    if (parent && !parent.children) throw new Error(`“${parent.name}” não pode ter filhos (só frames, grupos e seções).`);
    return parent ? parent.children : store.page().children;
  };
  /** Insere na posição pedida (ou no fim). */
  const insertAt = (list, node, index) => list.splice(Number.isInteger(index) ? Math.max(0, Math.min(index, list.length)) : list.length, 0, node);
  /** Tela nova na raiz: à direita do que já existe na página (não cai em cima de nada). */
  function placeBeside(node) {
    const items = store.page().children;
    if (!items.length) { node.x = 0; node.y = 0; return; }
    node.x = Math.round(Math.max(...items.map((n) => n.x + n.w)) + 160);
    node.y = Math.round(Math.min(...items.map((n) => n.y)));
  }

  /** Confere a árvore de build_layout antes de criar qualquer coisa (tipos, tamanho, ícones) e devolve os ícones usados. */
  function checkSpec(spec, depth = 0, acc = { count: 0, icons: [] }) {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('Cada nó da árvore precisa ser um objeto {type, props, children}.');
    if (depth > 10) throw new Error('Árvore funda demais (máximo 10 níveis).');
    if (++acc.count > 400) throw new Error('Árvore grande demais (máximo 400 camadas por vez). Monte em partes.');
    const types = ['frame', 'rect', 'ellipse', 'text', 'line', 'icon'];
    if (!types.includes(spec.type)) throw new Error(`type "${spec.type}" inválido. Use: ${types.join(', ')}.`);
    if (spec.type === 'icon') acc.icons.push(spec.props || {});
    if (spec.children?.length && spec.type !== 'frame') throw new Error(`Só frame tem filhos (o nó "${spec.props?.name || spec.type}" tem children).`);
    (spec.children || []).forEach((c) => checkSpec(c, depth + 1, acc));
    return acc;
  }
  /** Cria as camadas da árvore (os ícones já baixados em `svgs`). */
  function buildSpec(spec, svgs, nested) {
    const props = { ...(spec.props || {}) };
    if (spec.type === 'icon') {
      const { name, color, size, style, filled, ...rest } = props;
      const node = iconNode(svgs.get(`${name}|${style || 'outlined'}|${!!filled}`), { name, color, size });
      if (Object.keys(rest).length) applyProps(node, rest, { colorStyle });
      return node;
    }
    // caixas de estrutura DENTRO da árvore nascem transparentes e sem cortar (sombras e foco aparecem); a raiz fica branca
    const base = spec.type === 'text' ? { text: 'Texto', sizeX: 'hug', sizeY: 'hug' }
      : spec.type === 'frame' && nested ? { fill: { ...defaultFill(), type: 'none' }, clip: false } : {};
    const node = createNode(spec.type, base);
    applyProps(node, props, { colorStyle }); // layout.mode direto: camadas novas ainda não estão no canvas
    if (spec.type === 'frame') {
      // frame com layout e sem tamanho informado: do tamanho do conteúdo ("hug"), como no CSS (width/height: auto).
      // A tela raiz sem altura informada também cresce com o conteúdo.
      const hasLayout = node.layout.mode !== 'none';
      if (!('w' in props) && !('sizeX' in props) && hasLayout && nested) node.sizeX = 'hug';
      if (!('h' in props) && !('sizeY' in props) && (hasLayout || !nested)) node.sizeY = 'hug';
      node.children = (spec.children || []).map((c) => buildSpec(c, svgs, true));
    }
    return node;
  }

  const WRITE = {
    update_layer({ id, props }) {
      const n = need(id);
      store.update(() => applyProps(n, props, { setLayoutMode, colorStyle }));
      return { updated: summarize(n, 0) };
    },
    create_layer({ type, parent_id, index, props = {} }) {
      if (!['frame', 'rect', 'ellipse', 'text', 'line'].includes(type)) throw new Error('type: frame, rect, ellipse, text ou line.');
      const parent = parent_id ? need(parent_id) : null;
      if (parent && !parent.children) throw new Error(`“${parent.name}” não pode ter filhos (só frames, grupos e seções).`);
      const node = createNode(type, type === 'text' ? { text: 'Texto', sizeX: 'hug', sizeY: 'hug' } : {});
      store.update((page) => {
        applyProps(node, props, { colorStyle });
        const list = parent ? parent.children : page.children;
        const at = Number.isInteger(index) ? Math.max(0, Math.min(index, list.length)) : list.length;
        list.splice(at, 0, node);
      });
      store.setSelection([node.id]);
      return { created: summarize(node, 0) };
    },
    delete_layers({ ids = [] }) {
      const nodes = ids.map(need);
      store.update(() => nodes.forEach((n) => { const list = store.listOf(n.id); const i = list?.indexOf(n); if (i >= 0) list.splice(i, 1); }));
      store.setSelection(store.ui.selection.filter((s) => store.get(s)));
      return { deleted: ids };
    },
    move_layer({ id, parent_id, index }) {
      const n = need(id);
      const target = parent_id === 'root' ? null : parent_id ? need(parent_id) : store.parentOf(id);
      if (target && !target.children) throw new Error(`“${target.name}” não pode ter filhos.`);
      commands.reparent([n], target, Number.isInteger(index) ? index : null);
      if (store.parentOf(id) !== target) throw new Error('Não deu para mover para lá (uma camada não entra dentro dela mesma, e seções só guardam frames).');
      return { moved: summarize(n, 0), parent: target ? target.id : 'root' };
    },
    async build_layout({ parent_id, index, tree }) {
      const { icons, count } = checkSpec(tree);
      const list = targetList(parent_id);
      // baixa todos os ícones ANTES de mexer no projeto (se um falhar, nada é criado pela metade)
      const svgs = new Map();
      await Promise.all(icons.map(async (ic) => {
        const key = `${ic.name}|${ic.style || 'outlined'}|${!!ic.filled}`;
        if (!svgs.has(key)) svgs.set(key, await fetchIcon(ic.name, ic.style, ic.filled));
      }));
      const root = buildSpec(tree, svgs, !!parent_id);
      if (!parent_id) placeBeside(root);
      store.update(() => insertAt(list, root, index));
      store.setSelection([root.id]);
      return { created: summarize(root, 3), count, hint: 'Use os ids acima para ajustes finos (update_layer).' };
    },
    async insert_icon({ name, parent_id, index, color, size, style, filled }) {
      const list = targetList(parent_id);
      const node = iconNode(await fetchIcon(name, style, filled), { name, color, size });
      if (!parent_id) { const r = store.page().children; node.x = r.length ? Math.round(Math.max(...r.map((n) => n.x + n.w)) + 80) : 0; node.y = 0; }
      store.update(() => insertAt(list, node, index));
      store.setSelection([node.id]);
      return { created: summarize(node, 0) };
    },
    create_color_styles({ colors = [] }) {
      if (!Array.isArray(colors) || !colors.length) throw new Error('Mande a lista: colors: [{name, color: "#RRGGBB"}].');
      const made = colors.map(({ name, color }) => {
        const c = hex(color);
        if (!c) throw new Error(`Cor inválida em "${name}": use "#RRGGBB".`);
        return { id: uid(), name: String(name || 'Cor').trim().slice(0, 40), color: c, opacity: 1 };
      });
      store.update(() => { store.state.doc.styles.colors.push(...made); });
      return { created: made.map(({ id, name, color }) => ({ id, name, color })), hint: 'Ligue as camadas com fill: {"styleId": id}.' };
    },
    create_page({ name }) {
      store.addPage();
      const page = store.page();
      store.update(() => { page.name = String(name || page.name).trim().slice(0, 60) || page.name; });
      return { page: { id: page.id, name: page.name } };
    },
    undo() {
      if (!store.canUndo()) throw new Error('Não há nada para desfazer.');
      store.undo();
      return { undone: true };
    },
  };

  /**
   * Roda uma ferramenta e devolve o resultado (objeto JSON). Nunca lança: erros voltam como { error }.
   * @param {string} tool
   * @param {object} args
   * @param {string} [client]  quem pediu ('Assistente', 'Claude Code'...), aparece na janela de permissão
   */
  async function run(tool, args = {}, client = 'Assistente') {
    const def = toolByName(tool);
    if (!def) return { error: `Ferramenta desconhecida: ${tool}.` };
    try {
      if (!def.write) return READ[tool](args || {});
      // alteração: confere o pedido ANTES de perguntar (não adianta pedir permissão para algo que vai falhar)
      if (tool === 'update_layer' || tool === 'move_layer') need(args?.id);
      if (tool === 'delete_layers') (args?.ids || []).forEach(need);
      if (tool === 'build_layout') checkSpec(args?.tree);
      if (tool === 'build_layout' || tool === 'insert_icon') targetList(args?.parent_id);
      const summary = describeCall(tool, args || {}, store);
      const ok = approve ? await approve({ client, tool, args, summary }) : false;
      if (!ok) return { refused: true, message: 'A pessoa recusou esta alteração. Pergunte o que ela prefere.' };
      const before = JSON.stringify(store.state.doc);
      try {
        const out = await WRITE[tool](args || {});
        if (tool !== 'undo') store.commit();
        return { ok: true, ...out };
      } catch (err) {
        // falhou no meio: volta o documento para como estava (nada pela metade)
        if (tool !== 'undo' && JSON.stringify(store.state.doc) !== before) restoreDoc(before);
        throw err;
      }
    } catch (err) {
      return { error: err.message || String(err) };
    }
  }
  /** Desfaz uma alteração que falhou no meio, sem criar passo no histórico. */
  function restoreDoc(json) {
    const saved = JSON.parse(json);
    store.update(() => { Object.assign(store.state.doc, saved); }, { structural: true });
    store.emit('doc');
  }

  return { run };
}
