/** Construção de árvores, vetores e ícones; cache por executor. */
import { createNode, defaultFill } from '../../model.js';
import { importSvg } from '../../svgimport.js';
import { iconUrl, lucideIconUrl, iconExists, searchIcons } from '../../icons.js';
import type { RunnerContext, ToolHandlers, ToolArgs } from './types.ts';
import type { LayerNode } from '../../types.ts';
import { applyProps, hex } from './properties.ts';
import { summarize } from './presentation.ts';
/**
 * Vetor (caneta) vindo do agente: confere pontos e alças e devolve { points, closed, vw, vh } no formato do modelo.
 * As alças (`hin` entrada, `hout` saída) ficam em coordenadas do viewBox vw × vh, como na caneta do editor.
 */
function pathSpec(props: ToolArgs = {}) {
  const LIM = 100000;
  const num = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= LIM;
  const { points, closed, vw, vh } = props;
  if (!Array.isArray(points)) throw new Error('points: mande uma lista de pontos [{x, y, hin?, hout?}, ...] (pelo menos 2 pontos).');
  if (points.length < 2) throw new Error('points: um vetor precisa de pelo menos 2 pontos.');
  if (points.length > 500) throw new Error('points: máximo de 500 pontos por vetor.');
  const handle = (h, i, nome) => {
    if (h == null) return null;
    if (typeof h !== 'object' || Array.isArray(h) || !num(h.x) || !num(h.y)) throw new Error(`points[${i}].${nome}: a alça precisa ser {x, y} em números (ou omita para ponto de canto).`);
    return { x: h.x, y: h.y };
  };
  const clean = points.map((p, i) => {
    if (!p || typeof p !== 'object' || !num(p.x) || !num(p.y)) throw new Error(`points[${i}]: x e y precisam ser números (até ${LIM}).`);
    return { x: p.x, y: p.y, hin: handle(p.hin, i, 'hin'), hout: handle(p.hout, i, 'hout') };
  });
  const dim = (v, nome, auto) => {
    if (v == null) return Math.max(1, Math.ceil(auto));
    if (!num(v) || v <= 0) throw new Error(`${nome}: use um número maior que 0.`);
    return v;
  };
  return { points: clean, closed: !!closed, vw: dim(vw, 'vw', Math.max(...clean.map((p) => p.x))), vh: dim(vh, 'vh', Math.max(...clean.map((p) => p.y))) };
}
/** Camada de vetor pronta (sem aplicar o restante das props). */
function pathNode(props) {
  const { points, closed, vw, vh, ...rest } = props || {};
  const spec = pathSpec({ points, closed, vw, vh });
  const node = createNode('path', { w: spec.vw, h: spec.vh });
  node.points = spec.points; node.closed = spec.closed; node.vw = spec.vw; node.vh = spec.vh;
  return { node, rest };
}

/** Confere a árvore de build_layout antes de criar qualquer coisa (tipos, tamanho, ícones) e devolve os ícones usados. */
export function checkSpec(spec, depth = 0, acc: { count: number; icons: ToolArgs[] } = { count: 0, icons: [] }) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('Cada nó da árvore precisa ser um objeto {type, props, children}.');
  if (depth > 10) throw new Error('Árvore funda demais (máximo 10 níveis).');
  if (++acc.count > 400) throw new Error('Árvore grande demais (máximo 400 camadas por vez). Monte em partes.');
  const types = ['frame', 'rect', 'ellipse', 'text', 'line', 'icon', 'path'];
  if (!types.includes(spec.type)) throw new Error(`type "${spec.type}" inválido. Use: ${types.join(', ')}.`);
  if (spec.type === 'icon') acc.icons.push(spec.props || {});
  if (spec.type === 'path') pathSpec(spec.props || {}); // confere os pontos antes de criar qualquer coisa
  if (spec.children?.length && spec.type !== 'frame') throw new Error(`Só frame tem filhos (o nó "${spec.props?.name || spec.type}" tem children).`);
  (spec.children || []).forEach((c) => checkSpec(c, depth + 1, acc));
  return acc;
}

