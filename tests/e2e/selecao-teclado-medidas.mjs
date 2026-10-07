import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await (await b.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
await p.goto((process.env.APP_URL || 'http://localhost:5173/')); await p.waitForTimeout(800);
let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + x)); };
const ev = (f, a) => p.evaluate(f, a);
const find = (name) => ev((name) => { let id; const w = (l) => l.forEach(n => { if (n.name === name) id = n.id; n.children && w(n.children); }); w(designer.store.page().children); return id; }, name);
const center = (id) => ev((id) => { const b = designer.canvas.aabb(id); const s = designer.canvas.toScreen(b.x + b.w / 2, b.y + b.h / 2); const r = designer.canvas.vpRect(); return { x: r.left + s.x, y: r.top + s.y }; }, id);

// ---- Ctrl+clique atravessa grupos
await ev(async () => { const s = designer.store; const hero = s.page().children[2]; });
await ev(async () => {
  const m = await import('/src/model.js'); const s = designer.store; s.newDoc();
  const a = m.createNode('rect', { x: 100, y: 100, w: 80, h: 80, name: 'A' }); const c = m.createNode('rect', { x: 200, y: 100, w: 80, h: 80, name: 'B' });
  s.update((pg) => pg.children.push(a, c), { commit: true }); s.setSelection([a.id, c.id]); designer.commands.group();
  designer.canvas.setView({ x: 0, y: 0, zoom: 1 }); s.setSelection([]);
});
await p.waitForTimeout(200);
const idA = await find('A');
let pt = await center(idA);
await p.mouse.click(pt.x, pt.y);
ok('clique normal seleciona o grupo', (await ev(() => designer.store.get(designer.store.ui.selection[0]).type)) === 'group');
await ev(() => designer.store.setSelection([]));
await p.keyboard.down('Control'); await p.mouse.click(pt.x, pt.y); await p.keyboard.up('Control');
ok('Ctrl+clique seleciona a camada dentro do grupo', (await ev(() => designer.store.get(designer.store.ui.selection[0]).name)) === 'A');

// ---- Tab
await ev(async () => { const m = await import('/src/model.js'); const s = designer.store; s.newDoc(); const l = ['1', '2', '3'].map((n, i) => m.createNode('rect', { x: i * 100, y: 0, w: 50, h: 50, name: n })); s.update((pg) => pg.children.push(...l), { commit: true }); s.setSelection([l[2].id]); });
await p.keyboard.press('Tab');
ok('Tab vai para a camada de baixo na lista (3→2)', (await ev(() => designer.store.get(designer.store.ui.selection[0]).name)) === '2');
await p.keyboard.press('Shift+Tab');
ok('Shift+Tab volta (2→3)', (await ev(() => designer.store.get(designer.store.ui.selection[0]).name)) === '3');

// ---- copiar/colar propriedades
await ev(async () => { const s = designer.store; const m = await import('/src/model.js'); const [a, b2] = s.page().children; s.update(() => { a.fill = m.defaultFill('#FF00AA'); a.radius = [12, 12, 12, 12]; a.opacity = 0.5; }, { commit: true }); s.setSelection([a.id]); });
await p.keyboard.press('Control+Alt+c');
await ev(() => designer.store.setSelection([designer.store.page().children[1].id]));
await p.keyboard.press('Control+Alt+v');
const st = await ev(() => { const n = designer.store.page().children[1]; return [n.fill.color, n.radius[0], n.opacity]; });
ok('Ctrl+Alt+C / Ctrl+Alt+V copia e cola propriedades', st[0] === '#FF00AA' && st[1] === 12 && st[2] === 0.5, JSON.stringify(st));

// ---- colar dentro de frame selecionado
await ev(async () => { const m = await import('/src/model.js'); const s = designer.store; s.newDoc(); const f = m.createNode('frame', { x: 400, y: 0, w: 300, h: 300, name: 'Alvo' }); const r = m.createNode('rect', { x: 0, y: 0, w: 60, h: 60, name: 'Item' }); s.update((pg) => pg.children.push(r, f), { commit: true }); s.setSelection([r.id]); });
await p.keyboard.press('Control+c');
await ev(() => designer.store.setSelection([designer.store.page().children[1].id]));
await p.keyboard.press('Control+v');
await p.waitForTimeout(100);
const inside = await ev(() => { const f = designer.store.page().children[1]; return f.children.length; });
ok('Ctrl+V com frame selecionado cola dentro dele', inside === 1, String(inside));

// ---- ungroup de frame
await ev(() => designer.store.setSelection([designer.store.page().children[1].id]));
await p.keyboard.press('Control+Shift+g');
ok('Ctrl+Shift+G em frame solta os filhos', (await ev(() => designer.store.page().children.every(n => n.type !== 'frame'))));

// ---- B/I/U ao editar texto
await ev(async () => { const m = await import('/src/model.js'); const s = designer.store; s.newDoc(); const t = m.createNode('text', { x: 100, y: 100, text: 'Oi' }); s.update((pg) => pg.children.push(t), { commit: true }); s.setSelection([t.id]); designer.canvas.setView({ x: 0, y: 0, zoom: 1 }); });
await p.keyboard.press('Enter');
await p.waitForTimeout(100);
await p.keyboard.press('Control+b'); await p.keyboard.press('Control+i'); await p.keyboard.press('Control+u');
const tx = await ev(() => { const n = designer.store.page().children[0]; return [n.fontWeight, n.fontStyle, n.textDecoration]; });
ok('Ctrl+B/I/U formatam o texto durante a edição', tx[0] === 700 && tx[1] === 'italic' && tx[2] === 'underline', JSON.stringify(tx));
await p.keyboard.press('Escape');

// ---- medidas com Alt
await ev(async () => { const m = await import('/src/model.js'); const s = designer.store; s.newDoc(); const a = m.createNode('rect', { x: 100, y: 100, w: 80, h: 80, name: 'A' }); const c = m.createNode('rect', { x: 300, y: 120, w: 80, h: 80, name: 'B' }); s.update((pg) => pg.children.push(a, c), { commit: true }); s.setSelection([a.id]); designer.canvas.setView({ x: 0, y: 0, zoom: 1 }); });
const idB = await find('B'); const pb = await center(idB);
await p.keyboard.down('Alt'); await p.mouse.move(pb.x, pb.y); await p.mouse.move(pb.x + 2, pb.y + 2);
await p.waitForTimeout(150);
const txt = await p.locator('.measure-text').evaluateAll(els => els.map(e => e.textContent));
ok('Alt+mouse mostra a distância (120)', txt.includes('120'), JSON.stringify(txt));
await p.keyboard.up('Alt'); await p.waitForTimeout(100);
ok('soltar Alt remove as medidas', (await p.locator('.measure-text').count()) === 0);

// ---- grade de pixels
await ev(() => designer.canvas.zoomAt(10, 600, 400)); await p.waitForTimeout(100);
ok('zoom ≥ 800% liga a grade de pixels', await ev(() => document.querySelector('.overlay').classList.contains('pixels')));
if (errors.length) { console.error(errors.join('\n')); fails += errors.length; }
else console.log('sem erros');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
// codex: transforma erro de navegador e asserção em código de saída não zero.
process.exitCode = fails ? 1 : 0;
await b.close();
process.exitCode = fails || errors.length ? 1 : 0;
