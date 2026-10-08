// Modo responsivo: barra Desktop/Tablet/Celular, edição só por diferença (node.bps), pré-visualização no canvas,
// canvas só seleciona, ocultar por largura, "Telas em 390px", restaurar, desfazer, @media no código e largura fluida.
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
const node = (id) => ev((i) => JSON.parse(JSON.stringify(designer.store.get(i))), id);
const box = (id) => ev((i) => { const el = designer.canvas.els.get(i); return { w: el.offsetWidth, h: el.offsetHeight, x: el.offsetLeft, y: el.offsetTop, display: getComputedStyle(el).display }; }, id);

const ids = await ev(async () => {
  const m = await import('/src/model.js');
  designer.store.newDoc();
  const f = m.createNode('frame', { name: 'Pagina', x: 0, y: 0, w: 900, h: 400 });
  f.layout = { ...f.layout, mode: 'row', gap: 20, padding: [10, 10, 10, 10], justify: 'flex-start', align: 'flex-start' };
  const a = m.createNode('rect', { name: 'Foto', w: 300, h: 100 });
  const b = m.createNode('rect', { name: 'Texto', w: 300, h: 100 });
  f.children = [a, b];
  designer.store.update((p) => p.children.push(f), { commit: true });
  designer.store.setSelection([f.id]);
  designer.canvas.fit(null);
  return { f: f.id, a: a.id, b: b.id };
});
await page.waitForTimeout(400);

// ---------------------------------------------------------------- a barra
ok('a barra tem Desktop, Tablet e Celular', (await page.locator('.bp-seg .bp-btn').evaluateAll((l) => l.map((b) => b.getAttribute('aria-label')))).join(',') === 'Desktop,Tablet,Celular');
ok('Desktop é o modo inicial', (await ev(() => designer.store.ui.bp)) === null && (await page.locator('.bp-btn.on').innerText()) === 'Desktop');
const row0 = await box(ids.b), row0a = await box(ids.a);
ok('no desktop os filhos ficam lado a lado (linha)', row0.x > row0a.x && row0.y === row0a.y, JSON.stringify([row0a, row0]));

// ---------------------------------------------------------------- celular: layout em coluna só no celular
await page.locator('.bp-btn[data-bp="mobile"]').click();
await page.waitForTimeout(400);
ok('Celular liga o modo (classe, ui.bp e banner no painel)', (await ev(() => designer.store.ui.bp)) === 'mobile' && (await page.locator('body.bp-active').count()) === 1 && (await page.locator('.bp-banner').innerText()).includes('Celular'));
ok('no modo responsivo o painel esconde o que só vale no desktop (Nota, HTML, Exportar, Estados)', (await page.locator('#right .section-head', { hasText: /^(Nota|HTML|Exportar|Estados)$/ }).count()) === 0);
await page.locator('.al-mode[data-v="column"]').click();
await page.waitForTimeout(400);
let fr = await node(ids.f);
ok('mudar o layout no celular guarda só a diferença (base continua em linha)', fr.layout.mode === 'row' && fr.bps?.mobile?.layout?.mode === 'column', JSON.stringify(fr.bps));
const colB = await box(ids.b), colA = await box(ids.a);
ok('no canvas os filhos aparecem empilhados no celular', colB.y > colA.y && colB.x === colA.x, JSON.stringify([colA, colB]));
await page.locator('.bp-btn[data-bp="desktop"]').click();
await page.waitForTimeout(400);
const rowB = await box(ids.b), rowA = await box(ids.a);
ok('voltando ao Desktop os filhos voltam lado a lado', rowB.x > rowA.x && rowB.y === rowA.y);

// ---------------------------------------------------------------- tablet herda para o celular
await page.locator('.bp-btn[data-bp="tablet"]').click();
await page.waitForTimeout(300);
await ev((i) => designer.store.setSelection([i]), ids.a);
await page.waitForTimeout(300);
const wField = page.locator('#right .cap-group', { hasText: 'Dimensões' }).locator('input').first();
await wField.fill('150');
await wField.press('Enter');
await page.waitForTimeout(300);
let a = await node(ids.a);
ok('largura do tablet guardada só no tablet (150), base 300', a.w === 300 && a.bps?.tablet?.w === 150, JSON.stringify(a.bps));
await page.locator('.bp-btn[data-bp="mobile"]').click();
await page.waitForTimeout(300);
ok('o celular herda a largura do tablet (150 no canvas)', (await box(ids.a)).w === 150);

// ---------------------------------------------------------------- ocultar só no celular
await page.locator('#right .sel-actions .icon-btn').first().click();
await page.waitForTimeout(300);
a = await node(ids.a);
ok('o olho do cabeçalho oculta só nesta largura', a.visible === true && a.bps?.mobile?.visible === false, JSON.stringify(a.bps));
ok('no canvas a camada some no celular', (await box(ids.a)).display === 'none');
await page.locator('.bp-btn[data-bp="desktop"]').click();
await page.waitForTimeout(300);
ok('e aparece de novo no desktop', (await box(ids.a)).display !== 'none');

