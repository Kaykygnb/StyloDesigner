// Testes da matemática da IA de foto (src/imagefx.js): ajustes, filtros, remover fundo, geometria e multipart.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustPixels, toneLut, boxBlur, applyFilter, FILTERS, renderPixels, normalizeAdj, isNeutral,
  magicWand, borderColors, autoBackground, combineSelection, paintMask, paintStroke, applyMask, maskCoverage, resizeMask,
  cropForRatio, clampCrop, fitWidth, formatBytes, dataUrlBytes, planGenerative, buildMultipart, parseDataUrl,
} from '../src/imagefx.js';

/** Imagem w×h preenchida por uma função (x, y) → [r, g, b, a]. */
function img(w, h, fn) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(fn(x, y), (y * w + x) * 4);
  return d;
}
const px = (d, w, x, y) => [...d.slice((y * w + x) * 4, (y * w + x) * 4 + 4)];

test('ajustes neutros não mudam nada e devolvem cópia', () => {
  const src = img(3, 2, (x, y) => [x * 40, y * 90, 200, 255]);
  const out = adjustPixels(src, 3, 2, {});
  assert.deepEqual([...out], [...src]);
  assert.notEqual(out, src);
  assert.equal(isNeutral({ brightness: 0, blur: 0 }), true);
  assert.deepEqual(normalizeAdj({ brightness: 500, blur: -3, lixo: 1 }).brightness, 100);
  assert.equal(normalizeAdj({ blur: -3 }).blur, 0);
});

test('brilho soma, exposição multiplica, contraste afasta do cinza médio', () => {
  const src = img(1, 1, () => [100, 128, 200, 255]);
  assert.deepEqual(px(adjustPixels(src, 1, 1, { brightness: 50 }), 1, 0, 0), [164, 192, 255, 255]);
  // exposição +50 = ×2
  assert.deepEqual(px(adjustPixels(src, 1, 1, { exposure: 50 }), 1, 0, 0), [200, 255, 255, 255]);
  const c = px(adjustPixels(src, 1, 1, { contrast: 50 }), 1, 0, 0);
  assert.ok(c[0] < 100 && c[2] > 200, 'escuro fica mais escuro, claro mais claro');
  assert.equal(c[1], 128, 'o cinza médio não muda');
  const lut = toneLut({ contrast: -100 });
  assert.ok(Math.abs(lut[0] - 128) <= 1 && Math.abs(lut[255] - 128) <= 1, 'contraste -100 = tudo cinza');
});

test('saturação -100 vira cinza (luminância) e temperatura esquenta/esfria', () => {
  const src = img(1, 1, () => [200, 50, 50, 128]);
  const g = px(adjustPixels(src, 1, 1, { saturation: -100 }), 1, 0, 0);
  assert.equal(g[0], g[1]); assert.equal(g[1], g[2]);
  assert.equal(g[3], 128, 'alfa preservado');
  const warm = px(adjustPixels(src, 1, 1, { temperature: 100 }), 1, 0, 0);
  assert.ok(warm[0] > 200 && warm[2] < 50);
  const cold = px(adjustPixels(src, 1, 1, { temperature: -100 }), 1, 0, 0);
  assert.ok(cold[0] < 200 && cold[2] > 50);
});

test('desfoque espalha, conserva a média e não mexe no alfa; nitidez realça a borda', () => {
  const w = 9, h = 1;
  const src = img(w, h, (x) => (x === 4 ? [255, 255, 255, 200] : [0, 0, 0, 200]));
  const b = boxBlur(src, w, h, 1);
  assert.ok(b[4 * 4] < 255 && b[3 * 4] > 0, 'o ponto branco se espalha');
  const sum = (d) => { let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i]; return s; };
  assert.ok(Math.abs(sum(b) - 255) <= 6, 'a soma (energia) quase não muda');
  const blurred = adjustPixels(src, w, h, { blur: 2 });
  for (let i = 3; i < blurred.length; i += 4) assert.equal(blurred[i], 200);
  const edge = img(6, 1, (x) => (x < 3 ? [80, 80, 80, 255] : [160, 160, 160, 255]));
  const sh = adjustPixels(edge, 6, 1, { sharpen: 100 });
  assert.ok(sh[2 * 4] < 80 && sh[3 * 4] > 160, 'dos dois lados da borda o contraste aumenta');
});

