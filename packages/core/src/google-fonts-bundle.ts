/**
 * google-fonts-bundle.ts — FONTES DO GOOGLE DENTRO DO ZIP EXPORTADO (parte pura, sem rede)
 *
 * O HTML exportado leva um <link> para o CSS do Google Fonts. Para o site funcionar sem internet, o servidor baixa
 * esse CSS e os arquivos .woff2 e chama `localizeGoogleFonts`, que troca o <link> por um <style> com @font-face
 * apontando para `fonts/…` dentro do zip. Aqui ficam só as partes que não precisam de rede:
 *   - usedFontWeights: quais famílias e pesos o projeto usa (para baixar só o necessário);
 *   - googleCssUrl: o endereço do CSS do Google para uma família e seus pesos;
 *   - parseGoogleFontsCss: lê os @font-face que o Google devolve;
 *   - localizeGoogleFonts: reescreve os HTML e acrescenta os arquivos de fonte.
 */

import { GOOGLE, usedFonts } from './fonts.js';
import { slugify, walk } from './model.js';
import type { SiteFile } from './site-export.js';

export interface GoogleFace {
  family: string;
  style: string;
  weight: string;
  /** Alfabeto do bloco (comentário `/* latin *\/` que o Google põe antes de cada @font-face). */
  subset: string;
  unicodeRange: string;
  url: string;
  format: string;
}

/** família → pesos usados por textos e estilos de texto do projeto (400 quando a camada não diz). */
export function usedFontWeights(doc: any): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  const add = (family: unknown, weight: unknown) => {
    if (typeof family !== 'string' || !family) return;
    const w = Number(weight) || 400;
    if (!out.has(family)) out.set(family, new Set());
    out.get(family)!.add(Math.min(900, Math.max(100, Math.round(w / 100) * 100)));
  };
  for (const p of doc?.pages || []) walk(p.children || [], (n: any) => { if (n.type === 'text' && n.fontFamily) add(n.fontFamily, n.fontWeight); });
  for (const t of doc?.styles?.texts || []) if (t.fontFamily) add(t.fontFamily, t.fontWeight);
  for (const family of usedFonts(doc || { pages: [] }) as string[]) if (!out.has(family)) out.set(family, new Set([400]));
  return out;
}

/** O CSS do Google para UMA família nos pesos pedidos (só pesos que a fonte tem; vazio se não é do Google). */
export function googleCssUrl(family: string, weights: Iterable<number>): string {
  const info = GOOGLE.get(family);
  if (!info) return '';
  const available = new Set(info.weights);
  const nearest = (w: number) => info.weights.reduce((best, x) => (Math.abs(x - w) < Math.abs(best - w) ? x : best), info.weights[0]);
  const ws = [...new Set([...weights].map((w) => (available.has(w) ? w : nearest(w))))].sort((a, b) => a - b);
  const fam = 'family=' + encodeURIComponent(family).replace(/%20/g, '+');
  const spec = ws.length === 1 && ws[0] === 400 && info.weights.length === 1 ? fam : `${fam}:wght@${ws.join(';')}`;
  return `https://fonts.googleapis.com/css2?${spec}&display=swap`;
}

/** Lê os blocos @font-face do CSS do Google Fonts (formato que ele devolve para navegadores modernos: woff2 + unicode-range). */
export function parseGoogleFontsCss(css: string): GoogleFace[] {
  const faces: GoogleFace[] = [];
  const re = /(?:\/\*\s*([^*]+?)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    const body = m[2];
    const prop = (name: string) => { const x = new RegExp(`${name}\\s*:\\s*([^;]+);`, 'i').exec(body); return x ? x[1].trim() : ''; };
    const src = /url\(\s*["']?([^"')\s]+)["']?\s*\)(?:\s*format\(\s*["']?([a-z0-9-]+)["']?\s*\))?/i.exec(prop('src'));
    if (!src) continue;
    let url: URL;
    try { url = new URL(src[1]); } catch { continue; }
    if (url.protocol !== 'https:' || url.hostname !== 'fonts.gstatic.com') continue;
    faces.push({
      family: prop('font-family').replace(/^['"]|['"]$/g, ''),
      style: prop('font-style') || 'normal',
      weight: prop('font-weight') || '400',
      subset: (m[1] || 'all').toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      unicodeRange: prop('unicode-range'),
      url: url.href,
      format: (src[2] || (url.pathname.endsWith('.woff') ? 'woff' : 'woff2')).toLowerCase(),
    });
  }
  return faces;
}

const LINK_RE = /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*">\n/g;

/**
 * Troca, em cada HTML, o <link> do Google Fonts por um <style> com @font-face locais, e acrescenta os arquivos de fonte.
 * `downloaded` = url do Google → bytes. Famílias sem nenhum arquivo baixado ficam de fora: o <link> continua
 * (com só elas) para o site não perder a fonte.
 */
export function localizeGoogleFonts(files: SiteFile[], faces: GoogleFace[], downloaded: Map<string, Uint8Array>): { files: SiteFile[]; bundled: string[] } {
  const ready = faces.filter((f) => downloaded.has(f.url));
  if (!ready.length) return { files, bundled: [] };
  const pathOf = new Map<string, string>();
  const used = new Set<string>();
  const fontFiles: SiteFile[] = [];
  const rules: string[] = [];
  for (const f of ready) {
    let path = pathOf.get(f.url);
    if (!path) {
      const base = `fonts/${slugify(f.family).slice(0, 60) || 'fonte'}-${f.weight.replace(/\s+/g, '_')}-${f.style}-${f.subset}`;
      path = `${base}.${f.format === 'woff' ? 'woff' : 'woff2'}`;
      for (let n = 2; used.has(path); n++) path = `${base}-${n}.${f.format === 'woff' ? 'woff' : 'woff2'}`;
      used.add(path); pathOf.set(f.url, path);
      fontFiles.push({ path, content: downloaded.get(f.url)! });
    }
    rules.push(`@font-face { font-family: '${f.family.replace(/'/g, '')}'; font-style: ${f.style}; font-weight: ${f.weight}; font-display: swap; src: url(${path}) format('${f.format}');${f.unicodeRange ? ` unicode-range: ${f.unicodeRange};` : ''} }`);
  }
  const bundled = [...new Set(ready.map((f) => f.family))];
  const style = `<style id="fontes-google">\n${rules.join('\n')}\n</style>\n`;
  const out = files.map((file) => {
    if (typeof file.content !== 'string' || !LINK_RE.test(file.content)) { LINK_RE.lastIndex = 0; return file; }
    LINK_RE.lastIndex = 0;
    const content = file.content.replace(LINK_RE, (link) => {
      // famílias que não conseguimos baixar continuam no <link>
      const m = /href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]*)"/.exec(link);
      const u = m ? new URL(m[1].replace(/&amp;/g, '&')) : null;
      const rest = u ? u.searchParams.getAll('family').filter((spec) => !bundled.includes(spec.split(':')[0])) : [];
      if (!u || !rest.length) return style;
      const q = rest.map((spec) => `family=${encodeURIComponent(spec.split(':')[0]).replace(/%20/g, '+')}${spec.includes(':') ? ':' + spec.split(':').slice(1).join(':') : ''}`).join('&');
      return `${style}<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${q}&display=swap">\n`;
    });
    return { ...file, content };
  });
  return { files: [...out, ...fontFiles], bundled };
}
