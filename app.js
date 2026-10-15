import {
  fresh,
  style,
  content,
  find,
  location,
  validate,
  exportHTML,
  escapeHTML as esc,
} from "./model.js";
const $ = (s) => document.querySelector(s),
  key = "designer-estudo.v1";
let doc = fresh(),
  pageId,
  selection = [],
  tool = "move",
  view = { x: 80, y: 70, z: 1 },
  past = [],
  future = [],
  gesture = null,
  clipboard = [];
try {
  const saved = localStorage.getItem(key);
  if (saved) doc = validate(JSON.parse(saved));
} catch {
  $("#status").textContent = "Não foi possível restaurar o projeto";
}
pageId = doc.pages[0].id;
const page = () => doc.pages.find((p) => p.id === pageId),
  selected = () =>
    selection.map((id) => find(page().nodes, id)).filter(Boolean);
const tools = [
  ["move", "↖", "Selecionar", "V"],
  ["hand", "✋", "Mão", "H"],
  ["frame", "▣", "Frame", "F"],
  ["section", "▤", "Seção", "S"],
  ["rect", "□", "Retângulo", "R"],
  ["ellipse", "○", "Elipse", "E"],
  ["line", "╱", "Linha", "L"],
  ["polygon", "⬠", "Polígono", ""],
  ["star", "☆", "Estrela", ""],
  ["text", "T", "Texto", "T"],
  ["pen", "✒", "Caneta", "P"],
  ["pencil", "✎", "Lápis", ""],
  ["image", "▧", "Imagem", ""],
];
function status(s) {
  $("#status").textContent = s;
}
function persist() {
  try {
    localStorage.setItem(key, JSON.stringify(doc));
    status("Salvo neste navegador");
  } catch {
    status("Armazenamento cheio: salve o JSON");
  }
}
function checkpoint() {
  past.push(JSON.stringify(doc));
  if (past.length > 80) past.shift();
  future = [];
}
function change(fn) {
  checkpoint();
  fn();
  persist();
  render();
}
function selectTool(t) {
  if (t === "image") return $("#image-file").click();
  tool = t;
  $("#tool-name").textContent = tools.find((x) => x[0] === t)?.[2] || t;
  $("#stage").style.cursor =
    t === "hand" ? "grab" : t === "move" ? "default" : "crosshair";
  $("#toolbar")
    .querySelectorAll("button")
    .forEach((b) => {
      b.classList.toggle("on", b.dataset.tool === tool);
      b.setAttribute("aria-pressed", b.dataset.tool === tool);
    });
}
$("#toolbar").innerHTML = tools
  .map(
    ([id, icon, label, k]) =>
      `<button data-tool="${id}" title="${label}${k ? " (" + k + ")" : ""}" aria-label="${label}">${icon}</button>`,
  )
  .join("");
