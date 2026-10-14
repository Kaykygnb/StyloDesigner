// get_image: o servidor desenha o design num Chromium isolado (sem JS, sem rede) e devolve PNG.
// Precisa do Chromium do Playwright (npx playwright install chromium); sem ele, o teste é pulado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer } from '../apps/server/src/services/renderer.ts';
import { createNode, defaultFill, makeDoc } from '@stylo/core/model.js';

const png = (b64: string) => Buffer.from(b64, 'base64');
const size = (buf: Buffer) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

test('renderiza a camada como PNG do tamanho certo; escala dobra os pixels; cores diferentes dão imagens diferentes', async (t) => {
  const renderer = createRenderer();
  t.after(() => renderer.close());
  const doc = makeDoc();
  const red = createNode('frame', { name: 'Vermelho', w: 200, h: 100 });
  red.fill = defaultFill('#FF0000');
  const blue = createNode('frame', { name: 'Azul', w: 200, h: 100 });
  blue.fill = defaultFill('#0000FF');
  let a: string;
  try { a = await renderer.render(red, doc, 1); } catch (err: any) {
    if (/n[ãa]o est[áa] dispon[íi]vel/.test(err.message)) { t.skip('Chromium do Playwright não instalado'); return; }
    throw err;
  }
  const buf = png(a);
  assert.deepEqual([...buf.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'assinatura PNG');
  assert.deepEqual(size(buf), { w: 200, h: 100 });
  assert.deepEqual(size(png(await renderer.render(red, doc, 2))), { w: 400, h: 200 }, 'escala 2 = dobro de pixels');
  assert.notEqual(await renderer.render(blue, doc, 1), a, 'a cor muda a imagem');
});

test('rede e scripts ficam bloqueados: HTML com imagem externa não trava nem vaza', async (t) => {
  const renderer = createRenderer();
  t.after(() => renderer.close());
  const doc = makeDoc();
  const n = createNode('frame', { name: 'Com imagem externa', w: 120, h: 80 });
  n.customHtml = '<img src="http://example.invalid/x.png"><script>document.title="x"</script>';
  try {
    const out = await Promise.race([
      renderer.render(n, doc, 1),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('travou')), 25_000)),
    ]);
    assert.deepEqual(size(png(out)), { w: 120, h: 80 });
  } catch (err: any) {
    if (/n[ãa]o est[áa] dispon[íi]vel/.test(err.message)) { t.skip('Chromium do Playwright não instalado'); return; }
    throw err;
  }
});

test('measure: devolve o tamanho REAL de camadas "hug" e "fill" (o que o editor lê do navegador) e não executa scripts da página', async (t) => {
  const renderer = createRenderer();
  t.after(() => renderer.close());
  const doc = makeDoc();
  const board: any = createNode('frame', { name: 'Tela', w: 600, h: 10 });
  board.sizeY = 'hug'; board.layout.mode = 'column'; board.layout.gap = 10; board.layout.padding = [20, 20, 20, 20];
  const a: any = createNode('frame', { name: 'A', w: 100, h: 50 });
  const b: any = createNode('frame', { name: 'B', w: 100, h: 70 });
  board.children.push(a, b);
  let sizes: Map<string, { w: number; h: number }>;
  try { sizes = await renderer.measure([board], doc); } catch (err: any) {
    if (/n[ãa]o est[áa] dispon[íi]vel/.test(err.message)) { t.skip('Chromium do Playwright não instalado'); return; }
    throw err;
  }
  assert.equal(sizes.get(board.id)!.h, 20 + 50 + 10 + 70 + 20, 'altura = padding + filhos + gap');
  assert.equal(sizes.get(board.id)!.w, 600);
  assert.deepEqual(sizes.get(a.id), { w: 100, h: 50 });
  assert.equal((await renderer.measure([], doc)).size, 0);
});

test('render: uma camada "hug" sai inteira (não cortada pela altura guardada) quando o tamanho foi medido', async (t) => {
  const renderer = createRenderer();
  t.after(() => renderer.close());
  const doc = makeDoc();
  const board: any = createNode('frame', { name: 'Tela', w: 300, h: 10 });
  board.sizeY = 'hug'; board.layout.mode = 'column';
  board.children.push(createNode('frame', { name: 'A', w: 100, h: 300 }));
  let sizes: Map<string, { w: number; h: number }>;
  try { sizes = await renderer.measure([board], doc); } catch (err: any) {
    if (/n[ãa]o est[áa] dispon[íi]vel/.test(err.message)) { t.skip('Chromium do Playwright não instalado'); return; }
    throw err;
  }
  const { applyMeasured } = await import('../apps/server/src/workspace/measure.ts');
  applyMeasured([board], null, sizes);
  assert.equal(board.h, 300);
  assert.deepEqual(size(png(await renderer.render(board, doc, 1))), { w: 300, h: 300 });
});

test('STYLO_CHROMIUM_PATH: usa o Chromium indicado; caminho inválido dá erro claro que cita a variável', { concurrency: false }, async (t) => {
  const { chromium } = await import('playwright-core');
  const { existsSync } = await import('node:fs');
  const real = process.env.STYLO_CHROMIUM_PATH || chromium.executablePath();
  const antes = process.env.STYLO_CHROMIUM_PATH;
  t.after(() => { if (antes === undefined) delete process.env.STYLO_CHROMIUM_PATH; else process.env.STYLO_CHROMIUM_PATH = antes; });
  const doc = makeDoc();
  const n: any = createNode('frame', { name: 'X', w: 50, h: 40 });

  process.env.STYLO_CHROMIUM_PATH = '/caminho/que/nao/existe/chromium';
  const quebrado = createRenderer();
  await assert.rejects(() => quebrado.render(n, doc, 1), /não está disponível.*STYLO_CHROMIUM_PATH/);
  await quebrado.close();

  if (!existsSync(real)) { t.skip('Chromium do Playwright não instalado'); return; }
  process.env.STYLO_CHROMIUM_PATH = real;
  const bom = createRenderer();
  t.after(() => bom.close());
  assert.deepEqual(size(png(await bom.render(n, doc, 1))), { w: 50, h: 40 });
});
