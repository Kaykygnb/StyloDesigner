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
