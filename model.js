// Modelo do Stylo: documento, validação, geometria vetorial e exportação.
// Roda igual no navegador e no Node (o servidor usa as mesmas funções).
// Geometria de polígonos/estrelas adaptada de StyloDesigner/lib/shapes.ts (MIT).

export const VERSION = 2;
export const TYPES = ["frame", "section", "group", "rect", "ellipse", "polygon", "star", "path", "text", "image", "boolean", "instance"];
export const CONTAINERS = ["frame", "section", "group", "boolean"];
export const FONTS = ["system-ui", "Arial", "Helvetica", "Georgia", "Verdana", "Trebuchet MS", "Times New Roman", "Courier New"];
export const TYPE_NAMES = {
  frame: "Prancheta",
  section: "Seção",
  group: "Grupo",
  rect: "Retângulo",
  ellipse: "Elipse",
  polygon: "Polígono",
  star: "Estrela",
  path: "Vetor",
  text: "Texto",
  image: "Imagem",
  boolean: "Combinação",
  instance: "Instância",
};
const K = 0.5523; // aproximação de arco por curva cúbica

export const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const uid = () => globalThis.crypto.randomUUID();
const num = (n) => +(+n).toFixed(2);

export function fresh(title = "Sem título") {
  return { version: VERSION, title, pages: [{ id: uid(), name: "Página 1", nodes: [] }] };
}

// ------------------------------------------------------------------ camadas

export function defaults(type) {
  const n = {
    id: uid(),
    type,
    name: TYPE_NAMES[type] || type,
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    rotation: 0,
    opacity: 1,
    fill: "#d9dde8",
    stroke: "#1f2328",
    strokeWidth: 0,
    radius: 0,
    hidden: false,
    locked: false,
    shadow: false,
    grow: false,
    link: "",
  };
  if (type === "frame") Object.assign(n, { fill: "#ffffff", clip: true, hugHeight: false, hugWidth: false, component: false, layout: defaultLayout() });
  if (type === "section") Object.assign(n, { fill: "#e9ebf0" });
  if (type === "text")
    Object.assign(n, { fill: "#1f2328", text: "Texto", fontSize: 24, fontFamily: "system-ui", bold: false, italic: false, align: "left", lineHeight: 1.3, letterSpacing: 0, sizing: "auto", w: 60, h: 31 });
  if (type === "path") Object.assign(n, { points: [], closed: false, strokeWidth: 2, fill: "#d9dde8" });
  if (type === "polygon" || type === "star") n.count = 5;
  if (type === "image") Object.assign(n, { src: "", fit: "cover" });
  if (type === "boolean") Object.assign(n, { op: "union" });
  if (type === "instance") Object.assign(n, { ref: "" });
  if (CONTAINERS.includes(type)) n.children = [];
  return n;
}
export const defaultLayout = () => ({ mode: "none", gap: 16, padding: 24, align: "start", justify: "start", wrap: false });

