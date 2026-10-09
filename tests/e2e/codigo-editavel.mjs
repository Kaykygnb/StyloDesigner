// Aba Código editável (pelo editor grande embaixo do canvas): CSS da camada (com desfazer), CSS da página (canvas +
// exportação), camada "Código HTML" (sanitizada), atributos HTML e o Inspecionar. Com CAPTURAS=<pasta>, salva capturas 1440×900 das telas.
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

try {
  // projeto: uma tela com um card (auto layout) e um título
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
    store.update((p) => p.children.push(tela), { commit: true });
    store.setSelection([card.id]);
    designer.canvas.setView({ x: 0, y: 0, zoom: 1 });
  });
  await page.locator('.tab[aria-label="Código"]').click();
  await page.waitForTimeout(150);

  // ---- CSS da camada: Editar → mudar → aplicar → desfazer
  await page.locator('.code-edit-btn').click();
  const ta = page.locator('.ce-input');
  ok('editor de CSS abre com as declarações da camada', (await ta.inputValue()).includes('display: flex'), await ta.inputValue());
  const lines = (await ta.inputValue()).replace(/background-color: [^;]+;/, 'background-color: #ffeedd;').replace(/gap: [^;]+;/, 'gap: 20px;');
  await ta.fill(lines + '\ncursor: pointer;\nbox-shadow: 0 8px 24px rgba(0,0,0,.15);\nbordr: 1px;');
  await page.waitForTimeout(700);
  ok('aviso de propriedade desconhecida com linha', (await page.locator('.cd-problems li.warn').count()) >= 1 && (await page.locator('.ce-ln.warn').count()) >= 1);
  await shot('01-codigo-css-editando');
  await page.locator('.cd-apply').click();
  await page.waitForTimeout(200);
  let card = await ev(() => { const n = designer.store.selected()[0]; return { fill: n.fill.color, gap: n.layout.gap, css: n.customCss || '' }; });
  ok('cor e gap viraram propriedades do modelo', card.fill === '#FFEEDD' && card.gap === 20, JSON.stringify(card));
  ok('o resto foi para o CSS livre', card.css.includes('cursor: pointer') && card.css.includes('box-shadow'), card.css);
  const bg = await ev(() => getComputedStyle(designer.canvas.els.get(designer.store.ui.selection[0])).boxShadow);
  ok('canvas aplica o CSS livre', bg.includes('24px'), bg);
  await page.locator('#viewport').click({ position: { x: 1200, y: 800 } }).catch(() => {});
  await ev(() => designer.store.undo());
  card = await ev(() => { const n = designer.store.find?.('Card') || designer.store.page().children[0].children[0]; return { fill: n.fill.color, css: n.customCss || '' }; });
  ok('Ctrl+Z desfaz a edição de CSS inteira', card.fill !== '#FFEEDD' && !card.css.includes('cursor'), JSON.stringify(card));

  // ---- autocompletar
  await ev(() => designer.store.setSelection([designer.store.page().children[0].children[0].id]));
  await page.waitForTimeout(100);
  if (!(await page.locator('.ce-input').isVisible())) await page.locator('.code-edit-btn').click();
  await ta.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('justify-con');
  await page.waitForTimeout(100);
  ok('autocompletar sugere propriedades', await page.locator('.ce-complete:not([hidden]) .ce-opt .ce-label').first().textContent().catch(() => '') === 'justify-content');
  await page.keyboard.press('Tab');
  ok('Tab aceita a sugestão', (await ta.inputValue()).includes('justify-content: '));
  await page.locator('.cd-discard').click();

  // ---- CSS da página (aba do editor grande)
  await page.locator('[data-dock-tab="page"]').click();
  const pageCss = `.card:hover { transform: translateY(-2px); }\n.titulo { color: rgb(200, 30, 90); letter-spacing: 2px; }\n#destaque { outline: 3px solid rgb(0, 128, 0); }\n@media (max-width: 600px) {\n  .titulo { font-size: 18px; }\n}\n@keyframes surgir { from { opacity: 0 } to { opacity: 1 } }`;
  await page.locator('.ce-input').fill(pageCss);
  await page.waitForTimeout(250);
  await page.locator('.ce-input').press('Control+Home');
  await shot('02-codigo-css-pagina');
  await page.locator('.cd-apply').click();
  await page.waitForTimeout(200);
  const tit = await ev(() => { const t = designer.store.page().children[0].children[0].children[0]; return getComputedStyle(designer.canvas.els.get(t.id)).color; });
  ok('CSS da página vale no canvas (classe gerada)', tit === 'rgb(200, 30, 90)', tit);
  const appBar = await ev(() => getComputedStyle(document.querySelector('.code-title') || document.body).color);
  ok('CSS da página não vaza para a interface do app', appBar !== 'rgb(200, 30, 90)');
  const html = await ev(async () => (await import('/src/css.js')).exportHtml(designer.store.page().children[0], {}, 'T', designer.store.state.doc.styles));
  ok('exportação leva o CSS da página com @media e @keyframes', html.includes('/* CSS da página */') && html.includes('@media (max-width: 600px)') && html.includes('@keyframes surgir'));
  await ev(() => designer.store.undo());
  ok('Ctrl+Z desfaz o CSS da página', !(await ev(() => designer.store.state.doc.styles.pageCss)));
  await ev(() => designer.store.redo());

  // ---- atributos HTML (id): #destaque passa a valer
  await ev(() => designer.store.setSelection([designer.store.page().children[0].children[0].id]));
  await page.locator('[data-code-tab="html"]').click();
  await page.waitForTimeout(100);
  const idInput = page.locator('.code-attrs input[data-attr="htmlId"]');
  await idInput.fill('destaque');
  await idInput.press('Enter');
  await page.locator('.code-attrs input[data-attr="classes"]').fill('cartao  destaque-2');
  await page.locator('.code-attrs input[data-attr="classes"]').press('Tab');
  await page.waitForTimeout(150);
  const outline = await ev(() => getComputedStyle(designer.canvas.els.get(designer.store.ui.selection[0])).outlineColor);
  ok('id da camada vale para o CSS da página no canvas', outline === 'rgb(0, 128, 0)', outline);
  const cardHtml = await page.locator('pre.code-view').textContent();
  ok('HTML mostra id e classes extras', cardHtml.includes('id="destaque"') && cardHtml.includes('class="card cartao destaque-2"'), cardHtml.slice(0, 200));

  // ---- camada Código HTML
  await ev(() => designer.store.setSelection([designer.store.page().children[0].id]));
  await page.keyboard.press('Shift+E');
  await page.waitForTimeout(250);
  ok('Shift+E cria a camada Código HTML e abre o editor de HTML', await ev(() => designer.store.selected()[0]?.type === 'html') && (await page.locator('.ce[data-lang="html"]').count()) === 1);
  const evil = '<div class="banner">\n  <h2>Promoção</h2>\n  <p>Até <strong>50%</strong> off</p>\n  <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" onerror="window.__xss=1">\n  <a href="javascript:window.__xss=2">link</a>\n  <script>window.__xss=3</script>\n  <button type="button">Comprar</button>\n</div>';
  await page.locator('.ce-input').fill(evil);
  await page.waitForTimeout(700);
  ok('avisa o que será removido', (await page.locator('.cd-problems li.warn').count()) === 1);
  await shot('03-camada-html');
  await page.locator('.cd-apply').click();
  await page.waitForTimeout(300);
  const emb = await ev(() => { const n = designer.store.selected()[0]; const el = designer.canvas.els.get(n.id); return { inner: el.innerHTML, xss: window.__xss || 0 }; });
  ok('HTML renderizado no canvas', emb.inner.includes('<h2>Promoção</h2>') && emb.inner.includes('<button'), emb.inner);
  ok('sanitizado: sem script, on* nem javascript:', !/script|onerror|javascript:/i.test(emb.inner) && emb.xss === 0, emb.inner);
  const exp = await ev(async () => (await import('/src/css.js')).exportHtml(designer.store.page().children[0], {}, 'T', designer.store.state.doc.styles));
  ok('HTML à mão vai limpo para a exportação', exp.includes('<h2>Promoção</h2>') && !/onerror|javascript:|<script>window/.test(exp));
  await page.locator('[data-code-tab="css"]').click();
  await page.locator('.cd-close').click();

  // ---- Inspecionar
  await ev(() => designer.store.setSelection([]));
  await page.keyboard.press('i');
  const cardBox = await ev(() => { const id = designer.store.page().children[0].children[0].id; const r = designer.canvas.els.get(id).getBoundingClientRect(); return { x: r.x + 30, y: r.y + r.height - 12 }; });
  await page.mouse.move(cardBox.x, cardBox.y);
  await page.waitForTimeout(250);
  ok('Inspecionar mostra padding e conteúdo', (await page.locator('.insp-box').count()) === 1 && (await page.locator('.insp-content').count()) === 1);
  ok('etiqueta do inspetor com tag e classe', ((await page.locator('.insp-tip header').textContent()) || '').includes('.card'));
  await page.mouse.click(cardBox.x, cardBox.y);
  await page.waitForTimeout(250);
  ok('painel do inspetor com propriedades computadas', (await page.locator('.insp-panel').count()) === 1 && (await page.locator('.insp-panel .insp-boxmodel').count()) === 1);
  ok('painel lista regras do CSS da página que valem', ((await page.locator('.insp-panel').textContent()) || '').includes(':hover'));
  await page.keyboard.down('Alt');
  const tituloBox = await ev(() => { const t = designer.store.page().children[0].children[0].children[0]; const r = designer.canvas.els.get(t.id).getBoundingClientRect(); return { x: r.x + 5, y: r.y + 5 }; });
  await page.mouse.move(tituloBox.x, tituloBox.y);
  await page.waitForTimeout(200);
  ok('Alt mostra distâncias no Inspecionar', (await page.locator('.measure-line, .measure, [class*="measure"]').count()) > 0);
  await shot('04-inspecionar');
  await page.keyboard.up('Alt');
} catch (err) {
  ok('cenário terminou sem exceção', false, err.stack);
}
ok('sem erros no console', errors.length === 0, errors.join('\n'));
await browser.close();
console.log(fails ? `\n${fails} falha(s)` : '\nTudo certo');
process.exit(fails ? 1 : 0);
