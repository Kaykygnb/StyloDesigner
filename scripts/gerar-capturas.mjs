/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  scripts/gerar-capturas.mjs — GERA AS CAPTURAS DE TELA DO README (docs/screenshots/*.png)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Abre o app num navegador de verdade (Playwright), monta cada cena (carrega um exemplo, seleciona uma camada,
 *  abre a aba certa, rola o painel) e tira a foto. Rode de novo sempre que o visual do app mudar.
 *
 *  Como usar (precisa do Playwright, dependência de desenvolvimento):
 *    npm install && npx playwright install chromium
 *    npm start                              # em outro terminal
 *    node scripts/gerar-capturas.mjs
 *
 *  Variáveis opcionais: APP_URL (padrão http://localhost:5173/) e CHROMIUM_PATH (se já tiver um Chromium instalado).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = fileURLToPath(new URL('../docs/screenshots', import.meta.url));
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 1600, height: 960 } });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
await p.goto(new URL('?editor', process.env.APP_URL || 'http://localhost:5173/').href); await p.waitForTimeout(700);
const ev = (f, a) => p.evaluate(f, a);
const loadApp = async () => { await ev(async () => { const { buildSampleApp } = await import('/src/sample.js'); designer.store.setTheme('dark'); designer.store.loadDoc(buildSampleApp()); designer.store.ui.rightTab; }); await p.waitForTimeout(250); await ev(() => designer.canvas.fit(null)); };
const loadLanding = async () => { await ev(() => { designer.store.setTheme('dark'); designer.store.loadSample(); }); await p.waitForTimeout(250); await ev(() => designer.canvas.fit(null)); };
const find = (name) => ev((name) => { let id; const w = (l) => l.forEach(n => { if (n.name === name && !id) id = n.id; n.children && w(n.children); }); w(designer.store.page().children); return id; }, name);
const select = async (name, { fitSel = false, pad = 160, maxZoom = 1.2 } = {}) => { const id = await find(name); await ev(({ id, fitSel, pad, maxZoom }) => { designer.store.setSelection([id]); if (fitSel) designer.canvas.fit([id], { padding: pad, maxZoom }); }, { id, fitSel, pad, maxZoom }); await p.waitForTimeout(250); return id; };
const rightTab = async (t) => { await p.click(`#right .tab:has-text("${t}")`); await p.waitForTimeout(200); };
const leftTab = async (t) => { await p.click(`#left .tab:has-text("${t}")`); await p.waitForTimeout(200); };
const scrollPanel = async (title) => { await ev((title) => { const panel = document.querySelector('#right'); const head = [...document.querySelectorAll('#right .section-head')].find(h => h.textContent.trim().startsWith(title)); if (head) { const sec = head.closest('section'); panel.scrollTop += sec.getBoundingClientRect().top - panel.getBoundingClientRect().top - 100; } }, title); await p.waitForTimeout(150); };
const shot = async (name) => { await p.mouse.move(800, 940); await p.waitForTimeout(150); await p.screenshot({ path: `${OUT}/${name}.png` }); console.log('✓', name); };

// 01 — visão geral (app mobile, cartão de saldo selecionado)
await loadApp(); await rightTab('Design'); await leftTab('Camadas');
await select('Cartão de saldo'); await shot('01-visao-geral');

// 02 — auto layout flexbox (landing, frame "Cartões")
await loadLanding(); await select('Cartões', { fitSel: true, pad: 300, maxZoom: 1.0 }); await scrollPanel('Auto layout'); await shot('02-auto-layout-flexbox');

// 03 — CSS Grid (app, "Ações rápidas")
await loadApp(); await select('Ações rápidas', { fitSel: true, pad: 330, maxZoom: 1.0 }); await scrollPanel('Auto layout'); await shot('03-css-grid');

// 04 — componentes e estilos (aba Recursos + instância selecionada)
await loadApp();
await ev(() => { const s = designer.store; let n; const w = (l) => l.forEach(x => { if (x.name === 'Valor' && !n) n = x; x.children && w(x.children); }); w(s.page().children); });
await select('Ação Pagar', { fitSel: true, pad: 330, maxZoom: 1.0 }); await leftTab('Recursos'); await scrollPanel('Componente'); await shot('04-componentes');
await leftTab('Camadas');

// 05 — aba Código (CSS real do cartão de saldo)
await loadApp(); await select('Cartão de saldo', { fitSel: true, pad: 330, maxZoom: 1.0 }); await rightTab('Código'); await shot('05-codigo-css');
await rightTab('Design');

// 06 — protótipo (interação + seta de fluxo)
await loadApp(); await select('Ação Enviar'); await rightTab('Protótipo'); await shot('06-prototipo'); await rightTab('Design');

// 07 — modo apresentar
await loadApp(); const homeId = await find('Home'); await ev((id) => designer.store.setSelection([id]), homeId);
await p.click('.topbar .btn.primary'); await p.waitForTimeout(500);
await ev(() => { document.querySelector('.present-bar').style.opacity = 1; });
await p.screenshot({ path: `${OUT}/07-apresentar.png` }); console.log('✓ 07-apresentar');
await p.keyboard.press('Escape'); await p.waitForTimeout(200);

// 08 — vetores: caneta e edição de pontos (coração com curvas de Bézier)
await ev(async () => { const m = await import('/src/model.js'); const s = designer.store; s.newDoc(); });
await p.waitForTimeout(250);
await ev(async () => {
  const m = await import('/src/model.js'); const s = designer.store; const c = designer.commands;
  const f = m.createNode('frame', { name: 'Ilustração', x: 0, y: 0, w: 560, h: 420, fill: { ...m.defaultFill('#FFF4F8') } });
  s.update((pg) => pg.children.push(f), { commit: true });
  // coração: curva paramétrica clássica amostrada em 12 pontos; alças suaves (Catmull-Rom → Bézier). O ponto do "vale" (t=0) é de canto.
  const N = 12; const raw = [];
  for (let i = 0; i < N; i++) { const t = (2 * Math.PI * i) / N; raw.push({ x: 280 + 16 * Math.sin(t) ** 3 * 10, y: 215 - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 10 }); }
  const pts = raw.map((p, i) => { const a = raw[(i - 1 + N) % N], n = raw[(i + 1) % N]; const vx = (n.x - a.x) / 6, vy = (n.y - a.y) / 6; return i === 0 ? { x: p.x, y: p.y, hin: null, hout: null } : { x: p.x, y: p.y, hin: { x: p.x - vx, y: p.y - vy }, hout: { x: p.x + vx, y: p.y + vy } }; });
  const node = c.addPathFromWorld(pts, true, f);
  s.update(() => { node.fill = { ...m.defaultFill('#FF4D8D') }; node.stroke = { ...m.defaultStroke(), color: '#B3124F', width: 4, position: 'center' }; node.name = 'Coração'; }, { commit: true });
  designer.canvas.fit([f.id], { padding: 120, maxZoom: 1.4 });
  designer.tools.pen.startEdit(node.id);
  s.ui.editPt = 3; s.emit('overlay');
});
await p.waitForTimeout(300); await shot('08-vetores-caneta');
await p.keyboard.press('Escape');

// 09 — medidas com Alt: uma ação dentro do grid "Ações rápidas" → mostra as 4 margens internas
await loadApp(); await select('Ação Pagar', { fitSel: true, pad: 330, maxZoom: 1.0 });
await ev(() => { const s = designer.store; let id; const w = (l) => l.forEach(x => { if (x.name === 'Ações rápidas' && !id) id = x.id; x.children && w(x.children); }); w(s.page().children); s.ui.hoverId = id; s.ui.altDown = true; s.emit('overlay'); });
await p.waitForTimeout(200); await p.screenshot({ path: `${OUT}/09-medidas-alt.png` }); console.log('✓ 09-medidas-alt');
await ev(() => { designer.store.ui.altDown = false; designer.store.ui.hoverId = null; designer.store.emit('overlay'); });

// 10 — réguas, guias e grade de colunas
await loadApp();
await ev(() => { const s = designer.store; const home = s.page().children.find(n => n.name === 'Home'); s.update(() => { home.grids = [{ type: 'columns', count: 4, gutter: 12, margin: 20, size: 8, color: '#FF3D6E', opacity: 0.14 }]; }, { commit: true }); designer.commands.addGuide('x', 195); designer.commands.addGuide('y', 360); s.setSelection([home.id]); designer.canvas.fit([home.id], { padding: 140, maxZoom: 1.0 }); });
await p.waitForTimeout(300); await shot('10-reguas-guias-grades');

// 11 — tema claro
await loadLanding(); await ev(() => designer.store.setTheme('light')); await select('Hero'); await p.waitForTimeout(200); await shot('11-tema-claro');
await ev(() => designer.store.setTheme('dark'));

// 12 — efeito vidro (backdrop-filter)
await loadLanding(); await select('Glass card', { fitSel: true, pad: 220, maxZoom: 1.6 });
await select('Painel vidro'); await scrollPanel('Efeitos'); await shot('12-efeito-vidro');

// 16 — painel de ícones do Google (busca em português) com um ícone já inserido no app
await loadApp(); await select('Cabeçalho', { fitSel: true, pad: 260, maxZoom: 1.4 });
await leftTab('Ícones'); await p.waitForSelector('.gicon img');
await p.fill('.gicon-search input', 'seta'); await p.waitForTimeout(1800);
await shot('16-icones-google');
await p.fill('.gicon-search input', ''); await leftTab('Camadas');

// 17 — seletor de fontes do Google (categoria Manuscrita, com prévia de cada fonte)
await loadApp(); await select('Título', { fitSel: true, pad: 260, maxZoom: 1.4 });
await p.click('.font-field'); await p.waitForSelector('.font-picker');
await p.locator('.font-cats .tab-chip', { hasText: 'Manuscrita' }).click(); await p.waitForTimeout(2500);
await shot('17-google-fonts');
await p.keyboard.press('Escape');

// 13, 14 e 15 — salvamento na pasta e página inicial. Usa uma pasta TEMPORÁRIA; os projetos são salvos pelo próprio
// app (assim as miniaturas da página inicial são as de verdade). No fim devolve a configuração original do servidor.
const api = (path, method = 'GET', body) => ev(async ({ path, method, body }) => (await fetch('/api' + path, {
  method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body && JSON.stringify(body),
})).json(), { path, method, body });
const original = await api('/status');
const demo = join(tmpdir(), 'Meus projetos Designer');
rmSync(demo, { recursive: true, force: true });
await api('/config', 'PUT', { folder: demo });
const saveAs = async (name) => { await ev(() => designer.canvas.fit(null)); await ev((n) => designer.saving.saveAs(n), name); await p.waitForTimeout(1500); };
await loadLanding(); await ev(() => { designer.store.state.doc.name = 'Landing Aurora'; designer.store.commit(); }); await saveAs('landing-aurora');
await loadApp(); await ev(() => { designer.store.state.doc.name = 'Carteira (rascunho)'; designer.store.commit(); }); await saveAs('carteira-app');
// uma edição depois de salvar: o servidor guarda a versão anterior (aparece em "Versões")
await ev(() => { designer.store.state.doc.name = 'Carteira digital'; designer.store.commit(); }); await p.waitForTimeout(1200);
await select('Cartão de saldo');
await p.keyboard.press('Control+,'); await p.waitForSelector('.set-status'); await p.waitForTimeout(200);
await shot('13-configuracoes-salvamento');
await p.keyboard.press('Escape');
await p.keyboard.press('Control+o'); await p.waitForSelector('.proj-row');
await p.locator('.proj-row', { hasText: 'carteira-app' }).getByRole('button', { name: 'Versões' }).click();
await p.waitForSelector('.proj-version'); await p.waitForTimeout(200);
await shot('14-projetos-na-pasta');
await p.keyboard.press('Escape');
await ev(() => designer.store.setSelection([]));
await ev(() => designer.home.open()); await p.waitForSelector('.home-card:not(.sample) img'); await p.waitForTimeout(600);
await ev(() => document.activeElement?.blur());
await shot('15-pagina-inicial');
await ev(() => designer.home.close());
await ev(() => designer.store.setLink(null));
await api('/config', 'PUT', { folder: original.folder });
rmSync(demo, { recursive: true, force: true });

console.log(errors.join('\n') || 'sem erros no navegador');
await b.close();
