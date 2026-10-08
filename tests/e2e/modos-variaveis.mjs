// Modos de cor (claro/escuro): criar, ver no canvas, editar o valor por modo, CSS; e variáveis de tamanho: criar, ligar
// um campo, mudar o valor, editar à mão (solta), CSS com var().
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
const styles = () => ev(() => JSON.parse(JSON.stringify(designer.store.state.doc.styles)));
const bg = (id) => ev((i) => getComputedStyle(designer.canvas.els.get(i)).backgroundColor, id);
const css = () => ev(async () => {
  const { generateCode, joinCss } = await import('/src/css.js');
  const d = designer.store.state.doc;
  return joinCss([generateCode([d.pages[0].children[0]], null, d.assets, { root: true, styles: d.styles })]);
});

await ev(() => { localStorage.removeItem('pd.collapsed'); });
const ids = await ev(async () => {
  const m = await import('/src/model.js');
  designer.store.newDoc();
  const f = m.createNode('frame', { name: 'Tela', x: 0, y: 0, w: 600, h: 300 });
  f.layout = { ...f.layout, mode: 'row', gap: 4, padding: [0, 0, 0, 0], justify: 'flex-start', align: 'flex-start' };
  f.fill = { ...f.fill, type: 'solid', color: '#FFFFFF', opacity: 1 };
  const t = m.createNode('text', { name: 'Titulo', text: 'Ola', x: 0, y: 0 });
  f.children = [t];
  designer.store.update((p) => p.children.push(f), { commit: true });
  designer.commands.addColorStyle(f, 'Fundo');
  designer.store.setSelection([f.id]);
  designer.canvas.fit(null);
  return { f: f.id, t: t.id };
});
await page.waitForTimeout(400);

