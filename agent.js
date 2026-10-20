// Ferramentas que um agente de IA usa pelo MCP. Todas leem e gravam o mesmo
// arquivo de projeto que o editor usa, então a pessoa vê a mudança na hora.
import { defaults, sanitizeNode, validate, find, location, walk, findInDoc, isFlex, makeBoolean, siteNames, artboards, exportFrameHTML, exportSVG, fresh, uid, TYPES, CONTAINERS } from "./model.js";

export const INSTRUCTIONS = `Você está conectado ao Stylo, um editor de sites e vetores que roda no computador da pessoa.
O desenho já é HTML/CSS: cada camada vira um elemento da página exportada.

Como o projeto é organizado:
- Projeto > páginas > camadas. Camadas podem ter filhos (frame, section, group, boolean).
- Um "frame" na raiz de uma página é uma prancheta: vira uma página do site exportado (a primeira vira index.html).
- x, y são relativos ao pai. w, h em px. Cores em #rrggbb ou #rrggbbaa (aa=00 é transparente).
- Frame com layout.mode "row" ou "column" funciona como flexbox: os filhos ignoram x/y e se organizam sozinhos
  (layout: { mode, gap, padding, align: start|center|end|stretch, justify: start|center|end|space-between, wrap }).
  Prefira layout automático para seções de site: o resultado fica responsivo no celular.
  Num frame com layout, se você não mandar w/h ele se ajusta sozinho: altura acompanha o conteúdo (hugHeight),
  dentro de uma linha a largura acompanha o conteúdo (hugWidth), dentro de uma coluna ocupa a largura toda (grow).
  grow: true num filho = ocupa o espaço que sobra. Frames aninhados com layout começam transparentes e sem margem.
- Texto: text, fontSize, fontFamily, bold, italic, align, lineHeight, sizing ("auto" ajusta à palavra, "width" quebra linhas na largura w).
- Vetor (type "path"): points = [[x, y, inX, inY, outX, outY], ...] com alças relativas ao ponto; closed true/false.
- Formas: rect, ellipse, polygon, star (count = número de pontas).
- link: id de outra prancheta (vira link entre páginas) ou URL https.
- component: true num frame transforma em componente; uma camada { type: "instance", ref: idDoComponente } reutiliza.

Trabalhe assim: get_project para ver ids, add_layers para criar (pode mandar filhos aninhados), update_layers para mudar,
export_html para conferir o resultado, export_svg/export_png para ícones.
Ícones: desenhe em camadas (formas e vetores), junte com combine_shapes e exporte. Para PNG o projeto precisa estar aberto no Stylo. A pessoa pode estar editando ao mesmo tempo: leia de novo antes de grandes mudanças.`;

const S = { type: "string" },
  N = { type: "number" },
  OBJ = { type: "object" };
export const TOOLS = [
  { name: "list_projects", description: "Lista os projetos salvos.", inputSchema: { type: "object", properties: {} } },
  { name: "create_project", description: "Cria um projeto vazio e devolve o id.", inputSchema: { type: "object", properties: { title: S }, required: ["title"] } },
  {
    name: "get_project",
    description: "Mostra páginas e a árvore de camadas (ids, tipo, nome, posição, tamanho, texto). full=true devolve o JSON completo.",
    inputSchema: { type: "object", properties: { projectId: S, full: { type: "boolean" } }, required: ["projectId"] },
  },
  { name: "add_page", description: "Adiciona uma página ao projeto.", inputSchema: { type: "object", properties: { projectId: S, name: S }, required: ["projectId", "name"] } },
  {
    name: "add_layers",
    description: `Cria camadas (com filhos aninhados em "children"). Cada camada: { type: ${TYPES.join("|")}, ...propriedades }. parentId opcional (frame/section/group); sem pageId usa a primeira página.`,
    inputSchema: { type: "object", properties: { projectId: S, pageId: S, parentId: S, index: N, layers: { type: "array", items: OBJ } }, required: ["projectId", "layers"] },
  },
  {
    name: "update_layers",
    description: "Muda propriedades de camadas existentes: updates = [{ id, props: { ... } }].",
    inputSchema: { type: "object", properties: { projectId: S, updates: { type: "array", items: OBJ } }, required: ["projectId", "updates"] },
  },
  { name: "delete_layers", description: "Apaga camadas pelo id.", inputSchema: { type: "object", properties: { projectId: S, ids: { type: "array", items: S } }, required: ["projectId", "ids"] } },
  {
    name: "move_layer",
    description: "Move uma camada para outro pai (parentId vazio = raiz da página) e posição na lista (index).",
    inputSchema: { type: "object", properties: { projectId: S, id: S, parentId: S, pageId: S, index: N }, required: ["projectId", "id"] },
  },
  {
    name: "combine_shapes",
    description: "Combina formas irmãs num vetor: op = union | subtract | intersect | exclude. Em subtract, a forma de baixo (a primeira criada) perde o formato das outras. name opcional.",
    inputSchema: { type: "object", properties: { projectId: S, ids: { type: "array", items: S }, op: S, name: S }, required: ["projectId", "ids", "op"] },
  },
  { name: "export_html", description: "Devolve o HTML da prancheta (frame da raiz) como página pronta. Sem frameId usa a primeira prancheta.", inputSchema: { type: "object", properties: { projectId: S, frameId: S }, required: ["projectId"] } },
  {
    name: "export_svg",
    description: "Devolve um SVG com as camadas pedidas. save=true também grava o arquivo em projetos/exportados e devolve o caminho.",
    inputSchema: { type: "object", properties: { projectId: S, ids: { type: "array", items: S }, save: { type: "boolean" }, fileName: S }, required: ["projectId", "ids"] },
  },
  {
    name: "export_png",
    description:
      "Gera um PNG das camadas (ex.: um ícone) e grava em projetos/exportados. Precisa do projeto aberto no Stylo no navegador, que é quem desenha. scale = 1 a 8 (padrão 2). Devolve a imagem e o caminho do arquivo.",
    inputSchema: { type: "object", properties: { projectId: S, ids: { type: "array", items: S }, scale: N, fileName: S }, required: ["projectId"] },
  },
];

