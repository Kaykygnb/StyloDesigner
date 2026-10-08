/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  svg.js — EXPORTAÇÃO SVG VETORIAL   (módulo puro: sem DOM)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Reescreve uma camada e seus filhos como SVG (não é "HTML dentro de SVG": são formas de verdade, editáveis em
 *  Illustrator/Inkscape/Figma). A posição dos filhos vem de um callback para respeitar flexbox/grid.
 *  Testado em tests/features.test.js.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { nodePathData, rgba, hasStrokeSides } from './css.js';
import { round } from './model.js';

/** Arredonda para 2 casas decimais (mantém o SVG enxuto). */
const n2 = (v) => round(v, 2);
/** Escapa & < > " para colocar texto do usuário com segurança dentro do SVG. */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Caminho SVG de um retângulo com 4 raios independentes [tl, tr, br, bl] (arcos A nos cantos).
 * Cada raio é limitado à metade da menor dimensão, como o CSS faz com border-radius.
 */
function roundedRect(w, h, r) {
  const [tl, tr, br, bl] = r.map((v) => Math.max(0, Math.min(v, w / 2, h / 2)));
  return `M ${tl} 0 H ${w - tr} A ${tr} ${tr} 0 0 1 ${w} ${tr} V ${h - br} A ${br} ${br} 0 0 1 ${w - br} ${h} H ${bl} A ${bl} ${bl} 0 0 1 0 ${h - bl} V ${tl} A ${tl} ${tl} 0 0 1 ${tl} 0 Z`;
}

/**
 * Contorno (atributo `d`) de uma camada em coordenadas locais (0,0)–(w,h): elipse como 2 arcos, vetor com seus
 * pontos escalados para a caixa, e o resto como retângulo arredondado.
 */
function shapeD(node, w, h) {
  if (node.type === 'ellipse') return `M 0 ${h / 2} A ${w / 2} ${h / 2} 0 1 0 ${w} ${h / 2} A ${w / 2} ${h / 2} 0 1 0 0 ${h / 2} Z`;
  if (node.type === 'path') {
    const sx = w / (node.vw || 1), sy = h / (node.vh || 1);
    return nodePathData(node, (x) => x * sx, (y) => y * sy);
  }
  return roundedRect(w, h, node.radius || [0, 0, 0, 0]);
}

/**
 * ★ Exporta uma camada (e filhos) como SVG VETORIAL de verdade (formas, textos, gradientes, sombras, máscaras).
 *
 * Diferença para o PNG/HTML: aqui TUDO é reescrito em SVG. Como o SVG não tem flexbox/grid, a posição e o tamanho
 * de cada filho vêm de `boxOf(node, parent)` — no editor, essa função MEDE o DOM, então o resultado respeita o
 * auto layout exatamente como está na tela. Sem `boxOf` usa node.x/y/w/h.
 *
 * Limitações conhecidas: sombras internas e `backdrop-filter` (vidro) não existem em SVG e são omitidos;
 * contorno "dentro/fora" é aproximado encolhendo/expandindo a forma.
 *
 * @param {object} root  camada raiz (vira o tamanho do SVG)
 * @param {{assets?: object, boxOf?: (node, parent) => {x,y,w,h}}} [opts]
 * @returns {string} documento SVG
 */
