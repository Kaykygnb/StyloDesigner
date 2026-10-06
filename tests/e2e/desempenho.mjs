import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await (await b.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.goto((process.env.APP_URL || 'http://localhost:5173/')); await p.waitForTimeout(700);
const N = Number(process.argv[2] || 400);
await p.evaluate(async (N) => {
  const m = await import('/src/model.js'); const s = designer.store;
  s.newDoc();
  const f = m.createNode('frame', { name: 'Grande', x: 0, y: 0, w: 2000, h: 1400 });
  for (let i = 0; i < N; i++) {
    const r = m.createNode(i % 3 === 0 ? 'text' : i % 3 === 1 ? 'rect' : 'ellipse', { x: (i % 40) * 48, y: Math.floor(i / 40) * 60, w: 40, h: 40, name: 'Item ' + i });
    r.fill = m.defaultFill('#' + ((i * 99991) % 0xffffff).toString(16).padStart(6, '0'));
    f.children.push(r);
  }
  s.update((pg) => pg.children.push(f), { commit: true });
}, N);
await p.waitForTimeout(500);
await p.evaluate(() => designer.canvas.fit(null));
const vp = await p.locator('#viewport').boundingBox();
// seleciona um item e arrasta, medindo o tempo por evento
const t = await p.evaluate(async () => {
  const s = designer.store; const f = s.page().children[0];
  const id = f.children[10].id; s.setSelection([id]);
  const b = designer.canvas.aabb(id); const sc = designer.canvas.toScreen(b.x + b.w / 2, b.y + b.h / 2); const r = designer.canvas.vpRect();
  return { x: r.left + sc.x, y: r.top + sc.y };
});
await p.mouse.move(t.x, t.y); await p.mouse.down();
const t0 = Date.now();
for (let i = 0; i < 40; i++) await p.mouse.move(t.x + i * 3, t.y + i * 2);
const dt = Date.now() - t0;
await p.mouse.up();
console.log(`${N} camadas: ${(dt / 40).toFixed(1)} ms por movimento (ideal < 16)`);
const t1 = Date.now();
await p.evaluate(() => { designer.store.setSelection(designer.store.page().children[0].children.slice(0, 50).map(c => c.id)); });
await p.waitForTimeout(50);
console.log('selecionar 50:', Date.now() - t1, 'ms');
console.log(errors.join() || 'sem erros');
await b.close();
