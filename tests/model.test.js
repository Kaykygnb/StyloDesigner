import test from "node:test";
import assert from "node:assert/strict";
import * as M from "../model.js";

const text = (props = {}) => ({ ...M.defaults("text"), id: "t1", text: "Olá", ...props });
const frame = (props = {}) => ({ ...M.defaults("frame"), id: "f1", name: "Início", w: 1280, h: 800, ...props });
const docWith = (...nodes) => {
  const d = M.fresh("Teste");
  d.pages[0].nodes.push(...nodes);
  return M.validate(d);
};

test("texto novo é escuro e visível em fundo branco", () => {
  const t = M.defaults("text");
  assert.equal(t.fill, "#1f2328");
  assert.match(M.cssText(t, null), /color:#1f2328/);
});

test("projeto antigo (v1) é migrado: texto claro vira escuro e linha vira vetor", () => {
  const v1 = {
    version: 1,
    title: "Antigo",
    pages: [{ id: "p1", name: "Página", nodes: [
      { id: "a", type: "text", name: "T", x: 0, y: 0, w: 100, h: 30, rotation: 0, opacity: 1, fill: "#eeeeee", text: "oi" },
      { id: "b", type: "line", name: "L", x: 10, y: 10, w: 100, h: 2, rotation: 0, opacity: 1, fill: "#000000" },
    ] }],
  };
  const d = M.validate(v1);
  assert.equal(d.version, M.VERSION);
  assert.equal(d.pages[0].nodes[0].fill, "#1f2328");
  assert.equal(d.pages[0].nodes[1].type, "path");
});

test("validate descarta campos desconhecidos e recusa cores, links e imagens perigosos", () => {
  const d = docWith(frame({ evil: "x", children: [text({ fill: "#ff000080" })] }));
  const f = d.pages[0].nodes[0];
  assert.equal(f.evil, undefined);
  assert.equal(f.children[0].fill, "#ff000080");
  assert.throws(() => docWith(frame({ fill: "red;background:url(x)" })), /Cor inválida/);
  assert.throws(() => docWith(frame({ link: "javascript:alert(1)" })));
  assert.throws(() => docWith({ ...M.defaults("image"), id: "i2", src: "https://evil.example/x.png" }), /Imagem inválida/);
  const ok = docWith({ ...M.defaults("image"), id: "i1", src: "data:image/png;base64,AAAA" });
  assert.match(ok.pages[0].nodes[0].src, /^data:image\/png/);
  assert.throws(() => M.validate({ version: 2, title: "x", pages: [] }));
});

test("HTML exportado escapa texto e começa a prancheta no canto", () => {
  const d = docWith(frame({ x: 500, y: 300, children: [text({ text: "<script>alert(1)</script>", x: 10, y: 20 })] }));
  const html = M.exportFrameHTML(d, d.pages[0].nodes[0]);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /left:500px/);
  assert.match(html, /left:10px/);
});

test("layout automático vira flexbox responsivo na exportação", () => {
  const f = frame({ hugHeight: true, layout: { ...M.defaultLayout(), mode: "column", gap: 20 }, children: [text({ fontSize: 56, sizing: "width", w: 700 })] });
  const d = docWith(f);
  const html = M.exportFrameHTML(d, d.pages[0].nodes[0]);
  assert.match(html, /display:flex/);
  assert.match(html, /flex-direction:column/);
  assert.match(html, /max-width:100%/);
  assert.match(html, /clamp\(/);
});

test("site: uma página por prancheta, a primeira é index.html, links viram href", () => {
  const a = frame({ id: "a", name: "Início", children: [text({ id: "btn", link: "b" })] });
  const b = frame({ id: "b", name: "Contato", x: 1400 });
  const d = docWith(a, b);
  const files = M.siteFiles(d);
  assert.deepEqual(files.map((f) => f.name), ["index.html", "contato.html"]);
  assert.match(files[0].content, /href="contato.html"/);
  const z = M.zip(files);
  assert.equal(String.fromCharCode(...z.slice(0, 2)), "PK");
});

test("SVG exportado é vetor de verdade (sem foreignObject) e tem o texto", () => {
  const d = docWith(frame({ children: [text({ text: "Uberlândia" }), { ...M.defaults("star"), id: "s1", x: 100, y: 100 }] }));
  const svg = M.exportSVG(d, [d.pages[0].nodes[0]]);
  assert.match(svg, /^<svg/);
  assert.doesNotMatch(svg, /foreignObject/);
  assert.match(svg, /<text[^>]*>[\s\S]*Uberlândia/);
  assert.match(svg, /<path d="M/);
});

test("crc32 confere com o valor conhecido", () => {
  assert.equal(M.crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("caminho: normalizeWorldPath põe a caixa no menor ponto", () => {
  const p = M.normalizeWorldPath([[50, 60], [150, 160]], false);
  assert.equal(p.x, 50);
  assert.equal(p.y, 60);
  assert.equal(p.w, 100);
  assert.deepEqual(p.points[1].slice(0, 2), [100, 100]);
});

test("simplify reduz traço do lápis e smooth cria alças", () => {
  const pts = Array.from({ length: 50 }, (_, i) => [i, i % 2 ? 0.1 : 0]);
  const s = M.simplify(pts, 1);
  assert.ok(s.length < 5);
  const sm = M.smooth([[0, 0], [50, 40], [100, 0]]);
  assert.equal(sm[1].length, 6);
});

test("combinar formas cria booleano com os filhos", () => {
  const r = { ...M.defaults("rect"), id: "r", x: 0, y: 0, w: 100, h: 100 };
  const e = { ...M.defaults("ellipse"), id: "e", x: 50, y: 50, w: 100, h: 100 };
  const b = M.makeBoolean([r, e], "subtract");
  assert.equal(b.type, "boolean");
  assert.equal(b.op, "subtract");
  assert.equal(b.w, 150);
  assert.equal(b.children.length, 2);
  assert.match(M.vectorSVG(b), /mask/);
});

test("location e find acham camadas aninhadas", () => {
  const d = docWith(frame({ children: [text()] }));
  const l = M.location(d.pages[0].nodes, "t1");
  assert.equal(l.parent.id, "f1");
  assert.equal(l.index, 0);
  assert.equal(M.find(d.pages[0].nodes, "t1").text, "Olá");
});

test("mergeDocs junta mudança do editor com a do agente", () => {
  const base = docWith(frame({ children: [text()] }));
  const mine = structuredClone(base);
  mine.pages[0].nodes[0].children[0].text = "Mudado no editor";
  const theirs = structuredClone(base);
  theirs.pages[0].nodes[0].children.push({ ...M.defaults("rect"), id: "novo" });
  const out = M.mergeDocs(base, mine, theirs);
  const kids = out.pages[0].nodes[0].children;
  assert.equal(kids.find((k) => k.id === "t1").text, "Mudado no editor");
  assert.ok(kids.some((k) => k.id === "novo"));
});
