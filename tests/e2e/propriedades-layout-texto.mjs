import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 1440, height: 860 }, acceptDownloads: true });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
await p.goto((process.env.APP_URL || 'http://localhost:5173/')); await p.waitForTimeout(800);
let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + x)); };
const ev = (f, a) => p.evaluate(f, a);
// ---- multi seleção: X/Y/W/H do conjunto
await ev(async () => { const m = await import('/src/model.js'); const s = designer.store; s.newDoc(); const a = m.createNode('rect', { x: 100, y: 100, w: 50, h: 50 }); const c = m.createNode('rect', { x: 250, y: 200, w: 50, h: 50 }); s.update((pg) => pg.children.push(a, c), { commit: true }); s.setSelection([a.id, c.id]); designer.canvas.setView({ x: 0, y: 0, zoom: 1 }); });
await p.waitForTimeout(200);
const wIn = p.locator('.num-field:has(.num-label:text-is("W")) input').first();
ok('painel mostra W/H para múltipla seleção', (await wIn.inputValue()) === '200', await wIn.inputValue());
await wIn.fill('400'); await wIn.press('Enter');
let r = await ev(() => designer.store.page().children.map(n => [n.x, n.w]));
ok('mudar W do conjunto escala as peças (100→x=100, w=100 | 250→x=400, w=100)', r[0][0] === 100 && r[0][1] === 100 && r[1][0] === 400 && r[1][1] === 100, JSON.stringify(r));
const xIn = p.locator('.num-field:has(.num-label:text-is("X")) input').first();
await xIn.fill('0'); await xIn.press('Enter');
r = await ev(() => designer.store.page().children.map(n => n.x));
ok('mudar X do conjunto move tudo junto', r[0] === 0 && r[1] === 300, JSON.stringify(r));

// ---- matriz 3x3
await ev(async () => { const m = await import('/src/model.js'); const s = designer.store; s.newDoc(); const f = m.createNode('frame', { w: 300, h: 200 }); f.children.push(m.createNode('rect', { x: 10, y: 10, w: 40, h: 40 }), m.createNode('rect', { x: 80, y: 10, w: 40, h: 40 })); s.update((pg) => pg.children.push(f), { commit: true }); s.setSelection([f.id]); });
await p.click('.seg-btn[title^="Flex em linha"]');
await p.waitForTimeout(150);
await p.locator('.am-cell').nth(8).click(); // canto inferior direito
let lay = await ev(() => designer.store.page().children[0].layout);
ok('matriz: canto inferior direito → flex-end/flex-end', lay.justify === 'flex-end' && lay.align === 'flex-end', JSON.stringify(lay));
await p.click('.seg-btn[title^="Flex em coluna"]');
await p.waitForTimeout(100);
await p.locator('.am-cell').nth(2).click(); // topo-direita
lay = await ev(() => designer.store.page().children[0].layout);
ok('matriz em coluna: topo-direita → justify start, align end', lay.justify === 'flex-start' && lay.align === 'flex-end', JSON.stringify(lay));
ok('célula ativa fica marcada', (await p.locator('.am-cell.on').count()) === 1);

// ---- padding H/V
await ev(() => designer.store.update(() => { designer.store.page().children[0].layout.padding = [0, 0, 0, 0]; }, { commit: true })); await p.waitForTimeout(200);
const hPad = p.locator('.num-field:has(.num-label:text-is("↔")) input').nth(1);
await hPad.fill('30'); await hPad.press('Enter');
lay = await ev(() => designer.store.page().children[0].layout.padding);
ok('padding horizontal define esquerda e direita', lay[1] === 30 && lay[3] === 30 && lay[0] === 0, JSON.stringify(lay));

// ---- texto: transform e alinhamento vertical
await ev(async () => { const m = await import('/src/model.js'); const s = designer.store; s.newDoc(); const t = m.createNode('text', { x: 50, y: 50, text: 'olá mundo', sizeX: 'fixed', sizeY: 'fixed', w: 200, h: 100 }); s.update((pg) => pg.children.push(t), { commit: true }); s.setSelection([t.id]); });
await p.waitForTimeout(200);
await p.locator('select[title="text-transform"]').selectOption('uppercase');
await p.click('.seg-btn[title="Centralizar na vertical"]');
const tcss = await ev(() => { const el = designer.canvas.els.get(designer.store.page().children[0].id); const cs = getComputedStyle(el); return [cs.textTransform, cs.display, cs.alignContent]; });
ok('texto: uppercase + centralizado na vertical (grid)', tcss[0] === 'uppercase' && tcss[1] === 'grid' && tcss[2] === 'center', JSON.stringify(tcss));

// ---- cores do documento
await ev(async () => { const m = await import('/src/model.js'); const s = designer.store; s.newDoc(); const l = ['#FF0000', '#FF0000', '#00FF00', '#0000FF'].map((c, i) => { const r = m.createNode('rect', { x: i * 100, w: 50, h: 50 }); r.fill = m.defaultFill(c); return r; }); s.update((pg) => pg.children.push(...l), { commit: true }); s.setSelection([l[3].id]); });
await p.waitForTimeout(200);
const chips = await p.locator('.color-chips .chip').count();
ok('chips mostram as cores usadas (3 únicas)', chips === 3, String(chips));
await p.locator('.color-chips .chip').first().click();
ok('clicar no chip aplica a cor mais usada (#FF0000)', (await ev(() => designer.store.page().children[3].fill.color)) === '#FF0000');

// ---- exportar todos os frames
await ev(() => designer.store.loadSample());
await p.waitForTimeout(300);
await p.click('button:has-text("Arquivo")');
const downloads = [];
p.on('download', d => downloads.push(d.suggestedFilename()));
await p.click('.menu-item:has-text("Exportar todos os frames")');
await p.waitForTimeout(2500);
ok('exporta um PNG por frame (3)', downloads.length === 3, JSON.stringify(downloads));
if (errors.length) { console.error(errors.join('\n')); fails += errors.length; }
else console.log('sem erros');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
// codex: retorna falha ao shell quando uma asserção ou erro de navegador ocorrer.
process.exitCode = fails ? 1 : 0;
await b.close();
process.exitCode = fails || errors.length ? 1 : 0;
