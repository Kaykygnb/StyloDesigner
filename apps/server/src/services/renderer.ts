/**
 * services/renderer.ts — DESENHA O DESIGN COMO IMAGEM (para `get_image`: o agente "vê" o que fez)
 *
 * Abre o HTML exportado do projeto num Chromium sem interface (Playwright) e tira um PNG. Como o HTML vem de agentes
 * e de pessoas, a renderização é ISOLADA: sem JavaScript, sem rede (só `data:` e `about:`), um contexto novo por
 * imagem, tempo limite e no máximo 2 desenhos ao mesmo tempo. Fontes do Google (CDN) não carregam (cai na fonte do
 * sistema), mas as fontes HOSPEDADAS no projeto (add_font) entram embutidas e aparecem como no site exportado.
 * Precisa do Chromium do Playwright: `npx playwright install chromium`. Sem ele, `render` lança um erro claro e o
 * resto do servidor segue funcionando.
 */

import { exportHtml } from '@stylo/core/css.js';
import { inlineFontFaces } from '@stylo/core/site-export.ts';

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

  /**
   * VAZAMENTO: para cada tela e cada largura pedida (desktop, tablet, celular...), as camadas que ficam para fora da janela.
   * Só devolve a de mais acima de cada cadeia (o filho de um item que já vazou é consequência). Camadas ocultas
   * (display:none) e de tamanho zero não contam.
   */
  async function overflow(roots: any[], doc: any, widths: Array<{ rootId: string; label: string; width: number }>): Promise<Array<{ nodeId: string; label: string; width: number; right: number; left: number }>> {
    const found: Array<{ nodeId: string; label: string; width: number; right: number; left: number }> = [];
    if (!roots.length || !widths.length) return found;
    return slot(async () => {
      const b = await browser();
      const context = await b.newContext({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false });
      try {
        await context.route('**/*', (route: any) => (/^(data|about|blob):/i.test(route.request().url()) ? route.continue() : route.abort()));
        const page = await context.newPage();
        page.setDefaultTimeout(TIMEOUT_MS);
        for (const w of widths) {
          const root = roots.find((r) => r.id === w.rootId);
          if (!root) continue;
          const width = Math.min(MAX_SIDE, Math.max(200, Math.round(w.width)));
          await page.setViewportSize({ width, height: 800 });
          await page.setContent(pageHtml(root, doc, true), { waitUntil: 'load', timeout: TIMEOUT_MS });
          const rows: Array<[string, number, number]> = await page.evaluate(() => {
            const vw = document.documentElement.clientWidth;
            const bad = new Map<Element, [string, number, number]>();
            for (const el of document.querySelectorAll('[data-node-id]')) {
              const r = el.getBoundingClientRect();
              if (!r.width && !r.height) continue;
              if (r.right > vw + 1 || r.left < -1) bad.set(el, [el.getAttribute('data-node-id') as string, Math.round(r.right), Math.round(r.left)]);
            }
            const top: Array<[string, number, number]> = [];
            for (const [el, row] of bad) {
              let p = el.parentElement, nested = false;
              while (p) { if (bad.has(p)) { nested = true; break; } p = p.parentElement; }
              if (!nested) top.push(row);
            }
            return top;
          });
          for (const [nodeId, right, left] of rows) found.push({ nodeId, label: w.label, width, right, left });
        }
        return found;
      } finally {
        await context.close().catch(() => {});
      }
    });
  }

  /** HTML da camada com as fontes hospedadas do projeto embutidas. */
  function pageHtml(node: any, doc: any, ids = false) {
    const html = exportHtml(node, doc.assets, node.name, doc.styles, { ids, selfHosted: new Set((doc.fonts || []).map((f: any) => f.family)) } as any);
    const faces = inlineFontFaces(doc);
    return faces ? html.replace('</head>', `<style>\n${faces}\n</style>\n</head>`) : html;
  }

  /**
   * MEDE o layout real: para cada camada de cada prancheta, a largura e a altura que o navegador calculou (o que o
   * editor lê com offsetWidth/Height). Sem isso, a altura de uma camada "hug" no servidor seria só a guardada.
   * O JavaScript da página continua DESLIGADO (o evaluate é nosso e roda fora dela).
   */
  async function measure(roots: any[], doc: any): Promise<Map<string, { w: number; h: number }>> {
    const sizes = new Map<string, { w: number; h: number }>();
    if (!roots.length) return sizes;
    return slot(async () => {
      const b = await browser();
      const context = await b.newContext({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false });
      try {
        await context.route('**/*', (route: any) => (/^(data|about|blob):/i.test(route.request().url()) ? route.continue() : route.abort()));
        const page = await context.newPage();
        page.setDefaultTimeout(TIMEOUT_MS);
        for (const root of roots) {
          await page.setViewportSize({ width: Math.min(MAX_SIDE, Math.max(1, Math.ceil(root.w))), height: 800 });
          await page.setContent(pageHtml(root, doc, true), { waitUntil: 'load', timeout: TIMEOUT_MS });
          const rows: Array<[string, number, number]> = await page.evaluate(() => [...document.querySelectorAll('[data-node-id]')].map((el: any) => [el.getAttribute('data-node-id'), el.offsetWidth, el.offsetHeight]));
          for (const [id, w, h] of rows) sizes.set(id, { w, h });
        }
        return sizes;
      } finally {
        await context.close().catch(() => {});
      }
    });
  }

  /**
   * Desenha a camada numa janela de LARGURA dada (um breakpoint): as regras @media do CSS valem como no navegador e a
   * altura é a que ele calcular. Devolve a imagem do elemento inteiro (até MAX_SIDE).
   */
  async function renderAtWidth(node: any, doc: any, scale: number, width: number): Promise<string> {
    const html = pageHtml(node, doc);
    return slot(async () => {
      const b = await browser();
      const context = await b.newContext({ viewport: { width: Math.min(MAX_SIDE, Math.max(200, Math.round(width))), height: 800 }, deviceScaleFactor: Math.max(0.5, Math.min(2, scale)), javaScriptEnabled: false });
      try {
        await context.route('**/*', (route: any) => (/^(data|about|blob):/i.test(route.request().url()) ? route.continue() : route.abort()));
        const page = await context.newPage();
        page.setDefaultTimeout(TIMEOUT_MS);
        await page.setContent(html, { waitUntil: 'load', timeout: TIMEOUT_MS });
        const box = await page.locator('body > *').first().boundingBox();
        if (!box) throw new Error('Não consegui medir a tela neste breakpoint.');
        const png: Buffer = await page.screenshot({ type: 'png', fullPage: true, clip: { x: box.x, y: box.y, width: Math.min(MAX_SIDE, Math.ceil(box.width)), height: Math.min(MAX_SIDE, Math.ceil(box.height)) }, timeout: TIMEOUT_MS });
        return png.toString('base64');
      } finally {
        await context.close().catch(() => {});
      }
    });
  }

  /** PNG (base64) da camada `node`. `doc` dá os assets e estilos do projeto. */
  async function render(node: any, doc: any, scale = 1, opts: { width?: number } = {}): Promise<string> {
    if (opts.width) return renderAtWidth(node, doc, scale, opts.width);
    const rad = ((node.rotation || 0) * Math.PI) / 180;
    const W = Math.min(MAX_SIDE, Math.max(1, Math.ceil(Math.abs(node.w * Math.cos(rad)) + Math.abs(node.h * Math.sin(rad)))));
    const H = Math.min(MAX_SIDE, Math.max(1, Math.ceil(Math.abs(node.w * Math.sin(rad)) + Math.abs(node.h * Math.cos(rad)))));
    const html = pageHtml(node, doc);
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

  return { render, measure, overflow, close };
}

export type Renderer = ReturnType<typeof createRenderer>;
