// Comentários nas camadas: escrever pelo painel, ferramenta Comentar (C), pinos no canvas, selo nas camadas e na aba,
// responder, resolver, desfazer, apagar a camada (comentário vai e volta com o desfazer), nome do autor e recarregar.
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
const comentarios = () => ev(() => designer.store.state.doc.comments);

await ev(() => { designer.store.newDoc(); designer.canvas.setView({ x: 40, y: 40, zoom: 1 }); });
const ids = await ev(async () => {
  const m = await import('/src/model.js');
  const a = m.createNode('rect', { name: 'Botão', x: 100, y: 100, w: 200, h: 100 });
  const b = m.createNode('rect', { name: 'Foto', x: 400, y: 100, w: 150, h: 150 });
  designer.store.update((p) => p.children.push(a, b), { commit: true });
  return { a: a.id, b: b.id };
});
await page.waitForTimeout(300);

// ---------------------------------------------------------------- pelo painel
await page.click('#right .tab-cm');
await page.waitForTimeout(300);
ok('sem camada selecionada a caixa de comentário fica desligada', await page.locator('.cm-input').first().isDisabled());
await ev((id) => designer.store.setSelection([id]), ids.a);
await page.waitForTimeout(300);
const caixa = page.locator('.cm-composer .cm-input').first();
ok('com uma camada selecionada a caixa liga e cita a camada', !(await caixa.isDisabled()) && (await caixa.getAttribute('placeholder')).includes('Botão'));
await caixa.fill('Trocar a cor para o roxo da marca');
await caixa.press('Control+Enter');
await page.waitForTimeout(300);
let cs = await comentarios();
ok('Ctrl+Enter cria o comentário (autor padrão "Eu", aberto, canto superior direito)', cs.length === 1 && cs[0].text === 'Trocar a cor para o roxo da marca' && cs[0].author === 'Eu' && !cs[0].resolved && cs[0].rx === 1 && cs[0].ry === 0 && cs[0].nodeId === ids.a, JSON.stringify(cs));
ok('aparece o pino número 1 no canvas', (await page.locator('.comment-pin:not(.draft)').count()) === 1 && (await page.locator('.comment-pin').first().innerText()) === '1');
ok('selo "1 aberto" na aba', (await page.locator('.cm-badge').innerText()) === '1');
ok('o card aparece na lista', (await page.locator('.cm-thread').count()) === 1);
// pino fica no canto superior direito da camada
const geo = await ev((id) => { const b = designer.canvas.aabb(id); const s = designer.canvas.toScreen(b.x + b.w, b.y); const r = designer.canvas.vpRect(); return { x: r.left + s.x, y: r.top + s.y }; }, ids.a);
const pin = await page.locator('.comment-pin').first().boundingBox();
ok('o pino fica junto ao canto superior direito da camada', Math.abs(pin.x - geo.x) < 14 && Math.abs(pin.y + pin.height - geo.y) < 14, JSON.stringify([pin, geo]));
// selo na lista de camadas
await page.click('.tab:has-text("Camadas")').catch(() => {});
ok('a camada comentada ganha o selo na lista de camadas', (await page.locator('.layer-row .layer-cm').count()) === 1);

// ---------------------------------------------------------------- ferramenta Comentar (C), ponto exato
await page.click('#right .tab-cm');
await page.keyboard.press('Escape'); // tira o foco de qualquer campo
await ev(() => designer.store.setSelection([]));
await page.keyboard.press('c');
ok('tecla C liga a ferramenta Comentar', (await ev(() => designer.store.ui.tool)) === 'comment');
const alvo = await ev((id) => { const b = designer.canvas.aabb(id); const s = designer.canvas.toScreen(b.x + b.w * 0.25, b.y + b.h * 0.75); const r = designer.canvas.vpRect(); return { x: r.left + s.x, y: r.top + s.y }; }, ids.b);
await page.mouse.click(alvo.x, alvo.y);
await page.waitForTimeout(300);
const dr = await ev(() => designer.store.ui.commentDraft);
ok('clicar numa camada cria um rascunho no ponto clicado (25% / 75%)', dr && dr.nodeId === ids.b && Math.abs(dr.rx - 0.25) < 0.03 && Math.abs(dr.ry - 0.75) < 0.03, JSON.stringify(dr));
ok('a ferramenta volta para Mover e o rascunho aparece como pino tracejado', (await ev(() => designer.store.ui.tool)) === 'move' && (await page.locator('.comment-pin.draft').count()) === 1);
ok('a caixa de texto já está focada', await page.locator('.cm-composer .cm-input').first().evaluate((el) => el === document.activeElement));
await page.keyboard.type('Foto muito pesada, comprimir');
await page.keyboard.press('Control+Enter');
await page.waitForTimeout(300);
cs = await comentarios();
ok('o segundo comentário guarda o ponto (rx 0.25, ry 0.75) e o rascunho some', cs.length === 2 && Math.abs(cs[1].rx - 0.25) < 0.03 && Math.abs(cs[1].ry - 0.75) < 0.03 && (await ev(() => designer.store.ui.commentDraft)) === null, JSON.stringify(cs[1]));
ok('dois pinos (1 e 2) e selo "2"', (await page.locator('.comment-pin:not(.draft)').count()) === 2 && (await page.locator('.cm-badge').innerText()) === '2');

