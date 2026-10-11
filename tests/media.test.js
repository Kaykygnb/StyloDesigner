import test from 'node:test';
import assert from 'node:assert/strict';
import { createNode } from '@stylo/core/model.ts';
import { exportHtml } from '@stylo/core/css.js';
import { exportSite } from '@stylo/core/site-export.ts';

const tiny = 'data:video/mp4;base64,AAAA';

test('camada de mídia tem contrato geral para vídeo, áudio, 3D e Lottie', () => {
  for (const kind of ['video', 'audio', 'model3d', 'lottie']) {
    const node = createNode('media', { mediaKind: kind, mediaAssetId: 'a1' });
    assert.equal(node.type, 'media');
    assert.equal(node.mediaKind, kind);
    assert.equal(node.mediaAssetId, 'a1');
  }
});

test('exportHtml escreve o elemento correspondente e não deixa a mídia como div vazio', () => {
  const cases = [
    ['video', '<video', 'controls'],
    ['audio', '<audio', 'controls'],
    ['model3d', '<model-viewer', 'camera-controls'],
    ['lottie', 'data-lottie-src', '']
  ];
  for (const [kind, tag, attr] of cases) {
    const html = exportHtml(createNode('media', { mediaKind: kind, mediaAssetId: 'a1' }), { a1: tiny });
    assert.match(html, new RegExp(tag));
    if (attr) assert.match(html, new RegExp(attr));
    assert.match(html, /data:video\/mp4/);
  }
});

test('exportSite externaliza asset de mídia usado pela camada', () => {
  const board = createNode('frame', { name: 'Página' });
  board.children.push(createNode('media', { mediaKind: 'video', mediaAssetId: 'a1' }));
  const doc = { pages: [{ name: 'Página 1', children: [board] }], assets: { a1: tiny }, styles: {} };
  const result = exportSite(doc);
  assert.ok(result.files.some((f) => f.path.startsWith('assets/') && f.content instanceof Uint8Array));
  const html = result.files.find((f) => f.path === 'index.html').content;
  assert.equal(typeof html, 'string');
  assert.match(html, /<video/);
  assert.doesNotMatch(html, /data:video\/mp4/);
});

test('exportSite leva os players de 3D e Lottie para vendor/ só nas páginas que usam, sem CDN', () => {
  const board = createNode('frame', { name: 'Página' });
  board.children.push(createNode('media', { mediaKind: 'model3d', mediaAssetId: 'm1' }), createNode('media', { mediaKind: 'lottie', mediaAssetId: 'l1', mediaAutoplay: true, mediaLoop: true }));
  const doc = { pages: [{ name: 'P', children: [board] }], assets: { m1: 'data:model/gltf-binary;base64,AAAA', l1: 'data:application/json;base64,e30=' }, styles: {} };
  const vendor = (n) => new Uint8Array([1, 2, 3, n.length]);
  const { files, warnings } = exportSite(doc, { vendor });
  const html = files.find((f) => f.path === 'index.html').content;
  assert.match(html, /vendor\/model-viewer\.min\.js/);
  assert.match(html, /vendor\/lottie_light\.min\.js/);
  assert.match(html, /data-loop/);
  assert.doesNotMatch(html, /https?:\/\/[^"]*(unpkg|jsdelivr|cdn)/);
  for (const p of ['vendor/model-viewer.min.js', 'vendor/lottie_light.min.js', 'vendor/stylo-lottie.js']) assert.ok(files.some((f) => f.path === p), p);
  assert.deepEqual(warnings.filter((w) => /player/.test(w)), []);
  // sem o fornecedor: avisa em vez de falhar calado
  assert.ok(exportSite(doc).warnings.some((w) => /player/.test(w)));
  // vídeo puro não precisa de nada
  const only = createNode('frame', { name: 'V' }); only.children.push(createNode('media', { mediaKind: 'video', mediaAssetId: 'v' }));
  const r = exportSite({ pages: [{ name: 'P', children: [only] }], assets: { v: 'data:video/mp4;base64,AAAA' }, styles: {} }, { vendor });
  assert.ok(!r.files.some((f) => f.path.startsWith('vendor/')));
  assert.ok(r.files.some((f) => /^assets\/media-/.test(f.path)));
});

test('applyProps: opções de mídia só valem em camada de mídia e precisam ser booleanas', async () => {
  const { applyProps } = await import('@stylo/core/tools/runner.js');
  const m = createNode('media', { mediaKind: 'video', mediaAssetId: 'v' });
  applyProps(m, { mediaAutoplay: true, mediaMuted: true, mediaLoop: true, mediaControls: false });
  assert.deepEqual([m.mediaAutoplay, m.mediaMuted, m.mediaLoop, m.mediaControls], [true, true, true, false]);
  assert.match(exportHtml(m, { v: 'data:video/mp4;base64,AAAA' }), /<video[^>]* autoplay loop muted/);
  assert.throws(() => applyProps(m, { mediaLoop: 'sim' }), /true ou false/);
  assert.throws(() => applyProps(createNode('rect'), { mediaLoop: true }), /só vale para camadas de mídia/);
});