test('filtros: P&B iguala canais, sépia puxa para o marrom, vinheta escurece cantos, força 0 = original', () => {
  const w = 5, h = 5;
  const src = img(w, h, () => [40, 120, 220, 255]);
  const pb = applyFilter(src, w, h, 'pb');
  const p = px(pb, w, 2, 2);
  assert.equal(p[0], p[1]); assert.equal(p[1], p[2]);
  const sp = px(applyFilter(src, w, h, 'sepia'), w, 2, 2);
  assert.ok(sp[0] > sp[2], 'sépia: vermelho > azul');
  const noir = applyFilter(src, w, h, 'noir');
  assert.ok(px(noir, w, 0, 0)[0] < px(noir, w, 2, 2)[0], 'canto mais escuro que o centro');
  assert.deepEqual([...applyFilter(src, w, h, 'vivo', 0)], [...src]);
  assert.deepEqual([...applyFilter(src, w, h, 'none')], [...src]);
  assert.ok(FILTERS.length >= 8 && FILTERS.every((f) => f.id && f.name));
});

test('varinha mágica: contígua para na cor diferente, global pega tudo parecido', () => {
  // listra vermelha no meio separa dois blocos brancos
  const w = 7, h = 3;
  const src = img(w, h, (x) => (x === 3 ? [255, 0, 0, 255] : [250, 250, 250, 255]));
  const sel = magicWand(src, w, h, 0, 0, 10);
  assert.equal(sel.reduce((s, v) => s + v, 0), 9, 'só o bloco da esquerda (3×3)');
  const all = magicWand(src, w, h, 0, 0, 10, false);
  assert.equal(all.reduce((s, v) => s + v, 0), 18);
  assert.equal(magicWand(src, w, h, 99, 99, 10).reduce((s, v) => s + v, 0), 0, 'fora da imagem: nada');
});

test('remover fundo automático: tira o fundo liso da borda e mantém o objeto do meio', () => {
  const w = 20, h = 16;
  // fundo verde quase liso (com ruído) e um quadrado azul no centro
  const src = img(w, h, (x, y) => (x >= 6 && x < 14 && y >= 5 && y < 11 ? [20, 40, 220, 255] : [30 + ((x * 7 + y) % 9), 200, 60, 255]));
  const cols = borderColors(src, w, h);
  assert.ok(cols.length >= 1 && cols[0].g > 180);
  const { mask, removed } = autoBackground(src, w, h, { tolerance: 20, feather: 0 });
  assert.equal(removed, w * h - 8 * 6);
  assert.equal(mask[0], 0);
  assert.equal(mask[8 * w + 10], 255);
  const out = applyMask(src, mask);
  assert.equal(out[3], 0, 'fundo transparente');
  assert.equal(out[(8 * w + 10) * 4 + 3], 255, 'objeto opaco');
  assert.ok(Math.abs(maskCoverage(mask) - removed / (w * h)) < 1e-9);
  const soft = autoBackground(src, w, h, { tolerance: 20, feather: 1 }).mask;
  assert.ok(soft.some((v) => v > 0 && v < 255), 'com suavização há valores intermediários na borda');
});

test('máscara: varinha apaga/restaura, pincel com borda macia, traço contínuo e redimensionar', () => {
  const w = 10, h = 10;
  let mask = new Uint8Array(w * h).fill(255);
  const sel = new Uint8Array(w * h); sel[0] = 1; sel[1] = 1;
  mask = combineSelection(mask, sel, 'erase');
  assert.equal(mask[0], 0); assert.equal(mask[2], 255);
  mask = combineSelection(mask, sel, 'keep');
  assert.equal(mask[0], 255);
  paintMask(mask, w, h, 5, 5, 3, 0, 0.5);
  assert.equal(mask[5 * w + 5], 0, 'centro do pincel apaga tudo');
  assert.equal(mask[0], 255, 'longe do pincel não muda');
  const edge = mask[5 * w + 7];
  assert.ok(edge > 0 && edge < 255, 'borda macia');
  const m2 = new Uint8Array(w * h).fill(255);
  paintStroke(m2, w, h, { x: 1, y: 1 }, { x: 8, y: 1 }, 1, 0, 1);
  for (let x = 1; x <= 8; x++) assert.equal(m2[1 * w + x], 0, `traço contínuo em x=${x}`);
  const big = resizeMask(new Uint8Array([0, 255, 255, 0]), 2, 2, 4, 4);
  assert.deepEqual([...big.slice(0, 4)], [0, 0, 255, 255]);
  const rp = renderPixels(img(2, 2, () => [10, 10, 10, 255]), 2, 2, { mask: new Uint8Array([0, 255, 255, 0]) });
  assert.deepEqual([rp[3], rp[7]], [0, 255]);
});

