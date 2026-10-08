// FIDELIDADE da exportação: a promessa do projeto é "o que você vê no editor é o que o CSS faz". Este teste exporta
// cada tela do projeto base (Vitrine completa), abre o HTML exportado como um site de verdade e compara a posição e o
// tamanho de CADA camada com o que o editor mostra, no Desktop, no Tablet e no Celular.
//
// Por que é necessário: o editor monta os elementos pelo JavaScript (sempre <div>), mas o arquivo exportado é LIDO
// pelo navegador como texto HTML, com etiquetas de verdade (<ul>, <li>, <a>, <button>...). Essa leitura tem regras
// próprias (um <li> dentro de outro <li> é fechado sozinho, por exemplo) e cada etiqueta tem estilos padrão do
// navegador (links sublinhados, botão com borda, lista com recuo). Qualquer diferença assim aparece aqui.
import { chromium } from 'playwright';

const BASE = process.env.APP_URL || 'http://localhost:5173/';
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + x)); };
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('dialog', (d) => { errors.push('diálogo nativo: ' + d.message()); d.dismiss(); });
const ev = (f, a) => p.evaluate(f, a);
/** Tolerância em px: arredondamento de sub-pixel entre o editor (com zoom) e a página exportada. */
const TOL = 1.5;

/**
 * Caixa de cada camada visível (relativa ao canto da tela raiz), medida no DOM. `attr` = como achar o elemento de
 * cada camada: no editor pelo mapa do canvas, no exportado pelo atributo data-node-id.
 */
const MEASURE = `(rootEl, els, zoom) => {
  const r0 = rootEl.getBoundingClientRect();
  const out = {};
  for (const [id, el] of els) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue; // escondida (display:none)
    out[id] = { x: (r.left - r0.left) / zoom, y: (r.top - r0.top) / zoom, w: r.width / zoom, h: r.height / zoom };
  }
  return out;
}`;

/**
 * Compara cada tela de `screens` (editor × HTML exportado) no Desktop, Tablet e Celular.
 * @param {string} title  nome do cenário (aparece nas mensagens)
 */
async function compareScreens(title, screens) {
  for (const bp of [null, 'tablet', 'mobile']) {
    // Tablet/Celular: como o botão "Telas em 768px/390px" da barra, põe cada tela na largura típica do modo. Assim o
    // editor mostra a tela na largura em que o @media do arquivo exportado vale de verdade.
    if (bp) {
      await ev(async (bp) => {
        const { BREAKPOINTS, editBp } = await import('/src/model.js');
        const s = designer.store, b = BREAKPOINTS.find((x) => x.id === bp);
        s.update(() => s.state.doc.pages.forEach((pg) => pg.children.forEach((n) => {
          const frames = n.type === 'frame' ? [n] : n.type === 'section' ? n.children.filter((c) => c.type === 'frame') : [];
          frames.forEach((f) => editBp(f, bp, (d) => { d.w = b.preview; d.sizeX = 'fixed'; }));
        })), { commit: true });
      }, bp);
    }
    for (const sc of screens) {
      // ---- editor: escolhe a largura, zoom 100% e mede cada camada da tela
      const ed = await ev(async ({ sc, bp, MEASURE }) => {
        const s = designer.store;
        if (s.ui.pageId !== sc.page) s.switchPage(sc.page);
        s.setBp(bp);
        s.emit('doc');
        designer.canvas.fit([sc.id], { padding: 20, maxZoom: 1 });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await document.fonts.ready;
        const zoom = designer.canvas.getView().zoom;
        const root = designer.canvas.els.get(sc.id);
        const els = [...designer.canvas.els].filter(([, el]) => el.isConnected && root.contains(el));
        return { boxes: eval(MEASURE)(root, els, zoom), width: root.getBoundingClientRect().width / zoom };
      }, { sc, bp, MEASURE });

      // ---- exportado: gera o HTML (com os ids das camadas) e abre numa janela da largura da tela
      const html = await ev(async (id) => {
        const { exportHtml } = await import('/src/css.js');
        const s = designer.store;
        return exportHtml(s.get(id), s.state.doc.assets, 'teste', s.state.doc.styles, { ids: true });
      }, sc.id);
      const width = Math.round(ed.width) + 48; // o <body> do arquivo exportado tem 24px de margem de cada lado
      const q = await (await b.newContext({ viewport: { width, height: 900 } })).newPage();
      q.on('pageerror', (e) => errors.push('exportado: ' + e.message));
      await q.setContent(html, { waitUntil: 'load' });
      await q.evaluate(() => document.fonts.ready);
      const ex = await q.evaluate(({ id, MEASURE }) => {
        const els = [...document.querySelectorAll('[data-node-id]')].map((el) => [el.dataset.nodeId, el]);
        return eval(MEASURE)(document.querySelector(`[data-node-id="${CSS.escape(id)}"]`), els, 1);
      }, { id: sc.id, MEASURE });
      await q.close();

      // ---- compara camada por camada
      const label = `${title} · ${sc.name} · ${bp || 'desktop'} (${width - 48}px)`;
      const names = await ev((ids) => Object.fromEntries(ids.map((id) => [id, designer.store.get(id)?.name || id])), Object.keys(ed.boxes));
      const missing = Object.keys(ed.boxes).filter((id) => !ex[id]);
      const diffs = [];
      for (const [id, a] of Object.entries(ed.boxes)) {
        const e = ex[id];
        if (!e) continue;
        const d = Math.max(Math.abs(a.x - e.x), Math.abs(a.y - e.y), Math.abs(a.w - e.w), Math.abs(a.h - e.h));
        if (d > TOL) diffs.push({ name: names[id], d: Math.round(d), editor: [a.x, a.y, a.w, a.h].map(Math.round), html: [e.x, e.y, e.w, e.h].map(Math.round) });
      }
      diffs.sort((x, y) => y.d - x.d);
      ok(`${label}: todas as camadas existem no HTML (${Object.keys(ed.boxes).length})`, !missing.length, missing.map((id) => names[id]).join(', '));
      ok(`${label}: posição e tamanho iguais ao editor (±${TOL}px)`, !diffs.length,
        `${diffs.length} diferentes; maiores: ` + diffs.slice(0, 5).map((x) => `"${x.name}" editor ${x.editor} × html ${x.html}`).join(' | '));
    }
  }
  await ev(() => designer.store.setBp(null));
}

