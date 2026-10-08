// SVG editável, ícones do Google e Google Fonts:
//  - importar SVG (formas, classes CSS, gradiente, grupo com transform, furo evenodd, texto) como camadas editáveis;
//  - abrir .svg pelo botão de imagem e COLAR SVG como texto (ex.: "Copiar como SVG" do Figma);
//  - vetor com furo sobrevive a salvar/recarregar e volta no SVG exportado;
//  - painel Ícones: busca (inclusive em português), insere como vetor na cor/tamanho escolhidos, dentro do frame;
//  - seletor de fontes: busca, aplica Lobster (baixada do Google), lista de pesos certa, <link> no HTML exportado.
// Precisa de INTERNET para os ícones e as fontes (fonts.gstatic.com / fonts.googleapis.com).
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + x)); };
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
p.on('dialog', (d) => { errors.push('diálogo nativo: ' + d.message()); d.dismiss(); });
const ev = (f, a) => p.evaluate(f, a);
await p.goto(new URL('?editor', process.env.APP_URL || 'http://localhost:5173/').href);
await p.waitForTimeout(800);
await ev(() => designer.store.newDoc());

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 150 100">
<title>Teste</title>
<defs><linearGradient id="g"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#ff5ca8"/></linearGradient>
<style>.azul{fill:#06b6d4}</style></defs>
<rect x="5" y="5" width="60" height="40" rx="8" fill="url(#g)"/>
<circle class="azul" cx="100" cy="25" r="20"/>
<g transform="translate(10 55) scale(0.5)"><path fill-rule="evenodd" fill="orange" d="M0 0h80v80H0z M20 20h40v40H20z"/></g>
<text x="80" y="90" font-size="10" fill="#333">Oi</text>
</svg>`;

try {
  // ---------------------------------------------------------------- 1. importar SVG
  const info = await ev((svg) => {
    const g = designer.commands.insertSvg(svg);
    return { type: g.type, name: g.name, w: g.w, h: g.h, kids: g.children.map((c) => ({ t: c.type, fill: c.fill?.type, color: c.fill?.color, contours: c.contours?.length || 0, rule: c.fillRule || '', w: c.w })) };
  }, SVG);
  ok('SVG vira grupo com uma camada por forma', info.type === 'group' && info.kids.length === 4 && info.name === 'Teste', JSON.stringify(info));
  // viewBox 150×100 desenhado em 300×200 = escala 2; as formas vão de x=5 a x=120 → grupo com (120−5)×2 = 230 px
  ok('viewBox respeitado (escala 2×: grupo com 230 px de largura)', Math.abs(info.w - 230) < 1, String(info.w));
  ok('gradiente vira gradiente', info.kids[0].fill === 'linear');
  ok('regra de <style> por classe aplicada', info.kids[1].color === '#06B6D4');
  ok('furo: 2 contornos + evenodd, e o transform scale(0.5) aplicado', info.kids[2].contours === 1 && info.kids[2].rule === 'evenodd' && Math.abs(info.kids[2].w - 80) < 1, JSON.stringify(info.kids[2]));
  ok('texto vira camada de texto editável', info.kids[3].t === 'text');
  ok('vetor importado é desenhado no canvas com o furo', await ev(() => {
    const vec = designer.store.selected()[0].children[2];
    const path = designer.canvas.els.get(vec.id)?.querySelector('path[data-vis]');
    return !!path && (path.getAttribute('d').match(/M/g) || []).length === 2 && path.getAttribute('fill-rule') === 'evenodd';
  }));
  await p.keyboard.press('Control+z');
  ok('Ctrl+Z desfaz a importação inteira', (await ev(() => designer.store.page().children.length)) === 0);
  await p.keyboard.press('Control+Shift+z');

  // ---------------------------------------------------------------- 2. furo sobrevive a salvar/recarregar e ao exportar SVG
  await p.waitForTimeout(700);
  await p.reload();
  await p.waitForTimeout(900);
  const kept = await ev(() => { const v = designer.store.page().children[0].children[2]; return { c: v.contours?.length, r: v.fillRule }; });
  ok('depois de recarregar, os contornos e o evenodd continuam', kept.c === 1 && kept.r === 'evenodd', JSON.stringify(kept));
  const exported = await ev(async () => {
    const { toSvg } = await import('/src/svg.js');
    const g = designer.store.page().children[0];
    return toSvg(g, { boxOf: (c) => designer.commands.localBox(c) });
  });
  ok('SVG exportado leva o furo de volta (fill-rule="evenodd")', /fill-rule="evenodd"/.test(exported));

  // ---------------------------------------------------------------- 3. abrir .svg pelo botão de imagem e colar SVG como texto
  await ev(() => designer.store.newDoc());
  const file = join(tmpdir(), 'estrela-teste.svg');
  writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" fill="gold"/></svg>');
  await p.locator('#toolbar input[type=file]').setInputFiles(file);
  await p.waitForTimeout(600);
  const star = await ev(() => { const n = designer.store.page().children[0]; return n && { t: n.type, name: n.name, pts: n.points?.length, color: n.fill.color }; });
  ok('arquivo .svg entra como VETOR (não como imagem)', star?.t === 'path' && star.pts === 10 && star.color === '#FFD700' && star.name === 'estrela-teste', JSON.stringify(star));
  await ev(() => {
    const dt = new DataTransfer();
    dt.setData('text/plain', '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#22c55e"/></svg>');
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  });
  await p.waitForTimeout(300);
  ok('colar SVG como texto cria vetor (não uma caixa de texto)', await ev(() => { const s = designer.store.selected()[0]; return s?.type === 'path' && s.fill.color === '#22C55E'; }));

  // ---------------------------------------------------------------- 3b. arquivos no formato do Figma e do Illustrator
  // (tests/fixtures/: estrutura igual à que esses programas exportam — clip-path e filtros de sombra do Figma;
  // classes .st0, gradiente fora do <defs>, texto com matrix e fonte "Poppins-Bold" do Illustrator)
  const fx = (f) => readFileSync(fileURLToPath(new URL(`../fixtures/${f}`, import.meta.url)), 'utf8');
  const fig = await ev(async (svg) => {
    const { importSvg } = await import('/src/svgimport.js');
    const { node, ignored } = importSvg(svg);
    const k = node.children;
    return { n: k.length, w: node.w, h: node.h, shadows: k[1].shadows, hole: k[3].contours?.length === 1 && k[3].fillRule === 'evenodd', ring: k[4].fill.type === 'none' && k[4].stroke?.width === 4, dash: k[5].stroke?.style, ignored };
  }, fx('figma-export.svg'));
  ok('Figma: 6 formas no tamanho do frame (360×200)', fig.n === 6 && fig.w === 360 && fig.h === 200, JSON.stringify(fig));
  ok('Figma: as 2 sombras do filtro viram sombras de verdade (roxa 40% e preta 15% com spread)',
    fig.shadows?.length === 2 && fig.shadows[0].color === '#7C5CFF' && fig.shadows[0].opacity === 0.4 && fig.shadows[0].y === 4 && fig.shadows[1].spread === 2, JSON.stringify(fig.shadows));
  ok('Figma: furo (clip-rule evenodd), círculo só com contorno (fill="none" herdado da raiz) e linha tracejada', fig.hole && fig.ring && fig.dash === 'dashed');
  ok('Figma: só a sombra INTERNA fica de fora, e o aviso diz isso', fig.ignored.join() === 'sombra interna', fig.ignored.join());
  const ai = await ev(async (svg) => {
    const { importSvg } = await import('/src/svgimport.js');
    const { node, ignored } = importSvg(svg);
    const k = node.children;
    return { n: k.length, bg: k[0].fill.color, grad: k[1].fill.type, angle: k[1].fill.angle, line: [k[2].fill.type, k[2].stroke?.color, k[2].stroke?.width], text: [k[3].type, k[3].text, k[3].fontFamily, k[3].fontWeight, k[3].fill.color], ignored };
  }, fx('illustrator-export.svg'));
  ok('Illustrator: classes .st0/.st1/.st3 aplicadas', ai.n === 5 && ai.bg === '#2B1A6B' && ai.line.join() === 'none,#FF5CA8,6', JSON.stringify(ai));
  ok('Illustrator: gradiente declarado fora do <defs> (userSpaceOnUse) vira gradiente horizontal', ai.grad === 'linear' && ai.angle === 90, JSON.stringify(ai));
  ok('Illustrator: texto com matrix e fonte "Poppins-Bold" → texto Poppins 700 branco', ai.text.join() === 'text,Olá,Poppins,700,#FFFFFF', ai.text.join());
  ok('Illustrator: nada ficou de fora', ai.ignored.length === 0, ai.ignored.join());

  // ---------------------------------------------------------------- 4. painel Ícones
  const frameId = await ev(async () => {
    const { createNode } = await import('/src/model.js');
    const f = createNode('frame', { name: 'Card', x: 400, y: 0, w: 200, h: 200 });
    designer.store.update((pg) => pg.children.push(f), { commit: true });
    designer.store.setSelection([f.id]);
    return f.id;
  });
  await p.click('#left .tab:has-text("Ícones")');
  await p.waitForSelector('.gicon');
  ok('painel Ícones lista milhares de ícones', (await p.locator('.gicon-panel .hint').first().innerText()).includes('4'));
  await p.fill('.gicon-search input', 'carrinho');
  await p.waitForTimeout(300);
  ok('busca em português ("carrinho") encontra shopping_cart', (await p.locator('.gicon').first().getAttribute('data-tip-title')) === 'shopping cart');
  await p.locator('.icon-color').evaluate((el) => { el.value = '#ff0066'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.fill('.gicon-options input[type=number]', '64');
  await p.locator('.gicon-options input[type=number]').dispatchEvent('change');
  await p.locator('.gicon').first().click();
  await p.waitForTimeout(2500); // baixa o SVG do Google
  const icon = await ev((fid) => { const s = designer.store.selected()[0]; return s && { t: s.type, name: s.name, color: s.fill.color, w: s.w, h: s.h, parent: designer.store.parentOf(s.id)?.id === fid }; }, frameId);
  ok('ícone inserido como vetor, na cor escolhida', icon?.t === 'path' && icon.name === 'shopping_cart' && icon.color === '#FF0066', JSON.stringify(icon));
  ok('no tamanho escolhido (grade de 64px)', icon && Math.max(icon.w, icon.h) <= 64 && Math.max(icon.w, icon.h) > 40, JSON.stringify(icon));
  ok('dentro do frame selecionado', icon?.parent === true);

  // ---------------------------------------------------------------- 5. Google Fonts
  await ev(async () => {
    const { createNode } = await import('/src/model.js');
    const t = createNode('text', { name: 'Título', text: 'Olá fontes', x: 0, y: 300, fontSize: 32, fontWeight: 700 });
    designer.store.update((pg) => pg.children.push(t), { commit: true });
    designer.store.setSelection([t.id]);
  });
  await p.waitForTimeout(300);
  await p.click('.font-field');
  await p.waitForSelector('.font-picker');
  ok('seletor de fontes abre com busca e categorias', (await p.locator('.font-cats .tab-chip').count()) === 6);
  await p.fill('.font-search input', 'lobs');
  await p.waitForTimeout(300);
  ok('busca encontra Lobster', (await p.locator('.font-row').first().getAttribute('data-font')) === 'Lobster');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(3000);
  const t = await ev(() => { const s = designer.store.selected()[0]; return { f: s.fontFamily, w: s.fontWeight }; });
  ok('Enter aplica a fonte e ajusta o peso para um que ela tem (700 → 400)', t.f === 'Lobster' && t.w === 400, JSON.stringify(t));
  ok('fonte baixada do Google e pronta', await ev(() => document.fonts.check("32px 'Lobster'")));
  ok('lista de pesos mostra só os da fonte', (await p.locator('#right select[aria-label="font-weight"] option').allInnerTexts()).join() === 'Regular (400)');
  ok('canvas desenha o texto em Lobster', await ev(() => getComputedStyle(designer.canvas.els.get(designer.store.selected()[0].id)).fontFamily.includes('Lobster')));
  const html = await ev(async () => { const { exportHtml } = await import('/src/css.js'); return exportHtml(designer.store.selected()[0], {}); });
  ok('HTML exportado leva o <link> do Google Fonts', html.includes('https://fonts.googleapis.com/css2?family=Lobster'));
  await p.click('.font-field');
  await p.locator('.font-cats .tab-chip', { hasText: 'Mono' }).click();
  await p.waitForTimeout(200);
  ok('filtro por categoria (Mono)', await p.locator('.font-row .font-cat').evaluateAll((els) => els.length > 0 && els.every((e) => e.textContent === 'mono')));
  await p.keyboard.press('Escape');
  ok('Esc fecha o seletor', (await p.locator('.font-picker').count()) === 0);
} catch (err) {
  ok('cenário terminou sem exceção', false, err.stack);
}
await b.close();
console.log(errors.join('\n') || 'sem erros no console');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exitCode = fails || errors.length ? 1 : 0;
