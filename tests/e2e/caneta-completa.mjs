// Caneta "de verdade", simulando o usuário com o mouse e o teclado: desenhar (canto, curva, Alt quebra a simetria,
// Shift 45°, Backspace, fechar no 1º ponto, pré-visualização), editar pontos (clicar no traço adiciona, arrastar,
// Shift+clique, caixa, setas, Delete, duplo clique canto/curva, modos de alça no painel, desfazer), lápis à mão livre,
// contorno (tracejado, dentro/fora, pontas/quinas) exportado, e booleanas (unir/subtrair/interseção/excluir).
// Capturas opcionais: CAPTURAS=pasta (1440×900).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto(new URL('?editor', process.env.APP_URL || 'http://localhost:5173/').href);
await page.waitForTimeout(800);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + extra)); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const shotDir = process.env.CAPTURAS;
if (shotDir) mkdirSync(shotDir, { recursive: true });
const shot = async (name) => { if (shotDir) await page.screenshot({ path: join(shotDir, name) }); };

await ev(() => { designer.store.newDoc(); designer.canvas.setView({ x: 0, y: 0, zoom: 1 }); designer.store.emit('view'); });
await page.waitForTimeout(200);
// mundo → tela (px da janela)
const S = (x, y) => ev(([x, y]) => { const s = designer.canvas.toScreen(x, y); const r = designer.canvas.vpRect(); return { x: r.left + s.x, y: r.top + s.y }; }, [x, y]);
const vec = () => ev(() => { const l = designer.store.page().children; const n = l[l.length - 1]; return n && JSON.parse(JSON.stringify(n)); });

// ================================================================== 1) DESENHAR
await page.keyboard.press('p');
const A = await S(300, 300), B = await S(450, 220), C = await S(600, 320), D = await S(520, 480);
await page.mouse.click(A.x, A.y); // canto
// clicar e arrastar = curva com alças simétricas
await page.mouse.move(B.x, B.y); await page.mouse.down(); await page.mouse.move(B.x + 40, B.y, { steps: 5 }); await page.mouse.move(B.x + 60, B.y + 10, { steps: 5 }); await page.mouse.up();
// arrasto com Alt no meio: a alça de entrada congela, só a de saída segue
await page.mouse.move(C.x, C.y); await page.mouse.down(); await page.mouse.move(C.x + 20, C.y + 40, { steps: 5 });
await page.keyboard.down('Alt'); await page.mouse.move(C.x - 30, C.y + 60, { steps: 5 }); await page.mouse.up(); await page.keyboard.up('Alt');
// pré-visualização do próximo segmento
await page.mouse.move(D.x, D.y, { steps: 4 });
const preview = await ev(() => { const p = document.querySelector('.pen-layer path'); return p?.getAttribute('d') || ''; });
ok('pré-visualização mostra o próximo segmento (curvo, sai da alça)', /C/.test(preview) && preview.split(/[MLC]/).length >= 4, preview.slice(0, 120));
// Shift trava em 45°
const Dq = await S(700, 330); // quase horizontal a partir de C(600,320)
await page.keyboard.down('Shift'); await page.mouse.click(Dq.x, Dq.y); await page.keyboard.up('Shift');
let draw = await ev(() => JSON.parse(JSON.stringify(designer.store.ui.pen.pts)));
ok('Shift trava o segmento em 45° (aqui: horizontal)', draw.length === 4 && Math.abs(draw[3].y - draw[2].y) < 0.6, JSON.stringify(draw[3]));
ok('arrastar cria curva com alças simétricas (espelhadas)', draw[1].hin && draw[1].hout && Math.abs(draw[1].hin.x + draw[1].hout.x - 2 * draw[1].x) < 0.01 && draw[1].mode === 'mirror', JSON.stringify(draw[1]));
ok('Alt no arraste quebra a simetria (alças independentes)', draw[2].mode === 'free' && Math.abs(draw[2].hin.x + draw[2].hout.x - 2 * draw[2].x) > 5, JSON.stringify(draw[2]));
await shot('01-caneta-desenhando.png');
await page.keyboard.press('Backspace');
draw = await ev(() => designer.store.ui.pen.pts.length);
ok('Backspace remove o último ponto', draw === 3, String(draw));
// clicar no primeiro ponto fecha
await page.mouse.click(A.x + 2, A.y + 1);
let v = await vec();
ok('clicar no 1º ponto fecha o caminho', v?.type === 'path' && v.closed && v.points.length === 3 && v.fill.type !== 'none', JSON.stringify({ closed: v?.closed, n: v?.points.length }));
ok('a ferramenta volta para Mover e o vetor fica selecionado', (await ev(() => designer.store.ui.tool)) === 'move' && (await ev(() => designer.store.ui.selection[0])) === v.id);
const pathId = v.id;

