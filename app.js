// Editor do Stylo: estado, canvas, ferramentas, painéis e salvamento.
import * as M from "./model.js";
import { icon } from "./icons.js";

const $ = (s, root = document) => root.querySelector(s);
const stage = $("#stage"),
  world = $("#world"),
  overlay = $("#overlay");
const clientId = "editor-" + M.uid().slice(0, 8);

// ------------------------------------------------------------------ estado
let doc = M.fresh(),
  pageId = doc.pages[0].id,
  selection = [],
  tool = "move",
  view = { x: 120, y: 90, z: 1 },
  past = [],
  future = [],
  hover = null,
  editingText = null, // { id, el, before }
  editPath = null, // { id, sel }
  pen = null, // { before, parentId, anchors(mundo), node, closed }
  pencil = null, // pontos do lápis (mundo)
  marquee = null,
  guides = [],
  dropTarget = undefined,
  space = false,
  pointer = { x: 0, y: 0, sx: 0, sy: 0 },
  clipboard = null,
  gestureActive = false;
const collapsed = new Set();

const TOOLS = [
  ["move", "move", "Mover e selecionar", "V"],
  ["hand", "hand", "Mão (ou segure Espaço)", "H"],
  "|",
  ["frame", "frame", "Prancheta", "F"],
  ["section", "section", "Seção", "S"],
  "|",
  ["rect", "rect", "Retângulo", "R"],
  ["ellipse", "ellipse", "Elipse", "E"],
  ["line", "line", "Linha", "L"],
  ["polygon", "polygon", "Polígono", ""],
  ["star", "star", "Estrela", ""],
  "|",
  ["pen", "pen", "Caneta (cliques e curvas)", "P"],
  ["pencil", "pencil", "Lápis (traço livre)", "B"],
  ["text", "text", "Texto", "T"],
  ["image", "image", "Imagem", "I"],
];
const DRAW = ["frame", "section", "rect", "ellipse", "line", "polygon", "star"];

// ------------------------------------------------------------------ ajudantes
const page = () => doc.pages.find((p) => p.id === pageId) || doc.pages[0];
const node = (id) => M.find(page().nodes, id);
const loc = (id) => M.location(page().nodes, id);
const parentOf = (id) => loc(id)?.parent || null;
const sel = () => selection.map(node).filter(Boolean);
const elOf = (id) => world.querySelector(`[data-id="${CSS.escape(id)}"]`);
const snapshot = () => JSON.stringify(doc);
const isArtboard = (n) => {
  if (!n) return false;
  const p = parentOf(n.id);
  return (!p && (n.type === "frame" || n.type === "section")) || (n.type === "frame" && p?.type === "section" && !parentOf(p.id));
};
// só as camadas de cima da seleção (sem filhos de quem já está selecionado)
const roots = (list = sel()) => list.filter((n) => !list.some((o) => o !== n && M.find(o.children || [], n.id)));
const safe = (fn, fallback) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

function toast(msg, bad = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = bad ? "bad" : "";
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), bad ? 6000 : 3200);
}

// ------------------------------------------------------------------ histórico
function commit(before) {
  if (snapshot() === before) return false;
  past.push(before);
  if (past.length > 120) past.shift();
  future = [];
  save();
  return true;
}
function change(fn) {
  const before = snapshot();
  fn();
  commit(before);
  render();
}
function undoRedo(dir) {
  const from = dir === "undo" ? past : future,
    to = dir === "undo" ? future : past;
  if (!from.length) return;
  to.push(snapshot());
  doc = JSON.parse(from.pop());
  if (!doc.pages.some((p) => p.id === pageId)) pageId = doc.pages[0].id;
  selection = selection.filter((id) => node(id));
  editPath = null;
  save();
  render();
}

// ------------------------------------------------------------------ salvar (arquivo no computador ou navegador)
// base = a última versão que sabemos que está no servidor (para juntar edições simultâneas)
const store = { mode: "local", id: null, rev: null, base: null, timer: null, saving: false, again: false, es: null, stale: false };
function status(text, kind = "") {
  const s = $("#status");
  s.textContent = text;
  s.className = kind;
}
async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { "content-type": "application/json", "x-client": clientId, ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || r.statusText), { status: r.status, body: j });
  return j;
}
function save() {
  status("Salvando…", "busy");
  clearTimeout(store.timer);
  store.timer = setTimeout(flush, 350);
}
async function flush() {
  clearTimeout(store.timer);
  if (store.mode === "local") {
    try {
      localStorage.setItem("stylo.local", JSON.stringify(doc));
      status("Salvo só neste navegador", "ok");
    } catch {
      status("Navegador cheio: baixe o .json", "bad");
      toast("O navegador não tem mais espaço. Baixe o projeto em Projetos → Baixar este projeto.", true);
    }
    return;
  }
  if (store.saving) return void (store.again = true);
  store.saving = true;
  store.again = false;
  const sent = snapshot();
  try {
    const r = await api(`/api/projects/${store.id}`, { method: "PUT", body: JSON.stringify({ doc: JSON.parse(sent), rev: store.rev }) });
    store.rev = r.rev;
    store.base = sent;
    status("Salvo no computador", "ok");
  } catch (e) {
    if (e.status === 409) {
      // alguém (um agente ou outra janela) salvou antes: junta as duas versões e salva de novo
      mergeRemote(e.body.doc, e.body.rev);
      store.again = true;
    } else {
      status("Não salvou: " + e.message, "bad");
      store.again = false;
      setTimeout(save, 3000);
    }
  } finally {
    store.saving = false;
    if (store.again) flush();
    else if (store.stale) reloadRemote("outra janela");
  }
}
function setDoc(d) {
  doc = d;
  if (!doc.pages.some((p) => p.id === pageId)) pageId = doc.pages[0].id;
  selection = selection.filter((id) => node(id));
  editPath = null;
  render();
}
async function openProject(id) {
  const { doc: d, rev } = await api(`/api/projects/${id}`);
  store.id = id;
  store.rev = rev;
  store.base = JSON.stringify(d);
  past = [];
  future = [];
  selection = [];
  pageId = d.pages[0].id;
  setDoc(d);
  safe(() => localStorage.setItem("stylo.last", id));
  store.es?.close();
  store.es = new EventSource(`/api/projects/${id}/events`);
  store.es.addEventListener("change", (e) => {
    const { rev: r, by } = JSON.parse(e.data);
    if (by === clientId || r <= store.rev) return;
    if (store.saving || store.timer || gestureActive || editingText || pen) store.stale = true;
    else reloadRemote(by);
  });
  status("Salvo no computador", "ok");
  requestAnimationFrame(() => fit(page().nodes));
}
function mergeRemote(theirs, rev) {
  const mine = snapshot();
  let merged = theirs;
  if (store.base && mine !== store.base) merged = safe(() => M.mergeDocs(JSON.parse(store.base), JSON.parse(mine), theirs), theirs);
  store.rev = rev;
  store.base = JSON.stringify(theirs);
  setDoc(merged);
}
async function reloadRemote(by) {
  store.stale = false;
  const { doc: d, rev } = await api(`/api/projects/${store.id}`);
  if (rev <= store.rev) return;
  past.push(snapshot());
  const pending = store.base && snapshot() !== store.base;
  mergeRemote(d, rev);
  if (pending) save();
  toast(by === "agente" ? "Um agente mudou o projeto. Você já está vendo a versão nova (Ctrl+Z desfaz)." : "O projeto foi atualizado em outra janela.");
}
async function createProject(title, data) {
  const r = await api("/api/projects", { method: "POST", body: JSON.stringify(data ? { doc: data } : { title }) });
  await openProject(r.id);
}
async function boot() {
  try {
    await api("/api/health");
    store.mode = "server";
  } catch {
    store.mode = "local";
  }
  if (store.mode === "server") {
    const last = safe(() => localStorage.getItem("stylo.last"));
    try {
      if (!last) throw 0;
      await openProject(last);
    } catch {
      const list = await api("/api/projects");
      // traz o projeto que estava só no navegador (versão antiga) para um arquivo
      const old = safe(() => localStorage.getItem("stylo.local") || localStorage.getItem("designer-estudo.v1"));
      if (!list.length && old) {
        try {
          await createProject("", M.validate(JSON.parse(old)));
          toast("Seu projeto que estava no navegador agora está salvo em arquivo.");
          return;
        } catch {
          /* segue */
        }
      }
      if (list.length) await openProject(list[0].id);
      else await createProject("Meu primeiro projeto");
    }
  } else {
    const saved = safe(() => localStorage.getItem("stylo.local") || localStorage.getItem("designer-estudo.v1"));
    if (saved) doc = safe(() => M.validate(JSON.parse(saved)), doc);
    pageId = doc.pages[0].id;
    status("Sem servidor: salvando só no navegador", "bad");
    render();
    requestAnimationFrame(() => fit(page().nodes));
  }
}

// ------------------------------------------------------------------ coordenadas
function toWorld(e) {
  const r = stage.getBoundingClientRect();
  return { x: (e.clientX - r.left - view.x) / view.z, y: (e.clientY - r.top - view.y) / view.z };
}
const toScreen = (x, y) => ({ x: view.x + x * view.z, y: view.y + y * view.z });

// Caixa de uma camada no mundo, sem rotação (x, y = canto antes de girar).
function worldBox(id) {
  const chain = M.ancestors(page().nodes, id);
  if (!chain.length) return null;
  let ox = 0,
    oy = 0,
    box = null;
  chain.forEach((n, i) => {
    const parent = chain[i - 1];
    let x = ox + n.x,
      y = oy + n.y,
      w = n.w,
      h = n.h;
    const el = (parent && M.isFlex(parent)) || n.type === "text" || (M.isFlex(n) && (n.hugHeight || n.hugWidth)) ? elOf(n.id) : null;
    if (el) {
      if (parent && M.isFlex(parent)) {
        x = ox + el.offsetLeft;
        y = oy + el.offsetTop;
      }
      w = el.offsetWidth || w;
      h = el.offsetHeight || h;
    }
    box = { x, y, w, h, rotation: n.rotation || 0 };
    ox = x;
    oy = y;
  });
  return box;
}
const originOf = (parentId) => (parentId ? worldBox(parentId) : { x: 0, y: 0 });
function corners(b) {
  const a = (b.rotation * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a),
    cx = b.x + b.w / 2,
    cy = b.y + b.h / 2;
  return [
    [-b.w / 2, -b.h / 2],
    [b.w / 2, -b.h / 2],
    [b.w / 2, b.h / 2],
    [-b.w / 2, b.h / 2],
  ].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}
const aabb = (b) => M.bounds(corners(b));
const union = (boxes) => M.bounds(boxes.flatMap((b) => [[b.x, b.y], [b.x + b.w, b.y + b.h]]));
const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const contains = (a, b) => b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;

