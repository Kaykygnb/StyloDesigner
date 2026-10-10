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
await page.click('button[aria-label="Adicionar interação"]');
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
const presentButton = page.getByRole('button', { name: /Apresentar protótipo/ });
await presentButton.click();
await page.waitForTimeout(300);
ok('modo apresentar abre na Home', (await page.locator('.present-title').innerText()) === 'Home');
ok('apresentação anuncia modal e isola o editor', await page.locator('.present[aria-modal="true"]').count() === 1 && await ev(() => document.querySelector('#app')?.inert));
await page.locator('.present-widths [data-w="1280"]').click();
const fixedBoard = await page.frameLocator('.present-frame').locator('body > *').evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, width: r.width, viewport: document.documentElement.clientWidth };
});
ok('tela fixa fica centralizada quando a janela de apresentação é mais larga', Math.abs(fixedBoard.left - (fixedBoard.viewport - fixedBoard.width) / 2) < 1, JSON.stringify(fixedBoard));
ok('telas aparecem como abas acessíveis', await page.locator('.present-tabs [role="tab"]').count() === 2);
await page.locator('[data-act="close"]').focus();
await page.keyboard.press('Shift+Tab');
ok('foco modal volta ao conteúdo apresentado', await ev(() => document.activeElement.tagName === 'IFRAME'));
await page.keyboard.press('Tab');
ok('Tab em tela sem controles navega sem sair do modo Apresentar',
  (await page.locator('.present-title').innerText()) === 'Detalhe' && await page.locator('.present').evaluate((root) => root.contains(document.activeElement)));
await page.locator('.present-tabs [role="tab"]').first().focus();
await page.keyboard.press('ArrowRight');
ok('setas do teclado navegam pelas telas', (await page.locator('.present-title').innerText()) === 'Detalhe');
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(350);
await page.locator('.present-tabs [role="tab"]').nth(1).click();
ok('clicar na aba abre a tela', (await page.locator('.present-title').innerText()) === 'Detalhe');
await page.locator('.present-tabs [role="tab"]').nth(0).click();
await page.locator('.present-tabs [role="tab"]').nth(1).click();
await page.waitForTimeout(350);
ok('trocas rápidas de tela encerram transições sem erro', (await page.locator('.present-title').innerText()) === 'Detalhe' && errors.length === 0, errors.join(' | '));
await page.waitForTimeout(350);
await page.locator('.present-tabs [role="tab"]').nth(1).dragTo(page.locator('.present-tabs [role="tab"]').nth(0));
const orderedTabs = await page.locator('.present-tabs [role="tab"]').allTextContents();
ok('abas podem ser arrastadas para reordenar', orderedTabs[0] === 'Detalhe' && orderedTabs[1] === 'Home', orderedTabs.join(', '));
const documentOrder = await ev(() => designer.store.state.doc.pages[0].children.filter((n) => n.type === 'frame').map((n) => n.name));
ok('reordenar a apresentação preserva a ordem do documento', documentOrder[0] === 'Home' && documentOrder[1] === 'Detalhe', documentOrder.join(', '));
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.locator('.present-tabs [role="tab"]').nth(1).click();
ok('movimento reduzido dispensa animação de navegação', (await ev(() => matchMedia('(prefers-reduced-motion: reduce)').matches)) && await page.locator('.present-board').evaluate((el) => el.getAnimations().length === 0));
await page.waitForTimeout(150);
await page.emulateMedia({ reducedMotion: 'no-preference' });
await page.setViewportSize({ width: 390, height: 844 });
const mobile = await ev(() => {
  const bar = document.querySelector('.present-bar');
  return { width: document.documentElement.scrollWidth, viewport: innerWidth, tabs: document.querySelector('.present-tabs').getBoundingClientRect().width,
    bar: { x: bar.getBoundingClientRect().x, width: bar.getBoundingClientRect().width, scroll: bar.scrollWidth },
    children: [...bar.children].map((el) => [el.className, Math.round(el.getBoundingClientRect().x), Math.round(el.getBoundingClientRect().width)]) };
});
ok('apresentação mantém as abas utilizáveis no celular', mobile.bar.scroll <= mobile.bar.width && mobile.tabs > 0, JSON.stringify(mobile));
await page.screenshot({ path: join(tmpdir(), 'proto-present-mobile.png') });
await page.setViewportSize({ width: 1440, height: 860 });
// clica no botão (posição na tela)
await page.frameLocator('.present-frame').locator('[data-node-id="' + ids.btn + '"]').click();
await page.waitForTimeout(700);
ok('clicar navega para Detalhe', (await page.locator('.present-title').innerText()) === 'Detalhe');
ok('só um board no stage depois da transição', (await page.locator('.present-board').count()) === 1);
await page.screenshot({ path: join(tmpdir(), 'proto-present.png') });
await page.frameLocator('.present-frame').locator('[data-node-id="' + ids.back + '"]').click({ position: { x: 5, y: 5 } });
await page.waitForTimeout(700);
ok('Voltar retorna à Home', (await page.locator('.present-title').innerText()) === 'Home');
await ev(({ a, b }) => {
  const s = designer.store;
  s.update(() => { s.get(a).children = []; s.get(b).children = []; }, { commit: true });
}, ids);
await page.waitForTimeout(350);
await page.locator('.present-frame').focus();
await page.keyboard.press('Tab');
ok('Tab numa tela sem controles foca e abre a próxima aba de tela',
  (await page.locator('.present-title').innerText()) === 'Detalhe' && await page.locator('.present-tabs [role="tab"][aria-selected="true"]').innerText() === 'Detalhe');
await page.waitForTimeout(400); // a troca de tela anima por ~250 ms: sem esperar, o foco cai na tela antiga (corrida do teste)
await page.locator('.present-frame').focus();
await page.keyboard.press('Shift+Tab');
ok('Shift+Tab numa tela sem controles foca e abre a aba de tela anterior',
  (await page.locator('.present-title').innerText()) === 'Home' && await page.locator('.present-tabs [role="tab"][aria-selected="true"]').innerText() === 'Home');
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
ok('Esc fecha o modo apresentar e devolve o foco', (await page.locator('.present').count()) === 0 && await presentButton.evaluate((el) => document.activeElement === el) && !(await ev(() => document.querySelector('#app')?.inert)));
console.log(errors.join('\n') || 'no console errors');
console.log(fails ? `${fails} FAILURES` : 'ALL PASS');
await browser.close();
process.exitCode = fails || errors.length ? 1 : 0;
