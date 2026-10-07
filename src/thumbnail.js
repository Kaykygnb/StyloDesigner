/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  thumbnail.js — MINIATURA DO PROJETO (SVG) PARA A PÁGINA INICIAL
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Reaproveita o exportador SVG (svg.js): monta um "grupo de mentira" com todas as camadas da raiz da página
 *  aberta e converte em SVG. As posições vêm do DOM do canvas (commands.localBox), então auto layout aparece
 *  certinho. Só funciona para a página que está NO CANVAS (é ela que está medida no DOM).
 *
 *  Cuidados:
 *   - imagens grandes são trocadas por um retângulo cinza: a miniatura precisa ser leve (é gravada a cada
 *     salvamento na pasta e baixada pela página inicial);
 *   - dentro de <img>, um SVG não carrega fontes da web: os textos usam fontes do sistema (é só uma prévia).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { toSvg } from './svg.js';

/** Imagens maiores que isto (em caracteres do data URL) viram retângulo cinza na miniatura. */
const MAX_IMAGE = 120 * 1024;
/** PNG 1×1 cinza (#9aa0a6), usado no lugar das imagens grandes. */
const GRAY = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOYtWAZAAO4AeHW/QlfAAAAAElFTkSuQmCC';

/**
 * SVG da página aberta (todas as camadas visíveis da raiz), ou null se a página estiver vazia.
 * @param {object} store
 * @param {object} commands  usa commands.localBox para medir cada camada no DOM
 * @returns {string|null}
 */
export function pageThumbnail(store, commands) {
  const page = store.page();
  const top = page.children.filter((n) => n.visible);
  if (!top.length) return null;
  // caixa que envolve tudo (coordenadas de mundo das camadas da raiz)
  const boxes = new Map(top.map((n) => [n, commands.localBox(n)]));
  const minX = Math.min(...[...boxes.values()].map((b) => b.x));
  const minY = Math.min(...[...boxes.values()].map((b) => b.y));
  const maxX = Math.max(...[...boxes.values()].map((b) => b.x + b.w));
  const maxY = Math.max(...[...boxes.values()].map((b) => b.y + b.h));
  const pad = Math.max(maxX - minX, maxY - minY) * 0.04;
  const root = {
    type: 'group', name: page.name, visible: true, opacity: 1, effects: [],
    x: 0, y: 0, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2, children: top,
  };
  // filhos diretos do "grupo de mentira": posição relativa ao canto da caixa; o resto: medido no DOM
  const boxOf = (n, parent) => {
    if (parent === root) { const b = boxes.get(n); return { ...b, x: b.x - minX + pad, y: b.y - minY + pad }; }
    return commands.localBox(n);
  };
  const assets = {};
  for (const [id, url] of Object.entries(store.state.doc.assets || {})) assets[id] = url.length > MAX_IMAGE ? GRAY : url;
  return toSvg(root, { assets, boxOf });
}
