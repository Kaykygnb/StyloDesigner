// CSS ampliado: limites de tamanho, proporção, imagem de fundo, texto truncado, margem, filtros, estados, gradiente cônico,
// peso no flex e trilhas personalizadas do grid. Usa a API do app (window.designer) e o painel Design de verdade.
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto(new URL('?editor', process.env.APP_URL || 'http://localhost:5173/').href);
await page.waitForTimeout(800);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + extra)); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const reset = async () => { await ev(() => { designer.store.newDoc(); designer.canvas.setView({ x: 40, y: 40, zoom: 1 }); }); await page.waitForTimeout(150); };
const mk = (type, props) => ev(async ([t, p]) => { const m = await import('/src/model.js'); const n = m.createNode(t, p); designer.store.update((pg) => pg.children.push(n), { commit: true }); return n.id; }, [type, props]);

// ---------------------------------------------------------------- limites de tamanho pelo painel
await reset();
const r = await mk('rect', { x: 20, y: 20, w: 300, h: 100 });
await ev((id) => designer.store.setSelection([id]), r);
await page.waitForTimeout(300);
const limites = page.locator('#right details.size-limits', { has: page.locator('summary', { hasText: 'Limites e proporção' }) });
await limites.locator('summary').click();
const maxW = limites.locator('.cap-group', { has: page.locator('.cap-css', { hasText: 'max-width' }) }).locator('input');
await maxW.fill('200'); await maxW.press('Enter');
await page.waitForTimeout(200);
let n = await ev((id) => designer.store.get(id), r);
ok('largura máxima pelo painel limita a largura fixa (300 → 200)', n.maxW === 200 && n.w === 200, JSON.stringify([n.maxW, n.w]));
await maxW.fill(''); await maxW.press('Enter');
await page.waitForTimeout(150);
n = await ev((id) => designer.store.get(id), r);
ok('apagar o campo remove o limite', n.maxW === undefined && !('maxW' in n));
await limites.locator('select').selectOption('1.7778');
await page.waitForTimeout(200);
n = await ev((id) => designer.store.get(id), r);
ok('proporção 16:9 ajusta a altura (largura 200 → 112)', Math.abs(n.aspect - 1.7778) < 0.001 && Math.abs(n.h - n.w / 1.7778) < 1, JSON.stringify([n.aspect, n.w, n.h]));

// ---------------------------------------------------------------- limite em flex "fill" + peso
await reset();
const row = await ev(async () => {
  const m = await import('/src/model.js'); const row = m.createNode('frame', { x: 0, y: 0, w: 400, h: 60 });
  row.layout = { ...row.layout, mode: 'row', gap: 0, align: 'flex-start' };
  const a = m.createNode('rect', { name: 'A', sizeX: 'fill', sizeY: 'fixed', h: 40, grow: 1 });
  const b = m.createNode('rect', { name: 'B', sizeX: 'fill', sizeY: 'fixed', h: 40, grow: 3 });
  row.children = [a, b]; designer.store.update((pg) => pg.children.push(row), { commit: true });
  return { a: a.id, b: b.id };
});
await page.waitForTimeout(250);
const width = (id) => ev((i) => designer.canvas.els.get(i).offsetWidth, id);
ok('pesos 1 e 3 dividem o espaço em 1/4 e 3/4 (100 e 300)', (await width(row.a)) === 100 && (await width(row.b)) === 300, `${await width(row.a)}/${await width(row.b)}`);
await ev((id) => { designer.store.update(() => { designer.store.get(id).maxW = 80; }, { commit: true }); }, row.a);
await page.waitForTimeout(200);
ok('max-width 80 vence o peso (A = 80)', (await width(row.a)) === 80, String(await width(row.a)));
await ev((id) => designer.store.setSelection([id]), row.b);
await page.waitForTimeout(300);
const peso = page.locator('#right .cap-group', { has: page.locator('.cap-css', { hasText: 'flex-grow' }) }).locator('input');
ok('item "fill" mostra o campo de peso (valor 3)', (await peso.count()) === 1 && (await peso.inputValue()) === '3');
await peso.fill('1'); await peso.press('Enter');
await page.waitForTimeout(200);
await ev((id) => { designer.store.update(() => { delete designer.store.get(id).maxW; }, { commit: true }); }, row.a);
await page.waitForTimeout(200);
ok('peso 1 e 1 voltam a dividir meio a meio (200 e 200)', (await width(row.a)) === 200 && (await width(row.b)) === 200, `${await width(row.a)}/${await width(row.b)}`);

