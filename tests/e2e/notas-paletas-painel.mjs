// Painel Design explicativo (cabeçalho, seções recolhíveis, "Explicações", dicas ricas em tudo), Nota da camada,
// seção HTML (etiqueta/link/descrição) e paletas de cor próprias (aba Recursos + seletor de cor).
import { chromium } from 'playwright';
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
const node = (id) => ev((i) => designer.store.get(i), id);

await ev(() => { designer.store.newDoc(); designer.canvas.setView({ x: 40, y: 40, zoom: 1 }); });
const id = await ev(async () => {
  const m = await import('/src/model.js');
  const a = m.createNode('rect', { name: 'Botão principal', x: 100, y: 100, w: 200, h: 100 });
  const t = m.createNode('text', { name: 'Título', text: 'Olá', x: 400, y: 100 });
  designer.store.update((p) => p.children.push(a, t), { commit: true });
  designer.store.setSelection([a.id]);
  return { a: a.id, t: t.id };
});
await page.waitForTimeout(400);

// ---------------------------------------------------------------- cabeçalho e explicações
ok('cabeçalho mostra o nome e a etiqueta <div>', (await page.locator('.sel-name').innerText()) === 'Botão principal' && (await page.locator('.sel-tag').innerText()) === '<div>');
ok('as seções têm ícone e explicação', (await page.locator('#right .panel-section .sh-ico').count()) >= 5 && (await page.locator('#right .section-help').count()) >= 5);
const helpVisible = () => page.locator('#right .section-help').first().isVisible();
ok('"Explicações" começa ligado e a ajuda aparece', await helpVisible());
await page.locator('.explain-btn').click();
ok('desligar "Explicações" esconde a ajuda', !(await helpVisible()));
await page.locator('.explain-btn').click();
ok('religar mostra de novo', await helpVisible());

// ---------------------------------------------------------------- seções recolhíveis (lembradas)
const secPos = page.locator('#right .panel-section', { has: page.locator('.section-head', { hasText: 'Posição' }) });
await secPos.locator('.section-head').click();
ok('clicar no cabeçalho recolhe a seção', await secPos.evaluate((s) => s.classList.contains('collapsed')) && !(await secPos.locator('.section-body').isVisible()));
await ev((i) => designer.store.setSelection([i]), id.t);
await page.waitForTimeout(250);
await ev((i) => designer.store.setSelection([i]), id.a);
await page.waitForTimeout(250);
ok('a seção continua recolhida ao trocar de camada', await secPos.evaluate((s) => s.classList.contains('collapsed')));
await secPos.locator('.section-head').click();
ok('clicar de novo abre', !(await secPos.evaluate((s) => s.classList.contains('collapsed'))));

