// Exporta o guia (export_html pelo MCP) e fotografa cada seção num Chromium real. Uso: node scripts/identidade/exportar-guia.mjs docs/identidade
// Exporta o guia (export_html pelo MCP) e fotografa cada seção num Chromium real, com as fontes do Google.
// Uso: node render.mjs <pasta-de-saída>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const sid = readFileSync(join(tmpdir(), 'stylo-mcp-sid.txt'), 'utf8').trim();
const root = readFileSync(join(tmpdir(), 'stylo-guia-root.txt'), 'utf8').trim();
const call = async (name, args) => {
  const res = await fetch('http://localhost:5173/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Mcp-Session-Id': sid, 'X-Stylo-Agent': 'Claude' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) });
  const j = await res.json();
  return (j.result?.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
};
// o export_html devolve JSON com `html` em trechos; junta tudo
let html = '', offset = 0;
for (let i = 0; i < 40; i++) {
  const raw = await call('export_html', { id: root, ...(offset ? { offset } : {}) });
  let j; try { j = JSON.parse(raw); } catch { html += raw; break; }
  html += j.content ?? j.html ?? '';
  if (j.next_offset == null && j.nextOffset == null) break;
  offset = j.next_offset ?? j.nextOffset;
  if (j.done || j.truncated === false) break;
}
writeFileSync(join(out, 'guia-de-estilo.html'), html);
console.log('html:', html.length, 'bytes');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
await page.screenshot({ path: join(out, 'guia-de-estilo.png'), fullPage: true });
const secs = await page.locator('body > div > *, body > * > *').evaluateAll((els) => els.filter((e) => ['SECTION', 'HEADER'].includes(e.tagName)).map((e) => ({ tag: e.tagName, h: Math.round(e.getBoundingClientRect().height) })));
console.log('seções:', JSON.stringify(secs));
let n = 0;
for (const el of await page.locator('section, header').all()) {
  n++;
  await el.screenshot({ path: join(out, `secao-${n}.png`) });
}
console.log('capturas por seção:', n);
await browser.close();