const outline = (nodes, depth = 0) =>
  nodes.map((n) => {
    const o = { id: n.id, type: n.type, name: n.name, x: Math.round(n.x), y: Math.round(n.y), w: Math.round(n.w), h: Math.round(n.h) };
    if (n.type === "text") o.text = n.text.length > 80 ? n.text.slice(0, 80) + "…" : n.text;
    if (isFlex(n)) o.layout = n.layout;
    if (n.component) o.component = true;
    if (n.type === "instance") o.ref = n.ref;
    if (n.hidden) o.hidden = true;
    if (n.children?.length && depth < 12) o.children = outline(n.children, depth + 1);
    return o;
  });

// Monta uma camada nova a partir do que o agente mandou (ids novos, padrões completos).
// parent: o pai já pronto (ou o rascunho do pai), para escolher bons padrões
function draft(spec, ids, parent = null) {
  if (!spec || !TYPES.includes(spec.type)) throw new Error(`Tipo de camada inválido: ${spec?.type}. Use ${TYPES.join(", ")}.`);
  const base = defaults(spec.type);
  const raw = { ...base, ...spec, id: spec.id && !ids.has(spec.id) ? spec.id : uid(), layout: { ...base.layout, ...(spec.layout || {}) } };
  ids.add(raw.id);
  // frames com layout automático: tamanho "automático" quando o agente não diz
  if (spec.type === "frame" && raw.layout.mode !== "none") {
    if (spec.h === undefined && spec.hugHeight === undefined) raw.hugHeight = true;
    if (parent) {
      if (spec.layout?.padding === undefined) raw.layout.padding = 0;
      if (spec.fill === undefined) raw.fill = "#ffffff00";
      if (spec.clip === undefined) raw.clip = false;
    }
    if (spec.w === undefined) {
      if (!parent) raw.w = 1280;
      else if (isFlex(parent) && parent.layout.mode === "row") raw.hugWidth = spec.hugWidth ?? true;
      else if (isFlex(parent)) raw.grow = spec.grow ?? true;
    }
  }
  if (!parent && spec.type === "frame" && spec.w === undefined) raw.w = 1280;
  if (spec.type === "text" && spec.w !== undefined && spec.sizing === undefined) raw.sizing = "width";
  if (spec.type === "path" && spec.points && spec.w === undefined) {
    const xs = spec.points.map((p) => p[0]),
      ys = spec.points.map((p) => p[1]);
    raw.w = Math.max(1, Math.max(...xs) - Math.min(...xs));
    raw.h = Math.max(1, Math.max(...ys) - Math.min(...ys));
  }
  raw.children = CONTAINERS.includes(spec.type) ? (spec.children || []).map((c) => draft(c, ids, raw)) : undefined;
  return raw;
}
function build(spec, ids, parent) {
  const before = new Set(ids);
  return sanitizeNode(draft(spec, ids, parent), before);
}
const allIds = (doc) => {
  const s = new Set();
  doc.pages.forEach((p) => walk(p.nodes, (n) => s.add(n.id)));
  return s;
};
const pageOf = (doc, pageId) => (pageId ? doc.pages.find((p) => p.id === pageId) : doc.pages[0]) || fail("Página não encontrada");
const nodeOf = (doc, id) => findInDoc(doc, id) || fail(`Camada não encontrada: ${id}`);
function fail(m) {
  throw new Error(m);
}

