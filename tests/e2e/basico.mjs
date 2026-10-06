import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, permissions: ['clipboard-read','clipboard-write'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto((process.env.APP_URL || 'http://localhost:5173/'));
await page.waitForTimeout(800);
let fails = 0;
const ok = (name, cond, extra='') => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + extra)); };
const ev = (fn, arg) => page.evaluate(fn, arg);

// novo projeto vazio
await ev(() => designer.store.newDoc());
await ev(() => designer.canvas.setView({ x: 0, y: 0, zoom: 1 }));
const vp = await page.locator('#viewport').boundingBox();
const X = (x) => vp.x + x, Y = (y) => vp.y + y;

// --- desenhar frame
await page.keyboard.press('f');
await page.mouse.move(X(100), Y(100)); await page.mouse.down(); await page.mouse.move(X(400), Y(350), { steps: 5 }); await page.mouse.up();
let n = await ev(() => designer.store.page().children.map(c => ({ t: c.type, x: c.x, y: c.y, w: c.w, h: c.h, name: c.name })));
ok('frame desenhado 300x250', n.length === 1 && n[0].t === 'frame' && n[0].w === 300 && n[0].h === 250 && n[0].x === 100, JSON.stringify(n));
ok('ferramenta volta para mover', await ev(() => designer.store.ui.tool) === 'move');

// --- retângulo dentro do frame
await page.keyboard.press('r');
await page.mouse.move(X(120), Y(120)); await page.mouse.down(); await page.mouse.move(X(220), Y(190), { steps: 5 }); await page.mouse.up();
let f = await ev(() => designer.store.page().children[0]);
ok('retângulo aninhado no frame com coords relativas', f.children.length === 1 && f.children[0].x === 20 && f.children[0].y === 20 && f.children[0].w === 100 && f.children[0].h === 70, JSON.stringify(f.children.map(c=>[c.x,c.y,c.w,c.h])));

// --- mover o retângulo (arrasto)
await page.mouse.move(X(170), Y(155)); await page.mouse.down(); await page.mouse.move(X(200), Y(175), { steps: 6 }); await page.mouse.up();
let r = await ev(() => { const c = designer.store.page().children[0].children[0]; return [c.x, c.y]; });
ok('mover por arrasto (+30,+20)', r[0] >= 48 && r[0] <= 52 && r[1] >= 38 && r[1] <= 42, JSON.stringify(r));

// --- redimensionar pela alça se
const box = await ev(() => { const id = designer.store.ui.selection[0]; const b = designer.canvas.worldBox(id); return b; });
const hse = await page.locator('.handle[data-handle="se"]').boundingBox();
await page.mouse.move(hse.x + 4, hse.y + 4); await page.mouse.down(); await page.mouse.move(hse.x + 44, hse.y + 24, { steps: 5 }); await page.mouse.up();
r = await ev(() => { const c = designer.store.page().children[0].children[0]; return [c.w, c.h]; });
ok('redimensionar alça SE (+40,+20)', Math.abs(r[0] - 140) <= 1 && Math.abs(r[1] - 90) <= 1, JSON.stringify(r));

// --- rotacionar
const rz = await page.locator('.rotate-zone[data-rotate="ne"]').boundingBox();
const c = await ev(() => { const id = designer.store.ui.selection[0]; const b = designer.canvas.worldBox(id); const s = designer.canvas.toScreen(b.cx, b.cy); const r = designer.canvas.vpRect(); return { x: r.left + s.x, y: r.top + s.y }; });
await page.mouse.move(rz.x + 10, rz.y + 10); await page.mouse.down();
await page.mouse.move(c.x + 120, c.y + 0, { steps: 6 }); await page.mouse.up();
const rot = await ev(() => designer.store.page().children[0].children[0].rotation);
ok('rotacionar muda rotation', Math.abs(rot) > 20, String(rot));
await ev(() => designer.store.update(() => { designer.store.page().children[0].children[0].rotation = 0; }, { commit: true }));

// --- texto: ferramenta T + digitar
await page.keyboard.press('t');
await page.mouse.move(X(130), Y(300)); await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(100);
ok('modo edição de texto ativo', !!(await ev(() => designer.store.ui.editingId)));
await page.keyboard.type('Olá mundo');
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
const txt = await ev(() => { const l = designer.store.page().children[0].children; return l.map(x => x.type === 'text' ? x.text : null).filter(Boolean); });
ok('texto digitado salvo dentro do frame', txt.includes('Olá mundo'), JSON.stringify(txt));