/** Telas de um documento = frames na raiz de cada página ou dentro de uma seção da raiz. */
const screensOf = () => ev(() => {
  const out = [];
  for (const pg of designer.store.state.doc.pages) {
    for (const n of pg.children) {
      if (n.type === 'frame' && n.visible) out.push({ page: pg.id, id: n.id, name: n.name });
      if (n.type === 'section') for (const c of n.children) if (c.type === 'frame' && c.visible) out.push({ page: pg.id, id: c.id, name: c.name });
    }
  }
  return out;
});

try {
  await p.goto(new URL('?editor', BASE).href);
  await p.waitForTimeout(800);

  // ---------------------------------------------------------------- 1. o projeto base inteiro
  await ev(async () => {
    const { buildSampleShowcase } = await import('/src/sample-vitrine.js');
    designer.store.loadDoc(buildSampleShowcase(), { pristine: true });
  });
  const screens = await screensOf();
  ok('projeto base tem telas para comparar', screens.length >= 2, JSON.stringify(screens));
  await compareScreens('Vitrine', screens);

  // ---------------------------------------------------------------- 2. etiquetas "erradas" de propósito
  // Um card <li> com itens <li> direto dentro (sem <ul>), um link dentro de outro link, botões com e sem auto layout
  // e texto como <h1>/<a>/<span>/<label>. O gerador precisa se defender sozinho: o HTML exportado não pode desmontar.
  await ev(async () => {
    const { createNode, makeDoc, defaultFill } = await import('/src/model.js');
    const T = (text, tag, extra = {}) => createNode('text', { text, tag, fontSize: 16, sizeX: 'hug', sizeY: 'hug', ...extra });
    const F = (name, tag, extra = {}) => createNode('frame', { name, tag, fill: { ...defaultFill('#EEEEF5') }, clip: false, sizeX: 'hug', sizeY: 'hug', ...extra });
    const flex = (mode, gap = 8, padding = [12, 12, 12, 12]) => ({ mode, gap, padding, justify: 'flex-start', align: 'flex-start', wrap: false });
    const root = F('Tela', 'main', { x: 0, y: 0, w: 600, h: 500, sizeX: 'fixed', sizeY: 'hug', layout: flex('column', 16, [24, 24, 24, 24]) });
    const card = F('Card li', 'li', { layout: flex('column') });
    card.children.push(T('Título', 'h1', { fontSize: 28, fontWeight: 800 }));
    for (let i = 0; i < 3; i++) {
      const it = F('Item li', 'li', { layout: flex('row', 6, [4, 4, 4, 4]) });
      it.children.push(T('Item ' + (i + 1), 'span'));
      card.children.push(it);
    }
    const link = F('Link externo', 'a', { layout: flex('row') });
    const inner = F('Link de dentro', 'a', { layout: flex('row') });
    inner.children.push(T('link dentro de link', 'span'));
    link.children.push(T('Ver mais', 'label'), inner);
    const btn = F('Botão flex', 'button', { layout: flex('row', 8, [10, 18, 10, 18]) });
    btn.children.push(T('Comprar', 'a'));
    const btnFree = F('Botão livre', 'button', { w: 160, h: 48, sizeX: 'fixed', sizeY: 'fixed' });
    btnFree.children.push(T('Sem layout', 'span', { x: 10, y: 12 }));
    root.children.push(card, link, btn, btnFree);
    const doc = makeDoc();
    doc.pages[0].children.push(root);
    designer.store.loadDoc(doc, { pristine: true });
  });
  await compareScreens('Etiquetas erradas', await screensOf());
  // o painel avisa por que a etiqueta escolhida não vale ali (em vez de trocar escondido)
  await ev(() => { const s = designer.store; let id; const w = (l) => l.forEach((n) => { if (n.name === 'Item li' && !id) id = n.id; n.children && w(n.children); }); w(s.page().children); s.setSelection([id]); });
  await p.waitForTimeout(300);
  const warn = await p.locator('.hint.warn').allTextContents();
  ok('painel avisa: "<li> fora de lista vira <div>"', warn.some((t) => t.includes('vira <div>') && t.includes('<ul>')), JSON.stringify(warn));
} catch (err) {
  ok('cenário terminou sem exceção', false, err.stack);
}
await b.close();
console.log(errors.join('\n') || 'sem erros no console');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exitCode = fails || errors.length ? 1 : 0;
