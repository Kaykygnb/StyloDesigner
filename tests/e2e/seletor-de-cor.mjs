// Seletor de cor: HEX/RGB/HSL, opacidade, contraste, sugestões de harmonia, recentes e gerenciador de paletas
// dentro do próprio seletor (nova, renomear, guardar cor, tirar cor, trocar de paleta, duplicar, excluir).
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
const node = (id) => ev((i) => JSON.parse(JSON.stringify(designer.store.get(i))), id);
const pals = () => ev(() => JSON.parse(localStorage.getItem('pd.palettes') || '[]'));

await ev(() => { localStorage.removeItem('pd.palettes'); localStorage.removeItem('pd.recentColors'); localStorage.removeItem('pd.activePalette'); });
const id = await ev(async () => {
  const m = await import('/src/model.js');
  designer.store.newDoc();
  const a = m.createNode('rect', { name: 'Caixa', x: 100, y: 100, w: 200, h: 100 });
  designer.store.update((p) => p.children.push(a), { commit: true });
  designer.store.setSelection([a.id]);
  return a.id;
});
await page.waitForTimeout(400);
const fillSec = page.locator('#right .panel-section', { has: page.locator('.section-head', { hasText: 'Preenchimento' }) });
await fillSec.locator('button.swatch').click();
await page.waitForSelector('.cp');

// ---------------------------------------------------------------- estrutura e campos
ok('o seletor tem área de cor, matiz e barra de opacidade', (await page.locator('.cp .cp-sv').count()) === 1 && (await page.locator('.cp .cp-hue').count()) === 1 && (await page.locator('.cp .cp-alpha').count()) === 1);
await page.locator('.cp .cp-hex').fill('FF0000');
await page.waitForTimeout(200);
ok('digitar um HEX aplica ao vivo', (await node(id)).fill.color === '#FF0000');
await page.locator('.cp .cp-mode').click();
ok('o botão de formato alterna para RGB e mostra R, G, B', (await page.locator('.cp .cp-mode').innerText()) === 'RGB' && (await page.locator('.cp .cp-fields .cp-num').evaluateAll((l) => l.slice(0, 3).map((i) => i.value))).join() === '255,0,0');
const g = page.locator('.cp .cp-fields .cp-num').nth(1);
await g.fill('128');
await g.press('Enter');
await page.waitForTimeout(250);
ok('editar o G no RGB muda a cor (#FF8000)', (await node(id)).fill.color === '#FF8000', (await node(id)).fill.color);
await page.locator('.cp .cp-mode').click();
ok('HSL mostra 30, 100, 50', (await page.locator('.cp .cp-mode').innerText()) === 'HSL' && (await page.locator('.cp .cp-fields .cp-num').evaluateAll((l) => l.slice(0, 3).map((i) => i.value))).join() === '30,100,50');
const l = page.locator('.cp .cp-fields .cp-num').nth(2);
await l.press('ArrowUp'); // seta para cima soma 1 (dispara a mudança)
await page.waitForTimeout(250);
ok('seta para cima no campo soma 1 (L 51)', (await page.locator('.cp .cp-fields .cp-num').nth(2).inputValue()) === '51');
await page.locator('.cp .cp-mode').click(); // volta ao HEX
// opacidade
const op = page.locator('.cp .cp-fields .cp-num[aria-label="Opacidade em %"]');
await op.fill('50');
await op.press('Enter');
await page.waitForTimeout(250);
ok('o campo % muda a opacidade do preenchimento (0.5)', (await node(id)).fill.opacity === 0.5);
// barra de opacidade
const bar = await page.locator('.cp .cp-alpha').boundingBox();
await page.mouse.click(bar.x + bar.width * 0.25, bar.y + bar.height / 2);
await page.waitForTimeout(250);
ok('clicar na barra de opacidade define o valor (≈ 0.25)', Math.abs((await node(id)).fill.opacity - 0.25) < 0.05, String((await node(id)).fill.opacity));
// original
await page.locator('.cp .cp-prev-old').click();
await page.waitForTimeout(250);
ok('clicar na cor original volta a ela (#D9D9D9)', (await node(id)).fill.color === '#D9D9D9');

// ---------------------------------------------------------------- contraste
ok('mostra o contraste sobre branco e sobre preto, com o nível WCAG', (await page.locator('.cp .cp-cbox').count()) === 2 && /AA|AAA|falha/.test(await page.locator('.cp .cp-contrast').innerText()));

// ---------------------------------------------------------------- sugestões
await page.locator('.cp .cp-hex').fill('FF0000');
await page.locator('.cp .cp-hex').press('Enter');
await page.waitForTimeout(250);
await page.locator('.cp .cp-tab', { hasText: 'Tríade' }).click();
const triad = await page.locator('.cp .cp-harmony .chip').evaluateAll((l) => l.map((c) => c.getAttribute('aria-label')));
ok('a tríade de #FF0000 é #FF0000, #00FF00, #0000FF', triad.join() === '#FF0000,#00FF00,#0000FF', triad.join());
await page.locator('.cp .cp-harmony .chip').nth(1).click();
await page.waitForTimeout(250);
ok('clicar numa sugestão aplica a cor', (await node(id)).fill.color === '#00FF00');
ok('e as sugestões não "pulam" quando o clique veio delas', (await page.locator('.cp .cp-harmony .chip').evaluateAll((l) => l.map((c) => c.getAttribute('aria-label')))).join() === triad.join());
ok('as cores escolhidas entram nas Recentes', (await page.locator('.cp .cp-recent .chip').count()) >= 2);

