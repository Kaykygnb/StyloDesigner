// O painel web usado como uma pessoa usa, num navegador de verdade (Chromium do Playwright; sem ele o teste é pulado).
// Atenção: o mouse NATIVO apertado sobre um iframe sem scripts derruba navegadores automatizados (defeito do Chromium em modo
// automatizado; num navegador comum com janela não acontece). Por isso os arrastos aqui são feitos com eventos de mouse enviados por script.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const freePort = () => new Promise((resolve) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

test('painel web: criar projeto e tela, inserir, mover, redimensionar, editar texto e cor, camadas, atalhos, responsivo, conferir, agente ao vivo, aparência e exportação', async (t) => {
  const { chromium } = await import('playwright-core');
  let browser;
  try { browser = await chromium.launch({ headless: true, ...(process.env.STYLO_CHROMIUM_PATH ? { executablePath: process.env.STYLO_CHROMIUM_PATH } : {}) }); } catch (err) {
    if (/Executable doesn't exist|n[ãa]o est[áa] dispon|Failed to launch/i.test(String(err.message))) { t.skip('Chromium do Playwright não instalado'); return; }
    throw err;
  }
  t.after(() => browser.close());

  const tmp = await mkdtemp(join(tmpdir(), 'stylo-ui-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../apps/server/src/main.ts', import.meta.url))], {
    env: { ...process.env, PORT: String(port), DESIGNER_CONFIG: join(tmp, 'config.json'), DESIGNER_DB_DIR: 'memory', STYLO_AUTH: 'local', STYLO_BLOB_DIR: 'memory', STYLO_SECRET_KEY: Buffer.alloc(32, 5).toString('base64'), STYLO_DEV: '1' },
    stdio: 'inherit',
  });
  t.after(() => child.kill());
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0, up = false; !up; i++) {
    if (i > 2400) throw new Error('o servidor de teste não subiu em 60 s');
    try { up = (await fetch(base + '/api/status')).ok; } catch { /* ainda subindo */ }
    if (!up) await new Promise((r) => setTimeout(r, 25));
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  page.on('dialog', (d) => d.accept());
  page.on('response', (r) => { if (r.status() >= 400) consoleErrors.push(`HTTP ${r.status()} ${r.url()}`); });
  const wait = (ms) => page.waitForTimeout(ms);
  const docNow = () => page.evaluate(async () => { const sid = sessionStorage.getItem('stylo.sid'); return (await fetch(`/api/studio/doc?sid=${sid}`)).json(); });
  const all = (list, out = []) => { for (const n of list) { out.push(n); if (n.children) all(n.children, out); } return out; };
  const layers = async () => all((await docNow()).doc.pages[0].children);
  const lastNamed = async (name) => (await layers()).filter((n) => n.name === name).at(-1);
  const dragNode = (id, dx, dy) => page.evaluate(async ({ id, dx, dy }) => {
    const d = document.querySelector('iframe.board-frame').contentDocument;
    const el = d.querySelector(`[data-node-id="${id}"]`); const r = el.getBoundingClientRect();
    const z = window.__stylo.get().zoom; const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ev = (type, x, y) => new MouseEvent(type, { bubbles: true, cancelable: true, view: d.defaultView, clientX: x, clientY: y, screenX: Math.round(500 + (x - cx) * z), screenY: Math.round(300 + (y - cy) * z), button: 0, buttons: type === 'mouseup' ? 0 : 1 });
    el.dispatchEvent(ev('mousedown', cx, cy));
    for (let i = 1; i <= 6; i++) { d.dispatchEvent(ev('mousemove', cx + (dx / 6) * i, cy + (dy / 6) * i)); await new Promise((res) => setTimeout(res, 25)); }
    d.dispatchEvent(ev('mouseup', cx + dx, cy + dy));
  }, { id, dx, dy });
  const resizeBy = (handle, dx, dy) => page.evaluate(async ({ handle, dx, dy }) => {
    const h = document.querySelector(`.handle.h-${handle}`); const z = window.__stylo.get().zoom; const hr = h.getBoundingClientRect(); const ox = hr.left + hr.width / 2, oy = hr.top + hr.height / 2;
    const ev = (type, x, y, el) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: ox + x * z, clientY: oy + y * z, button: 0, buttons: type === 'mouseup' ? 0 : 1 }));
    ev('mousedown', 0, 0, h);
    for (let i = 1; i <= 6; i++) { ev('mousemove', (dx / 6) * i, (dy / 6) * i, document); await new Promise((res) => setTimeout(res, 25)); }
    ev('mouseup', dx, dy, document);
  }, { handle, dx, dy });

  // desenhar dentro de uma tela: eventos de mouse enviados por script (o mouse nativo sobre iframe derruba o Chromium automatizado)
  const drawInBoard = (x0, y0, x1, y1) => page.evaluate(async ({ x0, y0, x1, y1 }) => {
    const d = document.querySelector('iframe.board-frame').contentDocument; const z = window.__stylo.get().zoom;
    const ev = (type, x, y) => new MouseEvent(type, { bubbles: true, cancelable: true, view: d.defaultView, clientX: x, clientY: y, screenX: Math.round(500 + x * z), screenY: Math.round(300 + y * z), button: 0, buttons: type === 'mouseup' ? 0 : 1 });
    d.querySelector('[data-node-id]').dispatchEvent(ev('mousedown', x0, y0));
    for (let i = 1; i <= 6; i++) { d.dispatchEvent(ev('mousemove', x0 + ((x1 - x0) / 6) * i, y0 + ((y1 - y0) / 6) * i)); await new Promise((res) => setTimeout(res, 25)); }
    d.dispatchEvent(ev('mouseup', x1, y1));
  }, { x0, y0, x1, y1 });

  // ---- projeto novo, tela livre
  await page.goto(base + '/', { waitUntil: 'load' });
  assert.match(page.url(), /\/studio\//, 'a entrada leva ao painel');
  await page.getByRole('button', { name: 'Novo projeto' }).click();
  await page.getByLabel('Nome do projeto').fill('Teste de interface');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await page.waitForSelector('.editor');
  await page.locator('.insert-bar').getByTitle('Nova tela').click();
  await wait(250);
  assert.equal(await page.locator('.board-frame').count(), 0, 'clicar na ferramenta não cria uma tela');
  const emptyViewport = await page.locator('.canvas-viewport').boundingBox();
  await page.mouse.move(emptyViewport.x + 160, emptyViewport.y + 120);
  await page.mouse.down();
  await page.mouse.move(emptyViewport.x + 460, emptyViewport.y + 370, { steps: 8 });
  await page.mouse.up();
  await page.waitForSelector('.board-frame');
  await wait(900);
  const tela = (await layers()).find((n) => n.type === 'frame');
  assert.deepEqual([tela.w, tela.h, tela.layout.mode], [300, 250, 'none'], 'tela usa o tamanho desenhado');

  // ---- retângulo: inserir, mover, redimensionar
  await page.locator('.insert-bar').getByTitle(/^Retângulo/).click();
  await drawInBoard(50, 50, 170, 170);
  await wait(900);
  let rect = await lastNamed('Retângulo');
  assert.ok(Math.abs(rect.x - 50) <= 4 && Math.abs(rect.y - 50) <= 4, `retângulo nasce no ponto desenhado (${rect.x},${rect.y})`);
  await dragNode(rect.id, 120, 70);
  await wait(1500);
  rect = await lastNamed('Retângulo');
  assert.ok(Math.abs(rect.x - 170) <= 6 && Math.abs(rect.y - 120) <= 6, `arrastar moveu o retângulo (pode encaixar no centro da tela) (agora ${rect.x},${rect.y})`);
  const [w0, h0] = [rect.w, rect.h];
  await resizeBy('se', 60, 40);
  await wait(1500);
  rect = await lastNamed('Retângulo');
  assert.ok(Math.abs(rect.w - (w0 + 60)) <= 3 && Math.abs(rect.h - (h0 + 40)) <= 3, `alça sudeste redimensionou (${rect.w}×${rect.h})`);

  // ---- cor pelo painel de propriedades
  const fill = page.locator('.labeled', { hasText: 'Preenchimento' }).locator('input.field');
  await fill.fill('#2F9E44'); await fill.press('Enter'); await wait(1500);
  assert.equal((await lastNamed('Retângulo')).fill.color.toUpperCase(), '#2F9E44');

  // ---- lista de camadas: renomear, esconder, mostrar
  await page.locator('.layer-row', { hasText: 'Retângulo' }).first().dblclick();
  await page.locator('.inline-edit').fill('Caixa verde'); await page.keyboard.press('Enter'); await wait(1200);
  assert.ok(await lastNamed('Caixa verde'), 'camada renomeada');
  const eye = page.locator('.layer-row', { hasText: 'Caixa verde' }).locator('.vis');
  await eye.click(); await wait(1000);
  assert.equal((await lastNamed('Caixa verde')).visible, false, 'escondida');
  await eye.click(); await wait(1000);
  assert.notEqual((await lastNamed('Caixa verde')).visible, false, 'mostrada de novo');

  // ---- texto: clicar na tela cria o texto já em edição
  await page.locator('.insert-bar').getByTitle(/^Texto/).click(); await drawInBoard(20, 200, 20, 200); await wait(900);
  const frame = page.frameLocator('iframe.board-frame').first();
  // o texto recém-criado já entra em edição: é só digitar
  await page.keyboard.press('Control+A'); await page.keyboard.type('Olá, mundo!'); await page.keyboard.press('Enter'); await wait(1500);
  assert.ok((await layers()).some((n) => n.type === 'text' && n.text === 'Olá, mundo!'), 'texto editado na tela chegou ao servidor');

  // ---- atalhos com o foco dentro da tela
  const before = (await layers()).length;
  await frame.locator('[data-node-id]').filter({ hasText: 'Olá, mundo!' }).last().click(); await wait(500);
  await page.keyboard.press('Control+d'); await wait(1500);
  assert.equal((await layers()).length, before + 1, 'Ctrl+D duplicou');
  await page.keyboard.press('Delete'); await wait(1500);
  assert.equal((await layers()).length, before, 'Delete apagou a cópia');
  await page.getByTitle('Desfazer (Ctrl+Z)').click(); await wait(1500);
  assert.equal((await layers()).length, before + 1, 'desfazer trouxe a cópia de volta');
  await page.getByTitle(/^Refazer/).click(); await wait(1500);
  assert.equal((await layers()).length, before, 'refazer apagou de novo');

  // ---- responsivo e conferência
  await page.getByRole('button', { name: 'Celular' }).click(); await wait(1200);
  assert.ok(await page.locator('iframe.board-frame').evaluate((el) => Math.round(el.getBoundingClientRect().width) > 0), 'a tela aparece no modo celular');
  await page.getByRole('button', { name: 'Desktop' }).click(); await wait(600);
  await page.getByRole('button', { name: /Conferir/ }).first().click();
  await page.waitForSelector('.side-panel h4', { timeout: 20000 });
  await wait(2500);
  assert.ok(await page.locator('.issues li, .notice.ok').count() >= 1, 'a conferência mostra o resultado');

  // ---- um agente (MCP) altera o mesmo projeto: a tela atualiza sozinha
  await page.getByRole('tab', { name: 'Agentes' }).click();
  const client = new Client({ name: 'Agente de teste', version: '1.0.0' }, {});
  await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp')));
  t.after(() => client.close());
  const file = await page.evaluate(() => window.__stylo.get().file);
  await client.callTool({ name: 'open_project', arguments: { file } });
  const rows = await page.locator('.layer-row').count();
  const made = JSON.parse((await client.callTool({ name: 'create_layer', arguments: { type: 'text', props: { text: 'Feito pelo agente', x: 400, y: 300, fontSize: 32 } } })).content[0].text);
  assert.equal(made.error, undefined, made.error);
  await wait(2500);
  assert.equal(await page.locator('.layer-row').count(), rows + 1, 'a camada do agente apareceu sem recarregar a página');
  assert.ok(await page.locator('.activity li, .people li', { hasText: 'Agente de teste' }).count() > 0, 'o agente aparece em "Agentes"');

  // ---- aparência: preferência pessoal, não mexe no projeto
  const projectBefore = JSON.stringify((await layers()).map((n) => [n.id, n.fill]));
  await page.getByLabel('Aparência').click();
  await page.getByRole('button', { name: 'Escuro' }).click();
  await page.getByLabel('Destaque #0f9d8a').click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#0f9d8a');
  assert.equal(JSON.stringify((await layers()).map((n) => [n.id, n.fill])), projectBefore, 'o projeto não mudou com a aparência');

  // ---- voltar aos projetos: miniatura gerada; reabrir pela lista
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Projetos/ }).click();
  await page.waitForSelector('.cards .card');
  await page.waitForSelector('.card .thumb img', { timeout: 20000 });
  assert.ok(await page.locator('.card .thumb img').count() >= 1, 'a lista mostra a miniatura do projeto');

  // ---- exportação
  const sizes = await page.evaluate(async (f) => {
    const get = async (u) => { const r = await fetch(u); return [r.status, (await r.arrayBuffer()).byteLength]; };
    return { site: await get(`/api/projects/${encodeURIComponent(f)}/site.zip`), react: await get(`/api/projects/${encodeURIComponent(f)}/react.zip`) };
  }, file);
  assert.deepEqual([sizes.site[0], sizes.react[0]], [200, 200]);
  assert.ok(sizes.site[1] > 500 && sizes.react[1] > 500, 'os dois zips têm conteúdo');

  assert.deepEqual(consoleErrors, [], 'nenhum erro no console do navegador');
});
