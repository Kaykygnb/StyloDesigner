// Regressões de layout: imagens carregadas e contidas, página inicial em telas
// pequenas, busca pelo teclado, temas e controles flutuantes dentro do palco.
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
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('.home-examples').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('.home img')].every(img => img.complete));
    const problems = await page.evaluate(() => {
      const home = document.querySelector('.home');
      const result = [];
      if (home.scrollWidth > home.clientWidth + 1) result.push('rolagem horizontal');
      for (const img of home.querySelectorAll('img')) {
        if (!img.naturalWidth) result.push('imagem inválida: ' + img.getAttribute('src'));
        const image = img.getBoundingClientRect();
        const parent = img.parentElement.getBoundingClientRect();
        if (image.height > parent.height + 1 || image.width > parent.width + 1) result.push('prévia fora do card');
      }
      return result;
    });
    assert.deepEqual(problems, [], `${width}px: ${problems.join(', ')}`);
    console.log(`PASS página inicial em ${width}px: imagens válidas, contidas e sem rolagem horizontal`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press('/');
  assert.equal(await page.locator('.home-search input').evaluate(el => el === document.activeElement), true);
  await page.keyboard.type('projeto inexistente');
  assert.match(await page.locator('.home-empty').innerText(), /Nada encontrado|Nenhum projeto/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.home').count(), 0);
  console.log('PASS busca pelo teclado e Esc devolvem o editor');

  for (const width of [1440, 1280, 1100, 1000, 900]) {
    await page.setViewportSize({ width, height: 860 });
    await page.waitForTimeout(150);
    const bounds = await page.evaluate(() => {
      const stage = document.querySelector('.stage').getBoundingClientRect();
      const toolbar = document.querySelector('.toolbar').getBoundingClientRect();
      const zoom = document.querySelector('.zoom-widget').getBoundingClientRect();
      return {
        contained: toolbar.left >= stage.left && toolbar.right <= stage.right,
        overlap: toolbar.left < zoom.right && toolbar.right > zoom.left && toolbar.top < zoom.bottom && toolbar.bottom > zoom.top,
      };
    });
    assert.equal(bounds.contained, true, `barra de ferramentas fora do palco em ${width}px`);
    assert.equal(bounds.overlap, false, `zoom sobreposto em ${width}px`);
  }
  console.log('PASS ferramentas dentro do palco e sem sobreposição com o zoom (900–1440px)');

  await page.setViewportSize({ width: 1440, height: 900 });
  const original = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: 'Alternar tema claro/escuro' }).click();
  assert.notEqual(await page.locator('html').getAttribute('data-theme'), original);
  await page.getByRole('button', { name: 'Alternar tema claro/escuro' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), original);
  assert.deepEqual(errors, []);
  console.log('PASS temas claro e escuro; nenhum erro de JavaScript');
} finally {
  await browser.close();
}