// ------------------------------------------------------------------ desenhar o canvas
function render() {
  renderChrome();
  renderPages();
  renderLayers();
  renderComponents();
  renderCanvas();
  renderInspector();
}
function renderChrome() {
  if (document.activeElement !== $("#title")) $("#title").value = doc.title;
  document.title = `${doc.title} · Stylo`;
  $('[data-action="undo"]').disabled = !past.length;
  $('[data-action="redo"]').disabled = !future.length;
}
function renderCanvas() {
  if (editingText) return drawOverlay();
  world.innerHTML = M.nodesHTML(page().nodes, null, { editor: true, doc });
  syncSizes();
  $("#empty").hidden = page().nodes.length > 0;
  moveView();
}
function moveView() {
  world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.z})`;
  $("#zoom").textContent = Math.round(view.z * 100) + "%";
  drawRulers();
  drawOverlay();
}
// Texto com tamanho automático: guarda no projeto o tamanho que o navegador mediu.
function syncSizes() {
  M.walk(page().nodes, (n) => {
    if (n.type !== "text" && !(M.isFlex(n) && (n.hugHeight || n.hugWidth))) return;
    const el = elOf(n.id);
    if (!el) return;
    if (M.isFlex(n) && n.hugWidth && Math.abs(el.offsetWidth - n.w) > 0.5) n.w = el.offsetWidth;
    if (n.type === "text" && n.sizing === "auto" && Math.abs(el.offsetWidth - n.w) > 0.5) n.w = el.offsetWidth;
    if ((n.type === "text" ? n.sizing !== "fixed" : n.hugHeight) && Math.abs(el.offsetHeight - n.h) > 0.5) n.h = el.offsetHeight;
  });
}
// Atualiza só uma camada durante um gesto (bem mais rápido que redesenhar tudo).
function patchNode(n) {
  const el = elOf(n.id);
  if (!el) return;
  el.style.cssText = M.cssText(n, parentOf(n.id), { doc });
  if (["path", "polygon", "star", "boolean"].includes(n.type)) el.innerHTML = M.vectorSVG(n);
}

// ------------------------------------------------------------------ camada de seleção (por cima do canvas)
function boxHTML(b, cls, inner = "") {
  const p = toScreen(b.x, b.y);
  return `<div class="${cls}" style="left:${p.x}px;top:${p.y}px;width:${b.w * view.z}px;height:${b.h * view.z}px;${b.rotation ? `transform:rotate(${b.rotation}deg);` : ""}">${inner}</div>`;
}
function drawOverlay() {
  let html = "",
    svg = "";
  const z = view.z;
  // nomes das pranchetas (arraste para mover a prancheta inteira)
  for (const n of page().nodes) {
    const boards = n.type === "section" ? [n, ...n.children.filter((c) => c.type === "frame")] : n.type === "frame" ? [n] : [];
    for (const b of boards) {
      if (b.hidden) continue;
      const wb = worldBox(b.id);
      if (!wb) continue;
      const p = toScreen(wb.x, wb.y);
      html += `<div class="board-label${selection.includes(b.id) ? " on" : ""}${b.component ? " comp" : ""}" data-label="${b.id}" style="left:${p.x}px;top:${p.y}px;max-width:${Math.max(40, wb.w * z)}px">${b.component ? "◇ " : ""}${M.escapeHTML(b.name)}</div>`;
    }
  }
  if (hover && !selection.includes(hover) && !gestureActive) {
    const b = worldBox(hover);
    if (b) html += boxHTML(b, "hover-box");
  }
  if (dropTarget) {
    const b = worldBox(dropTarget);
    if (b) html += boxHTML({ ...aabb(b), rotation: 0 }, "drop-box");
  }
  const items = sel();
  const editingPath = editPath && node(editPath.id);
  if (items.length && !editingPath) {
    const boxes = items.map((n) => worldBox(n.id)).filter(Boolean);
    if (items.length > 1) boxes.forEach((b) => (html += boxHTML(b, "sel-box ghost")));
    const single = items.length === 1;
    const b = single ? boxes[0] : { ...union(boxes.map(aabb)), rotation: 0 };
    if (b) {
      const locked = items.every((n) => n.locked) || editingText;
      const canResize = !locked && !(single && M.isFlex(parentOf(items[0].id)) && false);
      let inner = "";
      if (canResize && !editingText) {
        const W = b.w * z,
          H = b.h * z;
        const pts = { nw: [0, 0], n: [W / 2, 0], ne: [W, 0], e: [W, H / 2], se: [W, H], s: [W / 2, H], sw: [0, H], w: [0, H / 2] };
        const cur = { nw: "nwse", se: "nwse", ne: "nesw", sw: "nesw", n: "ns", s: "ns", e: "ew", w: "ew" };
        const small = W < 24 || H < 24;
        for (const k of ["nw", "ne", "se", "sw"]) {
          const [x, y] = pts[k];
          inner += `<i class="handle rot" data-handle="rot" style="left:${x + (k.includes("w") ? -10 : 10)}px;top:${y + (k.includes("n") ? -10 : 10)}px"></i>`;
        }
        for (const [k, [x, y]] of Object.entries(pts)) {
          const edge = k.length === 1;
          if (edge && small) continue;
          inner += `<i class="handle${edge ? " edge" : ""}" data-handle="${k}" style="left:${x}px;top:${y}px;${edge ? (k === "n" || k === "s" ? `width:${Math.max(0, W - 16)}px;height:8px;margin:-4px 0 0 -${Math.max(0, W - 16) / 2}px;` : `width:8px;height:${Math.max(0, H - 16)}px;margin:-${Math.max(0, H - 16) / 2}px 0 0 -4px;`) : ""}cursor:${rotCursor(cur[k], b.rotation)}-resize"></i>`;
        }
      }
      const tag = `<span class="size-tag" style="left:${(b.w * z) / 2}px;top:${b.h * z}px${b.rotation ? `;transform:translate(-50%,8px) rotate(${-b.rotation}deg)` : ""}">${Math.round(b.w)} × ${Math.round(b.h)}</span>`;
      html += boxHTML(b, "sel-box", inner + tag);
    }
  }
  if (marquee) html += boxHTML({ ...marquee, rotation: 0 }, "marquee");
  for (const g of guides) {
    const a = toScreen(g[0], g[1]),
      c = toScreen(g[2], g[3]);
    svg += `<line class="guide" x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}"/>`;
  }
  // caneta: prévia do próximo trecho e pontos
  if (pen?.anchors.length) {
    const A = pen.anchors;
    const last = A[A.length - 1];
    const p0 = toScreen(last[0], last[1]),
      c1 = toScreen(last[0] + last[4], last[1] + last[5]),
      pt = toScreen(pointer.x, pointer.y);
    if (!gestureActive) svg += `<path class="pen-line" d="M${p0.x} ${p0.y}C${c1.x} ${c1.y} ${pt.x} ${pt.y} ${pt.x} ${pt.y}" stroke-dasharray="4 3"/>`;
    A.forEach((a, i) => {
      const s = toScreen(a[0], a[1]);
      if (a[4] || a[5]) {
        const o = toScreen(a[0] + a[4], a[1] + a[5]),
          n = toScreen(a[0] + a[2], a[1] + a[3]);
        svg += `<line class="hdl-line" x1="${n.x}" y1="${n.y}" x2="${o.x}" y2="${o.y}"/><circle class="hdl" r="3" cx="${o.x}" cy="${o.y}"/><circle class="hdl" r="3" cx="${n.x}" cy="${n.y}"/>`;
      }
      svg += `<rect class="anchor${i === 0 && A.length > 1 ? " on" : ""}" x="${s.x - 3.5}" y="${s.y - 3.5}" width="7" height="7"/>`;
    });
  }
  if (pencil?.length > 1) svg += `<polyline class="pen-line" points="${pencil.map(([x, y]) => Object.values(toScreen(x, y)).join(",")).join(" ")}"/>`;
  // edição de pontos de um vetor
  if (editingPath) {
    const n = editingPath,
      b = worldBox(n.id);
    const W = (x, y) => {
      const p = localToWorld(b, x, y);
      return toScreen(p.x, p.y);
    };
    html += boxHTML(b, "sel-box ghost");
    n.points.forEach(([x, y, ix, iy, ox, oy], i) => {
      const s = W(x, y);
      for (const [hx, hy, k] of [
        [ix, iy, "in"],
        [ox, oy, "out"],
      ]) {
        if (!hx && !hy) continue;
        const h = W(x + hx, y + hy);
        svg += `<line class="hdl-line" x1="${s.x}" y1="${s.y}" x2="${h.x}" y2="${h.y}"/><circle class="hdl" data-hdl="${i}:${k}" r="4" cx="${h.x}" cy="${h.y}"/>`;
      }
    });
    n.points.forEach(([x, y], i) => {
      const s = W(x, y);
      svg += `<rect class="anchor${editPath.sel === i ? " on" : ""}" data-anchor="${i}" x="${s.x - 4}" y="${s.y - 4}" width="8" height="8"/>`;
    });
  }
  overlay.innerHTML = html + `<svg class="ov-svg">${svg}</svg>`;
}
function rotCursor(base, r) {
  const order = ["ns", "nesw", "ew", "nwse"];
  const steps = Math.round((((r % 180) + 180) % 180) / 45);
  return order[(order.indexOf(base) + steps) % 4];
}
function localToWorld(b, x, y) {
  const a = (b.rotation * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a),
    dx = x - b.w / 2,
    dy = y - b.h / 2;
  return { x: b.x + b.w / 2 + dx * c - dy * s, y: b.y + b.h / 2 + dx * s + dy * c };
}
function worldToLocal(b, x, y) {
  const a = (-b.rotation * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a),
    dx = x - b.x - b.w / 2,
    dy = y - b.y - b.h / 2;
  return { x: b.w / 2 + dx * c - dy * s, y: b.h / 2 + dx * s + dy * c };
}

// ------------------------------------------------------------------ réguas
function drawRulers() {
  const dpr = devicePixelRatio || 1;
  const sel0 = sel().length ? union(sel().map((n) => worldBox(n.id)).filter(Boolean).map(aabb)) : null;
  const style = getComputedStyle(document.documentElement);
  const text = style.getPropertyValue("--text-3").trim(),
    accent = style.getPropertyValue("--accent").trim();
  for (const [id, horiz] of [
    ["#ruler-x", true],
    ["#ruler-y", false],
  ]) {
    const c = $(id);
    const W = c.clientWidth,
      H = c.clientHeight;
    if (c.width !== W * dpr || c.height !== H * dpr) {
      c.width = W * dpr;
      c.height = H * dpr;
    }
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const off = 20,
      origin = horiz ? view.x - off : view.y - off;
    const step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000].find((s) => s * view.z >= 64) || 10000;
    if (sel0) {
      g.fillStyle = accent + "33";
      const a = origin + (horiz ? sel0.x : sel0.y) * view.z,
        b = (horiz ? sel0.w : sel0.h) * view.z;
      horiz ? g.fillRect(a, 0, b, H) : g.fillRect(0, a, W, b);
    }
    g.strokeStyle = text;
    g.fillStyle = text;
    g.font = "9.5px system-ui";
    g.lineWidth = 1;
    const len = horiz ? W : H;
    const first = Math.floor(-origin / view.z / step) * step;
    for (let v = first; origin + v * view.z < len; v += step / 5) {
      const pos = Math.round(origin + v * view.z) + 0.5;
      const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
      g.beginPath();
      if (horiz) {
        g.moveTo(pos, major ? 4 : 14);
        g.lineTo(pos, 20);
      } else {
        g.moveTo(major ? 4 : 14, pos);
        g.lineTo(20, pos);
      }
      g.stroke();
      if (major) {
        const label = String(Math.round(v));
        if (horiz) g.fillText(label, pos + 3, 10);
        else {
          g.save();
          g.translate(10, pos - 3);
          g.rotate(-Math.PI / 2);
          g.fillText(label, 0, 0);
          g.restore();
        }
      }
    }
  }
}

// ------------------------------------------------------------------ zoom e enquadrar
function zoomAt(factor, sx, sy) {
  const r = stage.getBoundingClientRect();
  if (sx === undefined) {
    sx = r.width / 2;
    sy = r.height / 2;
  }
  const z = Math.max(0.02, Math.min(64, view.z * factor));
  view.x = sx - ((sx - view.x) * z) / view.z;
  view.y = sy - ((sy - view.y) * z) / view.z;
  view.z = z;
  moveView();
}
function fit(list) {
  const boxes = list.map((n) => worldBox(n.id)).filter(Boolean).map(aabb);
  if (!boxes.length) {
    view = { x: 120, y: 90, z: 1 };
    return moveView();
  }
  const b = union(boxes),
    r = stage.getBoundingClientRect();
  const z = Math.min(4, Math.max(0.02, Math.min((r.width - 140) / Math.max(b.w, 1), (r.height - 160) / Math.max(b.h, 1))));
  view = { z, x: (r.width - b.w * z) / 2 - b.x * z + 10, y: (r.height - b.h * z) / 2 - b.y * z - 20 };
  moveView();
}

// ------------------------------------------------------------------ encaixe (snap)
function snapLines(excludeIds) {
  const skip = new Set();
  for (const id of excludeIds) {
    const n = node(id);
    if (n) M.walk([n], (x) => skip.add(x.id));
  }
  const xs = [],
    ys = [];
  const add = (n) => {
    if (skip.has(n.id) || n.hidden) return;
    const b = worldBox(n.id);
    if (!b) return;
    const a = aabb(b);
    xs.push({ v: a.x, b: a }, { v: a.x + a.w / 2, b: a }, { v: a.x + a.w, b: a });
    ys.push({ v: a.y, b: a }, { v: a.y + a.h / 2, b: a }, { v: a.y + a.h, b: a });
  };
  const parents = new Set(excludeIds.map((id) => parentOf(id)?.id ?? null));
  for (const pid of parents) {
    const list = pid ? node(pid)?.children || [] : page().nodes;
    list.forEach(add);
    if (pid) add(node(pid));
  }
  page().nodes.forEach(add);
  return { xs, ys };
}
function snapBox(b, lines, which = { x: [0, 0.5, 1], y: [0, 0.5, 1] }) {
  const thr = 6 / view.z;
  let best = { dx: 0, dy: 0, gx: null, gy: null };
  let mx = thr,
    my = thr;
  for (const f of which.x)
    for (const l of lines.xs) {
      const d = l.v - (b.x + b.w * f);
      if (Math.abs(d) < mx) {
        mx = Math.abs(d);
        best.dx = d;
        best.gx = l;
      }
    }
  for (const f of which.y)
    for (const l of lines.ys) {
      const d = l.v - (b.y + b.h * f);
      if (Math.abs(d) < my) {
        my = Math.abs(d);
        best.dy = d;
        best.gy = l;
      }
    }
  const g = [];
  const nb = { x: b.x + best.dx, y: b.y + best.dy, w: b.w, h: b.h };
  if (best.gx) g.push([best.gx.v, Math.min(nb.y, best.gx.b.y), best.gx.v, Math.max(nb.y + nb.h, best.gx.b.y + best.gx.b.h)]);
  if (best.gy) g.push([Math.min(nb.x, best.gy.b.x), best.gy.v, Math.max(nb.x + nb.w, best.gy.b.x + best.gy.b.w), best.gy.v]);
  return { dx: best.dx, dy: best.dy, guides: g };
}

// ------------------------------------------------------------------ escolher camada pelo clique
function hitChain(e) {
  const el = e.target.closest?.("[data-id]");
  if (!el || !world.contains(el)) return [];
  return M.ancestors(page().nodes, el.dataset.id).filter((n) => !n.hidden);
}
function pickTarget(e, deep = e.ctrlKey || e.metaKey) {
  const chain = hitChain(e);
  if (!chain.length) return null;
  const free = chain.filter((n) => !n.locked);
  if (!free.length) return null;
  if (deep) return free[free.length - 1];
  // continua no mesmo nível da seleção atual (ex.: dentro de um grupo)
  const ctx = selection.length ? parentOf(selection[0])?.id : undefined;
  if (ctx) {
    const i = chain.findIndex((n) => n.id === ctx);
    if (i >= 0 && chain[i + 1] && !chain[i + 1].locked) return chain[i + 1];
  }
  // padrão: o filho direto da prancheta
  let k = chain.findIndex((n) => isArtboard(n));
  while (k >= 0 && chain[k + 1] && isArtboard(chain[k + 1])) k++;
  const pick = k >= 0 ? chain[k + 1] || chain[k] : chain[0];
  return pick.locked ? free[free.length - 1] : pick;
}
// prancheta/seção mais funda sob o ponto (onde algo novo é criado ou solto)
function containerAt(p, exclude = []) {
  const skip = new Set();
  exclude.forEach((id) => M.walk([node(id)].filter(Boolean), (n) => skip.add(n.id)));
  let found = null;
  const look = (list) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i];
      if (skip.has(n.id) || n.hidden || n.locked || !(n.type === "frame" || n.type === "section")) continue;
      const b = worldBox(n.id);
      if (b && !b.rotation && contains(b, { x: p.x, y: p.y, w: 0, h: 0 })) {
        found = n;
        look(n.children);
        return;
      }
    }
  };
  look(page().nodes);
  return found;
}
function insertInto(n, parent, index) {
  const list = parent ? parent.children : page().nodes;
  list.splice(index ?? list.length, 0, n);
}
function removeNode(id) {
  const l = loc(id);
  if (l) l.list.splice(l.index, 1);
}

// ------------------------------------------------------------------ gestos
function track(onMove, onUp) {
  gestureActive = true;
  const move = (e) => {
    pointer = { ...toWorld(e), sx: e.clientX, sy: e.clientY };
    onMove(e);
  };
  const up = (e) => {
    removeEventListener("pointermove", move);
    removeEventListener("pointerup", up);
    removeEventListener("pointercancel", up);
    gestureActive = false;
    onUp(e);
    if (store.stale && !store.saving && !store.timer) reloadRemote("outra janela");
  };
  addEventListener("pointermove", move);
  addEventListener("pointerup", up);
  addEventListener("pointercancel", up);
}