// ---------------------------------------------------------------- modos de cor
ok('sem modos, a barra oferece "Modo de cor"', (await page.locator('.bp-seg.modes .bp-btn.add').innerText()).includes('Modo de cor'));
await page.locator('.bp-seg.modes .bp-btn.add').click();
await page.locator('.menu .menu-item', { hasText: 'Escuro automático' }).click();
await page.waitForTimeout(500);
let st = await styles();
ok('criar "Escuro automático" cria o modo e gera o valor de cada estilo', st.modes?.length === 1 && st.modes[0].name === 'Escuro' && st.modes[0].scheme === 'dark' && !!st.colors[0].modes?.[st.modes[0].id]?.color, JSON.stringify(st));
const modeId = st.modes[0].id;
ok('o modo já fica ativo no canvas', (await ev(() => designer.store.ui.mode)) === modeId && (await page.locator('.bp-seg.modes .bp-btn.on').innerText()) === 'Escuro');
const dark = await bg(ids.f);
ok('o fundo do frame ficou escuro no canvas (não é mais branco)', dark !== 'rgb(255, 255, 255)' && /rgb\((\d+), (\d+), (\d+)\)/.test(dark) && Number(/rgb\((\d+)/.exec(dark)[1]) < 60, dark);
ok('o valor base do estilo continua branco', (await node(ids.f)).fill.color === '#FFFFFF' && st.colors[0].color === '#FFFFFF');
await page.locator('.bp-seg.modes .bp-btn', { hasText: 'Padrão' }).click();
await page.waitForTimeout(400);
ok('voltar ao Padrão traz o branco de volta', (await bg(ids.f)) === 'rgb(255, 255, 255)');

// editar o valor do estilo NO modo escuro, pelo painel de Recursos
await page.locator('.bp-seg.modes .bp-btn', { hasText: 'Escuro' }).click();
await page.locator('#left .tab', { hasText: 'Recursos' }).click();
await page.waitForTimeout(300);
await page.locator('#left .asset-row', { hasText: 'Fundo' }).locator('button.asset-swatch').click();
await page.waitForSelector('.cp');
await page.locator('.cp .cp-hex').fill('112233');
await page.locator('.cp .cp-hex').press('Enter');
await page.waitForTimeout(300);
st = await styles();
ok('a amostra do estilo edita o valor NO modo ativo (o padrão não muda)', st.colors[0].modes[modeId].color === '#112233' && st.colors[0].color === '#FFFFFF', JSON.stringify(st.colors[0]));
ok('o canvas mostra a cor nova no modo escuro', (await bg(ids.f)) === 'rgb(17, 34, 51)');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// painel Design em modo escuro: edita o valor do estilo, não solta a ligação
await page.locator('#left .tab', { hasText: 'Camadas' }).click();
await ev((i) => designer.store.setSelection([i]), ids.f);
await page.waitForTimeout(400);
ok('o painel avisa que a cor vale só neste modo', (await page.locator('#right .hint', { hasText: 'Modo Escuro' }).count()) >= 1);
await page.locator('#right .panel-section', { has: page.locator('.section-head', { hasText: 'Preenchimento' }) }).locator('input.hex').fill('334455');
await page.locator('#right .panel-section', { has: page.locator('.section-head', { hasText: 'Preenchimento' }) }).locator('input.hex').press('Enter');
await page.waitForTimeout(300);
st = await styles();
ok('editar a cor no painel (modo escuro) muda o valor do modo e mantém a ligação ao estilo', st.colors[0].modes[modeId].color === '#334455' && (await node(ids.f)).fill.styleId === st.colors[0].id && (await node(ids.f)).fill.color === '#FFFFFF');

// CSS
const out = await css();
ok('CSS: :root claro, :root[data-theme="escuro"] e prefers-color-scheme', out.includes(':root {\n  --cor-fundo: #ffffff;') && out.includes(':root[data-theme="escuro"] {\n  --cor-fundo: #334455;') && out.includes('@media (prefers-color-scheme: dark)'), out.slice(0, 500));

// renomear / excluir o modo pelo menu (botão direito)
await page.locator('.bp-seg.modes .bp-btn', { hasText: 'Escuro' }).click({ button: 'right' });
await page.locator('.menu .menu-item', { hasText: 'Excluir modo' }).click();
await page.waitForTimeout(400);
st = await styles();
ok('excluir o modo apaga os valores dele e volta ao padrão', st.modes === undefined && st.colors[0].modes === undefined && (await ev(() => designer.store.ui.mode)) === null, JSON.stringify(st));
ok('e o fundo volta a ser o do estilo', (await bg(ids.f)) === 'rgb(255, 255, 255)');
await ev(() => designer.store.undo());
await page.waitForTimeout(300);
ok('Ctrl+Z traz o modo de volta', (await styles()).modes?.length === 1);

// ---------------------------------------------------------------- variáveis de tamanho
await page.locator('#left .tab', { hasText: 'Recursos' }).click();
await page.waitForTimeout(300);
const varSec = page.locator('#left .panel-section', { has: page.locator('.section-head', { hasText: 'Variáveis' }) });
await varSec.locator('.section-head .icon-btn').click();
await page.locator('.modal input.text').fill('Espaço M');
await page.locator('.modal button', { hasText: 'Criar' }).click();
await page.waitForTimeout(250);
await page.locator('.modal input.text').fill('16');
await page.locator('.modal button', { hasText: 'Criar' }).click();
await page.waitForTimeout(400);
st = await styles();
ok('a variável "Espaço M" = 16 foi criada', st.vars?.length === 1 && st.vars[0].name === 'Espaço M' && st.vars[0].value === 16, JSON.stringify(st.vars));
ok('a lista mostra o nome da variável CSS (--espaco-m)', (await varSec.locator('.var-name code').innerText()) === '--espaco-m');

await page.locator('#left .tab', { hasText: 'Camadas' }).click();
await ev((i) => designer.store.setSelection([i]), ids.f);
await page.waitForTimeout(400);
const gapGroup = page.locator('#right .cap-group', { hasText: 'Espaço entre itens' });
await gapGroup.locator('.var-btn').click();
await page.locator('.menu .menu-item', { hasText: 'Espaço M' }).click();
await page.waitForTimeout(400);
let f = await node(ids.f);
ok('ligar o gap à variável aplica o valor (16) e guarda a ligação', f.layout.gap === 16 && f.vars?.gap === st.vars[0].id, JSON.stringify([f.layout.gap, f.vars]));
ok('o botão da variável fica marcado', await gapGroup.locator('.var-btn').evaluate((b) => b.classList.contains('on')));
ok('o CSS usa var(--espaco-m) e declara a variável no :root', (await css()).includes('gap: var(--espaco-m)') && (await css()).includes('--espaco-m: 16px;'));

// mudar o valor da variável muda a camada
await page.locator('#left .tab', { hasText: 'Recursos' }).click();
await page.waitForTimeout(300);
const valInput = page.locator('#left .var-val').first();
await valInput.fill('32');
await valInput.press('Enter');
await page.waitForTimeout(400);
f = await node(ids.f);
ok('mudar o valor da variável leva o novo valor à camada ligada (32)', f.layout.gap === 32 && f.vars?.gap, JSON.stringify([f.layout.gap, f.vars]));

// editar o campo à mão solta a ligação
await page.locator('#left .tab', { hasText: 'Camadas' }).click();
await ev((i) => designer.store.setSelection([i]), ids.f);
await page.waitForTimeout(300);
const gapInput = page.locator('#right .cap-group', { hasText: 'Espaço entre itens' }).locator('input').first();
await gapInput.fill('10');
await gapInput.press('Enter');
await page.waitForTimeout(400);
f = await node(ids.f);
ok('editar o gap à mão solta a ligação e mantém o valor digitado', f.layout.gap === 10 && !f.vars, JSON.stringify([f.layout.gap, f.vars]));
ok('o CSS volta a escrever o px direto', (await css()).includes('gap: 10px') && !(await css()).includes('--espaco-m'));

// "nova variável com o valor atual" pelo botão do campo (raio)
const radiusGroup = page.locator('#right .cap-group', { hasText: 'Raio dos cantos' });
await radiusGroup.locator('.var-btn').click();
await page.locator('.menu .menu-item', { hasText: 'Nova variável com o valor atual' }).click();
await page.locator('.modal input.text').fill('Raio card');
await page.locator('.modal button', { hasText: 'Criar' }).click();
await page.waitForTimeout(400);
st = await styles();
f = await node(ids.f);
ok('"Nova variável com o valor atual" cria e já liga o raio', st.vars.length === 2 && st.vars[1].name === 'Raio card' && f.vars?.radius === st.vars[1].id);

// excluir variável: a camada fica com o valor, sem ligação
await page.locator('#left .tab', { hasText: 'Recursos' }).click();
await page.waitForTimeout(300);
await page.locator('#left .var-row', { hasText: 'Raio card' }).locator('.icon-btn').click();
await page.waitForTimeout(400);
f = await node(ids.f);
ok('excluir a variável solta a ligação (valor fica)', !f.vars && (await styles()).vars.length === 1);

// recarregar
await page.waitForTimeout(800);
await page.reload();
await page.waitForTimeout(900);
st = await styles();
ok('modos e variáveis sobrevivem a recarregar', st.modes?.length === 1 && st.vars?.length === 1 && (await ev(() => designer.store.ui.mode)) === null);

ok('sem erros no console', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(fails ? 1 : 0);
