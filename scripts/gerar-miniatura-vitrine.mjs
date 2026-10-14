// Gera assets/example-vitrine.png (a miniatura do exemplo "Vitrine completa" na página inicial).
// Uso: npm start (em outro terminal) e depois: node scripts/gerar-miniatura-vitrine.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1000, height: 640 }, deviceScaleFactor: 1 });
await page.goto(new URL('?editor', process.env.APP_URL || 'http://localhost:5173/').href);
await page.waitForTimeout(900);
await page.evaluate(async () => {
  const { buildSampleShowcase } = await import('/src/sample-vitrine.js');
  designer.store.loadDoc(buildSampleShowcase(), { pristine: true });
  designer.store.ui.showNotes = false;
  designer.store.ui.showRulers = false;
  const site = designer.store.page().children[0].children[0];
  designer.store.setSelection([]);
  document.querySelectorAll('.bp-strip, .overlay').forEach((e) => { e.style.display = 'none'; });
  // enquadra o topo da página (cabeçalho + hero) no canto superior esquerdo da vista, a 46%
  const b = designer.canvas.aabb(site.id);
  const z = 0.46;
  designer.canvas.setView({ zoom: z, x: -b.x * z, y: -b.y * z });
});
await page.waitForTimeout(800);
const box = await page.locator('#viewport').boundingBox();
await page.screenshot({ path: 'assets/example-vitrine.png', clip: { x: box.x, y: box.y, width: Math.min(box.width, 576), height: Math.min(box.height, 368) } });
await browser.close();
console.log('assets/example-vitrine.png gerado');