stage.addEventListener("pointerdown", (e) => {
  const p = toWorld(e);
  pointer = { ...p, sx: e.clientX, sy: e.clientY };
  if (editingText) {
    if (editingText.el.contains(e.target)) return;
    finishText();
    if (tool === "move") return;
  }
  closeMenus();
  if (e.button === 1 || (e.button === 0 && (tool === "hand" || space))) return startPan(e);
  if (e.button !== 0) return;
  e.preventDefault();
  stage.focus({ preventScroll: true });
  if (isDouble(e) && onDouble(e)) return;
  const t = e.target;
  if (editPath) {
    const a = t.closest("[data-anchor]"),
      h = t.closest("[data-hdl]");
    if (a || h) return startPointDrag(e, a ? +a.dataset.anchor : +h.dataset.hdl.split(":")[0], h ? h.dataset.hdl.split(":")[1] : null);
    const hit = hitChain(e).pop();
    if (hit?.id === editPath.id) return;
    editPath = null;
  }
  const handle = t.closest("[data-handle]");
  if (handle) return handle.dataset.handle === "rot" ? startRotate(e, p) : startResize(e, p, handle.dataset.handle);
  if (tool === "pen") return penDown(e, p);
  if (tool === "pencil") return startPencil(e, p);
  if (tool === "text") return startTextTool(e, p);
  if (DRAW.includes(tool)) return startDraw(e, p);
  const label = t.closest("[data-label]");
  if (label) {
    const id = label.dataset.label;
    if (e.shiftKey) selection = selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id];
    else if (!selection.includes(id)) selection = [id];
    render();
    return startMove(e, p, selection);
  }
  const target = pickTarget(e);
  if (target && !(isArtboard(target) && target.children?.length && !e.ctrlKey && !e.metaKey && !selection.includes(target.id))) {
    if (e.shiftKey) {
      selection = selection.includes(target.id) ? selection.filter((id) => id !== target.id) : [...selection, target.id];
      return render();
    }
    if (!selection.includes(target.id)) {
      selection = [target.id];
      render();
    }
    return startMove(e, p, selection);
  }
  // espaço vazio (ou fundo de prancheta com conteúdo): seleção por caixa
  startMarquee(e, p, target && isArtboard(target) ? target : null);
});

stage.addEventListener("pointermove", (e) => {
  if (gestureActive) return;
  pointer = { ...toWorld(e), sx: e.clientX, sy: e.clientY };
  $("#coords").textContent = `${Math.round(pointer.x)}, ${Math.round(pointer.y)}`;
  if (pen) return drawOverlay();
  const h = tool === "move" && !editPath ? pickTarget(e)?.id || null : null;
  if (h !== hover) {
    hover = h;
    drawOverlay();
  }
});
stage.addEventListener("pointerleave", () => {
  if (hover) {
    hover = null;
    drawOverlay();
  }
});

function startPan(e) {
  e.preventDefault();
  const start = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  stage.classList.add("grabbing");
  track(
    (ev) => {
      view.x = start.vx + ev.clientX - start.x;
      view.y = start.vy + ev.clientY - start.y;
      moveView();
    },
    () => stage.classList.remove("grabbing"),
  );
}

function startMove(e, p, ids) {
  const before = snapshot();
  let moving = roots(ids.map(node).filter(Boolean)).filter((n) => !n.locked);
  if (!moving.length) return;
  const start = { x: e.clientX, y: e.clientY };
  let started = false,
    list,
    box0,
    lines;
  const prepare = () => {
    list = moving.map((n) => ({ n, x0: n.x, y0: n.y, box: worldBox(n.id), flex: M.isFlex(parentOf(n.id)) }));
    box0 = union(list.map((i) => aabb(i.box)));
    lines = snapLines(moving.map((n) => n.id));
  };
  track(
    (ev) => {
      if (!started) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 3) return;
        started = true;
        hover = null;
        if (ev.altKey) {
          // Alt + arrastar: duplica e move a cópia
          const copies = moving.map((n) => {
            const c = M.cloneTree(n);
            c.component = false;
            const l = loc(n.id);
            l.list.splice(l.index + 1, 0, c);
            return c;
          });
          moving = copies;
          selection = copies.map((c) => c.id);
          renderCanvas();
        }
        prepare();
      }
      const q = toWorld(ev);
      let dx = q.x - p.x,
        dy = q.y - p.y;
      if (ev.shiftKey) Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0);
      const s = snapBox({ ...box0, x: box0.x + dx, y: box0.y + dy }, lines);
      if (!ev.shiftKey || dx) dx += s.dx;
      if (!ev.shiftKey || dy) dy += s.dy;
      guides = s.guides;
      for (const it of list) {
        if (it.flex) elOf(it.n.id).style.translate = `${dx}px ${dy}px`;
        else {
          it.n.x = Math.round(it.x0 + dx);
          it.n.y = Math.round(it.y0 + dy);
          patchNode(it.n);
        }
      }
      list.delta = { dx, dy };
      const target = moving.some(isArtboard) ? undefined : containerAt(q, moving.map((n) => n.id));
      dropTarget = target ? target.id : undefined;
      drawOverlay();
      drawRulers();
    },
    (ev) => {
      guides = [];
      const target = dropTarget;
      dropTarget = undefined;
      if (!started) {
        // clique simples numa camada já selecionada entre várias: seleciona só ela
        if (!e.shiftKey && selection.length > 1) {
          const t = pickTarget(e);
          if (t) selection = [t.id];
        }
        return render();
      }
      const q = toWorld(ev);
      const { dx, dy } = list.delta || { dx: 0, dy: 0 };
      if (!moving.some(isArtboard)) {
        const dest = target ? node(target) : null;
        for (const it of list) {
          const cur = parentOf(it.n.id);
          if ((cur?.id ?? null) === (dest?.id ?? null) && !M.isFlex(dest)) continue;
          if (cur && cur.type === "group") continue; // grupos mantêm os filhos
          const wx = it.box.x + dx,
            wy = it.box.y + dy;
          removeNode(it.n.id);
          let index;
          if (M.isFlex(dest)) {
            const row = dest.layout.mode === "row";
            const kids = dest.children.map((c) => ({ c, b: worldBox(c.id) })).filter((k) => k.b);
            index = kids.findIndex((k) => (row ? k.b.x + k.b.w / 2 > q.x : k.b.y + k.b.h / 2 > q.y));
            index = index < 0 ? dest.children.length : dest.children.indexOf(kids[index].c);
          } else {
            const o = originOf(dest?.id);
            it.n.x = Math.round(wx - o.x);
            it.n.y = Math.round(wy - o.y);
          }
          insertInto(it.n, dest, index);
        }
      }
      commit(before);
      render();
    },
  );
}

function startMarquee(e, p, board) {
  const base = e.shiftKey ? [...selection] : [];
  let moved = false;
  track(
    (ev) => {
      const q = toWorld(ev);
      if (!moved && Math.hypot(q.x - p.x, q.y - p.y) * view.z < 3) return;
      moved = true;
      marquee = { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), w: Math.abs(q.x - p.x), h: Math.abs(q.y - p.y) };
      const cands = board ? board.children : page().nodes;
      const hits = cands
        .filter((n) => !n.hidden && !n.locked)
        .filter((n) => {
          const b = worldBox(n.id);
          if (!b) return false;
          const a = aabb(b);
          return isArtboard(n) ? contains(marquee, a) : intersects(marquee, a);
        })
        .map((n) => n.id);
      selection = [...new Set([...base, ...hits])];
      drawOverlay();
    },
    () => {
      if (!moved) selection = board ? [board.id] : base;
      marquee = null;
      render();
    },
  );
}

function startResize(e, p, handle) {
  const before = snapshot();
  const items = sel().filter((n) => !n.locked);
  if (!items.length) return;
  const hx = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0;
  const hy = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0;
  const single = items.length === 1;
  const n0 = single ? structuredClone(items[0]) : null;
  const b0 = single ? worldBox(items[0].id) : null;
  const multi = single ? null : items.map((n) => ({ n, c: structuredClone(n), b: worldBox(n.id), o: originOf(parentOf(n.id)?.id) }));
  const U = single ? null : union(multi.map((m) => aabb(m.b)));
  const lines = snapLines(items.map((n) => n.id));
  const rerender = items.some((n) => ["group", "boolean", "instance"].includes(n.type) || M.isFlex(n));
  track(
    (ev) => {
      const q = toWorld(ev);
      const keep = ev.shiftKey || (single && items[0].type === "image" && !ev.shiftKey && false);
      if (single) {
        const n = items[0];
        const a = (-b0.rotation * Math.PI) / 180;
        let mx = q.x - p.x,
          my = q.y - p.y;
        // encaixe nas bordas (só sem rotação)
        if (!b0.rotation) {
          const edge = { x: hx === 1 ? b0.x + b0.w + mx : b0.x + mx, y: hy === 1 ? b0.y + b0.h + my : b0.y + my };
          const s = snapBox({ x: edge.x, y: edge.y, w: 0, h: 0 }, lines, { x: hx ? [0] : [], y: hy ? [0] : [] });
          mx += s.dx;
          my += s.dy;
          guides = s.guides;
        }
        const dx = mx * Math.cos(a) - my * Math.sin(a),
          dy = mx * Math.sin(a) + my * Math.cos(a);
        const k = ev.altKey ? 2 : 1;
        let w = Math.max(1, Math.round(b0.w + hx * dx * k)),
          h = Math.max(1, Math.round(b0.h + hy * dy * k));
        if (keep) {
          const s = hx && hy ? Math.max(w / b0.w, h / b0.h) : hx ? w / b0.w : h / b0.h;
          w = Math.max(1, b0.w * s);
          h = Math.max(1, b0.h * s);
        }
        if (n.type === "text" && !hy && hx) h = b0.h;
        let lx = hx === -1 ? b0.w - w : hx === 1 ? 0 : (b0.w - w) / 2;
        let ly = hy === -1 ? b0.h - h : hy === 1 ? 0 : (b0.h - h) / 2;
        if (ev.altKey) {
          lx = (b0.w - w) / 2;
          ly = (b0.h - h) / 2;
        }
        const r = (b0.rotation * Math.PI) / 180,
          cdx = lx + w / 2 - b0.w / 2,
          cdy = ly + h / 2 - b0.h / 2;
        const cx = b0.x + b0.w / 2 + cdx * Math.cos(r) - cdy * Math.sin(r),
          cy = b0.y + b0.h / 2 + cdx * Math.sin(r) + cdy * Math.cos(r);
        n.x = n0.x + (cx - w / 2 - b0.x);
        n.y = n0.y + (cy - h / 2 - b0.y);
        if (!b0.rotation) {
          n.x = Math.round(n.x);
          n.y = Math.round(n.y);
        }
        n.w = w;
        n.h = h;
        if (n.type === "text") n.sizing = hy ? "fixed" : n.sizing === "fixed" ? "fixed" : "width";
        if (n.type === "path") {
          n.points = structuredClone(n0.points);
          M.scaleNode(n, w / n0.w, h / n0.h);
        }
        if (n.type === "group" || n.type === "boolean") {
          n.children = structuredClone(n0.children);
          M.scaleNode(n, w / b0.w, h / b0.h);
        }
        rerender ? renderCanvas() : patchNode(n);
      } else {
        let W = Math.max(1, U.w + hx * (q.x - p.x)),
          H = Math.max(1, U.h + hy * (q.y - p.y));
        if (keep) {
          const s = hx && hy ? Math.max(W / U.w, H / U.h) : hx ? W / U.w : H / U.h;
          W = U.w * s;
          H = U.h * s;
        }
        const X = hx === -1 ? U.x + U.w - W : hx === 1 ? U.x : U.x + (U.w - W) / 2;
        const Y = hy === -1 ? U.y + U.h - H : hy === 1 ? U.y : U.y + (U.h - H) / 2;
        const sx = W / U.w,
          sy = H / U.h;
        for (const m of multi) {
          const n = m.n;
          Object.assign(n, structuredClone(m.c));
          n.x = X + (m.b.x - U.x) * sx - m.o.x;
          n.y = Y + (m.b.y - U.y) * sy - m.o.y;
          n.w = Math.max(1, m.b.w * sx);
          n.h = Math.max(1, m.b.h * sy);
          if (n.type === "text") n.sizing = "fixed";
          if (["path", "group", "boolean"].includes(n.type)) M.scaleNode(n, n.w / m.c.w, n.h / m.c.h);
          if (!rerender) patchNode(n);
        }
        if (rerender) renderCanvas();
      }
      drawOverlay();
    },
    () => {
      guides = [];
      commit(before);
      render();
    },
  );
}

function startRotate(e, p) {
  const before = snapshot();
  const items = sel().filter((n) => !n.locked);
  if (!items.length) return;
  const b = union(items.map((n) => aabb(worldBox(n.id))));
  const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const a0 = Math.atan2(p.y - c.y, p.x - c.x);
  const r0 = items.map((n) => n.rotation || 0);
  track(
    (ev) => {
      const q = toWorld(ev);
      let d = ((Math.atan2(q.y - c.y, q.x - c.x) - a0) * 180) / Math.PI;
      items.forEach((n, i) => {
        let r = r0[i] + d;
        if (ev.shiftKey) r = Math.round(r / 15) * 15;
        n.rotation = Math.round((((r % 360) + 540) % 360) - 180);
        patchNode(n);
      });
      drawOverlay();
    },
    () => {
      commit(before);
      render();
    },
  );
}

