// Issue #10: no canvas, o @media de largura do CSS da página responde à largura da TELA desenhada (container query),
// não à janela do editor. Janela em 1440 px; telas de 400 e 800 px; regra para até 500 px.
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let failures = 0;
const ok = (name, value) => { if (!value) failures++; console.log(`${value ? 'PASS' : 'FAIL'} ${name}`); };

try {
  await page.goto(new URL('?editor', process.env.APP_URL || 'http://localhost:5173/').href);
  await page.waitForFunction(() => window.designer?.store);
  const ids = await page.evaluate(async () => {
    const m = await import('/src/model.js');
    const store = designer.store;
    store.newDoc();
    const mk = (name, x, w) => {
      const label = m.createNode('text', { name: 'Card', text: 'Olá' });
      label.fill = m.defaultFill('#0000ff');
      const board = m.createNode('frame', { name, x, y: 0, w, h: 200, children: [label] });
      return { board, label };
    };
    const a = mk('Estreita', 0, 400);
    const b = mk('Larga', 600, 800);
    const hug = mk('Hug', 1500, 300);
    hug.board.sizeX = 'hug';
    store.update((pg) => pg.children.push(a.board, b.board, hug.board), { commit: true });
    window.__hugBefore = await new Promise((r) => setTimeout(() => r(document.querySelector(`.world [data-id="${hug.board.id}"]`).getBoundingClientRect().width), 300));
    store.update(() => { store.state.doc.styles.pageCss = '@media (max-width: 500px) {\n  .card { color: rgb(255, 0, 0); }\n}'; }, { commit: true });
    return { a: a.label.id, b: b.label.id, hugLabel: hug.label.id, hugBoard: hug.board.id };
  });
  await page.waitForTimeout(400);
  const color = (id) => page.evaluate((nid) => getComputedStyle(document.querySelector(`.world [data-id="${nid}"]`)).color, id);
  ok('tela de 400 px recebe a regra de até 500 px (mesmo com a janela em 1440)', (await color(ids.a)) === 'rgb(255, 0, 0)');
  ok('tela de 800 px NÃO recebe a regra', (await color(ids.b)) !== 'rgb(255, 0, 0)');
  ok('tela "hug" mantém a mesma largura depois da regra (não vira contêiner nem colapsa)', await page.evaluate((id) => Math.abs(document.querySelector(`.world [data-id="${id}"]`).getBoundingClientRect().width - window.__hugBefore) < 0.5, ids.hugBoard));
  ok('a tela estreita é contêiner e a hug não', await page.evaluate((o) => getComputedStyle(document.querySelector(`.world [data-id="${o.a}"]`).parentElement).containerType === 'inline-size' && getComputedStyle(document.querySelector(`.world [data-id="${o.h}"]`)).containerType !== 'inline-size', { a: ids.a, h: ids.hugBoard }));
  ok('sem erros no navegador', errors.length === 0);
} finally {
  await browser.close();
}
process.exitCode = failures ? 1 : 0;
