// Exportação responsiva: cada página do site exportado (vitrine de exemplo) precisa caber na largura do aparelho,
// sem rolagem horizontal, em celular (390), tablet (768) e desktop (1440).
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const editor = await context.newPage();
const errors = [];
editor.on('pageerror', (error) => errors.push(error.message));

let failures = 0;
const ok = (name, value, detail = '') => { if (!value) failures++; console.log(`${value ? 'PASS' : 'FAIL'} ${name}${!value && detail ? ` — ${detail}` : ''}`); };

try {
  await editor.goto(new URL('?editor', process.env.APP_URL || 'http://localhost:5173/').href);
  await editor.waitForFunction(() => window.designer?.store);
  const exported = await editor.evaluate(async () => {
    const { exportSite } = await import('/src/site-export.js');
    const { buildSampleShowcase } = await import('/src/sample-vitrine.js');
    designer.store.loadDoc(buildSampleShowcase(), { pristine: true });
    const r = exportSite(designer.store.state.doc);
    return { files: r.files.map((f) => ({ path: f.path, content: f.content })), warnings: r.warnings };
  });
  const { warnings } = exported;
  const files = exported.files;
  const slug = (n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const warnedFixed = (file) => warnings.some((w) => /largura fixa/i.test(w) && slug(w.split('”')[0].replace('“', '')) === file.path.replace(/\.html$/, ''));
  ok('o site exportado tem páginas', files.length >= 2, `veio ${files.length}`);

  for (const width of [390, 768, 1440]) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 900 });
    for (const file of files) {
      await page.setContent(file.content, { waitUntil: 'load' });
      const m = await page.evaluate(() => ({
        inner: window.innerWidth,
        doc: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        // o elemento mais largo que vaza: ajuda a achar o culpado
        culprit: [...document.querySelectorAll('body *')].map((el) => ({ cls: el.className, right: Math.round(el.getBoundingClientRect().right) })).sort((a, b) => b.right - a.right)[0],
      }));
      const overflow = Math.max(m.doc, m.body) - m.inner;
      // vazar só é aceitável quando a tela é de largura fixa E a exportação avisou a pessoa
      ok(`${file.path} em ${width}px: sem rolagem horizontal ou com aviso de largura fixa`, overflow <= 1 || warnedFixed(file), `vaza ${overflow}px sem aviso (mais larga: .${m.culprit?.cls} até ${m.culprit?.right}px)`);
    }
    await page.close();
  }
  ok('sem erros no navegador', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
}
process.exitCode = failures ? 1 : 0;
