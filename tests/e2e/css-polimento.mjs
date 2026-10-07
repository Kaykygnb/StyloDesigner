// Pedidos do teste real (2ª rodada): snap ao REDIMENSIONAR (encostar exatamente na borda do frame), contorno por
// lado (border-top/right/bottom/left) e CSS Grid / auto layout fiéis ao CSS.
import { chromium } from 'playwright';

let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + x)); };
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('dialog', (d) => { errors.push('diálogo nativo: ' + d.message()); d.dismiss(); });
const ev = (f, a) => p.evaluate(f, a);
await p.goto(new URL('?editor', process.env.APP_URL || 'http://localhost:5173/').href);
await p.waitForTimeout(800);

/** Cria um frame 400×300 com um retângulo 100×100 em (20,20) e deixa o retângulo selecionado, com zoom 100%. */
const setup = () => ev(async () => {
  const { createNode } = await import('/src/model.js');
  const s = designer.store;
  s.newDoc();
  const f = createNode('frame', { name: 'Doc', x: 0, y: 0, w: 400, h: 300 });
  const r = createNode('rect', { name: 'Caixa', x: 20, y: 20, w: 100, h: 100 });
  f.children.push(r);
  s.update((pg) => pg.children.push(f), { commit: true });
  s.setSelection([r.id]);
  designer.canvas.fit([f.id], { padding: 200, maxZoom: 1 });
  return r.id;
});
/** Posição na tela de um ponto do mundo. */
const screen = (x, y) => ev(([x, y]) => { const s = designer.canvas.toScreen(x, y), r = designer.canvas.vpRect(); return { x: r.left + s.x, y: r.top + s.y }; }, [x, y]);
/** Arrasta da posição (mundo) a até b (mundo) com o mouse, opcionalmente segurando uma tecla. */
const dragWorld = async (a, bb, key) => {
  const s1 = await screen(a.x, a.y), s2 = await screen(bb.x, bb.y);
  if (key) await p.keyboard.down(key);
  await p.mouse.move(s1.x, s1.y); await p.mouse.down();
  await p.mouse.move(s2.x, s2.y, { steps: 10 });
  const guides = await ev(() => (designer.store.ui.guides || []).length);
  await p.mouse.up();
  if (key) await p.keyboard.up(key);
  await p.waitForTimeout(150);
  return guides;
};

