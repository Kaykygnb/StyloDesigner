import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(new URL('?editor', process.env.APP_URL || 'http://localhost:5173/').href);
  await page.getByRole('tab', { name: 'Design', exact: true }).waitFor();
  for (const side of ['left', 'right']) {
    const tabs = page.locator(`#${side} [role=tab]`);
    await tabs.first().focus();
    await page.keyboard.press('End');
    assert.equal(await tabs.last().getAttribute('aria-selected'), 'true');
    assert.equal(await tabs.last().evaluate((el) => el === document.activeElement), true);
    await page.keyboard.press('ArrowRight');
    assert.equal(await tabs.first().getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator(`#${side} [role=tab][tabindex="0"]`).count(), 1);
    assert.equal(await page.locator(`#${side}-content`).getAttribute('aria-labelledby'), await tabs.first().getAttribute('id'));
  }
  console.log('PASS abas navegam com setas/Home/End e mantêm foco e seleção associados ao painel');
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.locator('#settings-look').waitFor();
  const nav = page.getByRole('navigation', { name: 'Seções das configurações' });
  await nav.getByRole('button', { name: 'Assistente e MCP', exact: true }).click();
  await page.getByRole('textbox', { name: 'Modelo', exact: true }).fill('rascunho-nao-salvo');
  await nav.getByRole('button', { name: 'Aparência e controles', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-current="location"]')?.getAttribute('aria-controls') === 'settings-look');
  await nav.getByRole('button', { name: 'Assistente e MCP', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: 'Modelo', exact: true }).inputValue(), 'rascunho-nao-salvo');
  console.log('PASS navegação encontra a última seção e preserva campos ainda não salvos');
  await page.setViewportSize({ width: 390, height: 844 });
  await nav.getByRole('button', { name: 'Projetos e versões', exact: true }).click();
  assert.equal(await page.locator('.settings-content').evaluate((el) => el.scrollWidth <= el.clientWidth + 1), true);
  const modal = await page.locator('.settings-modal').boundingBox();
  assert.ok(modal.x >= 0 && modal.x + modal.width <= 391);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog', { name: 'Configurações', exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS configurações cabem em tela estreita, fecham com Escape e não geram erros');
} finally {
  await browser.close();
}
