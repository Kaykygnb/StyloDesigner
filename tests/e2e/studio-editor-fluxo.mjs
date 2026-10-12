// Smoke E2E do Studio atual (/studio/). Os testes legados continuam separados porque
// usam o contrato antigo de pasta/IndexedDB; este fluxo valida o produto server-backed.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.APP_URL || 'http://localhost:5173/';
const url = new URL('/studio/', base).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const assertText = async (page, text) => assert.ok((await page.getByText(text, { exact: true }).count()) > 0, `texto ausente: ${text}`);
page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
try {
  await page.goto(url);
  await page.getByRole('main').waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Projetos' }).count(), 1);

  await page.getByRole('button', { name: 'Novo projeto' }).click();
  await page.getByRole('textbox', { name: 'Nome do projeto' }).fill(`E2E Studio ${Date.now()}`);
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await page.locator('.editor').waitFor();
  assert.equal(await page.getByRole('tab', { name: 'Design', exact: true }).count(), 1);
  assert.equal(await page.locator('.left-panel').count(), 1);
  assert.equal(await page.locator('.right-panel').count(), 1);
  console.log('PASS Studio cria projeto persistido e abre o editor atual');

  await page.getByRole('tab', { name: 'Recursos', exact: true }).click();
  assert.equal(await page.locator('.asset-kind-tabs [role="tab"]').count(), 7, 'Recursos deve expor categorias visíveis');
  await page.getByRole('tab', { name: '3D', exact: true }).click();
  assert.equal(await page.getByRole('tab', { name: '3D', exact: true }).getAttribute('aria-selected'), 'true');
  await page.getByRole('tab', { name: 'Camadas', exact: true }).click();
  console.log('PASS Recursos expõe categorias incluindo 3D');

  const emptyCanvas = page.locator('.canvas-viewport');
  const emptyBox = await emptyCanvas.boundingBox();
  assert.ok(emptyBox, 'canvas vazio deve estar visível');
  const beforeEmptyClick = await page.locator('iframe.board-frame').count();
  await emptyCanvas.click({ position: { x: 24, y: 24 } });
  await page.waitForTimeout(250);
  assert.equal(await page.locator('iframe.board-frame').count(), beforeEmptyClick, 'clique simples no canvas vazio não deve criar tela');
  await page.getByRole('button', { name: 'Nova tela', exact: true }).click();
  await page.mouse.move(emptyBox.x + 180, emptyBox.y + 140);
  await page.mouse.down();
  await page.mouse.move(emptyBox.x + 580, emptyBox.y + 440, { steps: 8 });
  await page.mouse.up();
  await page.locator('.canvas-empty').waitFor({ state: 'detached', timeout: 15000 });
  const layerCount = await page.locator('iframe.board-frame').count();
  assert.ok(layerCount >= 1);
  assert.ok(await page.locator('iframe.board-frame').first().contentFrame().locator('[data-node-id]').count() >= 1);
  const createdFrame = await page.locator('iframe.board-frame').first().boundingBox();
  assert.ok(createdFrame && createdFrame.width > 350 && createdFrame.height > 250, 'arraste deve criar tela com dimensões reais');
  console.log('PASS Studio só cria frame por arraste e preserva dimensões');

  for (const label of ['Polígono', 'Estrela', 'Retângulo', 'Elipse', 'Linha']) {
    const before = await page.locator('.layer-row').count();
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.layer-row').count(), before, `${label} só deve ativar a ferramenta`);
  }
  console.log('PASS ferramentas de forma não criam camadas no clique simples');

  await page.getByRole('button', { name: 'Seção', exact: true }).click();
  const sectionStart = await page.locator('.canvas-viewport').boundingBox();
  assert.ok(sectionStart, 'viewport deve continuar visível');
  await page.mouse.move(sectionStart.x + 700, sectionStart.y + 160);
  await page.mouse.down();
  await page.mouse.move(sectionStart.x + 980, sectionStart.y + 360, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  assert.ok(await page.locator('iframe.board-frame').count() >= 2, 'seção vazia deve aparecer como superfície utilizável');
  console.log('PASS seção vazia aparece e pode ser usada no canvas');

  const frameRow = page.locator('.layer-row').filter({ hasText: 'Tela' }).first();
  if (await frameRow.count()) {
    await frameRow.click();
    const layoutSection = page.locator('[data-section="layout"]');
    assert.equal(await layoutSection.count(), 1, 'uma tela selecionada deve expor Auto Layout');
    await layoutSection.getByRole('button', { name: /Linha/ }).click();
    await page.waitForTimeout(250);
    assert.equal(await layoutSection.count(), 1, 'Auto Layout deve continuar disponível após mudar o modo');
    assert.equal(await page.locator('[data-section="export"]').count(), 1, 'uma seleção deve expor Exportar');
    console.log('PASS abas de Auto Layout e Exportar funcionam na tela selecionada');
  }

  const boardNodeCount = async () => {
    let total = 0;
    for (const frame of await page.locator('iframe.board-frame').all()) total += await frame.contentFrame().locator('[data-node-id]').count();
    return total;
  };
  const beforeSvg = await boardNodeCount();
  await page.locator('.insert-bar input[type="file"]').setInputFiles({ name: 'marca.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg viewBox="0 0 24 24"><path d="M2 2h20v20H2z" fill="none" stroke="#111"/></svg>') });
  await page.waitForTimeout(1200);
  const afterSvg = await boardNodeCount();
  assert.ok(afterSvg > beforeSvg, `SVG deve virar camada vetorial (${beforeSvg} → ${afterSvg})`);
  const importedVector = page.locator('.layer-row').filter({ hasText: 'marca' }).last();
  if (await importedVector.count()) {
    await importedVector.click();
    const vectorSection = page.locator('[data-section="vector"]');
    await vectorSection.waitFor();
    assert.ok(await vectorSection.getByRole('button', { name: 'Inverter', exact: true }).count() === 1, 'o Inspector deve expor inversão do caminho');
      await vectorSection.getByRole('button', { name: 'Inverter', exact: true }).click();
      await vectorSection.getByRole('button', { name: 'Stroke → caminho', exact: true }).click();
      await page.waitForTimeout(350);
      assert.equal(await vectorSection.count(), 1, 'a conversão de stroke deve manter o vetor editável');
      await vectorSection.getByRole('button', { name: 'Dividir', exact: true }).click();
      const splitDialog = page.getByRole('dialog', { name: 'Dividir contorno' });
      await splitDialog.waitFor();
      await splitDialog.getByRole('button', { name: 'Dividir', exact: true }).click();
      await page.waitForTimeout(350);
      assert.equal(await vectorSection.count(), 1, 'dividir deve manter o Inspector no vetor');
      await vectorSection.getByRole('button', { name: 'Unir', exact: true }).click();
      await page.waitForTimeout(350);
      assert.equal(await vectorSection.getByRole('button', { name: 'Unir', exact: true }).count(), 0, 'unir deve voltar a um único contorno');
      await vectorSection.getByRole('button', { name: 'Simplificar', exact: true }).click();
      const simplifyDialog = page.getByRole('dialog', { name: 'Simplificar caminho' });
      await simplifyDialog.waitFor();
      await simplifyDialog.getByRole('button', { name: 'Simplificar', exact: true }).click();
      await page.waitForTimeout(350);
      assert.equal(await vectorSection.count(), 1, 'simplificar deve manter o Inspector no vetor');
      console.log('PASS Inspector expõe operações vetoriais editáveis e reversíveis');

      await page.locator('.insert-bar input[type="file"]').setInputFiles({ name: 'curva.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg viewBox="0 0 120 80"><path d="M5 65 C25 5 95 5 115 65" fill="none" stroke="#7C5CFF" stroke-width="4"/></svg>') });
      await page.waitForTimeout(900);
      const curvedVector = page.locator('.layer-row').filter({ hasText: 'curva' }).last();
      if (await curvedVector.count()) {
        await curvedVector.click();
        const curvedSection = page.locator('[data-section="vector"]');
        await curvedSection.waitFor();
        await curvedSection.getByRole('button', { name: 'Simplificar', exact: true }).click();
        const curvedDialog = page.getByRole('dialog', { name: 'Simplificar caminho' });
        await curvedDialog.waitFor();
        await curvedDialog.getByRole('button', { name: 'Simplificar', exact: true }).click();
        await page.waitForTimeout(350);
        assert.equal(await curvedSection.count(), 1, 'simplificação Bézier deve manter a camada editável');
        assert.ok(await curvedSection.locator('.vector-point').count() >= 2, 'curva simplificada deve continuar com nós');
        console.log('PASS simplificação Bézier real no navegador mantém nós editáveis');
        await page.getByRole('button', { name: /Inspecionar/ }).click();
        const nodeButtons = page.locator('.vector-node');
        await nodeButtons.first().waitFor();
        const nodeBefore = [await nodeButtons.nth(0).getAttribute('style'), await nodeButtons.nth(1).getAttribute('style')];
        await nodeButtons.nth(0).click();
        await nodeButtons.nth(1).click({ modifiers: ['Shift'] });
        assert.equal(await page.locator('.vector-node.selected').count(), 2, 'Shift deve selecionar múltiplos nós');
        await nodeButtons.nth(1).press('ArrowRight');
        await page.waitForTimeout(300);
        const nodeAfter = [await nodeButtons.nth(0).getAttribute('style'), await nodeButtons.nth(1).getAttribute('style')];
        assert.notDeepEqual(nodeAfter, nodeBefore, 'uma seta deve mover o conjunto de nós selecionados');
        assert.equal(await page.locator('.vector-node.selected').count(), 2, 'a seleção múltipla deve permanecer após mover');
        console.log('PASS seleção múltipla de nós e movimentação conjunta por teclado');
      }
  }
  console.log('PASS upload SVG do Studio cria vetor editável dentro da tela');

  await page.reload();
  await page.locator('.editor').waitFor();
  await page.locator('iframe.board-frame').first().waitFor();
  console.log('PASS projeto e frame sobrevivem ao recarregamento via banco do servidor');

  const leftBefore = await page.locator('.left-panel').boundingBox();
  const leftToggle = page.getByRole('button', { name: 'Recolher painel esquerdo' });
  await leftToggle.click();
  assert.equal(await page.locator('.left-panel').count(), 0, 'painel esquerdo deve recolher sem desmontar o editor');
  assert.equal(await page.locator('.canvas-viewport').count(), 1);
  await page.getByRole('button', { name: 'Abrir painel esquerdo' }).click();
  assert.equal(await page.locator('.left-panel').count(), 1);
  const rightToggle = page.getByRole('button', { name: 'Recolher painel direito' });
  await rightToggle.click();
  assert.equal(await page.locator('.right-panel').count(), 0, 'painel direito deve recolher sem desmontar o editor');
  await page.getByRole('button', { name: 'Abrir painel direito' }).click();
  assert.equal(await page.locator('.right-panel').count(), 1);
  const resizer = page.locator('.left-resizer');
  const resizerBox = await resizer.boundingBox();
  assert.ok(resizerBox && leftBefore, 'redimensionador esquerdo deve estar visível');
  await page.mouse.move(resizerBox.x + resizerBox.width / 2, resizerBox.y + 200);
  await page.mouse.down();
  await page.mouse.move(resizerBox.x + 45, resizerBox.y + 200);
  await page.mouse.up();
  const leftAfter = await page.locator('.left-panel').boundingBox();
  assert.ok(leftAfter && Math.abs(leftAfter.width - leftBefore.width) > 20, 'painel esquerdo deve aceitar redimensionamento');
  const keyboardBefore = Number(await resizer.getAttribute('aria-valuenow'));
  await resizer.focus();
  await resizer.press('ArrowRight');
  assert.equal(Number(await resizer.getAttribute('aria-valuenow')), Math.min(460, keyboardBefore + 16), 'splitter esquerdo deve aceitar seta pelo teclado');
  await resizer.press('End');
  assert.equal(Number(await resizer.getAttribute('aria-valuenow')), 460, 'End deve levar o painel ao limite máximo');
  await resizer.press('Home');
  assert.equal(Number(await resizer.getAttribute('aria-valuenow')), 180, 'Home deve levar o painel ao limite mínimo');
  console.log('PASS painéis esquerdo e direito recolhem e redimensionam sem perder o canvas');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  const mobileStage = await page.locator('.stage').boundingBox();
  const mobileRight = await page.locator('.right-panel').boundingBox();
  assert.ok(mobileStage && mobileStage.width >= 380, 'em telefone o canvas deve ocupar a largura disponível');
  assert.ok(mobileRight && mobileRight.width <= 374 && mobileRight.x >= 8, 'painel direito deve virar gaveta sem esmagar o canvas');
  assert.ok(await page.locator('.tabs button').count() >= 4, 'abas do painel devem continuar acessíveis por rolagem horizontal');
  await page.getByRole('button', { name: 'Recolher painel direito' }).click();
  assert.equal(await page.locator('.right-panel').count(), 0, 'gaveta direita deve recolher no telefone');
  await page.getByRole('button', { name: 'Abrir painel direito' }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(250);
  console.log('PASS layout móvel usa gavetas e mantém canvas, abas e recolhimento utilizáveis');

  const zoomLabel = page.locator('.zoom-controls button').nth(1);
  const zoomBefore = await zoomLabel.innerText();
  await page.keyboard.press('Control+Equal');
  const zoomAfterPlus = await zoomLabel.innerText();
  assert.notEqual(zoomAfterPlus, zoomBefore, 'Ctrl+ deve alterar somente o zoom do canvas');
  await page.keyboard.press('Control+Minus');
  assert.equal(await zoomLabel.innerText(), zoomBefore, 'Ctrl- deve retornar ao zoom anterior');
  console.log('PASS Ctrl+ e Ctrl- alteram o zoom do canvas');

  const topRuler = page.locator('.ruler-top');
  const rulerBox = await topRuler.boundingBox();
  const canvasBox = await page.locator('.canvas-viewport').boundingBox();
  assert.ok(rulerBox && canvasBox, 'régua e canvas devem estar visíveis');
  const guidesBefore = await page.locator('.guide.y').count();
  await page.mouse.move(rulerBox.x + rulerBox.width / 2, rulerBox.y + rulerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + 160);
  await page.mouse.up();
  await page.locator('.guide.y').nth(guidesBefore).waitFor({ state: 'attached', timeout: 5000 });
  assert.equal(await page.locator('.guide.y').count(), guidesBefore + 1, 'arrastar da régua deve criar guia horizontal');
  const guide = page.locator('.guide.y').last();
  await guide.click({ button: 'right' });
  await guide.waitFor({ state: 'detached', timeout: 5000 });
  assert.equal(await page.locator('.guide.y').count(), guidesBefore, 'clique direito na guia deve removê-la');
  console.log('PASS guias são criadas pela régua e removidas sem alerta');

  await page.keyboard.press('Control+Comma');
  const settings = page.getByRole('dialog', { name: 'Configurações' });
  await settings.waitFor();
  const languageSelect = settings.locator('select').nth(1);
  await languageSelect.selectOption('en-US');
  await page.getByRole('dialog', { name: 'Settings' }).waitFor();
  assert.equal(await page.getByRole('tab', { name: 'Prototype', exact: true }).count(), 1);
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Issues', exact: true }).click();
  await assertText(page, 'Check the design');
  await page.getByRole('tab', { name: 'Export', exact: true }).click();
  await assertText(page, 'Export site');
  await page.getByRole('tab', { name: 'Comments', exact: true }).click();
  await assertText(page, 'Comments');
  await page.getByRole('tab', { name: 'Inspect', exact: true }).click();
  await assertText(page, 'Inspect');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.keyboard.press('Control+Comma');
  await page.getByRole('dialog', { name: 'Settings' }).locator('select').nth(1).selectOption('pt-BR');
  await page.keyboard.press('Escape');
  console.log('PASS idioma alterna labels do editor e fecha as configurações sem alerta');

  await page.getByRole('button', { name: 'Apresentar' }).click();
  await page.locator('[role="dialog"], .presentation, .presenting').first().waitFor();
  assert.equal(await page.locator('.left-panel').count(), 0, 'apresentação não deve manter painel esquerdo');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.editor').count(), 1);
  console.log('PASS apresentação isola os painéis e retorna ao editor');

  await page.getByRole('button', { name: /Agentes/ }).click();
  assert.match(await page.locator('.right-panel').innerText(), /projeto|conect|atividade/i);
  console.log('PASS painel de colaboração abre no projeto atual');

  assert.deepEqual(errors, []);
  console.log('PASS Studio sem erros de runtime');
} finally {
  await browser.close();
}
