// Geometria das estrelas/polígonos adaptada de StyloDesigner/lib/shapes.ts (MIT).
export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const fresh = () => ({
  version: 1,
  title: "Sem título",
  pages: [{ id: crypto.randomUUID(), name: "Página 1", nodes: [] }],
});
export function shapePoints(kind, w, h) {
  const n = kind === "star" ? 10 : 5;
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n,
      r = kind === "star" && i % 2 ? 0.45 : 1;
    return `${w / 2 + (Math.cos(a) * w * r) / 2},${h / 2 + (Math.sin(a) * h * r) / 2}`;
  }).join(" ");
}
export function style(n) {
  return {
    left: n.x + "px",
    top: n.y + "px",
    width: n.w + "px",
    height: n.h + "px",
    transform: `rotate(${n.rotation}deg)`,
    opacity: n.opacity,
    background: [
      "line",
      "polygon",
      "star",
      "path",
      "image",
      "group",
      "section",
    ].includes(n.type)
      ? "transparent"
      : n.fill,
    color: n.fill,
    border:
      n.type === "line" || ["path", "polygon", "star", "group"].includes(n.type)
        ? "none"
        : `${n.strokeWidth}px solid ${n.stroke}`,
    borderRadius:
      (n.type === "ellipse" ? 50 : n.radius) +
      (n.type === "ellipse" ? "%" : "px"),
    fontSize: n.fontSize + "px",
    fontFamily: n.fontFamily,
    fontWeight: n.bold ? "700" : "400",
    textAlign: n.align,
    boxShadow: n.shadow ? "0 6px 16px #0004" : "none",
    display: n.hidden ? "none" : "block",
  };
}
export function content(n) {
  const e = escapeHTML;
  if (n.type === "text") return e(n.text);
  if (n.type === "image") return `<img alt="${e(n.name)}" src="${e(n.src)}">`;
  if (["polygon", "star", "path", "line"].includes(n.type)) {
    const attrs = `fill="${n.type === "line" || n.type === "path" ? "none" : e(n.fill)}" stroke="${e(n.stroke)}" stroke-width="${Math.max(1, n.strokeWidth)}" vector-effect="non-scaling-stroke"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n.w} ${n.h}" preserveAspectRatio="none">${n.type === "line" ? `<line x1="0" y1="0" x2="${n.w}" y2="${n.h}" ${attrs}/>` : n.type === "path" ? `<polyline points="${n.points.map((p) => p.join(",")).join(" ")}" ${attrs}/>` : `<polygon points="${shapePoints(n.type, n.w, n.h)}" ${attrs}/>`}</svg>`;
  }
  return "";
}
export function markup(nodes) {
  return nodes
    .map(
      (n) =>
        `<div class="node" data-type="${n.type}" style="${Object.entries(
          style(n),
        )
          .map(
            ([k, v]) =>
              `${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}:${escapeHTML(v)}`,
          )
          .join(";")}">${content(n)}${markup(n.children || [])}</div>`,
    )
    .join("");
}
export function exportHTML(doc, page) {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(doc.title)}</title><style>body{margin:0;background:#fff;position:relative}.node{position:absolute;box-sizing:border-box;white-space:pre-wrap}.node img,.node svg{width:100%;height:100%;display:block;object-fit:cover}</style><body>${markup(page.nodes)}</body></html>`;
}
export function validate(data) {
  if (
    data?.version !== 1 ||
    typeof data.title !== "string" ||
    !Array.isArray(data.pages) ||
    !data.pages.length
  )
    throw Error("Formato inválido: use um JSON do Designer Estudo.");
  let count = 0;
  const ids = new Set();
  const walk = (nodes, depth = 0) => {
    if (!Array.isArray(nodes) || depth > 30) throw Error("Camadas inválidas");
    for (const n of nodes) {
      if (
        ++count > 10000 ||
        !n ||
        typeof n.id !== "string" ||
        ids.has(n.id) ||
        ![
          "frame",
          "section",
          "rect",
          "ellipse",
          "line",
          "polygon",
          "star",
          "text",
          "path",
          "image",
          "group",
        ].includes(n.type)
      )
        throw Error("Camada inválida");
      ids.add(n.id);
      for (const k of [
        "x",
        "y",
        "w",
        "h",
        "rotation",
        "opacity",
        "strokeWidth",
        "radius",
        "fontSize",
      ])
        if (!Number.isFinite(n[k])) throw Error("Geometria inválida");
      if (
        n.w <= 0 ||
        n.h <= 0 ||
        !/^#[a-f\d]{6}$/i.test(n.fill) ||
        !/^#[a-f\d]{6}$/i.test(n.stroke)
      )
        throw Error("Propriedade inválida");
      if (
        typeof n.fontFamily !== "string" ||
        !/^[\w ,\-]+$/.test(n.fontFamily) ||
        !["left", "center", "right"].includes(n.align)
      )
        throw Error("Tipografia inválida");
      if (
        n.type === "image" &&
        !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(n.src)
      )
        throw Error("Imagem inválida");
      if (
        n.type === "path" &&
        (!Array.isArray(n.points) ||
          !n.points.every(
            (p) =>
              Array.isArray(p) && p.length === 2 && p.every(Number.isFinite),
          ))
      )
        throw Error("Vetor inválido");
      if (n.children) walk(n.children, depth + 1);
    }
  };
  for (const p of data.pages) {
    if (typeof p.id !== "string" || typeof p.name !== "string")
      throw Error("Página inválida");
    walk(p.nodes);
  }
  return data;
}
export function find(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    const child = find(n.children || [], id);
    if (child) return child;
  }
  return null;
}
export function location(nodes, id) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return { list: nodes, index: i };
    const hit = location(nodes[i].children || [], id);
    if (hit) return hit;
  }
  return null;
}
