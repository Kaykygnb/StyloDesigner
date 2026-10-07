// Salvamento: cópia no navegador (IndexedDB, migração do localStorage, projeto > 5 MB), pasta do computador
// (Configurações, Ctrl+S, auto-salvar, conflito, reabrir, versões, servidor fora do ar) e acessibilidade por teclado
// (menus, janelas, abas, ferramentas). Usa uma pasta TEMPORÁRIA e devolve a configuração original no fim.
import { chromium } from 'playwright';
import { mkdtemp, readFile, rm, writeFile, utimes } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_ = process.env.APP_URL || 'http://localhost:5173/';
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + x)); };
const dir = await mkdtemp(join(tmpdir(), 'designer-e2e-'));
const api = (path, init) => fetch(new URL('/api' + path, URL_), init).then((r) => r.json());
const original = await api('/status');

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
// o app não usa mais confirm()/prompt() do navegador: se algum aparecer, é erro
p.on('dialog', (d) => { errors.push('diálogo nativo do navegador: ' + d.message()); d.dismiss(); });
/** Clica num botão da janela de pergunta do app (ask). */
const answerAsk = async (label) => { await p.waitForSelector('.ask-buttons'); await p.locator('.ask-buttons button', { hasText: label }).click(); };
const state = () => p.locator('.save-state').innerText();
const docName = () => p.evaluate(() => designer.store.state.doc.name);
const rename = (name) => p.evaluate((n) => { designer.store.state.doc.name = n; designer.store.commit(); }, name);
const waitState = async (text, ms = 4000) => {
  for (let t = 0; t < ms; t += 100) { if ((await state()) === text) return true; await p.waitForTimeout(100); }
  return false;
};

