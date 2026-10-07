import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 1440, height: 860 }, acceptDownloads: true });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type()==='error' && errors.push(m.text()));
await p.goto(new URL('?editor', process.env.APP_URL || 'http://localhost:5173/').href); await p.waitForTimeout(700);
let fails = 0; const ok = (n, c, x='') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + x)); };
const ev = (f, a) => p.evaluate(f, a);
// Ctrl+Alt+G
const r = await ev(() => { const s = designer.store; const hero = s.page().children[0]; const t = hero.children.find(c => c.name === 'Título'); s.setSelection([t.id]); return t.id; });
await p.keyboard.press('Control+Alt+g');
const w = await ev(() => { const s = designer.store; const sel = s.get(s.ui.selection[0]); return { type: sel.type, name: sel.name, kids: sel.children.length }; });
ok('Ctrl+Alt+G envolve em frame', w.type === 'frame' && w.kids === 1 && w.name.startsWith('Frame'), JSON.stringify(w));
// SVG download
await ev(() => designer.store.setSelection([designer.store.page().children[0].id]));
await p.waitForTimeout(200);
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.btn:has-text("SVG")')]);
ok('botão SVG baixa arquivo .svg', dl.suggestedFilename().endsWith('.svg'), dl.suggestedFilename());
// busca de camadas
await p.fill('.layer-search input', 'botão');
await p.waitForTimeout(200);
const rows = await p.locator('.layer-row').count();
ok('busca filtra camadas por nome', rows >= 2 && rows <= 4, String(rows));
if (errors.length) { console.error(errors.join('\n')); fails += errors.length; }
else console.log('no console errors');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
await b.close();
process.exitCode = fails || errors.length ? 1 : 0;
