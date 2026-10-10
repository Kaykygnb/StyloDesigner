// Editor de código GRANDE (embaixo do canvas / tela cheia) e AUTOCOMPLETAR, simulando a pessoa digitando:
// abrir pelo "Editar" e por Ctrl+Shift+E, arrastar a borda (altura lembrada), tela cheia (Ctrl+Shift+M/Esc), pré-visualização
// ao vivo no canvas, sugestões de CSS (propriedades, valores, unidades, var(), seletores, @media dos breakpoints),
// HTML (etiquetas, atributos, fechamento automático) e Emmet com Tab. Com CAPTURAS=<pasta>, salva capturas 1440×900.
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
page.on('dialog', (d) => d.accept());
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
await page.goto(new URL('?editor', process.env.APP_URL || 'http://localhost:5173/').href);
await page.waitForTimeout(800);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + extra)); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async (name) => { if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/${name}.png` }); };
const kb = page.keyboard;
const value = () => page.locator('.code-dock .ce-input:visible').inputValue();
const popupLabels = () => page.locator('.ce-complete:not([hidden]) .ce-opt .ce-label').allTextContents();

try {
  // projeto: uma tela com um card (auto layout), um título e um estilo de cor
  await ev(async () => {
    const { store } = designer;
    store.newDoc();
    const m = await import('/src/model.js');
    const tela = m.createNode('frame', { name: 'Tela', x: 80, y: 60, w: 640, h: 480 });
    const card = m.createNode('frame', { name: 'Card', x: 40, y: 40, w: 280, h: 160 });
    card.layout = { ...m.defaultLayout(), mode: 'column', gap: 8, padding: [16, 16, 16, 16] };
    const titulo = m.createNode('text', { name: 'Titulo', text: 'Olá, Stylo', fontSize: 24 });
    card.children.push(titulo);
    tela.children.push(card);
    store.update((p) => {
      p.children.push(tela);
      store.state.doc.styles.colors.push({ id: 'c1', name: 'Primária', color: '#E11D74', opacity: 1 });
    }, { commit: true });
    store.setSelection([card.id]);
    designer.canvas.setView({ x: 0, y: 0, zoom: 1 });
  });
  await page.locator('.tab[aria-label="Código"]').click();
  await page.waitForTimeout(150);

  // ---- abrir pelo "Editar": painel embaixo do canvas, com as 3 abas
  const vpBefore = await ev(() => document.querySelector('#viewport').getBoundingClientRect().height);
  await page.locator('.code-edit-btn').click();
  await page.waitForTimeout(250);
  const dock = page.locator('.code-dock');
  ok('Editar abre o editor grande', await dock.isVisible());
  const geo = await ev(() => {
    const d = document.querySelector('.code-dock').getBoundingClientRect();
    const v = document.querySelector('#viewport').getBoundingClientRect();
    return { dockTop: d.top, dockW: d.width, dockH: d.height, vpBottom: v.bottom, vpH: v.height };
  });
  ok('acoplado embaixo do canvas (o canvas encolhe)', Math.abs(geo.dockTop - geo.vpBottom) <= 2 && geo.vpH < vpBefore - 100, JSON.stringify(geo));
  ok('largo (bem mais que a aba de 300px)', geo.dockW > 800, String(geo.dockW));
  ok('três abas: CSS da camada, CSS da página e HTML', (await page.locator('.cd-tab').allTextContents()).join('|') === 'CSS da camada|CSS da página|HTML');
  const font = await ev(() => { const cs = getComputedStyle(document.querySelector('.code-dock .ce-input')); return [cs.fontSize, cs.lineHeight]; });
  ok('fonte 13px, linha 1.6', font[0] === '13px' && Math.abs(parseFloat(font[1]) - 20.8) < 0.1, font.join(' '));
  ok('editor com as declarações da camada e o foco', (await value()).includes('display: flex') && await ev(() => document.activeElement?.classList.contains('ce-input')));

  // ---- autocompletar de propriedade e de valor, digitando
  await kb.press('Control+End');
  await kb.press('Enter');
  await kb.type('jc');
  await page.waitForTimeout(80);
  ok('fuzzy: "jc" sugere justify-content', (await popupLabels())[0] === 'justify-content', (await popupLabels()).slice(0, 3).join(','));
  ok('popup mostra a descrição', ((await page.locator('.ce-doc').textContent()) || '').includes('eixo principal'));
  await kb.press('Enter');
  await page.waitForTimeout(80);
  ok('Enter aceita e já sugere os valores', (await value()).endsWith('justify-content: ') && (await popupLabels()).includes('space-between'));
  await kb.press('ArrowDown');
  await kb.press('ArrowDown');
  const third = (await popupLabels())[2];
  await kb.press('Tab');
  ok('setas navegam e Tab aceita o valor (com ;)', (await value()).endsWith(`justify-content: ${third};`), (await value()).slice(-40));
  await kb.press('Enter');
  await kb.type('padding: 12');
  await page.waitForTimeout(80);
  ok('número sugere unidades', (await popupLabels()).slice(0, 3).join(',') === '12px,12rem,12%', (await popupLabels()).join(','));
  await kb.type('r');
  await kb.press('Enter');
  ok('unidade aceita (12rem)', (await value()).endsWith('padding: 12rem'));
  await kb.type(';');
  await kb.press('Enter');
  await kb.type('color: ');
  await page.waitForTimeout(80);
  ok('cor sugere a variável do projeto com prévia', (await popupLabels())[0] === 'var(--cor-primaria)' && (await page.locator('.ce-opt.on .ce-ico.swatch').count()) === 1, (await popupLabels()).slice(0, 3).join(','));
  await shot('03-autocomplete-css');
  await kb.press('Escape');
  ok('Esc fecha o popup', (await page.locator('.ce-complete:not([hidden])').count()) === 0);
  await kb.press('Control+Space');
  ok('Ctrl+Espaço abre manualmente', (await page.locator('.ce-complete:not([hidden])').count()) === 1);
  await kb.press('Enter');
  await kb.type(';');
  await page.waitForTimeout(400);
  const live = await ev(() => getComputedStyle(designer.canvas.els.get(designer.store.ui.selection[0])).color);
  ok('pré-visualização ao vivo no canvas (var() do projeto vale)', live === 'rgb(225, 29, 116)', live);
  ok('status mostra que não está aplicado', ((await page.locator('.cd-state').textContent()) || '').includes('não aplicado'));
  await shot('01-editor-grande');

  // ---- colchetes/aspas fecham sozinhos, Enter entre { } abre o bloco, Ctrl+/ comenta
  await kb.press('Enter');
  await kb.type('width: calc(');
  ok('parêntese fecha sozinho', (await value()).endsWith('calc()'));
  await kb.type('100% - 2rem');
  await kb.type(')');
  ok('digitar ")" pula o fechamento', (await value()).endsWith('calc(100% - 2rem)') && !(await value()).endsWith('))'));
  await kb.type(';');
  await kb.press('Control+/');
  ok('Ctrl+/ comenta a linha', (await value()).includes('/* width: calc(100% - 2rem); */'));
  await kb.press('Control+/');
  ok('Ctrl+/ de novo descomenta', (await value()).includes('\nwidth: calc(100% - 2rem);'));

  // ---- procurar
  await kb.press('Control+f');
  await kb.type('padding');
  await page.waitForTimeout(80);
  ok('Ctrl+F procura e conta', ((await page.locator('.ce-find-count').textContent()) || '').includes('de'), await page.locator('.ce-find-count').textContent());
  await kb.press('Escape');
  ok('Esc fecha a busca e volta ao código', await ev(() => document.activeElement?.classList.contains('ce-input')) && (await page.locator('.ce-find:not([hidden])').count()) === 0);

  // ---- aplicar com Ctrl+S
  await kb.press('Control+s');
  await page.waitForTimeout(200);
  const applied = await ev(() => { const n = designer.store.selected()[0]; return { css: n.customCss || '', just: n.layout?.justify }; });
  ok('Ctrl+S aplica (vira modelo / CSS livre)', applied.css.includes('var(--cor-primaria)') || applied.css.includes('color'), JSON.stringify(applied));
  ok('status em dia depois de aplicar', ((await page.locator('.cd-state').textContent()) || '').startsWith('Em dia'));
  await ev(() => designer.store.undo());
  await page.waitForTimeout(150);
  ok('um Ctrl+Z desfaz tudo (a prévia ao vivo não entrou no histórico)', !(await ev(() => (designer.store.selected()[0].customCss || '').includes('cor-primaria'))));

  // ---- redimensionar arrastando a borda (altura lembrada)
  const grip = await page.locator('.cd-grip').boundingBox();
  await page.mouse.move(grip.x + 300, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + 300, grip.y - 120, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const h2 = await ev(() => document.querySelector('.code-dock').getBoundingClientRect().height);
  ok('arrastar a borda aumenta a altura', Math.abs(h2 - (geo.dockH + 120)) < 6, `${geo.dockH} → ${h2}`);
  ok('altura lembrada nas preferências', await ev(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /pref/i.test(k))) || '{}').codeDockH) === Math.round(h2));

  // ---- tela cheia (botão / Ctrl+Shift+M) e Esc; F11 não maximiza mais o editor (o navegador o reserva, issue #14)
  await page.locator('.code-dock .ce-input:visible').click();
  await kb.press('F11');
  await page.waitForTimeout(150);
  ok('F11 não maximiza o editor', await ev(() => { const r = document.querySelector('.code-dock').getBoundingClientRect(); return !(r.width === innerWidth && r.height === innerHeight); }));
  await kb.press('Control+Shift+M');
  await page.waitForTimeout(150);
  const full = await ev(() => { const r = document.querySelector('.code-dock').getBoundingClientRect(); return r.width === innerWidth && r.height === innerHeight; });
  ok('Ctrl+Shift+M deixa em tela cheia', full);
  await shot('02-editor-tela-cheia');
  await kb.press('Escape');
  await page.waitForTimeout(100);
  ok('Esc sai da tela cheia', !(await ev(() => document.querySelector('.code-dock').classList.contains('max'))) && await dock.isVisible());
  await page.locator('.cd-max').click();
  ok('botão maximizar também', await ev(() => document.querySelector('.code-dock').classList.contains('max')));
  await page.locator('.cd-max').click();

  // ---- CSS da página: seletores (classes das camadas), pseudo e @media com os breakpoints do projeto
  await page.locator('[data-dock-tab="page"]').click();
  await page.locator('.code-dock .ce-input:visible').click();
  await kb.type('.ca');
  await page.waitForTimeout(80);
  ok('seletor sugere a classe das camadas', (await popupLabels())[0] === '.card', (await popupLabels()).join(','));
  await kb.press('Tab');
  await kb.type(':hov');
  await page.waitForTimeout(80);
  ok('pseudo-classe :hover', (await popupLabels())[0] === ':hover');
  await kb.press('Tab');
  await kb.type(' {');
  await kb.press('Enter');
  ok('{ fecha sozinha e Enter abre o bloco indentado', (await value()) === '.card:hover {\n  \n}', JSON.stringify(await value()));
  await kb.type('transform: tr');
  await page.waitForTimeout(80);
  ok('funções do transform', (await popupLabels())[0]?.startsWith('translate'), (await popupLabels()).join(','));
  await kb.press('Escape');
  await kb.press('Control+End');
  await kb.press('Enter');
  await kb.press('Enter');
  await kb.type('@me');
  await page.waitForTimeout(80);
  const at = await popupLabels();
  ok('@media com os breakpoints do projeto', at.includes('@media (max-width: 1024px)') && at.includes('@media (max-width: 640px)'), at.join(','));
  await page.locator('.ce-complete .ce-opt', { hasText: '640px' }).first().click();
  ok('@media vira bloco com o cursor dentro', (await value()).includes('@media (max-width: 640px) {\n  \n}'));
  await page.waitForTimeout(400);
  ok('CSS da página também pré-visualiza ao vivo', ((await ev(() => designer.store.state.doc.styles.pageCss)) || '').includes('.card:hover'));
  await shot('06-css-pagina');
  await page.locator('.cd-discard').click();
  ok('Descartar volta ao que era', !(await ev(() => designer.store.state.doc.styles.pageCss)) && (await value()) === '');

  // ---- HTML: etiquetas, atributos, fechamento automático e Emmet
  await ev(() => designer.store.setSelection([designer.store.page().children[0].id]));
  await page.locator('#viewport').click({ position: { x: 1000, y: 120 }, timeout: 500 }).catch(() => {});
  await ev(() => designer.store.setSelection([designer.store.page().children[0].id]));
  await page.keyboard.press('Shift+E');
  await page.waitForTimeout(300);
  ok('Shift+E abre o editor grande na aba HTML', await ev(() => document.querySelector('.cd-tab.on')?.dataset.dockTab === 'html') && (await page.locator('.code-dock .ce[data-lang="html"]').isVisible()));
  await page.locator('.code-dock .ce-input:visible').click();
  await kb.press('Control+a');
  await kb.press('Backspace');
  await kb.type('section.card>h2{Oferta}+p.texto');
  await page.waitForTimeout(80);
  ok('popup oferece a abreviação Emmet com prévia', (await popupLabels())[0] === 'section.card>h2{Oferta}+p.texto' && ((await page.locator('.ce-doc').textContent()) || '').includes('<h2>Oferta</h2>'));
  await shot('05-emmet');
  await kb.press('Tab');
  ok('Tab expande o Emmet', (await value()) === '<section class="card">\n  <h2>Oferta</h2>\n  <p class="texto"></p>\n</section>', JSON.stringify(await value()));
  await kb.type('Texto');
  ok('cursor fica no primeiro lugar vazio', (await value()).includes('<p class="texto">Texto</p>'));
  await kb.press('Control+End');
  await kb.press('Enter');
  await kb.type('<butt');
  await page.waitForTimeout(80);
  ok('etiquetas depois de <', (await popupLabels())[0] === 'button');
  await kb.press('Enter');
  await kb.type(' ty');
  await page.waitForTimeout(80);
  ok('atributos da etiqueta', (await popupLabels())[0] === 'type');
  await kb.press('Enter');
  await page.waitForTimeout(80);
  ok('atributo com aspas e valores sugeridos', (await value()).endsWith('<button type=""') && (await popupLabels()).includes('submit'));
  await shot('04-autocomplete-html');
  await kb.press('Enter');
  await kb.press('End');
  await kb.type('>');
  ok('">" fecha a etiqueta', (await value()).endsWith('<button type="button"></button>'), (await value()).slice(-40));
  await kb.type('Comprar');
  await kb.press('Control+Enter');
  await page.waitForTimeout(300);
  const emb = await ev(() => { const n = designer.store.selected()[0]; return designer.canvas.els.get(n.id).innerHTML; });
  ok('Ctrl+Enter aplica o HTML no canvas', emb.includes('<h2>Oferta</h2>') && emb.includes('>Comprar</button>'), emb);

  // ---- Ctrl+Shift+E fecha e abre
  await kb.press('Control+Shift+E');
  await page.waitForTimeout(150);
  ok('Ctrl+Shift+E fecha', !(await dock.isVisible()));
  const back = await ev(() => document.querySelector('#viewport').getBoundingClientRect().height);
  ok('canvas volta ao tamanho', Math.abs(back - vpBefore) < 2, `${vpBefore} vs ${back}`);
  await page.locator('#viewport').click({ position: { x: 1000, y: 700 }, timeout: 500 }).catch(() => {});
  await kb.press('Control+Shift+E');
  await page.waitForTimeout(200);
  ok('Ctrl+Shift+E abre com a altura lembrada', await dock.isVisible() && Math.abs((await ev(() => document.querySelector('.code-dock').getBoundingClientRect().height)) - h2) < 2);
} catch (err) {
  ok('cenário terminou sem exceção', false, err.stack);
}
ok('sem erros no console', errors.length === 0, errors.join('\n'));
await browser.close();
console.log(fails ? `\n${fails} falha(s)` : '\nTudo certo');
process.exit(fails ? 1 : 0);
