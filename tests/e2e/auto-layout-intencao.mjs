// Shift+A "entendendo a intenção" e formas que não nascem invisíveis. Cenário real relatado por um usuário:
// desenhou um retângulo grande (uma sidebar) e um pequeno em cima; ao ligar o auto layout, o pequeno "pulava" para
// o lado (o fundo virava mais um item do layout) e o item novo, cinza sobre cinza, nem aparecia.
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
const vp = await p.locator('#viewport').boundingBox();
/** Desenha com a ferramenta `key` arrastando de (x1,y1) até (x2,y2) — coordenadas da tela, relativas ao canvas. */
const draw = async (key, x1, y1, x2, y2) => {
  await p.keyboard.press(key);
  await p.mouse.move(vp.x + x1, vp.y + y1); await p.mouse.down();
  await p.mouse.move(vp.x + x2, vp.y + y2, { steps: 6 }); await p.mouse.up();
  await p.waitForTimeout(150);
};
const root = () => ev(() => designer.store.page().children.map((n) => ({ type: n.type, name: n.name, w: n.w, h: n.h, fill: n.fill, layout: n.layout && { ...n.layout }, sizeX: n.sizeX, kids: (n.children || []).map((c) => ({ type: c.type, x: c.x, y: c.y, w: c.w, fill: c.fill.color })) })));
/** Sidebar: retângulo grande + item em cima, os dois soltos na página (o que o usuário fez). */
const sidebar = async () => {
  await ev(() => designer.store.newDoc());
  await p.waitForTimeout(150);
  await draw('r', 200, 100, 440, 700);
  await draw('r', 230, 130, 410, 180);
};

try {
  // ---------------------------------------------------------------- 1. formas não nascem invisíveis
  await sidebar();
  const fills = await ev(() => designer.store.page().children.map((n) => n.fill.color));
  ok('item desenhado em cima de um retângulo cinza nasce num tom que contrasta', fills[0] === '#D9D9D9' && fills[1] !== '#D9D9D9', fills.join());

  // ---------------------------------------------------------------- 2. o caso relatado: fundo + item → Shift+A
  await p.keyboard.press('Control+a');
  await p.keyboard.press('Shift+A');
  await p.waitForTimeout(300);
  let r = await root();
  ok('o retângulo de baixo VIRA o frame (não um item ao lado)', r.length === 1 && r[0].type === 'frame' && r[0].w === 240 && r[0].h === 600 && r[0].kids.length === 1, JSON.stringify(r));
  ok('o frame mantém a cor do retângulo (é o fundo da sidebar)', r[0].fill.type === 'solid' && r[0].fill.color === '#D9D9D9');
  ok('sidebar alta vira COLUNA, com o item no mesmo lugar (padding 30, centralizado)', r[0].layout.mode === 'column' && r[0].layout.padding.join() === '30,30,30,30' && r[0].layout.align === 'center', JSON.stringify(r[0].layout));
  ok('o item não "pula": continua em (30, 30) dentro da sidebar', await ev(() => {
    const f = designer.store.page().children[0];
    const fe = designer.canvas.els.get(f.id).getBoundingClientRect(), ce = designer.canvas.els.get(f.children[0].id).getBoundingClientRect();
    const z = designer.canvas.getView().zoom;
    return Math.abs((ce.left - fe.left) / z - 30) < 1 && Math.abs((ce.top - fe.top) / z - 30) < 1;
  }));
  ok('o aviso explica o que aconteceu', /virou o fundo do frame/.test(await p.locator('.toast').innerText()));
  // desenhar mais um item dentro da sidebar: entra na coluna, embaixo do primeiro, e aparece
  await draw('r', 230, 260, 410, 300);
  r = await root();
  ok('item novo desenhado na sidebar entra no auto layout dela', r[0].kids.length === 2, JSON.stringify(r[0].kids));
  ok('e também nasce visível (contrasta com o fundo cinza)', r[0].kids[1].fill !== '#D9D9D9', r[0].kids[1].fill);
  ok('frame que ainda tem espaço sobrando não ganhou padding gigante embaixo', r[0].layout.padding[2] === 30, String(r[0].layout.padding));

  // ---------------------------------------------------------------- 3. grupo → o grupo vira o frame
  await sidebar();
  await p.keyboard.press('Control+a');
  await p.keyboard.press('Control+g');
  await p.keyboard.press('Shift+A');
  await p.waitForTimeout(300);
  r = await root();
  ok('grupo + Shift+A: sem grupo sobrando dentro; o fundo vira o frame', r.length === 1 && r[0].type === 'frame' && r[0].kids.length === 1 && r[0].kids[0].type === 'rect', JSON.stringify(r));

  // ---------------------------------------------------------------- 4. retângulo sozinho → vira frame (não é embrulhado)
  await ev(() => designer.store.newDoc());
  await draw('r', 200, 100, 440, 700);
  const id = await ev(() => designer.store.selected()[0].id);
  await p.keyboard.press('Shift+A');
  await p.waitForTimeout(300);
  r = await root();
  ok('retângulo sozinho + Shift+A vira um frame vazio com auto layout', r.length === 1 && r[0].type === 'frame' && r[0].kids.length === 0 && r[0].layout.mode === 'column', JSON.stringify(r));
  ok('mantém o mesmo id (protótipo e seleção continuam valendo)', (await ev(() => designer.store.selected()[0].id)) === id);
  await p.keyboard.press('Control+z');
  ok('Ctrl+Z volta a ser retângulo', (await ev(() => designer.store.page().children[0].type)) === 'rect');

  // ---------------------------------------------------------------- 5. camadas soltas, sem fundo → frame que abraça
  await ev(() => designer.store.newDoc());
  await draw('r', 200, 100, 300, 140);
  await draw('r', 320, 100, 420, 140);
  await draw('r', 440, 100, 540, 160);
  await p.keyboard.press('Control+a');
  await p.keyboard.press('Shift+A');
  await p.waitForTimeout(300);
  r = await root();
  ok('3 botões soltos: viram uma LINHA com o vão que tinham (gap 20)', r[0].layout.mode === 'row' && r[0].layout.gap === 20 && r[0].kids.length === 3, JSON.stringify(r[0].layout));
  ok('e o frame abraça o conteúdo (hug), sem nada transbordando', r[0].sizeX === 'hug' && r[0].fill.type === 'none');

  // ---------------------------------------------------------------- 6. frame dentro de frame branco não some
  await ev(() => designer.store.newDoc());
  await draw('f', 200, 100, 600, 500);
  await draw('f', 240, 140, 400, 300);
  const inner = await ev(() => designer.store.page().children[0].children[0]?.fill.color);
  ok('frame desenhado dentro de frame branco nasce num cinza bem claro (visível)', inner && inner !== '#FFFFFF', String(inner));
} catch (err) {
  ok('cenário terminou sem exceção', false, err.stack);
}
await b.close();
console.log(errors.join('\n') || 'sem erros no console');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exitCode = fails || errors.length ? 1 : 0;
