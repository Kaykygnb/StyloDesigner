import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRenderer } from '../apps/server/src/services/renderer.ts';
import { createImageOperations } from '../apps/server/src/services/image-operations.ts';
import { prepareImage, readPixels } from '../apps/server/src/services/image-codec.ts';
import { createStore } from '@stylo/core/store.js';
import { createNode, makeDoc } from '@stylo/core/model.js';
import { applyImageToNode, restoreImageOriginal } from '@stylo/core/image-edit.ts';
import { createRunner } from '@stylo/core/tools/runner.js';

const svg = (body: string) => 'data:image/svg+xml;base64,' + Buffer.from(body).toString('base64');
test('fila de imagens é limitada e libera vagas após uma falha', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const ops = createImageOperations({ withImagePage: async () => { await gate; throw new Error('Falha controlada de codec'); } });
  const source = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
  const accepted = Array.from({ length: 4 }, () => ops.editImageLocal(source).catch((error) => error));
  await assert.rejects(ops.editImageLocal(source), /edições.*andamento.*Aguarde/);
  release();
  assert.ok((await Promise.all(accepted)).every((error) => /Falha controlada de codec/.test(error.message)));
  await assert.rejects(ops.editImageLocal(source), /Falha controlada de codec/);
});
async function fixture(renderer: ReturnType<typeof createRenderer>, kind = 'stripes') {
  return renderer.withImagePage((page) => page.evaluate((kind: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = kind === 'background' ? 64 : 12; canvas.height = kind === 'background' ? 64 : 8;
    const ctx = canvas.getContext('2d')!;
    if (kind === 'background') {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#f00'; ctx.fillRect(20, 20, 24, 24);
    } else if (kind === 'transparent') {
      ctx.fillStyle = '#f00'; ctx.fillRect(4, 0, 4, 8);
    } else {
      for (const [index, color] of ['#f00', '#0f0', '#00f'].entries()) {
        ctx.fillStyle = color; ctx.fillRect(index * 4, 0, 4, 8);
      }
    }
    return canvas.toDataURL('image/png');
  }, kind));
}
async function pixels(renderer: ReturnType<typeof createRenderer>, source: string) {
  return renderer.withImagePage(async (page) => {
    const dims = await prepareImage(page, source);
    return { ...dims, data: await readPixels(page) };
  });
}
const at = (image: { w: number; data: Uint8ClampedArray }, x: number, y: number) => [...image.data.slice((y * image.w + x) * 4, (y * image.w + x) * 4 + 4)];
async function browserFixture(t: any) {
  const renderer = createRenderer(); t.after(() => renderer.close());
  try { return { renderer, source: await fixture(renderer), ops: createImageOperations(renderer) }; }
  catch (error: any) {
    if (/não está disponível/.test(error.message)) { t.skip('Chromium indisponível; configure STYLO_CHROMIUM_PATH ou instale o navegador'); return null; }
    throw error;
  }
}

test('edição local recusa URL, bytes inválidos e opções inválidas antes de abrir navegador', async () => {
  let pages = 0;
  const ops = createImageOperations({ withImagePage: async () => { pages++; throw new Error('não deveria abrir'); } });
  await assert.rejects(ops.editImageLocal('http://localhost/foto.png'), /apenas.*imagem.*projeto/);
  await assert.rejects(ops.editImageLocal('data:image/png;base64,aGVsbG8='), /ler esta imagem/);
  assert.equal(pages, 0);
});

test('rotação e espelhamento movem os pixels coloridos aos lados corretos', async (t) => {
  const env = await browserFixture(t); if (!env) return;
  const { renderer, source, ops } = env;
  const rotated = await pixels(renderer, (await ops.editImageLocal(source, { rotate: 90 })).dataUrl);
  assert.deepEqual({ w: rotated.w, h: rotated.h }, { w: 8, h: 12 });
  assert.deepEqual(at(rotated, 3, 1), [255, 0, 0, 255]);
  assert.deepEqual(at(rotated, 3, 10), [0, 0, 255, 255]);
  const flipped = await pixels(renderer, (await ops.editImageLocal(source, { flip_h: true })).dataUrl);
  assert.deepEqual(at(flipped, 1, 3), [0, 0, 255, 255]);
  assert.deepEqual(at(flipped, 10, 3), [255, 0, 0, 255]);
  const vertical = await pixels(renderer, (await ops.editImageLocal(source, { rotate: 90, flip_v: true })).dataUrl);
  assert.deepEqual(at(vertical, 3, 1), [0, 0, 255, 255]);
});