$("#toolbar").onclick = (e) => {
  const b = e.target.closest("button");
  if (b) selectTool(b.dataset.tool);
};
function make(type, x, y, w = 120, h = 120) {
  return {
    id: crypto.randomUUID(),
    type,
    name: tools.find((t) => t[0] === type)?.[2] || type,
    x,
    y,
    w,
    h,
    rotation: 0,
    opacity: 1,
    fill:
      type === "text" ? "#eeeeee" : type === "frame" ? "#ffffff" : "#a6b5dc",
    stroke: "#222222",
    strokeWidth: type === "line" || type === "path" ? 2 : 0,
    radius: 0,
    fontSize: 24,
    fontFamily: "Arial",
    bold: false,
    align: "left",
    text: "Texto",
    hidden: false,
    locked: false,
    ...(["frame", "section", "group"].includes(type) ? { children: [] } : {}),
  };
}
function drawNodes(nodes, parent) {
  for (const n of nodes) {
    const el = document.createElement("div");
    el.className = "node" + (selection.includes(n.id) ? " selected" : "");
    el.dataset.id = n.id;
    el.dataset.type = n.type;
    Object.assign(el.style, style(n));
    el.innerHTML = content(n);
    if (n.children) drawNodes(n.children, el);
    if (selection.length === 1 && selection[0] === n.id && !n.locked) {
      const handle = document.createElement("i");
      handle.className = "resize";
      el.append(handle);
    }
    parent.append(el);
  }
}
function renderCanvas() {
  const world = $("#world");
  world.replaceChildren();
  world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.z})`;
  drawNodes(page().nodes, world);
  $("#empty").hidden = page().nodes.length > 0;
  $("#zoom").textContent = Math.round(view.z * 100) + "%";
}
function layerRows(nodes, depth = 0) {
  return [...nodes]
    .reverse()
    .map(
      (n) =>
        `<div class="layer ${selection.includes(n.id) ? "selected" : ""}" data-id="${n.id}" style="padding-left:${8 + depth * 14}px"><span>${esc(n.name)}</span><button data-layer="hidden" title="Visibilidade">${n.hidden ? "◌" : "◉"}</button><button data-layer="locked" title="Bloquear">${n.locked ? "▣" : "◇"}</button></div>${layerRows(n.children || [], depth + 1)}`,
    )
    .join("");
}
function render() {
  document.title = doc.title + " — Designer Estudo";
  $("#title").value = doc.title;
  $("#pages").innerHTML = doc.pages
    .map(
      (p) =>
        `<button data-page="${p.id}" class="${p.id === pageId ? "on" : ""}">${esc(p.name)}</button>`,
    )
    .join("");
  $("#layers").innerHTML = layerRows(page().nodes);
  renderCanvas();
  inspector();
}
const field = (label, k, v, type = "number", extra = "") =>
  `<label>${label}<input data-prop="${k}" type="${type}" value="${esc(v)}" ${extra}></label>`;
function inspector() {
  const ns = selected(),
    n = ns[0];
  if (!n) {
    $("#inspector").innerHTML =
      '<p class="hint">Selecione uma camada para editar suas propriedades. Desenhe um frame para começar.</p>';
    return;
  }
  $("#inspector").innerHTML =
    `<input data-prop="name" aria-label="Nome da camada" value="${esc(n.name)}"><p>${ns.length > 1 ? ns.length + " camadas selecionadas" : esc(n.type)}</p><fieldset><legend>Posição e tamanho</legend>${["x", "y", "w", "h", "rotation", "opacity"].map((k) => field({ w: "Largura", h: "Altura", rotation: "Rotação", opacity: "Opacidade" }[k] || k.toUpperCase(), k, n[k], "number", k === "opacity" ? 'min="0" max="1" step="0.05"' : k === "w" || k === "h" ? 'min="1"' : 'step="1"')).join("")}</fieldset><fieldset><legend>Aparência</legend>${field("Preenchimento", "fill", n.fill, "color")}${field("Contorno", "stroke", n.stroke, "color")}${field("Espessura", "strokeWidth", n.strokeWidth, "number", 'min="0"')}${field("Raio", "radius", n.radius, "number", 'min="0"')}<label>Sombra<input data-prop="shadow" type="checkbox" ${n.shadow ? "checked" : ""}></label></fieldset>${n.type === "text" ? `<fieldset><legend>Texto</legend><label><textarea data-prop="text" aria-label="Texto">${esc(n.text)}</textarea></label>${field("Tamanho", "fontSize", n.fontSize, "number", 'min="1"')}<label>Fonte<select data-prop="fontFamily">${["Arial", "Georgia", "Verdana", "Courier New", "system-ui"].map((f) => `<option ${f === n.fontFamily ? "selected" : ""}>${f}</option>`).join("")}</select></label><label>Alinhamento<select data-prop="align">${["left", "center", "right"].map((f) => `<option ${f === n.align ? "selected" : ""}>${f}</option>`).join("")}</select></label><label>Negrito<input data-prop="bold" type="checkbox" ${n.bold ? "checked" : ""}></label></fieldset>` : ""}<fieldset><legend>Organizar</legend><div class="actions">${[
      ["front", "Trazer à frente"],
      ["back", "Enviar atrás"],
      ["duplicate", "Duplicar"],
      ["delete", "Excluir"],
      ["group", "Agrupar"],
      ["ungroup", "Desagrupar"],
      ["alignleft", "Alinhar à esquerda"],
      ["aligntop", "Alinhar ao topo"],
    ]
      .map(([a, b]) => `<button data-action="${a}">${b}</button>`)
      .join("")}</div></fieldset>`;
}
$("#inspector").onchange = (e) => {
  const k = e.target.dataset.prop;
  if (!k) return;
  const input = e.target;
  let value =
    input.type === "checkbox"
      ? input.checked
      : input.type === "number"
        ? Number(input.value)
        : input.value;
  if (
    input.type === "number" &&
    (!Number.isFinite(value) ||
      (["w", "h", "fontSize"].includes(k) && value <= 0))
  )
    return inspector();
  if (k === "opacity") value = Math.max(0, Math.min(1, value));
  if (["radius", "strokeWidth"].includes(k)) value = Math.max(0, value);
  change(() =>
    selected()
      .filter((n) => !n.locked)
      .forEach((n) => (n[k] = value)),
  );
};
$("#title").onchange = (e) =>
  change(() => (doc.title = e.target.value || "Sem título"));
$("#pages").onclick = (e) => {
  const b = e.target.closest("[data-page]");
  if (b) {
    pageId = b.dataset.page;
    selection = [];
    render();
  }
};
$("#layers").onclick = (e) => {
  const row = e.target.closest("[data-id]");
  if (!row) return;
  const id = row.dataset.id,
    prop = e.target.dataset.layer;
  if (prop)
    change(() => {
      const n = find(page().nodes, id);
      n[prop] = !n[prop];
    });
  else {
    selection = e.shiftKey ? [...new Set([...selection, id])] : [id];
    render();
  }
};
$("#layers").ondblclick = (e) => {
  const row = e.target.closest("[data-id]");
  if (!row) return;
  const n = find(page().nodes, row.dataset.id),
    name = prompt("Nome da camada", n.name);
  if (name) change(() => (n.name = name));
};
function point(e) {
  const r = $("#stage").getBoundingClientRect();
  return {
    x: (e.clientX - r.left - view.x) / view.z,
    y: (e.clientY - r.top - view.y) / view.z,
  };
}
let space = false;
$("#stage").onpointerdown = (e) => {
  if (e.button !== 0 && e.button !== 1) return;
  e.preventDefault();
  $("#stage").focus();
  const p = point(e);
  if (tool === "hand" || space || e.button === 1) {
    gesture = { kind: "pan", cx: e.clientX, cy: e.clientY, ...view };
    $("#stage").setPointerCapture(e.pointerId);
    return;
  }
  const target = e.target.closest(".node"),
    n = target && find(page().nodes, target.dataset.id);
  if (tool === "move") {
    if (n) {
      if (!selection.includes(n.id))
        selection = e.shiftKey ? [...selection, n.id] : [n.id];
      if (!n.locked) {
        checkpoint();
        gesture = {
          kind: e.target.classList.contains("resize") ? "resize" : "move",
          start: p,
          nodes: selected()
            .filter((n) => !n.locked)
            .map((n) => ({
              id: n.id,
              x: n.x,
              y: n.y,
              w: n.w,
              h: n.h,
              points: structuredClone(n.points),
            })),
        };
      }
    } else selection = [];
    render();
  } else {
    checkpoint();
    const type = ["pen", "pencil"].includes(tool) ? "path" : tool,
      newNode = make(type, p.x, p.y, 1, 1);
    if (type === "path") newNode.points = [[0, 0]];
    page().nodes.push(newNode);
    selection = [newNode.id];
    gesture = {
      kind: "draw",
      start: p,
      id: newNode.id,
      type,
      raw: [[p.x, p.y]],
    };
    render();
  }
  $("#stage").setPointerCapture(e.pointerId);
};
$("#stage").onpointermove = (e) => {
  if (!gesture) return;
  const g = gesture,
    p = point(e);
  if (g.kind === "pan") {
    view.x = g.x + e.clientX - g.cx;
    view.y = g.y + e.clientY - g.cy;
    renderCanvas();
    return;
  }
  if (g.kind === "move" || g.kind === "resize") {
    for (const old of g.nodes) {
      const n = find(page().nodes, old.id);
      if (g.kind === "move") {
        n.x = old.x + p.x - g.start.x;
        n.y = old.y + p.y - g.start.y;
      } else {
        n.w = Math.max(1, old.w + p.x - g.start.x);
        n.h = Math.max(1, old.h + p.y - g.start.y);
        if (n.points)
          n.points = old.points.map(([x, y]) => [
            (x * n.w) / old.w,
            (y * n.h) / old.h,
          ]);
      }
    }
  } else {
    const n = find(page().nodes, g.id);
    if (g.type === "path") {
      g.raw.push([p.x, p.y]);
      const xs = g.raw.map((p) => p[0]),
        ys = g.raw.map((p) => p[1]);
      n.x = Math.min(...xs);
      n.y = Math.min(...ys);
      n.w = Math.max(1, Math.max(...xs) - n.x);
      n.h = Math.max(1, Math.max(...ys) - n.y);
      n.points = g.raw.map(([x, y]) => [x - n.x, y - n.y]);
    } else {
      let dx = p.x - g.start.x,
        dy = p.y - g.start.y;
      if (e.shiftKey) {
        const s = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * s;
        dy = Math.sign(dy || 1) * s;
      }
      n.x = Math.min(g.start.x, g.start.x + dx);
      n.y = Math.min(g.start.y, g.start.y + dy);
      n.w = Math.max(1, Math.abs(dx));
      n.h = Math.max(1, Math.abs(dy));
      if (g.type === "line") {
        n.x = g.start.x;
        n.y = g.start.y;
        n.w = Math.max(1, Math.hypot(dx, dy));
        n.h = 1;
        n.rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
      }
    }
  }
  renderCanvas();
};
function finish() {
  if (!gesture) return;
  const g = gesture;
  gesture = null;
  if (g.kind === "draw") {
    const n = find(page().nodes, g.id);
    if (n.w < 3 && n.h < 3) {
      n.w = n.type === "frame" ? 320 : 120;
      n.h = n.type === "frame" ? 240 : n.type === "line" ? 1 : 120;
    }
    if (n.type === "text") {
      n.text = prompt("Texto", "Texto") || "Texto";
      n.w = Math.max(n.w, 180);
      n.h = Math.max(n.h, 40);
    }
    if (!["frame", "section"].includes(n.type)) {
      const containers = page().nodes.filter(
        (c) =>
          c !== n &&
          c.type === "frame" &&
          !c.locked &&
          n.x >= c.x &&
          n.y >= c.y &&
          n.x + n.w <= c.x + c.w &&
          n.y + n.h <= c.y + c.h,
      );
      const parent = containers.at(-1);
      if (parent) {
        page().nodes.splice(page().nodes.indexOf(n), 1);
        n.x -= parent.x;
        n.y -= parent.y;
        parent.children.push(n);
      }
    }
    selectTool("move");
  }
  if (g.kind !== "pan") persist();
  render();
}
$("#stage").onpointerup = finish;
$("#stage").onpointercancel = finish;
$("#stage").ondblclick = (e) => {
  const target = e.target.closest(".node");
  const n = target && find(page().nodes, target.dataset.id);
  if (n?.type === "text" && !n.locked) {
    const text = prompt("Editar texto", n.text);
    if (text !== null) change(() => (n.text = text));
  }
};
function zoom(factor) {
  const r = $("#stage").getBoundingClientRect(),
    cx = r.width / 2,
    cy = r.height / 2,
    z = Math.max(0.1, Math.min(4, view.z * factor));
  view.x = cx - ((cx - view.x) * z) / view.z;
  view.y = cy - ((cy - view.y) * z) / view.z;
  view.z = z;
  renderCanvas();
}
$("#stage").addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) zoom(e.deltaY > 0 ? 0.9 : 1.1);
    else {
      view.x -= e.deltaX;
      view.y -= e.deltaY;
      renderCanvas();
    }
  },
  { passive: false },
);
function download(text, type, name) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function cloneNodes(nodes) {
  return nodes.map((n) => ({
    ...structuredClone(n),
    id: crypto.randomUUID(),
    children: n.children ? cloneNodes(n.children) : undefined,
  }));
}
function roots() {
  return selected().filter(
    (n) =>
      !selected().some(
        (other) => other !== n && find(other.children || [], n.id),
      ),
  );
}
function action(a) {
  if (a === "undo" || a === "redo") {
    const from = a === "undo" ? past : future,
      to = a === "undo" ? future : past;
    if (from.length) {
      to.push(JSON.stringify(doc));
      doc = JSON.parse(from.pop());
      if (!doc.pages.some((p) => p.id === pageId)) pageId = doc.pages[0].id;
      selection = [];
      persist();
      render();
    }
    return;
  }
  if (a === "save")
    return download(
      JSON.stringify(doc, null, 2),
      "application/json",
      "designer-estudo.json",
    );
  if (a === "open") return $("#open-file").click();
  if (a === "export")
    return download(exportHTML(doc, page()), "text/html", "design.html");
  if (a === "svg") {
    const w = Math.max(800, ...page().nodes.map((n) => n.x + n.w)),
      h = Math.max(600, ...page().nodes.map((n) => n.y + n.h));
    return download(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${exportHTML(doc, page()).split("<style>")[1].split("</style>")[0]}</style>${exportHTML(doc, page()).split("<body>")[1].replace("</body></html>", "")}</div></foreignObject></svg>`,
      "image/svg+xml",
      "design.svg",
    );
  }
  if (a === "preview") {
    $("#preview iframe").srcdoc = exportHTML(doc, page());
    return $("#preview").showModal();
  }
  if (a === "close-preview") return $("#preview").close();
  if (a === "zoomin") return zoom(1.1);
  if (a === "zoomout") return zoom(0.9);
  if (a === "reset") {
    view = { x: 80, y: 70, z: 1 };
    return renderCanvas();
  }
  if (a === "new") {
    if (confirm("Criar outro projeto? Salve um JSON para guardar o atual."))
      change(() => {
        doc = fresh();
        pageId = doc.pages[0].id;
        selection = [];
      });
    return;
  }
  if (a === "page") {
    const name = prompt("Nome da página", `Página ${doc.pages.length + 1}`);
    if (name)
      change(() => {
        const p = { id: crypto.randomUUID(), name, nodes: [] };
        doc.pages.push(p);
        pageId = p.id;
        selection = [];
      });
    return;
  }
  if (a === "copy") {
    clipboard = cloneNodes(roots());
    return;
  }
  if (a === "paste") {
    if (clipboard.length)
      change(() => {
        const ns = cloneNodes(clipboard);
        ns.forEach((n) => {
          n.x += 20;
          n.y += 20;
          page().nodes.push(n);
        });
        selection = ns.map((n) => n.id);
      });
    return;
  }
  const ns = roots().filter((n) => !n.locked);
  if (!ns.length) return;
  change(() => {
    if (a === "delete") {
      for (const n of ns) {
        const l = location(page().nodes, n.id);
        l.list.splice(l.index, 1);
      }
      selection = [];
    }
    if (a === "duplicate") {
      const copies = [];
      for (const n of ns) {
        const c = cloneNodes([n])[0];
        c.x += 20;
        c.y += 20;
        const l = location(page().nodes, n.id);
        l.list.push(c);
        copies.push(c.id);
      }
      selection = copies;
    }
    if (a === "front" || a === "back") {
      for (const n of ns) {
        const l = location(page().nodes, n.id);
        l.list.splice(l.index, 1);
        a === "front" ? l.list.push(n) : l.list.unshift(n);
      }
    }
    if (a === "alignleft" || a === "aligntop") {
      const lists = ns.map((n) => location(page().nodes, n.id).list);
      if (lists.every((l) => l === lists[0])) {
        const k = a === "alignleft" ? "x" : "y",
          v = Math.min(...ns.map((n) => n[k]));
        ns.forEach((n) => (n[k] = v));
      }
    }
    if (a === "group" && ns.length > 1) {
      const l = location(page().nodes, ns[0].id).list;
      if (ns.every((n) => location(page().nodes, n.id).list === l)) {
        const x = Math.min(...ns.map((n) => n.x)),
          y = Math.min(...ns.map((n) => n.y)),
          w = Math.max(...ns.map((n) => n.x + n.w)) - x,
          h = Math.max(...ns.map((n) => n.y + n.h)) - y,
          g = make("group", x, y, w, h);
        g.name = "Grupo";
        for (const n of ns) {
          l.splice(l.indexOf(n), 1);
          n.x -= x;
          n.y -= y;
          g.children.push(n);
        }
        l.push(g);
        selection = [g.id];
      }
    }
    if (a === "ungroup") {
      for (const n of ns.filter(
        (n) => n.type === "group" && n.rotation === 0,
      )) {
        const l = location(page().nodes, n.id);
        l.list.splice(
          l.index,
          1,
          ...n.children.map((c) => ({ ...c, x: c.x + n.x, y: c.y + n.y })),
        );
      }
      selection = [];
    }
  });
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (b) action(b.dataset.action);
});
$("#open-file").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 30 * 1024 * 1024) throw Error("Arquivo maior que 30 MB");
    const imported = validate(JSON.parse(await file.text()));
    change(() => {
      doc = imported;
      pageId = doc.pages[0].id;
      selection = [];
    });
  } catch (err) {
    alert(err.message);
  }
  e.target.value = "";
};
$("#image-file").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
      file.type,
    ) ||
    file.size > 10 * 1024 * 1024
  ) {
    alert("Use PNG, JPEG, WebP ou GIF de até 10 MB.");
    e.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () =>
      change(() => {
        const n = make(
          "image",
          80,
          80,
          Math.min(img.width, 600),
          img.height * Math.min(1, 600 / img.width),
        );
        n.src = reader.result;
        n.name = file.name;
        page().nodes.push(n);
        selection = [n.id];
      });
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  e.target.value = "";
};
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input,textarea,select") || $("#preview").open) return;
  const mod = e.ctrlKey || e.metaKey,
    k = e.key.toLowerCase();
  if (mod && ["z", "y", "s", "d", "g", "c", "v", "a", "o"].includes(k)) {
    e.preventDefault();
    if (k === "a") {
      selection = page().nodes.map((n) => n.id);
      render();
      return;
    }
    return action(
      {
        z: e.shiftKey ? "redo" : "undo",
        y: "redo",
        s: "save",
        d: "duplicate",
        g: e.shiftKey ? "ungroup" : "group",
        c: "copy",
        v: "paste",
        o: "open",
      }[k],
    );
  }
  if (e.code === "Space") {
    e.preventDefault();
    space = true;
  } else if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    action("delete");
  } else if (e.key === "Escape") {
    selection = [];
    selectTool("move");
    render();
  } else if (e.key.startsWith("Arrow")) {
    e.preventDefault();
    const d = e.shiftKey ? 10 : 1;
    change(() =>
      selected()
        .filter((n) => !n.locked)
        .forEach((n) => {
          n.x += e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
          n.y += e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
        }),
    );
  } else {
    const t = tools.find((t) => t[3].toLowerCase() === k);
    if (t) selectTool(t[0]);
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space") space = false;
});
window.addEventListener("blur", () => {
  space = false;
  finish();
});
selectTool("move");
render();