// ------------------------------------------------------------------ criar formas
function makeNode(type) {
  const n = M.defaults(type);
  const count = (t) => {
    let k = 0;
    M.walk(page().nodes, (x) => x.type === t && k++);
    return k;
  };
  if (type === "frame") n.name = `Prancheta ${count("frame") + 1}`;
  if (type === "section") n.name = `Seção ${count("section") + 1}`;
  return n;
}
function startDraw(e, p) {
  const before = snapshot();
  const t = tool;
  const container = t === "section" ? null : containerAt(p);
  const origin = originOf(container?.id);
  const lines = snapLines([]);
  const s0 = snapBox({ x: p.x, y: p.y, w: 0, h: 0 }, lines, { x: [0], y: [0] });
  p = { x: p.x + s0.dx, y: p.y + s0.dy };
  let n = null;
  const create = () => {
    n = makeNode(t === "line" ? "path" : t);
    if (t === "line") n.name = "Linha";
    insertInto(n, container);
    selection = [n.id];
  };
  track(
    (ev) => {
      let q = toWorld(ev);
      if (!n && Math.hypot(q.x - p.x, q.y - p.y) * view.z < 3) return;
      if (!n) {
        create();
        renderCanvas();
      }
      if (t === "line") {
        if (ev.shiftKey) {
          const ang = Math.round(Math.atan2(q.y - p.y, q.x - p.x) / (Math.PI / 4)) * (Math.PI / 4),
            len = Math.hypot(q.x - p.x, q.y - p.y);
          q = { x: p.x + Math.cos(ang) * len, y: p.y + Math.sin(ang) * len };
        }
        Object.assign(n, M.normalizeWorldPath([[p.x - origin.x, p.y - origin.y], [q.x - origin.x, q.y - origin.y]], false));
      } else {
        const s = snapBox({ x: q.x, y: q.y, w: 0, h: 0 }, lines, { x: [0], y: [0] });
        q = { x: q.x + s.dx, y: q.y + s.dy };
        guides = s.guides;
        let w = q.x - p.x,
          h = q.y - p.y;
        if (ev.shiftKey) {
          const m = Math.max(Math.abs(w), Math.abs(h));
          w = Math.sign(w || 1) * m;
          h = Math.sign(h || 1) * m;
        }
        let x = Math.min(p.x, p.x + w),
          y = Math.min(p.y, p.y + h);
        w = Math.abs(w);
        h = Math.abs(h);
        if (ev.altKey) {
          x = p.x - w;
          y = p.y - h;
          w *= 2;
          h *= 2;
        }
        Object.assign(n, { x: Math.round(x - origin.x), y: Math.round(y - origin.y), w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) });
      }
      patchNode(n);
      drawOverlay();
    },
    () => {
      guides = [];
      if (!n) {
        create();
        const big = t === "frame" && !container ? [1440, 900] : t === "section" ? [1600, 1100] : t === "line" ? [120, 0] : [100, 100];
        if (t === "line") Object.assign(n, M.normalizeWorldPath([[p.x - origin.x, p.y - origin.y], [p.x - origin.x + 120, p.y - origin.y]], false));
        else Object.assign(n, { x: Math.round(p.x - origin.x), y: Math.round(p.y - origin.y), w: big[0], h: big[1] });
      }
      setTool("move");
      commit(before);
      render();
    },
  );
}

// ------------------------------------------------------------------ texto direto na tela
function startTextTool(e, p) {
  const before = snapshot();
  const container = containerAt(p);
  const origin = originOf(container?.id);
  let box = null;
  track(
    (ev) => {
      const q = toWorld(ev);
      if (Math.hypot(q.x - p.x, q.y - p.y) * view.z < 4) return;
      box = { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), w: Math.abs(q.x - p.x), h: Math.abs(q.y - p.y) };
      marquee = box;
      drawOverlay();
    },
    () => {
      marquee = null;
      const n = makeNode("text");
      n.text = "";
      const at = box || { x: p.x, y: p.y - n.fontSize * 0.65 };
      Object.assign(n, { x: Math.round(at.x - origin.x), y: Math.round(at.y - origin.y) });
      if (box && box.w > 10) Object.assign(n, { sizing: "width", w: box.w });
      insertInto(n, container);
      selection = [n.id];
      setTool("move");
      render();
      startTextEdit(n.id, before);
    },
  );
}
function startTextEdit(id, before = snapshot()) {
  const n = node(id);
  if (!n || n.type !== "text" || n.locked) return;
  renderCanvas();
  const el = elOf(id);
  if (!el) return;
  editPath = null;
  selection = [id];
  editingText = { id, el, before };
  try {
    el.contentEditable = "plaintext-only";
  } catch {
    el.contentEditable = "true";
  }
  if (!el.isContentEditable) el.contentEditable = "true";
  if (!n.text) el.style.minWidth = "4px";
  el.focus();
  const r = document.createRange();
  r.selectNodeContents(el);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
  el.addEventListener("input", () => {
    n.text = el.innerText.replace(/\n$/, "");
    drawOverlay();
  });
  el.addEventListener("keydown", (ev) => {
    ev.stopPropagation();
    if (ev.key === "Escape" || (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey))) {
      ev.preventDefault();
      finishText();
    }
  });
  el.addEventListener("blur", () => setTimeout(() => editingText?.el === el && finishText(), 0));
  renderInspector();
  drawOverlay();
}
function finishText() {
  if (!editingText) return;
  const { id, el, before } = editingText;
  editingText = null;
  const n = node(id);
  if (n) {
    const text = el.innerText.replace(/\n$/, "");
    if (!text.trim()) {
      removeNode(id);
      selection = [];
    } else n.text = text;
  }
  getSelection().removeAllRanges();
  commit(before);
  render();
}

// ------------------------------------------------------------------ caneta e lápis
function penDown(e, p) {
  if (!pen) pen = { before: snapshot(), parent: containerAt(p), anchors: [], node: null, closed: false };
  const A = pen.anchors;
  if (A.length >= 2) {
    const f = toScreen(A[0][0], A[0][1]),
      s = toScreen(p.x, p.y);
    if (Math.hypot(f.x - s.x, f.y - s.y) < 9) {
      pen.closed = true;
      track(
        (ev) => {
          const q = toWorld(ev);
          const ox = q.x - A[0][0],
            oy = q.y - A[0][1];
          if (Math.hypot(ox, oy) * view.z < 3) return;
          A[0][2] = -ox;
          A[0][3] = -oy;
          A[0][4] = ox;
          A[0][5] = oy;
          applyPen();
        },
        () => finishPen(),
      );
      return applyPen();
    }
    const l = A[A.length - 1];
    if (Math.hypot(l[0] - p.x, l[1] - p.y) * view.z < 2) return;
  }
  A.push([p.x, p.y, 0, 0, 0, 0]);
  const a = A[A.length - 1];
  applyPen();
  track(
    (ev) => {
      const q = toWorld(ev);
      const ox = q.x - a[0],
        oy = q.y - a[1];
      if (Math.hypot(ox, oy) * view.z < 3) return;
      a[4] = ox;
      a[5] = oy;
      a[2] = -ox;
      a[3] = -oy;
      applyPen();
    },
    () => drawOverlay(),
  );
}
function applyPen() {
  const o = originOf(pen.parent?.id);
  if (!pen.node) {
    pen.node = makeNode("path");
    insertInto(pen.node, pen.parent);
    selection = [pen.node.id];
  }
  Object.assign(pen.node, M.normalizeWorldPath(pen.anchors.map(([x, y, ix, iy, ox, oy]) => [x - o.x, y - o.y, ix, iy, ox, oy]), pen.closed), { closed: pen.closed });
  renderCanvas();
}
function finishPen() {
  if (!pen) return;
  const { before, node: n, anchors } = pen;
  pen = null;
  if (n && anchors.length < 2) {
    removeNode(n.id);
    selection = [];
  }
  setTool("move");
  commit(before);
  render();
}
function startPencil(e, p) {
  const before = snapshot();
  const parent = containerAt(p);
  pencil = [[p.x, p.y]];
  track(
    (ev) => {
      const q = toWorld(ev);
      pencil.push([q.x, q.y]);
      drawOverlay();
    },
    () => {
      const pts = M.smooth(M.simplify(pencil, 1.2 / view.z));
      pencil = null;
      if (pts.length >= 2) {
        const o = originOf(parent?.id);
        const n = makeNode("path");
        n.name = "Traço";
        Object.assign(n, M.normalizeWorldPath(pts.map(([x, y, ...h]) => [x - o.x, y - o.y, ...h]), false));
        insertInto(n, parent);
        selection = [n.id];
      }
      commit(before);
      render();
    },
  );
}

// ------------------------------------------------------------------ edição de pontos do vetor
function enterPathEdit(id) {
  let n = node(id);
  if (!n || n.locked) return;
  if (["rect", "ellipse", "polygon", "star"].includes(n.type)) {
    const before = snapshot();
    const l = loc(id);
    l.list[l.index] = M.toPath(n);
    commit(before);
    n = node(id);
  }
  if (n.type !== "path") return;
  editPath = { id, sel: -1 };
  selection = [id];
  render();
  toast("Editando pontos: arraste pontos e alças. Duplo clique num ponto deixa ele reto/curvo. Delete apaga o ponto. Esc termina.");
}
function startPointDrag(e, i, which) {
  const before = snapshot();
  const n = node(editPath.id);
  editPath.sel = i;
  drawOverlay();
  track(
    (ev) => {
      const b = worldBox(n.id);
      const q = toWorld(ev);
      const l = worldToLocal(b, q.x, q.y);
      const pt = n.points[i];
      if (!which) {
        pt[0] = l.x;
        pt[1] = l.y;
      } else {
        const hx = l.x - pt[0],
          hy = l.y - pt[1];
        const [mine, other] = which === "in" ? [2, 4] : [4, 2];
        pt[mine] = hx;
        pt[mine + 1] = hy;
        const len = Math.hypot(pt[other], pt[other + 1]);
        if (!ev.altKey && len) {
          const k = len / (Math.hypot(hx, hy) || 1);
          pt[other] = -hx * k;
          pt[other + 1] = -hy * k;
        }
      }
      M.refitPath(n);
      patchNode(n);
      drawOverlay();
    },
    () => {
      commit(before);
      render();
    },
  );
}
function togglePoint(i) {
  change(() => {
    const n = node(editPath.id),
      P = n.points,
      pt = P[i];
    if (pt[2] || pt[3] || pt[4] || pt[5]) pt.splice(2, 4, 0, 0, 0, 0);
    else {
      const prev = P[i - 1] || (n.closed ? P[P.length - 1] : pt),
        next = P[i + 1] || (n.closed ? P[0] : pt);
      const tx = (next[0] - prev[0]) / 6,
        ty = (next[1] - prev[1]) / 6;
      pt.splice(2, 4, -tx, -ty, tx, ty);
    }
    M.refitPath(n);
  });
}

// ------------------------------------------------------------------ duplo clique
// O canvas é redesenhado entre um clique e outro, então o navegador nem sempre
// dispara "dblclick". Detectamos o duplo clique no próprio pointerdown.
let lastDown = { t: 0, x: 0, y: 0 };
function isDouble(e) {
  const now = performance.now();
  const dbl = now - lastDown.t < 450 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 6;
  lastDown = { t: dbl ? 0 : now, x: e.clientX, y: e.clientY };
  return dbl;
}
function onDouble(e) {
  if (pen) {
    finishPen();
    return true;
  }
  if (editPath) {
    const a = e.target.closest("[data-anchor]");
    if (a) togglePoint(+a.dataset.anchor);
    return !!a;
  }
  if (tool !== "move") return false;
  const chain = hitChain(e);
  if (!chain.length) return false;
  const cur = selection.length === 1 ? chain.findIndex((n) => n.id === selection[0]) : -1;
  const deepest = chain[chain.length - 1];
  if (cur >= 0 && chain[cur].type === "text") return startTextEdit(chain[cur].id), true;
  if (cur >= 0 && ["path", "polygon", "star"].includes(chain[cur].type)) return enterPathEdit(chain[cur].id), true;
  if (cur >= 0 && chain[cur + 1]) {
    selection = [chain[cur + 1].id];
    if (chain[cur + 1].type === "text") startTextEdit(chain[cur + 1].id);
    else render();
    return true;
  }
  if (deepest.type === "text") return startTextEdit(deepest.id), true;
  return false;
}

// ------------------------------------------------------------------ roda do mouse
stage.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.008), e.clientX - r.left, e.clientY - r.top);
    else {
      view.x -= e.shiftKey ? e.deltaY : e.deltaX;
      view.y -= e.shiftKey ? 0 : e.deltaY;
      moveView();
    }
  },
  { passive: false },
);
addEventListener("resize", () => moveView());

// ------------------------------------------------------------------ ações
function setTool(t) {
  if (pen && t !== "pen") finishPen();
  if (t === "image") return $("#image-file").click();
  tool = t;
  stage.dataset.tool = t;
  const def = TOOLS.find((x) => x[0] === t);
  $("#tool-name").textContent = def ? def[2] : "";
  document.querySelectorAll("#toolbar button").forEach((b) => b.classList.toggle("on", b.dataset.tool === t));
}