export function createLayoutTools(ctx: RunnerContext): ToolHandlers {
  const { store, need, colorStyle, effectStyle, gradientStyle, targetList, insertAt, placeBeside } = ctx;
  /** SVGs de ícones já baixados (não baixa o mesmo duas vezes). */
  const iconCache = new Map();
  /** Baixa o SVG de um ícone do Google (precisa de internet; depois de inserido, é um desenho do projeto). */
  async function fetchIcon(name, style = 'outlined', filled = false, collection = 'Material Symbols') {
    if (collection === 'Lucide') {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(String(name))) throw new Error(`Ícone Lucide "${name}" inválido.`);
      const url = lucideIconUrl(name);
      if (!iconCache.has(url)) {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`Não consegui baixar o ícone Lucide "${name}" (internet?).`);
        iconCache.set(url, await r.text());
      }
      return iconCache.get(url);
    }
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
  function iconNode(svg, { name, color = '#111111', size = 24, style = 'outlined', filled = false, collection = 'Material Symbols' }) {
    const c = hex(color) || '#111111';
    const { node } = importSvg(svg, { name, fill: c, currentColor: c, size: Math.max(8, Math.min(512, Number(size) || 24)) });
    // Mantém a proveniência no documento mesmo depois de o SVG virar vetor editável.
    Object.assign(node, {
      iconCollection: collection,
      iconSource: collection === 'Lucide' ? 'https://lucide.dev/icons' : `https://fonts.google.com/icons?icon.query=${encodeURIComponent(name)}`,
      iconLicense: collection === 'Lucide' ? 'ISC' : 'Apache License 2.0',
      iconLicenseUrl: collection === 'Lucide' ? 'https://lucide.dev/license' : 'https://www.apache.org/licenses/LICENSE-2.0',
      iconStyle: style,
      iconFilled: !!filled,
    });
    return node as LayerNode;
  }

  /** Cria as camadas da árvore (os ícones já baixados em `svgs`). */
  function buildSpec(spec, svgs, nested): LayerNode {
    const props = { ...(spec.props || {}) };
    if (spec.type === 'icon') {
      const { name, color, size, style, filled, collection, ...rest } = props;
      const node = iconNode(svgs.get(`${name}|${style || 'outlined'}|${!!filled}|${collection || 'Material Symbols'}`), { name, color, size, style, filled, collection });
      if (Object.keys(rest).length) applyProps(node, rest, { colorStyle, effectStyle, gradientStyle });
      return node;
    }
    if (spec.type === 'path') {
      const { node, rest } = pathNode(props);
      applyProps(node, rest, { colorStyle, effectStyle, gradientStyle });
      return node;
    }
    // caixas de estrutura DENTRO da árvore nascem transparentes e sem cortar (sombras e foco aparecem); a raiz fica branca
    const base: Partial<LayerNode> = spec.type === 'text' ? { text: 'Texto', sizeX: 'hug', sizeY: 'hug' }
      : spec.type === 'frame' && nested ? { fill: { ...defaultFill(), type: 'none' }, clip: false } : {};
    const node = createNode(spec.type, base);
    applyProps(node, props, { colorStyle, effectStyle, gradientStyle }); // layout.mode direto: camadas novas ainda não estão no canvas
    if (spec.type === 'frame') {
      // frame com layout e sem tamanho informado: do tamanho do conteúdo ("hug"), como no CSS (width/height: auto).
      // A tela raiz sem altura informada também cresce com o conteúdo.
      const hasLayout = node.layout!.mode !== 'none';
      if (!('w' in props) && !('sizeX' in props) && hasLayout && nested) node.sizeX = 'hug';
      if (!('h' in props) && !('sizeY' in props) && (hasLayout || !nested)) node.sizeY = 'hug';
      node.children = (spec.children || []).map((c) => buildSpec(c, svgs, true));
    }
    return node;
  }

  return {
    audit_svg({ svg, name, current_color, fill, size }) {
      const imported: any = importSvg(svg, { name, currentColor: current_color, fill, size });
      const counts: Record<string, number> = {};
      const walk = (node: any) => {
        if (!node || typeof node !== 'object') return;
        if (typeof node.type === 'string') counts[node.type] = (counts[node.type] || 0) + 1;
        if (Array.isArray(node.children)) node.children.forEach(walk);
      };
      walk(imported.node);
      return {
        valid: true,
        dimensions: { width: imported.node.vw ?? imported.node.w ?? null, height: imported.node.vh ?? imported.node.h ?? null },
        rootType: imported.node.type,
        editableLayers: Object.values(counts).reduce((sum, count) => sum + count, 0),
        types: counts,
        skipped: imported.skipped,
        ignored: imported.ignored,
        canImport: true,
        hint: imported.ignored.length ? 'Revise ignored antes de importar/exportar; os recursos listados não serão preservados como edição nativa.' : 'O SVG pode ser importado sem perdas reportadas.',
      };
    },
    create_layer({ type, parent_id, index, props = {} }) {
      if (!['frame', 'rect', 'ellipse', 'text', 'line', 'path', 'section', 'html'].includes(type)) throw new Error('type: frame, rect, ellipse, text, line, path, section ou html.');
      const parent = parent_id ? need(parent_id) : null;
      if (type === 'section' && parent) throw new Error('Seção só existe na raiz da página (sem parent_id).');
      if (parent && !parent.children) throw new Error(`“${parent.name}” não pode ter filhos (só frames, grupos e seções).`);
      const made = type === 'path' ? pathNode(props) : { node: createNode(type, type === 'text' ? { text: 'Texto', sizeX: 'hug', sizeY: 'hug' } : {}), rest: props };
      const node = made.node;
      store.update((page) => {
        applyProps(node, made.rest, { colorStyle, effectStyle, gradientStyle });
        const list = parent ? parent.children : page.children;
        const at = Number.isInteger(index) ? Math.max(0, Math.min(index, list.length)) : list.length;
        list.splice(at, 0, node);
      });
      store.setSelection([node.id]);
      return { created: summarize(node, 0) };
    },
    async build_layout({ parent_id, index, tree }) {
      const { icons, count } = checkSpec(tree);
      const list = targetList(parent_id);
      // baixa todos os ícones ANTES de mexer no projeto (se um falhar, nada é criado pela metade)
      const svgs = new Map();
      await Promise.all(icons.map(async (ic) => {
        const key = `${ic.name}|${ic.style || 'outlined'}|${!!ic.filled}|${ic.collection || 'Material Symbols'}`;
        if (!svgs.has(key)) svgs.set(key, await fetchIcon(ic.name, ic.style, ic.filled, ic.collection));
      }));
      const root = buildSpec(tree, svgs, !!parent_id);
      if (!parent_id) placeBeside(root);
      store.update(() => insertAt(list, root, index));
      store.setSelection([root.id]);
      return { created: summarize(root, 3), count, hint: 'Use os ids acima para ajustes finos (update_layer).' };
    },
    async insert_icon({ name, parent_id, index, color, size, style, filled, collection }) {
      const list = targetList(parent_id);
      const node = iconNode(await fetchIcon(name, style, filled, collection), { name, color, size, style, filled, collection });
      if (!parent_id) { const r = store.page().children; node.x = r.length ? Math.round(Math.max(...r.map((n) => n.x + n.w)) + 80) : 0; node.y = 0; }
      store.update(() => insertAt(list, node, index));
      store.setSelection([node.id]);
      return { created: summarize(node, 0) };
    },
    import_svg({ svg, name, parent_id, index, current_color, fill, size }) {
      const list = targetList(parent_id);
      const imported: any = importSvg(svg, { name, currentColor: current_color, fill, size });
      if (parent_id) {
        const parent = need(parent_id);
        if (!parent.children) throw new Error(`“${parent.name}” não pode receber um SVG.`);
        store.update(() => insertAt(list, imported.node, index));
      } else {
        placeBeside(imported.node);
        store.update(() => list.push(imported.node));
      }
      store.setSelection([imported.node.id]);
      return { created: summarize(imported.node, 3), skipped: imported.skipped, ignored: imported.ignored, hint: imported.ignored.length ? 'Alguns recursos SVG foram ignorados; revise a lista ignored antes de exportar.' : undefined };
    }
  };
}
