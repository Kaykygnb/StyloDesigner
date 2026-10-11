/**
 * services/renderer.ts — DESENHA O DESIGN COMO IMAGEM (para `get_image`: o agente "vê" o que fez)
 *
 * Abre o HTML exportado do projeto num Chromium sem interface (Playwright) e tira um PNG. Como o HTML vem de agentes
 * e de pessoas, a renderização é ISOLADA: sem JavaScript, sem rede (só `data:` e `about:`), um contexto novo por
 * imagem, tempo limite e no máximo 2 desenhos ao mesmo tempo. Fontes da web não carregam (cai na fonte do sistema).
 * Precisa do Chromium do Playwright: `npx playwright install chromium`. Sem ele, `render` lança um erro claro e o
 * resto do servidor segue funcionando.
 */

import { exportHtml } from '@stylo/core/css.js';

const MAX_SIDE = 4000;
const TIMEOUT_MS = 20_000;
const MAX_PARALLEL = 2;

export function createRenderer() {
  let browserPromise: Promise<any> | null = null;
  let running = 0;
  const waiting: Array<() => void> = [];

  async function browser() {
    browserPromise ??= (async () => {
      try {
        const { chromium } = await import('playwright-core');
        return await chromium.launch({ headless: true });
      } catch (err: any) {
        browserPromise = null;
        throw new Error(`O renderizador de imagens não está disponível neste servidor (${String(err.message || err).split('\n')[0]}). Instale com: npx playwright install chromium`);
      }
    })();
    return browserPromise;
  }

  async function slot<T>(task: () => Promise<T>): Promise<T> {
    if (running >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve));
    running++;
    try { return await task(); } finally {
      running--;
      waiting.shift()?.();
    }
  }

  /** PNG (base64) da camada `node`. `doc` dá os assets e estilos do projeto. */
  async function render(node: any, doc: { assets: any; styles: any }, scale = 1): Promise<string> {
    const rad = ((node.rotation || 0) * Math.PI) / 180;
    const W = Math.min(MAX_SIDE, Math.max(1, Math.ceil(Math.abs(node.w * Math.cos(rad)) + Math.abs(node.h * Math.sin(rad)))));
    const H = Math.min(MAX_SIDE, Math.max(1, Math.ceil(Math.abs(node.w * Math.sin(rad)) + Math.abs(node.h * Math.cos(rad)))));
    const html = exportHtml(node, doc.assets, node.name, doc.styles);
    return slot(async () => {
      const b = await browser();
      const context = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Math.max(0.5, Math.min(2, scale)), javaScriptEnabled: false });
      try {
        await context.route('**/*', (route: any) => (/^(data|about|blob):/i.test(route.request().url()) ? route.continue() : route.abort()));
        const page = await context.newPage();
        page.setDefaultTimeout(TIMEOUT_MS);
        await page.setContent(html, { waitUntil: 'load', timeout: TIMEOUT_MS });
        const png: Buffer = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H }, timeout: TIMEOUT_MS });
        return png.toString('base64');
      } finally {
        await context.close().catch(() => {});
      }
    });
  }

  async function close() {
    const p = browserPromise;
    browserPromise = null;
    if (p) await (await p.catch(() => null))?.close().catch(() => {});
  }

  return { render, close };
}

export type Renderer = ReturnType<typeof createRenderer>;