test('recorte, proporção e largura máxima conservam geometria e conteúdo', async (t) => {
  const env = await browserFixture(t); if (!env) return;
  const { renderer, source, ops } = env;
  const crop = await pixels(renderer, (await ops.editImageLocal(source, { crop: { x: 4, y: 0, w: 8, h: 8 } })).dataUrl);
  assert.deepEqual({ w: crop.w, h: crop.h }, { w: 8, h: 8 });
  assert.deepEqual(at(crop, 1, 3), [0, 255, 0, 255]);
  assert.deepEqual(at(crop, 6, 3), [0, 0, 255, 255]);
  const square = await ops.editImageLocal(source, { ratio: '1:1' });
  assert.deepEqual({ w: square.w, h: square.h }, { w: 8, h: 8 });
  const small = await ops.editImageLocal(source, { max_width: 6 });
  assert.deepEqual({ w: small.w, h: small.h }, { w: 6, h: 4 });
  await assert.rejects(ops.editImageLocal(source, { max_width: 0 }), /max_width/);
});

test('PNG/WebP preservam transparência, JPEG usa fundo branco e MIME declarado é corrigido', async (t) => {
  const env = await browserFixture(t); if (!env) return;
  const { renderer, ops, source } = env;
  const transparent = await fixture(renderer, 'transparent');
  for (const format of ['png', 'webp', 'jpeg'] as const) {
    const result = await ops.editImageLocal(transparent, { format });
    assert.match(result.dataUrl, new RegExp(`^data:image/${format};base64,`));
    assert.equal(result.bytes, Buffer.from(result.dataUrl.split(',')[1], 'base64').length);
    const image = await pixels(renderer, result.dataUrl);
    if (format === 'jpeg') assert.ok(at(image, 0, 3).slice(0, 3).every((n) => n > 240));
    else assert.equal(at(image, 0, 3)[3], 0);
  }
  const mislabeled = source.replace('image/png', 'image/jpeg');
  assert.match((await ops.editImageLocal(mislabeled, { flip_h: true })).dataUrl, /^data:image\/png;/);
});

test('filtro P&B iguala canais; brilho clareia; remoção simples mantém objeto e apaga fundo', async (t) => {
  const env = await browserFixture(t); if (!env) return;
  const { renderer, source, ops } = env;
  const gray = at(await pixels(renderer, (await ops.editImageLocal(source, { filter: 'pb' })).dataUrl), 1, 3);
  assert.equal(gray[0], gray[1]); assert.equal(gray[1], gray[2]); assert.ok(gray[0] > 0 && gray[0] < 255);
  const bright = at(await pixels(renderer, (await ops.editImageLocal(source, { adjust: { brightness: 50 } })).dataUrl), 1, 3);
  assert.ok(bright[1] > 50 && bright[2] > 50); assert.equal(bright[3], 255);
  const removed = await ops.editImageLocal(await fixture(renderer, 'background'), { remove_background: true, format: 'jpeg' });
  assert.match(removed.dataUrl, /^data:image\/png;/); assert.ok(removed.removed! > 50);
  const image = await pixels(renderer, removed.dataUrl);
  assert.equal(at(image, 0, 0)[3], 0); assert.deepEqual(at(image, 32, 32), [255, 0, 0, 255]);
});