// ------------------------------------------------------------------ validação

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const ID = /^[\w-]{1,64}$/;
const LINK = /^(https?:\/\/[^\s"'<>]{1,2000}|[\w-]{1,64})?$/;
const IMG = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const ENUMS = {
  sizing: ["auto", "width", "fixed"],
  align: ["left", "center", "right"],
  op: ["union", "subtract", "intersect", "exclude"],
  fit: ["cover", "contain", "fill"],
};
const LAYOUT_ENUMS = { mode: ["none", "row", "column"], align: ["start", "center", "end", "stretch"], justify: ["start", "center", "end", "space-between"] };

function fail(msg) {
  throw new Error(msg);
}

// Migra projetos da versão 1 (linhas giradas, texto cinza claro).
export function migrate(data) {
  if (data?.version === 1 && Array.isArray(data.pages)) {
    const up = (n) => {
      if (n.type === "line") {
        const a = (n.rotation * Math.PI) / 180;
        const dx = Math.cos(a) * n.w,
          dy = Math.sin(a) * n.w;
        Object.assign(n, { type: "path", rotation: 0, closed: false, points: [[0, 0], [dx, dy]] });
        const b = normalizeWorldPath(n.points.map(([x, y]) => [n.x + x, n.y + y]), false);
        Object.assign(n, b);
      }
      if (n.type === "text") {
        if (n.fill?.toLowerCase() === "#eeeeee") n.fill = "#1f2328";
        n.sizing = "width";
      }
      (n.children || []).forEach(up);
    };
    data.pages.forEach((p) => (p.nodes || []).forEach(up));
    data.version = VERSION;
  }
  return data;
}

// Valida e limpa um documento: só passam campos conhecidos com valores seguros.
export function validate(data) {
  data = migrate(data);
  if (data?.version !== VERSION || typeof data.title !== "string" || !Array.isArray(data.pages) || !data.pages.length)
    fail("Formato inválido: use um arquivo de projeto do Stylo.");
  const ids = new Set();
  let count = 0;
  const pages = data.pages.map((p) => {
    if (!p || typeof p.id !== "string" || !ID.test(p.id) || typeof p.name !== "string") fail("Página inválida");
    if (!Array.isArray(p.nodes)) fail("Camadas inválidas");
    return { id: p.id, name: p.name.slice(0, 200), nodes: p.nodes.map((n) => sanitizeNode(n, ids, 0, () => ++count)) };
  });
  return { version: VERSION, title: data.title.slice(0, 200) || "Sem título", pages };
}

export function sanitizeNode(n, ids = new Set(), depth = 0, counter = () => 0) {
  if (counter() > 20000 || depth > 40) fail("Projeto grande demais");
  if (!n || typeof n !== "object" || !TYPES.includes(n.type)) fail("Camada inválida");
  if (typeof n.id !== "string" || !ID.test(n.id) || ids.has(n.id)) fail("Camada com id inválido ou repetido");
  ids.add(n.id);
  const d = defaults(n.type);
  const out = { ...d, id: n.id };
  for (const k of Object.keys(d)) {
    if (k === "id" || k === "children" || !(k in n) || n[k] === undefined) continue;
    const v = n[k],
      dv = d[k];
    if (typeof dv === "number") {
      if (!Number.isFinite(v)) fail(`Número inválido em ${k}`);
      out[k] = v;
    } else if (typeof dv === "boolean") out[k] = !!v;
    else if (k === "fill" || k === "stroke") {
      if (!HEX.test(v)) fail(`Cor inválida em ${k}`);
      out[k] = v.toLowerCase();
    } else if (k === "name") out.name = String(v).slice(0, 200);
    else if (k === "text") out.text = String(v).slice(0, 20000);
    else if (k === "fontFamily") {
      if (typeof v !== "string" || !/^[\w ,\-]{1,80}$/.test(v)) fail("Fonte inválida");
      out[k] = v;
    } else if (ENUMS[k]) {
      if (!ENUMS[k].includes(v)) fail(`Valor inválido em ${k}`);
      out[k] = v;
    } else if (k === "link") {
      if (typeof v !== "string" || !LINK.test(v)) fail("Link inválido");
      out.link = v;
    } else if (k === "src") {
      if (v !== "" && !(typeof v === "string" && IMG.test(v))) fail("Imagem inválida: use PNG, JPEG, WebP ou GIF embutido");
      out.src = v;
    } else if (k === "ref") {
      if (typeof v !== "string" || (v && !ID.test(v))) fail("Referência inválida");
      out.ref = v;
    } else if (k === "layout") {
      const l = { ...defaultLayout() };
      for (const [lk, lv] of Object.entries(v || {})) {
        if (LAYOUT_ENUMS[lk]) {
          if (!LAYOUT_ENUMS[lk].includes(lv)) fail("Layout inválido");
          l[lk] = lv;
        } else if (lk === "gap" || lk === "padding") {
          if (!Number.isFinite(lv) || lv < 0) fail("Layout inválido");
          l[lk] = lv;
        } else if (lk === "wrap") l.wrap = !!lv;
      }
      out.layout = l;
    } else if (k === "points") {
      if (!Array.isArray(v) || v.length > 20000) fail("Vetor inválido");
      out.points = v.map((p) => {
        if (!Array.isArray(p) || (p.length !== 2 && p.length !== 6) || !p.every(Number.isFinite)) fail("Vetor inválido");
        return p.length === 2 ? [p[0], p[1], 0, 0, 0, 0] : [...p];
      });
    }
  }
  if (out.w <= 0 || out.h <= 0) fail("Tamanho inválido");
  out.opacity = Math.max(0, Math.min(1, out.opacity));
  out.strokeWidth = Math.max(0, out.strokeWidth);
  out.radius = Math.max(0, out.radius);
  if (out.count !== undefined) out.count = Math.max(3, Math.min(60, Math.round(out.count)));
  if (out.fontSize !== undefined) out.fontSize = Math.max(1, Math.min(2000, out.fontSize));
  if (CONTAINERS.includes(n.type)) {
    if (n.children !== undefined && !Array.isArray(n.children)) fail("Camadas inválidas");
    out.children = (n.children || []).map((c) => sanitizeNode(c, ids, depth + 1, counter));
  }
  return out;
}

// ------------------------------------------------------------------ árvore

export function find(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    const child = find(n.children || [], id);
    if (child) return child;
  }
  return null;
}
export function location(nodes, id, parent = null) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return { list: nodes, index: i, parent };
    const hit = location(nodes[i].children || [], id, nodes[i]);
    if (hit) return hit;
  }
  return null;
}
export function ancestors(nodes, id) {
  const chain = [];
  const walk = (list) => {
    for (const n of list) {
      chain.push(n);
      if (n.id === id) return true;
      if (walk(n.children || [])) return true;
      chain.pop();
    }
    return false;
  };
  return walk(nodes) ? chain : [];
}
export function walk(nodes, fn, parent = null) {
  for (const n of nodes) {
    fn(n, parent);
    walk(n.children || [], fn, n);
  }
}
export function findInDoc(doc, id) {
  for (const p of doc.pages) {
    const n = find(p.nodes, id);
    if (n) return { node: n, page: p };
  }
  return null;
}
export function components(doc) {
  const out = [];
  for (const p of doc.pages) walk(p.nodes, (n) => n.component && out.push({ node: n, page: p }));
  return out;
}
export function cloneTree(n) {
  const c = structuredClone(n);
  const renew = (x) => {
    x.id = uid();
    (x.children || []).forEach(renew);
  };
  renew(c);
  return c;
}
export const isFlex = (n) => n?.type === "frame" && n.layout?.mode && n.layout.mode !== "none";

// ------------------------------------------------------------------ geometria vetorial
// Um "subcaminho" é { pts: [{x,y,ix,iy,ox,oy}], closed } com alças relativas ao ponto.

const P = (x, y, ix = 0, iy = 0, ox = 0, oy = 0) => ({ x, y, ix, iy, ox, oy });

export function shapePoints(kind, w, h, count = 5) {
  const n = kind === "star" ? count * 2 : count;
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n,
      r = kind === "star" && i % 2 ? 0.45 : 1;
    return [w / 2 + (Math.cos(a) * w * r) / 2, h / 2 + (Math.sin(a) * h * r) / 2];
  });
}

