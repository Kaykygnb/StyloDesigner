// Servidor local do Stylo: entrega o editor, guarda os projetos em arquivos
// .json na pasta "projetos" e abre a porta MCP para agentes de IA.
import http from "node:http";
import { readFile, writeFile, readdir, rename, mkdir, stat, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validate, fresh, uid } from "./model.js";
import { TOOLS, INSTRUCTIONS, callTool } from "./agent.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const DATA = path.resolve(process.env.STYLO_DATA || path.join(root, "projetos"));
const MAX_BODY = 60 * 1024 * 1024;
const FILES = new Map(
  ["index.html", "app.js", "model.js", "icons.js", "styles.css", "tokens.css", "favicon.svg"].map((f) => [
    f,
    { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" }[path.extname(f)],
  ]),
);
const ID = /^[a-z0-9-]{1,64}$/;

// ------------------------------------------------------------------ projetos em arquivo

const file = (id) => path.join(DATA, id + ".json");
const revs = new Map(); // id -> número da versão, para detectar conflito
const listeners = new Map(); // id -> Set(res) de quem acompanha mudanças

export const store = {
  async list() {
    await mkdir(DATA, { recursive: true });
    const out = [];
    for (const f of await readdir(DATA)) {
      if (!f.endsWith(".json")) continue;
      const id = f.slice(0, -5);
      if (!ID.test(id)) continue;
      try {
        const doc = JSON.parse(await readFile(file(id), "utf8"));
        out.push({ id, title: doc.title, pages: doc.pages?.length || 0, updatedAt: (await stat(file(id))).mtime.toISOString() });
      } catch {
        /* arquivo corrompido fica fora da lista */
      }
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async read(id) {
    if (!ID.test(String(id))) throw httpError(400, "Id de projeto inválido");
    let text;
    try {
      text = await readFile(file(id), "utf8");
    } catch {
      throw httpError(404, "Projeto não encontrado");
    }
    const doc = validate(JSON.parse(text));
    if (!revs.has(id)) revs.set(id, 1);
    return { doc, rev: revs.get(id) };
  },
  async write(id, doc, by = "editor") {
    if (!ID.test(String(id))) throw httpError(400, "Id de projeto inválido");
    await mkdir(DATA, { recursive: true });
    const target = file(id);
    try {
      await copyFile(target, target + ".bak"); // uma cópia da versão anterior, por segurança
    } catch {
      /* primeiro salvamento */
    }
    const tmp = `${target}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(doc));
    await rename(tmp, target);
    const rev = (revs.get(id) || 1) + 1;
    revs.set(id, rev);
    for (const res of listeners.get(id) || []) res.write(`event: change\ndata: ${JSON.stringify({ rev, by })}\n\n`);
    return rev;
  },
  async create(doc, by) {
    const id = uid().slice(0, 8) + "-" + Date.now().toString(36);
    await this.write(id, validate(doc), by);
    return { id, rev: revs.get(id) };
  },
  async remove(id) {
    if (!ID.test(String(id))) throw httpError(400, "Id de projeto inválido");
    await rename(file(id), `${file(id)}.apagado-${Date.now()}`); // não apaga de verdade: renomeia
  },
};
// PNG pedido por um agente: quem desenha é o editor aberto no navegador.
const renders = new Map(); // id do pedido -> { project, resolve, reject, timer }
store.render = function (id, ids, scale) {
  const open = listeners.get(id);
  if (!open?.size) return Promise.reject(new Error(`Para gerar PNG, abra este projeto no Stylo (http://localhost:${PORT}). O PNG é desenhado pelo navegador. Enquanto isso, export_svg funciona sem o editor aberto.`));
  const req = uid().slice(0, 12);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      renders.delete(req);
      reject(new Error("O editor não respondeu a tempo. Confira se o Stylo está aberto e tente de novo."));
    }, 20000);
    renders.set(req, { project: id, resolve, reject, timer });
    const data = JSON.stringify({ req, ids, scale, rev: revs.get(id) || 1 });
    for (const res of open) res.write(`event: render\ndata: ${data}\n\n`);
  });
};
// arquivos exportados (PNG/SVG) ficam em projetos/exportados
store.saveExport = async function (name, content) {
  const dir = path.join(DATA, "exportados");
  await mkdir(dir, { recursive: true });
  const ext = path.extname(name);
  const base = (path.basename(name, ext).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "arquivo").slice(0, 60);
  const full = path.join(dir, base + ext);
  await writeFile(full, content);
  return full;
};
function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// ------------------------------------------------------------------ HTTP

const send = (res, status, body, type = "application/json; charset=utf-8") => {
  res.writeHead(status, { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
};
async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw httpError(413, "Arquivo grande demais (máximo 60 MB)");
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw httpError(400, "JSON inválido");
  }
}

// Só aceita pedidos feitos para este computador e, quando vêm de um navegador,
// só da própria página do Stylo (evita que um site qualquer mexa nos projetos).
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
function allowed(req) {
  if (process.env.STYLO_ALLOW_REMOTE === "1") return true;
  const host = (req.headers.host || "").replace(/:\d+$/, "");
  if (!localHosts.has(host)) return false;
  const origin = req.headers.origin;
  if (!origin || origin === "null") return !origin;
  try {
    const u = new URL(origin);
    return localHosts.has(u.hostname) && (u.port || "80") === String(req.headers.host.split(":")[1] || "80");
  } catch {
    return false;
  }
}

async function mcp(req, res) {
  const msg = await body(req);
  const one = async (m) => {
    if (m.id === undefined) return null; // notificação
    const ok = (result) => ({ jsonrpc: "2.0", id: m.id, result });
    const err = (code, message) => ({ jsonrpc: "2.0", id: m.id, error: { code, message } });
    if (m.method === "initialize")
      return ok({ protocolVersion: m.params?.protocolVersion || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "stylo", title: "Stylo", version: "2.0.0" }, instructions: INSTRUCTIONS });
    if (m.method === "ping") return ok({});
    if (m.method === "tools/list") return ok({ tools: TOOLS });
    if (m.method === "tools/call") {
      try {
        const out = await callTool(store, m.params?.name, m.params?.arguments || {});
        if (out?.image) return ok({ content: [{ type: "image", data: out.image, mimeType: "image/png" }, { type: "text", text: out.text }] });
        return ok({ content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out, null, 2) }] });
      } catch (e) {
        return ok({ content: [{ type: "text", text: "Erro: " + e.message }], isError: true });
      }
    }
    return err(-32601, "Método não encontrado: " + m.method);
  };
  const out = Array.isArray(msg) ? (await Promise.all(msg.map(one))).filter(Boolean) : await one(msg);
  if (!out || (Array.isArray(out) && !out.length)) {
    res.writeHead(202);
    return res.end();
  }
  send(res, 200, out);
}

