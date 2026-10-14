import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRenderer } from '../apps/server/src/services/renderer.ts';
import { inspectPage } from '../apps/server/src/services/layout-inspection.ts';
import { exportHtml } from '@stylo/core/css.js';
import { createNode } from '@stylo/core/model.js';

test('inspeção mede exportação real por largura: padding, gap, ancestral oculto, clipping e IDs especiais', async (t) => {
  const renderer = createRenderer(); t.after(() => renderer.close());
  const root: any = createNode('frame', { name: 'Tela', w: 800, h: 300 });
  root.layout.mode = 'column'; root.layout.padding = [10, 20, 10, 20]; root.layout.gap = 12;
  const text: any = createNode('text', { name: 'Texto', w: 100, h: 30 }); text.text = 'Texto privado';
  const hidden: any = createNode('frame', { name: 'Oculto', w: 100, h: 30 });
  const child: any = createNode('rect', { name: 'Filho', w: 50, h: 20 }); hidden.children.push(child);
  const clip: any = createNode('frame', { name: 'Recorte', w: 100, h: 30 });
  const wide: any = createNode('rect', { name: 'Largo', w: 300, h: 40 }); clip.children.push(wide);
  root.children.push(text, hidden, clip);
  const tricky = 'id"[]:#\\';
  const initialHtml = exportHtml(root, {}, 'Teste', null, { ids: true });
  // Keep exporter output, then use static fixture CSS to isolate responsive measurement behavior.
  const html = initialHtml.replace('</head>', `<style>[data-node-id="${root.id}"]{width:100%;height:300px}[data-node-id="${hidden.id}"]{display:none}[data-node-id="${clip.id}"]{overflow:hidden;position:relative}[data-node-id="${wide.id}"]{position:absolute;left:0;top:0;width:300px;height:40px}@media(max-width:500px){[data-node-id="${text.id}"]{font-size:24px}}</style></head>`);
  try {
    await renderer.withImagePage(async (page) => {
      await page.setViewportSize({ width: 800, height: 600 }); await page.setContent(html);
      await page.evaluate(({ id, tricky }: any) => { for (const el of document.querySelectorAll('[data-node-id]')) if (el.getAttribute('data-node-id') === id) el.setAttribute('data-node-id', tricky); }, { id: text.id, tricky });
      const desktop = await inspectPage(page, root.id, [tricky, child.id, clip.id, wide.id, 'inexistente'], 800);
      assert.equal(desktop.root.w, 800);
      assert.equal(desktop.layers[0].box!.x, 20); assert.equal(desktop.layers[0].box!.y, 10);
      assert.equal(desktop.layers[0].parentId, root.id);
      assert.equal(desktop.layers[1].rendered, false); assert.equal(desktop.layers[1].box, null);
      assert.equal(desktop.layers[2].overflow!.contentX, true); assert.equal(desktop.layers[3].overflow!.parent, true);
      assert.equal(desktop.layers[4].rendered, false);
      assert.ok(!JSON.stringify(desktop).includes('Texto privado'));
      const parent = await inspectPage(page, root.id, [root.id], 800);
      assert.deepEqual(parent.layers[0].layout!.padding, ['10px', '20px', '10px', '20px']); assert.equal(parent.layers[0].layout!.rowGap, '12px');
      await page.setViewportSize({ width: 390, height: 600 }); await page.setContent(html);
      const mobile = await inspectPage(page, root.id, [text.id], 390);
      assert.equal(mobile.root.w, 390); assert.equal(mobile.layers[0].typography!.fontSize, '24px');
      await assert.rejects(inspectPage(page, root.id, Array(101).fill(text.id), 390), /100/);
    });
  } catch (error: any) { if (/não está disponível/.test(error.message)) t.skip('Configure STYLO_CHROMIUM_PATH'); else throw error; }
});

