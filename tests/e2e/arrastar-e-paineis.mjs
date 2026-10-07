import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto((process.env.APP_URL || 'http://localhost:5173/')); await page.waitForTimeout(600);
let fails = 0;
const ok = (name, cond, extra='') => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + extra)); };
const ev = (fn, arg) => page.evaluate(fn, arg);
await ev(() => designer.store.newDoc()); await page.waitForTimeout(150); await ev(() => designer.canvas.setView({ x: 0, y: 0, zoom: 1 }));
const vp = await page.locator('#viewport').boundingBox();
const X = (x) => vp.x + x, Y = (y) => vp.y + y;
const draw = async (key, x0, y0, x1, y1) => { await page.keyboard.press(key); await page.mouse.move(X(x0), Y(y0)); await page.mouse.down(); await page.mouse.move(X(x1), Y(y1), { steps: 4 }); await page.mouse.up(); };

await draw('f', 50, 50, 350, 300);       // frame A
await draw('f', 450, 50, 750, 300);      // frame B
await draw('r', 500, 100, 560, 150);     // rect dentro de B
let tree = await ev(() => designer.store.page().children.map(f => f.children.length));
ok('rect nasceu dentro do frame B', tree[0] === 0 && tree[1] === 1, JSON.stringify(tree));

// --- arrastar rect de B para A (reparent ao vivo)
await page.mouse.move(X(530), Y(125)); await page.mouse.down(); await page.mouse.move(X(200), Y(150), { steps: 10 }); await page.mouse.up();
tree = await ev(() => designer.store.page().children.map(f => f.children.length));
ok('arrastar entre frames troca o pai', tree[0] === 1 && tree[1] === 0, JSON.stringify(tree));
const pos = await ev(() => { const c = designer.store.page().children[0].children[0]; return [c.x, c.y]; });
ok('posição visual mantida após reparent (~ 170,100)', Math.abs(pos[0] - 150) < 40 && pos[1] > 60 && pos[1] < 140, JSON.stringify(pos));

// --- Alt+arrastar duplica
await page.keyboard.down('Alt');
await page.mouse.move(X(200), Y(150)); await page.mouse.down(); await page.mouse.move(X(260), Y(220), { steps: 5 }); await page.mouse.up();
await page.keyboard.up('Alt');
ok('Alt+arrastar duplica', (await ev(() => designer.store.page().children[0].children.length)) === 2);

// --- marquee seleciona os dois filhos de A
await ev(() => designer.store.setSelection([]));
await page.mouse.move(X(60), Y(60)); await page.mouse.down(); await page.mouse.move(X(340), Y(290), { steps: 6 }); await page.mouse.up();
ok('marquee dentro do frame seleciona filhos', (await ev(() => designer.store.ui.selection.length)) === 2, String(await ev(() => designer.store.ui.selection.length)));

// --- agrupar e redimensionar grupo escala filhos
await page.keyboard.press('Control+g');
const gid = await ev(() => designer.store.ui.selection[0]);
const gb = await ev(() => { const g = designer.store.get(designer.store.ui.selection[0]); return [g.w, g.h, g.children.map(c => c.w)]; });
const hse = await page.locator('.handle[data-handle="se"]').boundingBox();
await page.mouse.move(hse.x + 4, hse.y + 4); await page.mouse.down(); await page.mouse.move(hse.x + 4 + gb[0], hse.y + 4, { steps: 5 }); await page.mouse.up();
const ga = await ev((id) => { const g = designer.store.get(id); return [g.w, g.children.map(c => c.w)]; }, gid);
ok('redimensionar grupo dobra a largura e escala filhos', Math.abs(ga[0] - gb[0] * 2) <= 2 && Math.abs(ga[1][0] - gb[2][0] * 2) <= 2, JSON.stringify([gb, ga]));

// --- zoom com Ctrl+roda e pan com espaço
const z0 = await ev(() => designer.canvas.getView().zoom);
await page.keyboard.down('Control'); await page.mouse.move(X(500), Y(400)); await page.mouse.wheel(0, -100); await page.keyboard.up('Control');
const z1 = await ev(() => designer.canvas.getView().zoom);
ok('Ctrl+roda dá zoom', z1 > z0, `${z0}->${z1}`);
const v0 = await ev(() => ({ ...designer.canvas.getView() }));
await page.keyboard.down('Space'); await page.mouse.move(X(600), Y(600)); await page.mouse.down(); await page.mouse.move(X(650), Y(640), { steps: 4 }); await page.mouse.up(); await page.keyboard.up('Space');
const v1 = await ev(() => ({ ...designer.canvas.getView() }));
ok('Espaço+arrastar faz pan', Math.abs(v1.x - v0.x - 50) < 2 && Math.abs(v1.y - v0.y - 40) < 2, JSON.stringify([v0, v1]));

// --- layers: arrastar camada para dentro de outro frame via painel
await ev(() => designer.canvas.setView({ x: 0, y: 0, zoom: 1 }));
const ids = await ev(() => designer.store.page().children.map(c => c.id));
await page.dragAndDrop(`.layer-row[data-id="${ids[0]}"]`, `.layer-row[data-id="${ids[1]}"]`);
await page.waitForTimeout(200);
tree = await ev(() => designer.store.page().children.map(f => [f.name, f.children.length]));
ok('drag no painel de camadas aninha frame A em B', tree.length === 1 && tree[0][1] >= 1, JSON.stringify(tree));
await page.keyboard.press('Control+z');
tree = await ev(() => designer.store.page().children.length);
ok('undo desfaz o aninhamento', tree === 2, String(tree));

// --- campo numérico: digitar valor e conta
await ev(() => { const s = designer.store; s.setSelection([s.page().children[1].id]); });
await page.waitForTimeout(150);
const wInput = page.locator('.num-field:has(.num-label:text-is("W")) input');
await wInput.fill('100+50'); await wInput.press('Enter');
ok('campo W aceita conta (100+50)', (await ev(() => designer.store.page().children[1].w)) === 150);
// scrub no rótulo
const lab = await page.locator('.num-field:has(.num-label:text-is("H")) .num-label').boundingBox();
await page.mouse.move(lab.x + 8, lab.y + 8); await page.mouse.down(); await page.mouse.move(lab.x + 38, lab.y + 8, { steps: 5 }); await page.mouse.up();
ok('arrastar rótulo H altera altura (+30)', (await ev(() => designer.store.page().children[1].h)) === 280, String(await ev(() => designer.store.page().children[1].h)));

// --- menu de contexto
await page.mouse.click(X(600), Y(150), { button: 'right' });
await page.waitForTimeout(150);
ok('menu de contexto abre', (await page.locator('.menu .menu-item').count()) > 10);
await page.keyboard.press('Escape');

// --- imagem via arquivo (input)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
writeFileSync(join(tmpdir(), 'px.png'), png);
await page.locator('#toolbar input[type=file]').setInputFiles(join(tmpdir(), 'px.png'));
await page.waitForTimeout(400);
const imgNode = await ev(() => designer.store.page().children.find(c => c.fill.type === 'image'));
ok('imagem vira retângulo com fill image', !!imgNode && !!(await ev((id) => designer.store.state.doc.assets[designer.store.get(id).fill.assetId], imgNode.id)));

// --- páginas
await ev(() => designer.store.addPage());
ok('nova página', (await ev(() => designer.store.state.doc.pages.length)) === 2 && (await ev(() => designer.store.page().children.length)) === 0);

console.log(errors.join('\n') || 'no console errors');
console.log(fails ? `${fails} FAILURES` : 'ALL PASS');
await browser.close();
process.exitCode = fails || errors.length ? 1 : 0;