function groupNodes(kind = "group") {
  const ns = roots().filter((n) => !n.locked);
  if (!ns.length) return;
  const l0 = loc(ns[0].id);
  if (!ns.every((n) => loc(n.id).list === l0.list)) return toast("Para agrupar, as camadas precisam estar no mesmo lugar.", true);
  change(() => {
    const parent = l0.parent;
    const o = originOf(parent?.id);
    const boxes = ns.map((n) => worldBox(n.id));
    const b = union(boxes.map(aabb));
    const g = makeNode(kind);
    if (kind === "frame") Object.assign(g, { fill: "#ffffff00", clip: false, name: "Componente" });
    Object.assign(g, { x: b.x - o.x, y: b.y - o.y, w: Math.max(1, b.w), h: Math.max(1, b.h) });
    const at = Math.max(...ns.map((n) => loc(n.id).index)) - ns.length + 1;
    ns.forEach((n, i) => {
      removeNode(n.id);
      n.x = boxes[i].x - b.x;
      n.y = boxes[i].y - b.y;
      g.children.push(n);
    });
    l0.list.splice(Math.max(0, at), 0, g);
    selection = [g.id];
  });
}
function ungroup() {
  const ns = roots().filter((n) => ["group", "boolean", "frame", "section"].includes(n.type) && !n.locked);
  if (!ns.length) return;
  change(() => {
    const out = [];
    for (const g of ns) {
      const l = loc(g.id);
      const o = originOf(l.parent?.id);
      const kids = g.children.map((c) => {
        const b = worldBox(c.id);
        const center = localToWorld(worldBox(g.id), b.x - worldBox(g.id).x + b.w / 2, b.y - worldBox(g.id).y + b.h / 2);
        return { c, b, center };
      });
      const flex = M.isFlex(l.parent);
      kids.forEach(({ c, b, center }) => {
        c.rotation = ((c.rotation || 0) + (g.rotation || 0)) % 360;
        c.x = center.x - b.w / 2 - o.x;
        c.y = center.y - b.h / 2 - o.y;
        if (M.isFlex(g)) {
          c.w = b.w;
          c.h = b.h;
        }
        if (g.type === "boolean" && !c.fill) c.fill = g.fill;
      });
      l.list.splice(l.index, 1, ...kids.map((k) => k.c));
      if (flex) kids.forEach((k) => (k.c.x = k.c.y = 0));
      out.push(...kids.map((k) => k.c.id));
    }
    selection = out;
  });
}
function booleanOp(op) {
  const ns = roots().filter((n) => !n.locked);
  if (ns.length < 2) return toast("Selecione 2 ou mais formas para combinar.", true);
  if (ns.some((n) => !["rect", "ellipse", "polygon", "star", "path", "boolean"].includes(n.type))) return toast("Combinar funciona com formas e vetores (não com texto, imagem ou pranchetas).", true);
  const l0 = loc(ns[0].id);
  if (!ns.every((n) => loc(n.id).list === l0.list)) return toast("As formas precisam estar no mesmo lugar.", true);
  change(() => {
    const ordered = [...ns].sort((a, b) => loc(a.id).index - loc(b.id).index);
    const at = Math.max(...ordered.map((n) => loc(n.id).index)) - ordered.length + 1;
    ordered.forEach((n) => removeNode(n.id));
    const g = M.makeBoolean(ordered, op);
    l0.list.splice(Math.max(0, at), 0, g);
    selection = [g.id];
  });
}
function autoLayout() {
  const ns = roots().filter((n) => !n.locked);
  if (!ns.length) return;
  if (ns.length === 1 && ns[0].type === "frame") {
    return change(() => {
      const f = ns[0];
      f.layout.mode = f.layout.mode === "none" ? (f.children.length > 1 && spreadX(f.children) ? "row" : "column") : "none";
      if (f.layout.mode === "none") {
        // ao desligar, mantém cada filho onde ele estava
        const fb = worldBox(f.id);
        f.children.forEach((c) => {
          const b = worldBox(c.id);
          c.x = b.x - fb.x;
          c.y = b.y - fb.y;
        });
      } else f.hugHeight = true;
    });
  }
  const l0 = loc(ns[0].id);
  if (!ns.every((n) => loc(n.id).list === l0.list)) return toast("As camadas precisam estar no mesmo lugar.", true);
  change(() => {
    const row = spreadX(ns);
    const boxes = ns.map((n) => ({ n, b: aabb(worldBox(n.id)) })).sort((a, b) => (row ? a.b.x - b.b.x : a.b.y - b.b.y));
    const U = union(boxes.map((x) => x.b));
    const gaps = boxes.slice(1).map((x, i) => (row ? x.b.x - (boxes[i].b.x + boxes[i].b.w) : x.b.y - (boxes[i].b.y + boxes[i].b.h)));
    const o = originOf(l0.parent?.id);
    const f = makeNode("frame");
    Object.assign(f, { name: "Layout automático", fill: "#ffffff00", clip: false, hugHeight: true, x: U.x - o.x, y: U.y - o.y, w: Math.max(1, U.w), h: Math.max(1, U.h) });
    f.layout = { ...f.layout, mode: row ? "row" : "column", padding: 0, gap: Math.max(0, Math.round(gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 16)) };
    const at = Math.max(...ns.map((n) => loc(n.id).index)) - ns.length + 1;
    boxes.forEach(({ n }) => {
      removeNode(n.id);
      f.children.push(n);
    });
    l0.list.splice(Math.max(0, at), 0, f);
    selection = [f.id];
  });
}
const spreadX = (ns) => {
  const b = ns.map((n) => aabb(worldBox(n.id)));
  const cx = b.map((x) => x.x + x.w / 2),
    cy = b.map((x) => x.y + x.h / 2);
  return Math.max(...cx) - Math.min(...cx) >= Math.max(...cy) - Math.min(...cy);
};
function align(how) {
  const ns = roots().filter((n) => !n.locked && !M.isFlex(parentOf(n.id)));
  if (!ns.length) return;
  change(() => {
    const boxes = ns.map((n) => aabb(worldBox(n.id)));
    let ref;
    if (ns.length === 1) {
      const p = parentOf(ns[0].id);
      if (!p) return;
      ref = worldBox(p.id);
    } else ref = union(boxes);
    if (how === "dh" || how === "dv") {
      if (ns.length < 3) return;
      const h = how === "dh";
      const order = ns.map((n, i) => ({ n, b: boxes[i] })).sort((a, b) => (h ? a.b.x - b.b.x : a.b.y - b.b.y));
      const total = order.reduce((s, o) => s + (h ? o.b.w : o.b.h), 0);
      const gap = ((h ? ref.w : ref.h) - total) / (order.length - 1);
      let at = h ? ref.x : ref.y;
      for (const o of order) {
        if (h) o.n.x += at - o.b.x;
        else o.n.y += at - o.b.y;
        at += (h ? o.b.w : o.b.h) + gap;
      }
      return;
    }
    ns.forEach((n, i) => {
      const b = boxes[i];
      if (how === "l") n.x += ref.x - b.x;
      if (how === "c") n.x += ref.x + ref.w / 2 - (b.x + b.w / 2);
      if (how === "r") n.x += ref.x + ref.w - (b.x + b.w);
      if (how === "t") n.y += ref.y - b.y;
      if (how === "m") n.y += ref.y + ref.h / 2 - (b.y + b.h / 2);
      if (how === "b") n.y += ref.y + ref.h - (b.y + b.h);
    });
  });
}
function makeComponent() {
  const ns = roots();
  if (!ns.length) return;
  if (ns.length === 1 && ns[0].type === "frame") {
    return change(() => {
      ns[0].component = !ns[0].component;
      if (ns[0].component && /^Prancheta/.test(ns[0].name)) ns[0].name = "Componente";
    });
  }
  groupNodes("frame");
  change(() => (sel()[0].component = true));
}
function insertInstance(ref) {
  const m = M.findInDoc(doc, ref)?.node;
  if (!m) return;
  change(() => {
    const target = sel().length === 1 && sel()[0].type === "frame" && sel()[0].id !== ref && !M.find(m.children, sel()[0].id) ? sel()[0] : null;
    const r = stage.getBoundingClientRect();
    const c = { x: (r.width / 2 - view.x) / view.z, y: (r.height / 2 - view.y) / view.z };
    const o = originOf(target?.id);
    const n = makeNode("instance");
    Object.assign(n, { ref, name: m.name, w: m.w, h: m.h, x: target ? 24 : c.x - m.w / 2 - o.x, y: target ? 24 : c.y - m.h / 2 - o.y, radius: 0 });
    insertInto(n, target);
    selection = [n.id];
  });
}
function detachInstance() {
  const n = sel()[0];
  const m = n && M.findInDoc(doc, n.ref)?.node;
  if (!m) return;
  change(() => {
    const f = M.cloneTree(m);
    Object.assign(f, { id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, rotation: n.rotation, component: false, name: n.name, opacity: n.opacity, hidden: n.hidden });
    const l = loc(n.id);
    l.list[l.index] = f;
  });
}
function goToMaster() {
  const n = sel()[0];
  const hit = n && M.findInDoc(doc, n.ref);
  if (!hit) return toast("O componente original foi apagado.", true);
  pageId = hit.page.id;
  selection = [hit.node.id];
  render();
  fit([hit.node]);
}

function act(a, el) {
  const ns = roots().filter((n) => !n.locked);
  switch (a) {
    case "undo":
    case "redo":
      return undoRedo(a);
    case "delete":
      if (editPath && editPath.sel >= 0) {
        const n = node(editPath.id);
        if (n.points.length > 2)
          change(() => {
            n.points.splice(editPath.sel, 1);
            editPath.sel = -1;
            M.refitPath(n);
          });
        return;
      }
      if (!ns.length) return;
      return change(() => {
        ns.forEach((n) => removeNode(n.id));
        selection = [];
      });
    case "duplicate":
      if (!ns.length) return;
      return change(() => {
        selection = ns.map((n) => {
          const c = M.cloneTree(n);
          c.component = false;
          if (!M.isFlex(parentOf(n.id))) {
            c.x += isArtboard(n) ? n.w + 80 : 16;
            c.y += isArtboard(n) ? 0 : 16;
          }
          const l = loc(n.id);
          l.list.splice(l.index + 1, 0, c);
          return c.id;
        });
      });
    case "group":
      return groupNodes();
    case "ungroup":
      return ungroup();
    case "front":
    case "back":
    case "forward":
    case "backward":
      if (!ns.length) return;
      return change(() => {
        for (const n of a === "back" || a === "forward" ? [...ns].reverse() : ns) {
          const l = loc(n.id);
          l.list.splice(l.index, 1);
          const i = a === "front" ? l.list.length : a === "back" ? 0 : a === "forward" ? Math.min(l.list.length, l.index + 1) : Math.max(0, l.index - 1);
          l.list.splice(i, 0, n);
        }
      });
    case "select-all": {
      const p = selection.length ? parentOf(selection[0]) : null;
      selection = (p ? p.children : page().nodes).filter((n) => !n.hidden && !n.locked).map((n) => n.id);
      return render();
    }
    case "autolayout":
      return autoLayout();
    case "component":
      return makeComponent();
    case "detach":
      return detachInstance();
    case "goto-master":
      return goToMaster();
    case "insert-instance":
      return insertInstance(el.dataset.ref);
    case "union":
    case "subtract":
    case "intersect":
    case "exclude":
      return booleanOp(a);
    case "edit-points":
      return enterPathEdit(selection[0]);
    case "to-path":
      return change(() => {
        for (const n of ns) if (["rect", "ellipse", "polygon", "star"].includes(n.type)) loc(n.id).list[loc(n.id).index] = M.toPath(n);
      });
    case "align":
      return align(el.dataset.how);
    case "zoomin":
      return zoomAt(1.25);
    case "zoomout":
      return zoomAt(0.8);
    case "zoom100":
      return zoomAt(1 / view.z);
    case "fit":
      return fit(page().nodes);
    case "fit-selection":
      return fit(sel().length ? sel() : page().nodes);
    case "add-page":
      return change(() => {
        const p = { id: M.uid(), name: `Página ${doc.pages.length + 1}`, nodes: [] };
        doc.pages.push(p);
        pageId = p.id;
        selection = [];
      });
    case "delete-page": {
      const p = doc.pages.find((x) => x.id === el.closest("[data-page]").dataset.page);
      if (doc.pages.length < 2) return toast("O projeto precisa de pelo menos uma página.", true);
      if (p.nodes.length && !confirm(`Apagar a página "${p.name}" e tudo que está nela? (Ctrl+Z desfaz)`)) return;
      return change(() => {
        doc.pages.splice(doc.pages.indexOf(p), 1);
        if (pageId === p.id) pageId = doc.pages[0].id;
        selection = [];
      });
    }
    case "export-menu":
      return toggleMenu();
    case "export-site":
      return exportSite();
    case "export-html":
      return exportHTMLFile();
    case "export-svg":
      return exportSVGFile();
    case "export-png":
      return exportPNG();
    case "save-json":
      return download(JSON.stringify(doc, null, 2), "application/json", `${M.slug(doc.title)}.stylo.json`);
    case "open-json":
      return $("#open-file").click();
    case "preview":
      return openPreview();
    case "preview-width":
      return ($("#preview iframe").style.width = el.dataset.w ? el.dataset.w + "px" : "100%");
    case "projects":
      return openProjects();
    case "new-project":
      return newProject();
    case "open-project":
      $("#projects").close();
      return openProject(el.dataset.id).catch((e) => toast(e.message, true));
    case "delete-project":
      return deleteProject(el.dataset.id);
    case "help":
      return openHelp();
    case "close-dialog":
      return el.closest("dialog").close();
    case "image":
      return $("#image-file").click();
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (b && !b.disabled) act(b.dataset.action, b);
  if (!e.target.closest(".menu-wrap")) closeMenus();
});
function toggleMenu() {
  const m = $("#export-menu");
  m.hidden = !m.hidden;
}
function closeMenus() {
  $("#export-menu").hidden = true;
}

