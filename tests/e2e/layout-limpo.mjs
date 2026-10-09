// Layout limpo: réguas escondidas e Ctrl+R (sem recarregar a página), largura da tela e modo de cor no topo
// (nada flutuando sobre o canvas no Desktop), listas sem contorno lateral colorido.
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto(new URL('?editor', process.env.APP_URL || 'http://localhost:5173/').href);
await page.waitForTimeout(800);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + extra)); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const rulerVisible = () => ev(() => getComputedStyle(document.querySelector('.ruler-top')).display !== 'none');

await ev(() => { localStorage.removeItem('pd.rulers'); });
await page.reload();
await page.waitForTimeout(900);
await ev(async () => {
  const m = await import('/src/model.js');
  designer.store.newDoc();
  const f = m.createNode('frame', { name: 'Tela', x: 0, y: 0, w: 400, h: 300 });
  const a = m.createNode('rect', { name: 'Foto', x: 10, y: 10, w: 100, h: 50 });
  f.children = [a];
  designer.store.update((p) => p.children.push(f), { commit: true });
  designer.store.setSelection([a.id]);
});
await page.waitForTimeout(400);

// ---------------------------------------------------------------- réguas
ok('as réguas começam visíveis (as guias saem arrastando delas)', await rulerVisible());
await ev(() => { window.__nao_recarregou = true; });
await page.locator('#viewport').click({ position: { x: 600, y: 500 } });
await page.keyboard.press('Control+r');
await page.waitForTimeout(300);
ok('Ctrl+R desliga as réguas sem recarregar a página', !(await rulerVisible()) && (await ev(() => window.__nao_recarregou === true)));
await page.keyboard.press('Control+r');
await page.waitForTimeout(300);
ok('Ctrl+R de novo liga', await rulerVisible());
await page.keyboard.press('Shift+r');
await page.waitForTimeout(300);
ok('Shift+R continua funcionando (desliga de novo)', !(await rulerVisible()));
await page.waitForTimeout(500);
await page.reload();
await page.waitForTimeout(900);
ok('a escolha das réguas (desligadas) é lembrada ao recarregar', !(await rulerVisible()));
await ev(() => designer.store.toggleRulers());

// ---------------------------------------------------------------- topo: largura da tela e modo de cor
ok('largura da tela e modo de cor ficam na barra do topo', (await page.locator('#topbar .bp-top .bp-btn').count()) === 4 && (await page.locator('#topbar .mode-btn').count()) === 1);
ok('nada flutua sobre o canvas no Desktop', (await page.locator('.bp-bar').count()) === 0 && (await page.locator('.bp-strip').isHidden()));
const topBox = await page.locator('#topbar').boundingBox();
const grpBox = await page.locator('#topbar .bp-top').boundingBox();
ok('o grupo fica centralizado no topo', Math.abs((grpBox.x + grpBox.width / 2) - (topBox.x + topBox.width / 2)) < 160 && grpBox.height <= 32, JSON.stringify([topBox, grpBox]));
ok('só o modo ativo mostra o nome (os outros são só ícones)', (await page.locator('#topbar .bp-seg .bp-btn span:not(.ico)').evaluateAll((l) => l.filter((s) => getComputedStyle(s).display !== 'none').map((s) => s.textContent))).join() === 'Desktop');
await page.locator('#topbar .bp-btn[data-bp="mobile"]').click();
await page.waitForTimeout(300);
ok('em Celular surge a faixa fina com o resumo e o atalho', (await page.locator('.bp-strip').isVisible()) && (await page.locator('.bp-strip').innerText()).includes('Celular') && (await page.locator('.bp-strip .btn').innerText()).includes('390'));
await page.locator('#topbar .bp-btn[data-bp="desktop"]').click();
await page.waitForTimeout(300);
ok('voltando ao Desktop a faixa some', await page.locator('.bp-strip').isHidden());

// ---------------------------------------------------------------- listas
await ev(() => { const p = designer.store.page(); designer.store.setSelection([p.children[0].children[0].id]); });
await page.waitForTimeout(300);
const flat = await ev(() => {
  const p = getComputedStyle(document.querySelector('.page-row.active'));
  const l = getComputedStyle(document.querySelector('.layer-row.selected'));
  return { p: [p.boxShadow, p.borderRadius], l: [l.boxShadow, l.borderRadius] };
});
ok('página ativa e camada selecionada sem contorno lateral e sem cantos arredondados', flat.p[0] === 'none' && flat.p[1] === '0px' && flat.l[0] === 'none' && flat.l[1] === '0px', JSON.stringify(flat));

// ---------------------------------------------------------------- painel Design: o que quase não se usa começa recolhido
await ev(() => { localStorage.removeItem('pd.collapsed'); const p = designer.store.page(); designer.store.setSelection([]); designer.store.setSelection([p.children[0].children[0].id]); });
await page.waitForTimeout(400);
const closed = (t) => page.locator('#right .panel-section', { has: page.locator('.section-head', { hasText: t }) }).evaluate((e) => e.classList.contains('collapsed'));
ok('Exportar, HTML, Efeitos e Estados vazios começam recolhidos', (await closed('Exportar')) && (await closed('HTML')) && (await closed('Efeitos')) && (await closed('Estados')));
ok('Posição, Tamanho e Preenchimento continuam abertos', !(await closed('Posição')) && !(await closed('Tamanho')) && !(await closed('Preenchimento')));
await ev(() => { const n = designer.store.get(designer.store.ui.selection[0]); n.shadows.push({ x: 0, y: 4, blur: 8, spread: 0, color: '#000000', opacity: 0.25, inset: false }); designer.store.commit(); });
await page.waitForTimeout(400);
ok('com uma sombra, Efeitos abre sozinho', !(await closed('Efeitos')));

ok('sem erros no console', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(fails ? 1 : 0);
