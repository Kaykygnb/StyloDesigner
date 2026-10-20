import test from "node:test";
import assert from "node:assert/strict";
import { fresh, validate, exportHTML, find, location } from "../model.js";
const node = () => ({
  id: "n1",
  type: "text",
  name: "Texto",
  x: 10,
  y: 20,
  w: 200,
  h: 30,
  rotation: 0,
  opacity: 1,
  fill: "#eeeeee",
  stroke: "#000000",
  strokeWidth: 0,
  radius: 0,
  fontSize: 24,
  fontFamily: "Arial",
  align: "left",
  text: "<script>alert(1)</script>",
});
test("projeto exportado preserva geometria e escapa texto", () => {
  const doc = fresh();
  doc.pages[0].nodes.push(node());
  validate(doc);
  const html = exportHTML(doc, doc.pages[0]);
  assert.match(html, /left:10px/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
test("importação rejeita imagens remotas e propriedades CSS injetadas", () => {
  const doc = fresh(),
    n = node();
  doc.pages[0].nodes = [n];
  n.type = "image";
  n.src = "https://example.com/a.png";
  assert.throws(() => validate(doc));
  n.type = "text";
  n.fontFamily = "Arial; background:url(x)";
  assert.throws(() => validate(doc));
});
test("localiza e remove camadas aninhadas sem alterar outras", () => {
  const n = node(),
    nodes = [{ id: "frame", children: [n] }];
  assert.equal(find(nodes, "n1"), n);
  const hit = location(nodes, "n1");
  hit.list.splice(hit.index, 1);
  assert.equal(nodes.length, 1);
  assert.equal(find(nodes, "n1"), null);
});
test("rejeita IDs duplicados e geometria inválida", () => {
  const doc = fresh();
  doc.pages[0].nodes = [node(), node()];
  assert.throws(() => validate(doc));
  doc.pages[0].nodes = [node()];
  doc.pages[0].nodes[0].w = -1;
  assert.throws(() => validate(doc));
});
