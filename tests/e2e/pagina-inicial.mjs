// Página inicial e polimentos: abre ao iniciar, bloqueia o editor por trás, miniaturas, busca, renomear, duplicar,
// abrir projetos/exemplos (perguntando só quando algo se perderia), lembrete "só no navegador", Recentes no menu
// Arquivo, janelas do app no lugar de confirm()/prompt() e a preferência "ir direto para o editor".
// Usa uma pasta TEMPORÁRIA e devolve a configuração original no fim.
import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.APP_URL || 'http://localhost:5173/';
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + x)); };
const dir = await mkdtemp(join(tmpdir(), 'designer-home-'));
const api = (path, init) => fetch(new URL('/api' + path, BASE), init).then((r) => r.json());
const original = await api('/status');
await api('/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: dir }) });

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
p.on('dialog', (d) => { errors.push('diálogo nativo do navegador: ' + d.message()); d.dismiss(); });
const ev = (f, a) => p.evaluate(f, a);
const homeOpen = () => ev(() => !!document.querySelector('.home'));
const answerAsk = async (label) => { await p.waitForSelector('.ask-buttons'); await p.locator('.ask-buttons button', { hasText: label }).click(); };
const card = (name) => p.locator('.home-card:not(.sample)', { hasText: name });

try {
  // ---------------------------------------------------------------- 1. abre na página inicial, editor bloqueado
  await p.goto(BASE);
  await p.waitForSelector('.home');
  ok('app abre na página inicial', await homeOpen());
  ok('editor por trás fica inert', await ev(() => document.getElementById('app').inert === true));
  ok('mostra "Continuar", "Na pasta" e exemplos', (await p.locator('.home-section h2').allTextContents()).join('|').includes('Continuar de onde parou')
    && (await p.locator('.home-card.sample').count()) === 2);
  ok('pasta vazia mostra orientação', (await p.locator('.home-empty').innerText()).includes('Ctrl+S'));
  ok('miniatura ao vivo do projeto aberto', (await p.locator('.home-wide img').getAttribute('src') || '').startsWith('data:image/svg+xml'));
  const layersBefore = await ev(() => designer.store.page().children.length);
  await ev(() => designer.store.setSelection(designer.store.page().children.map((n) => n.id)));
  await p.keyboard.press('Delete');
  ok('Delete com a página inicial aberta NÃO apaga camadas do editor', (await ev(() => designer.store.page().children.length)) === layersBefore);
  await p.keyboard.press('Escape');
  ok('Esc volta ao editor', !(await homeOpen()) && (await ev(() => document.getElementById('app').inert)) === false);
  await p.click('.topbar button.brand');
  ok('clicar no logo abre a página inicial', await homeOpen());

  // ---------------------------------------------------------------- 2. abrir exemplo sem pergunta (projeto intocado)
  await p.locator('.home-card.sample', { hasText: 'App mobile' }).click();
  await p.waitForTimeout(500);
  ok('exemplo abre sem perguntar (nada a perder)', !(await homeOpen()) && (await p.locator('.ask-buttons').count()) === 0);
  ok('é o exemplo app mobile', (await ev(() => designer.store.state.doc.name)).includes('App'), await ev(() => designer.store.state.doc.name));

  // ---------------------------------------------------------------- 3. lembrete "só no navegador" depois de algumas edições
  for (let i = 0; i < 12; i++) await ev((i) => { designer.store.state.doc.name = 'Casa teste ' + i; designer.store.commit(); }, i);
  await p.waitForTimeout(200);
  ok('lembrete aparece depois de 12 edições num projeto sem arquivo', (await p.locator('.notice').count()) === 1);
  await p.locator('.notice .btn.primary').click();
  await p.waitForSelector('.proj-save input');
  ok('"Salvar na pasta" do lembrete abre a janela de salvar', (await p.locator('.notice').count()) === 0);
  await p.fill('.proj-save input', 'casa-teste');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1500); // salvar + miniatura (gerada quando o navegador fica ocioso)
  ok('projeto salvo na pasta', existsSync(join(dir, 'casa-teste.json')));
  const list1 = await api('/projects');
  ok('miniatura gerada ao salvar', list1.find((x) => x.file === 'casa-teste.json')?.thumb > 0, JSON.stringify(list1));

  // ---------------------------------------------------------------- 4. página inicial com o projeto: card, busca, renomear, duplicar
  await p.click('.topbar button.brand');
  await p.waitForSelector('.home-card:not(.sample)');
  ok('card do projeto aparece com a miniatura do servidor', (await card('casa-teste').locator('img').getAttribute('src') || '').includes('/thumb'));
  ok('card marca o projeto aberto', (await card('casa-teste').innerText()).includes('aberto'));
  // espera a imagem terminar de carregar (até 5 s: com a máquina ocupada ela pode demorar) e confere se é válida;
  // uma miniatura quebrada dispara 'error' e o teste falha do mesmo jeito
  ok('miniatura carrega de verdade (imagem válida)', await card('casa-teste').locator('img').evaluate((img) => new Promise((done) => {
    if (img.complete) return done(img.naturalWidth > 0);
    img.addEventListener('load', () => done(img.naturalWidth > 0));
    img.addEventListener('error', () => done(false));
    setTimeout(() => done(false), 5000);
  })));
  await p.fill('.home-search input', 'xyz');
  ok('busca sem resultado avisa', (await p.locator('.home-empty').innerText()).includes('Nada encontrado'));
  await p.fill('.home-search input', 'casa');
  ok('busca encontra', (await card('casa-teste').count()) === 1);
  await p.fill('.home-search input', '');
  await card('casa-teste').locator('.home-more').click();
  await p.locator('.menu-item', { hasText: 'Renomear' }).click();
  await p.waitForSelector('.home-rename');
  await p.fill('.home-rename', 'Casa Final');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(700);
  ok('renomear muda o arquivo na pasta', existsSync(join(dir, 'casa-final.json')) && !existsSync(join(dir, 'casa-teste.json')));
  ok('e o editor continua ligado ao arquivo (nome novo)', (await ev(() => designer.store.ui.link?.file)) === 'casa-final.json');
  await card('casa-final').locator('.home-more').click();
  await p.locator('.menu-item', { hasText: 'Duplicar' }).click();
  await p.waitForTimeout(700);
  ok('duplicar cria "-copia"', existsSync(join(dir, 'casa-final-copia.json')));
  ok('cópia já vem com miniatura', (await api('/projects')).find((x) => x.file === 'casa-final-copia.json')?.thumb > 0);
  // abrir a cópia: o atual está salvo na pasta → não pergunta
  await card('casa-final-copia').locator('.home-card-open').click();
  await p.waitForTimeout(700);
  ok('abrir outro projeto com o atual salvo na pasta não pergunta', (await p.locator('.ask-buttons').count()) === 0 && !(await homeOpen()));
  ok('cópia aberta e ligada', (await ev(() => designer.store.ui.link?.file)) === 'casa-final-copia.json');

  // ---------------------------------------------------------------- 5. projeto só no navegador: pergunta antes de trocar
  await p.click('.topbar button.brand');
  await p.locator('.home-actions .btn.primary').click(); // Novo projeto (atual salvo → sem pergunta)
  await p.waitForTimeout(400);
  ok('Novo projeto abre em branco', (await ev(() => designer.store.page().children.length)) === 0 && !(await homeOpen()));
  await ev(() => { designer.store.state.doc.name = 'Rascunho'; designer.store.commit(); });
  await p.click('.topbar button.brand');
  await card('casa-final').first().locator('.home-card-open').click();
  await p.waitForSelector('.ask-buttons');
  ok('trocar um rascunho só do navegador pergunta (no visual do app)', (await p.locator('[role=dialog] h2').innerText()).includes('Abrir'));
  await answerAsk('Cancelar');
  await p.waitForTimeout(300);
  ok('Cancelar mantém o rascunho', (await ev(() => designer.store.state.doc.name)) === 'Rascunho' && (await homeOpen()));
  await p.keyboard.press('Escape');

  // ---------------------------------------------------------------- 6. Recentes no menu Arquivo
  await p.click('.topbar .btn.ghost');
  await p.waitForSelector('.menu');
  const items = await p.locator('.menu').innerText();
  ok('menu Arquivo tem "Página inicial" e "Recentes"', items.includes('Página inicial') && /recentes/i.test(items), items);
  ok('Recentes lista os projetos da pasta', items.includes('casa-final-copia') && items.includes('casa-final'));
  await p.keyboard.press('Escape');

  // ---------------------------------------------------------------- 7. janelas do app no lugar de prompt(): renomear página
  await ev(() => designer.store.addPage());
  await p.locator('.page-row').last().click({ button: 'right' });
  await p.locator('.menu-item', { hasText: 'Renomear' }).click();
  await p.waitForSelector('[role=dialog] input');
  await p.fill('[role=dialog] input', 'Telas');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  ok('renomear página usa a janela do app', (await ev(() => designer.store.page().name)) === 'Telas');

  // ---------------------------------------------------------------- 8. layout: barras flutuantes não se sobrepõem
  const overlap = (a, b) => ev(([a, b]) => {
    const r1 = document.querySelector(a)?.getBoundingClientRect(), r2 = document.querySelector(b)?.getBoundingClientRect();
    if (!r1 || !r2) return false;
    return !(r1.right <= r2.left || r2.right <= r1.left || r1.bottom <= r2.top || r2.bottom <= r1.top);
  }, [a, b]);
  let clash = [];
  for (const w of [1440, 1280, 1100, 1000, 900]) {
    await p.setViewportSize({ width: w, height: 760 });
    await p.waitForTimeout(120);
    if (await overlap('.toolbar', '.zoom-widget')) clash.push(w);
  }
  ok('barra de ferramentas e zoom não se sobrepõem (900–1440 px)', !clash.length, clash.join(','));
  await p.setViewportSize({ width: 1440, height: 900 });

  // codex: a busca da página inicial deve continuar permitindo voltar ao editor com Esc.
  await p.click('.topbar button.brand');
  await p.waitForSelector('.home');
  await p.keyboard.press('/');
  ok('/ foca a busca da página inicial', await p.evaluate(() => document.activeElement === document.querySelector('.home-search input')));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(100);
  ok('Esc volta ao editor mesmo com o foco na busca', !(await homeOpen()));

  // ---------------------------------------------------------------- 9. preferência: ir direto para o editor
  await ev(() => { const k = 'projeto-designer:prefs'; const v = JSON.parse(localStorage.getItem(k) || '{}'); v.startScreen = 'editor'; localStorage.setItem(k, JSON.stringify(v)); });
  await p.reload();
  await p.waitForTimeout(900);
  ok('com "ir direto para o editor", a página inicial não abre', !(await homeOpen()));
} catch (err) {
  ok('cenário terminou sem exceção', false, err.stack);
} finally {
  await fetch(new URL('/api/config', BASE), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: original.folder }) });
  await b.close();
  await rm(dir, { recursive: true, force: true });
}
console.log(errors.join('\n') || 'sem erros no console');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exitCode = fails || errors.length ? 1 : 0;
