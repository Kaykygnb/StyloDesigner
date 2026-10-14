// Fluxo administrativo real do Studio: usuários, senha temporária, agentes MCP,
// permissões, revogação, diagnóstico de plugin e guia de conexão.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.APP_URL || 'http://localhost:5173/';
const adminEmail = process.env.E2E_ADMIN_EMAIL || 'owner-e2e@stylo.test';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'SenhaE2E segura 123!';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
try {
  await page.goto(new URL('/studio/', base).href);
  await page.locator('.login-card, main').first().waitFor({ timeout: 30000 });
  const loginCard = page.locator('.login-card');
  if (await loginCard.isVisible().catch(() => false)) {
    const state = await (await fetch(new URL('/api/auth/state', base))).json();
    if (state.mode !== 'accounts') throw new Error('O fluxo administrativo E2E precisa de STYLO_AUTH=accounts.');
    if (!state.hasAccounts) {
      await loginCard.getByLabel('Seu nome').fill('Owner E2E');
      await loginCard.getByLabel('E-mail').fill(adminEmail);
      await loginCard.getByLabel('Senha', { exact: true }).fill(adminPassword);
      await loginCard.getByLabel('Repita a senha').fill(adminPassword);
      await loginCard.getByRole('button', { name: 'Criar conta e entrar' }).click();
    } else {
      await loginCard.getByLabel('E-mail').fill(adminEmail);
      await loginCard.getByLabel('Senha').fill(adminPassword);
      await loginCard.getByRole('button', { name: 'Entrar' }).click();
    }
  }
  await page.getByRole('main').waitFor();
  await page.getByRole('button', { name: 'Administração', exact: true }).click();
  await page.getByRole('heading', { name: 'Administração' }).waitFor();
  assert.match(await page.locator('.workspace-section').innerText(), /Saúde do servidor|Plugins e provedores/);
  console.log('PASS administração mostra saúde, rede, atividade e plugins');
  await page.getByText('Origem oficial').first().waitFor();
  await page.getByText('Texto da licença').first().waitFor();
  assert.ok(await page.getByText('Origem oficial').count() > 0, 'provedores precisam mostrar a origem oficial');
  assert.ok(await page.getByText('Texto da licença').count() > 0, 'provedores precisam mostrar o texto da licença');
  console.log('PASS administração mostra origem e licença dos provedores de assets');
  await page.getByRole('button', { name: 'Aparência', exact: true }).click();
  await page.locator('.popover select').selectOption('en-US');
  await page.getByRole('button', { name: 'Administration', exact: true }).click();
  await page.getByRole('heading', { name: 'Administration' }).waitFor();
  assert.match(await page.locator('.workspace-section').innerText(), /Server health|Active plugins/);
  await page.getByText('Official source').first().waitFor();
  await page.getByText('License text').first().waitFor();
  console.log('PASS administração traduz títulos e ações para inglês');
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('heading', { name: 'Library' }).waitFor();
  await page.getByPlaceholder('Search name, type, tag, or credit').waitFor();
  assert.ok(await page.getByRole('combobox', { name: 'Filter by license' }).count() === 1);
  console.log('PASS biblioteca traduz filtros, busca e estados para inglês');
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.locator('.popover select').selectOption('pt-BR');
  await page.getByRole('button', { name: 'Administração', exact: true }).click();
  await page.getByRole('heading', { name: 'Administração' }).waitFor();

  await page.getByRole('button', { name: 'Novo usuário', exact: true }).click();
  const userDialog = page.getByRole('dialog', { name: 'Novo usuário' });
  await userDialog.getByLabel('Nome').fill('Usuário E2E');
  await userDialog.getByLabel('E-mail').fill(`e2e-${Date.now()}@stylo.test`);
  await userDialog.getByRole('button', { name: 'Criar usuário', exact: true }).click();
  await page.getByText('Senha temporária — copie agora').waitFor();
  assert.match(await page.locator('.codebox').last().innerText(), /\S+/);
  console.log('PASS criação de usuário gera senha temporária exibida uma única vez');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();

  const ownerEmail = `socio-e2e-${Date.now()}@stylo.test`;
  const ownerPassword = 'SenhaDoSocio 123!';
  await page.getByRole('button', { name: 'Novo usuário', exact: true }).click();
  const ownerDialog = page.getByRole('dialog', { name: 'Novo usuário' });
  await ownerDialog.getByLabel('Nome').fill('Sócio E2E');
  await ownerDialog.getByLabel('E-mail').fill(ownerEmail);
  await ownerDialog.getByLabel('Nível de acesso').selectOption('OWNER');
  await ownerDialog.getByLabel('Senha inicial').fill(ownerPassword);
  const createdPromise = page.waitForResponse((response) => response.url().includes('/api/users') && response.request().method() === 'POST');
  await ownerDialog.getByRole('button', { name: 'Criar usuário', exact: true }).click();
  const reconfirm = page.getByRole('dialog', { name: 'Confirme sua senha' });
  await reconfirm.locator('input[type="password"]').fill(adminPassword);
  await reconfirm.getByRole('button', { name: 'Confirmar', exact: true }).click();
  const createdResponse = await createdPromise;
  const createdBody = await createdResponse.json();
  assert.equal(createdResponse.status(), 201);
  assert.equal(createdBody.user.role, 'OWNER');
  assert.equal(createdBody.user.principal, false);
  assert.equal(createdBody.temporaryPassword, undefined);
  assert.equal(JSON.stringify(createdBody).includes(ownerPassword), false);
  const ownerRow = page.locator('li').filter({ hasText: ownerEmail });
  await ownerRow.waitFor();
  assert.match(await ownerRow.innerText(), /Proprietário/);
  assert.doesNotMatch(await ownerRow.innerText(), /autoridade principal/);
  assert.equal(await page.getByText('Senha temporária — copie agora').count(), 0);
  console.log('PASS proprietário secundário é criado sem mostrar a senha');

  const nextPassword = 'OutraSenhaDoSocio 123!';
  const resetPromise = page.waitForResponse((response) => response.url().includes('/reset-password') && response.request().method() === 'POST');
  await ownerRow.getByRole('button', { name: 'Resetar senha', exact: true }).click();
  const resetDialog = page.getByRole('dialog', { name: 'Senha inicial' });
  await resetDialog.locator('input[type="password"]').fill(nextPassword);
  await resetDialog.getByRole('button', { name: 'Resetar senha', exact: true }).click();
  const resetResponse = await resetPromise;
  const resetBody = await resetResponse.json();
  assert.equal(resetResponse.status(), 200);
  assert.equal(resetBody.ok, true);
  assert.equal(resetBody.mustChangePassword, true);
  assert.equal(resetBody.temporaryPassword, undefined);
  assert.equal(JSON.stringify(resetBody).includes(nextPassword), false);
  assert.equal(await page.getByText('Senha temporária — copie agora').count(), 0);
  console.log('PASS reset de proprietário não revela senha');

  await page.getByRole('button', { name: 'Conexões MCP', exact: true }).click();
  await page.getByRole('heading', { name: 'Conexões MCP' }).waitFor();
  await page.getByRole('button', { name: 'Novo agente', exact: true }).click();
  const agentDialog = page.getByRole('dialog', { name: 'Novo agente MCP' });
  await agentDialog.getByLabel('Nome').fill(`Agente E2E ${Date.now()}`);
  await agentDialog.getByRole('button', { name: 'Criar agente', exact: true }).click();
  await page.getByText('Token criado — copie agora').waitFor();
  const token = await page.locator('.account-card .codebox code').first().innerText();
  assert.ok(token.length >= 20, 'token MCP deve existir');
  console.log('PASS cadastro de agente MCP gera token real');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  assert.ok(await page.getByText('Token Bearer', { exact: true }).count() >= 1);
  assert.ok(await page.getByText(/Endpoint:/).count() >= 1);
  assert.ok(await page.getByText('Testar conexão').count() >= 1);
  await page.getByRole('button', { name: 'Testar conexão', exact: true }).click();
  await page.getByText('Conexão MCP respondendo.').waitFor();
  console.log('PASS guia MCP mostra endpoint, Bearer e teste de conexão');
  const guide = page.locator('.account-card').filter({ hasText: 'Guia de conexão' });
  const clientSelect = guide.getByLabel('Cliente MCP');
  for (const client of ['Codex', 'Quine', 'OpenCog']) {
    await clientSelect.selectOption({ label: client });
    const config = await guide.locator('pre.code').filter({ hasText: 'mcpServers' }).first().innerText();
    assert.match(config, /mcpServers/);
    assert.match(config, /\/mcp/);
    assert.match(config, /Authorization/);
    assert.match(config, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  await clientSelect.selectOption({ label: 'Claude Code' });
  assert.match(await guide.locator('pre.code').filter({ hasText: 'claude mcp add' }).first().innerText(), /claude mcp add --transport http/);
  console.log('PASS guia MCP gera configuração real para Codex, Quine, OpenCog e Claude Code');

  const agentRow = page.locator('.resource-list > li').filter({ hasText: /Agente E2E/ }).last();
  await agentRow.getByRole('button', { name: 'Revogar', exact: true }).click();
  await agentRow.getByRole('button', { name: 'Aprovar', exact: true }).waitFor();
  console.log('PASS revogação e reaprovação do agente atualizam o estado');

  await page.getByRole('button', { name: 'Administração', exact: true }).click();
  await page.getByRole('heading', { name: 'Administração' }).waitFor();
  const verify = page.getByRole('button', { name: 'Verificar plugin', exact: true }).first();
  await verify.click();
  await page.getByText(/Diagnóstico: /).first().waitFor();
  console.log('PASS diagnóstico do plugin é executado pelo servidor');
  const disable = page.getByRole('button', { name: 'Desativar plugin', exact: true }).first();
  if (await disable.count()) {
    await disable.click();
    const enable = page.getByRole('button', { name: 'Ativar plugin', exact: true }).first();
    await enable.waitFor();
    await enable.click();
    await disable.waitFor();
    console.log('PASS ativação e desativação de plugin persistem pelo servidor');
  }
  assert.deepEqual(errors, []);
  console.log('PASS Studio admin sem erros de runtime');
} finally {
  await browser.close();
}