// ---------------------------------------------------------------- legendas com CSS e dicas ricas
const caps = await ev(() => [...document.querySelectorAll('#right .cap-css')].map((e) => e.textContent));
ok('legendas mostram o nome do CSS (opacity, border-radius, width · height, left · top)', ['opacity', 'border-radius', 'width · height', 'left · top'].every((k) => caps.includes(k)), caps.join(','));
await ev(() => { const g = [...document.querySelectorAll('.cap-group')].find((e) => e.textContent.startsWith('Opacidade')); g.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
await page.waitForTimeout(600);
const tipTxt = await page.locator('.rich-tip.show').innerText().catch(() => '');
ok('a dica rica de Opacidade mostra CSS e explicação', tipTxt.includes('opacity: 0.8') && tipTxt.includes('transparente'), tipTxt);
await page.mouse.move(5, 5);
const toolbarTip = await ev(() => { const b = document.querySelector('#toolbar button[data-tip-title]'); return b ? { has: true, title: b.getAttribute('title') } : { has: false }; });
ok('botões da barra de ferramentas também usam a dica rica (sem title nativo)', toolbarTip.has && toolbarTip.title === null);
const shortcutTip = await ev(() => [...document.querySelectorAll('[data-tip-key]')].map((e) => e.dataset.tipKey).slice(0, 8));
ok('atalhos viram teclas na dica', shortcutTip.length > 0, JSON.stringify(shortcutTip));

// ---------------------------------------------------------------- empilhamento
const before = await ev(() => designer.store.page().children.map((c) => c.name));
await ev(() => { const b = [...document.querySelectorAll('#right .cap-group')].find((e) => e.textContent.startsWith('Empilhamento')); b.querySelector('button[aria-label^="Trazer para frente"], button').click(); });
await page.waitForTimeout(250);
const after = await ev(() => designer.store.page().children.map((c) => c.name));
ok('botões de empilhamento mudam a ordem das camadas', JSON.stringify(before) !== JSON.stringify(after), JSON.stringify([before, after]));
await ev(() => designer.store.undo());

// ---------------------------------------------------------------- nota
const sec = (title) => page.locator('#right .panel-section', { has: page.locator('.section-head', { hasText: title }) });
ok('a seção Nota começa recolhida quando vazia', await sec('Nota').evaluate((s) => s.classList.contains('collapsed')));
const box = await ev((i) => { const b = designer.canvas.aabb(i); const s = designer.canvas.toScreen(b.x + b.w / 2, b.y + b.h / 2); const r = designer.canvas.vpRect(); return { x: r.left + s.x, y: r.top + s.y }; }, id.a);
await page.mouse.click(box.x, box.y, { button: 'right' });
await page.waitForSelector('.menu');
await page.locator('.menu .menu-item', { hasText: 'Adicionar nota' }).click();
await page.waitForTimeout(400);
ok('"Adicionar nota" abre a seção e foca o campo', await page.locator('.note-input').evaluate((e) => e === document.activeElement) && !(await sec('Nota').evaluate((s) => s.classList.contains('collapsed'))));
await page.keyboard.type('Botão principal da home. Leva ao checkout.');
await page.locator('#right .sel-name').click();
await page.waitForTimeout(300);
ok('a nota fica guardada na camada', (await node(id.a)).note === 'Botão principal da home. Leva ao checkout.');
ok('a camada ganha o selo de nota na lista', (await page.locator('.layer-row .layer-note').count()) === 1);
await ev(() => designer.store.setSelection([]));
await ev((i) => designer.store.setSelection([i]), id.a);
await page.waitForTimeout(300);
ok('a nota continua aberta e preenchida ao reselecionar', (await page.locator('.note-input').inputValue()).startsWith('Botão principal') && !(await sec('Nota').evaluate((s) => s.classList.contains('collapsed'))));
const code = await ev(async () => { const { generateCode } = await import('/src/css.js'); return generateCode([designer.store.get(designer.store.ui.selection[0])], null).html; });
ok('a nota vira comentário no HTML gerado', code.includes('<!-- Botão principal da home. Leva ao checkout. -->'), code);
await page.locator('.note-input ~ label.check, #right .panel-section:has(.note-input) label.check').first().click();
await page.waitForTimeout(250);
ok('desmarcar "Incluir no código" tira o comentário', (await node(id.a)).noteInCode === false);
await ev(() => designer.store.undo());
await page.waitForTimeout(200);
ok('desfazer volta a marcar', (await node(id.a)).noteInCode !== false);

// post-it da nota no canvas
ok('a nota aparece como post-it no canvas', (await page.locator('.note-chip').count()) === 1 && (await page.locator('.note-chip').innerText()).startsWith('Botão principal da home'));
const chipBox = await page.locator('.note-chip').boundingBox();
const nodeBox = await ev((i) => { const b = designer.canvas.aabb(i); const s = designer.canvas.toScreen(b.x + b.w, b.y); const r = designer.canvas.vpRect(); return { x: r.left + s.x, y: r.top + s.y }; }, id.a);
ok('o post-it fica acima do canto superior direito da camada', Math.abs(chipBox.x + chipBox.width - nodeBox.x) < 6 && chipBox.y + chipBox.height <= nodeBox.y + 1, JSON.stringify([chipBox, nodeBox]));
await ev(() => designer.store.setSelection([]));
await page.waitForTimeout(250);
await page.locator('.note-chip').click();
await page.waitForTimeout(400);
ok('clicar no post-it seleciona a camada e foca a nota no painel', (await ev(() => designer.store.ui.selection[0])) === id.a && await page.locator('.note-input').evaluate((e) => e === document.activeElement));
await page.keyboard.press('Escape');
await ev(() => { designer.store.ui.showNotes = false; designer.store.emit('overlay'); });
await page.waitForTimeout(200);
ok('Exibir → Notas desliga os post-its', (await page.locator('.note-chip').count()) === 0);
await ev(() => { designer.store.ui.showNotes = true; designer.store.emit('overlay'); });
await page.waitForTimeout(200);
ok('e liga de novo', (await page.locator('.note-chip').count()) === 1);
const css0 = await ev(async () => { const { generateCode } = await import('/src/css.js'); return generateCode([designer.store.get(designer.store.ui.selection[0])], null).css; });
ok('a nota também vira comentário no CSS gerado', css0.startsWith('/* Botão principal da home. Leva ao checkout. */\n.botao-principal {'), css0.slice(0, 120));

// ---------------------------------------------------------------- HTML
const tagSel = sec('HTML').locator('select').first();
await tagSel.selectOption('button');
await page.waitForTimeout(250);
ok('escolher button muda a etiqueta e o cabeçalho', (await node(id.a)).tag === 'button' && (await page.locator('.sel-tag').innerText()) === '<button>');
await tagSel.selectOption('a');
await page.waitForTimeout(300);
const href = sec('HTML').locator('input[type="text"]').first();
ok('com <a> aparece o campo de endereço', (await href.getAttribute('placeholder')).includes('https'));
await href.fill('https://exemplo.com');
await href.press('Enter');
await page.waitForTimeout(250);
const code2 = await ev(async () => { const { generateCode } = await import('/src/css.js'); return generateCode([designer.store.get(designer.store.ui.selection[0])], null).html; });
ok('o link vai para o código (<a href>)', code2.includes('<a class="botao-principal" href="https://exemplo.com">'), code2);
await tagSel.selectOption('div');
await page.waitForTimeout(200);
ok('voltar para div limpa o campo tag', (await node(id.a)).tag === undefined);

// ---------------------------------------------------------------- paletas (aba Recursos)
await page.locator('#left .tab', { hasText: 'Recursos' }).click();
await page.waitForTimeout(300);
const palSec = page.locator('#left .panel-section', { has: page.locator('.section-head', { hasText: 'Paletas' }) });
ok('a aba Recursos tem a seção Paletas', (await palSec.count()) === 1);
await palSec.locator('.section-head .icon-btn').click();
await page.locator('.menu .menu-item', { hasText: 'Escrever ou colar cores' }).click();
await page.locator('.modal input.text').fill('#7c5cff, 00c7be #ff3b30 lixo');
await page.locator('.modal button', { hasText: 'Adicionar' }).click();
await page.waitForTimeout(250);
await page.locator('.modal input.text').fill('Marca');
await page.locator('.modal button', { hasText: 'Criar' }).click();
await page.waitForTimeout(400);
const pals = () => ev(() => JSON.parse(localStorage.getItem('pd.palettes') || '[]'));
let pl = await pals();
ok('a paleta "Marca" foi criada com as 3 cores válidas', pl.length === 1 && pl[0].name === 'Marca' && pl[0].colors.join() === '#7C5CFF,#00C7BE,#FF3B30', JSON.stringify(pl));
ok('os 3 quadradinhos aparecem', (await page.locator('.pal-card .pal-chip').count()) === 3);
await page.locator('.pal-chip').first().click();
await page.waitForTimeout(250);
ok('clicar na cor pinta o preenchimento da seleção', (await node(id.a)).fill.color === '#7C5CFF' && (await node(id.a)).fill.type === 'solid');
await page.locator('.pal-chip').nth(1).click({ modifiers: ['Shift'] });
await page.waitForTimeout(250);
ok('Shift+clique pinta o contorno', (await node(id.a)).stroke?.color === '#00C7BE');
await page.locator('.pal-chip').nth(2).hover();
await page.locator('.pal-chip').nth(2).locator('.pal-x').click();
await page.waitForTimeout(250);
pl = await pals();
ok('o × tira a cor da paleta', pl[0].colors.length === 2 && !pl[0].colors.includes('#FF3B30'));
// estilos de cor a partir da paleta
await page.locator('.pal-card .pal-head .icon-btn').click();
await page.locator('.menu .menu-item', { hasText: 'estilos de cor' }).click();
await page.waitForTimeout(300);
const styles = await ev(() => designer.store.state.doc.styles.colors.map((c) => c.name + ':' + c.color));
ok('"Adicionar ao projeto como estilos de cor" cria os estilos', styles.join() === 'Marca 1:#7C5CFF,Marca 2:#00C7BE', styles.join());
// o seletor de cor mostra as paletas próprias (o gerenciamento completo está em seletor-de-cor.mjs)
await page.locator('#left .tab', { hasText: 'Camadas' }).click();
await page.locator('#right .panel-section', { has: page.locator('.section-head', { hasText: 'Preenchimento' }) }).locator('button.swatch').click();
await page.waitForSelector('.cp');
ok('o seletor de cor mostra a paleta própria como aba', (await page.locator('.cp .cp-pill', { hasText: 'Marca' }).count()) === 1);
await page.keyboard.press('Escape');

// ---------------------------------------------------------------- recarregar: paletas e preferências permanecem
await page.waitForTimeout(700);
await page.reload();
await page.waitForTimeout(900);
pl = await pals();
ok('as paletas sobrevivem a recarregar o navegador', pl.length === 1 && pl[0].name === 'Marca');
await ev(() => designer.store.setSelection([designer.store.page().children[0].id]));
await page.waitForTimeout(300);
ok('o estado das seções e das explicações é lembrado', (await page.locator('#right .section-help').first().isVisible()) === true);

// excluir paleta
await page.locator('#left .tab', { hasText: 'Recursos' }).click();
await page.waitForTimeout(300);
await page.locator('.pal-card').nth(0).locator('.pal-head .icon-btn').click();
await page.locator('.menu .menu-item', { hasText: 'Excluir paleta' }).click();
await page.locator('.modal button', { hasText: 'Excluir' }).last().click();
await page.waitForTimeout(300);
pl = await pals();
ok('excluir paleta apaga a paleta', pl.length === 0);

ok('sem erros no console', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(fails ? 1 : 0);
