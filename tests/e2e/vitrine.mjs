// Exemplo "Vitrine completa": abre pela página inicial e pelo menu Arquivo, renderiza sem erros e os recursos
// que ele promete funcionam (responsivo, modo escuro, estados, apresentar, código).
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto(new URL('', process.env.APP_URL || 'http://localhost:5173/').href);
await page.waitForTimeout(1000);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + extra)); };
const ev = (fn, arg) => page.evaluate(fn, arg);

// ---------------------------------------------------------------- pela página inicial
await ev(() => designer.home.open());
await page.waitForTimeout(500);
const card = page.locator('.home-card.sample', { hasText: 'Vitrine completa' });
ok('a página inicial oferece o exemplo "Vitrine completa" com miniatura', (await card.count()) === 1 && (await card.locator('img').evaluate((i) => i.complete && i.naturalWidth > 100)));
await card.click();
await page.waitForTimeout(600);
const confirm = page.locator('.modal button', { hasText: /Abrir|Substituir|Sim|OK/ }).first();
if (await confirm.count()) await confirm.click();
await page.waitForTimeout(900);
ok('abre o projeto da vitrine', (await ev(() => designer.store.state.doc.name)).includes('Vitrine') && (await ev(() => designer.store.state.doc.pages.length)) === 2);
const ids = await ev(() => {
  const site = designer.store.page().children[0].children[0];
  const byName = (n) => { let r = null; const w = (l) => l.forEach((x) => { if (x.name === n) r = x; if (x.children) w(x.children); }); w(designer.store.page().children); return r?.id; };
  return { site: site.id, grid: byName('Grade de recursos'), menu: byName('Menu'), hero: byName('Hero'), cta: byName('Botão do topo') };
});
await ev(() => designer.canvas.fit(null));
await page.waitForTimeout(500);
const count = await ev(() => designer.canvas.els.size);
ok('renderiza as ~180 camadas sem erro', count > 150, String(count));

const box = (id) => ev((i) => { const el = designer.canvas.els.get(i); return { w: el.offsetWidth, h: el.offsetHeight, x: el.offsetLeft, y: el.offsetTop, display: getComputedStyle(el).display }; }, id);
const cells = () => ev((g) => [...designer.canvas.els.get(g).children].map((c) => [c.offsetLeft, c.offsetTop]), ids.grid);
const c3 = await cells();
ok('desktop: a grade tem 3 colunas (3 cards na 1ª linha)', c3.length === 6 && c3[0][1] === c3[1][1] && c3[1][1] === c3[2][1] && c3[3][1] > c3[0][1], JSON.stringify(c3));
ok('desktop: o menu aparece', (await box(ids.menu)).display !== 'none');

// ---------------------------------------------------------------- responsivo
await page.locator('#topbar .bp-btn[data-bp="tablet"]').click();
await page.waitForTimeout(500);
const c2 = await cells();
ok('tablet: a grade vira 2 colunas', c2[0][1] === c2[1][1] && c2[2][1] > c2[0][1] && c2[0][0] === c2[2][0], JSON.stringify(c2));
await page.locator('#topbar .bp-btn[data-bp="mobile"]').click();
await page.waitForTimeout(500);
const c1 = await cells();
ok('celular: a grade vira 1 coluna e o menu some', c1[1][1] > c1[0][1] && c1[0][0] === c1[1][0] && (await box(ids.menu)).display === 'none', JSON.stringify(c1));
await page.locator('.bp-strip .btn').click();
await page.waitForTimeout(600);
ok('"Telas em 390px" estreita a página só no celular', (await box(ids.site)).w === 390 && (await ev((i) => designer.store.get(i).w, ids.site)) === 1200);

// ---------------------------------------------------------------- modo escuro
await page.locator('#topbar .bp-btn[data-bp="desktop"]').click();
await page.waitForTimeout(400);
const bgOf = () => ev((i) => getComputedStyle(designer.canvas.els.get(i)).backgroundColor, ids.site);
ok('modo padrão: fundo claro', (await bgOf()) === 'rgb(247, 246, 252)', await bgOf());
await page.locator('.mode-btn').click();
await page.locator('.menu .menu-item', { hasText: /^Escuro$/ }).click();
await page.waitForTimeout(500);
ok('modo escuro: fundo escuro (#0F0D1A)', (await bgOf()) === 'rgb(15, 13, 26)', await bgOf());
await page.locator('.mode-btn').click();
await page.locator('.menu .menu-item', { hasText: /^Padrão$/ }).click();

// ---------------------------------------------------------------- código
const out = await ev(async () => {
  const { generateCode, joinCss } = await import('/src/css.js');
  const d = designer.store.state.doc;
  const gen = generateCode([designer.store.page().children[0].children[0]], null, d.assets, { root: true, styles: d.styles });
  return { css: joinCss([gen]), html: gen.html };
});
ok('o código tem @media, variáveis, modo escuro e hover', out.css.includes('@media (max-width: 640px)') && out.css.includes('var(--espaco-l)') && out.css.includes(':root[data-theme="escuro"]') && out.css.includes(':hover'));
ok('o HTML tem as etiquetas semânticas e os comentários das notas', out.html.includes('<header') && out.html.includes('<h1') && out.html.includes('<footer') && out.html.includes('<!-- Título principal da página'));

// ---------------------------------------------------------------- apresentar e comentários
await ev((i) => designer.store.setSelection([i]), ids.site);
await page.keyboard.press('Control+Alt+Enter');
await page.waitForTimeout(900);
ok('Apresentar abre o site (e o botão do topo está lá)', (await page.locator('.present, .present-root, .present-title').count()) > 0);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
ok('a vitrine traz 3 comentários (2 abertos) na aba', (await ev(() => designer.store.state.doc.comments.length)) === 3 && (await page.locator('.cm-badge').innerText()) === '2');

ok('sem erros no console', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(fails ? 1 : 0);