// ---------------------------------------------------------------- paletas dentro do seletor
ok('sem paletas: mostra a explicação e o botão "+ Nova"', (await page.locator('.cp .cp-pals .cp-hint').count()) === 1 && (await page.locator('.cp .cp-pill.new').count()) === 1);
await page.locator('.cp .cp-pill.new').click();
await page.waitForTimeout(300);
ok('"+ Nova" cria "Paleta 1" com a cor atual e abre o campo de nome já focado', (await pals())[0]?.name === 'Paleta 1' && (await pals())[0].colors.join() === '#00FF00' && await page.locator('.cp .cp-rename').evaluate((e) => e === document.activeElement));
await page.keyboard.type('Marca');
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
ok('digitar e Enter renomeia a paleta', (await pals())[0].name === 'Marca' && (await page.locator('.cp .cp-pname').innerText()) === 'Marca');
await page.locator('.cp .cp-hex').fill('7C5CFF');
await page.locator('.cp .cp-hex').press('Enter');
await page.waitForTimeout(250);
await page.locator('.cp .cp-pchip.add').click();
await page.waitForTimeout(250);
ok('o + do bloco guarda a cor atual na paleta ativa', (await pals())[0].colors.join() === '#00FF00,#7C5CFF');
await page.locator('.cp .cp-pchip-wrap').first().locator('.cp-pchip').click();
await page.waitForTimeout(250);
ok('clicar numa cor da paleta usa a cor', (await node(id)).fill.color === '#00FF00');
await page.locator('.cp .cp-pchip-wrap').nth(1).hover();
await page.locator('.cp .cp-pchip-wrap').nth(1).locator('.cp-pchip-x').click();
await page.waitForTimeout(250);
ok('o × tira a cor da paleta', (await pals())[0].colors.join() === '#00FF00');
// sugestões → guardar na paleta
await page.locator('.cp .cp-tab', { hasText: 'Análogas' }).click();
await page.locator('.cp .cp-link', { hasText: 'guardar na paleta' }).click();
await page.waitForTimeout(250);
ok('"+ guardar na paleta" põe as sugestões na paleta ativa', (await pals())[0].colors.length === 3, JSON.stringify((await pals())[0].colors));
// segunda paleta e troca por abas
await page.locator('.cp .cp-pill.new').click();
await page.waitForTimeout(300);
await page.keyboard.press('Escape'); // cancela o renomear (mantém "Paleta 2")
await page.waitForTimeout(250);
ok('Esc no campo de nome só cancela a renomeação (o seletor continua aberto)', (await page.locator('.cp').count()) === 1 && (await pals()).length === 2 && (await pals())[1].name === 'Paleta 2');
await page.locator('.cp .cp-pill', { hasText: 'Marca' }).click();
await page.waitForTimeout(250);
ok('clicar na aba troca a paleta ativa', (await page.locator('.cp .cp-pname').innerText()) === 'Marca' && (await page.locator('.cp .cp-pchip-wrap').count()) === 3);
// duplicar pelo menu ⋯ (o menu fica fora do seletor e não deve fechá-lo)
await page.locator('.cp .cp-phead .icon-btn').click();
await page.locator('.menu .menu-item', { hasText: 'Duplicar' }).click();
await page.waitForTimeout(300);
ok('Duplicar cria a cópia e o seletor continua aberto', (await pals()).length === 3 && (await pals())[2].name === 'Marca (cópia)' && (await page.locator('.cp').count()) === 1);
await page.keyboard.press('Enter'); // fecha o renomear da cópia
await page.waitForTimeout(250);
// excluir com confirmação
await page.locator('.cp .cp-phead .icon-btn').click();
await page.locator('.menu .menu-item', { hasText: 'Excluir paleta' }).click();
await page.waitForTimeout(250);
ok('Excluir pede confirmação ali mesmo', (await page.locator('.cp .cp-confirm').count()) === 1 && (await pals()).length === 3);
await page.locator('.cp .cp-confirm button', { hasText: 'Cancelar' }).click();
ok('Cancelar não apaga', (await page.locator('.cp .cp-confirm').count()) === 0 && (await pals()).length === 3);
await page.locator('.cp .cp-phead .icon-btn').click();
await page.locator('.menu .menu-item', { hasText: 'Excluir paleta' }).click();
await page.locator('.cp .cp-confirm button', { hasText: 'Excluir' }).click();
await page.waitForTimeout(300);
ok('confirmar apaga a paleta ativa', (await pals()).length === 2 && !(await pals()).some((p) => p.name === 'Marca (cópia)'));
// renomear dando duplo clique na aba
await page.locator('.cp .cp-pill.on').dblclick();
await page.waitForTimeout(250);
ok('duplo clique na aba abre o renomear', (await page.locator('.cp .cp-rename').count()) === 1);
await page.keyboard.press('Escape');

// ---------------------------------------------------------------- fechar
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
ok('Esc fecha o seletor', (await page.locator('.cp').count()) === 0);
await ev((i) => designer.store.setSelection([i]), id);
await page.waitForTimeout(300);
await fillSec.locator('button.swatch').click();
await page.waitForSelector('.cp');
ok('reabrir lembra a paleta ativa e as recentes', (await page.locator('.cp .cp-recent .chip').count()) >= 3 && (await page.locator('.cp .cp-pill.on').count()) === 1);

ok('sem erros no console', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(fails ? 1 : 0);
