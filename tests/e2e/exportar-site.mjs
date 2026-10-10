// Testa o fluxo humano: Arquivo → Exportar site completo (.zip) e abre páginas do pacote no Chromium.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1100, height: 800 } });
const editor = await context.newPage();
let siteDir;
const errors = [];
editor.on('pageerror', (error) => errors.push(error.message));
editor.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  const url = new URL('?editor', process.env.APP_URL || 'http://localhost:5173/');
  await editor.goto(url.href);
  await editor.waitForFunction(() => window.designer?.store);
  await editor.evaluate(async () => {
    const { createNode } = await import('/src/model.js');
    const store = designer.store;
    store.newDoc();
    const home = createNode('frame', { name: 'Início', w: 800, h: 600, children: [createNode('text', { name: 'Sobre', text: 'Sobre', tag: 'a', href: 'sobre.html' })] });
    const about = createNode('frame', { name: 'Sobre', w: 800, h: 600, children: [createNode('text', { text: 'Página sobre', tag: 'h1' })] });
    store.update((page) => page.children.push(home, about), { commit: true });
  });

  await editor.getByText('Arquivo', { exact: true }).click();
  const downloadWait = editor.waitForEvent('download');
  await editor.locator('.menu-item', { hasText: 'Exportar site completo (.zip)' }).click();
  const download = await downloadWait;
  assert.equal(download.suggestedFilename(), 'sem-titulo-site.zip');
  const archivePath = await download.path();
  assert.ok(archivePath, 'o navegador deve disponibilizar o pacote para leitura');
  const bytes = new Uint8Array(await readFile(archivePath));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const files = new Map();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    files.set(name, decoder.decode(bytes.subarray(dataStart, dataStart + size)));
    offset = dataStart + size;
  }
  assert.deepEqual([...files.keys()], ['index.html', 'sobre.html']);
  assert.match(files.get('index.html'), /href="sobre\.html"/);
  assert.match(files.get('sobre.html'), /Página sobre/);
  assert.doesNotMatch([...files.values()].join('\n'), /<script\b/i);
  console.log('PASS menu humano baixa ZIP com index.html e páginas nomeadas');

  const sitePage = await context.newPage();
  sitePage.on('pageerror', (error) => errors.push(error.message));
  sitePage.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  siteDir = await mkdtemp(join(tmpdir(), 'stylo-site-export-'));
  for (const [path, content] of files) await writeFile(join(siteDir, path), content, 'utf8');
  await sitePage.goto(pathToFileURL(join(siteDir, 'index.html')).href);
  assert.equal(await sitePage.locator('a').getAttribute('href'), 'sobre.html');
  await sitePage.locator('a').click();
  await sitePage.waitForFunction(() => location.pathname.endsWith('/sobre.html'));
  assert.equal(await sitePage.locator('h1').textContent(), 'Página sobre');
  assert.deepEqual(errors, []);
  console.log('PASS link do index navega à página sobre usando os arquivos extraídos');
  console.log('PASS as páginas do ZIP abrem no Chromium sem erros de console');
} finally {
  if (siteDir) await rm(siteDir, { recursive: true, force: true });
  await browser.close();
}
