import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto(new URL('?editor', process.env.APP_URL || 'http://localhost:5173/').href); await page.waitForTimeout(600);
let fails = 0;
const ok = (n, c, x='') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + x)); };
const ev = (f, a) => page.evaluate(f, a);
await ev(() => designer.store.newDoc()); await page.waitForTimeout(150);
await ev(() => designer.canvas.setView({ x: 0, y: 0, zoom: 1 }));
const vp = await page.locator('#viewport').boundingBox();
const X = (x) => vp.x + x, Y = (y) => vp.y + y;
const kids = () => ev(() => designer.store.page().children.map(n => ({ id: n.id, t: n.type, x: n.x, y: n.y, w: n.w, h: n.h, r: n.rotation, n: n.points?.length, closed: n.closed })));

// ---- linha
await page.keyboard.press('l');
await page.mouse.move(X(100), Y(100)); await page.mouse.down(); await page.mouse.move(X(200), Y(100), { steps: 4 }); await page.mouse.up();
let k = await kids();
ok('linha desenhada (100px, horizontal)', k.length === 1 && k[0].t === 'line' && k[0].w === 100 && k[0].r === 0, JSON.stringify(k));
await page.mouse.move(X(300), Y(300)); // limpa hover
await ev(() => designer.store.setSelection([]));

