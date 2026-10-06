// Modelo de dados do documento. Funções puras, sem DOM (testáveis no Node).

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 8);

export const round = (n, d = 2) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export const FONT_FAMILIES = [
  'Inter', 'system-ui', 'Arial', 'Helvetica', 'Verdana', 'Trebuchet MS', 'Georgia',
  'Times New Roman', 'Courier New', 'Poppins', 'DM Sans', 'Playfair Display', 'JetBrains Mono',
];

export const FONT_WEIGHTS = [
  [100, 'Thin'], [200, 'Extra Light'], [300, 'Light'], [400, 'Regular'],
  [500, 'Medium'], [600, 'Semi Bold'], [700, 'Bold'], [800, 'Extra Bold'], [900, 'Black'],
];

export const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge',
  'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue',
  'saturation', 'color', 'luminosity',
];

export const TYPE_LABEL = {
  frame: 'Frame', rect: 'Retângulo', ellipse: 'Elipse', text: 'Texto', group: 'Grupo',
  line: 'Linha', path: 'Vetor',
};

export const defaultFill = (color = '#D9D9D9') => ({
  type: 'solid',
  color,
  opacity: 1,
  stops: [
    { color: '#7C5CFF', opacity: 1, pos: 0 },
    { color: '#2DD4FF', opacity: 1, pos: 100 },
  ],
  angle: 135,
  assetId: null,
  fit: 'cover',
});

export const defaultStroke = () => ({ color: '#000000', opacity: 1, width: 1, style: 'solid', position: 'inside' });

export const defaultShadow = () => ({ x: 0, y: 4, blur: 16, spread: 0, color: '#000000', opacity: 0.25, inset: false });

export const defaultLayout = () => ({
  mode: 'none', // none | row | column (display:flex) | grid (display:grid)
  gap: 8,
  cols: 2, // só no modo grid
  rows: 0, // 0 = linhas automáticas
  colGap: 8,
  rowGap: 8,
  padding: [0, 0, 0, 0], // top right bottom left
  justify: 'flex-start',
  align: 'flex-start',
  wrap: false,
});

export function createNode(type, props = {}) {
  const node = {
    id: uid(),
    type,
    name: TYPE_LABEL[type] || type,
    x: 0, y: 0, w: 100, h: 100,
    rotation: 0,
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    fill: defaultFill(),
    stroke: null,
    radius: [0, 0, 0, 0],
    shadows: [],
    blur: 0,
    bgBlur: 0,
    sizeX: 'fixed', // fixed | hug | fill
    sizeY: 'fixed',
    absolute: false, // true = ignora o auto layout do pai (position:absolute)
    alignSelf: 'auto',
    flipX: false,
    flipY: false,
    lockRatio: false,
    constraints: { h: 'left', v: 'top' }, // left|right|leftright|center|scale / top|bottom|topbottom|center|scale
    colSpan: 1, // item de grid
    rowSpan: 1,
    interactions: [], // protótipo: [{ trigger:'click', action:'navigate'|'back'|'url', target, transition }]
  };
  if (type === 'frame') {
    node.fill = defaultFill('#FFFFFF');
    node.w = 320; node.h = 240;
    node.clip = true;
    node.layout = defaultLayout();
    node.grids = []; // grades de layout (colunas/linhas/quadrículas) só de guia
    node.children = [];
  } else if (type === 'line') {
    node.w = 160; node.h = 12;
    node.fill = { ...defaultFill(), type: 'none' };
    node.stroke = { ...defaultStroke(), width: 2, color: '#111111' };
  } else if (type === 'path') {
    node.points = []; // [{ x, y, hin:{x,y}|null, hout:{x,y}|null }] em coordenadas do viewBox
    node.closed = false;
    node.vw = 100; node.vh = 100;
    node.fill = { ...defaultFill(), type: 'none' };
    node.stroke = { ...defaultStroke(), width: 2, color: '#111111' };
  } else if (type === 'group') {
    node.children = [];
    node.fill = { ...defaultFill(), type: 'none' };
  } else if (type === 'text') {
    Object.assign(node, {
      text: 'Texto',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 400,
      fontStyle: 'normal',
      lineHeight: 1.4,
      letterSpacing: 0,
      textAlign: 'left',
      textDecoration: 'none',
      textTransform: 'none',
      textVAlign: 'top',
      sizeX: 'hug',
      sizeY: 'hug',
      w: 60, h: 22,
      fill: defaultFill('#111111'),
    });
  } else if (type === 'ellipse') {
    node.fill = defaultFill('#D9D9D9');
  }
  Object.assign(node, props);
  return node;
}

export const isContainer = (n) => !!n && (n.type === 'frame' || n.type === 'group');

/** Constraints de um nó (com padrão para documentos antigos). */
export const constraintsOf = (n) => n.constraints || { h: 'left', v: 'top' };

export const hasLayout = (n) => !!n && n.type === 'frame' && n.layout.mode !== 'none';