test('geometria: recorte por proporção, limites do recorte, largura máxima e tamanho em bytes', () => {
  assert.deepEqual(cropForRatio(400, 300, 1), { x: 50, y: 0, w: 300, h: 300 });
  assert.deepEqual(cropForRatio(400, 300, 16 / 9), { x: 0, y: 38, w: 400, h: 225 });
  assert.deepEqual(cropForRatio(400, 300, null), { x: 0, y: 0, w: 400, h: 300 });
  assert.deepEqual(clampCrop({ x: -20, y: 290, w: 100, h: 100 }, 400, 300), { x: 0, y: 200, w: 100, h: 100 });
  const r = clampCrop({ x: 0, y: 0, w: 300, h: 100 }, 400, 300, 1);
  assert.equal(r.w, r.h);
  assert.deepEqual(fitWidth(2000, 1000, 800), { w: 800, h: 400 });
  assert.deepEqual(fitWidth(500, 1000, 800), { w: 500, h: 1000 }, 'nunca aumenta');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(1.5 * 1024 * 1024), '1,5 MB');
  assert.equal(dataUrlBytes('data:image/png;base64,AAAA'), 3);
  assert.equal(dataUrlBytes('data:image/png;base64,AA=='), 1);
});

test('plano generativo: encaixa imagem e margens do Expandir no quadrado', () => {
  const p = planGenerative({ w: 800, h: 400 });
  assert.deepEqual(p.out, { x: 0, y: 256, w: 1024, h: 512 });
  assert.deepEqual(p.image, p.out);
  assert.equal(p.outW, 800);
  const e = planGenerative({ w: 400, h: 400, expand: { left: 200, right: 200 } });
  assert.equal(e.outW, 800); assert.equal(e.outH, 400);
  assert.deepEqual(e.out, { x: 0, y: 256, w: 1024, h: 512 });
  assert.deepEqual(e.image, { x: 256, y: 256, w: 512, h: 512 });
  assert.equal(planGenerative({ w: 10, h: 10, expand: { top: -50 } }).outH, 10, 'margem negativa vira 0');
});

test('multipart: partes de texto e arquivo, separador e cabeçalhos corretos', () => {
  const png = new Uint8Array([137, 80, 78, 71, 0, 255]);
  const { body, contentType, boundary } = buildMultipart([
    { name: 'model', value: 'gpt-image-1' },
    { name: 'prompt', value: 'um gato "laranja"\r\nnovo' },
    { name: 'image', data: png, filename: 'imagem.png', type: 'image/png' },
    { name: 'vazio' },
  ], 'XYZ');
  assert.equal(boundary, 'XYZ');
  assert.equal(contentType, 'multipart/form-data; boundary=XYZ');
  const text = Buffer.from(body).toString('latin1');
  assert.ok(text.startsWith('--XYZ\r\nContent-Disposition: form-data; name="model"\r\n\r\ngpt-image-1\r\n'));
  assert.ok(text.includes('name="prompt"\r\n\r\num gato "laranja"\r\nnovo\r\n'), 'o valor vai como está');
  assert.ok(text.includes('name="image"; filename="imagem.png"\r\nContent-Type: image/png\r\n\r\n'));
  assert.ok(Buffer.from(body).includes(Buffer.from(png)), 'os bytes do arquivo entram sem mudança');
  assert.ok(!text.includes('name="vazio"'), 'parte sem valor é ignorada');
  assert.ok(text.endsWith('--XYZ--\r\n'));
  assert.equal(text.split('--XYZ\r\n').length - 1, 3);
  assert.deepEqual(parseDataUrl('data:image/png;base64,QUJD'), { type: 'image/png', b64: 'QUJD' });
  assert.equal(parseDataUrl('data:text/html;base64,QUJD'), null);
  assert.equal(parseDataUrl('javascript:alert(1)'), null);
});