async function api(req, res, parts) {
  const [, , id, extra] = parts; // /api/projects/:id/events
  if (parts[1] === "health") return send(res, 200, { ok: true, data: DATA });
  if (parts[1] !== "projects") throw httpError(404, "Não encontrado");
  if (!id) {
    if (req.method === "GET") return send(res, 200, await store.list());
    if (req.method === "POST") {
      const b = await body(req);
      const doc = b.doc ? validate(b.doc) : fresh(String(b.title || "Sem título"));
      return send(res, 201, { ...(await store.create(doc, "editor")), doc });
    }
  }
  if (id && extra === "renders" && parts[4] && req.method === "POST") {
    const r = renders.get(parts[4]);
    if (!r || r.project !== id) throw httpError(404, "Pedido de PNG não encontrado");
    const b = await body(req);
    renders.delete(parts[4]);
    clearTimeout(r.timer);
    if (typeof b.png === "string" && b.png.startsWith("data:image/png;base64,")) r.resolve(Buffer.from(b.png.slice(22), "base64"));
    else r.reject(new Error(String(b.error || "O editor não devolveu o PNG")));
    return send(res, 200, { ok: true });
  }
  if (id && extra === "events" && req.method === "GET") {
    await store.read(id);
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    res.write(": ok\n\n");
    if (!listeners.has(id)) listeners.set(id, new Set());
    listeners.get(id).add(res);
    const ping = setInterval(() => res.write(": ping\n\n"), 25000);
    req.on("close", () => {
      clearInterval(ping);
      listeners.get(id)?.delete(res);
    });
    return;
  }
  if (id && !extra) {
    if (req.method === "GET") return send(res, 200, await store.read(id));
    if (req.method === "PUT") {
      const b = await body(req);
      const current = await store.read(id).catch(() => null);
      if (current && b.rev !== undefined && b.rev !== current.rev) return send(res, 409, { error: "O projeto mudou enquanto você editava", ...current });
      const doc = validate(b.doc);
      return send(res, 200, { rev: await store.write(id, doc, String(req.headers["x-client"] || "editor").slice(0, 60)) });
    }
    if (req.method === "DELETE") {
      await store.remove(id);
      return send(res, 200, { ok: true });
    }
  }
  throw httpError(405, "Método não permitido");
}

export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (parts[0] === "api" || parts[0] === "mcp") {
      if (!allowed(req)) throw httpError(403, "Acesso só pelo próprio computador");
      if (parts[0] === "mcp") {
        if (req.method !== "POST") throw httpError(405, "Use POST");
        return await mcp(req, res);
      }
      return await api(req, res, parts);
    }
    if (!["GET", "HEAD"].includes(req.method)) throw httpError(405, "Método não permitido");
    const name = parts.join("/") || "index.html";
    if (!FILES.has(name)) throw httpError(404, "Não encontrado");
    const data = await readFile(path.join(root, name));
    res.writeHead(200, { "Content-Type": FILES.get(name), "X-Content-Type-Options": "nosniff", "Cache-Control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch (e) {
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : "Erro interno: " + e.message });
    else res.end();
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  server.listen(PORT, HOST, () => {
    console.log(`\n  Stylo rodando em  http://localhost:${PORT}`);
    console.log(`  Projetos salvos em ${DATA}`);
    console.log(`  Agentes (MCP):    http://localhost:${PORT}/mcp\n`);
  });