// ------------------------------------------------------------------ exportar
function download(data, type, name) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const measureCtx = document.createElement("canvas").getContext("2d");
const svgOpts = () => ({
  worldBox: (id) => worldBox(id),
  measure: (t, font) => {
    measureCtx.font = font;
    return measureCtx.measureText(t).width;
  },
});
function currentBoard() {
  for (const id of selection) {
    const chain = M.ancestors(page().nodes, id);
    const b = [...chain].reverse().find((n) => n.type === "frame" && isArtboard(n));
    if (b) return b;
  }
  return M.artboards(doc).find((a) => a.page.id === pageId)?.frame || M.artboards(doc)[0]?.frame;
}
function exportSite() {
  closeMenus();
  const files = M.siteFiles(doc);
  if (!files.length) return toast("Crie uma prancheta (tecla F) para ter o que exportar.", true);
  download(new Blob([M.zip(files)], { type: "application/zip" }), "", `${M.slug(doc.title)}-site.zip`);
  toast(`Site exportado: ${files.length} página(s). Descompacte e abra o index.html.`);
}
function exportHTMLFile() {
  closeMenus();
  const f = currentBoard();
  if (!f) return toast("Crie uma prancheta (tecla F) para exportar.", true);
  download(M.exportFrameHTML(doc, f), "text/html", `${M.slug(f.name)}.html`);
}
function exportTargets() {
  const ns = roots().filter((n) => !n.hidden);
  if (ns.length) return ns;
  const f = currentBoard();
  return f ? [f] : [];
}
function exportSVGFile() {
  closeMenus();
  const ns = exportTargets();
  if (!ns.length) return toast("Selecione algo para exportar.", true);
  download(M.exportSVG(doc, ns, svgOpts()), "image/svg+xml", `${M.slug(ns.length === 1 ? ns[0].name : doc.title)}.svg`);
}
async function exportPNG(scale = 2) {
  closeMenus();
  const ns = exportTargets();
  if (!ns.length) return toast("Selecione algo para exportar.", true);
  const svg = M.exportSVG(doc, ns, svgOpts());
  const w = +svg.match(/width="(\d+)"/)[1],
    h = +svg.match(/height="(\d+)"/)[1];
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await img.decode();
    const c = document.createElement("canvas");
    c.width = Math.ceil(w * scale);
    c.height = Math.ceil(h * scale);
    const g = c.getContext("2d");
    g.scale(scale, scale);
    g.drawImage(img, 0, 0, w, h);
    c.toBlob((b) => download(b, "image/png", `${M.slug(ns.length === 1 ? ns[0].name : doc.title)}@${scale}x.png`), "image/png");
  } catch {
    toast("Não consegui gerar o PNG.", true);
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

// ------------------------------------------------------------------ visualizar (protótipo com links)
function openPreview() {
  const boards = M.artboards(doc);
  if (!boards.length) return toast("Crie uma prancheta (tecla F) para visualizar.", true);
  $("#preview-frame").innerHTML = boards.map(({ frame, page: p }) => `<option value="${frame.id}">${M.escapeHTML(p.name)} / ${M.escapeHTML(frame.name)}</option>`).join("");
  showPreview(currentBoard()?.id || boards[0].frame.id);
  $("#preview").showModal();
}
function showPreview(id) {
  const f = M.findInDoc(doc, id)?.node;
  if (!f) return;
  $("#preview-frame").value = id;
  const links = new Map(M.artboards(doc).map(({ frame }) => [frame.id, "#tela:" + frame.id]));
  const nav = `<script>document.addEventListener("click",e=>{const a=e.target.closest('a[href^="#tela:"]');if(a){e.preventDefault();parent.postMessage({stylo:a.getAttribute("href").slice(6)},"*")}})</script>`;
  $("#preview iframe").srcdoc = M.exportFrameHTML(doc, f, { links }).replace("</body>", nav + "</body>");
}
$("#preview-frame").onchange = (e) => showPreview(e.target.value);
addEventListener("message", (e) => {
  if (e.source === $("#preview iframe").contentWindow && typeof e.data?.stylo === "string") showPreview(e.data.stylo);
});

// ------------------------------------------------------------------ projetos
async function openProjects() {
  const d = $("#projects");
  $("#projects-where").textContent =
    store.mode === "server"
      ? "Cada projeto é um arquivo .json na pasta \"projetos\" do Stylo, no seu computador. Uma cópia da versão anterior fica em .bak."
      : "Sem servidor: o projeto fica só neste navegador. Rode npm start para salvar em arquivo no computador.";
  $("#project-list").innerHTML = '<p class="muted">Carregando…</p>';
  d.showModal();
  if (store.mode !== "server") return void ($("#project-list").innerHTML = "");
  const list = await api("/api/projects").catch(() => []);
  $("#project-list").innerHTML =
    list
      .map(
        (p) =>
          `<div class="project-row${p.id === store.id ? " on" : ""}"><b>${M.escapeHTML(p.title)}</b><small>${new Date(p.updatedAt).toLocaleString("pt-BR")}</small><button data-action="open-project" data-id="${p.id}">Abrir</button><button class="icon-btn danger" data-action="delete-project" data-id="${p.id}" aria-label="Apagar">${icon("trash")}</button></div>`,
      )
      .join("") || '<p class="muted">Nenhum projeto ainda.</p>';
}
async function newProject() {
  const title = prompt("Nome do novo projeto", "Novo projeto");
  if (!title) return;
  $("#projects").close();
  if (store.mode === "server") return createProject(title).catch((e) => toast(e.message, true));
  if (!confirm("Sem servidor só cabe um projeto no navegador. Baixe o atual antes. Continuar?")) return;
  doc = M.fresh(title);
  pageId = doc.pages[0].id;
  selection = [];
  past = [];
  future = [];
  save();
  render();
}
async function deleteProject(id) {
  if (!confirm("Apagar este projeto? O arquivo é renomeado (não some de vez) na pasta projetos.")) return;
  await api(`/api/projects/${id}`, { method: "DELETE" }).catch((e) => toast(e.message, true));
  if (id === store.id) {
    const list = await api("/api/projects");
    if (list.length) await openProject(list[0].id);
    else await createProject("Meu primeiro projeto");
  }
  openProjects();
}
$("#open-file").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    if (file.size > 60 * 1024 * 1024) throw new Error("Arquivo maior que 60 MB");
    const data = M.validate(JSON.parse(await file.text()));
    $("#projects").close();
    if (store.mode === "server") await createProject("", data);
    else
      change(() => {
        doc = data;
        pageId = doc.pages[0].id;
        selection = [];
      });
    toast("Projeto importado.");
  } catch (err) {
    toast("Não deu para abrir: " + err.message, true);
  }
};
$("#title").onchange = (e) => change(() => (doc.title = e.target.value.trim() || "Sem título"));
$("#title").onkeydown = (e) => e.key === "Enter" && e.target.blur();

// ------------------------------------------------------------------ imagens (arquivo, arrastar ou colar)
function addImageFile(file, at) {
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) return toast("Use PNG, JPEG, WebP ou GIF.", true);
  if (file.size > 15 * 1024 * 1024) return toast("Imagem maior que 15 MB.", true);
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () =>
      change(() => {
        const r = stage.getBoundingClientRect();
        const c = at || { x: (r.width / 2 - view.x) / view.z, y: (r.height / 2 - view.y) / view.z };
        const parent = containerAt(c);
        const o = originOf(parent?.id);
        const w = Math.min(img.width, 800),
          h = (img.height * w) / img.width;
        const n = makeNode("image");
        Object.assign(n, { src: reader.result, name: file.name.replace(/\.\w+$/, "") || "Imagem", w, h, x: c.x - w / 2 - o.x, y: c.y - h / 2 - o.y });
        insertInto(n, parent);
        selection = [n.id];
      });
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
$("#image-file").onchange = (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (f) addImageFile(f);
};
stage.addEventListener("dragover", (e) => e.preventDefault());
stage.addEventListener("drop", (e) => {
  e.preventDefault();
  const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith("image/"));
  if (f) addImageFile(f, toWorld(e));
});

// ------------------------------------------------------------------ copiar e colar
const typing = (e) => e.target.closest?.("input,textarea,select,[contenteditable]") && !e.target.closest("#stage:not(:focus-within)") ? true : !!e.target.closest?.("input,textarea,select,[contenteditable]");
document.addEventListener("copy", (e) => {
  if (typing(e) || !selection.length) return;
  e.preventDefault();
  clipboard = roots().map((n) => structuredClone(n));
  e.clipboardData.setData("text/plain", JSON.stringify({ stylo: clipboard }));
});
document.addEventListener("cut", (e) => {
  if (typing(e) || !selection.length) return;
  e.preventDefault();
  clipboard = roots().map((n) => structuredClone(n));
  e.clipboardData.setData("text/plain", JSON.stringify({ stylo: clipboard }));
  act("delete");
});
document.addEventListener("paste", (e) => {
  if (typing(e)) return;
  e.preventDefault();
  const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
  if (file) return addImageFile(file);
  const text = e.clipboardData?.getData("text/plain") || "";
  let nodes = null;
  try {
    const j = JSON.parse(text);
    if (Array.isArray(j.stylo)) nodes = j.stylo;
  } catch {
    /* texto comum */
  }
  if (!nodes && text.trim()) {
    return change(() => {
      const n = makeNode("text");
      n.text = text.slice(0, 20000);
      const c = pointer;
      const parent = containerAt(c);
      const o = originOf(parent?.id);
      Object.assign(n, { x: c.x - o.x, y: c.y - o.y, sizing: text.length > 60 ? "width" : "auto", w: text.length > 60 ? 400 : n.w });
      insertInto(n, parent);
      selection = [n.id];
    });
  }
  nodes = nodes || clipboard;
  if (!nodes?.length) return;
  change(() => {
    const target = sel().length === 1 && ["frame", "section"].includes(sel()[0].type) && !nodes.some((n) => n.id === sel()[0].id) ? sel()[0] : null;
    const firstLoc = !target && selection[0] ? loc(selection[0]) : null;
    const list = target ? target.children : firstLoc ? firstLoc.list : page().nodes;
    const same = nodes.some((n) => list.some((x) => x.id === n.id));
    selection = nodes.map((raw) => {
      let c;
      try {
        c = M.sanitizeNode(M.cloneTree(raw));
      } catch {
        return null;
      }
      c.component = false;
      if (same) {
        c.x += 16;
        c.y += 16;
      }
      list.push(c);
      return c.id;
    }).filter(Boolean);
  });
});

// ------------------------------------------------------------------ teclado
document.addEventListener("keydown", (e) => {
  if (e.target.closest?.("input,textarea,select,[contenteditable]")) return;
  if (document.querySelector("dialog[open]")) return;
  const mod = e.ctrlKey || e.metaKey,
    k = e.key.toLowerCase();
  if (e.code === "Space" && !e.repeat) {
    space = true;
    stage.classList.add("panning");
    return e.preventDefault();
  }
  if (mod) {
    const map = { z: e.shiftKey ? "redo" : "undo", y: "redo", d: "duplicate", g: e.shiftKey ? "ungroup" : "group", a: "select-all", 0: "zoom100", "=": "zoomin", "+": "zoomin", "-": "zoomout", "]": e.shiftKey ? "front" : "forward", "[": e.shiftKey ? "back" : "backward", e: "export-svg" };
    if (k === "s") {
      e.preventDefault();
      return flush().then(() => toast(store.mode === "server" ? "Salvo no computador." : "Salvo neste navegador."));
    }
    if (e.altKey && k === "k") {
      e.preventDefault();
      return act("component");
    }
    if (map[k] !== undefined) {
      e.preventDefault();
      return act(map[k]);
    }
    return;
  }
  if (e.key === "Escape") {
    if (pen) return finishPen();
    if (editPath) {
      editPath = null;
      return render();
    }
    const p = selection.length ? parentOf(selection[0]) : null;
    selection = p && !isArtboard(p) ? [p.id] : [];
    setTool("move");
    return render();
  }
  if (e.key === "Enter") {
    if (pen) return finishPen();
    if (editPath) {
      editPath = null;
      return render();
    }
    const n = sel()[0];
    if (!n) return;
    e.preventDefault();
    if (n.type === "text") return startTextEdit(n.id);
    if (["path", "polygon", "star"].includes(n.type)) return enterPathEdit(n.id);
    if (n.children?.length) {
      selection = e.shiftKey ? [parentOf(n.id)?.id].filter(Boolean) : n.children.map((c) => c.id);
      return render();
    }
    return;
  }
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    return act("delete");
  }
  if (e.key.startsWith("Arrow")) {
    e.preventDefault();
    const d = e.shiftKey ? 10 : 1;
    const ns = roots().filter((n) => !n.locked && !M.isFlex(parentOf(n.id)));
    if (!ns.length) return;
    return change(() =>
      ns.forEach((n) => {
        n.x += e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
        n.y += e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
      }),
    );
  }
  if (e.key === "?") return openHelp();
  if (e.shiftKey && k === "a") return act("autolayout");
  if (e.shiftKey && e.key === "!") return act("fit");
  if (e.shiftKey && e.key === "@") return act("fit-selection");
  if (e.shiftKey && e.code === "Digit1") return act("fit");
  if (e.shiftKey && e.code === "Digit2") return act("fit-selection");
  if (e.altKey) {
    const al = { a: "l", d: "r", w: "t", s: "b", h: "c", v: "m" }[k];
    if (al) {
      e.preventDefault();
      return align(al);
    }
  }
  const t = TOOLS.find((x) => Array.isArray(x) && x[3] && x[3].toLowerCase() === k);
  if (t && !e.shiftKey) setTool(t[0]);
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    space = false;
    stage.classList.remove("panning");
  }
});
addEventListener("blur", () => {
  space = false;
  stage.classList.remove("panning");
});

// ------------------------------------------------------------------ páginas, camadas e componentes
function renderPages() {
  $("#pages").innerHTML = doc.pages
    .map(
      (p) =>
        `<div class="page-row${p.id === pageId ? " on" : ""}" data-page="${p.id}"><span>${M.escapeHTML(p.name)}</span><button class="icon-btn small" data-action="delete-page" aria-label="Apagar página" data-tip="Apagar">${icon("x", 13)}</button></div>`,
    )
    .join("");
}
$("#pages").addEventListener("click", (e) => {
  const row = e.target.closest("[data-page]");
  if (!row || e.target.closest("button")) return;
  if (pageId === row.dataset.page) return;
  finishText();
  pageId = row.dataset.page;
  selection = [];
  editPath = null;
  render();
  requestAnimationFrame(() => fit(page().nodes));
});
$("#pages").addEventListener("dblclick", (e) => {
  const row = e.target.closest("[data-page]");
  if (row) rename(row.querySelector("span"), doc.pages.find((p) => p.id === row.dataset.page));
});
function rename(span, obj) {
  const input = document.createElement("input");
  input.className = "rename";
  input.value = obj.name;
  span.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const end = (ok) => {
    if (done) return;
    done = true;
    if (ok && input.value.trim() && input.value !== obj.name) change(() => (obj.name = input.value.trim().slice(0, 200)));
    else render();
  };
  input.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") end(true);
    if (e.key === "Escape") end(false);
  };
  input.onblur = () => end(true);
}

