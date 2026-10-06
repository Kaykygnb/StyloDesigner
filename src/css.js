// Converte nós do documento em CSS real. É usado pelo canvas, pelo painel "Código" e pela exportação HTML,
// então o que você vê no editor é exatamente o que o navegador renderiza.
import { isFlow, hasLayout, round, slugify } from './model.js';

const px = (v) => `${round(v)}px`;
const GRID_ALIGN = { 'flex-start': 'start', center: 'center', 'flex-end': 'end', auto: 'start' };

export function hexToRgb(hex) {
  let h = String(hex || '#000000').replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgba(hex, a = 1) {
  const { r, g, b } = hexToRgb(hex);
  if (a >= 1) return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  return `rgba(${r}, ${g}, ${b}, ${round(a, 3)})`;
}

const stopsCss = (stops) =>
  [...stops]
    .sort((a, b) => a.pos - b.pos)
    .map((s) => `${rgba(s.color, s.opacity)} ${round(s.pos)}%`)
    .join(', ');

/** Propriedades CSS de um preenchimento (fill). */
export function fillCss(fill, assets = {}) {
  if (!fill) return {};
  switch (fill.type) {
    case 'solid':
      return { 'background-color': rgba(fill.color, fill.opacity) };
    case 'linear':
      return { 'background-image': `linear-gradient(${round(fill.angle)}deg, ${stopsCss(fill.stops)})` };
    case 'radial':
      return { 'background-image': `radial-gradient(circle at center, ${stopsCss(fill.stops)})` };
    case 'image': {
      const src = assets[fill.assetId];
      if (!src) return { 'background-color': '#c4c4c4' };
      return {
        'background-image': `url("${src}")`,
        'background-size': fill.fit === 'fill' ? '100% 100%' : fill.fit,
        'background-position': 'center',
        'background-repeat': 'no-repeat',
      };
    }
    default:
      return {};
  }
}

const fontStack = (family) => (family.includes(',') ? family : `'${family}', system-ui, sans-serif`);

/**
 * Estilo CSS de um nó. `parent` é o nó pai (ou null na raiz da página).
 * opts.root: usado na exportação, o elemento raiz vira position:relative.
 */
export function nodeStyle(node, parent, assets = {}, opts = {}) {
  const s = {};
  const flow = !opts.root && isFlow(node, parent);
  const isText = node.type === 'text';
  s['box-sizing'] = 'border-box';

  // ---- posição e tamanho ----------------------------------------------------------
  if (opts.root) {
    s.position = 'relative';
    s.width = px(node.w);
    s.height = px(node.h);
  } else if (flow && parent.layout.mode === 'grid') {
    // item de CSS Grid
    s.position = 'relative';
    s.width = node.sizeX === 'fixed' ? px(node.w) : 'auto';
    s.height = node.sizeY === 'fixed' ? px(node.h) : 'auto';
    s['justify-self'] = node.sizeX === 'fill' ? 'stretch' : 'start';
    s['align-self'] = node.sizeY === 'fill' ? 'stretch' : GRID_ALIGN[node.alignSelf] || 'start';
    if ((node.colSpan || 1) > 1) s['grid-column'] = `span ${node.colSpan}`;
    if ((node.rowSpan || 1) > 1) s['grid-row'] = `span ${node.rowSpan}`;
  } else if (flow) {
    const row = parent.layout.mode === 'row';
    const mainFill = row ? node.sizeX === 'fill' : node.sizeY === 'fill';
    const crossFill = row ? node.sizeY === 'fill' : node.sizeX === 'fill';
    s.position = 'relative';
    s.flex = mainFill ? '1 1 0%' : '0 0 auto';
    if (mainFill) s[row ? 'min-width' : 'min-height'] = '0';
    if (crossFill) s['align-self'] = 'stretch';
    else if (node.alignSelf && node.alignSelf !== 'auto') s['align-self'] = node.alignSelf;
    s.width = node.sizeX === 'fixed' ? px(node.w) : 'auto';
    s.height = node.sizeY === 'fixed' ? px(node.h) : 'auto';
  } else {
    s.position = 'absolute';
    s.left = px(node.x);
    s.top = px(node.y);
    s.width = node.sizeX === 'hug' ? 'max-content' : px(node.w);
    s.height = node.sizeY === 'hug' ? 'auto' : px(node.h);
  }

  // ---- auto layout = flexbox ou grid -----------------------------------------------
  if (hasLayout(node)) {
    const L = node.layout;
    const [t, r, b, l] = L.padding;
    if (L.mode === 'grid') {
      const hug = node.sizeX === 'hug';
      const track = hug ? 'max-content' : 'minmax(0, 1fr)';
      s.display = 'grid';
      s['grid-template-columns'] = `repeat(${L.cols || 2}, ${track})`;
      if (L.rows > 0) s['grid-template-rows'] = `repeat(${L.rows}, minmax(0, 1fr))`;
      s.gap = `${px(L.rowGap ?? L.gap)} ${px(L.colGap ?? L.gap)}`;
      s['justify-items'] = GRID_ALIGN[L.justify] || 'start';
      s['align-items'] = GRID_ALIGN[L.align] || 'start';
    } else {
      s.display = 'flex';
      s['flex-direction'] = L.mode;
      s.gap = px(L.gap);
      s['justify-content'] = L.justify;
      s['align-items'] = L.align;
      if (L.wrap) {
        s['flex-wrap'] = 'wrap';
        s['align-content'] = 'flex-start';
      }
    }
    if (t || r || b || l) s.padding = `${px(t)} ${px(r)} ${px(b)} ${px(l)}`;
  }
  if (node.type === 'frame' && node.clip) s.overflow = 'hidden';

  if (node.type === 'line') {
    lineStyle(node, s, flow);
    return s;
  }

  // ---- texto ----------------------------------------------------------------------
  if (isText) {
    s['font-family'] = fontStack(node.fontFamily);
    s['font-size'] = px(node.fontSize);
    s['font-weight'] = node.fontWeight;
    if (node.fontStyle !== 'normal') s['font-style'] = node.fontStyle;
    s['line-height'] = node.lineHeight ? String(round(node.lineHeight, 3)) : 'normal';
    if (node.letterSpacing) s['letter-spacing'] = px(node.letterSpacing);
    s['text-align'] = node.textAlign;
    if (node.textDecoration !== 'none') s['text-decoration'] = node.textDecoration;
    s['white-space'] = node.sizeX === 'hug' ? 'pre' : 'pre-wrap';
    s['overflow-wrap'] = 'break-word';
    const f = node.fill;
    if (!f || f.type === 'none') s.color = 'transparent';
    else if (f.type === 'solid') s.color = rgba(f.color, f.opacity);
    else {
      Object.assign(s, fillCss(f, assets));
      s['-webkit-background-clip'] = 'text';
      s['background-clip'] = 'text';
      s.color = 'transparent';
    }
  } else if (node.type !== 'path') {
    Object.assign(s, fillCss(node.fill, assets));
  }

  // ---- forma ----------------------------------------------------------------------
  if (node.type === 'ellipse') s['border-radius'] = '50%';
  else if (node.radius && node.radius.some(Boolean) && !isText) {
    const [a, b, c, d] = node.radius;
    s['border-radius'] = a === b && b === c && c === d ? px(a) : `${px(a)} ${px(b)} ${px(c)} ${px(d)}`;
  }

  // ---- contorno (outline segue border-radius e não afeta o layout) -----------------
  const st = node.stroke;
  if (st && st.width > 0 && node.type !== 'path') {
    if (isText) {
      s['-webkit-text-stroke'] = `${px(st.width)} ${rgba(st.color, st.opacity)}`;
    } else {
      s.outline = `${px(st.width)} ${st.style} ${rgba(st.color, st.opacity)}`;
      s['outline-offset'] =
        st.position === 'inside' ? px(-st.width) : st.position === 'center' ? px(-st.width / 2) : '0px';
    }
  }

  // ---- efeitos --------------------------------------------------------------------
  const isPath = node.type === 'path';
  const filters = [];
  if (node.shadows?.length) {
    if (isPath) {
      for (const sh of node.shadows) filters.push(`drop-shadow(${px(sh.x)} ${px(sh.y)} ${px(sh.blur)} ${rgba(sh.color, sh.opacity)})`);
    } else {
      const list = node.shadows.map((sh) =>
        isText
          ? `${px(sh.x)} ${px(sh.y)} ${px(sh.blur)} ${rgba(sh.color, sh.opacity)}`
          : `${sh.inset ? 'inset ' : ''}${px(sh.x)} ${px(sh.y)} ${px(sh.blur)} ${px(sh.spread)} ${rgba(sh.color, sh.opacity)}`,
      );
      s[isText ? 'text-shadow' : 'box-shadow'] = list.join(', ');
    }
  }
  if (node.blur > 0) filters.push(`blur(${px(node.blur)})`);
  if (filters.length) s.filter = filters.join(' ');
  if (node.bgBlur > 0) {
    s['backdrop-filter'] = `blur(${px(node.bgBlur)})`;
    s['-webkit-backdrop-filter'] = `blur(${px(node.bgBlur)})`;
  }
  if (node.opacity < 1) s.opacity = String(round(node.opacity, 3));
  if (node.blend && node.blend !== 'normal') s['mix-blend-mode'] = node.blend;
  const tf = transformOf(node);
  if (tf) s.transform = tf;
  if (node.isMask) s.display = 'none';
  if (node.type === 'group') {
    const clip = maskClip(node);
    if (clip) s['clip-path'] = clip;
  }

  return s;
}


/** rotate + espelhamento (flipX/flipY) numa única propriedade `transform`. */
export function transformOf(node) {
  const parts = [];
  if (node.rotation) parts.push(`rotate(${round(node.rotation, 2)}deg)`);
  if (node.flipX || node.flipY) parts.push(`scale(${node.flipX ? -1 : 1}, ${node.flipY ? -1 : 1})`);
  return parts.join(' ');
}

/** Linha: uma barra de `stroke.width` px desenhada com gradiente, dentro de uma caixa de 12px (fácil de clicar). */
function lineStyle(node, s, flow) {
  const st = node.stroke || { color: '#000000', opacity: 1, width: 2, style: 'solid' };
  const w = Math.max(0.5, st.width);
  const col = rgba(st.color, st.opacity);
  s.height = px(Math.max(12, w));
  if (flow) s.height = px(Math.max(12, w));
  const none = 'transparent';
  s['background-repeat'] = 'repeat-x';
  s['background-position'] = 'center';
  if (st.style === 'dashed') {
    s['background-image'] = `linear-gradient(90deg, ${col} 0 ${w * 3}px, ${none} ${w * 3}px ${w * 5}px)`;
    s['background-size'] = `${w * 5}px ${w}px`;
  } else if (st.style === 'dotted') {
    s['background-image'] = `radial-gradient(circle, ${col} 0 ${w / 2}px, ${none} ${w / 2}px)`;
    s['background-size'] = `${w * 2}px ${w}px`;
  } else {
    s['background-image'] = `linear-gradient(${col}, ${col})`;
    s['background-size'] = `100% ${w}px`;
  }
  if (node.shadows?.length) {
    s.filter = node.shadows.map((sh) => `drop-shadow(${px(sh.x)} ${px(sh.y)} ${px(sh.blur)} ${rgba(sh.color, sh.opacity)})`).join(' ');
  }
  if (node.opacity < 1) s.opacity = String(round(node.opacity, 3));
  if (node.blend && node.blend !== 'normal') s['mix-blend-mode'] = node.blend;
  const tf = transformOf(node);
  if (tf) s.transform = tf;
}

// ---------------------------------------------------------------- vetores (caminhos SVG)
const num = (n) => round(n, 2);

/** Dados `d` de um <path> a partir dos pontos com alças de Bézier. */
export function pathData(points, closed, tx = (x) => x, ty = (y) => y) {
  if (!points.length) return '';
  const P = (pt) => `${num(tx(pt.x))} ${num(ty(pt.y))}`;
  let d = `M ${P(points[0])}`;
  const seg = (a, b) => {
    if (!a.hout && !b.hin) return ` L ${P(b)}`;
    const c1 = a.hout || a, c2 = b.hin || b;
    return ` C ${P(c1)} ${P(c2)} ${P(b)}`;
  };
  for (let i = 1; i < points.length; i++) d += seg(points[i - 1], points[i]);
  if (closed && points.length > 1) d += seg(points[points.length - 1], points[0]) + ' Z';
  return d;
}

function svgPaint(fill, id, assets) {
  if (!fill || fill.type === 'none') return { paint: 'none', defs: '' };
  if (fill.type === 'solid') return { paint: rgba(fill.color, 1), opacity: fill.opacity, defs: '' };
  if (fill.type === 'image') return { paint: '#c4c4c4', defs: '' };
  const stops = [...fill.stops].sort((a, b) => a.pos - b.pos)
    .map((st) => `<stop offset="${round(st.pos)}%" stop-color="${rgba(st.color, 1)}" stop-opacity="${st.opacity}"/>`).join('');
  if (fill.type === 'radial') {
    return { paint: `url(#g-${id})`, defs: `<radialGradient id="g-${id}">${stops}</radialGradient>` };
  }
  const a = (fill.angle * Math.PI) / 180;
  const dx = Math.sin(a) / 2, dy = -Math.cos(a) / 2;
  return {
    paint: `url(#g-${id})`,
    defs: `<linearGradient id="g-${id}" x1="${num(0.5 - dx)}" y1="${num(0.5 - dy)}" x2="${num(0.5 + dx)}" y2="${num(0.5 + dy)}">${stops}</linearGradient>`,
  };
}

/** SVG interno de um nó `path`. A área clicável usa um traço transparente mais grosso. */
export function pathSvg(node, assets = {}) {
  const d = pathData(node.points, node.closed);
  const { paint, opacity, defs } = svgPaint(node.fill, node.id, assets);
  const st = node.stroke;
  const w = st && st.width > 0 ? st.width : 0;
  const dash = !w ? '' : st.style === 'dashed' ? ` stroke-dasharray="${w * 3} ${w * 2}"` : st.style === 'dotted' ? ` stroke-dasharray="0 ${w * 2}"` : '';
  const stroke = w
    ? ` stroke="${rgba(st.color, 1)}" stroke-opacity="${st.opacity}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${dash}`
    : '';
  const fo = opacity != null && opacity < 1 ? ` fill-opacity="${opacity}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(node.vw)} ${num(node.vh)}" width="100%" height="100%" preserveAspectRatio="none" style="display:block;overflow:visible">` +
    `${defs ? `<defs>${defs}</defs>` : ''}` +
    `<path d="${d}" fill="${node.closed || paint !== 'none' ? paint : 'none'}"${fo}${stroke} vector-effect="non-scaling-stroke" data-vis="1"/>` +
    `<path d="${d}" fill="none" stroke="transparent" stroke-width="12" vector-effect="non-scaling-stroke" data-hit="1"/>` +
    `</svg>`;
}

/** clip-path de um grupo-máscara, a partir do filho marcado como `isMask`. */
export function maskClip(group) {
  const m = group.children?.find((c) => c.isMask);
  if (!m) return '';
  if (m.type === 'ellipse') {
    return `ellipse(${px(m.w / 2)} ${px(m.h / 2)} at ${px(m.x + m.w / 2)} ${px(m.y + m.h / 2)})`;
  }
  if (m.type === 'path') {
    const sx = m.w / (m.vw || 1), sy = m.h / (m.vh || 1);
    return `path('${pathData(m.points, true, (x) => m.x + x * sx, (y) => m.y + y * sy)}')`;
  }
  const [a, b, c, d] = m.radius || [0, 0, 0, 0];
  const round_ = a || b || c || d ? ` round ${px(a)} ${px(b)} ${px(c)} ${px(d)}` : '';
  return `inset(${px(m.y)} ${px(group.w - m.x - m.w)} ${px(group.h - m.y - m.h)} ${px(m.x)}${round_})`;
}

export const toCssText = (style) =>
  Object.entries(style)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');

export function cssRule(selector, style, indent = '') {
  const body = Object.entries(style)
    .map(([k, v]) => `${indent}  ${k}: ${v};`)
    .join('\n');
  return `${indent}${selector} {\n${body}\n${indent}}`;
}

/** Nome de classe único por nó, derivado do nome da camada. */
function makeClassNamer() {
  const used = new Map();
  return (node) => {
    const base = slugify(node.name);
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Gera { html, css } de uma árvore de nós, com classes legíveis. */
export function generateCode(nodes, parent, assets = {}, { root = false } = {}) {
  const className = makeClassNamer();
  const rules = [];
  const build = (node, par, depth, isRoot) => {
    if (!node.visible) return '';
    const cls = className(node);
    rules.push(cssRule(`.${cls}`, nodeStyle(node, par, assets, { root: isRoot })));
    const pad = '  '.repeat(depth);
    if (node.type === 'text') {
      return `${pad}<p class="${cls}">${escapeHtml(node.text)}</p>`;
    }
    if (node.type === 'path') {
      return `${pad}<div class="${cls}">\n${pad}  ${pathSvg(node, assets)}\n${pad}</div>`;
    }
    const kids = (node.children || []).map((c) => build(c, node, depth + 1, false)).filter(Boolean);
    if (!kids.length) return `${pad}<div class="${cls}"></div>`;
    return `${pad}<div class="${cls}">\n${kids.join('\n')}\n${pad}</div>`;
  };
  const html = nodes.map((n, i) => build(n, parent, 0, root && i === 0)).filter(Boolean).join('\n');
  return { html, css: rules.join('\n\n') };
}

/** Documento HTML completo e standalone de um nó. */
export function exportHtml(node, assets, title = 'Design') {
  const { html, css } = generateCode([node], null, assets, { root: true });
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
* { margin: 0; box-sizing: border-box; }
body { display: grid; place-items: start center; padding: 24px; background: #f3f3f5; }
${css}
</style>
</head>
<body>
${html}
</body>
</html>
`;
}
