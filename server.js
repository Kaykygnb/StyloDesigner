import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.dirname(fileURLToPath(import.meta.url));
const allowed = new Set([
  "index.html",
  "app.js",
  "model.js",
  "styles.css",
  "tokens.css",
]);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};
http
  .createServer(async (req, res) => {
    const file =
      new URL(req.url, "http://localhost").pathname.slice(1) || "index.html";
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    if (!allowed.has(file)) {
      res.writeHead(404);
      res.end("Não encontrado");
      return;
    }
    try {
      const body = await readFile(path.join(root, file));
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)],
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(500);
      res.end("Não foi possível abrir o editor");
    }
  })
  .listen(
    Number(process.env.PORT || 3000),
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        `Designer Estudo: http://localhost:${process.env.PORT || 3000}`,
      ),
  );