test('imagem decodificada acima do limite é recusada; SVG ativo não executa nem acessa rede', async (t) => {
  const env = await browserFixture(t); if (!env) return;
  const { renderer, ops } = env;
  const simpleSvg = svg('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"><rect width="12" height="8" fill="red"/></svg>');
  const rasterized = await ops.editImageLocal(simpleSvg, { flip_h: true });
  assert.match(rasterized.dataUrl, /^data:image\/png;/);
  assert.deepEqual(at(await pixels(renderer, rasterized.dataUrl), 3, 3), [255, 0, 0, 255]);
  const huge = await renderer.withImagePage((page) => page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 8193; c.height = 1; return c.toDataURL();
  }));
  await assert.rejects(ops.editImageLocal(huge), /8192|limite|excede/);
  await assert.rejects(ops.editImageLocal(svg('<svg xmlns="http://www.w3.org/2000/svg" width="8193" height="1"/>')));
  let requests = 0;
  const server = createServer((_request, response) => { requests++; response.end('unexpected'); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const port = (server.address() as any).port;
  const malicious = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"><script>fetch('http://127.0.0.1:${port}/script')</script><image href="http://127.0.0.1:${port}/image"/><foreignObject width="12" height="8"><img xmlns="http://www.w3.org/1999/xhtml" src="http://127.0.0.1:${port}/html" onerror="fetch('http://127.0.0.1:${port}/event')"/></foreignObject></svg>`);
  // Rejeitar SVG é seguro; se houver suporte, a imagem deve continuar isolada.
  try { await ops.editImageLocal(malicious, { format: 'png' }); } catch (error: any) { assert.match(error.message, /imagem|SVG|data URL/); }
  assert.equal(requests, 0);
});

function imageStore() {
  const store = createStore({ initial: { doc: makeDoc() } });
  const node: any = createNode('rect');
  node.fill = { type: 'image', assetId: 'original', natW: 12, natH: 8 };
  store.addAsset('original', 'original-data');
  store.update((page: any) => page.children.push(node)); store.commit();
  return { store, id: node.id };
}
const edited = { dataUrl: 'edited-data', w: 8, h: 12, bytes: 10 };
test('executor preserva primeira original nas edições e restaura dimensões com um passo de desfazer/refazer', async () => {
  const { store, id } = imageStore();
  const imageOps = {
    async editImageLocal() { return edited; }, applyImageToNode,
    async restoreOriginal(store: any, id: string, options: any) { options.beforeApply?.(); restoreImageOriginal(store, id, { w: 12, h: 8 }, options); return true; },
  };
  const runner = createRunner({ store, commands: {}, imageOps, approve: async () => true });
  for (let i = 0; i < 2; i++) {
    assert.equal((await runner.run('edit_image', { id, rotate: 90 })).ok, true);
    assert.equal(store.get(id).fill.origAssetId, 'original');
  }
  const second = store.get(id).fill.assetId;
  store.undo(); assert.notEqual(store.get(id).fill.assetId, second);
  store.redo(); assert.equal(store.get(id).fill.assetId, second);
  assert.equal((await runner.run('edit_image', { id, restore_original: true })).ok, true);
  assert.deepEqual(store.get(id).fill, { type: 'image', assetId: 'original', natW: 12, natH: 8 });
  store.undo(); assert.equal(store.get(id).fill.assetId, second);
  store.redo(); assert.equal(store.get(id).fill.assetId, 'original');
});

test('resultado atrasado não sobrescreve imagem trocada durante edição', async () => {
  const { store, id } = imageStore();
  let resolve!: (value: typeof edited) => void; let started!: () => void;
  const pending = new Promise<typeof edited>((done) => { resolve = done; });
  const entered = new Promise<void>((done) => { started = done; });
  const runner = createRunner({ store, commands: {}, approve: async () => true, imageOps: {
    editImageLocal: async () => { started(); return pending; }, applyImageToNode, restoreOriginal: async () => false,
  } });
  const operation = runner.run('edit_image', { id, rotate: 90 }); await entered;
  store.addAsset('replacement', 'new-data');
  store.update(() => { store.get(id).fill.assetId = 'replacement'; });
  resolve(edited);
  const result = await operation;
  assert.match(result.error, /mudou enquanto/);
  assert.equal(store.get(id).fill.assetId, 'replacement');
  assert.equal(Object.values(store.state.doc.assets).includes('edited-data'), false);
});

