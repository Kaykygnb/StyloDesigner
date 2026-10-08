import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  await page.goto(process.env.APP_URL || 'http://localhost:5173/');
  await page.waitForSelector('.home-wide');
  await page.locator('.home-card.sample', { hasText: 'App mobile' }).click();
  const home = page.locator('.layer-row', { has: page.locator('.layer-name', { hasText: /^Home$/ }) });
  if (!(await home.locator('.twist').getAttribute('class')).includes('open')) await home.locator('.twist').click();
  await page.locator('.layer-row', { has: page.locator('.layer-name', { hasText: /^Cartão de saldo$/ }) }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.querySelector('.save-state').dataset.state === 'saved');
  const original = await page.evaluate(() => JSON.stringify(designer.store.state.doc));
  const selection = await page.evaluate(() => designer.store.ui.selection[0]);
  assert.equal((await page.locator('.topbar').boundingBox()).height, 40);
  assert.equal((await page.locator('#viewport').boundingBox()).y, 40);
  assert.equal(await page.locator('.note-section').isVisible(), false);
  assert.equal(await page.locator('#right .section-help').count(), 0);
  await page.waitForFunction(() => document.querySelector('.save-state').dataset.state === 'saved');
  assert.match(await page.locator('.save-state').getAttribute('aria-label'), /Salvo no navegador/);
  console.log('PASS topo de 40px, estado de salvamento acessível, controles sem explicações ou nota permanentes');

  const info = page.getByRole('button', { name: 'Informações sobre Tamanho', exact: true });
  const dimensions = await page.locator('#right .cap-group', { hasText: 'Dimensões' }).boundingBox();
  await info.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('dialog', { name: 'Informações sobre Tamanho' }).isVisible(), true);
  assert.deepEqual(await page.locator('#right .cap-group', { hasText: 'Dimensões' }).boundingBox(), dimensions);
  await page.keyboard.press('r');
  assert.equal(await page.evaluate(() => designer.store.ui.tool), 'move');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.inspector-info').count(), 0);
  assert.equal(await info.evaluate(el => document.activeElement === el), true);
  assert.equal(await page.evaluate(() => designer.store.ui.selection[0]), selection);
  await info.click(); await page.locator('#right .sel-name').click();
  assert.equal(await page.locator('.inspector-info').count(), 0);
  assert.equal(await page.evaluate(() => JSON.stringify(designer.store.state.doc)), original, 'consultar informação não deve alterar o documento');
  console.log('PASS informação por clique/teclado não move os campos; Escape, foco, clique fora e atalhos protegidos');

  const note = page.getByRole('button', { name: 'Nota da camada', exact: true });
  await note.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('.note-input').evaluate(el => document.activeElement === el), true);
  await page.locator('.note-input').fill('Nota de validação do painel compacto.');
  await page.locator('#right .sel-name').click();
  await note.click();
  assert.equal(await page.locator('.note-section').isVisible(), false);
  await note.click();
  assert.equal(await page.locator('.note-input').inputValue(), 'Nota de validação do painel compacto.');
  await page.locator('#right .sel-name').click(); await note.click();
  assert.equal(await page.evaluate(id => designer.store.get(id).note, selection), 'Nota de validação do painel compacto.');
  assert.equal(await note.evaluate(el => el.classList.contains('has-note')), true);
  await page.waitForFunction(() => document.querySelector('.save-state').dataset.state === 'saved');
  const afterNote = await page.evaluate(() => JSON.stringify(designer.store.state.doc));
  console.log('PASS ícone da Nota abre, foca, grava, fecha e reabre a anotação');

  for (const tab of ['Protótipo', 'Código', 'Comentários', 'Design']) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    assert.equal(await page.getByRole('tab', { name: tab, exact: true }).getAttribute('aria-selected'), 'true');
  }
  await info.click(); await page.getByRole('tab', { name: 'Comentários', exact: true }).click();
  assert.equal(await page.locator('.inspector-info').count(), 0);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  console.log('PASS as quatro abas continuam funcionais e trocá-las fecha a informação');

  assert.equal(await page.evaluate(() => JSON.stringify(designer.store.state.doc)), afterNote, 'alternar abas não deve alterar o documento');
  assert.deepEqual(errors, []);
  console.log('PASS nenhum erro de JavaScript e nenhuma alteração de documento além da nota digitada');
} finally { await browser.close(); }