const TYPE_ICON = { frame: "frame", section: "section", group: "group", rect: "rect", ellipse: "ellipse", polygon: "polygon", star: "star", path: "path", text: "text", image: "image", boolean: "boolean", instance: "instance" };
function renderLayers() {
  const rows = [];
  // camadas comuns: a de cima da lista fica na frente; em layout automático a lista segue a ordem da página
  const walk = (list, depth, parent) => {
    for (const n of M.isFlex(parent) ? list : [...list].reverse()) {
      const kids = n.children && n.type !== "boolean" ? n.children : n.type === "boolean" ? n.children : null;
      const open = kids?.length && !collapsed.has(n.id);
      const ic = n.component ? "component" : M.isFlex(n) ? (n.layout.mode === "row" ? "row" : "column") : TYPE_ICON[n.type];
      rows.push(
        `<div class="layer${selection.includes(n.id) ? " selected" : ""}${n.hidden ? " dim" : ""}${n.component || n.type === "instance" ? " comp" : ""}" data-id="${n.id}" draggable="true" style="--d:${depth}" role="treeitem"><button class="tw${open ? " open" : ""}" data-toggle="${n.id}" tabindex="-1">${kids?.length ? icon("chevron", 11) : ""}</button>${icon(ic, 14)}<span class="name">${M.escapeHTML(n.name)}</span><button class="icon-btn small${n.locked ? " keep" : ""}" data-layer="locked" aria-label="Bloquear">${icon(n.locked ? "lock" : "unlock", 13)}</button><button class="icon-btn small${n.hidden ? " keep" : ""}" data-layer="hidden" aria-label="Esconder">${icon(n.hidden ? "eyeOff" : "eye", 13)}</button></div>`,
      );
      if (open) walk(kids, depth + 1, n);
    }
  };
  walk(page().nodes, 0, null);
  $("#layers").innerHTML = rows.join("") || '<p class="empty-note">Nada nesta página ainda.</p>';
  const s = $("#layers .layer.selected");
  if (s && !gestureActive) s.scrollIntoView({ block: "nearest" });
}
$("#layers").addEventListener("click", (e) => {
  const row = e.target.closest("[data-id]");
  if (!row) return;
  const id = row.dataset.id;
  const tw = e.target.closest("[data-toggle]");
  if (tw) {
    collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id);
    return renderLayers();
  }
  const prop = e.target.closest("[data-layer]")?.dataset.layer;
  if (prop) return change(() => (node(id)[prop] = !node(id)[prop]));
  finishText();
  editPath = null;
  selection = e.shiftKey || e.ctrlKey || e.metaKey ? (selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id]) : [id];
  render();
});
$("#layers").addEventListener("dblclick", (e) => {
  const row = e.target.closest("[data-id]");
  if (row && !e.target.closest("button")) rename(row.querySelector(".name"), node(row.dataset.id));
});
$("#layers").addEventListener("mouseover", (e) => {
  const id = e.target.closest("[data-id]")?.dataset.id || null;
  if (id !== hover) {
    hover = id;
    drawOverlay();
  }
});
// arrastar camadas para reordenar ou mudar de pai
let dragIds = null;
$("#layers").addEventListener("dragstart", (e) => {
  const id = e.target.closest("[data-id]")?.dataset.id;
  if (!id) return;
  dragIds = selection.includes(id) ? roots().map((n) => n.id) : [id];
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", id);
});
const zoneOf = (e, row) => {
  const r = row.getBoundingClientRect(),
    y = (e.clientY - r.top) / r.height;
  const n = node(row.dataset.id);
  const container = n && ["frame", "section", "group"].includes(n.type);
  return container ? (y < 0.25 ? "before" : y > 0.75 ? "after" : "inside") : y < 0.5 ? "before" : "after";
};
$("#layers").addEventListener("dragover", (e) => {
  const row = e.target.closest("[data-id]");
  if (!dragIds || !row) return;
  e.preventDefault();
  document.querySelectorAll(".layer[class*=drop-]").forEach((r) => r.classList.remove("drop-before", "drop-after", "drop-inside"));
  row.classList.add("drop-" + zoneOf(e, row));
});
$("#layers").addEventListener("dragleave", (e) => e.target.closest?.("[data-id]")?.classList.remove("drop-before", "drop-after", "drop-inside"));
$("#layers").addEventListener("drop", (e) => {
  const row = e.target.closest("[data-id]");
  const ids = dragIds;
  dragIds = null;
  if (!row || !ids) return;
  e.preventDefault();
  const zone = zoneOf(e, row);
  const target = node(row.dataset.id);
  if (ids.some((id) => id === target.id || M.find(node(id)?.children || [], target.id))) return renderLayers();
  change(() => {
    const boxes = new Map(ids.map((id) => [id, worldBox(id)]));
    const moving = ids.map(node);
    moving.forEach((n) => removeNode(n.id));
    let parent, index;
    if (zone === "inside") {
      parent = target;
      index = target.children.length;
    } else {
      const l = loc(target.id);
      parent = l.parent;
      // a lista de camadas aparece de trás para frente, menos dentro de layout automático
      const natural = M.isFlex(parent);
      index = (zone === "before") === natural ? l.index : l.index + 1;
    }
    const o = originOf(parent?.id);
    for (const n of moving) {
      const b = boxes.get(n.id);
      if (b && !M.isFlex(parent)) {
        n.x = b.x - o.x;
        n.y = b.y - o.y;
      }
    }
    (parent ? parent.children : page().nodes).splice(index, 0, ...moving);
    selection = ids;
  });
});
$("#layers").addEventListener("dragend", () => {
  dragIds = null;
  renderLayers();
});

function renderComponents() {
  const list = M.components(doc);
  $("#components").innerHTML = list.length
    ? list.map(({ node: n }) => `<div class="comp-row" data-action="insert-instance" data-ref="${n.id}" data-tip="Clique para inserir uma cópia">${icon("component", 14)}<span>${M.escapeHTML(n.name)}</span>${icon("plus", 13)}</div>`).join("")
    : '<p class="empty-note">Selecione algo e use Ctrl+Alt+K para criar um componente reutilizável.</p>';
}

// ------------------------------------------------------------------ inspetor (painel da direita)
const same = (ns, get) => {
  const v = ns.map(get);
  return v.every((x) => x === v[0]) ? v[0] : "";
};
const r2 = (v) => (v === "" ? "" : Math.round(v * 100) / 100);
const fld = (label, prop, value, opts = "") => `<label class="field"><span>${label}</span><input type="number" data-prop="${prop}" value="${value}" ${value === "" ? 'placeholder="Misto"' : ""} ${opts}></label>`;
const seg = (prop, value, items) =>
  `<span class="seg">${items.map(([v, ic, tip]) => `<button class="${value === v ? "on" : ""}" data-set="${prop}" data-value="${v}" data-tip="${tip}" aria-label="${tip}">${ic.startsWith("<") ? ic : icon(ic, 14)}</button>`).join("")}</span>`;
const colorRow = (prop, value, withToggle = true) => {
  const c = value ? M.color(value) : { c: "#000000", a: 1 };
  return `<div class="color-row"><input type="color" data-prop="${prop}" value="${c.c}" aria-label="Cor"><label class="field"><span>#</span><input type="text" data-prop="${prop}" data-hex value="${value ? c.c.slice(1) : ""}" placeholder="Misto" maxlength="7" spellcheck="false"></label><label class="field" style="max-width:74px"><span>%</span><input type="number" data-prop="${prop}" data-alpha min="0" max="100" value="${value ? Math.round(c.a * 100) : ""}"></label></div>`;
};

function renderInspector() {
  const el = $("#inspector");
  if (document.activeElement && el.contains(document.activeElement) && document.activeElement.matches("input[type=text],input[type=number],textarea")) return;
  const ns = sel();
  if (!ns.length) {
    const b = M.artboards(doc).filter((a) => a.page.id === pageId).length;
    el.innerHTML = `<div class="insp-head"><b>${M.escapeHTML(page().name)}</b><span class="kind">${page().nodes.length} camada(s) · ${b} prancheta(s)</span></div>
    <div class="hint">
      <p><b>Como fazer um site:</b> crie uma prancheta (<kbd>F</kbd>), coloque textos, formas e imagens dentro. Cada prancheta vira uma página do site.</p>
      <p><b>Para ficar bom no celular:</b> selecione os itens e aperte <kbd>Shift</kbd>+<kbd>A</kbd> (layout automático). Eles se organizam sozinhos.</p>
      <p><b>Links entre páginas:</b> selecione um botão e escolha a prancheta em "Link". Teste em Visualizar.</p>
      <p><b>Vetores:</b> <kbd>P</kbd> caneta (clique = ponto reto, arraste = curva), duplo clique num vetor edita os pontos. Selecione 2 formas para unir/subtrair.</p>
      <p><b>Agentes de IA:</b> conecte em <code>http://localhost:${location.port || 80}/mcp</code>. O que o agente fizer aparece aqui na hora.</p>
    </div>`;
    return;
  }
  const n = ns[0],
    single = ns.length === 1,
    allType = (t) => ns.every((x) => x.type === t);
  const parent = single ? parentOf(n.id) : null;
  const inFlex = ns.every((x) => M.isFlex(parentOf(x.id)));
  const boxes = ns.map((x) => worldBox(x.id) || x);
  const o = ns.map((x) => originOf(parentOf(x.id)?.id));
  let h = `<div class="insp-head">${icon(n.component ? "component" : TYPE_ICON[n.type], 16)}<input data-prop="name" value="${single ? M.escapeHTML(n.name) : ""}" placeholder="${ns.length} camadas" aria-label="Nome"><span class="kind">${single ? M.TYPE_NAMES[n.type] : ""}</span></div>`;

  // posição e tamanho
  h += `<div class="sec"><h4>Posição e tamanho ${inFlex ? '<span class="muted">no layout automático</span>' : ""}</h4><div class="grid2">
    <label class="field${inFlex ? " disabled" : ""}"><span>X</span><input type="number" data-prop="x" value="${r2(same(ns, (x, i) => x.x))}" step="1"></label>
    <label class="field${inFlex ? " disabled" : ""}"><span>Y</span><input type="number" data-prop="y" value="${r2(same(ns, (x) => x.y))}" step="1"></label>
    ${fld("L", "w", r2(same(ns.map((x, i) => ({ v: boxes[i].w })), (x) => x.v)), 'min="1"')}
    ${fld("A", "h", r2(same(ns.map((x, i) => ({ v: boxes[i].h })), (x) => x.v)), 'min="1"')}
    ${fld("↻", "rotation", r2(same(ns, (x) => x.rotation)), 'step="1"')}
    ${fld("Raio", "radius", r2(same(ns, (x) => x.radius)), 'min="0"' + (ns.some((x) => ["rect", "frame", "image", "instance"].includes(x.type)) ? "" : " disabled"))}
  </div>`;
  if (inFlex) h += `<label class="check"><input type="checkbox" data-prop="grow" ${same(ns, (x) => x.grow) ? "checked" : ""}> Ocupar o espaço que sobra</label>`;
  if (!inFlex && ns.length > 0) {
    h += `<div class="line btn-row icons" style="margin-top:8px">${[
      ["l", "alignLeft", "Alinhar à esquerda (Alt+A)"],
      ["c", "alignHCenter", "Centralizar na horizontal (Alt+H)"],
      ["r", "alignRight", "Alinhar à direita (Alt+D)"],
      ["t", "alignTop", "Alinhar ao topo (Alt+W)"],
      ["m", "alignVCenter", "Centralizar na vertical (Alt+V)"],
      ["b", "alignBottom", "Alinhar embaixo (Alt+S)"],
      ["dh", "distH", "Distribuir na horizontal"],
      ["dv", "distV", "Distribuir na vertical"],
    ]
      .map(([how, ic, tip]) => `<button class="icon-btn" data-action="align" data-how="${how}" data-tip="${tip}" aria-label="${tip}" ${(how[0] === "d" && ns.length < 3) || (single && !parent) ? "disabled" : ""}>${icon(ic, 15)}</button>`)
      .join("")}</div>`;
  }
  h += `</div>`;

  // layout automático (prancheta)
  if (single && n.type === "frame") {
    const l = n.layout;
    h += `<div class="sec"><h4>Layout automático ${seg("layout.mode", l.mode, [
      ["none", "noLayout", "Livre (posições fixas)"],
      ["row", "row", "Em linha (lado a lado)"],
      ["column", "column", "Em coluna (um embaixo do outro)"],
    ])}</h4>`;
    if (l.mode !== "none") {
      h += `<div class="grid2">${fld("Espaço", "layout.gap", l.gap, 'min="0"')}${fld("Margem", "layout.padding", l.padding, 'min="0"')}</div>
      <div class="line"><label>Alinhar</label><select data-prop="layout.align">${[
        ["start", "Início"],
        ["center", "Centro"],
        ["end", "Fim"],
        ["stretch", "Esticar"],
      ].map(([v, t]) => `<option value="${v}" ${l.align === v ? "selected" : ""}>${t}</option>`)}</select></div>
      <div class="line"><label>Distribuir</label><select data-prop="layout.justify">${[
        ["start", "Início"],
        ["center", "Centro"],
        ["end", "Fim"],
        ["space-between", "Espalhar"],
      ].map(([v, t]) => `<option value="${v}" ${l.justify === v ? "selected" : ""}>${t}</option>`)}</select></div>
      <label class="check"><input type="checkbox" data-prop="layout.wrap" ${l.wrap ? "checked" : ""}> Quebrar linha quando não couber (bom para celular)</label>
      <label class="check"><input type="checkbox" data-prop="hugWidth" ${n.hugWidth ? "checked" : ""}> Largura acompanha o conteúdo</label>
      <label class="check"><input type="checkbox" data-prop="hugHeight" ${n.hugHeight ? "checked" : ""}> Altura acompanha o conteúdo</label>`;
    } else h += `<p class="muted" style="margin:0">Dica: <kbd>Shift</kbd>+<kbd>A</kbd> liga o layout automático.</p>`;
    h += `<label class="check"><input type="checkbox" data-prop="clip" ${n.clip ? "checked" : ""}> Cortar o que passar da borda</label></div>`;
  }

  // texto
  if (ns.every((x) => x.type === "text")) {
    const v = (k) => same(ns, (x) => x[k]);
    h += `<div class="sec"><h4>Texto</h4>
    <div class="line"><select data-prop="fontFamily" style="flex:1">${M.FONTS.map((f) => `<option ${v("fontFamily") === f ? "selected" : ""}>${f}</option>`).join("")}${!M.FONTS.includes(v("fontFamily")) && v("fontFamily") ? `<option selected>${M.escapeHTML(v("fontFamily"))}</option>` : ""}</select></div>
    <div class="grid3" style="margin-top:6px">${fld("Tam", "fontSize", r2(v("fontSize")), 'min="1"')}${fld("Linha", "lineHeight", r2(v("lineHeight")), 'min="0.5" step="0.1"')}${fld("Esp", "letterSpacing", r2(v("letterSpacing")), 'step="0.5"')}</div>
    <div class="line" style="justify-content:space-between">
      ${seg("bold", v("bold"), [[true, "bold", "Negrito"]]).replace('data-value="true"', `data-value="${!v("bold")}"`)}
      ${seg("italic", v("italic"), [[true, "italic", "Itálico"]]).replace('data-value="true"', `data-value="${!v("italic")}"`)}
      ${seg("align", v("align"), [
        ["left", "textLeft", "Alinhar à esquerda"],
        ["center", "textCenter", "Centralizar"],
        ["right", "textRight", "Alinhar à direita"],
      ])}
    </div>
    <div class="line"><label>Tamanho da caixa</label><select data-prop="sizing">${[
      ["auto", "Ajusta ao texto"],
      ["width", "Largura fixa"],
      ["fixed", "Fixo"],
    ].map(([k, t]) => `<option value="${k}" ${v("sizing") === k ? "selected" : ""}>${t}</option>`)}</select></div>
    ${single ? `<textarea class="text-edit" data-prop="text" aria-label="Texto">${M.escapeHTML(n.text)}</textarea>` : ""}
    </div>`;
  }

  // aparência
  const fillable = ns.filter((x) => !["group", "image", "instance"].includes(x.type) && !(x.type === "path" && !x.closed));
  h += `<div class="sec"><h4>Aparência</h4><div class="grid2">${fld("Opac. %", "opacity", same(ns, (x) => Math.round(x.opacity * 100)), 'min="0" max="100"')}</div>`;
  if (fillable.length) h += `<h4 style="margin-top:10px">${ns.every((x) => x.type === "text") ? "Cor do texto" : "Preenchimento"}</h4>${colorRow("fill", same(fillable, (x) => x.fill))}`;
  if (ns.some((x) => x.type !== "group" && x.type !== "text"))
    h += `<h4 style="margin-top:10px">Contorno</h4>${colorRow("stroke", same(ns, (x) => x.stroke))}<div class="grid2" style="margin-top:6px">${fld("Espessura", "strokeWidth", r2(same(ns, (x) => x.strokeWidth)), 'min="0" step="0.5"')}</div>`;
  if (ns.every((x) => x.type === "polygon" || x.type === "star")) h += `<div class="grid2" style="margin-top:6px">${fld("Pontas", "count", same(ns, (x) => x.count), 'min="3" max="60"')}</div>`;
  if (ns.every((x) => x.type === "image"))
    h += `<div class="line"><label>Encaixe</label><select data-prop="fit">${[
      ["cover", "Preencher (corta)"],
      ["contain", "Caber inteira"],
      ["fill", "Esticar"],
    ].map(([k, t]) => `<option value="${k}" ${same(ns, (x) => x.fit) === k ? "selected" : ""}>${t}</option>`)}</select></div>`;
  h += `<label class="check"><input type="checkbox" data-prop="shadow" ${same(ns, (x) => x.shadow) ? "checked" : ""}> Sombra</label></div>`;

  // vetor e combinação
  const shapes = ns.every((x) => ["rect", "ellipse", "polygon", "star", "path", "boolean"].includes(x.type));
  if (shapes) {
    h += `<div class="sec"><h4>Vetor</h4><div class="btn-row">`;
    if (single && ["path", "polygon", "star", "rect", "ellipse"].includes(n.type)) h += `<button data-action="edit-points" data-icon="pen">Editar pontos</button>`;
    if (single && n.type === "path") h += `<label class="check" style="margin:0"><input type="checkbox" data-prop="closed" ${n.closed ? "checked" : ""}> Fechado</label>`;
    h += `</div>`;
    if (ns.length > 1 || (single && n.type === "boolean")) {
      h += `<div class="line btn-row icons">${[
        ["union", "Unir"],
        ["subtract", "Subtrair"],
        ["intersect", "Interseção"],
        ["exclude", "Excluir sobreposição"],
      ]
        .map(([op, t]) => `<button class="icon-btn${single && n.op === op ? " on" : ""}" ${single ? `data-set="op" data-value="${op}"` : `data-action="${op}"`} data-tip="${t}" aria-label="${t}">${icon(op, 18)}</button>`)
        .join("")}${single ? `<button data-action="ungroup">Separar</button>` : ""}</div>`;
    }
    h += `</div>`;
  }

  // componentes
  if (single && (n.component || n.type === "instance" || n.type === "frame" || n.type === "group")) {
    h += `<div class="sec"><h4>Componente</h4><div class="btn-row">`;
    if (n.type === "instance") h += `<button data-action="goto-master">Ir para o original</button><button data-action="detach">Desvincular</button>`;
    else if (n.component) h += `<button data-action="insert-instance" data-ref="${n.id}">Inserir cópia</button><button data-action="component">Deixar de ser componente</button>`;
    else h += `<button data-action="component" data-icon="component">Transformar em componente</button>`;
    h += `</div></div>`;
  }

  // link (protótipo)
  if (single && n.type !== "section") {
    const boards = M.artboards(doc).filter(({ frame }) => frame.id !== n.id);
    const isUrl = /^https?:/.test(n.link);
    h += `<div class="sec"><h4>Link ${icon("link", 13)}</h4><select data-prop="link-kind" style="width:100%"><option value="">Sem link</option>${boards.map(({ frame, page: p }) => `<option value="${frame.id}" ${n.link === frame.id ? "selected" : ""}>Ir para: ${M.escapeHTML(frame.name)}${doc.pages.length > 1 ? ` (${M.escapeHTML(p.name)})` : ""}</option>`).join("")}<option value="url" ${isUrl ? "selected" : ""}>Endereço da internet…</option></select>${isUrl ? `<label class="field" style="margin-top:6px"><span>URL</span><input type="text" data-prop="link" value="${M.escapeHTML(n.link)}"></label>` : ""}</div>`;
  }

  // organizar e exportar
  h += `<div class="sec"><h4>Organizar</h4><div class="btn-row">
    <button data-action="front" data-tip="Ctrl+Shift+]">Para frente</button><button data-action="back" data-tip="Ctrl+Shift+[">Para trás</button>
    <button data-action="duplicate" data-tip="Ctrl+D">Duplicar</button>
    ${ns.length > 1 ? '<button data-action="group" data-tip="Ctrl+G">Agrupar</button>' : ""}
    ${ns.some((x) => ["group", "frame", "section", "boolean"].includes(x.type)) ? '<button data-action="ungroup" data-tip="Ctrl+Shift+G">Desagrupar</button>' : ""}
    <button data-action="autolayout" data-tip="Shift+A">${single && n.type === "frame" ? (M.isFlex(n) ? "Tirar layout automático" : "Layout automático") : "Organizar em layout"}</button>
    <button class="danger" data-action="delete" data-tip="Delete">Excluir</button>
  </div></div>
  <div class="sec"><h4>Exportar</h4><div class="btn-row">
    <button data-action="export-svg">SVG</button><button data-action="export-png">PNG 2×</button>
    ${single && n.type === "frame" && isArtboard(n) ? '<button data-action="export-html">Página HTML</button>' : ""}
  </div></div>`;
  el.innerHTML = h;
  el.querySelectorAll("[data-icon]").forEach((b) => b.insertAdjacentHTML("afterbegin", icon(b.dataset.icon, 14)));
  void o;
}