try {
  // ---------------------------------------------------------------- 1. snap ao redimensionar
  let id = await setup();
  await p.waitForTimeout(200);
  // alça direita do retângulo fica em (120, 70); puxa até x = 396 (4 px antes da borda do frame, em 400)
  let g = await dragWorld({ x: 120, y: 70 }, { x: 396, y: 70 });
  let n = await ev((id) => designer.store.get(id), id);
  ok('redimensionar perto da borda do frame GRUDA nela (largura até a borda: 380)', n.w === 380 && n.x === 20, `${n.x} ${n.w}`);
  ok('e mostra a linha rosa enquanto gruda', g > 0, String(g));
  // alça de baixo (70, 120) até y = 297 → gruda em 300
  await dragWorld({ x: 210, y: 120 }, { x: 210, y: 297 }); // alça de baixo: centro da largura nova (20 + 380/2)
  n = await ev((id) => designer.store.get(id), id);
  ok('borda de baixo gruda no fundo do frame (altura 280)', n.h === 280, String(n.h));
  // com Ctrl: não gruda
  id = await setup();
  await p.waitForTimeout(200);
  await dragWorld({ x: 120, y: 70 }, { x: 396, y: 70 }, 'Control');
  n = await ev((id) => designer.store.get(id), id);
  ok('com Ctrl não gruda (vai até onde o mouse foi: 376)', n.w === 376, String(n.w));
  // longe de tudo: não gruda
  id = await setup();
  await p.waitForTimeout(200);
  await dragWorld({ x: 120, y: 70 }, { x: 250, y: 70 });
  n = await ev((id) => designer.store.get(id), id);
  ok('longe das bordas não gruda (230)', n.w === 230, String(n.w));

  // ---------------------------------------------------------------- 2. contorno por lado
  id = await setup();
  await p.waitForTimeout(200);
  const strokeSec = p.locator('#right .panel-section', { has: p.locator('.section-head', { hasText: 'Contorno' }) });
  await strokeSec.locator('.section-head .icon-btn').click(); // + adicionar contorno
  await p.waitForTimeout(150);
  const lados = strokeSec.locator('select').filter({ has: p.locator('option[value="bottom"]') });
  ok('seção Contorno tem a escolha de lados', (await lados.count()) === 1);
  await lados.selectOption('bottom');
  await p.waitForTimeout(150);
  let css = await ev((id) => { const el = designer.canvas.els.get(id); return { b: el.style.borderBottom, t: el.style.borderTop, o: el.style.outline }; }, id);
  ok('"Só embaixo" desenha só border-bottom (sem outline)', /1px solid/.test(css.b) && !css.t && !css.o, JSON.stringify(css));
  await p.click('#right .tab:has-text("Código")');
  await p.waitForTimeout(200);
  const code = await p.locator('#right').innerText();
  ok('painel Código mostra border-bottom de verdade', /border-bottom: 1px solid/.test(code) && !/outline/.test(code));
  await p.click('#right .tab:has-text("Design")');
  await p.waitForTimeout(150);
  await lados.selectOption('custom');
  await p.waitForTimeout(150);
  ok('"Personalizado" mostra a espessura de cada lado (mesmo com espessuras iguais)', (await strokeSec.locator('[title="border-left (px)"]').count()) > 0 || (await strokeSec.locator('.num-label', { hasText: '←' }).count()) === 1);
  await ev((id) => { const s = designer.store; s.update(() => { s.get(id).stroke.sides = [0, 0, 4, 2]; }, { commit: true }); }, id);
  css = await ev((id) => { const el = designer.canvas.els.get(id); return { b: el.style.borderBottom, l: el.style.borderLeft, t: el.style.borderTop }; }, id);
  ok('espessuras diferentes por lado (baixo 4, esquerda 2)', /^4px solid/.test(css.b) && /^2px solid/.test(css.l) && !css.t, JSON.stringify(css));
  const svg = await ev(async (id) => { const { toSvg } = await import('/src/svg.js'); return toSvg(designer.store.get(id)); }, id);
  ok('SVG exportado desenha as linhas dos lados', (svg.match(/<line /g) || []).length === 2 && /stroke-width="4"/.test(svg));
  await lados.selectOption('all');
  await p.waitForTimeout(150);
  css = await ev((id) => { const el = designer.canvas.els.get(id); return { o: el.style.outline, b: el.style.borderBottom }; }, id);
  ok('"Todos" volta ao contorno inteiro (outline)', !!css.o && !css.b, JSON.stringify(css));

  // ---------------------------------------------------------------- 3. CSS Grid "faz força": o alinhamento do grid vale nos itens
  const gr = await ev(async () => {
    const { createNode } = await import('/src/model.js');
    const s = designer.store;
    s.newDoc();
    const f = createNode('frame', { name: 'Galeria', x: 0, y: 0, w: 520, h: 360 });
    for (let i = 0; i < 4; i++) f.children.push(createNode('rect', { name: 'Card ' + i, x: 20, y: 20, w: 100, h: 80 }));
    s.update((pg) => pg.children.push(f), { commit: true });
    s.update(() => designer.commands.setLayoutMode([f], 'row'));
    f.layout.justify = 'space-between';
    s.update(() => designer.commands.setLayoutMode([f], 'grid'));
    s.update(() => { f.layout.cols = 2; f.layout.padding = [0, 0, 0, 0]; f.layout.colGap = 0; f.layout.rowGap = 0; }, { commit: true });
    s.setSelection([f.id]);
    return { f: f.id, c: f.children[0].id, justify: f.layout.justify };
  });
  ok('flex → grid troca space-between (não existe no grid) por start', gr.justify === 'flex-start', gr.justify);
  const cardX = () => ev((id) => { const el = designer.canvas.els.get(id); return el.offsetLeft; }, gr.c);
  ok('item no grid começa no início da célula', (await cardX()) === 0, String(await cardX()));
  await p.locator('#right select[title^="justify-items"]').selectOption('center');
  await p.waitForTimeout(150);
  // célula de 260px, card de 100px → centralizado em x = 80
  ok('justify-items: center centraliza os itens nas células', (await cardX()) === 80, String(await cardX()));
  const self = await ev((id) => getComputedStyle(designer.canvas.els.get(id)).justifySelf, gr.c);
  ok('item não escreve justify-self próprio (herda do grid)', self === 'auto', self);
  await p.click('#right button:has-text("Itens preenchem as células")');
  await p.waitForTimeout(150);
  const w = await ev((id) => designer.canvas.els.get(id).offsetWidth, gr.c);
  ok('"Itens preenchem as células" estica os cards (stretch)', w === 260, String(w));
  // item: justify-self: end sobrescreve o do pai e tira o "Preencher"
  await ev((id) => designer.store.setSelection([id]), gr.c);
  await p.waitForTimeout(150);
  await p.locator('#right select[title^="justify-self"]').selectOption('flex-end');
  await p.waitForTimeout(150);
  const it = await ev((id) => { const n = designer.store.get(id), el = designer.canvas.els.get(id); return { sx: n.sizeX, x: el.offsetLeft, w: el.offsetWidth }; }, gr.c);
  ok('justify-self: end do item vence o justify-items do grid', it.sx === 'fixed' && it.x + it.w === 260, JSON.stringify(it));
  const itemCss = await ev((id) => designer.commands.cssOf([designer.store.get(id)]), gr.c);
  ok('CSS do item tem justify-self: end', /justify-self: end/.test(itemCss), itemCss);
} catch (err) {
  ok('cenário terminou sem exceção', false, err.stack);
}
await b.close();
console.log(errors.join('\n') || 'sem erros no console');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exitCode = fails || errors.length ? 1 : 0;