// ---------------------------------------------------------------- pino abre a conversa; responder; resolver
await ev(() => designer.store.setSelection([]));
await page.locator('.comment-pin', { hasText: '1' }).first().click();
await page.waitForTimeout(300);
ok('clicar no pino destaca o comentário no painel', (await page.locator('.cm-thread.active').count()) === 1 && (await page.locator('.cm-thread.active .cm-text').innerText()).includes('roxo'));
await page.locator('.cm-thread.active .cm-actions button', { hasText: 'Responder' }).click();
await page.locator('.cm-thread.active .cm-input').fill('Feito, ficou ótimo');
await page.locator('.cm-thread.active .cm-input').press('Control+Enter');
await page.waitForTimeout(300);
cs = await comentarios();
ok('a resposta fica no comentário', cs[0].replies.length === 1 && cs[0].replies[0].text === 'Feito, ficou ótimo', JSON.stringify(cs[0]));
await page.locator('.cm-thread.active .cm-actions button', { hasText: 'Resolver' }).click();
await page.waitForTimeout(300);
cs = await comentarios();
ok('Resolver marca como resolvido e some da lista de abertos', cs[0].resolved === true && (await page.locator('.cm-thread').count()) === 1);
ok('o selo da aba cai para 1', (await page.locator('.cm-badge').innerText()) === '1');
await ev(() => designer.store.ui.activeComment = null); await ev(() => designer.store.emit('overlay'));
await page.waitForTimeout(150);
ok('o pino do resolvido some do canvas (só o aberto fica)', (await page.locator('.comment-pin:not(.draft)').count()) === 1);
await page.locator('.cm-filter button', { hasText: 'Resolvidos' }).click();
await page.waitForTimeout(200);
ok('o filtro "Resolvidos" mostra o resolvido', (await page.locator('.cm-thread.resolved').count()) === 1);
await page.locator('.cm-thread.resolved .cm-actions button', { hasText: 'Reabrir' }).click();
await page.waitForTimeout(250);
cs = await comentarios();
ok('Reabrir volta a abrir', cs[0].resolved === false);

// ---------------------------------------------------------------- desfazer e apagar a camada
await ev(() => designer.store.undo());
await page.waitForTimeout(250);
cs = await comentarios();
ok('desfazer volta o último passo (reabrir → resolvido de novo)', cs[0].resolved === true);
await ev(() => designer.store.redo());
await ev((id) => { designer.store.setSelection([id]); designer.commands.deleteSelection(); }, ids.b);
await page.waitForTimeout(250);
cs = await comentarios();
ok('apagar a camada leva o comentário dela', cs.length === 1 && cs[0].nodeId === ids.a, JSON.stringify(cs.map((c) => c.nodeId)));
await ev(() => designer.store.undo());
await page.waitForTimeout(250);
cs = await comentarios();
ok('desfazer a exclusão traz o comentário de volta', cs.length === 2);

// ---------------------------------------------------------------- menu de contexto e nome do autor
await ev((id) => designer.store.setSelection([id]), ids.a);
await page.waitForTimeout(200);
const box = await ev((id) => { const b = designer.canvas.aabb(id); const s = designer.canvas.toScreen(b.x + b.w / 2, b.y + b.h / 2); const r = designer.canvas.vpRect(); return { x: r.left + s.x, y: r.top + s.y }; }, ids.a);
await page.mouse.click(box.x, box.y, { button: 'right' });
await page.waitForSelector('.menu');
ok('o menu de contexto tem "Comentar"', (await page.locator('.menu .menu-item', { hasText: 'Comentar' }).count()) === 1);
await page.locator('.menu .menu-item', { hasText: 'Comentar' }).click();
await page.waitForTimeout(300);
ok('"Comentar" no menu abre o painel com a caixa focada', (await page.locator('.comments-panel').count()) === 1 && (await page.locator('.cm-composer .cm-input').first().evaluate((el) => el === document.activeElement)));
await page.keyboard.press('Escape');
await page.keyboard.press('Control+,');
await page.waitForSelector('input[aria-label="Seu nome nos comentários"]');
await page.fill('input[aria-label="Seu nome nos comentários"]', 'Kayky');
await page.keyboard.press('Tab');
await page.waitForTimeout(200);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await ev((id) => designer.store.setSelection([id]), ids.a);
await page.waitForTimeout(250);
await page.locator('.cm-composer .cm-input').first().fill('Comentário com meu nome');
await page.locator('.cm-composer .cm-input').first().press('Control+Enter');
await page.waitForTimeout(300);
cs = await comentarios();
ok('o nome definido nas Configurações vira o autor', cs[cs.length - 1].author === 'Kayky', JSON.stringify(cs[cs.length - 1]));

// ---------------------------------------------------------------- recarregar
await page.waitForTimeout(700);
await page.reload();
await page.waitForTimeout(900);
cs = await comentarios();
ok('os comentários sobrevivem a recarregar (salvos com o projeto)', cs.length === 3 && cs.some((c) => c.replies.length === 1), JSON.stringify(cs.map((c) => c.text)));
ok('o selo da aba volta a mostrar os 3 abertos', (await page.locator('.cm-badge').innerText()) === '3');

ok('sem erros no console', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(fails ? 1 : 0);