test('falha de edição não altera assets, camada nem histórico', async () => {
  const { store, id } = imageStore();
  const before = JSON.stringify(store.state.doc);
  const runner = createRunner({ store, commands: {}, approve: async () => true, imageOps: {
    editImageLocal: async () => { throw new Error('Arquivo danificado'); }, applyImageToNode, restoreOriginal: async () => false,
  } });
  assert.match((await runner.run('edit_image', { id, rotate: 90 })).error, /Arquivo danificado/);
  assert.equal(JSON.stringify(store.state.doc), before);
  store.undo(); assert.equal(store.page().children.length, 0, 'falha não adiciona um passo ao histórico');
});

test('limite de efeitos rejeita mais de 4 milhões de pixels e permite reduzir antes', async (t) => {
  const env = await browserFixture(t); if (!env) return;
  const { renderer, ops } = env;
  const large = await renderer.withImagePage((page) => page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 2001; c.height = 2000;
    c.getContext('2d')!.fillRect(0, 0, c.width, c.height); return c.toDataURL();
  }));
  await assert.rejects(ops.editImageLocal(large, { filter: 'pb' }), /4 milhões|2000|4_000_000/);
  const reduced = await ops.editImageLocal(large, { max_width: 100 });
  const filtered = await ops.editImageLocal(reduced.dataUrl, { filter: 'pb' });
  assert.equal(filtered.w, 100); assert.equal(filtered.h, 100);
});

test('edição sem Chromium disponível devolve erro claro e não grava imagem', async (t) => {
  const previous = process.env.STYLO_CHROMIUM_PATH;
  process.env.STYLO_CHROMIUM_PATH = '/nao-existe/stylo-chromium';
  t.after(() => { if (previous === undefined) delete process.env.STYLO_CHROMIUM_PATH; else process.env.STYLO_CHROMIUM_PATH = previous; });
  const renderer = createRenderer(); t.after(() => renderer.close());
  const source = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
  await assert.rejects(createImageOperations(renderer).editImageLocal(source), /não está disponível.*STYLO_CHROMIUM_PATH/);
});

test('original danificada na restauração dá mensagem simples sem alterar a foto', async (t) => {
  const env = await browserFixture(t); if (!env) return;
  const broken = Buffer.alloc(24);
  broken.set([0x89, 0x50, 0x4e, 0x47]); broken.writeUInt32BE(1, 16); broken.writeUInt32BE(1, 20);
  const { store, id } = imageStore();
  store.state.doc.assets.original = 'data:image/png;base64,' + broken.toString('base64');
  applyImageToNode(store, id, { ...edited, dataUrl: env.source });
  const before = JSON.stringify(store.state.doc);
  await assert.rejects(env.ops.restoreOriginal(store, id), (error: any) => {
    assert.match(error.message, /^Não foi possível abrir a imagem.*Importe/);
    assert.ok(!error.message.includes('page.evaluate'));
    return true;
  });
  assert.equal(JSON.stringify(store.state.doc), before);
});

test('geração indisponível é recusada antes de rede ou aprovação', async (t) => {
  const { store, id } = imageStore();
  let fetched = 0, approvals = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { fetched++; throw new Error('rede inesperada'); }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const runner = createRunner({ store, commands: {}, approve: async () => { approvals++; return true; }, imageOps: {
    editImageLocal: async () => edited, applyImageToNode, restoreOriginal: async () => false,
  } });
  const before = JSON.stringify(store.state.doc);
  const result = await runner.run('generate_image_edit', { id, mode: 'replace', prompt: 'Trocar fundo' });
  assert.match(result.error, /generativa.*não está disponível/);
  assert.equal(fetched, 0); assert.equal(approvals, 0); assert.equal(JSON.stringify(store.state.doc), before);
});
