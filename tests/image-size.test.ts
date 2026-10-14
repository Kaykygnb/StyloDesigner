// Dimensões de imagem sem DOM: o servidor lê o cabeçalho dos bytes (PNG, JPEG, GIF, WebP, SVG).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageInfo, parseImageDataUrl } from '@stylo/core/image-size.ts';

const b64 = (s: string) => Uint8Array.from(Buffer.from(s, 'base64'));
// PNG 1x1 vermelho
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
// GIF 1x1
const GIF = 'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

test('PNG e GIF: largura e altura do cabeçalho', () => {
  assert.deepEqual(imageInfo(b64(PNG)), { mime: 'image/png', width: 1, height: 1 });
  assert.deepEqual(imageInfo(b64(GIF)), { mime: 'image/gif', width: 1, height: 1 });
});

test('JPEG: acha o marcador SOF mesmo depois de outros segmentos', () => {
  // SOI, APP0 (tamanho 16), SOF0 com altura 20 e largura 30
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x14, 0x00, 0x1e, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
  assert.deepEqual(imageInfo(jpeg), { mime: 'image/jpeg', width: 30, height: 20 });
});

test('WebP (VP8X): largura e altura', () => {
  const bytes = new Uint8Array(30);
  bytes.set(Buffer.from('RIFF'), 0); bytes.set(Buffer.from('WEBP'), 8); bytes.set(Buffer.from('VP8X'), 12);
  bytes[24] = 99; bytes[27] = 49; // largura 100, altura 50
  assert.deepEqual(imageInfo(bytes), { mime: 'image/webp', width: 100, height: 50 });
});

test('SVG: width/height ou viewBox; sem tamanho cai no padrão do navegador', () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  assert.deepEqual(imageInfo(enc('<svg xmlns="http://www.w3.org/2000/svg" width="120px" height="80"><rect/></svg>')), { mime: 'image/svg+xml', width: 120, height: 80 });
  assert.deepEqual(imageInfo(enc('<?xml version="1.0"?><svg viewBox="0 0 24 24"><path/></svg>')), { mime: 'image/svg+xml', width: 24, height: 24 });
  assert.deepEqual(imageInfo(enc('<svg><rect/></svg>')), { mime: 'image/svg+xml', width: 300, height: 150 });
});

test('lixo e arquivos que não são imagem dão null', () => {
  assert.equal(imageInfo(new TextEncoder().encode('isso nao e uma imagem de verdade')), null);
  assert.equal(imageInfo(new Uint8Array(3)), null);
});

test('data URL: base64 e texto, com o tipo declarado ignorado a favor do conteúdo', () => {
  const p = parseImageDataUrl(`data:image/png;base64,${PNG}`)!;
  assert.deepEqual(p.info, { mime: 'image/png', width: 1, height: 1 });
  const svg = parseImageDataUrl('data:image/svg+xml;utf8,' + encodeURIComponent('<svg width="10" height="5"/>'))!;
  assert.deepEqual(svg.info, { mime: 'image/svg+xml', width: 10, height: 5 });
  assert.equal(parseImageDataUrl('data:text/plain;base64,aGVsbG8='), null);
  assert.equal(parseImageDataUrl('http://exemplo.com/x.png'), null);
});