let inspBefore = null;
$("#inspector").addEventListener("focusin", () => (inspBefore = snapshot()));
$("#inspector").addEventListener("input", (e) => {
  const t = e.target;
  if (t.type === "color") applyProp(t, true);
});
$("#inspector").addEventListener("change", (e) => {
  applyProp(e.target, false);
});
$("#inspector").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches("input")) e.target.blur();
  if (e.key === "Escape") e.target.blur();
});
$("#inspector").addEventListener("click", (e) => {
  const b = e.target.closest("[data-set]");
  if (!b) return;
  let v = b.dataset.value;
  if (v === "true" || v === "false") v = v === "true";
  inspBefore = snapshot();
  setProp(b.dataset.set, v);
  finishInspector();
});
function finishInspector() {
  if (inspBefore !== null) commit(inspBefore);
  inspBefore = snapshot();
  render();
}
function applyProp(t, live) {
  const prop = t.dataset.prop;
  if (!prop) return;
  if (inspBefore === null) inspBefore = snapshot();
  let v;
  if (t.type === "checkbox") v = t.checked;
  else if (t.type === "number") {
    if (t.value === "") return;
    v = Number(t.value);
    if (!Number.isFinite(v)) return render();
  } else v = t.value;
  if (t.dataset.hex !== undefined) {
    v = v.replace(/^#/, "").trim();
    if (/^[0-9a-f]{3}$/i.test(v)) v = v.replace(/./g, (c) => c + c);
    if (!/^[0-9a-f]{6}$/i.test(v)) return render();
    v = "#" + v.toLowerCase();
  }
  if (t.dataset.alpha !== undefined) return setAlpha(prop, Math.max(0, Math.min(100, v))), live ? renderCanvas() : finishInspector();
  setProp(prop, v);
  if (live) renderCanvas();
  else finishInspector();
}
function setAlpha(prop, pct) {
  for (const n of sel()) {
    const c = M.color(n[prop]).c;
    n[prop] = pct >= 100 ? c : c + Math.round((pct / 100) * 255).toString(16).padStart(2, "0");
  }
}
function setProp(prop, v) {
  const ns = sel().filter((n) => !n.locked || prop === "name");
  for (const n of ns) {
    if (prop === "name") {
      if (v.trim()) n.name = v.trim().slice(0, 200);
    } else if (prop.startsWith("layout.")) {
      const k = prop.slice(7);
      if (k === "mode" && v !== "none" && n.layout.mode === "none") n.hugHeight = true;
      if (k === "mode" && v === "none") {
        const fb = worldBox(n.id);
        n.children.forEach((c) => {
          const b = worldBox(c.id);
          c.x = b.x - fb.x;
          c.y = b.y - fb.y;
        });
      }
      n.layout[k] = typeof n.layout[k] === "number" ? Math.max(0, v) : v;
    } else if (prop === "fill" || prop === "stroke") {
      const a = M.color(n[prop]).a;
      n[prop] = a < 1 ? v + Math.round(a * 255).toString(16).padStart(2, "0") : v;
    } else if (prop === "opacity") n.opacity = Math.max(0, Math.min(100, v)) / 100;
    else if (prop === "x" || prop === "y") n[prop] = v;
    else if (prop === "w" || prop === "h") {
      v = Math.max(1, v);
      const b = worldBox(n.id);
      const old = prop === "w" ? b.w : b.h;
      if (n.type === "text") n.sizing = prop === "w" ? (n.sizing === "fixed" ? "fixed" : "width") : "fixed";
      if (["path", "group", "boolean"].includes(n.type)) M.scaleNode(n, prop === "w" ? v / old : 1, prop === "h" ? v / old : 1);
      n[prop] = v;
      if (M.isFlex(n) && prop === "h") n.hugHeight = false;
      if (M.isFlex(n) && prop === "w") n.hugWidth = false;
    } else if (prop === "link-kind") n.link = v === "url" ? "https://" : v;
    else if (prop === "link") n.link = /^https?:\/\/[^\s"'<>]+$/.test(v) ? v : n.link;
    else if (["radius", "strokeWidth", "fontSize", "lineHeight"].includes(prop)) n[prop] = Math.max(prop === "fontSize" ? 1 : prop === "lineHeight" ? 0.5 : 0, v);
    else if (prop === "count") n.count = Math.max(3, Math.min(60, Math.round(v)));
    else if (prop === "closed") {
      n.closed = v;
      M.refitPath(n);
    } else if (prop === "text") n.text = v;
    else n[prop] = v;
  }
}

// ------------------------------------------------------------------ ajuda
const HELP = [
  ["Ferramentas"],
  ["Mover / selecionar", "V"],
  ["Mão (mover a tela)", "H ou Espaço"],
  ["Prancheta (página do site)", "F"],
  ["Seção", "S"],
  ["Retângulo / Elipse / Linha", "R / E / L"],
  ["Caneta (vetor com curvas)", "P"],
  ["Lápis (traço livre)", "B"],
  ["Texto", "T"],
  ["Imagem", "I (ou arraste/cole)"],
  ["Editar"],
  ["Desfazer / Refazer", "Ctrl+Z / Ctrl+Shift+Z"],
  ["Copiar / Colar / Recortar", "Ctrl+C / V / X"],
  ["Duplicar", "Ctrl+D (ou Alt + arrastar)"],
  ["Agrupar / Desagrupar", "Ctrl+G / Ctrl+Shift+G"],
  ["Layout automático", "Shift+A"],
  ["Criar componente", "Ctrl+Alt+K"],
  ["Trazer para frente / mandar para trás", "Ctrl+] / Ctrl+["],
  ["Mover 1 px / 10 px", "Setas / Shift+Setas"],
  ["Selecionar tudo no nível", "Ctrl+A"],
  ["Entrar no grupo / sair", "Enter / Esc"],
  ["Editar texto ou pontos", "Duplo clique ou Enter"],
  ["Selecionar algo lá dentro", "Ctrl + clique"],
  ["Alinhar esq./dir./topo/baixo", "Alt+A / D / W / S"],
  ["Tela"],
  ["Zoom", "Ctrl + roda, Ctrl + / −"],
  ["Ver tudo / ver seleção", "Shift+1 / Shift+2"],
  ["Zoom 100%", "Ctrl+0"],
  ["Desenhar"],
  ["Proporção fixa / do centro", "Shift / Alt ao arrastar"],
  ["Girar de 15 em 15°", "Shift ao girar"],
  ["Terminar a caneta", "Enter, Esc ou clique no 1º ponto"],
  ["Salvar agora", "Ctrl+S"],
];
function openHelp() {
  $("#help-body").innerHTML = HELP.map(([a, b]) => (b ? `<div><span>${a}</span><kbd>${b}</kbd></div>` : `<h5>${a}</h5>`)).join("");
  $("#help").showModal();
}

// ------------------------------------------------------------------ montar a interface
$("#brand").innerHTML = `<span class="logo">${icon("logo", 16)}</span>Stylo`;
document.querySelectorAll("[data-action=undo]").forEach((b) => (b.innerHTML = icon("undo", 16)));
document.querySelectorAll("[data-action=redo]").forEach((b) => (b.innerHTML = icon("redo", 16)));
$("[data-action=help]").innerHTML = icon("help", 16);
$("[data-action=add-page]").innerHTML = icon("plus", 14);
$("[data-action=zoomin]").innerHTML = icon("plus", 14);
$("[data-action=zoomout]").innerHTML = icon("minus", 14);
$("[data-action=fit]").innerHTML = icon("fit", 14);
document.querySelectorAll("[data-action=close-dialog]").forEach((b) => (b.innerHTML = icon("x", 16)));
document.querySelectorAll("button[data-icon]").forEach((b) => b.insertAdjacentHTML("afterbegin", icon(b.dataset.icon, 15)));
$("#toolbar").innerHTML = TOOLS.map((t) => (t === "|" ? '<span class="sep"></span>' : `<button data-tool="${t[0]}" data-tip="${t[2]}${t[3] ? " (" + t[3] + ")" : ""}" aria-label="${t[2]}">${icon(t[1], 18)}</button>`)).join("");
$("#toolbar").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tool]");
  if (b) setTool(b.dataset.tool);
});
setTool("move");
render();
boot();

// para testes automáticos e depuração
window.stylo = { get doc() { return doc; }, get selection() { return selection; }, worldBox, act, setTool, render };
