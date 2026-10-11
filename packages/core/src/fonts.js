/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  fonts.js — FONTES DO GOOGLE FONTS (lista, carregamento sob demanda e prévia)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  - A LISTA (1.908 fontes, com categoria e pesos) está embutida em src/data/google-fonts.js.
 *  - O ARQUIVO de cada fonte é baixado do Google só quando um texto do projeto usa aquela fonte
 *    (ensureFonts). O app olha as fontes usadas a cada mudança e ao abrir um projeto.
 *  - A PRÉVIA no seletor baixa só as letras do nome da fonte (parâmetro &text= do Google: poucos KB), com um
 *    nome "apelido" para não se misturar com a fonte de verdade.
 *  - O HTML exportado leva o <link> das fontes usadas (googleFontsUrl).
 *
 *  Sem internet: o texto aparece na fonte de reserva (system-ui) até a fonte conseguir carregar.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { GOOGLE_FONTS } from './data/google-fonts.js';
import { walk } from './model.js';

/** Fontes do sistema (não precisam de download). system-ui = a fonte da interface do seu sistema. */
export const SYSTEM_FONTS = ['system-ui', 'Arial', 'Helvetica', 'Verdana', 'Trebuchet MS', 'Georgia', 'Times New Roman', 'Courier New'];

/** nome → { category, weights } de cada fonte do Google. */
export const GOOGLE = new Map(GOOGLE_FONTS.map(([name, category, w]) => [name, { category, weights: w.split(',').map(Number) }]));

/** Pesos disponíveis de uma fonte (fontes do sistema: todos os pesos comuns). */
export const weightsOf = (family) => GOOGLE.get(family)?.weights || [100, 200, 300, 400, 500, 600, 700, 800, 900];

/** Peso disponível mais próximo do pedido (ex.: 600 numa fonte que só tem 400 e 700 → 700). */
export function nearestWeight(family, weight) {
  const ws = weightsOf(family);
  return ws.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), ws[0]);
}

/**
 * URL do CSS do Google Fonts para várias fontes, com todos os pesos que cada uma tem.
 * ex.: https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Lobster&display=swap
 * @param {string[]} families  só as que existem no Google entram
 * @param {{text?: string}} [opts]  text = baixa só estas letras (usado na prévia do seletor)
 */
export function googleFontsUrl(families, { text } = {}) {
  const parts = families.filter((f) => GOOGLE.has(f)).map((f) => {
    const ws = GOOGLE.get(f).weights;
    const fam = 'family=' + encodeURIComponent(f).replace(/%20/g, '+');
    return ws.length > 1 || ws[0] !== 400 ? `${fam}:wght@${ws.join(';')}` : fam;
  });
  if (!parts.length) return '';
  return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap${text ? `&text=${encodeURIComponent(text)}` : ''}`;
}

/** Todas as fontes usadas por textos e estilos de texto de um documento (ou de uma lista de camadas). */
export function usedFonts(docOrNodes) {
  const set = new Set();
  const pages = docOrNodes.pages || [{ children: docOrNodes }];
  for (const p of pages) walk(p.children, (n) => { if (n.type === 'text' && n.fontFamily) set.add(n.fontFamily); });
  for (const t of docOrNodes.styles?.texts || []) if (t.fontFamily) set.add(t.fontFamily);
  return [...set];
}

// ---------------------------------------------------------------- navegador
// fontes cujo <link> já foi colocado na página (cada uma é baixada uma vez só)
const loaded = new Set(['Inter', 'Poppins', 'DM Sans', 'Playfair Display', 'JetBrains Mono']); // já vêm no index.html
/** Garante que as fontes do Google da lista estão carregando (põe um <link> por fonte nova). */
export function ensureFonts(families) {
  for (const f of families) {
    if (loaded.has(f) || !GOOGLE.has(f)) continue;
    loaded.add(f);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = googleFontsUrl([f]);
    link.dataset.font = f;
    document.head.append(link);
  }
}

// prévias já pedidas: nome → Promise
const previews = new Map();
/** Nome "apelido" da prévia de uma fonte (para não se misturar com a fonte de verdade, que tem todas as letras). */
export const previewFamily = (family) => `Prévia ${family}`;
/**
 * Baixa a PRÉVIA de uma fonte: só as letras do próprio nome. Busca o CSS do Google, troca o nome da família pelo
 * apelido e injeta numa <style>. Falhas são silenciosas (a prévia só fica na fonte padrão).
 */
export function loadPreview(family) {
  if (!GOOGLE.has(family) || previews.has(family)) return previews.get(family);
  const p = fetch(googleFontsUrl([family], { text: family }))
    .then((r) => (r.ok ? r.text() : ''))
    .then((css) => {
      if (!css) return;
      const style = document.createElement('style');
      style.textContent = css.replace(/font-family:\s*'[^']*'/g, `font-family: '${previewFamily(family)}'`);
      document.head.append(style);
    })
    .catch(() => {});
  previews.set(family, p);
  return p;
}
