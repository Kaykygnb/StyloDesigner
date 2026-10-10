// Mede o HTML estático exportado em Chromium com um servidor local descartável.
// As fontes do Google são bloqueadas para tornar a medição repetível; registre essa limitação junto ao resultado.
import { createServer } from 'node:http';
import { buildSampleShowcase } from '../src/sample-vitrine.js';
import { exportHtml } from '../src/css.js';
import { chromium } from 'playwright';

const doc = buildSampleShowcase();
const countNodes = (node) => 1 + (node.children || []).reduce((sum, child) => sum + countNodes(child), 0);
const frames = [];
const collectFrames = (nodes) => nodes.forEach((node) => {
  if (node.type === 'frame' && node.visible !== false) frames.push(node);
  collectFrames(node.children || []);
});
doc.pages.forEach((p) => collectFrames(p.children));
const root = frames.sort((a, b) => countNodes(b) - countNodes(a))[0];
if (!root) throw new Error('O exemplo Vitrine não contém uma tela exportável.');
const html = exportHtml(root, doc.assets, root.name, doc.styles);
const htmlBytes = Buffer.byteLength(html);
const server = createServer((_req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': htmlBytes,
    'Cache-Control': 'no-store',
  });
  res.end(html);
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
const url = `http://127.0.0.1:${address.port}/`;
const runs = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true });

try {
  for (let i = 0; i < 5; i++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route(/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '/* fonts omitted for repeatable local timing */' }));
    await context.addInitScript(() => {
      window.__loadMetrics = { lcp: 0, cls: 0, longTaskTotal: 0, longTaskMax: 0 };
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__loadMetrics.lcp = entry.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__loadMetrics.cls += entry.value;
        }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__loadMetrics.longTaskTotal += entry.duration;
            window.__loadMetrics.longTaskMax = Math.max(window.__loadMetrics.longTaskMax, entry.duration);
          }
        }).observe({ type: 'longtask', buffered: true });
      } catch { /* APIs de performance variam entre navegadores. */ }
    });
    const tab = await context.newPage();
    const consoleErrors = [];
    tab.on('pageerror', (error) => consoleErrors.push(error.message));
    tab.on('console', (message) => {
      if (message.type() === 'error' && !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(message.text())) consoleErrors.push(message.text());
    });
    await tab.goto(url, { waitUntil: 'load' });
    await tab.waitForTimeout(100);
    const metrics = await tab.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const paint = performance.getEntriesByName('first-contentful-paint')[0];
      return {
        domContentLoadedMs: nav?.domContentLoadedEventEnd || 0,
        loadMs: nav?.loadEventEnd || 0,
        fcpMs: paint?.startTime || 0,
        lcpMs: window.__loadMetrics.lcp,
        cls: window.__loadMetrics.cls,
        longTaskTotalMs: window.__loadMetrics.longTaskTotal,
        longTaskMaxMs: window.__loadMetrics.longTaskMax,
        resourceCount: resources.length,
        transferredBytes: resources.reduce((sum, item) => sum + item.transferSize, nav?.transferSize || 0),
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
      };
    });
    runs.push({ ...metrics, consoleErrors });
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

const median = (key) => [...runs].map((run) => run[key]).sort((a, b) => a - b)[Math.floor(runs.length / 2)];
console.log(`Stylo · Vitrine · ${root.name} (${countNodes(root)} camadas) · Chromium · 5 cargas frias · fontes externas bloqueadas`);
console.log(`HTML: ${(htmlBytes / 1024).toFixed(1)} KiB · recursos: ${median('resourceCount')} · bytes transferidos: ${(median('transferredBytes') / 1024).toFixed(1)} KiB`);
console.log(`mediana: DCL ${median('domContentLoadedMs').toFixed(1)} ms · load ${median('loadMs').toFixed(1)} ms · FCP ${median('fcpMs').toFixed(1)} ms · LCP ${median('lcpMs').toFixed(1)} ms`);
console.log(`mediana: CLS ${median('cls').toFixed(4)} · tarefas longas ${median('longTaskTotalMs').toFixed(1)} ms (máxima ${median('longTaskMaxMs').toFixed(1)} ms)`);
console.log(`viewport sem overflow horizontal: ${runs.every((run) => run.scrollWidth <= run.viewportWidth) ? 'sim' : 'não'}`);
const errors = runs.flatMap((run) => run.consoleErrors);
if (errors.length) {
  console.error('Erros de console:', [...new Set(errors)].join(' | '));
  process.exitCode = 1;
} else {
  console.log('sem erros de JavaScript no Chromium');
}
