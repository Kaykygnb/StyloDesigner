import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode } from '@stylo/core/model.js';
import { nodeStyle, generateCode } from '@stylo/core/css.js';
import { sanitizeDoc } from '@stylo/core/validate.js';
import { applyProps } from '@stylo/core/tools/runner/properties.ts';

test('3D: profundidade e giros em X/Y viram transform; perspective e preserve-3d ficam no contêiner', () => {
  const cena = createNode('frame', { w: 400, h: 300 });
  Object.assign(cena, { perspective: 800, preserve3d: true });
  const card = createNode('rect', { w: 100, h: 100 });
  Object.assign(card, { rotateX: 20, rotateY: -15, depth: 60, rotation: 5 });
  const pai = nodeStyle(cena, null);
  assert.equal(pai.perspective, '800px');
  assert.equal(pai['transform-style'], 'preserve-3d');
  assert.equal(nodeStyle(card, cena).transform, 'translateZ(60px) rotateX(20deg) rotateY(-15deg) rotate(5deg)');
  assert.equal(nodeStyle(createNode('rect'), null).transform, undefined, 'sem 3D nada muda');
});

test('3D: parallax sai só como CSS de rolagem, respeitando "menos movimento"', () => {
  const frame = createNode('frame');
  const fundo = createNode('rect', { w: 50, h: 50 });
  fundo.parallax = 0.5;
  frame.children = [fundo, createNode('rect')];
  const { css } = generateCode([frame], null, {}, { root: true });
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /@supports \(animation-timeline: view\(\)\)/);
  assert.match(css, /translate: 0 -100px/);
  assert.equal(css.match(/@keyframes/g)?.length, 1, 'só a camada com parallax ganha animação');
  fundo.parallax = 0;
  assert.doesNotMatch(generateCode([frame], null, {}, { root: true }).css, /@keyframes/);
});

test('3D: validação descarta números inválidos e ferramentas recusam fora do limite', () => {
  const doc: any = { version: 1, pages: [{ id: 'p', name: 'P', children: [{ id: 'a', type: 'rect', name: 'A', rotateX: 'abc', depth: '40' }] }] };
  sanitizeDoc(doc);
  assert.equal(doc.pages[0].children[0].depth, 40);
  assert.equal('rotateX' in doc.pages[0].children[0], false);

  const rect = createNode('rect');
  const frame = createNode('frame');
  applyProps(frame, { perspective: 900, preserve3d: true });
  assert.equal(frame.perspective, 900);
  applyProps(rect, { rotateY: 30, depth: -40, parallax: 0.3 });
  assert.equal(rect.rotateY, 30);
  assert.throws(() => applyProps(rect, { perspective: 900 }), /só vale para frame/);
  assert.throws(() => applyProps(rect, { depth: 99999 }), /entre -2000 e 2000/);
  assert.throws(() => applyProps(rect, { parallax: 3 }), /entre -1 e 1/);
  applyProps(rect, { depth: null });
  assert.equal('depth' in rect, false);
});

test('3D: frame com preserve-3d não corta o conteúdo (overflow achataria a cena)', () => {
  const cena = createNode('frame');
  assert.equal(nodeStyle(cena, null).overflow, 'hidden');
  cena.preserve3d = true;
  assert.equal(nodeStyle(cena, null).overflow, undefined);
});

test('3D: a exportação de site (HTML) e a de React levam perspectiva, giros e parallax', async () => {
  const { makeDoc } = await import('@stylo/core/model.ts');
  const { exportReact } = await import('@stylo/core/export-react.ts');
  const doc: any = makeDoc();
  const tela: any = createNode('frame', { name: 'Home', w: 400, h: 300 });
  const palco: any = createNode('frame', { name: 'Palco', w: 400, h: 300 });
  Object.assign(palco, { perspective: 800, preserve3d: true });
  palco.fill = { ...palco.fill, type: 'none' };
  const card: any = createNode('rect', { name: 'Card', w: 100, h: 100 });
  Object.assign(card, { rotateY: 25, depth: 40, parallax: -0.4 });
  palco.children.push(card);
  tela.children.push(palco);
  doc.pages[0].children.push(tela);

  const css = String(exportReact(doc).files.find((f) => f.path === 'src/pages/Home.module.css')!.content);
  assert.match(css, /perspective: 800px/);
  assert.match(css, /transform-style: preserve-3d/);
  assert.match(css, /transform: translateZ\(40px\) rotateY\(25deg\)/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /@keyframes parallax-card/);
  assert.match(css, /translate: 0 80px/, 'parallax negativo (mais rápido) começa para baixo');
});

test('3D: modelo com giro automático, ponto de vista e giro pela rolagem (sem CDN, só script nosso)', async () => {
  const { exportHtml } = await import('@stylo/core/css.js');
  const { exportSite } = await import('@stylo/core/site-export.ts');
  const { exportReact } = await import('@stylo/core/export-react.ts');
  const { makeDoc } = await import('@stylo/core/model.ts');
  const m: any = createNode('media', { mediaKind: 'model3d', mediaAssetId: 'm1' });
  applyProps(m, { modelAutoRotate: true, modelScroll: true, modelOrbit: '30deg 70deg 3m' });
  const assets = { m1: 'data:model/gltf-binary;base64,AAAA' };
  assert.match(exportHtml(m, assets), /<model-viewer[^>]* camera-orbit="30deg 70deg 3m" auto-rotate data-scroll-orbit/);
  assert.throws(() => applyProps(m, { modelOrbit: '"><script>' }), /modelOrbit usa/);
  assert.throws(() => applyProps(createNode('rect'), { modelScroll: true }), /model3d/);

  const board: any = createNode('frame', { name: 'Página' });
  board.children.push(m);
  const { files } = exportSite({ pages: [{ name: 'P', children: [board] }], assets: { m1: assets.m1 }, styles: {} }, { vendor: (n) => new Uint8Array([n.length]) });
  assert.match(String(files.find((f) => f.path === 'index.html')!.content), /vendor\/stylo-model-scroll\.js/);
  const script = String(files.find((f) => f.path === 'vendor/stylo-model-scroll.js')!.content);
  assert.match(script, /prefers-reduced-motion/);
  assert.match(script, /split\(\/\\s\+\/\)/, 'a regex do script sai com a barra (já quebrou uma vez ao escapar o texto)');

  const doc: any = makeDoc();
  doc.assets = assets;
  doc.pages[0].children.push(board);
  const react = exportReact(doc).files;
  assert.ok(react.some((f) => f.path === 'src/stylo-model-scroll.js'));
  assert.match(String(react.find((f) => f.path.endsWith('.jsx') && f.path.includes('pages/'))!.content), /import '\.\.\/stylo-model-scroll\.js'/);
});