// Subcaminhos de uma forma, nas coordenadas da própria camada (0..w, 0..h).
export function shapeSubpaths(n) {
  const { w, h } = n;
  if (n.type === "path") return [{ pts: n.points.map((p) => P(...p)), closed: n.closed }];
  if (n.type === "ellipse") {
    const rx = w / 2,
      ry = h / 2,
      kx = K * rx,
      ky = K * ry;
    return [{ closed: true, pts: [P(rx, 0, -kx, 0, kx, 0), P(w, ry, 0, -ky, 0, ky), P(rx, h, kx, 0, -kx, 0), P(0, ry, 0, ky, 0, -ky)] }];
  }
  if (n.type === "polygon" || n.type === "star") return [{ closed: true, pts: shapePoints(n.type, w, h, n.count).map(([x, y]) => P(x, y)) }];
  if (n.type === "boolean") return n.children.flatMap((c) => transformSubpaths(shapeSubpaths(c), c));
  // retângulo, prancheta, imagem, instância: retângulo com cantos arredondados
  const r = Math.min(n.radius || 0, w / 2, h / 2),
    k = K * r;
  if (!r) return [{ closed: true, pts: [P(0, 0), P(w, 0), P(w, h), P(0, h)] }];
  return [
    {
      closed: true,
      pts: [P(r, 0, -k, 0), P(w - r, 0, 0, 0, k, 0), P(w, r, 0, -k), P(w, h - r, 0, 0, 0, k), P(w - r, h, k, 0), P(r, h, 0, 0, -k, 0), P(0, h - r, 0, k), P(0, r, 0, 0, 0, -k)],
    },
  ];
}

// Leva subcaminhos da camada para as coordenadas do pai (posição + rotação no centro).
export function transformSubpaths(subs, n) {
  const a = ((n.rotation || 0) * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a),
    cx = n.w / 2,
    cy = n.h / 2;
  const rot = (x, y) => [x * c - y * s, x * s + y * c];
  return subs.map((sp) => ({
    closed: sp.closed,
    pts: sp.pts.map((p) => {
      const [x, y] = rot(p.x - cx, p.y - cy);
      const [ix, iy] = rot(p.ix, p.iy);
      const [ox, oy] = rot(p.ox, p.oy);
      return P(n.x + cx + x, n.y + cy + y, ix, iy, ox, oy);
    }),
  }));
}

export function subpathsToD(subs) {
  return subs
    .filter((sp) => sp.pts.length)
    .map((sp) => {
      const pts = sp.pts;
      let d = `M${num(pts[0].x)} ${num(pts[0].y)}`;
      const seg = (a, b) =>
        !a.ox && !a.oy && !b.ix && !b.iy
          ? `L${num(b.x)} ${num(b.y)}`
          : `C${num(a.x + a.ox)} ${num(a.y + a.oy)} ${num(b.x + b.ix)} ${num(b.y + b.iy)} ${num(b.x)} ${num(b.y)}`;
      for (let i = 1; i < pts.length; i++) d += seg(pts[i - 1], pts[i]);
      if (sp.closed && pts.length > 1) d += seg(pts[pts.length - 1], pts[0]) + "Z";
      return d;
    })
    .join("");
}

