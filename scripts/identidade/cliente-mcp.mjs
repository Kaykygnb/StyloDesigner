// Cliente MCP mínimo (HTTP) do Stylo, usado para montar a identidade. Guarda o Mcp-Session-Id em um arquivo temporário.
// Cliente MCP mínimo (HTTP) para o servidor do Stylo. Uso:
//   node mcpc.mjs tools                      lista as ferramentas (nome + descrição curta)
//   node mcpc.mjs schema <ferramenta>        mostra o esquema de entrada de uma ferramenta
//   node mcpc.mjs call <ferramenta> '<json>' chama a ferramenta (resultado em texto; imagem vai para o arquivo --img)
//   node mcpc.mjs call <ferramenta> @arquivo.json   idem, lendo os argumentos de um arquivo
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_MCP = process.env.MCP_URL || 'http://localhost:5173/mcp';
const SID_FILE = join(tmpdir(), 'stylo-mcp-sid.txt');
const post = async (body, sid) => {
  const res = await fetch(URL_MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'X-Stylo-Agent': 'Claude', ...(sid ? { 'Mcp-Session-Id': sid } : {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { const m = text.match(/data: (.*)/); if (m) json = JSON.parse(m[1]); }
  return { res, json, text };
};
async function session() {
  if (existsSync(SID_FILE)) {
    const sid = readFileSync(SID_FILE, 'utf8').trim();
    const probe = await post({ jsonrpc: '2.0', id: 0, method: 'ping' }, sid);
    if (probe.res.status === 200) return sid;
  }
  const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'claude-code', version: '1.0' } } });
  const sid = init.res.headers.get('mcp-session-id');
  if (!sid) throw new Error('sem Mcp-Session-Id: ' + init.text.slice(0, 200));
  await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, sid);
  writeFileSync(SID_FILE, sid);
  return sid;
}
const [cmd, name, arg] = process.argv.slice(2);
const sid = await session();
if (cmd === 'tools' || cmd === 'schema') {
  const r = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, sid);
  const tools = r.json?.result?.tools || [];
  if (cmd === 'tools') for (const t of tools) console.log(`${t.name} — ${(t.description || '').split('\n')[0].slice(0, 110)}`);
  else console.log(JSON.stringify(tools.find((t) => t.name === name)?.inputSchema ?? 'ferramenta não encontrada', null, 1));
} else if (cmd === 'call') {
  const args = arg ? JSON.parse(arg.startsWith('@') ? readFileSync(arg.slice(1), 'utf8') : arg) : {};
  const r = await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name, arguments: args } }, sid);
  if (r.json?.error) { console.log('ERRO MCP:', JSON.stringify(r.json.error)); process.exitCode = 1; }
  for (const c of r.json?.result?.content || []) {
    if (c.type === 'text') console.log(c.text);
    else if (c.type === 'image') { const f = process.env.IMG_OUT || join(tmpdir(), 'stylo-mcp-img.png'); writeFileSync(f, Buffer.from(c.data, 'base64')); console.log('[imagem salva em ' + f + ']'); }
  }
  if (r.json?.result?.isError) process.exitCode = 1;
} else console.log('uso: tools | schema <nome> | call <nome> <json|@arquivo>');
