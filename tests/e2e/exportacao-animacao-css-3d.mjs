// Verifica animação CSS e transformações 3D em Chromium no HTML exportado, fora do canvas do Stylo.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 800, height: 600 }, reducedMotion: 'no-preference' });
const editor = await context.newPage();
const errors = [];
editor.on('pageerror', (error) => errors.push(error.message));
editor.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const appUrl = new URL('?editor', process.env.APP_URL || 'http://localhost:5173/');

try {
  await editor.goto(appUrl.href);
  await editor.waitForFunction(() => window.designer?.store);

  const html = await editor.evaluate(async () => {
    const { createNode } = await import('/src/model.js');
    const { exportHtml } = await import('/src/css.js');
    const store = designer.store;
    store.newDoc();

    const frame = createNode('frame', { name: 'Movimento 3D', w: 320, h: 240 });
    const markup = createNode('html', { name: 'Amostra CSS 3D' });
    markup.html = '<div id="motion" aria-label="Animação"></div><div id="scene"><div id="cube"><div id="face"></div></div></div>';
    frame.children.push(markup);
    store.state.doc.styles.pageCss = `
      @keyframes deslocar { from { transform: translateX(0px); } to { transform: translateX(120px); } }
      #motion { width: 40px; height: 24px; background: #d33; animation: deslocar 400ms linear forwards; }
      #scene { width: 100px; height: 100px; margin-top: 32px; perspective: 500px; }
      #cube { width: 80px; height: 80px; transform-style: preserve-3d; transform: rotateY(0deg); }
      #face { position: absolute; inset: 0; background: #36c; transform: translateZ(30px); }
    `;
    store.update((page) => page.children.push(frame), { commit: true });
    return exportHtml(frame, store.state.doc.assets, frame.name, store.state.doc.styles);
  });

  assert.match(html, /@keyframes deslocar/);
  assert.match(html, /perspective: 500px/);
  assert.match(html, /transform-style: preserve-3d/);
  console.log('PASS HTML exportado mantém keyframes, perspective e preserve-3d');

  const site = await context.newPage();
  await site.setContent(html, { waitUntil: 'load' });
  await site.waitForTimeout(120);
  const midTransform = await site.locator('#motion').evaluate((el) => getComputedStyle(el).transform);
  await site.waitForTimeout(400);
  const endTransform = await site.locator('#motion').evaluate((el) => getComputedStyle(el).transform);
  const translationX = (value) => Number(/^matrix\(([^,]+,\s*){4}([^,]+)/.exec(value)?.[2]);
  const midX = translationX(midTransform);
  const endX = translationX(endTransform);
  assert.ok(Number.isFinite(midX) && Number.isFinite(endX) && midX > 0 && endX >= 115, `${midTransform} → ${endTransform}`);
  console.log(`PASS animação executa no site exportado (${midX.toFixed(0)}px → ${endX.toFixed(0)}px)`);

  const geometry = await site.locator('#face').evaluate((face) => {
    const widthAt = (angle) => {
      face.parentElement.style.transform = `rotateY(${angle}deg)`;
      return face.getBoundingClientRect().width;
    };
    const stage = getComputedStyle(document.querySelector('#scene'));
    const cube = getComputedStyle(document.querySelector('#cube'));
    return {
      flat: widthAt(0),
      rotated: widthAt(60),
      perspective: stage.perspective,
      transformStyle: cube.transformStyle,
      transform: getComputedStyle(face).transform,
    };
  });
  assert.equal(geometry.perspective, '500px');
  assert.equal(geometry.transformStyle, 'preserve-3d');
  assert.match(geometry.transform, /^matrix3d\(/);
  assert.ok(Math.abs(geometry.rotated - geometry.flat) > 15, JSON.stringify(geometry));
  console.log(`PASS perspectiva 3D muda a geometria renderizada (${geometry.flat.toFixed(1)}px → ${geometry.rotated.toFixed(1)}px)`);
  assert.deepEqual(errors, []);
  console.log('PASS sem erros no console');
} finally {
  await browser.close();
}