// ---------------------------------------------------------------- grid com trilhas personalizadas
await reset();
const grid = await ev(async () => {
  const m = await import('/src/model.js'); const g = m.createNode('frame', { x: 0, y: 0, w: 400, h: 100 });
  g.layout = { ...g.layout, mode: 'grid', cols: 3, rows: 0, colGap: 0, rowGap: 0, padding: [0, 0, 0, 0] };
  g.children = [m.createNode('rect', { name: 'A', sizeX: 'fill', sizeY: 'fixed', h: 30 }), m.createNode('rect', { name: 'B', sizeX: 'fill', sizeY: 'fixed', h: 30 })];
  designer.store.update((pg) => pg.children.push(g), { commit: true }); designer.store.setSelection([g.id]);
  return { g: g.id, a: g.children[0].id, b: g.children[1].id };
});
await page.waitForTimeout(350);
const tr = page.locator('#right details.size-limits', { has: page.locator('summary', { hasText: 'Trilhas personalizadas' }) });
await tr.locator('summary').click();
const colsTpl = tr.locator('input').first();
await colsTpl.fill('100px 1fr'); await colsTpl.press('Enter');
await page.waitForTimeout(250);
ok('trilhas "100px 1fr": primeira coluna 100px, segunda o resto (300)', (await width(grid.a)) === 100 && (await width(grid.b)) === 300, `${await width(grid.a)}/${await width(grid.b)}`);
const css = await ev((id) => designer.canvas.els.get(id).style.gridTemplateColumns, grid.g);
ok('CSS do grid usa o texto digitado', css === '100px 1fr', css);
await colsTpl.fill('1fr; } body { x: y'); await colsTpl.press('Enter');
await page.waitForTimeout(200);
const sane = await ev((id) => designer.store.get(id).layout.colsTemplate, grid.g);
ok('texto com ; { } é limpo (não fecha a regra CSS)', !/[;{}]/.test(sane), sane);
// o seletor visual de grade limpa as trilhas personalizadas
await page.locator('#right .gp-cell').nth(2 * 6 + 1).click(); // 2 colunas × 3 linhas
await page.waitForTimeout(250);
const lay = await ev((id) => designer.store.get(id).layout, grid.g);
ok('escolher colunas × linhas no seletor limpa as trilhas personalizadas', lay.cols === 2 && lay.rows === 3 && !lay.colsTemplate, JSON.stringify([lay.cols, lay.rows, lay.colsTemplate]));

// ---------------------------------------------------------------- gradiente cônico pelo painel
await reset();
const c = await mk('rect', { x: 20, y: 20, w: 120, h: 120 });
await ev((id) => designer.store.setSelection([id]), c);
await page.waitForTimeout(300);
const tipo = page.locator('#right .panel-section', { has: page.locator('.section-head', { hasText: 'Preenchimento' }) }).locator('select').first();
await tipo.selectOption('conic');
await page.waitForTimeout(250);
const bg = await ev((id) => designer.canvas.els.get(id).style.backgroundImage, c);
ok('gradiente cônico vira conic-gradient no canvas', /^conic-gradient\(from 135deg/.test(bg), bg);

// ---------------------------------------------------------------- rolagem do frame (overflow)
await reset();
const sc = await ev(async () => {
  const m = await import('/src/model.js'); const f = m.createNode('frame', { name: 'Lista', x: 0, y: 0, w: 200, h: 100 });
  const longo = m.createNode('rect', { name: 'Conteúdo', x: 10, y: 10, w: 100, h: 300 }); f.children = [longo];
  designer.store.update((pg) => pg.children.push(f), { commit: true }); designer.store.setSelection([f.id]);
  return f.id;
});
await page.waitForTimeout(300);
await page.locator('#right .cap-group', { has: page.locator('.cap-css', { hasText: 'overflow' }) }).locator('select').selectOption('scroll-y');
await page.waitForTimeout(250);
const tela = await ev((id) => { const n = designer.store.get(id); const el = designer.canvas.els.get(id); const cs = getComputedStyle(el); return { ov: n.overflow, clip: n.clip, canvasOverflow: cs.overflowY, canvasX: cs.overflowX }; }, sc);
ok('escolher "Rolar na vertical" guarda o modo e mantém clip', tela.ov === 'scroll-y' && tela.clip === true, JSON.stringify(tela));
ok('no editor o conteúdo continua cortado (sem barra de rolagem no canvas)', tela.canvasOverflow === 'hidden' && tela.canvasX === 'hidden', JSON.stringify(tela));
await page.locator('button', { hasText: 'Apresentar' }).first().click();
await page.waitForSelector('.present .present-board');
const apres = await ev((id) => { const el = document.querySelector('.present [data-id="' + id + '"]'); const cs = getComputedStyle(el); return { y: cs.overflowY, x: cs.overflowX, rolavel: el.scrollHeight > el.clientHeight }; }, sc);
ok('na apresentação rola de verdade (overflow-y auto, conteúdo maior que a caixa)', apres.y === 'auto' && apres.x === 'hidden' && apres.rolavel, JSON.stringify(apres));
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// ---------------------------------------------------------------- variáveis de CSS (estilos de cor) no painel Código
await reset();
const tk = await mk('rect', { name: 'Botão', x: 20, y: 20, w: 120, h: 40 });
await ev((id) => { designer.store.setSelection([id]); designer.commands.addColorStyle(designer.store.get(id), 'Marca Principal'); }, tk);
await page.waitForTimeout(200);
await page.click('#right .tab:has-text("Código")');
await page.waitForTimeout(300);
const codigo = await page.locator('#right .code-view').innerText();
const compacto = codigo.replace(/\s+/g, ' ');
ok('Código: bloco :root com a variável do estilo de cor', compacto.includes(':root { --cor-marca-principal: #d9d9d9; }'), compacto.slice(0, 160));
ok('Código: a camada usa var(--cor-marca-principal)', compacto.includes('background-color: var(--cor-marca-principal);'), compacto.slice(0, 260));
await page.click('#right .tab:has-text("Design")');

ok('sem erros no console', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(fails ? 1 : 0);