// ---------------------------------------------------------------- canvas só seleciona no modo responsivo
await page.locator('.bp-btn[data-bp="mobile"]').click();
await page.waitForTimeout(300);
const before = await node(ids.b);
const g = await ev((i) => { const b = designer.canvas.aabb(i); const s = designer.canvas.toScreen(b.x + b.w / 2, b.y + b.h / 2); const r = designer.canvas.vpRect(); return { x: r.left + s.x, y: r.top + s.y }; }, ids.b);
await page.mouse.move(g.x, g.y);
await page.mouse.down();
await page.mouse.move(g.x + 80, g.y + 60, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(250);
const after = await node(ids.b);
ok('clicar seleciona a camada', (await ev(() => designer.store.ui.selection[0])) === ids.b);
ok('arrastar no canvas não mexe no desenho no modo responsivo', JSON.stringify([before.x, before.y]) === JSON.stringify([after.x, after.y]) && !after.bps);
const countBefore = await ev(() => designer.store.get(designer.store.ui.selection[0]) ? designer.store.page().children[0].children.length : -1);
await page.keyboard.press('Delete');
await page.waitForTimeout(250);
ok('Delete é ignorado no modo responsivo', (await ev(() => designer.store.page().children[0].children.length)) === countBefore);

// ---------------------------------------------------------------- telas em 390px
await ev((i) => designer.store.setSelection([i]), ids.f);
await page.locator('.bp-strip .btn', { hasText: 'Telas em 390px' }).click();
await page.waitForTimeout(400);
fr = await node(ids.f);
ok('"Telas em 390px" guarda a largura só no celular', fr.w === 900 && fr.bps?.mobile?.w === 390, JSON.stringify(fr.bps));
ok('o frame fica com 390px de largura no canvas do celular', (await box(ids.f)).w === 390);

// ---------------------------------------------------------------- código @media
const css = await ev(async () => { const { generateCode } = await import('/src/css.js'); return generateCode([designer.store.get(designer.store.page().children[0].id)], null, {}, { root: true }).css; });
ok('o código gerado tem @media do tablet e do celular', css.includes('@media (max-width: 1024px)') && css.includes('@media (max-width: 640px)'), css.slice(-400));
const mob = css.slice(css.indexOf('@media (max-width: 640px)'));
ok('no @media do celular: coluna, largura 390 e a foto oculta', mob.includes('flex-direction: column') && mob.includes('width: 390px') && /\.foto \{\s*display: none/.test(mob), mob);

// ---------------------------------------------------------------- restaurar, desfazer
await page.locator('.bp-btn[data-bp="mobile"]').click();
await ev((i) => designer.store.setSelection([i]), ids.a);
await page.waitForTimeout(300);
await page.locator('.bp-banner .btn', { hasText: 'Restaurar ao Desktop' }).click();
await page.waitForTimeout(300);
a = await node(ids.a);
ok('"Restaurar ao Desktop" apaga os ajustes do celular (os do tablet ficam)', !a.bps?.mobile && a.bps?.tablet?.w === 150, JSON.stringify(a.bps));
await page.keyboard.press('Control+z');
await page.waitForTimeout(300);
ok('Ctrl+Z desfaz o restaurar (o ajuste do celular volta)', (await node(ids.a)).bps?.mobile?.visible === false);

// ---------------------------------------------------------------- fluido (só no desktop)
await page.locator('.bp-btn[data-bp="desktop"]').click();
await ev((i) => designer.store.setSelection([i]), ids.f);
await page.waitForTimeout(300);
await page.locator('#right label.check', { hasText: 'Largura fluida' }).click();
await page.waitForTimeout(250);
ok('"Largura fluida" marca o frame da raiz', (await node(ids.f)).fluid === true);
const css2 = await ev(async () => { const { generateCode } = await import('/src/css.js'); return generateCode([designer.store.get(designer.store.page().children[0].id)], null, {}, { root: true }).css; });
ok('e o CSS usa width: 100% com max-width e min-height', css2.includes('width: 100%') && css2.includes('max-width: 900px') && css2.includes('min-height: 400px'), css2.slice(0, 300));

// ---------------------------------------------------------------- recarregar: ajustes ficam, modo volta ao desktop
await page.waitForTimeout(800);
await page.reload();
await page.waitForTimeout(900);
ok('os ajustes sobrevivem a recarregar e o modo volta a Desktop', (await ev((i) => designer.store.get(i)?.bps?.tablet?.w, ids.a)) === 150 && (await ev(() => designer.store.ui.bp)) === null);

ok('sem erros no console', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(fails ? 1 : 0);
