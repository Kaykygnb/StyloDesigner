import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await (await b.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
await p.goto((process.env.APP_URL || 'http://localhost:5173/')); await p.waitForTimeout(800);
let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + x)); };
const ev = (f, a) => p.evaluate(f, a);
const rows = () => p.locator('.layer-row').count();
const n0 = await rows();
ok('camadas começam recolhidas (poucas linhas visíveis)', n0 <= 14, String(n0));
// selecionar camada profunda abre o caminho
await ev(() => { const s = designer.store; let id; const w = (l) => l.forEach(n => { if (n.name === 'Começar agora') id = n.id; n.children && w(n.children); }); w(s.page().children); s.setSelection([id]); });
await p.waitForTimeout(200);
ok('selecionar no canvas abre o caminho na lista', (await p.locator('.layer-row.selected').count()) === 1);
// shift-range
await p.locator('.layer-row').first().click();
await p.locator('.layer-row').nth(2).click({ modifiers: ['Shift'] });
ok('Shift+clique seleciona intervalo', (await ev(() => designer.store.ui.selection.length)) === 3);
// salvar indicador
await ev(() => designer.store.commit());
await p.waitForTimeout(150);
ok('indicador mostra salvando/salvo', ['Salvando…', 'Salvo'].includes(await p.locator('.save-state').innerText()));
await p.waitForTimeout(700);
ok('indicador volta a "Salvo"', (await p.locator('.save-state').innerText()) === 'Salvo');
// duplicar página
await p.locator('.page-row').first().click({ button: 'right' });
await p.click('.menu-item:has-text("Duplicar página")');
ok('duplicar página', (await ev(() => designer.store.state.doc.pages.length)) === 2);
const ids = await ev(() => { const d = designer.store.state.doc; return [d.pages[0].children[0].id, d.pages[1].children[0].id]; });
ok('página duplicada tem ids novos', ids[0] !== ids[1]);
// redimensionar painel
const rz = await p.locator('.resizer').first().boundingBox();
await p.mouse.move(rz.x + 4, rz.y + 200); await p.mouse.down(); await p.mouse.move(rz.x + 104, rz.y + 200, { steps: 5 }); await p.mouse.up();
const lw = await ev(() => document.querySelector('#left').getBoundingClientRect().width);
ok('arrastar a borda muda a largura do painel (~368)', lw > 340 && lw < 400, String(lw));
// modo foco
await p.keyboard.press('Control+\\');
ok('Ctrl+\\ esconde os painéis', (await ev(() => document.querySelector('#left').getBoundingClientRect().width)) === 0);
await p.keyboard.press('Control+\\');
// canvas vazio
await ev(() => designer.store.newDoc()); await p.waitForTimeout(200);
ok('dica aparece com canvas vazio', await p.locator('.empty-canvas').isVisible());
// erro inesperado vira aviso
await ev(() => { setTimeout(() => { throw new Error('teste'); }, 0); });
await p.waitForTimeout(200);
ok('erro inesperado mostra aviso amigável', (await p.locator('.toast').count()) === 1);
const unexpectedErrors = errors.filter(e => !e.includes('teste'));
if (unexpectedErrors.length) { console.error(unexpectedErrors.join('\n')); fails += unexpectedErrors.length; }
else console.log('sem outros erros');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
// codex: garante que falhas de interface ou console sejam visíveis para npm e CI.
process.exitCode = fails ? 1 : 0;
await b.close();
process.exitCode = fails || errors.filter(e => !e.includes('teste')).length ? 1 : 0;
