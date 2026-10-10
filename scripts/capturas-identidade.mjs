/**
 * Capturas para comparar a identidade visual do editor ANTES e DEPOIS, nos temas escuro e claro.
 *
 * Uso: node scripts/capturas-identidade.mjs <prefixo>      (ex.: antes, depois)
 * Variáveis: APP_URL (padrão http://localhost:5173/), CHROMIUM_PATH. Grava em docs/screenshots/identidade/.
 * Use um servidor isolado (npm run test:e2e sobe um; ou DESIGNER_CONFIG temporário + PORT) para não tocar nos seus projetos.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { buildSampleShowcase } from '../src/sample-vitrine.js';

const prefix = process.argv[2] || 'captura';
const OUT = 'docs/screenshots/identidade';
mkdirSync(OUT, { recursive: true });
const base = process.env.APP_URL || 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(new URL('?editor', base).href);
await page.waitForFunction(() => window.designer?.store);
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms = 450) => page.waitForTimeout(ms);
const shot = async (name, theme) => { await wait(); await page.screenshot({ path: `${OUT}/${prefix}-${name}-${theme}.png` }); console.log(`${prefix}-${name}-${theme}.png`); };

async function open(theme) {
  await ev(({ doc, theme }) => {
    const s = designer.store;
    s.setTheme(theme); s.setBp(null); s.setMode(null);
    s.loadDoc(doc, { pristine: true });
    s.ui.showNotes = false; s.ui.showGrids = false;
    s.setSelection([]);
  }, { doc: buildSampleShowcase(), theme });
  await wait(600);
}
const byName = (name) => ev((n) => { let id; const w = (l) => l.forEach((x) => { if (x.name === n && !id) id = x.id; if (x.children) w(x.children); }); w(designer.store.page().children); return id; }, name);
const view = (zoom = 0.6) => ev((z) => {
  const site = designer.store.page().children[0].children[0];
  const b = designer.canvas.aabb(site.id);
  const r = designer.canvas.vpRect();
  designer.canvas.setView({ zoom: z, x: (r.width - b.w * z) / 2 - b.x * z, y: 60 - b.y * z });
}, zoom);
const select = async (name) => { const id = await byName(name); await ev((i) => designer.store.setSelection([i]), id); await wait(); };

for (const theme of ['dark', 'light']) {
  await open(theme);
  await view(0.6);
  await select('Hero');
  await shot('1-editor-camada', theme);

  await ev(() => designer.store.setSelection([]));
  await shot('2-nada-selecionado', theme);

  await select('Nome'); // um texto: mostra o painel de tipografia
  await shot('3-texto', theme);

  await page.getByRole('tab', { name: /Recursos/ }).click();
  await shot('4-recursos', theme);
  await page.getByRole('tab', { name: /Camadas/ }).click();

  await ev(() => designer.home.open());
  await wait(700);
  await shot('5-pagina-inicial', theme);
  await ev(() => designer.home.close?.());
  await page.keyboard.press('Escape');
}
await browser.close();
