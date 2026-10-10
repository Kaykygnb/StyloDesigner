// Exporta (export_html pelo MCP) as páginas de exploração e fotografa cada uma num Chromium real, com as fontes do Google.
// A Home V2 sai também em 768 e 390 px, para provar o responsivo. Uso: node scripts/identidade/exportar-paginas.mjs <pasta> id:nome[:larguras] ...
// Ex.: node scripts/identidade/exportar-paginas.mjs docs/identidade/exploracoes 35f60a81:home-v2:1440,768,390
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [out, ...alvos] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const sid = readFileSync(join(tmpdir(), 'stylo-mcp-sid.txt'), 'utf8').trim();
const call = async (name, args) => {
  const res = await fetch('http://localhost:5173/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Mcp-Session-Id': sid, 'X-Stylo-Agent': 'Claude' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }) });
  const j = await res.json();
  return (j.result?.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
};
async function exportar(id) {
  let html = '', offset = 0;
  for (let i = 0; i < 40; i++) {
    const raw = await call('export_html', { id, ...(offset ? { offset } : {}) });
    let j; try { j = JSON.parse(raw); } catch { html += raw; break; }
    html += j.content ?? j.html ?? '';
    if (j.next_offset == null && j.nextOffset == null) break;
    offset = j.next_offset ?? j.nextOffset;
    if (j.done || j.truncated === false) break;
  }
  return html;
}
const browser = await chromium.launch();
for (const alvo of alvos) {
  const [id, nome, larguras = '1440'] = alvo.split(':');
  const html = await exportar(id);
  writeFileSync(join(out, `${nome}.html`), html);
  for (const w of larguras.split(',').map(Number)) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
    await page.screenshot({ path: join(out, `${nome}${larguras.includes(',') ? `-${w}` : ''}.png`), fullPage: true });
    console.log(`${nome} @${w}px: ${html.length} bytes, rolagem horizontal: ${overflow > 1 ? overflow + 'px (!)' : 'nenhuma'}`);
    await page.close();
  }
}
await browser.close();
