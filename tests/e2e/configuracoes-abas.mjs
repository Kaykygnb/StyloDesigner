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
  // Configurações agora é uma PÁGINA (não modal): abre pelo menu da conta, no avatar do topo
  await page.getByRole('button', { name: 'Sua conta e configurações' }).click();
  await page.getByRole('menuitem', { name: /Configurações/ }).click();
  await page.locator('.settings-page').waitFor();
  assert.equal(await page.locator('.modal-backdrop').count(), 0);
  assert.equal(await page.evaluate(() => document.getElementById('app').inert), true);
  const nav = page.getByRole('navigation', { name: 'Seções das configurações' });
  for (const name of ['Conta', 'Projetos e pasta', 'Agente de IA e modelos', 'Chaves de API', 'MCP e agentes', 'Aparência', 'Atalhos', 'Sobre e suporte']) {
    await nav.getByRole('button', { name, exact: true }).click();
    assert.equal(await page.locator('.sp-section:not([hidden]) h2').innerText(), name);
  }
  console.log('PASS página de Configurações tem as 8 seções e troca entre elas');
  await nav.getByRole('button', { name: 'Agente de IA e modelos', exact: true }).click();
  await page.getByRole('textbox', { name: 'Modelo', exact: true }).fill('rascunho-nao-salvo');
  await nav.getByRole('button', { name: 'Aparência', exact: true }).click();
  assert.equal(await page.locator('[aria-current="page"]').getAttribute('aria-controls'), 'settings-look');
  await nav.getByRole('button', { name: 'Agente de IA e modelos', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: 'Modelo', exact: true }).inputValue(), 'rascunho-nao-salvo');
  console.log('PASS navegação preserva campos ainda não salvos');
  // detalhes longos ficam escondidos: o aviso da nuvem só aparece no "i"
  await nav.getByRole('button', { name: 'Projetos e pasta', exact: true }).click();
  assert.equal((await page.locator('#settings-folder').innerText()).includes('Google Drive'), false);
  await page.getByRole('button', { name: 'Informações sobre Pasta de projetos' }).click();
  assert.match(await page.locator('.inspector-info').innerText(), /Google Drive/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.settings-page').count(), 1, 'Esc no balão "i" só fecha o balão');
  console.log('PASS detalhes da nuvem ficam atrás do botão "i"');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('.sp-main').evaluate((el) => el.scrollWidth <= el.clientWidth + 1), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.settings-page').count(), 0);
  assert.equal(await page.evaluate(() => document.getElementById('app').inert), false);
  assert.deepEqual(errors, []);
  console.log('PASS configurações cabem em tela estreita, fecham com Escape e não geram erros');
} finally {
  await browser.close();
}
