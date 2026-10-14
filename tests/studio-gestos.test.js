// Gestos do canvas num navegador de verdade: girar, caixa de seleção, mover a vista, Alt+arrastar (duplicar) e lápis.
// Rede de proteção da divisão do Canvas.tsx (canvas/gestures.ts). Sem Chromium o teste é pulado (STYLO_CHROMIUM_PATH aponta um).
import { isolatedServerEnv } from './helpers/test-env.mjs';
import { cleanupFixture } from './helpers/fixture-lifecycle.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const freePort = () => new Promise((resolve) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

test('gestos do canvas: girar, caixa de seleção, mão, Alt+arrastar com camada travada e lápis', async (t) => {
  const { chromium } = await import('playwright-core');
  let browser;
  try { browser = await chromium.launch({ headless: true, ...((process.env.STYLO_CHROMIUM_PATH || process.env.CHROMIUM_PATH) ? { executablePath: process.env.STYLO_CHROMIUM_PATH || process.env.CHROMIUM_PATH } : {}) }); } catch (err) {
    if (/Executable doesn't exist|n[ãa]o est[áa] dispon|Failed to launch/i.test(String(err.message))) { t.skip('Chromium do Playwright não instalado'); return; }
    throw err;
  }
  t.after(() => browser.close());
  const tmp = await mkdtemp(join(tmpdir(), 'stylo-gestos-'));
  const fixture = { dir: tmp, children: [], clients: [] };
  t.after(() => cleanupFixture(fixture));
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../apps/server/src/main.ts', import.meta.url))], {
    env: isolatedServerEnv({ PORT: String(port), DESIGNER_CONFIG: join(tmp, 'config.json'), STYLO_DEV: '1' }), stdio: 'ignore',
  });
  fixture.children.push(child);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0, up = false; !up; i++) {
    if (i > 2400) throw new Error('o servidor de teste não subiu em 60 s');
    try { up = (await fetch(base + '/api/status')).ok; } catch { /* ainda subindo */ }
    if (!up) await new Promise((r) => setTimeout(r, 25));
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const wait = (ms) => page.waitForTimeout(ms);
  const docNow = () => page.evaluate(async () => { const sid = sessionStorage.getItem('stylo.sid'); return (await fetch(`/api/studio/doc?sid=${sid}`)).json(); });
  const all = (list, out = []) => { for (const n of list) { out.push(n); if (n.children) all(n.children, out); } return out; };
  const layers = async () => all((await docNow()).doc.pages[0].children);
  const ofType = async (type) => (await layers()).filter((n) => n.type === type);
  const tool = (name, args) => page.evaluate(async ({ name, args }) => { const sid = sessionStorage.getItem('stylo.sid'); return (await fetch('/api/studio/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid, tool: name, args }) })).json(); }, { name, args });
  const state = () => page.evaluate(() => { const s = window.__stylo.get(); return { selection: s.selection, panX: s.panX, panY: s.panY, zoom: s.zoom }; });
  /** Mouse dentro de uma tela (iframe): eventos enviados por script (o mouse nativo sobre iframe derruba o Chromium automatizado). */
  const inBoard = (down, moves, extra = {}) => page.evaluate(async ({ down, moves, extra }) => {
    const d = document.querySelector('iframe.board-frame').contentDocument; const z = window.__stylo.get().zoom;
    const ev = (type, x, y) => new MouseEvent(type, { bubbles: true, cancelable: true, view: d.defaultView, clientX: x, clientY: y, screenX: Math.round(500 + x * z), screenY: Math.round(300 + y * z), button: 0, buttons: type === 'mouseup' ? 0 : 1, ...extra });
    (down.id ? d.querySelector(`[data-node-id="${down.id}"]`) : d.querySelector('[data-node-id]')).dispatchEvent(ev('mousedown', down.x, down.y));
    for (const m of moves) { d.dispatchEvent(ev('mousemove', m.x, m.y)); await new Promise((res) => setTimeout(res, 25)); }
    const last = moves.at(-1) ?? down; d.dispatchEvent(ev('mouseup', last.x, last.y));
  }, { down, moves, extra });

  // ---- projeto, tela e dois retângulos (um deles travado)
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Novo projeto' }).click();
  await page.getByLabel('Nome do projeto').fill('Gestos');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await page.waitForSelector('.editor');
  await page.locator('.insert-bar').getByTitle('Nova tela').click();
  const vp = await page.locator('.canvas-viewport').boundingBox();
  await page.mouse.move(vp.x + 160, vp.y + 120); await page.mouse.down(); await page.mouse.move(vp.x + 560, vp.y + 470, { steps: 8 }); await page.mouse.up();
  await page.waitForSelector('.board-frame'); await wait(900);
  const board = (await ofType('frame'))[0];
  const rects = [];
  for (const [x, y] of [[40, 40], [200, 40]]) {
    const r = await tool('create_layer', { type: 'rect', parent_id: board.id, props: { x, y, w: 100, h: 100, absolute: true } });
    rects.push(r.created.id);
  }
  const [livre, travado] = rects; // o travado é o de cima (criado por último, primeiro da lista)
  await tool('update_layer', { id: travado, props: { locked: true } });
  await page.reload(); await page.waitForSelector('.board-frame'); await wait(1200);

  // ---- girar: arrastar a zona de rotação de um canto
  await page.locator('.layer-row', { hasText: 'Retângulo' }).nth(1).click(); await wait(400); // a lista mostra o mais novo primeiro: o livre é o segundo
  const zone = await page.locator('.rot-zone').first().boundingBox();
  const sel = await page.locator('.sel-handles').first().boundingBox();
  const [zx, zy] = [zone.x + zone.width / 2, zone.y + zone.height / 2], [cx, cy] = [sel.x + sel.width / 2, sel.y + sel.height / 2];
  await page.mouse.move(zx, zy); await page.mouse.down();
  const a0 = Math.atan2(zy - cy, zx - cx);
  for (let i = 1; i <= 6; i++) { const a = a0 + (Math.PI / 6) * (i / 6), r = Math.hypot(zx - cx, zy - cy); await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  await page.mouse.up(); await wait(1200);
  const girado = (await layers()).find((n) => n.id === livre);
  assert.ok(Math.abs(girado.rotation) > 15 && Math.abs(girado.rotation) < 45, `girou cerca de 30° (rotation = ${girado.rotation})`);

  // ---- mão: arrastar no canvas vazio com a ferramenta Mão move a vista
  const before = await state();
  await page.locator('.insert-bar').getByTitle(/^Mão/).click();
  await page.mouse.move(vp.x + 700, vp.y + 600); await page.mouse.down(); await page.mouse.move(vp.x + 760, vp.y + 640, { steps: 5 }); await page.mouse.up();
  const after = await state();
  assert.ok(Math.abs(after.panX - before.panX - 60) < 2 && Math.abs(after.panY - before.panY - 40) < 2, `a vista andou 60×40 (${after.panX - before.panX}×${after.panY - before.panY})`);
  await page.locator('.insert-bar').getByTitle(/^Mover/).click();

  // ---- caixa de seleção: arrastar por cima de tudo seleciona a tela
  await page.mouse.move(vp.x + 5, vp.y + 5); await page.mouse.down(); await page.mouse.move(vp.x + 1000, vp.y + 700, { steps: 8 }); await page.mouse.up(); await wait(400);
  assert.ok((await state()).selection.includes(board.id), 'a caixa de seleção pegou a tela');

  // ---- Alt+arrastar com uma camada travada na seleção: copia só a destravada e o original fica no lugar
  const n0 = (await ofType('rect')).length;
  await tool('update_layer', { id: livre, props: { rotation: 0 } });
  await page.reload(); await page.waitForSelector('.board-frame'); await wait(1200);
  await page.locator('.layer-row', { hasText: 'Retângulo' }).nth(0).click(); // o travado
  await page.locator('.layer-row', { hasText: 'Retângulo' }).nth(1).click({ modifiers: ['Shift'] }); await wait(400);
  assert.equal((await state()).selection.length, 2, 'duas camadas selecionadas (uma travada)');
  const origin = (await layers()).find((n) => n.id === livre);
  const box = await page.evaluate((id) => { const d = document.querySelector('iframe.board-frame').contentDocument; const r = d.querySelector(`[data-node-id="${id}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, livre);
  await inBoard({ id: livre, ...box }, [{ x: box.x + 20, y: box.y + 10 }, { x: box.x + 60, y: box.y + 30 }, { x: box.x + 80, y: box.y + 40 }], { altKey: true });
  await wait(1800);
  const rectsNow = await ofType('rect');
  assert.equal(rectsNow.length, n0 + 1, 'só a camada destravada foi duplicada');
  const orig = rectsNow.find((n) => n.id === livre);
  assert.ok(Math.abs(orig.x - origin.x) < 1 && Math.abs(orig.y - origin.y) < 1, `o original ficou no lugar (${orig.x},${orig.y})`);
  const copy = rectsNow.find((n) => !rects.includes(n.id));
  assert.ok(copy && Math.abs(copy.x - origin.x) > 10, `a cópia andou (${copy?.x})`);
  // duplicar e mover é UM passo: um Ctrl+Z tira a cópia de vez
  await page.locator('.canvas-viewport').click({ position: { x: 5, y: 5 } }); await page.keyboard.press('Control+z'); await wait(1500);
  assert.equal((await ofType('rect')).length, n0, 'um Ctrl+Z desfez a duplicação inteira');

  // ---- lápis: um traço à mão vira um vetor com curvas
  const p0 = (await ofType('path')).length;
  await page.locator('.insert-bar').getByTitle(/^Lápis/).click();
  const [px, py] = [vp.x + 600, vp.y + 250];
  await page.mouse.move(px + 100, py); await page.mouse.down();
  for (let i = 1; i <= 80; i++) { const a = (i / 80) * Math.PI * 1.6; await page.mouse.move(px + Math.cos(a) * 100, py + Math.sin(a) * 100 + Math.sin(i * 1.7) * 1.5); }
  await page.mouse.up(); await wait(1500);
  const paths = await ofType('path');
  assert.equal(paths.length, p0 + 1, 'o traço virou um vetor');
  const vetor = paths.at(-1);
  assert.ok(vetor.points.length >= 3 && vetor.points.length < 30, `poucos nós (${vetor.points.length}), não um ponto por amostra`);
  assert.ok(vetor.points.some((p) => p.hin || p.hout), 'com alças de curva');
  assert.deepEqual(errors, [], 'sem erros de página');
});