try {
  // ---------------------------------------------------------------- 1. migração do localStorage antigo
  await p.goto(new URL('?editor', URL_).href);
  await p.evaluate(() => new Promise((r) => { const q = indexedDB.deleteDatabase('projeto-designer'); q.onsuccess = q.onerror = q.onblocked = r; }));
  await p.evaluate(() => localStorage.setItem('projeto-designer:v1', JSON.stringify({
    doc: { name: 'Projeto migrado', pages: [{ id: 'pg', name: 'Página 1', children: [] }], assets: {} }, theme: 'light',
  })));
  await p.reload();
  await p.waitForTimeout(1200);
  ok('projeto antigo do localStorage é aberto', (await docName()) === 'Projeto migrado', await docName());
  ok('tema antigo também vem junto', (await p.evaluate(() => document.documentElement.dataset.theme)) === 'light');
  ok('cópia antiga do localStorage é apagada depois de migrar', await p.evaluate(() => localStorage.getItem('projeto-designer:v1') === null));
  await p.reload();
  await p.waitForTimeout(600);
  ok('depois da migração, o projeto vem do IndexedDB', (await docName()) === 'Projeto migrado');

  // ---------------------------------------------------------------- 2. projeto maior que 5 MB (estourava o localStorage)
  await p.evaluate(() => { designer.store.addAsset('grande', 'data:image/png;base64,' + 'A'.repeat(8 * 1024 * 1024)); designer.store.commit(); });
  ok('projeto de 8 MB salva sem erro', await waitState('Salvo no navegador', 8000), await state());
  await p.reload();
  await p.waitForTimeout(800);
  ok('e volta inteiro depois de recarregar', await p.evaluate(() => (designer.store.state.doc.assets.grande || '').length > 8e6));
  await p.evaluate(() => { delete designer.store.state.doc.assets.grande; designer.store.commit(); });
  await waitState('Salvo no navegador');

  // ---------------------------------------------------------------- 3. Configurações: escolher a pasta
  await p.keyboard.press('Control+,');
  await p.waitForSelector('[role=dialog] .set-path input');
  ok('Ctrl+, abre Configurações como diálogo acessível', await p.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    return d.getAttribute('aria-modal') === 'true' && document.getElementById(d.getAttribute('aria-labelledby'))?.textContent === 'Configurações';
  }));
  ok('mostra "servidor conectado"', (await p.locator('.set-status.on').count()) === 1);
  await p.fill('.set-path input', 'pasta/relativa');
  await p.click('text=Usar esta pasta');
  await p.waitForTimeout(400);
  ok('caminho relativo mostra erro na própria janela', /caminho completo/i.test(await p.locator('.set-msg').innerText()));
  await p.fill('.set-path input', dir);
  await p.click('text=Usar esta pasta');
  await p.waitForTimeout(600);
  ok('pasta nova aplicada', (await api('/status')).folder === dir);
  await p.keyboard.press('Escape');
  ok('Esc fecha a janela', (await p.locator('[role=dialog]').count()) === 0);

  // ---------------------------------------------------------------- 4. Ctrl+S na 1ª vez pede o nome; depois auto-salva na pasta
  await rename('Teste E2E');
  await p.keyboard.press('Control+s');
  await p.waitForSelector('.proj-save input');
  ok('Ctrl+S sem arquivo abre "Salvar na pasta" com o nome sugerido', (await p.inputValue('.proj-save input')) === 'teste-e2e');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(800);
  const file = join(dir, 'teste-e2e.json');
  ok('arquivo criado na pasta', existsSync(file));
  ok('indicador mostra "Salvo na pasta"', await waitState('Salvo na pasta'), await state());
  await rename('Renomeado');
  await waitState('Salvo na pasta');
  await p.waitForTimeout(300);
  ok('auto-salvar grava a mudança no arquivo', JSON.parse(await readFile(file, 'utf8')).name === 'Renomeado');

  // ---------------------------------------------------------------- 5. recarregar mantém o vínculo (sem conflito falso)
  await p.reload();
  await p.waitForTimeout(800);
  await rename('Depois de recarregar');
  ok('depois de recarregar continua gravando na pasta', await waitState('Salvo na pasta'), await state());
  await p.waitForTimeout(300);
  ok('conteúdo novo no arquivo', JSON.parse(await readFile(file, 'utf8')).name === 'Depois de recarregar');

  // ---------------------------------------------------------------- 6. conflito: outro programa mexe no arquivo
  const external = { name: 'Editado por fora', pages: [{ id: 'x', name: 'P', children: [] }], assets: {} };
  await writeFile(file, JSON.stringify(external));
  const later = new Date(Date.now() + 5000);
  await utimes(file, later, later);
  await rename('Minha mudança');
  ok('editor percebe o conflito', await waitState('Conflito no arquivo'), await state());
  ok('e NÃO sobrescreve o arquivo alheio', JSON.parse(await readFile(file, 'utf8')).name === 'Editado por fora');
  await p.keyboard.press('Control+s');
  await answerAsk('Substituir o arquivo');
  await p.waitForTimeout(800);
  ok('Ctrl+S + confirmar substitui o arquivo', JSON.parse(await readFile(file, 'utf8')).name === 'Minha mudança');
  ok('indicador volta a "Salvo na pasta"', await waitState('Salvo na pasta'), await state());

  // ---------------------------------------------------------------- 7. Salvar como + abrir da pasta + versões
  await p.keyboard.press('Control+Shift+s');
  await p.waitForSelector('.proj-save input');
  await p.fill('.proj-save input', 'Outro Projeto!');
  await p.click('.proj-save .btn.primary');
  await p.waitForTimeout(800);
  ok('"Salvar como" cria outro arquivo com nome seguro', existsSync(join(dir, 'outro-projeto.json')));
  ok('e o editor passa a usar o arquivo novo', (await p.evaluate(() => designer.store.ui.link?.file)) === 'outro-projeto.json');
  await p.keyboard.press('Control+o');
  await p.waitForSelector('.proj-row');
  const rows = await p.locator('.proj-row strong').allInnerTexts();
  ok('Ctrl+O lista os projetos da pasta', rows.includes('teste-e2e') && rows.includes('outro-projeto'), rows.join(','));
  await p.locator('.proj-row', { hasText: 'teste-e2e' }).getByRole('button', { name: 'Abrir', exact: true }).click();
  await p.waitForTimeout(800);
  ok('abre o projeto escolhido', (await docName()) === 'Minha mudança' && (await p.evaluate(() => designer.store.ui.link?.file)) === 'teste-e2e.json');
  const versions = await api('/projects/teste-e2e.json/versions');
  ok('servidor guardou versão antiga', versions.length >= 1, String(versions.length));
  await p.keyboard.press('Control+o');
  await p.waitForSelector('.proj-row');
  await p.locator('.proj-row', { hasText: 'teste-e2e' }).getByRole('button', { name: 'Versões' }).click();
  await p.waitForSelector('.proj-version');
  await p.locator('.proj-version button').first().click();
  await p.waitForTimeout(800);
  ok('versão antiga abre solta (sem arquivo ligado)', (await p.evaluate(() => designer.store.ui.link)) === null && (await waitState('Salvo no navegador')));

  // ---------------------------------------------------------------- 8. servidor fora do ar
  await p.keyboard.press('Control+o');
  await p.waitForSelector('.proj-row');
  await p.locator('.proj-row', { hasText: 'outro-projeto' }).getByRole('button', { name: 'Abrir', exact: true }).click();
  // a versão aberta só existe no navegador: trocar de projeto PERGUNTA antes (senão ela se perderia)
  await p.waitForSelector('.ask-buttons');
  ok('trocar um projeto que só está no navegador pede confirmação', (await p.locator('.ask-buttons').count()) === 1);
  await answerAsk('Descartar e continuar');
  await p.waitForTimeout(800);
  ok('e depois de confirmar abre o outro', (await p.evaluate(() => designer.store.ui.link?.file)) === 'outro-projeto.json');
  await p.route('**/api/**', (r) => r.abort());
  await rename('Sem servidor');
  ok('sem servidor: indicador avisa "Só no navegador"', await waitState('Só no navegador'), await state());
  await p.unroute('**/api/**');
  // reabrir com o servidor de volta: o arquivo não mudou por fora, então a mudança do navegador vai para a pasta sozinha
  await p.reload();
  await p.waitForTimeout(1000);
  ok('ao reabrir, mudança feita sem servidor é mantida', (await docName()) === 'Sem servidor');
  ok('e vai para a pasta sozinha (sem conflito falso)', await waitState('Salvo na pasta'), await state());
  ok('arquivo em dia', JSON.parse(await readFile(join(dir, 'outro-projeto.json'), 'utf8')).name === 'Sem servidor');
  // os DOIS mudaram: o navegador (offline) e o arquivo (por fora) → conflito ao reabrir, nada é sobrescrito
  await p.route('**/api/**', (r) => r.abort());
  await rename('Mudança local');
  await waitState('Só no navegador');
  await p.unroute('**/api/**');
  await writeFile(join(dir, 'outro-projeto.json'), JSON.stringify({ ...external, name: 'Mudança no disco' }));
  await p.reload();
  await p.waitForTimeout(1000);
  ok('os dois mudaram: mantém o do navegador e acusa conflito', (await docName()) === 'Mudança local' && (await state()) === 'Conflito no arquivo', await state());
  ok('arquivo do disco intacto', JSON.parse(await readFile(join(dir, 'outro-projeto.json'), 'utf8')).name === 'Mudança no disco');

  // ---------------------------------------------------------------- 9. teclado: menus, janelas, abas e ferramentas
  await p.focus('.topbar .btn.ghost');
  await p.keyboard.press('Enter');
  await p.waitForSelector('.menu');
  ok('menu aberto pelo teclado já foca o 1º item', await p.evaluate(() => document.activeElement.classList.contains('menu-item')));
  await p.keyboard.press('ArrowDown');
  ok('↓ vai para o próximo item', (await p.evaluate(() => document.activeElement.textContent)).includes('Novo projeto'));
  await p.keyboard.press('Escape');
  ok('Esc fecha o menu e devolve o foco ao botão Arquivo', (await p.locator('.menu').count()) === 0 && (await p.evaluate(() => document.activeElement.textContent.trim())) === 'Arquivo', await p.evaluate(() => document.activeElement.outerHTML.slice(0, 120)));
  await p.keyboard.press('?');
  await p.waitForSelector('[role=dialog]');
  for (let i = 0; i < 4; i++) await p.keyboard.press('Tab');
  ok('Tab fica preso dentro da janela', await p.evaluate(() => document.querySelector('[role=dialog]').contains(document.activeElement)));
  await p.keyboard.press('Escape');
  ok('ferramentas têm nome e estado para leitor de tela', await p.evaluate(() => {
    const t = [...document.querySelectorAll('#toolbar .tool[data-tool]')];
    return t.every((b) => b.getAttribute('aria-label')) && t.filter((b) => b.getAttribute('aria-pressed') === 'true').length === 1;
  }));
  ok('abas informam qual está selecionada', await p.evaluate(() => document.querySelectorAll('[role=tab][aria-selected=true]').length === 2));
  ok('botões só com ícone têm aria-label', await p.evaluate(() => [...document.querySelectorAll('.icon-btn')].every((b) => b.getAttribute('aria-label'))));
} catch (err) {
  ok('cenário terminou sem exceção', false, err.stack);
} finally {
  // devolve a pasta original e apaga a temporária
  await fetch(new URL('/api/config', URL_), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: original.folder }) });
  await b.close();
  await rm(dir, { recursive: true, force: true });
}
console.log(errors.join('\n') || 'sem erros no console');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exitCode = fails || errors.length ? 1 : 0;
