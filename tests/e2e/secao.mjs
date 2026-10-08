// Seção (como no Figma): desenhar, adotar telas, mover junto (pelo nome ou pelo corpo), regras de aninhamento, <section> no código.
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
await ev(() => designer.store.newDoc());
await ev(() => designer.canvas.setView({ x: 0, y: 0, zoom: 1 }));
const vp = await page.locator('#viewport').boundingBox();
const X = (x) => vp.x + x, Y = (y) => vp.y + y;
const drag = async (x0, y0, x1, y1) => { await page.mouse.move(X(x0), Y(y0)); await page.mouse.down(); await page.mouse.move(X(x1), Y(y1), { steps: 5 }); await page.mouse.up(); };
const root = () => ev(() => designer.store.page().children.map((c) => ({ id: c.id, t: c.type, name: c.name, x: c.x, y: c.y, w: c.w, h: c.h, kids: (c.children || []).map((k) => ({ t: k.type, x: k.x, y: k.y })) })));

// dois frames na raiz
await page.keyboard.press('f'); await drag(120, 140, 280, 260);
await page.keyboard.press('f'); await drag(320, 140, 480, 260);
// Shift+S e desenha uma seção em volta dos dois
await page.keyboard.press('Shift+S');
ok('Shift+S ativa a ferramenta seção', await ev(() => designer.store.ui.tool) === 'section');
await drag(80, 100, 560, 320);
let n = await root();
ok('seção fica atrás (índice 0) e tem nome "Seção 1"', n[0].t === 'section' && n[0].name === 'Seção 1', JSON.stringify(n));
ok('adotou as 2 telas totalmente dentro', n.length === 1 && n[0].kids.length === 2, JSON.stringify(n));
ok('coords das telas ficam relativas à seção', n[0].kids[0].x === 40 && n[0].kids[0].y === 40, JSON.stringify(n[0].kids));
ok('rótulo da seção existe no overlay', await page.locator('.board-label.section').count() === 1);
ok('rótulo também para as telas dentro', await page.locator('.board-label:not(.section)').count() === 2);

// clicar no corpo da seção a seleciona
await page.mouse.click(X(100), Y(300));
ok('clique no corpo seleciona a seção', await ev(() => designer.store.selected()[0]?.type) === 'section');
// clicar no nome seleciona
await page.locator('.board-label.section').click();
ok('clique no nome seleciona a seção', await ev(() => designer.store.selected()[0]?.type) === 'section');

// mover a seção pelo nome leva as telas
const before = await ev(() => designer.canvas.aabb(designer.store.page().children[0].children[0].id));
const lb = await page.locator('.board-label.section').boundingBox();
await page.mouse.move(lb.x + 5, lb.y + 5); await page.mouse.down(); await page.mouse.move(lb.x + 65, lb.y + 45, { steps: 6 }); await page.mouse.up();
const after = await ev(() => designer.canvas.aabb(designer.store.page().children[0].children[0].id));
ok('mover a seção leva as telas junto', Math.abs(after.x - before.x - 60) <= 2 && Math.abs(after.y - before.y - 40) <= 2, JSON.stringify([before, after]));

// reparent: seção não entra em frame; tela pode sair para a raiz via comando; retângulo não entra em seção
const res = await ev(() => {
  const { store, commands } = designer; const page = store.page();
  const sec = page.children[0]; const fr = sec.children[0];
  commands.reparent([sec], fr);
  const a = page.children[0].type === 'section';
  return { a };
});
ok('seção não vira filha de frame', res.a);

// código exportado usa <section>
const code = await ev(async () => { const m = await import('/src/css.js'); const s = designer.store.page().children[0]; return m.generateCode([s], null, {}, { root: true }).html; });
ok('HTML exportado usa <section>', /^<section class=/.test(code), code.slice(0, 80));

// Ctrl+Shift+G desfaz a seção: as telas sobem para a raiz
await ev(() => { designer.store.setSelection([designer.store.page().children[0].id]); designer.commands.ungroup(); });
n = await root();
ok('desagrupar a seção devolve as 2 telas à raiz', n.length === 2 && n.every((c) => c.t === 'frame'), JSON.stringify(n));
ok('sem erros no console', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(fails ? 1 : 0);
