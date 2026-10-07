import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto(new URL('?editor', process.env.APP_URL || 'http://localhost:5173/').href); await page.waitForTimeout(600);
let fails = 0; const ok = (n, c, x='') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + x)); };
const ev = (f, a) => page.evaluate(f, a);
// monta 2 boards com botão na primeira apontando para a segunda
const ids = await ev(async () => {
  const m = await import('/src/model.js'); const s = designer.store;
  s.newDoc();
  const a = m.createNode('frame', { name: 'Home', x: 0, y: 0, w: 300, h: 200 });
  const b = m.createNode('frame', { name: 'Detalhe', x: 400, y: 0, w: 300, h: 200 });
  b.fill = m.defaultFill('#223388');
  const btn = m.createNode('rect', { name: 'Botão', x: 50, y: 50, w: 100, h: 40 }); btn.fill = m.defaultFill('#FF0066');
  const back = m.createNode('rect', { name: 'Voltar', x: 10, y: 10, w: 60, h: 30 });
  a.children.push(btn); b.children.push(back);
  s.update((p) => p.children.push(a, b), { commit: true });
  s.setSelection([btn.id]);
  return { a: a.id, b: b.id, btn: btn.id, back: back.id };
});
await page.click('.tab:has-text("Protótipo")');
await page.click('button[title="Adicionar interação"]');
await page.waitForTimeout(150);
const selects = page.locator('.proto-panel select');
ok('painel mostra selects da interação', (await selects.count()) >= 4, String(await selects.count()));
await selects.nth(2).selectOption(ids.b);
const it = await ev((id) => designer.store.get(id).interactions[0], ids.btn);
ok('interação aponta para o frame destino', it.target === ids.b && it.action === 'navigate', JSON.stringify(it));
ok('seta do protótipo desenhada', (await page.locator('.pen-layer .proto-path').count()) === 1);
await ev((id) => designer.store.update(() => { designer.store.get(id).interactions = [{ trigger: 'click', action: 'back' }]; }, { commit: true }), ids.back);
await page.screenshot({ path: join(tmpdir(), 'proto-edit.png') });

// apresentar
await page.click('button:has-text("Apresentar")');
await page.waitForTimeout(300);
ok('modo apresentar abre na Home', (await page.locator('.present-title').innerText()) === 'Home');
// clica no botão (posição na tela)
const box = await page.locator('.present-board [data-id="' + ids.btn + '"]').boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(700);
ok('clicar navega para Detalhe', (await page.locator('.present-title').innerText()) === 'Detalhe');
ok('só um board no stage depois da transição', (await page.locator('.present-board').count()) === 1);
await page.screenshot({ path: join(tmpdir(), 'proto-present.png') });
const box2 = await page.locator('.present-board [data-id="' + ids.back + '"]').boundingBox();
await page.mouse.click(box2.x + 5, box2.y + 5);
await page.waitForTimeout(700);
ok('Voltar retorna à Home', (await page.locator('.present-title').innerText()) === 'Home');
await page.keyboard.press('Escape');
ok('Esc fecha o modo apresentar', (await page.locator('.present').count()) === 0);
console.log(errors.join('\n') || 'no console errors');
console.log(fails ? `${fails} FAILURES` : 'ALL PASS');
await browser.close();
process.exitCode = fails || errors.length ? 1 : 0;
