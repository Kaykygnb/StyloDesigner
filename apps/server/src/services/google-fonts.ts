/**
 * services/google-fonts.ts — BAIXA AS FONTES DO GOOGLE PARA DENTRO DO ZIP EXPORTADO
 *
 * O site exportado só levava um <link> para o Google Fonts: sem internet, caía na fonte do sistema. Agora o servidor
 * baixa o CSS do Google (pedindo como um navegador moderno, para vir woff2 com unicode-range) e cada arquivo de fonte,
 * e o zip sai com `fonts/*.woff2` e @font-face locais. Só os pesos que o projeto usa são baixados.
 *
 * Sem rede: o zip sai como antes (com o <link>) e um aviso diz qual fonte ficou de fora. Os arquivos baixados ficam
 * em memória (por endereço) para a segunda exportação não baixar de novo.
 */

import { exportSite } from '@stylo/core/site-export.js';
import type { SiteFile } from '@stylo/core/site-export.js';
import { googleCssUrl, localizeGoogleFonts, parseGoogleFontsCss, usedFontWeights, type GoogleFace } from '@stylo/core/google-fonts-bundle.ts';
import { fetchRemoteFile } from './remote-image.js';
import { vendorFiles } from './vendor.js';

/** Um navegador moderno: é para ele que o Google devolve woff2 + unicode-range (para outros, TTF inteiro). */
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const MAX_CSS_BYTES = 512 * 1024;
const MAX_FONT_BYTES = 4 * 1024 * 1024;
const MAX_FILES_PER_EXPORT = 120;

export type FetchFile = (url: string, opts: { maxBytes: number; accept: string; headers: Record<string, string> }) => Promise<{ bytes: Uint8Array }>;

const cache = new Map<string, Uint8Array>();

/**
 * Baixa CSS e arquivos das famílias do Google usadas no projeto (menos as hospedadas no próprio projeto, doc.fonts).
 * Devolve os @font-face e os bytes; famílias que falharam viram avisos.
 */
export async function downloadGoogleFonts(doc: any, { fetchFile = defaultFetch }: { fetchFile?: FetchFile } = {}): Promise<{ faces: GoogleFace[]; downloaded: Map<string, Uint8Array>; warnings: string[] }> {
  const selfHosted = new Set((doc?.fonts || []).map((f: any) => f.family));
  const faces: GoogleFace[] = [];
  const downloaded = new Map<string, Uint8Array>();
  const warnings: string[] = [];
  let count = 0;
  for (const [family, weights] of usedFontWeights(doc)) {
    if (selfHosted.has(family)) continue;
    const cssUrl = googleCssUrl(family, weights);
    if (!cssUrl) continue; // fonte do sistema ou desconhecida: não há o que baixar
    try {
      const css = new TextDecoder().decode((await fetchFile(cssUrl, { maxBytes: MAX_CSS_BYTES, accept: 'text/css,*/*;q=0.1', headers: { 'User-Agent': BROWSER_UA } })).bytes);
      const found = parseGoogleFontsCss(css).filter((f) => f.family === family);
      if (!found.length) throw new Error('o CSS veio sem @font-face.');
      for (const face of found) {
        if (!downloaded.has(face.url)) {
          if (++count > MAX_FILES_PER_EXPORT) throw new Error('fontes demais para um zip.');
          let bytes = cache.get(face.url);
          if (!bytes) { bytes = (await fetchFile(face.url, { maxBytes: MAX_FONT_BYTES, accept: '*/*', headers: { 'User-Agent': BROWSER_UA } })).bytes; cache.set(face.url, bytes); }
          downloaded.set(face.url, bytes);
        }
        faces.push(face);
      }
    } catch (err: any) {
      warnings.push(`A fonte “${family}” não foi embutida no zip (${String(err?.message || err).replace(/\.$/, '')}): o site vai buscá-la no Google Fonts e precisa de internet.`);
    }
  }
  return { faces, downloaded, warnings };
}

/** Exporta o site como `exportSite` e embute as fontes do Google. É o que o download e a publicação usam. */
export async function exportSiteBundled(doc: any, { fetchFile }: { fetchFile?: FetchFile } = {}): Promise<{ files: SiteFile[]; warnings: string[]; bundledFonts: string[] }> {
  const site = exportSite(doc, { vendor: vendorFiles });
  const fonts = await downloadGoogleFonts(doc, { fetchFile });
  const { files, bundled } = localizeGoogleFonts(site.files, fonts.faces, fonts.downloaded);
  return { files, warnings: [...site.warnings, ...fonts.warnings], bundledFonts: bundled };
}

const defaultFetch: FetchFile = (url, opts) => fetchRemoteFile(url, opts);

/** Só para testes: esquece os arquivos já baixados. */
export const clearGoogleFontsCache = () => cache.clear();