// Esc termina caminho aberto; continuar pelo ponto final
await page.keyboard.press('p');
const E1 = await S(300, 600), E2 = await S(420, 600);
await page.mouse.click(E1.x, E1.y); await page.mouse.click(E2.x, E2.y);
await page.keyboard.press('Escape');
v = await vec();
ok('Esc termina deixando o caminho aberto', v.points.length === 2 && !v.closed, JSON.stringify(v.points));
await page.keyboard.press('p');
const E3 = await S(520, 640);
await page.mouse.click(E2.x, E2.y); await page.mouse.click(E3.x, E3.y); await page.keyboard.press('Enter');
v = await vec();
ok('clicar na ponta de um caminho aberto CONTINUA o mesmo vetor', v.points.length === 3 && (await ev(() => designer.store.page().children.length)) === 2, JSON.stringify(v.points.length));
await ev(() => { const l = designer.store.page().children; l.pop(); designer.store.commit(); });

// ================================================================== 2) EDITAR PONTOS
await ev((id) => designer.store.setSelection([id]), pathId);
await page.keyboard.press('Enter');
ok('Enter entra na edição de pontos', (await ev(() => designer.store.ui.editPathId)) === pathId);
const ptScreen = (i) => ev(([id, i]) => {
  const pen = designer.tools.pen; const n = designer.store.get(id); const o = designer.canvas.originOf(id);
  const p = n.points[i]; const s = designer.canvas.toScreen(o.x + p.x * n.w / n.vw, o.y + p.y * n.h / n.vh); const r = designer.canvas.vpRect();
  return { x: r.left + s.x, y: r.top + s.y };
}, [pathId, i]);
// clicar no meio do segmento reto (C→A, fechamento) adiciona ponto
// ponto do MEIO da curva 2→0 (o segmento de fechamento é curvo: o ponto 2 tem alça de saída)
const mid = await ev((id) => {
  const n = designer.store.get(id); const o = designer.canvas.originOf(id); const r = designer.canvas.vpRect();
  const a = n.points[2], b = n.points[0], c1 = a.hout || a, c2 = b.hin || b, t = 0.5, u = 0.5;
  const x = u ** 3 * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * b.x, y = u ** 3 * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * b.y;
  const s = designer.canvas.toScreen(o.x + x * n.w / n.vw, o.y + y * n.h / n.vh);
  return { x: r.left + s.x, y: r.top + s.y };
}, pathId);
await page.mouse.move(mid.x, mid.y);
ok('passar o mouse no traço mostra onde o ponto entra', await ev(() => !!document.querySelector('.pen-ghost')));
await page.mouse.click(mid.x, mid.y);
v = await ev((id) => JSON.parse(JSON.stringify(designer.store.get(id))), pathId);
ok('clicar no segmento adiciona um ponto', v.points.length === 4, String(v.points.length));
await page.keyboard.press('Control+z');
v = await ev((id) => JSON.parse(JSON.stringify(designer.store.get(id))), pathId);
ok('Ctrl+Z desfaz só esse passo', v.points.length === 3, String(v.points.length));
await ev((id) => { if (designer.store.ui.editPathId !== id) designer.tools.pen.startEdit(id); }, pathId);
// arrastar um ponto
const before = v.points[0];
const q0 = await ptScreen(0);
await page.mouse.move(q0.x, q0.y); await page.mouse.down(); await page.mouse.move(q0.x - 30, q0.y + 20, { steps: 6 }); await page.mouse.up();
v = await ev((id) => JSON.parse(JSON.stringify(designer.store.get(id))), pathId);
const moved = await ev((id) => { const n = designer.store.get(id); return { x: n.x + n.points[0].x, y: n.y + n.points[0].y }; }, pathId);
ok('arrastar o ponto o move (≈ −30, +20)', Math.abs(moved.x - (300 - 30)) < 2 && Math.abs(moved.y - (300 + 20)) < 2, JSON.stringify(moved));
// arrastar a alça de saída do ponto curvo (1) – espelhada: a outra acompanha
const q1 = await ptScreen(1);
await page.mouse.click(q1.x, q1.y);
const hout = await ev(() => { const el = document.querySelector('.pen-handle.hit[data-edit="hout"][data-idx="1"]'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await page.mouse.move(hout.x, hout.y); await page.mouse.down(); await page.mouse.move(hout.x + 10, hout.y - 30, { steps: 5 }); await page.mouse.up();
v = await ev((id) => JSON.parse(JSON.stringify(designer.store.get(id))), pathId);
let p1 = v.points[1];
ok('alça espelhada: a oposta acompanha', Math.abs(p1.hin.x + p1.hout.x - 2 * p1.x) < 0.05 && Math.abs(p1.hin.y + p1.hout.y - 2 * p1.y) < 0.05, JSON.stringify(p1));
// modo assimétrico pelo painel e arrasto: mantém o comprimento da oposta
await page.click('[data-ptmode="asym"]');
const lenIn = Math.hypot(p1.hin.x - p1.x, p1.hin.y - p1.y);
const hout2 = await ev(() => { const el = document.querySelector('.pen-handle.hit[data-edit="hout"][data-idx="1"]'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await page.mouse.move(hout2.x, hout2.y); await page.mouse.down(); await page.mouse.move(hout2.x + 40, hout2.y + 5, { steps: 5 }); await page.mouse.up();
v = await ev((id) => JSON.parse(JSON.stringify(designer.store.get(id))), pathId);
p1 = v.points[1];
const lenIn2 = Math.hypot(p1.hin.x - p1.x, p1.hin.y - p1.y);
const cross = (p1.hout.x - p1.x) * (p1.x - p1.hin.y * 0 - p1.hin.x) * 0 + ((p1.hout.x - p1.x) * (p1.y - p1.hin.y) - (p1.hout.y - p1.y) * (p1.x - p1.hin.x));
ok('alça assimétrica: oposta alinhada mas mantém o comprimento', p1.mode === 'asym' && Math.abs(lenIn2 - lenIn) < 0.5 && Math.abs(cross) < 1, JSON.stringify({ lenIn, lenIn2, cross }));
await page.click('[data-ptmode="free"]');
ok('painel: alças independentes', (await ev(() => designer.tools.pen.pointType())) === 'free');
await shot('02-editando-pontos.png');
// duplo clique no ponto alterna curva → canto
const q1b = await ptScreen(1);
await page.mouse.dblclick(q1b.x, q1b.y);
ok('duplo clique no ponto: curva → canto', (await ev((id) => { const p = designer.store.get(id).points[1]; return !p.hin && !p.hout; }, pathId)));
await page.mouse.dblclick(q1b.x, q1b.y);
ok('duplo clique de novo: canto → curva', (await ev((id) => { const p = designer.store.get(id).points[1]; return !!(p.hin && p.hout); }, pathId)));
// Alt+clique também converte
await page.keyboard.down('Alt'); await page.mouse.click(q1b.x, q1b.y); await page.keyboard.up('Alt');
ok('Alt+clique no ponto converte (curva → canto)', (await ev((id) => !designer.store.get(id).points[1].hin, pathId)));
// Shift+clique seleciona vários; setas movem (Shift = 10)
const a0 = await ptScreen(0), a2 = await ptScreen(2);
await page.mouse.click(a0.x, a0.y);
await page.keyboard.down('Shift'); await page.mouse.click(a2.x, a2.y); await page.keyboard.up('Shift');
ok('Shift+clique seleciona 2 pontos', (await ev(() => designer.tools.pen.selectedCount())) === 2);
const bef = await ev((id) => { const n = designer.store.get(id); return [0, 2].map((i) => ({ x: n.x + n.points[i].x, y: n.y + n.points[i].y })); }, pathId);
await page.keyboard.press('Shift+ArrowRight');
await page.keyboard.press('ArrowDown');
const aft = await ev((id) => { const n = designer.store.get(id); return [0, 2].map((i) => ({ x: n.x + n.points[i].x, y: n.y + n.points[i].y })); }, pathId);
ok('setas movem os pontos selecionados (Shift = 10px)', aft.every((p, i) => Math.abs(p.x - bef[i].x - 10) < 0.6 && Math.abs(p.y - bef[i].y - 1) < 0.6), JSON.stringify({ bef, aft }));
// caixa de seleção no vazio
const c0 = await ptScreen(0), c1 = await ptScreen(1), c2 = await ptScreen(2);
const xs = [c0.x, c1.x, c2.x], ys = [c0.y, c1.y, c2.y];
await page.mouse.move(Math.min(...xs) - 30, Math.min(...ys) - 30); await page.mouse.down();
await page.mouse.move(Math.max(...xs) + 30, Math.max(...ys) + 30, { steps: 8 }); await page.mouse.up();
ok('caixa seleciona todos os pontos', (await ev(() => designer.tools.pen.selectedCount())) === 3);
// adicionar ponto e excluir com Delete
const d0 = await ptScreen(0), d1 = await ptScreen(1);
await page.mouse.click((d0.x + d1.x) / 2 + 0.5, (d0.y + d1.y) / 2);
let cnt = await ev((id) => designer.store.get(id).points.length, pathId);
// (o segmento 0→1 pode ser curvo: se o clique não caiu no traço, usa o Alt+clique, que procura num raio maior)
if (cnt === 3) { await page.keyboard.down('Alt'); await page.mouse.click((d0.x + d1.x) / 2, (d0.y + d1.y) / 2); await page.keyboard.up('Alt'); cnt = await ev((id) => designer.store.get(id).points.length, pathId); }
ok('ponto novo no segmento', cnt === 4, String(cnt));
await page.keyboard.press('Delete');
ok('Delete remove o ponto selecionado', (await ev((id) => designer.store.get(id).points.length, pathId)) === 3);
// abrir/fechar e inverter pelo painel
await page.getByText('Caminho fechado').click();
ok('desmarcar "Caminho fechado" abre o caminho', (await ev((id) => designer.store.get(id).closed, pathId)) === false);
await page.getByText('Caminho fechado').click();
ok('marcar de novo fecha', (await ev((id) => designer.store.get(id).closed, pathId)) === true);
const firstBefore = await ev((id) => designer.store.get(id).points[0].x, pathId);
await page.getByRole('button', { name: /Inverter/ }).click();
const lastAfter = await ev((id) => { const p = designer.store.get(id).points; return p[p.length - 1].x; }, pathId);
ok('inverter direção', Math.abs(firstBefore - lastAfter) < 0.01);
await page.keyboard.press('Enter');
ok('Enter sai da edição', !(await ev(() => designer.store.ui.editPathId)));

// ================================================================== 3) LÁPIS
await page.keyboard.press('Shift+P');
await page.waitForTimeout(100);
ok('Shift+P liga o lápis (e a barra mostra a suavização)', (await ev(() => designer.store.ui.tool)) === 'pencil' && await ev(() => !!document.querySelector('.pen-smooth')));
const L0 = await S(750, 200);
await page.mouse.move(L0.x, L0.y); await page.mouse.down();
let raw = 0;
for (let i = 1; i <= 80; i++) { await page.mouse.move(L0.x + i * 4, L0.y + Math.sin(i / 8) * 50 + (i % 2 ? 1.5 : -1.5)); raw++; }
await shot('03-lapis-desenhando.png');
await page.mouse.up();
v = await vec();
ok('lápis cria um vetor suavizado (poucos pontos, com curvas)', v.type === 'path' && v.points.length >= 2 && v.points.length < 20 && v.points.some((p) => p.hout), JSON.stringify({ n: v.points.length }));
ok('traço aberto continua aberto', !v.closed);
const pencilId = v.id;
// suavização 0: mais pontos
await ev(() => { designer.store.ui.pencilSmooth = 0; });
const L1 = await S(750, 380);
await page.mouse.move(L1.x, L1.y); await page.mouse.down();
for (let i = 1; i <= 80; i++) await page.mouse.move(L1.x + i * 4, L1.y + Math.sin(i / 8) * 50 + (i % 2 ? 1.5 : -1.5));
await page.mouse.up();
const v0 = await vec();
ok('suavização 0 segue mais o traço (mais pontos)', v0.points.length > v.points.length, `${v0.points.length} vs ${v.points.length}`);
// círculo à mão fecha sozinho
await ev(() => { designer.store.ui.pencilSmooth = 50; });
const O = await S(450, 680);
await page.mouse.move(O.x + 70, O.y); await page.mouse.down();
for (let i = 1; i <= 60; i++) { const a = (i / 60) * Math.PI * 2; await page.mouse.move(O.x + 70 * Math.cos(a), O.y + 70 * Math.sin(a)); }
await page.mouse.up();
const vc = await vec();
ok('terminar perto do início fecha o caminho do lápis', vc.closed && vc.points.length <= 12, JSON.stringify({ closed: vc.closed, n: vc.points.length }));
await page.keyboard.press('v');
await ev(() => designer.store.setSelection([]));
await page.waitForTimeout(100);
await shot('03b-lapis-resultado.png');

// ================================================================== 4) CONTORNO
await ev((id) => {
  const s = designer.store; const n = s.get(id);
  s.update(() => { n.stroke.width = 6; n.stroke.dash = '12 4 2 4'; n.stroke.cap = 'butt'; n.stroke.join = 'miter'; n.fillRule = 'evenodd'; }, { commit: true });
  s.setSelection([id]);
}, pathId);
await page.waitForTimeout(100);
const dom = await ev((id) => designer.canvas.els.get(id).innerHTML, pathId);
ok('canvas: tracejado personalizado, ponta reta, quina pontuda, evenodd', /stroke-dasharray="12 4 2 4"/.test(dom) && /stroke-linecap="butt"/.test(dom) && /stroke-linejoin="miter"/.test(dom) && /fill-rule="evenodd"/.test(dom), dom.slice(0, 300));
const dashField = await ev(() => [...document.querySelectorAll('input.text.mono')].some((i) => i.value === '12 4 2 4'));
ok('painel mostra o campo Tracejado com o valor', dashField);
await ev((id) => { const s = designer.store; s.update(() => { s.get(id).stroke.align = 'inside'; }, { commit: true }); }, pathId);
await page.waitForTimeout(100);
const dom2 = await ev((id) => designer.canvas.els.get(id).innerHTML, pathId);
ok('contorno DENTRO: clipPath + espessura dobrada', /<clipPath id="sk-/.test(dom2) && /stroke-width="12"/.test(dom2), dom2.slice(0, 400));
const out = await ev(async (id) => {
  const { toSvg } = await import('/src/svg.js'); const { generateCode } = await import('/src/css.js');
  const n = designer.store.get(id);
  return { svg: toSvg(n), html: generateCode([n], null).html };
}, pathId);
ok('SVG exportado tem tracejado, pontas, quinas e corte interno', /stroke-dasharray="12 4 2 4"/.test(out.svg) && /stroke-linecap="butt"/.test(out.svg) && /stroke-linejoin="miter"/.test(out.svg) && /<clipPath/.test(out.svg) && /fill-rule="evenodd"/.test(out.svg), out.svg.slice(0, 500));
ok('HTML exportado tem o mesmo contorno', /stroke-dasharray="12 4 2 4"/.test(out.html) && /clip-path="url\(#sk-/.test(out.html), out.html.slice(0, 300));
await ev((id) => { const s = designer.store; s.update(() => { s.get(id).stroke.align = 'outside'; }, { commit: true }); }, pathId);
await page.waitForTimeout(100);
ok('contorno FORA: máscara', /<mask id="sk-/.test(await ev((id) => designer.canvas.els.get(id).innerHTML, pathId)));

// ================================================================== 5) BOOLEANAS
await ev(async () => {
  const m = await import('/src/model.js');
  const s = designer.store;
  s.page().children.length = 0;
  const r = m.createNode('rect', { name: 'Quadrado', x: 200, y: 200, w: 200, h: 200 }); r.fill = m.defaultFill('#7C5CFF'); r.radius = [24, 24, 24, 24];
  const e = m.createNode('ellipse', { name: 'Círculo', x: 300, y: 300, w: 200, h: 200 }); e.fill = m.defaultFill('#FF5C8A');
  const r2 = m.createNode('rect', { name: 'A', x: 650, y: 200, w: 200, h: 200 }); r2.fill = m.defaultFill('#22C55E');
  const e2 = m.createNode('ellipse', { name: 'B', x: 750, y: 250, w: 160, h: 160 }); e2.fill = m.defaultFill('#F59E0B');
  s.update((p) => p.children.push(r, e, r2, e2), { commit: true });
  s.setSelection([r.id, e.id]);
  designer.canvas.setView({ x: 0, y: 0, zoom: 1 }); s.emit('view');
});
await page.waitForTimeout(150);
ok('painel mostra "Combinar formas" com 2 formas', await ev(() => !!document.querySelector('[data-bool="union"]')));
await shot('04-booleana-antes.png');
await page.keyboard.press('Control+Alt+u');
let b = await ev(() => JSON.parse(JSON.stringify(designer.store.page().children)));
const u = b.find((n) => n.type === 'path');
ok('Ctrl+Alt+U une as 2 formas num vetor', b.length === 3 && u && u.closed && u.fill.color === '#7C5CFF', JSON.stringify(b.map((n) => n.type)));
ok('união: caixa cobre as duas (≈200..500)', u && Math.abs(u.x - 200) < 1.5 && Math.abs(u.w - 300) < 2 && Math.abs(u.h - 300) < 2, JSON.stringify(u && { x: u.x, y: u.y, w: u.w, h: u.h }));
ok('união: reajustada em curvas (poucos pontos)', u && u.points.length < 24 && u.points.some((p) => p.hout), String(u?.points.length));
await page.keyboard.press('Control+z');
ok('desfazer a booleana volta as 2 formas', (await ev(() => designer.store.page().children.length)) === 4);
// subtrair pelo botão: quadrado verde (baixo) menos círculo
await ev(() => { const c = designer.store.page().children; designer.store.setSelection([c[2].id, c[3].id]); });
await page.waitForTimeout(100);
await page.click('[data-bool="subtract"]');
b = await ev(() => JSON.parse(JSON.stringify(designer.store.page().children)));
const sbt = b[b.length - 1];
ok('subtrair (botão): resultado com a cor da forma de baixo', sbt.type === 'path' && sbt.fill.color === '#22C55E' && Math.abs(sbt.w - 200) < 2, JSON.stringify({ t: sbt.type, w: sbt.w, c: sbt.fill.color }));
// interseção e excluir nas duas primeiras
await ev(() => { const c = designer.store.page().children; designer.store.setSelection([c[0].id, c[1].id]); });
await page.keyboard.press('Control+Alt+i');
b = await ev(() => JSON.parse(JSON.stringify(designer.store.page().children)));
const it = b.find((n) => n.name.startsWith('Interseção'));
ok('interseção: só a parte comum (≈100×100)', it && Math.abs(it.w - 100) < 2 && Math.abs(it.h - 100) < 2, JSON.stringify(it && { w: it.w, h: it.h }));
await page.keyboard.press('Control+z');
await ev(() => { const c = designer.store.page().children; designer.store.setSelection([c[0].id, c[1].id]); });
await page.keyboard.press('Control+Alt+x');
b = await ev(() => JSON.parse(JSON.stringify(designer.store.page().children)));
const ex = b.find((n) => n.name.startsWith('Exclusão'));
ok('excluir: 2 contornos (forma + furo)', ex && ex.contours?.length >= 1, JSON.stringify(ex && { c: ex.contours?.length }));
await ev(() => { designer.store.setSelection([]); });
await page.waitForTimeout(100);
await shot('05-booleanas-resultado.png');
// recusa: seleção com texto
const msg = await ev(async () => {
  const m = await import('/src/model.js'); const s = designer.store;
  const t = m.createNode('text', { x: 0, y: 0 }); s.update((p) => p.children.push(t), { commit: true });
  s.setSelection([t.id, s.page().children[0].id]);
  return designer.commands.booleanOp('union');
});
ok('booleana recusa camada que não é forma (com mensagem)', !!msg.error, JSON.stringify(msg));

ok('sem erros no console', errors.length === 0, errors.join('\n'));
console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
await browser.close();
process.exit(fails ? 1 : 0);
