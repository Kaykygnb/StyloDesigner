/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  export.js — SAÍDAS: PNG, SVG, HTML E ARQUIVO DE PROJETO (.json)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Formatos: PNG (imagem), SVG (vetor), HTML (página completa com CSS) e .designer.json (projeto inteiro, para
 *  salvar/abrir). Cada função "baixa" o arquivo pelo navegador, sem servidor.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { EXPORT_RESET, exportHtml, generateCode, joinCss } from './css.js';
import { toSvg } from './svg.js';
import { slugify } from './model.js';

/**
 * Faz o navegador BAIXAR um arquivo gerado na memória: cria um Blob, uma URL temporária e clica num <a download>
 * invisível. A URL é liberada depois de 2s para não vazar memória.
 * @param {string} filename  nome do arquivo
 * @param {string|Blob} data  conteúdo
 * @param {string} [type]  tipo MIME (ignorado se `data` já for Blob)
 */
export function download(filename, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Baixa a camada como HTML completo e independente (um arquivo só). Nome: "<nome-da-camada>.html". */
export function exportHtmlFile(node, assets, styles = null) {
  download(`${slugify(node.name)}.html`, exportHtml(node, assets, node.name, styles), 'text/html');
}

/**
 * Baixa o PROJETO inteiro como `.designer.json` (todas as páginas, imagens e estilos). É o backup de verdade:
 * o salvamento automático fica só no navegador. Para abrir de novo: Arquivo → Abrir.
 */
export function saveProject(doc) {
  download(`${slugify(doc.name)}.designer.json`, JSON.stringify(doc), 'application/json');
}

/**
 * Lê um arquivo de projeto (.json) escolhido pelo usuário. Valida o mínimo (tem páginas) e completa campos que
 * projetos antigos não tinham. Lança um erro com mensagem amigável se o arquivo não for um projeto.
 * @param {File} file
 */
export async function openProjectFile(file) {
  const doc = JSON.parse(await file.text());
  if (!doc?.pages?.length) throw new Error('Arquivo inválido: não parece um projeto do Stylo.');
  doc.assets ||= {};
  return doc;
}

/**
 * Exporta a camada como PNG. Técnica: monta o HTML+CSS da camada (o MESMO do painel Código), embrulha num SVG com
 * <foreignObject>, carrega como imagem e desenha num <canvas> na escala pedida (2x = dobro de pixels, nítido em telas HiDPI).
 * Se a camada está girada, a imagem tem o tamanho da caixa rotacionada e a camada fica centralizada nela.
 *
 * LIMITAÇÕES: o navegador não carrega fontes da web dentro de uma imagem SVG, então só valem as fontes INSTALADAS no
 * computador; e efeitos como backdrop-filter podem não aparecer. (O HTML/SVG exportados não têm essas limitações.)
 * @param {object} node  camada
 * @param {object} assets  imagens do documento
 * @param {number} [scale=2]  1 a 4
 */
export async function exportPng(node, assets, scale = 2, styles = null) {
  const blob = await renderPng(node, assets, scale, styles);
  download(`${slugify(node.name)}@${scale}x.png`, blob);
}

/**
 * Desenha a camada como PNG e devolve o arquivo (Blob), sem baixar. Usado pelo exportPng e pela IA (ferramenta
 * get_image do MCP: o Claude/GPT "vê" o design). Mesmas limitações do exportPng (fontes instaladas, sem vidro).
 * @returns {Promise<Blob>}
 */
export async function renderPng(node, assets, scale = 2, styles = null) {
  const rad = ((node.rotation || 0) * Math.PI) / 180;
  const W = Math.ceil(Math.abs(node.w * Math.cos(rad)) + Math.abs(node.h * Math.sin(rad)));
  const H = Math.ceil(Math.abs(node.w * Math.sin(rad)) + Math.abs(node.h * Math.cos(rad)));
  const gen = generateCode([node], null, assets, { root: true, styles });
  const html = gen.html;
  const css = joinCss([gen]);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px;display:grid;place-items:center">` +
    `<style>${EXPORT_RESET}${css}</style>${html}</div></foreignObject></svg>`;
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Não foi possível renderizar a imagem.'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, W, H);
  return new Promise((r) => canvas.toBlob(r, 'image/png'));
}

/** Baixa a camada como SVG vetorial (ver svg.js). `boxOf` mede cada filho no DOM para respeitar flexbox/grid. */
export function exportSvgFile(node, assets, boxOf) {
  download(`${slugify(node.name)}.svg`, toSvg(node, { assets, boxOf }), 'image/svg+xml');
}
