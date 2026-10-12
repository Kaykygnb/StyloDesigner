import test from 'node:test';
import assert from 'node:assert/strict';
import { BREAKPOINTS, createNode, makeDoc } from '@stylo/core/model.js';
import { withDocumentBreakpoints } from '@stylo/core/document-breakpoints.ts';
import { exportSite } from '@stylo/core/site-export.ts';
import { exportReact } from '@stylo/core/export-react.ts';
import { createStore } from '@stylo/core/store.js';
import { createRunner } from '@stylo/core/tools/runner.js';

function fixture() {
  const doc: any = makeDoc();
  doc.breakpoints = [{ id: 'mobile', name: 'Celular especial', max: 600, preview: 390 }];
  const root: any = createNode('frame', { name: 'Home', w: 800, h: 400 }); root.layout.mode = 'column';
  const text: any = createNode('text', { name: 'Texto', text: 'Teste responsivo' }); text.bps = { mobile: { fontSize: 24 } };
  root.children.push(text); doc.pages[0].children.push(root);
  return { doc, root };
}

test('escopo síncrono restaura breakpoints após sucesso, nesting, throw e thenable proibido', () => {
  const previous = structuredClone(BREAKPOINTS), { doc } = fixture();
  withDocumentBreakpoints(doc, () => {
    assert.equal(BREAKPOINTS[0].max, 600);
    withDocumentBreakpoints({}, () => assert.equal(BREAKPOINTS.find((b) => b.id === 'mobile')!.max, 640));
    assert.equal(BREAKPOINTS[0].max, 600);
  });
  assert.deepEqual(BREAKPOINTS, previous);
  assert.throws(() => withDocumentBreakpoints(doc, () => { throw new Error('Falha intencional'); }), /Falha intencional/);
  assert.deepEqual(BREAKPOINTS, previous);
  assert.throws(() => withDocumentBreakpoints(doc, (() => Promise.resolve('proibido')) as any), /síncronas/);
  assert.deepEqual(BREAKPOINTS, previous);
});

test('HTML, React e ferramentas export_html/get_code respeitam 600px sem contaminar o próximo projeto', async (t) => {
  const previous = structuredClone(BREAKPOINTS), { doc, root } = fixture();
  t.after(() => BREAKPOINTS.splice(0, BREAKPOINTS.length, ...previous));
  const site = exportSite(doc);
  const html = String(site.files.find((file) => file.path === 'index.html')!.content);
  assert.match(html, /@media[^{}]*max-width:\s*600px/); assert.doesNotMatch(html, /max-width:\s*640px/);
  const react = exportReact(doc);
  const css = String(react.files.find((file) => file.path === 'src/pages/Home.module.css')!.content);
  assert.match(css, /@media[^{}]*max-width:\s*600px/);
  const store = createStore({ initial: { doc } });
  // O store ativa os breakpoints do documento ao abrir; isole os escopos de exportação desse efeito existente.
  BREAKPOINTS.splice(0, BREAKPOINTS.length, ...previous);
  const runner = createRunner({ store, commands: {} });
  const exported = await runner.run('export_html', { id: root.id }); assert.equal(exported.error, undefined); assert.match(JSON.stringify(exported), /max-width:\s*600px/);
  const code = await runner.run('get_code', { id: root.id }); assert.equal(code.error, undefined); assert.match(JSON.stringify(code), /max-width:\s*600px/);
  assert.deepEqual(BREAKPOINTS, previous);
  delete doc.breakpoints;
  const defaultHtml = String(exportSite(doc).files.find((file) => file.path === 'index.html')!.content);
  assert.match(defaultHtml, /max-width:\s*640px/); assert.deepEqual(BREAKPOINTS, previous);
});

test('renderer alterna projetos 600/640 sem aplicar o breakpoint do projeto anterior', async (t) => {
  const { createRenderer } = await import('../apps/server/src/services/renderer.ts');
  const renderer = createRenderer(); t.after(() => renderer.close());
  const { doc, root } = fixture(); const text = root.children[0];
  const standard = structuredClone(doc); standard.breakpoints[0].max = 640;
  const previous = structuredClone(BREAKPOINTS);
  try {
    const customWide = await renderer.inspect(root, doc, { ids: [text.id], width: 635, opaqueIds: [] });
    assert.equal(customWide.layers[0].typography!.fontSize, '16px');
    const standardWide = await renderer.inspect(standard.pages[0].children[0], standard, { ids: [text.id], width: 635, opaqueIds: [] });
    assert.equal(standardWide.layers[0].typography!.fontSize, '24px');
    const customNarrow = await renderer.inspect(root, doc, { ids: [text.id], width: 590, opaqueIds: [] });
    assert.equal(customNarrow.layers[0].typography!.fontSize, '24px');
    const customAgain = await renderer.inspect(root, doc, { ids: [text.id], width: 635, opaqueIds: [] });
    assert.equal(customAgain.layers[0].typography!.fontSize, '16px');
    assert.deepEqual(BREAKPOINTS, previous);
  } catch (error: any) { if (/não está disponível/.test(error.message)) t.skip('Configure STYLO_CHROMIUM_PATH'); else throw error; }
});

test('dois stores anunciam e editam apenas seus próprios breakpoints customizados', async (t) => {
  const original = structuredClone(BREAKPOINTS); t.after(() => BREAKPOINTS.splice(0, BREAKPOINTS.length, ...original));
  const a = fixture(), b = fixture(); a.doc.breakpoints[0].id = 'phone-a'; b.doc.breakpoints[0].id = 'phone-b';
  const storeA = createStore({ initial: { doc: a.doc } }), storeB = createStore({ initial: { doc: b.doc } });
  const runnerA = createRunner({ store: storeA, commands: {}, approve: async () => true });
  const runnerB = createRunner({ store: storeB, commands: {}, approve: async () => true });
  assert.deepEqual((await runnerA.run('get_document')).breakpoints.map((bp: any) => bp.id), ['phone-a']);
  assert.deepEqual((await runnerB.run('get_document')).breakpoints.map((bp: any) => bp.id), ['phone-b']);
  const node = a.root.children[0], baseSize = node.fontSize;
  const valid = await runnerA.run('set_responsive', { id: node.id, breakpoint: 'phone-a', props: { fontSize: 28 } }); assert.equal(valid.ok, true);
  assert.equal(storeA.get(node.id).fontSize, baseSize); assert.equal(storeA.get(node.id).bps['phone-a'].fontSize, 28);
  const invalid = await runnerA.run('set_responsive', { id: node.id, breakpoint: 'phone-b', props: { fontSize: 32 } }); assert.match(invalid.error, /phone-a/);
});