test('inspeção mantém scripts e rede bloqueados na página isolada', async (t) => {
  let requests = 0;
  const server = createServer((_request, response) => { requests++; response.end('unexpected'); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const renderer = createRenderer(); t.after(() => renderer.close());
  const root: any = createNode('frame', { w: 100, h: 100 });
  const port = (server.address() as any).port;
  const html = exportHtml(root, {}, 'Isolamento', null, { ids: true }).replace('</body>', `<script>document.body.dataset.executed='yes';fetch('http://127.0.0.1:${port}/script')</script><img src="http://127.0.0.1:${port}/image"></body>`);
  try {
    await renderer.withImagePage(async (page) => {
      await page.setContent(html); const result = await inspectPage(page, root.id, [root.id], 1280);
      assert.equal(result.layers[0].rendered, true);
      assert.equal(await page.evaluate(() => document.body.dataset.executed), undefined);
    });
    assert.equal(requests, 0);
  } catch (error: any) { if (/não está disponível/.test(error.message)) t.skip('Configure STYLO_CHROMIUM_PATH'); else throw error; }
});

test('HTML manual não falsifica identificadores; invisibilidade mantém a geometria', async (t) => {
  const renderer = createRenderer(); t.after(() => renderer.close());
  const root: any = createNode('frame', { w: 500, h: 300 }); root.layout.mode = 'column';
  const manual: any = createNode('html', { w: 200, h: 50 });
  const sibling: any = createNode('rect', { w: 80, h: 20 });
  manual.html = `<div data-node-id="${sibling.id}" style="width:999px;height:999px">Falso</div>`;
  const invisible: any = createNode('frame', { w: 100, h: 30 });
  const transparent: any = createNode('frame', { w: 100, h: 30 });
  const child: any = createNode('rect', { w: 50, h: 20 }); transparent.children.push(child);
  root.children.push(manual, sibling, invisible, transparent);
  const html = exportHtml(root, {}, 'IDs seguros', null, { ids: true }).replace('</head>', `<style>[data-node-id="${invisible.id}"]{visibility:hidden}[data-node-id="${transparent.id}"]{opacity:0}</style></head>`);
  try {
    await renderer.withImagePage(async (page) => {
      await page.setContent(html);
      const result = await inspectPage(page, root.id, [manual.id, sibling.id, invisible.id, child.id], 1280, [manual.id]);
      assert.equal(result.layers[0].box!.w, 200);
      assert.equal(result.layers[1].box!.w, 80);
      assert.equal(result.layers[1].parentId, root.id);
      for (const row of result.layers.slice(2)) { assert.equal(row.rendered, true); assert.equal(row.visible, false); assert.ok(row.box); }
    });
  } catch (error: any) { if (/não está disponível/.test(error.message)) t.skip('Configure STYLO_CHROMIUM_PATH'); else throw error; }
});

test('renderer.inspect mede a tela completa e CSS responsivo sem alterar dimensões base', async (t) => {
  const renderer = createRenderer(); t.after(() => renderer.close());
  const { makeDoc } = await import('@stylo/core/model.js');
  const doc = makeDoc();
  const root: any = createNode('frame', { w: 800, h: 100, fluid: true, sizeY: 'hug' });
  root.layout.mode = 'column'; root.layout.padding = [20, 20, 20, 20];
  const text: any = createNode('text', { text: 'Texto', fontSize: 32, sizeX: 'fill' });
  text.bps = { mobile: { fontSize: 18 } };
  const hidden: any = createNode('frame', { visible: false });
  root.children.push(text, hidden);
  const before = structuredClone(root);
  try {
  const desktop = await renderer.inspect(root, doc, { width: 800, ids: [text.id, hidden.id], opaqueIds: [] });
  const mobile = await renderer.inspect(root, doc, { width: 390, ids: [text.id], opaqueIds: [] });
  assert.equal(desktop.root!.w, 800); assert.equal(mobile.root!.w, 390);
  assert.equal(desktop.layers[0].typography!.fontSize, '32px'); assert.equal(mobile.layers[0].typography!.fontSize, '18px');
  assert.equal(mobile.layers[0].box!.x, 20); assert.equal(mobile.layers[0].box!.y, 20);
  assert.equal(desktop.layers[1].rendered, false); assert.equal(desktop.layers[1].box, null);
  assert.deepEqual(root, before);
  root.visible = false;
  const absent = await renderer.inspect(root, doc, { width: 390, ids: [root.id, text.id], opaqueIds: [] });
  assert.equal(absent.root, null); assert.ok(absent.layers.every(row => !row.rendered && row.box === null));
  await assert.rejects(renderer.inspect(root, doc, { width: 100, ids: [], opaqueIds: [] }), /200.*4000/);
  } catch (error: any) { if (/não está disponível/.test(error.message)) t.skip('Configure STYLO_CHROMIUM_PATH'); else throw error; }
});

test('HTML malformado que escapa do wrapper não falsifica medida de uma camada real', async (t) => {
  const { makeDoc } = await import('@stylo/core/model.js');
  const renderer = createRenderer(); t.after(() => renderer.close());
  const root: any = createNode('frame', { w: 500, h: 300 });
  const html: any = createNode('html', { w: 100, h: 100 });
  const target: any = createNode('rect', { w: 40, h: 50 });
  html.html = `</div><div DATA-NODE-ID data-node-id="${target.id}" title="data-node-id=&quot;texto legítimo&quot;" style="width:777px;height:333px"></div><div>`;
  root.children.push(html, target); const before = structuredClone(root);
  try {
  const measured = await renderer.inspect(root, makeDoc(), { width: 500, ids: [target.id], opaqueIds: [html.id] });
  assert.equal(measured.layers[0].box!.w, 40); assert.equal(measured.layers[0].box!.h, 50);
  const base = await renderer.measure([root], makeDoc());
  assert.deepEqual(base.get(target.id), { w: 40, h: 50 });
  const audit = await renderer.overflow([root], makeDoc(), [{ rootId: root.id, label: 'desktop', width: 500 }]);
  assert.ok(!audit.some(row => row.nodeId === target.id), 'auditoria não atribui o vazamento do HTML falso ao retângulo real');
  assert.deepEqual(root, before, 'limpeza dos marcadores só na cópia da inspeção');
  } catch (error: any) { if (/não está disponível/.test(error.message)) t.skip('Configure STYLO_CHROMIUM_PATH'); else throw error; }
});