/** O nó participa do fluxo flex do pai? (position:relative em vez de absolute) */
export const isFlow = (node, parent) => hasLayout(parent) && !node.absolute;

export const cloneDeep = (v) => JSON.parse(JSON.stringify(v));

/** Clona um nó (e filhos) gerando ids novos. */
export function cloneNode(node) {
  const copy = cloneDeep(node);
  const reid = (n) => {
    n.id = uid();
    n.children?.forEach(reid);
  };
  reid(copy);
  return copy;
}

/** Percorre a árvore. fn(node, parent, list, index). Retornar false pula os filhos. */
export function walk(list, fn, parent = null) {
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    if (fn(n, parent, list, i) === false) continue;
    if (n.children) walk(n.children, fn, n);
  }
}

export function makePage(name = 'Página 1') {
  return { id: uid(), name, children: [], guides: [] };
}

export function makeDoc() {
  return { version: 1, name: 'Sem título', pages: [makePage()], assets: {}, styles: { colors: [], texts: [] } };
}

export function nextName(page, type) {
  let count = 0;
  walk(page.children, (n) => {
    if (n.type === type) count++;
  });
  return `${TYPE_LABEL[type] || type} ${count + 1}`;
}

/**
 * Ajusta grupos ao tamanho dos filhos (grupos não têm estilo próprio, são só caixas).
 * Remove grupos vazios. Roda ao final de cada gesto (commit).
 */
export function fitGroups(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    const n = list[i];
    if (!n.children) continue;
    fitGroups(n.children);
    if (n.type !== 'group') continue;
    if (!n.children.length) {
      list.splice(i, 1);
      continue;
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of n.children) {
      x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y);
      x1 = Math.max(x1, c.x + c.w); y1 = Math.max(y1, c.y + c.h);
    }
    if (x0 !== 0 || y0 !== 0) {
      for (const c of n.children) { c.x -= x0; c.y -= y0; }
      n.x += x0; n.y += y0;
    }
    n.w = round(x1 - x0);
    n.h = round(y1 - y0);
  }
}

/**
 * Quando um frame (sem auto layout) muda de tamanho, os filhos reagem conforme suas constraints,
 * como no Figma/Penpot. `ow`/`oh` = tamanho antes. Recursivo para frames e grupos filhos.
 */
export function applyConstraints(frame, ow, oh) {
  if (!frame.children || hasLayout(frame) || (frame.w === ow && frame.h === oh)) return;
  const dw = frame.w - ow, dh = frame.h - oh;
  const sx = ow ? frame.w / ow : 1, sy = oh ? frame.h / oh : 1;
  for (const c of frame.children) {
    const cw = c.w, ch = c.h;
    const { h, v } = constraintsOf(c);
    if (h === 'right') c.x += dw;
    else if (h === 'leftright') c.w = Math.max(1, c.w + dw);
    else if (h === 'center') c.x += dw / 2;
    else if (h === 'scale') { c.x *= sx; c.w = Math.max(1, c.w * sx); }
    if (v === 'bottom') c.y += dh;
    else if (v === 'topbottom') c.h = Math.max(1, c.h + dh);
    else if (v === 'center') c.y += dh / 2;
    else if (v === 'scale') { c.y *= sy; c.h = Math.max(1, c.h * sy); }
    c.x = round(c.x); c.y = round(c.y); c.w = round(c.w); c.h = round(c.h);
    if (c.w !== cw || c.h !== ch) {
      if (c.type === 'group') c.children.forEach((k) => scaleNode(k, c.w / cw, c.h / ch));
      else applyConstraints(c, cw, ch);
    }
  }
}

/**
 * Redimensiona respeitando "travar proporção" e as constraints dos filhos.
 * axis: 'w' | 'h' (qual campo o usuário editou).
 */
export function resizeNode(n, nw, nh, axis = 'w') {
  const ow = n.w, oh = n.h;
  if (n.lockRatio && ow && oh) {
    if (axis === 'w') nh = (nw * oh) / ow;
    else nw = (nh * ow) / oh;
  }
  n.w = Math.max(1, round(nw));
  n.h = Math.max(1, round(nh));
  if (axis === 'w' || n.lockRatio) n.sizeX = 'fixed';
  if (axis === 'h' || n.lockRatio) n.sizeY = 'fixed';
  if (n.type === 'group') n.children.forEach((k) => scaleNode(k, n.w / ow, n.h / oh));
  else applyConstraints(n, ow, oh);
}

/** Escala recursivamente um nó (usado ao redimensionar grupos/multiseleção). */
export function scaleNode(node, sx, sy) {
  node.x = round(node.x * sx);
  node.y = round(node.y * sy);
  node.w = Math.max(1, round(node.w * sx));
  node.h = Math.max(1, round(node.h * sy));
  if (node.type === 'text') {
    node.sizeX = 'fixed';
  }
  if (node.type === 'group') {
    node.children.forEach((c) => scaleNode(c, sx, sy));
  }
}

export const slugify = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