// --- undo / redo
const cntBefore = await ev(() => designer.store.page().children[0].children.length);
await page.keyboard.press('Control+z');
await page.keyboard.press('Control+z');
const cntAfter = await ev(() => designer.store.page().children[0].children.length);
ok('undo remove camadas', cntAfter < cntBefore, `${cntBefore}->${cntAfter}`);
await page.keyboard.press('Control+Shift+z'); await page.keyboard.press('Control+Shift+z');
ok('redo restaura', (await ev(() => designer.store.page().children[0].children.length)) === cntBefore);

// --- auto layout (Shift+A) no frame
await ev(() => designer.store.setSelection([designer.store.page().children[0].id]));
await page.keyboard.press('Shift+A');
const lay = await ev(() => designer.store.page().children[0].layout);
ok('Shift+A liga auto layout', lay.mode !== 'none', JSON.stringify(lay));
const disp = await ev(() => getComputedStyle(designer.canvas.els.get(designer.store.page().children[0].id)).display);
ok('DOM do frame é display:flex', disp === 'flex', disp);

// --- reordenar item no flex arrastando
const before = await ev(() => designer.store.page().children[0].children.map(c => c.id));
const firstBox = await ev(() => { const id = designer.store.page().children[0].children[0].id; return designer.canvas.aabb(id); });
const lastBox = await ev(() => { const l = designer.store.page().children[0].children; return designer.canvas.aabb(l[l.length-1].id); });
const sc = (b, fx, fy) => ({ x: X(0) + designer.__v?.x || 0 });
const toClient = await ev(() => { const r = designer.canvas.vpRect(); const v = designer.canvas.getView(); return { l: r.left, t: r.top, x: v.x, y: v.y, z: v.zoom }; });
const cx = (b) => toClient.l + toClient.x + (b.x + b.w / 2) * toClient.z, cy = (b) => toClient.t + toClient.y + (b.y + b.h / 2) * toClient.z;
await page.mouse.move(cx(firstBox), cy(firstBox)); await page.mouse.down();
await page.mouse.move(cx(lastBox) + 40, cy(lastBox) + 40, { steps: 8 }); await page.mouse.up();
const after = await ev(() => designer.store.page().children[0].children.map(c => c.id));
ok('arrastar item no flex reordena', JSON.stringify(before) !== JSON.stringify(after), 'ordem igual');

// --- agrupar
await ev(() => designer.store.setSelection(designer.store.page().children[0].children.map(c => c.id)));
await page.keyboard.press('Control+g');
const g = await ev(() => designer.store.page().children[0].children.map(c => c.type));
ok('Ctrl+G cria grupo', g.length === 1 && g[0] === 'group', JSON.stringify(g));
await page.keyboard.press('Control+Shift+g');
ok('Ctrl+Shift+G desfaz grupo', (await ev(() => designer.store.page().children[0].children.every(c => c.type !== 'group'))));

// --- duplicar + deletar
const total0 = await ev(() => designer.store.page().children.length);
await ev(() => designer.store.setSelection([designer.store.page().children[0].id]));
await page.keyboard.press('Control+d');
ok('Ctrl+D duplica', (await ev(() => designer.store.page().children.length)) === total0 + 1);
await page.keyboard.press('Delete');
ok('Delete remove', (await ev(() => designer.store.page().children.length)) === total0);

// --- aba Código
await page.click('.tab:has-text("Código")');
await ev(() => designer.store.setSelection([designer.store.page().children[0].id]));
await page.waitForTimeout(200);
const code = await page.locator('.code-view').innerText();
ok('aba Código mostra CSS com flex', /display: flex;/.test(code) && /position: absolute;/.test(code), code.slice(0, 120));

// --- persistência
await page.waitForTimeout(600);
await page.reload(); await page.waitForTimeout(600);
ok('autosave recarrega o projeto', (await ev(() => designer.store.page().children.length)) === total0);

await page.screenshot({ path: (process.env.TMPDIR || '/tmp') + '/after.png' });
console.log(errors.join('\n') || 'no console errors');
console.log(fails ? `${fails} FAILURES` : 'ALL PASS');
await browser.close();