// store: { list(), create(doc), read(id), write(id, doc, by) }
export async function callTool(store, name, args = {}) {
  if (name === "list_projects") return await store.list();
  if (name === "create_project") {
    const { id } = await store.create(fresh(String(args.title || "Sem título")), "agente");
    return { projectId: id };
  }
  const { doc } = await store.read(args.projectId);
  if (name === "get_project") return args.full ? doc : { title: doc.title, pages: doc.pages.map((p) => ({ id: p.id, name: p.name, layers: outline(p.nodes) })) };
  if (name === "export_html") {
    const node = args.frameId ? nodeOf(doc, args.frameId).node : artboards(doc)[0]?.frame;
    if (!node) fail("o projeto ainda não tem prancheta");
    if (node.type !== "frame") fail("export_html precisa de um frame");
    return exportFrameHTML(doc, node, { links: siteNames(doc) });
  }
  if (name === "export_svg") {
    const nodes = (args.ids || []).map((id) => nodeOf(doc, id).node);
    const svg = exportSVG(doc, nodes);
    if (!args.save) return svg;
    const file = await store.saveExport((args.fileName || nodes[0]?.name || doc.title) + ".svg", svg);
    return `Salvo em ${file}\n\n${svg}`;
  }
  if (name === "export_png") {
    const ids = (args.ids || []).map((id) => nodeOf(doc, id).node.id);
    const scale = Math.max(1, Math.min(8, Number(args.scale) || 2));
    const png = await store.render(args.projectId, ids, scale);
    const first = ids[0] ? nodeOf(doc, ids[0]).node.name : doc.title;
    const file = await store.saveExport(`${args.fileName || first}@${scale}x.png`, png);
    return { image: png.toString("base64"), text: `PNG salvo em ${file}` };
  }
  let result;
  if (name === "add_page") {
    const p = { id: uid(), name: String(args.name || "Página"), nodes: [] };
    doc.pages.push(p);
    result = { pageId: p.id };
  } else if (name === "add_layers") {
    const page = pageOf(doc, args.pageId);
    let list = page.nodes,
      parent = null;
    if (args.parentId) {
      parent = find(page.nodes, args.parentId) || fail("parentId não encontrado nesta página");
      if (!parent.children || parent.type === "boolean") fail("Esse pai não aceita filhos");
      list = parent.children;
    }
    const ids = allIds(doc);
    const made = (args.layers || []).map((s) => build(s, ids, parent));
    list.splice(Number.isInteger(args.index) ? args.index : list.length, 0, ...made);
    result = { created: made.map((n) => ({ id: n.id, type: n.type, name: n.name })) };
  } else if (name === "update_layers") {
    for (const u of args.updates || []) {
      const { node } = nodeOf(doc, u.id);
      const props = { ...(u.props || {}) };
      delete props.id;
      delete props.type;
      delete props.children;
      if (props.layout) props.layout = { ...node.layout, ...props.layout };
      if (node.type === "text" && props.w !== undefined && props.sizing === undefined && node.sizing === "auto") props.sizing = "width";
      Object.assign(node, props);
    }
    result = { updated: (args.updates || []).length };
  } else if (name === "delete_layers") {
    for (const id of args.ids || [])
      for (const p of doc.pages) {
        const l = location(p.nodes, id);
        if (l) l.list.splice(l.index, 1);
      }
    result = { deleted: (args.ids || []).length };
  } else if (name === "move_layer") {
    const from = nodeOf(doc, args.id);
    const l = location(from.page.nodes, args.id);
    const page = args.pageId ? pageOf(doc, args.pageId) : from.page;
    let list = page.nodes;
    if (args.parentId) {
      const parent = find(page.nodes, args.parentId) || fail("parentId não encontrado");
      if (!parent.children || parent.type === "boolean" || find([from.node], parent.id)) fail("Não dá pra mover para esse pai");
      list = parent.children;
    }
    l.list.splice(l.index, 1);
    list.splice(Number.isInteger(args.index) ? args.index : list.length, 0, from.node);
    result = { moved: args.id };
  } else if (name === "combine_shapes") {
    const ids = args.ids || [];
    if (ids.length < 2) fail("Mande pelo menos 2 ids");
    const page = nodeOf(doc, ids[0]).page;
    const locs = ids.map((id) => location(page.nodes, id) || fail("Todas as formas precisam estar na mesma página"));
    if (locs.some((l) => l.list !== locs[0].list)) fail("As formas precisam ter o mesmo pai");
    const nodes = locs.sort((a, b) => a.index - b.index).map((l) => l.list[l.index]);
    const g = makeBoolean(nodes, args.op);
    if (args.name) g.name = String(args.name).slice(0, 200);
    const list = locs[0].list;
    const at = Math.max(...locs.map((l) => l.index)) - nodes.length + 1;
    for (const n of nodes) list.splice(list.indexOf(n), 1);
    list.splice(at, 0, g);
    result = { id: g.id };
  } else fail(`Ferramenta desconhecida: ${name}`);
  await store.write(args.projectId, validate(doc), "agente");
  return result;
}