const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};
// Amostra o contorno real (curvas incluídas) para caixas e orientação.
export function samplePoints(sp, steps = 12) {
  const out = [];
  const pts = sp.pts;
  const segs = pts.length - 1 + (sp.closed && pts.length > 1 ? 1 : 0);
  if (pts.length === 1) return [[pts[0].x, pts[0].y]];
  for (let i = 0; i < segs; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    const straight = !a.ox && !a.oy && !b.ix && !b.iy;
    const n = straight ? 1 : steps;
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      out.push([bez(a.x, a.x + a.ox, b.x + b.ix, b.x, t), bez(a.y, a.y + a.oy, b.y + b.iy, b.y, t)]);
    }
  }
  return out;
}
export function bounds(points) {
  if (!points.length) return { x: 0, y: 0, w: 0, h: 0 };
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Recebe pontos ([x,y] ou [x,y,ix,iy,ox,oy]) em coordenadas do pai e devolve
// a caixa justa + pontos relativos a ela (o formato guardado na camada).
export function normalizeWorldPath(points, closed) {
  const full = points.map((p) => (p.length === 6 ? [...p] : [p[0], p[1], 0, 0, 0, 0]));
  const b = bounds(samplePoints({ pts: full.map((p) => P(...p)), closed }));
  return {
    x: b.x,
    y: b.y,
    w: Math.max(b.w, 1),
    h: Math.max(b.h, 1),
    points: full.map(([x, y, ix, iy, ox, oy]) => [num(x - b.x), num(y - b.y), num(ix), num(iy), num(ox), num(oy)]),
  };
}

// Depois de editar pontos de um vetor (talvez girado), recalcula a caixa sem
// mover o desenho na tela.
export function refitPath(n) {
  const b = bounds(samplePoints({ pts: n.points.map((p) => P(...p)), closed: n.closed }));
  const nw = Math.max(b.w, 1),
    nh = Math.max(b.h, 1);
  const a = ((n.rotation || 0) * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  const c0 = [n.w / 2, n.h / 2],
    c1 = [b.x + nw / 2, b.y + nh / 2];
  const dx = c1[0] - c0[0],
    dy = c1[1] - c0[1];
  n.x = n.x + c0[0] + (dx * c - dy * s) - nw / 2;
  n.y = n.y + c0[1] + (dx * s + dy * c) - nh / 2;
  n.points = n.points.map(([x, y, ix, iy, ox, oy]) => [num(x - b.x), num(y - b.y), ix, iy, ox, oy]);
  n.w = nw;
  n.h = nh;
}

// Lápis: simplifica o traço (Ramer–Douglas–Peucker) e suaviza com curvas.
export function simplify(points, tolerance = 1.5) {
  if (points.length < 3) return points;
  const sq = tolerance * tolerance;
  const dist = (p, a, b) => {
    let x = a[0],
      y = a[1],
      dx = b[0] - x,
      dy = b[1] - y;
    if (dx || dy) {
      const t = Math.max(0, Math.min(1, ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)));
      x += dx * t;
      y += dy * t;
    }
    return (p[0] - x) ** 2 + (p[1] - y) ** 2;
  };
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0,
      idx = 0;
    for (let i = a + 1; i < b; i++) {
      const d = dist(points[i], points[a], points[b]);
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (max > sq) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
export function smooth(points) {
  return points.map((p, i) => {
    const prev = points[i - 1] || p,
      next = points[i + 1] || p;
    const tx = (next[0] - prev[0]) / 6,
      ty = (next[1] - prev[1]) / 6;
    return [p[0], p[1], i ? -tx : 0, i ? -ty : 0, i < points.length - 1 ? tx : 0, i < points.length - 1 ? ty : 0];
  });
}

const area = (sp) => {
  const pts = samplePoints(sp, 6);
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i],
      [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
};
const reverse = (sp) => ({ closed: sp.closed, pts: [...sp.pts].reverse().map((p) => P(p.x, p.y, p.ox, p.oy, p.ix, p.iy)) });
const orient = (subs) => subs.map((sp) => (area(sp) < 0 ? reverse(sp) : sp));

// Converte uma forma em vetor editável (mesma aparência).
export function toPath(n) {
  const subs = shapeSubpaths(n);
  const sp = subs[0];
  return { ...defaults("path"), ...pick(n, ["id", "name", "x", "y", "w", "h", "rotation", "opacity", "fill", "stroke", "strokeWidth", "hidden", "locked", "shadow", "link", "grow"]), closed: sp.closed, points: sp.pts.map((p) => [num(p.x), num(p.y), num(p.ix), num(p.iy), num(p.ox), num(p.oy)]) };
}
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

// Cria uma combinação (unir/subtrair/…) a partir de irmãos.
export const outline = (n) => transformSubpaths(shapeSubpaths(n), n).flatMap((sp) => samplePoints(sp));
export function makeBoolean(nodes, op = "union") {
  const b = bounds(nodes.flatMap(outline));
  const g = defaults("boolean");
  Object.assign(g, { op, x: b.x, y: b.y, w: Math.max(b.w, 1), h: Math.max(b.h, 1), fill: nodes[0].fill, stroke: nodes[0].stroke, strokeWidth: nodes[0].strokeWidth, name: { union: "União", subtract: "Subtração", intersect: "Interseção", exclude: "Exclusão" }[op] });
  g.children = nodes.map((n) => ({ ...n, x: n.x - b.x, y: n.y - b.y }));
  return g;
}

// Escala uma camada (e filhos de grupos/combinações) — usado ao redimensionar.
export function scaleNode(n, sx, sy) {
  if (n.type === "path") n.points = n.points.map(([x, y, ix, iy, ox, oy]) => [x * sx, y * sy, ix * sx, iy * sy, ox * sx, oy * sy]);
  if (n.type === "group" || n.type === "boolean")
    for (const c of n.children) {
      c.x *= sx;
      c.y *= sy;
      c.w = Math.max(1, c.w * sx);
      c.h = Math.max(1, c.h * sy);
      scaleNode(c, sx, sy);
    }
}

// Ajusta a caixa de um grupo/combinação ao conteúdo.
export function fitGroup(g) {
  if (!g.children?.length) return;
  const pts = g.children.flatMap(outline);
  const b = bounds(pts);
  for (const c of g.children) {
    c.x -= b.x;
    c.y -= b.y;
  }
  g.x += b.x;
  g.y += b.y;
  g.w = Math.max(b.w, 1);
  g.h = Math.max(b.h, 1);
}

// ------------------------------------------------------------------ cores

export function color(hex) {
  const c = hex.slice(0, 7),
    a = hex.length === 9 ? parseInt(hex.slice(7), 16) / 255 : 1;
  return { c, a: num(a) };
}
const svgPaint = (attr, hex) => {
  const { c, a } = color(hex);
  return a === 0 ? `${attr}="none"` : `${attr}="${c}"${a < 1 ? ` ${attr}-opacity="${a}"` : ""}`;
};

// ------------------------------------------------------------------ HTML (editor e exportação usam o mesmo)

const cssProp = (k) => k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
const css = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${cssProp(k)}:${v}`)
    .join(";");

export function styleOf(n, parent, opts = {}) {
  const flexParent = isFlex(parent);
  const s = {};
  s.position = flexParent ? "relative" : "absolute";
  if (!flexParent) {
    s.left = num(n.x) + "px";
    s.top = num(n.y) + "px";
  }
  const textAuto = n.type === "text" && n.sizing === "auto";
  const hugW = n.type === "frame" && n.hugWidth && isFlex(n);
  s.width = textAuto ? "max-content" : hugW ? "fit-content" : num(n.w) + "px";
  s.height = n.type === "text" && n.sizing !== "fixed" ? "auto" : n.type === "frame" && n.hugHeight && isFlex(n) ? "auto" : num(n.h) + "px";
  if (n.type === "frame" && n.hugHeight && isFlex(n)) s.minHeight = "1px";
  if (flexParent) {
    const row = parent.layout.mode === "row";
    s.flexShrink = "0";
    // nunca passa da largura do pai: é isso que deixa a página boa no celular
    s.maxWidth = "100%";
    // "Esticar" no pai: o filho ocupa todo o eixo cruzado
    if (parent.layout.align === "stretch") {
      if (row) s.height = "auto";
      else if (!hugW) s.width = "auto";
    }
    if (n.grow && !hugW) {
      if (row) {
        // cresce para ocupar a sobra; com "quebrar linha", desce quando não cabe
        s.flex = `1 1 ${num(n.w)}px`;
        s.minWidth = "0";
        s.width = "auto";
      } else {
        s.alignSelf = "stretch";
        s.width = "auto";
      }
    }
  }
  if (n.rotation) s.transform = `rotate(${num(n.rotation)}deg)`;
  if (n.opacity !== 1) s.opacity = num(n.opacity);
  const box = ["rect", "ellipse", "frame", "section", "instance", "image"].includes(n.type);
  if (["rect", "ellipse", "frame", "section"].includes(n.type)) s.background = n.fill;
  if (n.type === "instance") {
    const m = opts.doc && findInDoc(opts.doc, n.ref)?.node;
    if (m) s.background = m.fill;
  }
  if (box && n.strokeWidth > 0) {
    s.outline = `${num(n.strokeWidth)}px solid ${n.stroke}`;
    s.outlineOffset = `-${num(n.strokeWidth)}px`;
  }
  if (n.type === "ellipse") s.borderRadius = "50%";
  else if (box && n.radius) s.borderRadius = num(n.radius) + "px";
  if (n.shadow) s.boxShadow = "0 6px 16px rgba(0,0,0,.27)";
  if (["frame", "image", "instance"].includes(n.type) && (n.clip !== false || n.type !== "frame")) s.overflow = "hidden";
  if (n.hidden) s.display = "none";
  if (isFlex(n)) {
    const l = n.layout;
    const map = { start: "flex-start", end: "flex-end", center: "center", stretch: "stretch", "space-between": "space-between" };
    Object.assign(s, {
      display: n.hidden ? "none" : "flex",
      flexDirection: l.mode,
      gap: l.gap + "px",
      padding: l.padding + "px",
      alignItems: map[l.align],
      justifyContent: map[l.justify],
      flexWrap: l.wrap ? "wrap" : "nowrap",
      boxSizing: "border-box",
    });
  }
  if (n.type === "text") {
    Object.assign(s, {
      color: n.fill,
      // na página exportada, títulos grandes diminuem em telas pequenas (celular)
      fontSize: !opts.editor && flexParent && n.fontSize > 28 ? `clamp(${num(n.fontSize * 0.6)}px, ${num((n.fontSize / 1280) * 180)}vw, ${num(n.fontSize)}px)` : num(n.fontSize) + "px",
      fontFamily: fontStack(n.fontFamily),
      fontWeight: n.bold ? "700" : "400",
      fontStyle: n.italic ? "italic" : "normal",
      lineHeight: n.lineHeight,
      letterSpacing: n.letterSpacing ? num(n.letterSpacing) + "px" : undefined,
      textAlign: n.align,
      whiteSpace: textAuto && !flexParent ? "pre" : "pre-wrap",
      overflowWrap: textAuto && !flexParent ? undefined : "break-word",
      overflow: n.sizing === "fixed" ? "hidden" : undefined,
    });
  }
  return s;
}
export const cssText = (n, parent, opts) => css(styleOf(n, parent, opts));
export const fontStack = (f) => (f === "system-ui" ? "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" : `'${f}',system-ui,sans-serif`);

export function vectorSVG(n, opts = {}) {
  const sw = Math.max(0, n.strokeWidth);
  const stroke = sw > 0 ? `${svgPaint("stroke", n.stroke)} stroke-width="${num(sw)}" stroke-linecap="round" stroke-linejoin="round"` : "";
  let body;
  if (n.type === "boolean") body = booleanBody(n, stroke, opts.prefix || "");
  else {
    const subs = shapeSubpaths(n);
    const open = n.type === "path" && !n.closed;
    body = `<path d="${subpathsToD(subs)}" ${open ? 'fill="none"' : svgPaint("fill", n.fill)} ${stroke}/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${num(n.w)} ${num(n.h)}" preserveAspectRatio="none" style="display:block;overflow:visible">${body}</svg>`;
}
function booleanBody(n, stroke, prefix) {
  const kids = n.children.filter((c) => !c.hidden);
  const d = (list) => subpathsToD(orient(list.flatMap((c) => transformSubpaths(shapeSubpaths(c), c))));
  const fill = svgPaint("fill", n.fill);
  const id = `${prefix}b${n.id}`;
  if (!kids.length) return "";
  if (n.op === "union" || kids.length === 1) return `<path d="${d(kids)}" fill-rule="nonzero" ${fill} ${stroke}/>`;
  if (n.op === "exclude") return `<path d="${d(kids)}" fill-rule="evenodd" ${fill} ${stroke}/>`;
  if (n.op === "subtract")
    return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="-1e5" y="-1e5" width="2e5" height="2e5"><rect x="-1e5" y="-1e5" width="2e5" height="2e5" fill="#fff"/><path d="${d(kids.slice(1))}" fill="#000"/></mask></defs><path d="${d(kids.slice(0, 1))}" mask="url(#${id})" ${fill} ${stroke}/>`;
  // interseção: o primeiro recortado por cada um dos outros
  const clips = kids.slice(1).map((c, i) => `<clipPath id="${id}c${i}"><path d="${d([c])}"/></clipPath>`);
  let inner = `<path d="${d(kids.slice(0, 1))}" ${fill} ${stroke}/>`;
  kids.slice(1).forEach((_, i) => (inner = `<g clip-path="url(#${id}c${i})">${inner}</g>`));
  return `<defs>${clips.join("")}</defs>${inner}`;
}

// opts: { editor, doc, links: Map(frameId -> href), prefix, depth }
export function nodeHTML(n, parent = null, opts = {}) {
  const depth = opts.depth || 0;
  if (depth > 50) return "";
  const s = styleOf(n, parent, opts);
  let inner = "";
  if (n.type === "text") inner = escapeHTML(n.text);
  else if (n.type === "image") inner = n.src ? `<img alt="${escapeHTML(n.name)}" src="${escapeHTML(n.src)}" style="width:100%;height:100%;display:block;object-fit:${n.fit};pointer-events:none" draggable="false">` : "";
  else if (["path", "polygon", "star", "boolean"].includes(n.type)) inner = vectorSVG(n, opts);
  else if (n.type === "instance") {
    const m = opts.doc && findInDoc(opts.doc, n.ref)?.node;
    if (m && depth < 10) {
      Object.assign(s, isFlex(m) ? pick(styleOf({ ...m, x: 0, y: 0, w: n.w, h: n.h, rotation: 0, hidden: n.hidden }, null), ["display", "flexDirection", "gap", "padding", "alignItems", "justifyContent", "flexWrap"]) : {});
      if (m.radius && !n.radius) s.borderRadius = num(m.radius) + "px";
      inner = m.children.map((c) => nodeHTML(c, m, { ...opts, editor: false, inInstance: true, depth: depth + 1, prefix: (opts.prefix || "") + n.id.slice(0, 8) })).join("");
    } else inner = `<div style="width:100%;height:100%;border:1px dashed #e5484d;color:#e5484d;font:12px system-ui;display:grid;place-items:center">Componente removido</div>`;
  }
  if (n.children && n.type !== "boolean") inner += n.children.map((c) => nodeHTML(c, n, { ...opts, depth: depth + 1 })).join("");
  let attrs = opts.editor && !opts.inInstance ? ` data-id="${n.id}" data-type="${n.type}"` : "";
  if (opts.root?.id === n.id && !opts.inInstance) {
    Object.assign(s, opts.root.style);
    attrs += opts.root.attrs || "";
  }
  let tag = "div",
    href = "";
  if (!opts.editor && n.link) {
    const target = opts.links?.get(n.link) ?? (/^https?:/.test(n.link) ? n.link : null);
    if (target) {
      tag = "a";
      href = ` href="${escapeHTML(target)}"${/^https?:/.test(target) ? ' target="_blank" rel="noopener"' : ""}`;
      s.color = s.color || "inherit";
      s.textDecoration = "none";
      if (!s.display) s.display = "block";
    }
  }
  return `<${tag} class="n"${attrs}${href} style="${escapeHTML(css(s))}">${inner}</${tag}>`;
}
export const nodesHTML = (nodes, parent, opts) => nodes.map((n) => nodeHTML(n, parent, opts)).join("");

// ------------------------------------------------------------------ exportar site

export const slug = (s) =>
  String(s || "pagina")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "pagina";

// Pranchetas que viram páginas do site: frames na raiz ou dentro de seções na raiz.
export function artboards(doc) {
  const out = [];
  for (const p of doc.pages)
    for (const n of p.nodes) {
      if (n.type === "frame") out.push({ frame: n, page: p });
      if (n.type === "section") for (const c of n.children) if (c.type === "frame") out.push({ frame: c, page: p });
    }
  return out;
}
export function siteNames(doc) {
  const used = new Set(),
    names = new Map();
  artboards(doc).forEach(({ frame }, i) => {
    let base = i === 0 ? "index" : slug(frame.name),
      name = base,
      k = 2;
    while (used.has(name)) name = `${base}-${k++}`;
    used.add(name);
    names.set(frame.id, name + ".html");
  });
  return names;
}

const BASE_CSS = "*{box-sizing:border-box}html,body{margin:0}.n{margin:0}a.n{color:inherit}img{max-width:none}";
export function exportFrameHTML(doc, frame, opts = {}) {
  const links = opts.links || siteNames(doc);
  const flex = isFlex(frame);
  const root = { ...frame, x: 0, y: 0, rotation: 0, hidden: false };
  // a prancheta é a página: começa em 0,0 e, com layout automático, ocupa a largura da tela
  const override = flex
    ? { position: "relative", left: undefined, top: undefined, width: "100%", maxWidth: num(frame.w) + "px", margin: "0 auto", height: undefined, minHeight: frame.hugHeight ? undefined : num(frame.h) + "px" }
    : { position: "relative", left: undefined, top: undefined, transformOrigin: "0 0" };
  const html = nodeHTML(root, null, { doc, links, editor: false, root: { id: frame.id, style: override, attrs: ' id="pagina"' } });
  const fit = flex
    ? ""
    : `<script>(()=>{const p=document.getElementById("pagina"),w=${num(frame.w)},h=${num(frame.h)};const f=()=>{const s=Math.min(1,innerWidth/w);p.style.transform="scale("+s+")";document.body.style.height=h*s+"px"};addEventListener("resize",f);f()})()</script>`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(frame.name)} · ${escapeHTML(doc.title)}</title>
<style>${BASE_CSS}body{background:${flex ? frame.fill.slice(0, 7) : "#ffffff"};overflow-x:hidden}</style>
</head>
<body>
${html}
${fit}
</body>
</html>
`;
}
export function siteFiles(doc) {
  const links = siteNames(doc);
  return artboards(doc).map(({ frame }) => ({ name: links.get(frame.id), content: exportFrameHTML(doc, frame, { links }) }));
}

// ------------------------------------------------------------------ exportar SVG

// opts.boxOf(id) -> {x,y} posição de um filho de layout automático (o navegador mede);
// opts.measure(text, font) -> largura em px para quebrar linhas do texto.
export function exportSVG(doc, nodes, opts = {}) {
  const boxes = nodes.map((n) => opts.worldBox?.(n.id) || { x: n.x, y: n.y, w: n.w, h: n.h });
  const all = boxes.flatMap((b, i) => samplePoints({ pts: transformSubpaths([{ pts: [P(0, 0), P(nodes[i].w, 0), P(nodes[i].w, nodes[i].h), P(0, nodes[i].h)], closed: true }], { ...nodes[i], x: b.x, y: b.y })[0].pts, closed: false }));
  const b = bounds(all);
  const defs = [];
  const ctx = { ...opts, doc, defs, shadow: false };
  const body = nodes.map((n, i) => nodeSVG({ ...n, x: boxes[i].x - b.x, y: boxes[i].y - b.y }, null, ctx)).join("");
  if (ctx.shadow) defs.push('<filter id="sombra" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity=".27"/></filter>');
  const w = Math.max(1, Math.ceil(b.w)),
    h = Math.max(1, Math.ceil(b.h));
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs.length ? `<defs>${defs.join("")}</defs>` : ""}${body}</svg>`;
}

function wrapText(n, measure) {
  const font = `${n.italic ? "italic " : ""}${n.bold ? "700" : "400"} ${n.fontSize}px ${fontStack(n.fontFamily)}`;
  const width = (t) => (measure ? measure(t, font) : t.length * n.fontSize * 0.55) + Math.max(0, t.length - 1) * (n.letterSpacing || 0);
  const lines = [];
  for (const para of String(n.text).split("\n")) {
    if (n.sizing === "auto" || !para) {
      lines.push(para);
      continue;
    }
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const next = line + word;
      if (line && width(next.trimEnd()) > n.w + 0.5) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

// Posições aproximadas dos filhos de um layout automático (para o SVG feito no servidor,
// onde não há navegador para medir). No editor, as posições vêm do próprio navegador.
export function flexLayout(f) {
  const l = f.layout,
    row = l.mode === "row",
    p = l.padding,
    kids = f.children.filter((c) => !c.hidden);
  const innerMain = (row ? f.w : f.h) - 2 * p,
    innerCross = (row ? f.h : f.w) - 2 * p;
  const sizes = kids.map((c) => ({ main: row ? c.w : c.h, cross: row ? c.h : c.w, grow: c.grow }));
  const fixed = sizes.reduce((s, z) => s + (z.grow && row ? 0 : z.main), 0) + l.gap * Math.max(0, kids.length - 1);
  const growers = sizes.filter((z) => z.grow && row).length;
  sizes.forEach((z) => {
    if (z.grow && row) z.main = Math.max(0, (innerMain - fixed) / growers);
    if ((z.grow && !row) || l.align === "stretch") z.cross = innerCross;
  });
  const total = sizes.reduce((s, z) => s + z.main, 0) + l.gap * Math.max(0, kids.length - 1);
  const free = innerMain - total;
  let at = p + (l.justify === "center" ? free / 2 : l.justify === "end" ? free : 0);
  const between = l.justify === "space-between" && kids.length > 1 ? free / (kids.length - 1) : 0;
  const out = new Map();
  kids.forEach((c, i) => {
    const z = sizes[i];
    const cross = p + (l.align === "center" ? (innerCross - z.cross) / 2 : l.align === "end" ? innerCross - z.cross : 0);
    out.set(c.id, row ? { x: at, y: cross, w: z.main, h: z.cross } : { x: cross, y: at, w: z.cross, h: z.main });
    at += z.main + l.gap + between;
  });
  return out;
}

function nodeSVG(n, parent, ctx, depth = 0) {
  if (n.hidden || depth > 50) return "";
  let pos = { x: n.x, y: n.y };
  if (parent && isFlex(parent)) {
    pos = (ctx.worldBox ? relBox(n, parent, ctx) : flexLayout(parent).get(n.id)) || { ...pos, w: n.w, h: n.h };
    n = { ...n, w: pos.w, h: pos.h };
  }
  const t = [`translate(${num(pos.x)} ${num(pos.y)})`];
  if (n.rotation) t.push(`rotate(${num(n.rotation)} ${num(n.w / 2)} ${num(n.h / 2)})`);
  const attrs = [`transform="${t.join(" ")}"`];
  if (n.opacity !== 1) attrs.push(`opacity="${num(n.opacity)}"`);
  if (n.shadow) {
    ctx.shadow = true;
    attrs.push('filter="url(#sombra)"');
  }
  const sw = n.strokeWidth || 0;
  const strokeAttrs = sw > 0 ? `${svgPaint("stroke", n.stroke)} stroke-width="${num(sw)}"` : "";
  const insetRect = (fill, r) =>
    `<rect x="${num(sw / 2)}" y="${num(sw / 2)}" width="${num(Math.max(0, n.w - sw))}" height="${num(Math.max(0, n.h - sw))}"${r ? ` rx="${num(Math.max(0, r - sw / 2))}"` : ""} ${fill} ${strokeAttrs}/>`;
  const r = Math.min(n.radius || 0, n.w / 2, n.h / 2);
  let inner = "";
  const id = `c${n.id}`;
  if (n.type === "rect") inner = insetRect(svgPaint("fill", n.fill), r);
  else if (n.type === "ellipse") inner = `<ellipse cx="${num(n.w / 2)}" cy="${num(n.h / 2)}" rx="${num(Math.max(0, n.w / 2 - sw / 2))}" ry="${num(Math.max(0, n.h / 2 - sw / 2))}" ${svgPaint("fill", n.fill)} ${strokeAttrs}/>`;
  else if (["path", "polygon", "star"].includes(n.type)) {
    const open = n.type === "path" && !n.closed;
    inner = `<path d="${subpathsToD(shapeSubpaths(n))}" ${open ? 'fill="none"' : svgPaint("fill", n.fill)} ${strokeAttrs}${sw ? ' stroke-linecap="round" stroke-linejoin="round"' : ""}/>`;
  } else if (n.type === "boolean") inner = booleanBody(n, sw > 0 ? `${svgPaint("stroke", n.stroke)} stroke-width="${num(sw)}" stroke-linejoin="round"` : "", "x");
  else if (n.type === "image") {
    if (n.src) {
      ctx.defs.push(`<clipPath id="${id}"><rect width="${num(n.w)}" height="${num(n.h)}"${r ? ` rx="${num(r)}"` : ""}/></clipPath>`);
      const par = { cover: "xMidYMid slice", contain: "xMidYMid meet", fill: "none" }[n.fit];
      inner = `<image href="${escapeHTML(n.src)}" xlink:href="${escapeHTML(n.src)}" width="${num(n.w)}" height="${num(n.h)}" preserveAspectRatio="${par}" clip-path="url(#${id})"/>`;
    }
  } else if (n.type === "text") {
    const lines = wrapText(n, ctx.measure);
    const lh = n.fontSize * n.lineHeight;
    const anchor = { left: "start", center: "middle", right: "end" }[n.align];
    const x = { left: 0, center: n.w / 2, right: n.w }[n.align];
    const first = (lh - n.fontSize) / 2 + n.fontSize * 0.8;
    const tspans = lines.map((l, i) => `<tspan x="${num(x)}" y="${num(first + i * lh)}">${escapeHTML(l) || " "}</tspan>`).join("");
    inner = `<text font-family="${escapeHTML(fontStack(n.fontFamily).replace(/'/g, ""))}" font-size="${num(n.fontSize)}" font-weight="${n.bold ? 700 : 400}"${n.italic ? ' font-style="italic"' : ""}${n.letterSpacing ? ` letter-spacing="${num(n.letterSpacing)}"` : ""} text-anchor="${anchor}" xml:space="preserve" ${svgPaint("fill", n.fill)}>${tspans}</text>`;
  } else if (["frame", "section", "instance"].includes(n.type)) {
    const master = n.type === "instance" ? findInDoc(ctx.doc, n.ref)?.node : null;
    const base = n.type === "instance" ? master || { ...n, children: [], fill: "#ffffff00" } : n;
    const kids = (base.children || []).map((c) => nodeSVG(c, n.type === "instance" ? base : n, n.type === "instance" ? { ...ctx, worldBox: null } : ctx, depth + 1)).join("");
    const clip = n.type !== "section" && (n.type === "instance" || n.clip !== false);
    if (clip) ctx.defs.push(`<clipPath id="${id}"><rect width="${num(n.w)}" height="${num(n.h)}"${r ? ` rx="${num(r)}"` : ""}/></clipPath>`);
    inner = insetRect(svgPaint("fill", base.fill), r) + (kids ? (clip ? `<g clip-path="url(#${id})">${kids}</g>` : kids) : "");
  } else if (n.type === "group") inner = n.children.map((c) => nodeSVG(c, n, ctx, depth + 1)).join("");
  return `<g ${attrs.join(" ")}>${inner}</g>`;
}
function relBox(n, parent, ctx) {
  const a = ctx.worldBox(n.id),
    b = ctx.worldBox(parent.id);
  return a && b ? { x: a.x - b.x, y: a.y - b.y, w: a.w, h: a.h } : null;
}

// ------------------------------------------------------------------ zip (sem compressão, só o necessário)

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function zip(files, date = new Date()) {
  const enc = new TextEncoder();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const parts = [],
    central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.content === "string" ? enc.encode(f.content) : f.content;
    const crc = crc32(data);
    const head = new DataView(new ArrayBuffer(30));
    [
      [0, 0x04034b50, 4],
      [4, 20, 2],
      [6, 0x0800, 2],
      [8, 0, 2],
      [10, dosTime, 2],
      [12, dosDate, 2],
      [14, crc, 4],
      [18, data.length, 4],
      [22, data.length, 4],
      [26, name.length, 2],
      [28, 0, 2],
    ].forEach(([o, v, s]) => (s === 4 ? head.setUint32(o, v, true) : head.setUint16(o, v, true)));
    const cen = new DataView(new ArrayBuffer(46));
    [
      [0, 0x02014b50, 4],
      [4, 20, 2],
      [6, 20, 2],
      [8, 0x0800, 2],
      [10, 0, 2],
      [12, dosTime, 2],
      [14, dosDate, 2],
      [16, crc, 4],
      [20, data.length, 4],
      [24, data.length, 4],
      [28, name.length, 2],
      [30, 0, 2],
      [32, 0, 2],
      [34, 0, 2],
      [36, 0, 2],
      [38, 0, 4],
      [42, offset, 4],
    ].forEach(([o, v, s]) => (s === 4 ? cen.setUint32(o, v, true) : cen.setUint16(o, v, true)));
    parts.push(new Uint8Array(head.buffer), name, data);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cenSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cenSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of all) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// ------------------------------------------------------------------ juntar edições simultâneas
// Quando o editor e um agente mudam o mesmo projeto ao mesmo tempo, aplica o que
// mudou em "mine" (desde "base") por cima de "theirs", camada por camada.
export function mergeDocs(base, mine, theirs) {
  const out = structuredClone(theirs);
  const index = (d) => {
    const m = new Map();
    for (const p of d.pages) walk(p.nodes, (n, parent) => m.set(n.id, { n, parent: parent?.id || null, page: p.id }));
    return m;
  };
  const B = index(base),
    Mi = index(mine);
  const own = (n) => {
    const { children, ...rest } = n;
    return rest;
  };
  if (mine.title !== base.title) out.title = mine.title;
  const pageB = new Map(base.pages.map((p) => [p.id, p]));
  for (const p of mine.pages) {
    const o = out.pages.find((x) => x.id === p.id);
    if (!pageB.has(p.id)) out.pages.push({ ...p, nodes: [] });
    else if (o && p.name !== pageB.get(p.id).name) o.name = p.name;
  }
  const where = (id) => {
    for (const p of out.pages) {
      const l = location(p.nodes, id);
      if (l) return { ...l, page: p };
    }
    return null;
  };
  // apagadas
  for (const id of B.keys()) if (!Mi.has(id)) where(id)?.list.splice(where(id).index, 1);
  // mudadas ou movidas
  for (const [id, m] of Mi) {
    const b = B.get(id);
    if (!b) continue;
    const cur = where(id);
    if (!cur) continue;
    const node = cur.list[cur.index];
    const a = own(m.n),
      z = own(b.n);
    for (const k of new Set([...Object.keys(a), ...Object.keys(z)])) if (JSON.stringify(a[k]) !== JSON.stringify(z[k])) node[k] = structuredClone(a[k]);
    if (m.parent !== b.parent || m.page !== b.page) {
      const dest = m.parent ? where(m.parent) : null;
      const list = dest ? dest.list[dest.index].children : out.pages.find((p) => p.id === m.page)?.nodes;
      if (list && !(dest && find([node], m.parent))) {
        cur.list.splice(cur.index, 1);
        list.push(node);
      }
    }
  }
  // novas (só as de cima; os filhos novos vêm junto)
  for (const [id, m] of Mi) {
    if (B.has(id) || (m.parent && !B.has(m.parent) && Mi.has(m.parent))) continue;
    const prune = (n) => ({ ...n, children: n.children?.filter((c) => !B.has(c.id) || !where(c.id)).map(prune) });
    const n = prune(structuredClone(m.n));
    if (!n.children) delete n.children;
    const dest = m.parent ? where(m.parent) : null;
    const list = dest ? dest.list[dest.index].children : (out.pages.find((p) => p.id === m.page) || out.pages[0]).nodes;
    const siblings = (m.parent ? Mi.get(m.parent).n.children : mine.pages.find((p) => p.id === m.page).nodes) || [];
    list.splice(Math.min(list.length, siblings.findIndex((s) => s.id === id)), 0, n);
  }
  out.pages = out.pages.filter((p) => mine.pages.some((x) => x.id === p.id) || !pageB.has(p.id));
  if (!out.pages.length) out.pages = structuredClone(mine.pages);
  return validate(out);
}
