import test from 'node:test';
import assert from 'node:assert/strict';
import { createNode } from '../src/model.js';
import { exportHtml } from '../src/css.js';
import { commercialLicense, normalizeOpenverse, normalizePexels, normalizeResults, validateProxyUrl, validateImageResponse, boundedPhotoBytes, createPhotosHandler, MAX_PHOTO_BYTES } from '../server/photos.js';

test('normaliza campos do Openverse e Pexels no formato comum', () => {
  const [openverse, pexels] = normalizeResults([
    { id: 'abc', license_type: 'commercial', license: 'by-sa', url: 'https://upload.wikimedia.org/a.jpg', thumbnail: 'https://media.openverse.org/thumb.jpg', width: 800, height: 600, creator: 'Ana', creator_url: 'https://example.org/ana', foreign_landing_url: 'https://example.org/foto', license_url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  ], [
    { id: 42, url: 'https://www.pexels.com/photo/42/', photographer: 'Bia', photographer_url: 'https://www.pexels.com/@bia', width: 1000, height: 700, src: { medium: 'https://images.pexels.com/medium.jpg', large: 'https://images.pexels.com/large.jpg' } },
  ]);
  assert.deepEqual([openverse.id, openverse.provider, openverse.thumb, openverse.full, openverse.width, openverse.height], ['openverse:abc', 'Openverse', 'https://media.openverse.org/thumb.jpg', 'https://upload.wikimedia.org/a.jpg', 800, 600]);
  assert.equal(openverse.author, 'Ana');
  assert.equal(openverse.attributionRequired, true);
  assert.deepEqual([pexels.id, pexels.provider, pexels.thumb, pexels.full, pexels.author, pexels.license], ['pexels:42', 'Pexels', 'https://images.pexels.com/medium.jpg', 'https://images.pexels.com/large.jpg', 'Bia', 'Pexels']);
  assert.equal(pexels.attributionRequired, false);
});

test('filtra licenças Openverse que permitem uso comercial', () => {
  assert.equal(commercialLicense({ license_type: 'commercial', license: 'by' }), true);
  assert.equal(commercialLicense({ license_type: 'noncommercial', license: 'by-nc' }), false);
  assert.equal(commercialLicense({ license: 'by-nc-sa' }), false);
  assert.equal(commercialLicense({ license: 'by-sa' }), true);
  const items = normalizeResults([
    { id: 'ok', license_type: 'commercial', license: 'by', url: 'https://upload.wikimedia.org/a.jpg', thumbnail: 'https://media.openverse.org/a.jpg' },
    { id: 'nc', license_type: 'noncommercial', license: 'by-nc', url: 'https://upload.wikimedia.org/b.jpg', thumbnail: 'https://media.openverse.org/b.jpg' },
  ]);
  assert.deepEqual(items.map((x) => x.id), ['openverse:ok']);
  assert.equal(normalizeOpenverse({ id: 'x', license: 'cc0', url: 'x', thumbnail: 'y' }).attributionRequired, false);
});

test('valida hosts permitidos e bloqueia destinos externos e inseguros no proxy', () => {
  assert.equal(validateProxyUrl('https://media.openverse.org/image.jpg').hostname, 'media.openverse.org');
  assert.equal(validateProxyUrl('https://images.pexels.com/photos/a.jpeg').hostname, 'images.pexels.com');
  for (const url of ['http://media.openverse.org/a.jpg', 'https://localhost/a', 'https://127.0.0.1/a', 'https://evil.example/a', 'https://media.openverse.org.evil.example/a', 'https://user@media.openverse.org/a', 'https://media.openverse.org:444/a']) {
    assert.throws(() => validateProxyUrl(url), /inválida|permitido/);
  }
  assert.throws(() => validateProxyUrl('https://sub.media.openverse.org/a.jpg'), /permitido/);
});

test('valida tipo de conteúdo e tamanho anunciado para o proxy', () => {
  assert.doesNotThrow(() => validateImageResponse('image/jpeg', '2048'));
  assert.doesNotThrow(() => validateImageResponse('image/bmp', '2048'));
  assert.throws(() => validateImageResponse('text/html', '30'), /tipo de imagem/);
  assert.throws(() => validateImageResponse('application/octet-stream', '30'), /tipo de imagem/);
  assert.throws(() => validateImageResponse('image/png', String(MAX_PHOTO_BYTES + 1)), /8 MB/);
});

test('limita bytes efetivamente recebidos e aceita fetch simulado sem internet', async () => {
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); controller.close(); } });
  const bytes = await boundedPhotoBytes(new Response(body, { headers: { 'content-type': 'image/png' } }));
  assert.deepEqual([...bytes], [1, 2, 3]);
  const tooLarge = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_PHOTO_BYTES + 1)); controller.close(); } });
  await assert.rejects(() => boundedPhotoBytes(new Response(tooLarge, { headers: { 'content-type': 'image/png' } })), /8 MB/);
  await assert.rejects(() => boundedPhotoBytes(new Response('x', { headers: { 'content-type': 'text/html' } })), /tipo de imagem/);
});

test('exporta crédito obrigatório como comentário e title, sem exigir atribuição para Pexels', () => {
  const layer = createNode('rect', { photoCredit: { author: 'Ana', attribution: 'Ana · by-sa', attributionRequired: true } });
  const html = exportHtml(layer, {});
  assert.match(html, /<!-- Crédito da foto: Ana · by-sa -->/);
  assert.match(html, /title="Ana · by-sa"/);
  layer.photoCredit = { author: 'Bia', attribution: 'Bia · Pexels', attributionRequired: false };
  const pexels = exportHtml(layer, {});
  assert.doesNotMatch(pexels, /Crédito da foto/);
  assert.doesNotMatch(pexels, /title="Bia · Pexels"/);
});

test('handler do proxy usa fetch falso e valida cada redirecionamento antes de buscar', async () => {
  let calls = 0;
  const handler = createPhotosHandler({ fetchImpl: async () => {
    calls++;
    return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } });
  } });
  const res = {
    headersSent: false, status: 0, headers: {}, body: null,
    writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; },
    end(body) { this.body = body; },
  };
  await handler({ method: 'GET', url: '/api/photos/fetch?url=' + encodeURIComponent('https://images.pexels.com/a.jpg') }, res);
  assert.equal(calls, 1);
  assert.equal(res.status, 502);
  assert.match(JSON.parse(res.body).error, /permitido/);
});

test('busca sem internet traduz filtros de orientação e pede apenas licença comercial', async () => {
  let requested;
  const handler = createPhotosHandler({ fetchImpl: async (url) => {
    requested = new URL(url);
    return new Response(JSON.stringify({ results: [{ id: 'fake', license_type: 'commercial', license: 'by', url: 'https://upload.wikimedia.org/fake.jpg', thumbnail: 'https://api.openverse.org/v1/images/fake/thumb/', creator: 'Ana' }] }), { headers: { 'content-type': 'application/json' } });
  } });
  const res = { headersSent: false, status: 0, body: null, writeHead(status) { this.status = status; this.headersSent = true; }, end(body) { this.body = body; } };
  await handler({ method: 'GET', url: '/api/photos/search?q=montanha&page=2&orientation=landscape' }, res);
  assert.equal(requested.searchParams.get('q'), 'montanha');
  assert.equal(requested.searchParams.get('page'), '2');
  assert.equal(requested.searchParams.get('license_type'), 'commercial');
  assert.equal(requested.searchParams.get('aspect_ratio'), 'wide');
  assert.equal(JSON.parse(res.body).results[0].author, 'Ana');
});