// ---- caneta: triângulo fechado
await page.keyboard.press('p');
await page.mouse.click(X(400), Y(100));
await page.mouse.click(X(500), Y(100));
await page.mouse.click(X(450), Y(200));
await page.mouse.click(X(400), Y(100)); // fecha no primeiro ponto
k = await kids();
const path = k.find(n => n.t === 'path');
ok('caneta cria caminho fechado com 3 pontos', !!path && path.closed && path.n === 3 && path.w === 100 && path.h === 100, JSON.stringify(k));
ok('ferramenta volta ao mover', (await ev(() => designer.store.ui.tool)) === 'move');
const svg = await ev((id) => designer.canvas.els.get(id).innerHTML, path.id);
ok('DOM do vetor tem <svg> com path', /<svg/.test(svg) && /<path d="M 0 0 L 100 0 L 50 100 L 0 0|M 0 0/.test(svg), svg.slice(0, 160));

// ---- caneta com curva (arrastar cria alças)
await page.keyboard.press('p');
await page.mouse.move(X(600), Y(150)); await page.mouse.down(); await page.mouse.move(X(640), Y(120), { steps: 4 }); await page.mouse.up();
await page.mouse.click(X(700), Y(200));
await page.keyboard.press('Enter');
const curve = (await ev(() => designer.store.page().children.at(-1)));
ok('arrastar na caneta cria ponto com alças', curve.type === 'path' && !!curve.points[0].hout && !!curve.points[0].hin, JSON.stringify(curve.points));

// ---- editar pontos: duplo clique no triângulo
await ev((id) => designer.store.setSelection([id]), path.id);
await page.mouse.dblclick(X(450), Y(110));
await page.waitForTimeout(100);
ok('duplo clique entra no modo de edição de pontos', (await ev(() => designer.store.ui.editPathId)) === path.id);
const pts0 = await ev((id) => designer.store.get(id).points.map(p => [p.x, p.y]), path.id);
const handle = page.locator('.pen-pt[data-idx="2"]');
const hb = await handle.boundingBox();
await page.mouse.move(hb.x + 4, hb.y + 4); await page.mouse.down(); await page.mouse.move(hb.x + 4, hb.y + 54, { steps: 5 }); await page.mouse.up();
const pts1 = await ev((id) => { const n = designer.store.get(id); return { h: n.h, pts: n.points.map(p => [p.x, p.y]) }; }, path.id);
ok('arrastar ponto altera o caminho (altura 150)', Math.abs(pts1.h - 150) <= 2, JSON.stringify([pts0, pts1]));
await page.keyboard.press('Escape');
ok('Esc sai da edição', !(await ev(() => designer.store.ui.editPathId)));

// ---- polígono e estrela
await page.keyboard.press('Escape');
await ev(() => designer.store.setTool('star'));
await page.mouse.move(X(800), Y(100)); await page.mouse.down(); await page.mouse.move(X(900), Y(200), { steps: 4 }); await page.mouse.up();
const star = await ev(() => designer.store.page().children.at(-1));
ok('estrela = caminho fechado com 10 pontos', star.type === 'path' && star.points.length === 10 && star.closed, star.type + star.points?.length);

// ---- réguas e guias
await page.locator('.ruler-left').hover();
const rl = await page.locator('.ruler-left').boundingBox();
await page.mouse.move(rl.x + 10, rl.y + 200); await page.mouse.down(); await page.mouse.move(X(260), Y(300), { steps: 6 }); await page.mouse.up();
const guides = await ev(() => designer.store.page().guides);
ok('arrastar da régua cria guia vertical', guides.length === 1 && guides[0].axis === 'x' && Math.abs(guides[0].pos - 260) <= 2, JSON.stringify(guides));
const gl = page.locator('.guide-line.v').first();
const gb = await gl.boundingBox();
await page.mouse.move(gb.x + 3, Y(400)); await page.mouse.down(); await page.mouse.move(X(5), Y(400), { steps: 5 }); await page.mouse.up();
ok('arrastar a guia de volta para a régua apaga', (await ev(() => designer.store.page().guides.length)) === 0);

// ---- frame + constraints
await ev(() => { designer.store.page().children.length = 0; designer.store.commit(); });
await page.keyboard.press('f');
await page.mouse.move(X(100), Y(100)); await page.mouse.down(); await page.mouse.move(X(300), Y(300), { steps: 4 }); await page.mouse.up();
await page.keyboard.press('r');
await page.mouse.move(X(250), Y(250)); await page.mouse.down(); await page.mouse.move(X(290), Y(290), { steps: 4 }); await page.mouse.up();
await ev(() => { const r = designer.store.page().children[0].children[0]; designer.store.update(() => { r.constraints = { h: 'right', v: 'bottom' }; }, { commit: true }); designer.store.setSelection([designer.store.page().children[0].id]); });
await page.waitForTimeout(100);
const hse = await page.locator('.handle[data-handle="se"]').boundingBox();
await page.mouse.move(hse.x + 4, hse.y + 4); await page.mouse.down(); await page.mouse.move(hse.x + 104, hse.y + 54, { steps: 5 }); await page.mouse.up();
const cr = await ev(() => { const f = designer.store.page().children[0]; const r = f.children[0]; return { fw: f.w, fh: f.h, x: r.x, y: r.y }; });
ok('constraints right/bottom: filho acompanha o canto ao redimensionar', cr.fw === 300 && cr.fh === 250 && cr.x === 250 && cr.y === 200, JSON.stringify(cr));

// ---- CSS Grid via painel
await ev(() => designer.store.page().children[0].children.push(...[1,2,3].map(i => ({ ...designer.store.page().children[0].children[0], id: 'g' + i, constraints: { h: 'left', v: 'top' }, x: 0, y: 0, w: 50, h: 30 }))));
await ev(() => { designer.store.update(() => {}); designer.store.setSelection([designer.store.page().children[0].id]); });
await page.waitForTimeout(150);
await page.click('.seg-btn[title^="CSS Grid"]');
const gd = await ev(() => { const f = designer.store.page().children[0]; return { mode: f.layout.mode, cols: f.layout.cols, disp: getComputedStyle(designer.canvas.els.get(f.id)).display, tpl: getComputedStyle(designer.canvas.els.get(f.id)).gridTemplateColumns }; });
ok('modo Grid: display:grid no DOM com colunas', gd.mode === 'grid' && gd.disp === 'grid' && gd.tpl.split(' ').length === gd.cols, JSON.stringify(gd));

// ---- componente + instância + override
await ev(() => { designer.store.page().children.length = 0; designer.store.commit(); });
await page.keyboard.press('f');
await page.mouse.move(X(100), Y(100)); await page.mouse.down(); await page.mouse.move(X(260), Y(180), { steps: 4 }); await page.mouse.up();
await page.keyboard.press('t');
await page.mouse.click(X(120), Y(120));
await page.keyboard.type('Botão'); await page.keyboard.press('Escape');
await ev(() => designer.store.setSelection([designer.store.page().children[0].id]));
await page.keyboard.press('Control+Alt+k');
const main = await ev(() => designer.store.page().children[0]);
ok('Ctrl+Alt+K cria componente', main.component === true);
await page.click('button:has-text("Criar instância")');
const t2 = await ev(() => { const c = designer.store.page().children; return { n: c.length, inst: c[1].instanceOf, kid: c[1].children[0].text }; });
ok('instância criada com filhos do principal', t2.n === 2 && t2.inst === main.id && t2.kid === 'Botão', JSON.stringify(t2));
await ev(() => { const s = designer.store; const inst = s.page().children[1]; s.update(() => { inst.children[0].text = 'Cancelar'; }, { commit: true }); const m = s.page().children[0]; s.update(() => { m.fill.color = '#FF0000'; m.children[0].fontSize = 40; }, { commit: true }); });
const t3 = await ev(() => { const i = designer.store.page().children[1]; return { color: i.fill.color, fs: i.children[0].fontSize, text: i.children[0].text }; });
ok('mudar principal propaga; texto sobrescrito permanece', t3.color === '#FF0000' && t3.fs === 40 && t3.text === 'Cancelar', JSON.stringify(t3));
await page.keyboard.press('Control+z'); 
const undone = await ev(() => designer.store.page().children[0].fill.color);
ok('undo funciona com componentes', undone !== '#FF0000', undone);

// ---- máscara + espelhar
await ev(() => { designer.store.page().children.length = 0; designer.store.commit(); });
await ev(() => { const s = designer.store; const { createNode } = { createNode: null }; });
const mk = await ev(async () => {
  const m = await import('/src/model.js');
  const s = designer.store;
  const a = m.createNode('rect', { x: 50, y: 50, w: 200, h: 100 });
  const b = m.createNode('ellipse', { x: 100, y: 60, w: 80, h: 80 });
  s.update((p) => p.children.push(a, b), { commit: true });
  s.setSelection([a.id, b.id]);
  return [a.id, b.id];
});
await page.keyboard.press('Control+Alt+m');
const g = await ev(() => { const gr = designer.store.page().children[0]; return { type: gr.type, mask: gr.children[0].isMask, clip: getComputedStyle(designer.canvas.els.get(gr.id)).clipPath }; });
ok('Ctrl+Alt+M cria grupo com máscara (clip-path)', g.type === 'group' && g.mask && g.clip !== 'none', JSON.stringify(g));
await page.keyboard.press('Shift+h');
ok('Shift+H espelha', (await ev(() => designer.store.page().children[0].flipX)) === true);

// ---- estilos
await ev(() => { designer.store.page().children.length = 0; designer.store.commit(); });
const sid = await ev(async () => {
  const m = await import('/src/model.js'); const s = designer.store;
  const r = m.createNode('rect', { w: 50, h: 50 }); r.fill = m.defaultFill('#112233');
  const r2 = m.createNode('rect', { w: 50, h: 50, x: 100 });
  s.update((p) => p.children.push(r, r2), { commit: true });
  const st = designer.commands.addColorStyle(r, 'Marca');
  r2.fill.styleId = st.id; s.commit();
  st.color = '#AA00FF'; s.commit();
  return [r.fill.color, r2.fill.color];
});
ok('estilo de cor propaga para todas as camadas', sid[0] === '#AA00FF' && sid[1] === '#AA00FF', JSON.stringify(sid));

// ---- aba Recursos
await page.click('.tab:has-text("Recursos")');
ok('aba Recursos lista o estilo', (await page.locator('.asset-row:has-text("Marca")').count()) === 1);

console.log('rulers:', await ev(() => JSON.stringify({ top: getComputedStyle(document.querySelector('.ruler-top')).display, show: designer.store.ui.showRulers, w: document.querySelector('.ruler-top').width })));
await page.screenshot({ path: join(tmpdir(), 'feat.png') });
console.log(errors.join('\n') || 'no console errors');
console.log(fails ? `${fails} FAILURES` : 'ALL PASS');
await browser.close();
process.exitCode = fails || errors.length ? 1 : 0;