export function toSvg(root, { assets = {}, boxOf = (n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }) } = {}) {
  // `defs` acumula definições reutilizáveis (gradientes, filtros, clip-paths) que vão no <defs> no topo do SVG
  const defs = [];
  // contador para gerar ids únicos (g1, f2, c3...) para as definições
  let uid = 0;
  const id = (p) => `${p}${++uid}`;

  /**
   * Atributo `fill` SVG de um preenchimento. Gradientes viram <linearGradient>/<radialGradient> em <defs> e o fill
   * referencia por url(#id). O ângulo CSS (0° = para cima) vira o vetor x1,y1→x2,y2. Imagens são tratadas à parte.
   */
  function paint(fill, w, h) {
    if (!fill || fill.type === 'none') return { attr: 'fill="none"' };
    if (fill.type === 'solid') return { attr: `fill="${rgba(fill.color, 1)}"${fill.opacity < 1 ? ` fill-opacity="${fill.opacity}"` : ''}` };
    if (fill.type === 'image') return { image: true };
    if (fill.type === 'conic') { // o SVG não tem gradiente cônico: usa a cor da 1ª parada
      const first = [...fill.stops].sort((a, b) => a.pos - b.pos)[0];
      return { attr: `fill="${rgba(first.color, 1)}"${first.opacity < 1 ? ` fill-opacity="${first.opacity}"` : ''}` };
    }
    const gid = id('g');
    const stops = [...fill.stops].sort((a, b) => a.pos - b.pos)
      .map((s) => `<stop offset="${n2(s.pos)}%" stop-color="${rgba(s.color, 1)}" stop-opacity="${s.opacity}"/>`).join('');
    if (fill.type === 'radial') {
      defs.push(`<radialGradient id="${gid}">${stops}</radialGradient>`);
    } else {
      const a = (fill.angle * Math.PI) / 180;
      const dx = Math.sin(a) / 2, dy = -Math.cos(a) / 2;
      defs.push(`<linearGradient id="${gid}" x1="${n2(0.5 - dx)}" y1="${n2(0.5 - dy)}" x2="${n2(0.5 + dx)}" y2="${n2(0.5 + dy)}">${stops}</linearGradient>`);
    }
    return { attr: `fill="url(#${gid})"` };
  }

  /** Atributos de contorno SVG (cor, espessura, opacidade e tracejado/pontilhado via stroke-dasharray). */
  function strokeAttr(st) {
    if (!st || !(st.width > 0)) return '';
    const dash = st.style === 'dashed' ? ` stroke-dasharray="${st.width * 3} ${st.width * 2}"` : st.style === 'dotted' ? ` stroke-dasharray="0 ${st.width * 2}" stroke-linecap="round"` : '';
    return ` stroke="${rgba(st.color, 1)}" stroke-width="${st.width}"${st.opacity < 1 ? ` stroke-opacity="${st.opacity}"` : ''}${dash}`;
  }

  /**
   * Sombra externa e blur da camada como <filter> (feDropShadow + feGaussianBlur). stdDeviation = blur/2 porque o
   * "blur" do CSS corresponde a ~2× o desvio-padrão do SVG. A área do filtro é ampliada (−50%…200%) para a sombra não ser cortada.
   */
  function filterAttr(node) {
    const parts = [];
    for (const s of node.shadows || []) {
      if (s.inset) continue;
      parts.push(`<feDropShadow dx="${s.x}" dy="${s.y}" stdDeviation="${n2(s.blur / 2)}" flood-color="${rgba(s.color, 1)}" flood-opacity="${s.opacity}"/>`);
    }
    if (node.blur > 0) parts.push(`<feGaussianBlur stdDeviation="${n2(node.blur / 2)}"/>`);
    if (!parts.length) return '';
    const fid = id('f');
    defs.push(`<filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%">${parts.join('')}</filter>`);
    return ` filter="url(#${fid})"`;
  }

  /**
   * Texto em SVG: uma <tspan> por linha (SVG não quebra linha sozinho). Calcula o deslocamento vertical para
   * 'centro'/'embaixo' quando a caixa tem altura fixa e aplica text-transform na própria string (SVG não tem isso).
   */
  function textSvg(node, w, h) {
    const fs = node.fontSize, lh = (node.lineHeight || 1.2) * fs;
    const anchor = node.textAlign === 'center' ? 'middle' : node.textAlign === 'right' ? 'end' : 'start';
    const x = node.textAlign === 'center' ? w / 2 : node.textAlign === 'right' ? w : 0;
    const blockH = String(node.text).split('\n').length * lh;
    const dy = node.sizeY === 'fixed' ? { center: (h - blockH) / 2, bottom: h - blockH }[node.textVAlign] || 0 : 0;
    const f = node.fill;
    let fillAttr = 'fill="none"';
    if (f?.type === 'solid') fillAttr = `fill="${rgba(f.color, 1)}"${f.opacity < 1 ? ` fill-opacity="${f.opacity}"` : ''}`;
    else if (f && f.type !== 'none') fillAttr = paint(f, w, 0).attr || fillAttr;
    const tt = { uppercase: (x) => x.toUpperCase(), lowercase: (x) => x.toLowerCase(), capitalize: (x) => x.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) }[node.textTransform];
    const lines = (tt ? tt(String(node.text)) : String(node.text)).split('\n');
    const tspans = lines.map((l, i) => `<tspan x="${n2(x)}" y="${n2(dy + i * lh + lh / 2)}">${esc(l) || ' '}</tspan>`).join('');
    const extra = `${node.fontStyle === 'italic' ? ' font-style="italic"' : ''}${node.textDecoration !== 'none' ? ` text-decoration="${node.textDecoration}"` : ''}${node.letterSpacing ? ` letter-spacing="${node.letterSpacing}"` : ''}${node.wordSpacing ? ` word-spacing="${node.wordSpacing}"` : ''}`;
    return `<text ${fillAttr} font-family="${esc(node.fontFamily)}, sans-serif" font-size="${fs}" font-weight="${node.fontWeight}" text-anchor="${anchor}" dominant-baseline="central" style="white-space:pre"${extra}>${tspans}</text>`;
  }

  /**
   * Conteúdo SVG de uma IMAGEM de fundo dentro da caixa w×h, imitando o CSS do editor:
   *  - cover/contain/fill → <image preserveAspectRatio>; a posição (posX/posY) vira o alinhamento mais próximo entre 3
   *    (início/meio/fim) — o SVG não tem posição em %, então nesses ajustes é uma aproximação;
   *  - tamanho próprio ('size') → posição e tamanho EXATOS (usa natW/natH, o tamanho original guardado ao escolher a
   *    imagem); com repeat vira <pattern> (ladrilho). Sem natW/natH cai no "cobrir".
   * (Repetir junto com "conter" não é exportado: sai uma imagem só.)
   */
  function imageSvg(fill, w, h, src) {
    const fit = fill.fit || 'cover';
    const bx = (fill.posX ?? 50) / 100, by = (fill.posY ?? 50) / 100;
    if (fit === 'size' && fill.natW > 0 && fill.natH > 0) {
      const tw = (w * (fill.size ?? 100)) / 100, th = (tw * fill.natH) / fill.natW;
      const ox = (w - tw) * bx, oy = (h - th) * by;
      const rep = fill.repeat || 'no-repeat';
      const img = `<image href="${src}" width="${n2(tw)}" height="${n2(th)}" preserveAspectRatio="none"`;
      if (rep === 'no-repeat') return `${img} x="${n2(ox)}" y="${n2(oy)}"/>`;
      const pid = id('p');
      defs.push(`<pattern id="${pid}" patternUnits="userSpaceOnUse" x="${n2(ox)}" y="${n2(oy)}" width="${n2(tw)}" height="${n2(th)}">${img}/></pattern>`);
      // repeat-x só ladrilha na horizontal (uma faixa na altura da imagem); repeat-y só na vertical
      const rx = rep === 'repeat-y' ? ox : 0, rw = rep === 'repeat-y' ? tw : w;
      const ry = rep === 'repeat-x' ? oy : 0, rh = rep === 'repeat-x' ? th : h;
      return `<rect x="${n2(rx)}" y="${n2(ry)}" width="${n2(rw)}" height="${n2(rh)}" fill="url(#${pid})"/>`;
    }
    const ax = bx < 0.33 ? 'xMin' : bx > 0.67 ? 'xMax' : 'xMid';
    const ay = by < 0.33 ? 'YMin' : by > 0.67 ? 'YMax' : 'YMid';
    const par = fit === 'fill' ? 'none' : `${ax}${ay} ${fit === 'contain' ? 'meet' : 'slice'}`;
    return `<image href="${src}" width="${n2(w)}" height="${n2(h)}" preserveAspectRatio="${par}"/>`;
  }

  /**
   * Forma + contorno de retângulo/elipse/frame/vetor. Retângulos sem cantos viram <rect> simples (mais limpo);
   * com cantos/elipse/vetor viram <path>. Imagem: <image> recortada pela forma, com o mesmo `fit` do editor.
   */
  function shapeSvg(node, w, h) {
    const p = paint(node.fill, w, h);
    const st = node.stroke;
    const hasStroke = st?.width > 0;
    const out = [];
    const plainRect = node.type === 'rect' || node.type === 'frame';
    const hasRadius = (node.radius || []).some(Boolean);

    if (p.image) {
      const src = assets[node.fill.assetId];
      const cid = id('c');
      defs.push(`<clipPath id="${cid}"><path d="${shapeD(node, w, h)}"/></clipPath>`);
      if (src) out.push(`<g clip-path="url(#${cid})">${imageSvg(node.fill, w, h, src)}</g>`);
    } else if (plainRect && !hasRadius) {
      out.push(`<rect width="${n2(w)}" height="${n2(h)}" ${p.attr}/>`);
    } else {
      out.push(`<path d="${shapeD(node, w, h)}" ${p.attr}${node.fillRule === 'evenodd' ? ' fill-rule="evenodd"' : ''}/>`);
    }

    if (st && hasStrokeSides(node)) {
      // contorno por lado (border-top/right/bottom/left): uma linha por lado, DENTRO da caixa
      const [t, r, b, l] = st.sides;
      const line = (x1, y1, x2, y2, sw) => sw > 0 && out.push(`<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}"${strokeAttr({ ...st, width: sw })}/>`);
      line(0, t / 2, w, t / 2, t);
      line(w - r / 2, 0, w - r / 2, h, r);
      line(0, h - b / 2, w, h - b / 2, b);
      line(l / 2, 0, l / 2, h, l);
    } else if (hasStroke) {
      if (node.type === 'path') {
        // vetores: traço centrado, com espessura constante ao esticar
        // extremidade e quina como no editor (padrão: redondas); tracejado "pontilhado" já define a própria extremidade
        const cap = st.style === 'dotted' ? '' : ` stroke-linecap="${st.cap || 'round'}"`;
        out.push(`<path d="${shapeD(node, w, h)}" fill="none"${strokeAttr(st)}${cap} stroke-linejoin="${st.join || 'round'}" vector-effect="non-scaling-stroke"/>`);
      } else {
        // "dentro/fora": encolhe/expande a forma em metade da espessura (o SVG só tem traço centrado)
        const inset = { inside: -st.width / 2, outside: st.width / 2, center: 0 }[st.position] ?? 0;
        const d = shapeD(node, Math.max(1, w + inset * 2), Math.max(1, h + inset * 2));
        out.push(`<path d="${d}" transform="translate(${n2(-inset)} ${n2(-inset)})" fill="none"${strokeAttr(st)}/>`);
      }
    }
    return out.join('');
  }

  /**
   * Converte UMA camada (recursivo) em <g>. Ordem das transformações: posição (translate) → rotação em torno do centro
   * → espelhamento. Frames com "cortar conteúdo" recortam os filhos por <clipPath>; grupos com máscara usam a forma
   * da camada-máscara como clipPath.
   */
  function render(node, parent, isRoot) {
    if (!node.visible) return '';
    const b = isRoot ? { x: 0, y: 0, w: node.w, h: node.h } : boxOf(node, parent);
    const { w, h } = b;
    const tf = [];
    if (b.x || b.y) tf.push(`translate(${n2(b.x)} ${n2(b.y)})`);
    if (node.rotation) tf.push(`rotate(${n2(node.rotation)} ${n2(w / 2)} ${n2(h / 2)})`);
    if (node.flipX || node.flipY) tf.push(`translate(${node.flipX ? w : 0} ${node.flipY ? h : 0}) scale(${node.flipX ? -1 : 1} ${node.flipY ? -1 : 1})`);
    const attrs = [
      tf.length ? `transform="${tf.join(' ')}"` : '',
      node.opacity < 1 ? `opacity="${node.opacity}"` : '',
      node.blend && node.blend !== 'normal' ? `style="mix-blend-mode:${node.blend}"` : '',
      filterAttr(node).trim(),
      `data-name="${esc(node.name)}"`,
    ].filter(Boolean).join(' ');

    let inner = '';
    if (node.type === 'text') inner = textSvg(node, w, h);
    else if (node.type === 'line') {
      const st = node.stroke || {};
      inner = `<line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}"${strokeAttr({ ...st, position: 'center' })} stroke-linecap="${st.style === 'dotted' ? 'round' : 'butt'}"/>`;
    } else if (node.type !== 'group') inner = shapeSvg(node, w, h);

    let kids = (node.children || []).map((c) => render(c, node, false)).join('');
    if (node.type === 'frame' && node.clip && kids) {
      const cid = id('c');
      defs.push(`<clipPath id="${cid}"><path d="${shapeD(node, w, h)}"/></clipPath>`);
      kids = `<g clip-path="url(#${cid})">${kids}</g>`;
    }
    if (node.type === 'group') {
      const m = node.children.find((c) => c.isMask);
      if (m) {
        const cid = id('c');
        const mb = boxOf(m, node);
        defs.push(`<clipPath id="${cid}"><path transform="translate(${n2(mb.x)} ${n2(mb.y)})" d="${shapeD(m, mb.w, mb.h)}"/></clipPath>`);
        kids = `<g clip-path="url(#${cid})">${kids}</g>`;
      }
    }
    return `<g ${attrs}>${inner}${kids}</g>`;
  }

  // monta o SVG final: tamanho = tamanho do frame raiz, com as definições acumuladas no topo
  const body = render(root, null, true);
  const w = Math.ceil(root.w), h = Math.ceil(root.h);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${body}</svg>\n`;
}
