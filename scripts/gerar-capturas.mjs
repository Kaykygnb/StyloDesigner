/**
 * Gera as capturas de tela do README em docs/screenshots/ usando o projeto base (a Vitrine completa).
 *
 * Uso (com o servidor ligado em outro terminal: `npm start`):
 *     node scripts/gerar-capturas.mjs
 *
 * Variáveis opcionais: APP_URL (padrão http://localhost:5173/) e CHROMIUM_PATH (um Chromium já instalado).
 * As imagens são 1440×900, a 2x de nitidez NÃO (para não pesar no repositório).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { buildSampleShowcase } from '../src/sample-vitrine.js';

const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });
const URL_BASE = process.env.APP_URL || 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(new URL('?editor', URL_BASE).href);
await page.waitForTimeout(900);
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms = 450) => page.waitForTimeout(ms);
const shot = async (name) => { await wait(); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log(`${OUT}/${name}.png`); };

/** Abre a vitrine (do jeito que está no app), no tema pedido, sem coisas flutuando por cima. */
async function open(theme = 'light') {
  await ev(({ doc, theme }) => {
    localStorage.removeItem('pd.collapsed');
    const s = designer.store;
    s.setTheme(theme); s.setBp(null); s.setMode(null);
    s.loadDoc(doc, { pristine: true });
    s.ui.showNotes = false;
    s.ui.showGrids = false; // a grade de 12 colunas do exemplo poluiria a imagem
    s.setSelection([]);
  }, { doc: buildSampleShowcase(), theme });
  await wait(600);
}
const byName = (name) => ev((n) => { let id; const w = (l) => l.forEach((x) => { if (x.name === n && !id) id = x.id; if (x.children) w(x.children); }); w(designer.store.page().children); return id; }, name);
/** Mostra o topo da página (cabeçalho + hero) grande, à esquerda da área de trabalho. */
const viewTop = (zoom = 0.62) => ev((z) => {
  const site = designer.store.page().children[0].children[0];
  const b = designer.canvas.aabb(site.id);
  const r = designer.canvas.vpRect();
  designer.canvas.setView({ zoom: z, x: (r.width - b.w * z) / 2 - b.x * z, y: 60 - b.y * z });
}, zoom);
const select = async (name) => { const id = await byName(name); await ev((i) => designer.store.setSelection([i]), id); await wait(); return id; };

// 1) visão geral: o editor com o hero selecionado (painel Design à direita)
await open('light');
await viewTop(0.6);
await select('Hero');
await shot('01-visao-geral');

// 2) página inicial
await ev(() => designer.home.open());
await wait(700);
await shot('02-pagina-inicial');
await ev(() => designer.home.close?.());
await page.keyboard.press('Escape');

// 3) auto layout e CSS ao vivo: a grade de recursos selecionada
await open('light');
await ev(() => designer.canvas.fit(null));
const grid = await byName('Grade de recursos');
await ev((id) => { designer.store.setSelection([id]); designer.canvas.fit([id], { padding: 90, maxZoom: 0.9 }); }, grid);
await wait(600);
await shot('03-auto-layout-grade');

// 4) responsivo: o mesmo site no Celular
await open('light');
await page.locator('#topbar .bp-btn[data-bp="mobile"]').click();
await wait(400);
await page.locator('.bp-strip .btn').click();
await page.mouse.move(700, 450); // tira o mouse de cima do botão (a dica sumiria)
await wait(3500); // espera o aviso (toast) desaparecer
await ev(() => {
  const site = designer.store.page().children[0].children[0];
  const b = designer.canvas.aabb(site.id);
  const r = designer.canvas.vpRect();
  const z = 0.66;
  designer.canvas.setView({ zoom: z, x: (r.width - b.w * z) / 2 - b.x * z, y: 80 - b.y * z });
});
await select('Hero');
await shot('04-responsivo-celular');

// 5) modo escuro
await open('light');
const modeId = await ev(() => designer.store.state.doc.styles.modes[0].id);
await ev((id) => designer.store.setMode(id), modeId);
await viewTop(0.6);
await select('Cabeçalho');
await shot('05-modo-escuro');

// 6) seletor de cor com paletas
await open('light');
await viewTop(0.6);
await select('Botão do topo');
await ev(async () => {
  localStorage.removeItem('pd.palettes');
  const { createPalette } = await import('/src/palettes.js');
  createPalette('Neutros', ['#0F0D1A', '#5E5A78', '#A9A5C6', '#F7F6FC']);
  createPalette('Lumen', ['#7C5CFF', '#FF5CA8', '#22D3EE', '#10B981', '#1B1340']);
});
await wait(300);
await page.locator('#right .panel-section', { has: page.locator('.section-head', { hasText: 'Preenchimento' }) }).locator('button.swatch').click();
await page.waitForSelector('.cp');
await wait(500);
await shot('06-seletor-de-cor-e-paletas');
await page.keyboard.press('Escape');
await ev(() => localStorage.removeItem('pd.palettes'));

// 7) estados (hover) no painel Design
await open('light');
await viewTop(0.6);
await select('Botão do topo');
await ev(() => { const s = designer.store; s.ui.editState = 'hover'; s.emit('doc'); });
await wait(500);
await shot('07-estados-hover');
await ev(() => { designer.store.ui.editState = null; designer.store.emit('doc'); });

// 8) código gerado (CSS)
await open('light');
await viewTop(0.6);
await select('Hero');
await page.locator('#right .tab', { hasText: 'Código' }).click();
await wait(500);
await shot('08-codigo-css');

// 9) notas e comentários
await open('light');
await ev(() => { designer.store.ui.showNotes = true; designer.store.emit('overlay'); });
await viewTop(0.6);
await select('Visual do hero');
await page.locator('#right .tab-cm').click();
await wait(500);
await shot('09-notas-e-comentarios');

await browser.close();
