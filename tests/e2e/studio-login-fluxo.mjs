// Pessoas usam cookies em contextos separados; nenhum token/senha é impresso.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const base = process.env.APP_URL || 'http://localhost:5173/';
const artifacts = process.env.STYLO_E2E_ARTIFACTS || 'capturas/e2e';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const owner = await browser.newPage();
let person;
const errors = [];
try {
  await owner.goto(new URL('/studio/', base).href);
  await owner.getByRole('heading', { name: 'Entrar', exact: true }).waitFor();
  await owner.getByLabel('E-mail', { exact: true }).fill(process.env.E2E_ADMIN_EMAIL || 'owner-e2e@stylo.test');
  await owner.getByLabel('Senha', { exact: true }).fill('senha-incorreta');
  await owner.getByRole('button', { name: 'Entrar', exact: true }).click();
  await owner.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' }).waitFor();
  await owner.getByLabel('Senha', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD || 'SenhaE2E segura 123!');
  await owner.getByRole('button', { name: 'Entrar', exact: true }).click();
  await owner.getByRole('main').waitFor();
  await owner.locator('.connect-card').getByRole('button', { name: 'Abrir conexões', exact: true }).click();
  await owner.getByRole('heading', { name: 'Conexões criativas', exact: true }).waitFor();
  await owner.getByRole('button', { name: 'Projetos', exact: true }).click();
  console.log('PASS login rejeita senha incorreta e permite entrada válida; proprietário recebe guia MCP autenticado');

  const ownerSid = await owner.evaluate(() => sessionStorage.getItem('stylo.sid'));
  const privateProject = await owner.request.post(new URL('/api/studio/call', base).href, { data: { sid: ownerSid, tool: 'new_project', args: { name: `Privado do proprietário ${Date.now()}` } } });
  assert.equal(privateProject.status(), 200);
  assert.equal((await privateProject.json()).error, undefined);
  const ownerSnapshotUrl = new URL(`/api/studio/doc?sid=${encodeURIComponent(ownerSid)}`, base).href;
  const beforePrivate = await (await owner.request.get(ownerSnapshotUrl)).json();
  assert.ok(beforePrivate?.doc);
  const email = `person-${Date.now()}@stylo.test`;
  const created = await owner.request.post(new URL('/api/users', base).href, { data: { email, name: 'Pessoa E2E', role: 'EDITOR' } });
  assert.equal(created.status(), 201);
  const { user, temporaryPassword } = await created.json();
  assert.ok(temporaryPassword);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  person = await context.newPage();
  person.on('pageerror', (error) => errors.push(error.message));
  person.on('response', (response) => { if (response.url().includes('/api/') && response.status() >= 500) errors.push(`HTTP ${response.status()}`); });
  const protectedRequests = [];
  person.on('request', (request) => {
    if (/^\/api\/(projects|studio\/doc|agent\/events)(\/|\?|$)/.test(new URL(request.url()).pathname)) protectedRequests.push(request.url());
  });
  const enter = async (password) => {
    await person.getByRole('heading', { name: 'Entrar', exact: true }).waitFor();
    await person.getByLabel('E-mail', { exact: true }).fill(email);
    await person.getByLabel('Senha', { exact: true }).fill(password);
    await person.getByRole('button', { name: 'Entrar', exact: true }).click();
  };
  await person.goto(new URL('/studio/', base).href);
  await enter(temporaryPassword);
  await person.getByRole('heading', { name: 'Troque sua senha', exact: true }).waitFor();
  await person.reload();
  await person.getByRole('heading', { name: 'Troque sua senha', exact: true }).waitFor({ timeout: 10000 });
  assert.equal(protectedRequests.length, 0, 'senha temporária não inicia projetos, snapshot ou SSE antes da troca');
  assert.ok(await person.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'formulário de senha cabe no celular');
  await person.screenshot({ path: join(artifacts, 'login-password-mobile.png'), fullPage: true });
  await person.getByRole('button', { name: 'Sair', exact: true }).click();
  await enter(temporaryPassword);
  await person.getByRole('heading', { name: 'Troque sua senha', exact: true }).waitFor();
  console.log('PASS senha temporária suporta reload, celular e saída antes da troca');

  await person.getByLabel('Senha temporária', { exact: true }).fill(temporaryPassword);
  await person.getByLabel('Nova senha', { exact: true }).fill('Senha pessoal E2E 456!');
  await person.getByLabel('Repita a nova senha', { exact: true }).fill('senha-diferente');
  await person.getByRole('button', { name: 'Salvar nova senha', exact: true }).click();
  await person.getByRole('alert').filter({ hasText: 'As senhas não são iguais.' }).waitFor();
  await person.getByLabel('Repita a nova senha', { exact: true }).fill('Senha pessoal E2E 456!');
  await person.getByRole('button', { name: 'Salvar nova senha', exact: true }).click();
  await person.getByRole('main').waitFor();
  assert.equal(await person.getByRole('button', { name: 'Administração', exact: true }).count(), 0);
  assert.equal(await person.getByRole('button', { name: 'Conexões MCP', exact: true }).count(), 0);
  assert.equal((await person.request.get(new URL('/api/users', base).href)).status(), 403);
  assert.equal((await person.request.get(new URL('/api/projects', base).href)).status(), 200);
  await person.reload();
  await person.getByRole('heading', { name: 'Vamos criar algo lindo?', exact: true }).waitFor(); // título da área de projetos
  assert.equal(await (await person.request.get(ownerSnapshotUrl)).json(), null, 'sid de outra conta não devolve o documento privado');
  const foreignRead = await person.request.post(new URL('/api/studio/call', base).href, { data: { sid: ownerSid, tool: 'get_document', args: {} } });
  assert.ok((await foreignRead.json()).error, 'sid de outra conta não permite ler ferramentas do workspace');
  const foreignWrite = await person.request.post(new URL('/api/studio/call', base).href, { data: { sid: ownerSid, tool: 'create_layer', args: { type: 'rect' } } });
  assert.ok((await foreignWrite.json()).error, 'sid de outra conta não permite alterar o workspace');
  assert.deepEqual(await (await owner.request.get(ownerSnapshotUrl)).json(), beforePrivate, 'workspace do proprietário continua intacto');
  console.log('PASS troca de senha, sessão, papel de editor e isolamento entre contas com sid reutilizado');

  await person.getByRole('button', { name: 'Novo projeto', exact: true }).click();
  await person.getByLabel('Nome do projeto', { exact: true }).fill('Projeto da pessoa E2E');
  await person.getByRole('button', { name: 'Criar', exact: true }).click();
  await person.locator('.editor').waitFor();
  await person.getByRole('button', { name: /Projetos/ }).click();
  await person.getByRole('heading', { name: 'Vamos criar algo lindo?', exact: true }).waitFor(); // título da área de projetos
  await person.getByText('Projeto da pessoa E2E', { exact: true }).waitFor();
  assert.equal(await person.getByRole('button', { name: 'Administração', exact: true }).count(), 0, 'ser dono de projeto não transforma a pessoa em administrador da instalação');
  assert.equal(await person.locator('.connect-card').count(), 0, 'editor não recebe instruções MCP que exigem administração');
  assert.ok(await person.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'navegação e saída cabem no celular');
  await person.screenshot({ path: join(artifacts, 'login-projects-mobile.png'), fullPage: true });
  await person.getByRole('button', { name: /^Sair/ }).click();
  await enter(temporaryPassword);
  await person.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' }).waitFor();
  await person.getByLabel('Senha', { exact: true }).fill('Senha pessoal E2E 456!');
  await person.getByRole('button', { name: 'Entrar', exact: true }).click();
  await person.getByRole('main').waitFor();
  console.log('PASS pessoa cria projeto, sai e entra novamente; senha temporária deixa de valer');

  assert.equal((await owner.request.post(new URL(`/api/users/${user.id}/revoke-sessions`, base).href, { data: {} })).status(), 200);
  await person.reload();
  await person.getByRole('heading', { name: 'Entrar', exact: true }).waitFor();
  assert.equal((await person.request.get(new URL('/api/projects', base).href)).status(), 401);
  assert.equal((await owner.request.post(new URL(`/api/users/${user.id}/suspend`, base).href, { data: { suspended: true } })).status(), 200);
  await enter('Senha pessoal E2E 456!');
  await person.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' }).waitFor();
  assert.equal((await owner.request.post(new URL(`/api/users/${user.id}/suspend`, base).href, { data: { suspended: false } })).status(), 200);
  await person.getByRole('button', { name: 'Entrar', exact: true }).click();
  await person.getByRole('main').waitFor();
  console.log('PASS sessão revogada retorna ao login; suspensão bloqueia e reativação permite entrada');
  assert.deepEqual(errors, []);
} catch (error) {
  await person?.screenshot({ path: join(artifacts, 'login-failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
