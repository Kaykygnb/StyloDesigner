// Caneta para criar ícones: ícone 24×24 com encaixe, continuar caminho, seleção de vários pontos, converter, cortar,
// extremidade/quina do traço e o `d` do SVG. Usa a API do app (window.designer) e cliques reais da caneta.
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
const icon = await ev(() => { const n = designer.commands.newIcon(24); return { w: n.w, h: n.h, tool: designer.store.ui.tool, snap: designer.store.ui.penSnap, grids: n.grids.length }; });
ok('Novo ícone: 24×24, caneta ligada, encaixe de 1px, grade de pixels', icon.w === 24 && icon.h === 24 && icon.tool === 'pen' && icon.snap === 1 && icon.grids === 1, JSON.stringify(icon));
ok('vista com zoom grande', (await ev(() => designer.canvas.getView().zoom)) >= 8);

// desenha 3 pontos com cliques reais (2º e 3º em linha reta + um arrastado)
const pts = await ev(() => {
  const f = designer.store.page().children[0]; const o = designer.canvas.originOf(f.id); const z = designer.canvas.getView().zoom; const r = designer.canvas.vpRect();
  const at = (x, y) => { const s = designer.canvas.toScreen(o.x + x, o.y + y); return { x: r.left + s.x, y: r.top + s.y }; };
  return [at(4, 4), at(14, 4), at(14, 14)];
});
for (const p of pts) await page.mouse.click(p.x + 1, p.y + 1);
await page.keyboard.press('Enter');
let n = await ev(() => designer.store.page().children[0].children[0]);
ok('3 pontos encaixados em números inteiros', n && n.points.length === 3 && n.points.every((p) => Number.isInteger(p.x) && Number.isInteger(p.y)), JSON.stringify(n?.points));

// continuar pela ponta
await ev(() => designer.store.setSelection([designer.store.page().children[0].children[0].id]));
await page.keyboard.press('p');
const last = await ev(() => {
  const f = designer.store.page().children[0]; const nn = f.children[0]; const o = designer.canvas.originOf(nn.id); const sx = nn.w / nn.vw, sy = nn.h / nn.vh;
  const L = nn.points[nn.points.length - 1]; const s = designer.canvas.toScreen(o.x + L.x * sx, o.y + L.y * sy); const r = designer.canvas.vpRect();
  const nx = designer.canvas.toScreen(o.x - 10, o.y + 14); // um ponto novo para a esquerda
  return { x: r.left + s.x, y: r.top + s.y, nx: r.left + nx.x, ny: r.top + nx.y };
});
await page.mouse.click(last.x, last.y);
await page.mouse.click(last.nx, last.ny);
await page.keyboard.press('Enter');
n = await ev(() => designer.store.page().children[0]);
ok('clicar na ponta continua o MESMO vetor (4 pontos, 1 camada)', n.children.length === 1 && n.children[0].points.length === 4, JSON.stringify(n.children.map((c) => c.points.length)));

// edição: vários pontos, converter, apagar, abrir
const r = await ev(() => {
  const pen = designer.tools.pen; const nn = designer.store.page().children[0].children[0]; const out = {};
  pen.startEdit(nn.id); pen.selectAll(); out.count = pen.selectedCount();
  pen.setPointType('smooth'); out.smooth = nn.points.every((p) => p.hin && p.hout);
  pen.setPointType('corner'); out.corner = nn.points.every((p) => !p.hin && !p.hout);
  pen.downEdit({ shiftKey: false, altKey: false }, 'pt', 1); pen.up(); pen.downEdit({ shiftKey: true, altKey: false }, 'pt', 2);
  out.two = pen.selectedCount(); out.del = pen.deletePoint(); out.left = nn.points.length;
  pen.downEdit({ shiftKey: false, altKey: true }, 'pt', 0); out.alt = pen.pointType();
  designer.store.update(() => { nn.closed = true; }); designer.store.commit();
  pen.downEdit({ shiftKey: false, altKey: false }, 'pt', 0); pen.up(); pen.openAfter(); out.opened = !nn.closed;
  return out;
});
ok('Ctrl+A / selectAll pega todos os pontos', r.count === 4, JSON.stringify(r));
ok('tipo canto/suave aplica a todos os selecionados', r.smooth && r.corner, JSON.stringify(r));
ok('Shift soma ponto; Excluir remove os 2 e o caminho fica com 2', r.two === 2 && r.del && r.left === 2, JSON.stringify(r));
ok('Alt+clique converte o ponto (canto → curva espelhada)', r.alt === 'mirror', JSON.stringify(r));
ok('Abrir aqui corta o caminho fechado', r.opened, JSON.stringify(r));

// extremidade e quina no SVG
const svg = await ev(async () => {
  const { pathSvg } = await import('/src/css.js'); const nn = designer.store.page().children[0].children[0];
  nn.stroke = { color: '#000000', opacity: 1, width: 2, style: 'solid', position: 'center', cap: 'butt', join: 'miter' };
  return pathSvg(nn, {});
});
ok('extremidade e quina do traço vão para o SVG', /stroke-linecap="butt"/.test(svg) && /stroke-linejoin="miter"/.test(svg), svg.slice(0, 200));

// colar um `d` troca a forma e recusa lixo
const apply = await ev(() => { const pen = designer.tools.pen; const id = designer.store.page().children[0].children[0].id; return [pen.applyPathD(id, 'abc'), pen.applyPathD(id, 'M2 2 H 20 V 20 Z')]; });
ok('aplicar path d: lixo recusado, forma válida aceita', apply[0] === false && apply[1] === true, JSON.stringify(apply));

ok('sem erros no console', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(fails ? 1 : 0);
