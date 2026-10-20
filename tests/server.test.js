import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = await mkdtemp(path.join(tmpdir(), "stylo-"));
process.env.STYLO_DATA = dir;
const { server } = await import("../server.js");
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(async () => {
  server.closeAllConnections?.();
  server.close();
  await rm(dir, { recursive: true, force: true });
});

const json = async (url, opts = {}) => {
  const r = await fetch(base + url, { ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const mcp = async (method, params) => (await json("/mcp", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).body;
const tool = async (name, args) => {
  const r = await mcp("tools/call", { name, arguments: args });
  const t = r.result.content[0].text;
  if (r.result.isError) throw new Error(t);
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
};

test("salva o projeto em arquivo e detecta conflito", async () => {
  const c = await json("/api/projects", { method: "POST", body: JSON.stringify({ title: "Meu site" }) });
  assert.equal(c.status, 201);
  const { id } = c.body;
  const g = await json(`/api/projects/${id}`);
  assert.equal(g.body.doc.title, "Meu site");
  const doc = { ...g.body.doc, title: "Novo nome" };
  const p = await json(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify({ doc, rev: g.body.rev }) });
  assert.equal(p.status, 200);
  const stale = await json(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify({ doc, rev: g.body.rev }) });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.doc.title, "Novo nome");
  assert.ok((await readdir(dir)).includes(`${id}.json`));
});

test("recusa id estranho e site de fora (proteção do localhost)", async () => {
  assert.equal((await json("/api/projects/..%2F..%2Fetc")).status, 400);
  const r = await json("/api/projects", { method: "POST", body: "{}", headers: { origin: "https://site-malicioso.example" } });
  assert.equal(r.status, 403);
});

test("agente cria uma página por MCP e exporta HTML", async () => {
  const init = await mcp("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "teste", version: "1" } });
  assert.equal(init.result.serverInfo.name, "stylo");
  const tools = await mcp("tools/list", {});
  assert.ok(tools.result.tools.some((t) => t.name === "add_layers"));
  const { projectId } = await tool("create_project", { title: "Padaria" });
  await tool("add_layers", {
    projectId,
    layers: [{ type: "frame", name: "Início", layout: { mode: "column", gap: 24 }, children: [{ type: "text", text: "Pão de queijo" }, { type: "frame", layout: { mode: "row" }, children: [{ type: "text", text: "Menu" }] }] }],
  });
  const outline = await tool("get_project", { projectId });
  const root = outline.pages[0].layers[0];
  assert.equal(root.name, "Início");
  const html = await tool("export_html", { projectId });
  assert.match(html, /Pão de queijo/);
  assert.match(html, /display:flex/);
  const svg = await tool("export_svg", { projectId, ids: [root.id] });
  assert.match(svg, /^<svg/);
  await assert.rejects(tool("add_layers", { projectId, layers: [{ type: "virus" }] }));
});

test("apagar projeto não destrói o arquivo de vez", async () => {
  const { body } = await json("/api/projects", { method: "POST", body: JSON.stringify({ title: "Apagar" }) });
  assert.equal((await json(`/api/projects/${body.id}`, { method: "DELETE" })).status, 200);
  assert.equal((await json(`/api/projects/${body.id}`)).status, 404);
  assert.ok((await readdir(dir)).some((f) => f.startsWith(body.id) && f !== `${body.id}.json`));
});
