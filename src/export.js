// Exportação: PNG (via SVG foreignObject), HTML standalone e arquivo de projeto (.json).
import { exportHtml, generateCode } from './css.js';
import { toSvg } from './svg.js';
import { slugify } from './model.js';

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

export function exportHtmlFile(node, assets) {
  download(`${slugify(node.name)}.html`, exportHtml(node, assets, node.name), 'text/html');
}

export function saveProject(doc) {
  download(`${slugify(doc.name)}.designer.json`, JSON.stringify(doc), 'application/json');
}

export async function openProjectFile(file) {
  const doc = JSON.parse(await file.text());
  if (!doc?.pages?.length) throw new Error('Arquivo inválido: não parece um projeto do Projeto Designer.');
  doc.assets ||= {};
  return doc;
}

/** Renderiza o nó como PNG. Limitação: só usa fontes instaladas no sistema (o navegador não carrega fontes web dentro de SVG-imagem). */
export async function exportPng(node, assets, scale = 2) {
  const rad = ((node.rotation || 0) * Math.PI) / 180;
  const W = Math.ceil(Math.abs(node.w * Math.cos(rad)) + Math.abs(node.h * Math.sin(rad)));
  const H = Math.ceil(Math.abs(node.w * Math.sin(rad)) + Math.abs(node.h * Math.cos(rad)));
  const { html, css } = generateCode([node], null, assets, { root: true });
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px;display:grid;place-items:center">` +
    `<style>*{margin:0;box-sizing:border-box}${css}</style>${html}</div></foreignObject></svg>`;
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
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  download(`${slugify(node.name)}@${scale}x.png`, blob);
}

/** Exporta o nó como SVG vetorial. `boxOf` mede cada filho no DOM (necessário para flexbox/grid). */
export function exportSvgFile(node, assets, boxOf) {
  download(`${slugify(node.name)}.svg`, toSvg(node, { assets, boxOf }), 'image/svg+xml');
}
