/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  svgimport.js — IMPORTA SVG COMO VETORES EDITÁVEIS
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Transforma um arquivo/texto SVG em camadas do editor (vetores 'path', textos e grupos), em vez de uma imagem
 *  "chapada". Usado ao arrastar/abrir um .svg, ao colar SVG copiado (Figma, Illustrator, sites de ícones) e pelo
 *  painel de ícones do Google.
 *
 *  Como funciona:
 *   1. o navegador lê o XML (DOMParser);
 *   2. percorremos os elementos acumulando a TRANSFORMAÇÃO (matrix/translate/scale/rotate/skew, e o viewBox) e o
 *      ESTILO herdado (atributos, style="", e regras simples de <style> por classe/tag/id);
 *   3. cada forma vira contornos de Bézier cúbica — o mesmo formato da caneta (pontos com alças hin/hout):
 *      rect/circle/ellipse/line/polyline/polygon/path (M L H V C S Q T A Z, absolutos e relativos);
 *      arcos (A) e curvas quadráticas (Q/T) são convertidos em cúbicas;
 *   4. cada forma vira UM vetor (com todos os seus contornos, para furos funcionarem: ver css.js → nodePathData).
 *
 *  SOMBRAS: filtros de sombra no formato que o Figma exporta (feOffset + feGaussianBlur + feColorMatrix + feBlend,
 *  inclusive várias sombras) e <feDropShadow> viram sombras de verdade do editor. Fontes com nome "técnico"
 *  (PostScript, como o Illustrator exporta: "Poppins-Bold", "ArialMT") viram família + peso + itálico.
 *
 *  O que NÃO é importado (contamos e avisamos): máscaras de luminância, imagens embutidas, texto em curva,
 *  <use> para fora do arquivo, animações e filtros que não sejam sombra. ClipPaths geométricos simples (path, rect,
 *  circle, ellipse, polygon) viram máscaras editáveis do modelo. Gradientes viram gradiente linear/radial aproximado.
 *
 *  As funções de geometria (parsePathD, applyMatrix, parseTransform...) são PURAS e têm testes em tests/.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { createNode, defaultFill, defaultStroke } from './model.js';
import { GOOGLE, SYSTEM_FONTS } from './fonts.js';

// ---------------------------------------------------------------- matrizes 2D
// Matriz afim [a, b, c, d, e, f] = | a c e |   (mesma ordem do SVG/canvas)
//                                  | b d f |
const IDENTITY = [1, 0, 0, 1, 0, 0];
/** m1 × m2 (aplica m2 primeiro, depois m1). */
export const multiply = (m1, m2) => [
  m1[0] * m2[0] + m1[2] * m2[1], m1[1] * m2[0] + m1[3] * m2[1],
  m1[0] * m2[2] + m1[2] * m2[3], m1[1] * m2[2] + m1[3] * m2[3],
  m1[0] * m2[4] + m1[2] * m2[5] + m1[4], m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
];
/** Aplica a matriz a um ponto. */
const apply = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
/** Quanto a matriz "estica" em média (para escalar a espessura do traço). */
const scaleOf = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;

/**
 * Lê o atributo transform="..." (pode ter várias funções em sequência) e devolve a matriz.
 * @param {string} text  ex.: "translate(10 20) rotate(45) scale(2)"
 */
export function parseTransform(text) {
  let m = IDENTITY;
  if (!text) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let r;
  while ((r = re.exec(text))) {
    const v = r[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let t = IDENTITY;
    if (r[1] === 'matrix' && v.length === 6) t = v;
    else if (r[1] === 'translate') t = [1, 0, 0, 1, v[0] || 0, v[1] || 0];
    else if (r[1] === 'scale') t = [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0];
    else if (r[1] === 'rotate') {
      const a = ((v[0] || 0) * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
      t = [cos, sin, -sin, cos, 0, 0];
      if (v.length === 3) t = multiply(multiply([1, 0, 0, 1, v[1], v[2]], t), [1, 0, 0, 1, -v[1], -v[2]]);
    } else if (r[1] === 'skewX') t = [1, 0, Math.tan(((v[0] || 0) * Math.PI) / 180), 1, 0, 0];
    else if (r[1] === 'skewY') t = [1, Math.tan(((v[0] || 0) * Math.PI) / 180), 0, 1, 0, 0];
    m = multiply(m, t);
  }
  return m;
}

// ---------------------------------------------------------------- caminhos
/**
 * Lê o `d` de um <path> e devolve contornos no formato do editor:
 *   [{ points: [{ x, y, hin, hout }], closed }]
 * Cada segmento curvo vira alças nos pontos das pontas (hout de quem sai, hin de quem chega).
 * @param {string} d
 */
export function parsePathD(d) {
  const tokens = String(d || '').match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  const contours = [];
  let cur = null; // contorno atual
  let x = 0, y = 0, sx = 0, sy = 0; // ponto atual e início do subcaminho
  let lastC = null, lastQ = null; // último controle (para S e T, que "espelham" o anterior)
  let i = 0, cmd = '';
  const num = () => Number(tokens[i++]);
  const start = (nx, ny) => { cur = { points: [{ x: nx, y: ny, hin: null, hout: null }], closed: false }; contours.push(cur); x = sx = nx; y = sy = ny; };
  const lineTo = (nx, ny) => { if (!cur) start(x, y); cur.points.push({ x: nx, y: ny, hin: null, hout: null }); x = nx; y = ny; };
  const cubicTo = (c1x, c1y, c2x, c2y, nx, ny) => {
    if (!cur) start(x, y);
    cur.points[cur.points.length - 1].hout = { x: c1x, y: c1y };
    cur.points.push({ x: nx, y: ny, hin: { x: c2x, y: c2y }, hout: null });
    x = nx; y = ny;
  };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) { i++; continue; }
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'M': {
        start(num() + ox, num() + oy);
        cmd = rel ? 'l' : 'L'; // pares seguintes depois de M são "lineto"
        lastC = lastQ = null;
        break;
      }
      case 'L': lineTo(num() + ox, num() + oy); lastC = lastQ = null; break;
      case 'H': lineTo(num() + ox, y); lastC = lastQ = null; break;
      case 'V': lineTo(x, num() + oy); lastC = lastQ = null; break;
      case 'C': {
        const c1x = num() + ox, c1y = num() + oy, c2x = num() + ox, c2y = num() + oy, nx = num() + ox, ny = num() + oy;
        cubicTo(c1x, c1y, c2x, c2y, nx, ny);
        lastC = { x: c2x, y: c2y }; lastQ = null;
        break;
      }
      case 'S': {
        const c1x = lastC ? 2 * x - lastC.x : x, c1y = lastC ? 2 * y - lastC.y : y;
        const c2x = num() + ox, c2y = num() + oy, nx = num() + ox, ny = num() + oy;
        cubicTo(c1x, c1y, c2x, c2y, nx, ny);
        lastC = { x: c2x, y: c2y }; lastQ = null;
        break;
      }
      case 'Q': case 'T': {
        let qx, qy;
        if (cmd.toUpperCase() === 'Q') { qx = num() + ox; qy = num() + oy; } else { qx = lastQ ? 2 * x - lastQ.x : x; qy = lastQ ? 2 * y - lastQ.y : y; }
        const nx = num() + ox, ny = num() + oy;
        // quadrática → cúbica: controles a 2/3 do caminho até o controle quadrático
        cubicTo(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), nx + (2 / 3) * (qx - nx), ny + (2 / 3) * (qy - ny), nx, ny);
        lastQ = { x: qx, y: qy }; lastC = null;
        break;
      }
      case 'A': {
        const rx = num(), ry = num(), rot = num(), large = num(), sweep = num(), nx = num() + ox, ny = num() + oy;
        const segs = arcToCubics(x, y, rx, ry, rot, large, sweep, nx, ny);
        if (segs.length) for (const seg of segs) cubicTo(...seg);
        else lineTo(nx, ny); // raio zero = linha reta (regra do SVG)
        lastC = lastQ = null;
        break;
      }
      case 'Z': {
        if (cur) {
          cur.closed = true;
          // se o último ponto coincide com o primeiro, junta os dois (senão ficaria um ponto duplicado)
          const pts = cur.points, last = pts[pts.length - 1];
          if (pts.length > 1 && Math.abs(last.x - pts[0].x) < 1e-6 && Math.abs(last.y - pts[0].y) < 1e-6) {
            pts[0].hin = last.hin;
            pts.pop();
          }
        }
        x = sx; y = sy; cur = null; lastC = lastQ = null;
        break;
      }
      default: i++;
    }
    // números a mais repetem o comando anterior (ex.: "L 1 2 3 4" = duas linhas); Z não leva números
    if (cmd.toUpperCase() === 'Z') cmd = '';
  }
  return contours.filter((c) => c.points.length > 0);
}

/**
 * Arco elíptico do SVG (comando A) → lista de curvas cúbicas [c1x, c1y, c2x, c2y, x, y], cada uma com até 90°.
 * Conversão "ponta → centro" da especificação SVG (apêndice F.6) e aproximação clássica de arco por Bézier.
 */
export function arcToCubics(x1, y1, rx, ry, angle, largeArc, sweep, x2, y2) {
  if ((x1 === x2 && y1 === y2) || !rx || !ry) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (angle * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  // raio pequeno demais para alcançar o ponto final: aumenta proporcionalmente (regra do SVG)
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const sign = largeArc === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const coef = sign * Math.sqrt(Math.max(0, num / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
  const cxp = (coef * rx * y1p) / ry, cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  // ângulo (com sinal) entre dois vetores
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  let t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
  const step = dt / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const out = [];
  const pt = (t) => ({ x: cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, y: cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos });
  const der = (t) => ({ x: -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, y: -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos });
  for (let s = 0; s < n; s++) {
    const a = t1 + s * step, b = a + step;
    const p0 = pt(a), p3 = s === n - 1 ? { x: x2, y: y2 } : pt(b), d0 = der(a), d3 = der(b);
    out.push([p0.x + k * d0.x, p0.y + k * d0.y, p3.x - k * d3.x, p3.y - k * d3.y, p3.x, p3.y]);
  }
  return out;
}

/** Aplica uma matriz a todos os pontos e alças de uma lista de contornos (Bézier é preservada por transformações afins). */
export function transformContours(contours, m) {
  const t = (p) => (p ? apply(m, p.x, p.y) : null);
  return contours.map((c) => ({ closed: c.closed, points: c.points.map((p) => ({ ...apply(m, p.x, p.y), hin: t(p.hin), hout: t(p.hout) })) }));
}

/** Contornos de formas básicas (já no formato do editor). k = constante para aproximar ¼ de círculo por Bézier. */
const K = 0.5522847498;
function ellipseContour(cx, cy, rx, ry) {
  const p = (x, y, hin, hout) => ({ x, y, hin, hout });
  return [{ closed: true, points: [
    p(cx + rx, cy, { x: cx + rx, y: cy - K * ry }, { x: cx + rx, y: cy + K * ry }),
    p(cx, cy + ry, { x: cx + K * rx, y: cy + ry }, { x: cx - K * rx, y: cy + ry }),
    p(cx - rx, cy, { x: cx - rx, y: cy + K * ry }, { x: cx - rx, y: cy - K * ry }),
    p(cx, cy - ry, { x: cx - K * rx, y: cy - ry }, { x: cx + K * rx, y: cy - ry }),
  ] }];
}
function rectContour(x, y, w, h, rx, ry) {
  rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
  if (!rx || !ry) return [{ closed: true, points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => ({ x: px, y: py, hin: null, hout: null })) }];
  return parsePathD(`M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`);
}
const polyContour = (text, closed) => {
  const v = String(text || '').trim().split(/[\s,]+/).map(Number);
  const points = [];
  for (let i = 0; i + 1 < v.length; i += 2) points.push({ x: v[i], y: v[i + 1], hin: null, hout: null });
  return points.length ? [{ closed, points }] : [];
};

/** Limites (aproximados pelas curvas) de vários contornos. */
export function contoursBounds(contours) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (p) => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); };
  const cub = (a, b, c, d, t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
  for (const c of contours) {
    const pts = c.points, n = pts.length;
    pts.forEach(add);
    const segs = c.closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      if (!a.hout && !b.hin) continue;
      const c1 = a.hout || a, c2 = b.hin || b;
      for (let t = 0.1; t < 1; t += 0.1) add({ x: cub(a.x, c1.x, c2.x, b.x, t), y: cub(a.y, c1.y, c2.y, b.y, t) });
    }
  }
  return { x0, y0, x1, y1 };
}

// ---------------------------------------------------------------- estilos e cores
/** Contexto 2D reaproveitado por parseColor para traduzir nomes de cor (criado só na primeira vez). */
let colorCtx = null;
/** Converte qualquer cor CSS ("red", "rgb(...)", "#abc") em { color: '#RRGGBB', alpha }. Usa o canvas do navegador. */
export function parseColor(value) {
  const v = String(value || '').trim();
  let m = v.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    return { color: '#' + h.slice(0, 6).toUpperCase(), alpha: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 };
  }
  m = v.match(/^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:[\s,/]+([\d.]+%?))?\s*\)$/i);
  if (m) {
    const ch = (s) => Math.round(s.endsWith('%') ? (parseFloat(s) * 255) / 100 : parseFloat(s));
    const hex = [m[1], m[2], m[3]].map((s) => Math.max(0, Math.min(255, ch(s))).toString(16).padStart(2, '0')).join('');
    const a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { color: '#' + hex.toUpperCase(), alpha: a };
  }
  // nomes de cor ("red", "teal"...): o canvas do navegador sabe converter
  if (globalThis.document) {
    colorCtx ||= document.createElement('canvas').getContext('2d');
    colorCtx.fillStyle = '#000000';
    colorCtx.fillStyle = v;
    const out = colorCtx.fillStyle;
    if (out.startsWith('#')) return { color: out.toUpperCase(), alpha: 1 };
    if (out.startsWith('rgba')) return parseColor(out);
  }
  return null;
}

/** Propriedades de estilo que nos interessam (e que são herdadas pelos filhos no SVG). */
const STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'fill-opacity', 'stroke-opacity', 'opacity', 'fill-rule', 'display',
  'visibility', 'stroke-dasharray', 'marker-start', 'marker-end', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-anchor', 'color'];
/** `opacity` e `display` não são herdados (cada elemento tem o seu); o resto é. */
const NOT_INHERITED = new Set(['opacity', 'display', 'marker-start', 'marker-end']);

/** Lê as regras de <style> mais simples (".classe", "tag", "#id" e listas separadas por vírgula). */
function parseStyleSheets(doc) {
  const rules = [];
  for (const el of doc.querySelectorAll('style')) {
    const css = el.textContent.replace(/\/\*[\s\S]*?\*\//g, '');
    const re = /([^{}]+)\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
      const decl = parseDecl(m[2]);
      for (const sel of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
        if (/^[.#]?[\w-]+$/.test(sel)) rules.push({ sel, decl });
      }
    }
  }
  return rules;
}
/** "fill:red; stroke: blue" → { fill: 'red', stroke: 'blue' } */
function parseDecl(text) {
  const out = {};
  for (const part of String(text || '').split(';')) {
    const i = part.indexOf(':');
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
}

// ---------------------------------------------------------------- fontes com nome técnico
/** Sufixos de estilo nos nomes PostScript → peso. */
const PS_WEIGHTS = { thin: 100, hairline: 100, extralight: 200, ultralight: 200, light: 300, regular: 400, book: 400, normal: 400,
  medium: 500, semibold: 600, demibold: 600, bold: 700, extrabold: 800, ultrabold: 800, black: 900, heavy: 900 };
// nome "compacto" (sem espaços, minúsculo) → nome de verdade, para achar "OpenSans" como "Open Sans"
let compactFonts = null;
/**
 * Converte o nome de fonte que veio no SVG em { family, weight?, italic? }.
 *   "'Poppins-Bold'" → Poppins 700 · "OpenSans-SemiBoldItalic" → Open Sans 600 itálico · "ArialMT" → Arial
 * Nomes que já são famílias conhecidas passam direto. Desconhecidos ficam como vieram.
 * @param {string} raw  valor de font-family (pode ter lista com vírgulas e aspas)
 */
export function resolveFontName(raw) {
  const name = String(raw || '').split(',')[0].replace(/['"]/g, '').trim();
  if (!name) return { family: 'Inter' };
  if (GOOGLE.has(name) || SYSTEM_FONTS.includes(name)) return { family: name };
  compactFonts ||= new Map([...GOOGLE.keys(), ...SYSTEM_FONTS].map((f) => [f.replace(/\s+/g, '').toLowerCase(), f]));
  const [base, style = ''] = name.split('-');
  const key = base.replace(/(PSMT|MT|PS)$/, '').replace(/\s+/g, '').toLowerCase();
  const family = compactFonts.get(key) || compactFonts.get(name.replace(/\s+/g, '').toLowerCase());
  if (!family) return { family: name };
  const st = style.toLowerCase();
  const italic = /italic|oblique|it$/.test(st);
  const w = PS_WEIGHTS[st.replace(/italic|oblique|it$/g, '') || 'regular'];
  return { family, ...(w ? { weight: w } : {}), ...(italic ? { italic: true } : {}) };
}

// ---------------------------------------------------------------- importador
/**
 * Converte um SVG (texto) em UMA camada do editor (vetor, ou grupo de vetores), posicionada em (0,0).
 * @param {string} text   conteúdo do arquivo .svg
 * @param {object} [opts]
 * @param {string} [opts.name]         nome da camada (padrão: <title> do SVG ou "SVG importado")
 * @param {string} [opts.currentColor] cor usada onde o SVG diz "currentColor" (ícones usam muito)
 * @param {string} [opts.fill]         cor para formas SEM preenchimento declarado (o padrão do SVG é preto). Os ícones
 *        do Google não declaram cor nenhuma: o painel de ícones passa aqui a cor escolhida.
 * @param {number} [opts.size]         redimensiona para caber neste tamanho (o maior lado)
 * @returns {{ node: object, skipped: number, ignored: string[] }}  node = camada pronta para inserir; skipped = quantos
 *          detalhes foram ignorados; ignored = O QUE foi ignorado, em português (ex.: ['sombra interna', 'máscara'])
 */
export function importSvg(text, { name, currentColor = '#111111', fill, size } = {}) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error('Isso não parece um arquivo SVG válido.');
  const rules = parseStyleSheets(doc);
  // gradientes e elementos com id (para <use> e url(#...))
  const byId = new Map([...doc.querySelectorAll('[id]')].map((el) => [el.getAttribute('id'), el]));
  let skipped = 0;
  const ignored = new Set();
  /** Registra algo do SVG que não deu para importar (o aviso ao usuário diz o quê). */
  const skip = (what) => { skipped++; ignored.add(what); };
  /** Nome legível de um elemento não suportado. */
  const whatTag = (tag) => ({ image: 'imagem', foreignObject: 'conteúdo HTML' })[tag] || (/^(animate|set)/.test(tag) ? 'animação' : `<${tag}>`);

  // tamanho e viewBox do SVG raiz: o viewBox vira escala + deslocamento
  const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const hasVb = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0;
  const len = (v, fallback) => { const n = parseFloat(v); return Number.isFinite(n) && !/%$/.test(String(v)) ? n : fallback; };
  const W = len(svg.getAttribute('width'), hasVb ? vb[2] : 100);
  const H = len(svg.getAttribute('height'), hasVb ? vb[3] : 100);
  let root = IDENTITY;
  if (hasVb) {
    const s = Math.min(W / vb[2], H / vb[3]); // preserveAspectRatio padrão (xMidYMid meet)
    root = [s, 0, 0, s, (W - vb[2] * s) / 2 - vb[0] * s, (H - vb[3] * s) / 2 - vb[1] * s];
  }
  if (size) { const s = size / Math.max(W, H); root = multiply([s, 0, 0, s, 0, 0], root); }

  /** Estilo calculado de um elemento: herdado do pai + regras de <style> + atributos + style="" (nessa ordem de força). */
  function styleOf(el, parent) {
    const st = {};
    for (const k of STYLE_PROPS) if (!NOT_INHERITED.has(k) && parent[k] != null) st[k] = parent[k];
    const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    for (const r of rules) {
      const ok = r.sel.startsWith('.') ? cls.includes(r.sel.slice(1)) : r.sel.startsWith('#') ? el.getAttribute('id') === r.sel.slice(1) : el.nodeName === r.sel;
      if (ok) Object.assign(st, r.decl);
    }
    for (const k of STYLE_PROPS) { const v = el.getAttribute(k); if (v != null) st[k] = v; }
    Object.assign(st, parseDecl(el.getAttribute('style')));
    return st;
  }

  /** Lê o subconjunto geométrico seguro de um <pattern>; não executa nem preserva markup arbitrário. */
  function patternOf(el, opacity) {
    if (!el || el.nodeName !== 'pattern') return null;
    const n = (key, fallback) => { const value = parseFloat(el.getAttribute(key)); return Number.isFinite(value) ? value : fallback; };
    const w = n('width', 0), h = n('height', 0);
    if (!(w > 0 && h > 0)) return null;
    const cells = [];
    for (const child of el.children) {
      const tag = child.nodeName;
      const fill = parseColor(child.getAttribute('fill') || '#000000');
      if (!fill || child.getAttribute('stroke') && child.getAttribute('stroke') !== 'none') continue;
      const a = (key, fallback = 0) => {
        const value = parseFloat(child.getAttribute(key));
        return Number.isFinite(value) ? value : fallback;
      };
      if (tag === 'rect' && a('width') > 0 && a('height') > 0) cells.push({ tag, x: a('x'), y: a('y'), w: a('width'), h: a('height'), rx: a('rx'), ry: a('ry'), color: fill.color, opacity: round(fill.alpha * opacity) });
      else if (tag === 'circle' && a('r') > 0) cells.push({ tag, cx: a('cx'), cy: a('cy'), r: a('r'), color: fill.color, opacity: round(fill.alpha * opacity) });
      else if (tag === 'ellipse' && a('rx') > 0 && a('ry') > 0) cells.push({ tag, cx: a('cx'), cy: a('cy'), rx: a('rx'), ry: a('ry'), color: fill.color, opacity: round(fill.alpha * opacity) });
      else if (tag === 'polygon' || tag === 'polyline') {
        const points = String(child.getAttribute('points') || '').trim();
        if (points) cells.push({ tag, points, color: fill.color, opacity: round(fill.alpha * opacity) });
      }
    }
    return cells.length ? { width: w, height: h, cells } : null;
  }

  /** Preenchimento do editor a partir de "fill" (cor, none, currentColor, url(#gradiente/padrão)). */
  function fillOf(value, opacity, st) {
    if (value == null) value = '#000000'; // padrão do SVG: preto
    value = String(value).trim();
    if (value === 'none' || value === 'transparent') return { ...defaultFill(), type: 'none' };
    if (value === 'currentColor') value = st.color && st.color !== 'currentColor' ? st.color : currentColor;
    const url = value.match(/url\(\s*['"]?#([^'")]+)['"]?\s*\)/);
    if (url) {
      const g = gradientOf(byId.get(url[1]), opacity);
      if (g) return g;
      const pattern = patternOf(byId.get(url[1]), opacity);
      if (pattern) return { ...defaultFill(), type: 'pattern', pattern };
      skip('preenchimento com padrão');
      return { ...defaultFill(), type: 'solid', color: '#C4C4C4', opacity };
    }
    const c = parseColor(value);
    if (!c) return { ...defaultFill(), type: 'solid', color: '#000000', opacity };
    return { ...defaultFill(), type: 'solid', color: c.color, opacity: round(c.alpha * opacity) };
  }
  /** <linearGradient>/<radialGradient> → gradiente do editor (direção aproximada; segue href="#outro" para pegar os stops). */
  function gradientOf(el, opacity) {
    if (!el || !/Gradient$/.test(el.nodeName)) return null;
    let src = el;
    for (let k = 0; k < 5 && !src.querySelector('stop'); k++) {
      const ref = (src.getAttribute('href') || src.getAttribute('xlink:href') || '').replace(/^#/, '');
      if (!byId.get(ref)) break;
      src = byId.get(ref);
    }
    const stops = [...src.querySelectorAll('stop')].map((s) => {
      const ss = { ...Object.fromEntries(['stop-color', 'stop-opacity', 'offset'].map((k) => [k, s.getAttribute(k)])), ...parseDecl(s.getAttribute('style')) };
      const c = parseColor(ss['stop-color'] || '#000') || { color: '#000000', alpha: 1 };
      const off = String(ss.offset || '0');
      return { pos: round(off.endsWith('%') ? parseFloat(off) : parseFloat(off) * 100), color: c.color, opacity: round(c.alpha * (ss['stop-opacity'] != null ? parseFloat(ss['stop-opacity']) : 1) * opacity) };
    });
    if (!stops.length) return null;
    if (stops.length === 1) return { ...defaultFill(), type: 'solid', color: stops[0].color, opacity: stops[0].opacity };
    if (el.nodeName === 'radialGradient') return { ...defaultFill(), type: 'radial', stops };
    const g = (k, d) => { const v = el.getAttribute(k); return v == null ? d : String(v).endsWith('%') ? parseFloat(v) / 100 : parseFloat(v); };
    const dx = g('x2', 1) - g('x1', 0), dy = g('y2', 0) - g('y1', 0);
    const angle = Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360); // 0° = para cima (CSS)
    return { ...defaultFill(), type: 'linear', angle, stops };
  }

  /** Geometria básica de um filho de clipPath; o modelo suporta uma máscara vetorial por grupo. */
  function clipContours(el) {
    if (!el) return null;
    const tag = el.nodeName;
    const n = (key) => { const v = parseFloat(el.getAttribute(key)); return Number.isFinite(v) ? v : 0; };
    if (tag === 'path') return parsePathD(el.getAttribute('d'));
    if (tag === 'rect' && n('width') > 0 && n('height') > 0) {
      const rx = el.hasAttribute('rx') ? n('rx') : n('ry');
      const ry = el.hasAttribute('ry') ? n('ry') : rx;
      return rectContour(n('x'), n('y'), n('width'), n('height'), rx, ry);
    }
    if (tag === 'circle' && n('r') > 0) return ellipseContour(n('cx'), n('cy'), n('r'), n('r'));
    if (tag === 'ellipse' && n('rx') > 0 && n('ry') > 0) return ellipseContour(n('cx'), n('cy'), n('rx'), n('ry'));
    if (tag === 'polygon' || tag === 'polyline') return polyContour(el.getAttribute('points'), tag === 'polygon');
    return null;
  }

  /** Converte um limite vetorial simples (clipPath ou mask) em uma máscara editável do modelo. */
  function withVectorBoundary(node, el, m, attribute, kind) {
    const attr = el.getAttribute(attribute) || '';
    if (!attr) return node;
    const id = (attr.match(/url\(\s*['"]?#([^'")]+)/) || [])[1];
    const boundary = id && byId.get(id);
    if (!boundary) { skip(kind); return node; }
    if (kind === 'clipping path' && (boundary.getAttribute('clipPathUnits') || 'userSpaceOnUse') !== 'userSpaceOnUse') { skip('clipping path em objectBoundingBox'); return node; }
    const source = [...boundary.children].find((child) => clipContours(child));
    const contours = clipContours(source);
    if (!contours?.length) { skip(`${kind} complexo`); return node; }
    if (kind === 'máscara') {
      const fill = parseColor(source.getAttribute('fill') || '#000000');
      const opacity = parseFloat(source.getAttribute('opacity') || source.getAttribute('fill-opacity') || '1');
      // Máscara SVG usa luminância: só tratamos uma geometria branca/opaca como recorte seguro.
      if (!fill || fill.color.toUpperCase() !== '#FFFFFF' || fill.alpha * opacity <= 0) { skip('máscara não vetorial simples'); return node; }
    }
    const transformed = transformContours(contours, multiply(m, parseTransform(source.getAttribute('transform'))));
    const b = contoursBounds(transformed);
    if (!Number.isFinite(b.x0) || b.x1 <= b.x0 || b.y1 <= b.y0) { skip(`${kind} vazio`); return node; }
    const shift = (p) => (p ? { x: round(p.x - b.x0), y: round(p.y - b.y0) } : null);
    const local = transformed.map((c) => ({ closed: c.closed, points: c.points.map((p) => ({ ...shift(p), hin: shift(p.hin), hout: shift(p.hout) })) }));
    const mask = createNode('path', { name: kind === 'máscara' ? 'Máscara vetorial' : 'Máscara de recorte', x: round(b.x0), y: round(b.y0), w: round(b.x1 - b.x0), h: round(b.y1 - b.y0), isMask: true, fill: { ...defaultFill('#000000'), type: 'solid' }, stroke: null });
    mask.points = local[0].points; mask.closed = local[0].closed; mask.vw = mask.w; mask.vh = mask.h;
    if (local.length > 1) mask.contours = local.slice(1);
    if (source.getAttribute('clip-rule') === 'evenodd' || el.getAttribute('clip-rule') === 'evenodd') mask.fillRule = 'evenodd';
    const gx = Math.min(node.x, mask.x), gy = Math.min(node.y, mask.y);
    node.x = round(node.x - gx); node.y = round(node.y - gy);
    mask.x = round(mask.x - gx); mask.y = round(mask.y - gy);
    const group = createNode('group', { name: node.name, x: round(gx), y: round(gy) });
    group.children = [mask, node];
    group.w = round(Math.max(mask.x + mask.w, node.x + node.w));
    group.h = round(Math.max(mask.y + mask.h, node.y + node.h));
    return group;
  }

  function withClip(node, el, m) { return withVectorBoundary(node, el, m, 'clip-path', 'clipping path'); }
  function withMask(node, el, m) { return withVectorBoundary(node, el, m, 'mask', 'máscara'); }

  /** Aplica um clipPath declarado no grupo aos nós emitidos por seus filhos (padrão comum do Figma). */
  function withClipChildren(nodes, el, m) {
    if (!el.getAttribute('clip-path') || !nodes.length) return nodes;
    const x = Math.min(...nodes.map((n) => n.x)), y = Math.min(...nodes.map((n) => n.y));
    const group = createNode('group', { name: el.getAttribute('id') || 'Grupo recortado', x: round(x), y: round(y) });
    group.children = nodes;
    for (const child of nodes) { child.x = round(child.x - x); child.y = round(child.y - y); }
    group.w = round(Math.max(...nodes.map((n) => n.x + n.w)));
    group.h = round(Math.max(...nodes.map((n) => n.y + n.h)));
    return [withClip(group, el, m)];
  }

  function withMaskChildren(nodes, el, m) {
    if (!el.getAttribute('mask') || !nodes.length) return nodes;
    const x = Math.min(...nodes.map((n) => n.x)), y = Math.min(...nodes.map((n) => n.y));
    const group = createNode('group', { name: el.getAttribute('id') || 'Grupo mascarado', x: round(x), y: round(y) });
    group.children = nodes;
    for (const child of nodes) { child.x = round(child.x - x); child.y = round(child.y - y); }
    group.w = round(Math.max(...nodes.map((n) => n.x + n.w)));
    group.h = round(Math.max(...nodes.map((n) => n.y + n.h)));
    return [withMask(group, el, m)];
  }

  const out = []; // camadas geradas (em coordenadas finais)
  // Evita que um SVG malformado com <use href="#a"><use href="#a">...</use></use>
  // trave o editor durante a importação.
  const useStack = new Set();

  /**
   * Lê um <filter> e devolve as SOMBRAS que ele descreve (ou null se for outro tipo de filtro).
   * Formato do Figma: para cada sombra, feOffset (dx, dy) → feGaussianBlur (desfoque = 2 × stdDeviation) →
   * [feMorphology = spread] → [feComposite arithmetic = sombra interna] → feColorMatrix (cor nos valores 5, 10, 15
   * e opacidade no 19) → feBlend (fecha a sombra). Também aceita <feDropShadow>.
   */
  function shadowsOf(f) {
    if (!f || f.nodeName !== 'filter') return null;
    const shadows = [];
    let cur = {};
    for (const c of f.children) {
      const n = c.nodeName, at = (k, d = 0) => { const v = parseFloat(c.getAttribute(k)); return Number.isFinite(v) ? v : d; };
      if (n === 'feDropShadow') {
        const col = parseColor(c.getAttribute('flood-color') || '#000000') || { color: '#000000', alpha: 1 };
        shadows.push({ x: at('dx', 2), y: at('dy', 2), blur: at('stdDeviation', 2) * 2, spread: 0, color: col.color, opacity: round(col.alpha * at('flood-opacity', 1)), inset: false });
      } else if (n === 'feOffset') { cur.x = at('dx'); cur.y = at('dy'); }
      else if (n === 'feGaussianBlur') cur.blur = at('stdDeviation') * 2;
      else if (n === 'feMorphology') cur.spread = (c.getAttribute('operator') === 'erode' ? -1 : 1) * at('radius');
      else if (n === 'feComposite' && c.getAttribute('operator') === 'arithmetic') cur.inset = true;
      else if (n === 'feColorMatrix' && c.getAttribute('in') !== 'SourceAlpha') {
        const v = (c.getAttribute('values') || '').trim().split(/[\s,]+/).map(Number);
        if (v.length === 20) {
          const hex = [v[4], v[9], v[14]].map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('');
          cur.color = '#' + hex.toUpperCase();
          cur.opacity = round(v[18]);
        }
      } else if (n === 'feBlend' && (cur.x !== undefined || cur.color)) {
        shadows.push({ x: cur.x || 0, y: cur.y || 0, blur: round(cur.blur || 0), spread: cur.spread || 0, color: cur.color || '#000000', opacity: cur.opacity ?? 0.25, inset: !!cur.inset });
        cur = {};
      } else if (!['feFlood', 'feBlend', 'feComposite', 'feColorMatrix', 'feMerge', 'feMergeNode'].includes(n)) return null; // outro efeito
    }
    return shadows.length ? shadows : null;
  }

  /** Importa filtros de cor/blur que têm correspondência direta no modelo editável. */
  function filterEffectsOf(f) {
    if (!f || f.nodeName !== 'filter') return null;
    const fx = {};
    let blur = 0, hasOffset = false, hasDropShadow = false;
    for (const c of f.children) {
      const n = c.nodeName;
      if (n === 'feDropShadow') { hasDropShadow = true; continue; }
      if (n === 'feOffset') { hasOffset = true; continue; }
      if (n === 'feGaussianBlur') {
        const value = parseFloat(c.getAttribute('stdDeviation'));
        if (Number.isFinite(value) && !hasOffset && !hasDropShadow) blur = round(value * 2);
        continue;
      }
      if (['feFlood', 'feBlend', 'feComposite', 'feColorMatrix', 'feMerge', 'feMergeNode', 'feMorphology'].includes(n)) {
        if (n !== 'feColorMatrix') continue;
        const type = c.getAttribute('type') || 'matrix';
        const values = (c.getAttribute('values') || '').trim().split(/[\s,]+/).map(Number);
        if (type === 'saturate' && Number.isFinite(values[0])) fx.saturate = round(values[0] * 100);
        else if (type === 'hueRotate' && Number.isFinite(values[0])) fx.hue = round(values[0]);
        else if (type === 'matrix' && values.length === 20 && values.every(Number.isFinite)) {
          const diagonal = [values[0], values[6], values[12]];
          const translation = [values[4], values[9], values[14]];
          if (diagonal.every((v) => Math.abs(v - diagonal[0]) < 0.001) && translation.every((v) => Math.abs(v) < 0.001)) fx.brightness = round(diagonal[0] * 100);
          else if (diagonal.every((v) => Math.abs(v - diagonal[0]) < 0.001) && translation.every((v) => Math.abs(v - (1 - diagonal[0]) / 2) < 0.001)) fx.contrast = round(diagonal[0] * 100);
          else if (c.getAttribute('in') !== 'SourceAlpha') return null;
        }
      } else return null;
    }
    return { fx, blur };
  }

  /** Converte apenas marcadores geométricos comuns em marcadores seguros do editor. */
  function markerKind(value) {
    const id = String(value || '').match(/url\(\s*['"]?#([^'")]+)/)?.[1];
    const marker = id && byId.get(id);
    if (!marker || marker.nodeName !== 'marker') return null;
    const child = [...marker.children].find((el) => ['path', 'circle', 'rect', 'polygon'].includes(el.nodeName));
    if (!child) return null;
    if (child.nodeName === 'circle') return 'circle';
    if (child.nodeName === 'rect') return 'square';
    return 'arrow';
  }

  /** Uma forma (já em contornos no espaço do elemento) → vetor do editor. */
  function emitShape(contours, el, st, m) {
    if (!contours.length || !contours.some((c) => c.points.length > 1)) return;
    const t = transformContours(contours, m);
    const b = contoursBounds(t);
    const w = Math.max(b.x1 - b.x0, 0.01), h = Math.max(b.y1 - b.y0, 0.01);
    const shift = (p) => (p ? { x: round(p.x - b.x0), y: round(p.y - b.y0) } : null);
    const local = t.map((c) => ({ closed: c.closed, points: c.points.map((p) => ({ ...shift(p), hin: shift(p.hin), hout: shift(p.hout) })) }));
    const node = createNode('path', { name: el.getAttribute('id') || label(el.nodeName), x: round(b.x0), y: round(b.y0), w: round(w), h: round(h) });
    node.vw = round(w); node.vh = round(h);
    node.points = local[0].points;
    node.closed = local[0].closed;
    if (local.length > 1) node.contours = local.slice(1);
    if (st['fill-rule'] === 'evenodd') node.fillRule = 'evenodd';
    const fo = st['fill-opacity'] != null ? parseFloat(st['fill-opacity']) : 1;
    node.fill = fillOf(st.fill, fo, st);
    const sw = st['stroke-width'] != null ? parseFloat(st['stroke-width']) : 1;
    if (st.stroke && st.stroke !== 'none' && sw > 0) {
      const sc = parseColor(st.stroke === 'currentColor' ? currentColor : st.stroke) || { color: '#000000', alpha: 1 };
      node.stroke = { ...defaultStroke(), width: round(sw * scaleOf(m)), color: sc.color, opacity: round(sc.alpha * (st['stroke-opacity'] != null ? parseFloat(st['stroke-opacity']) : 1)), position: 'center', style: st['stroke-dasharray'] && st['stroke-dasharray'] !== 'none' ? 'dashed' : 'solid' };
      const start = markerKind(st['marker-start']), end = markerKind(st['marker-end']);
      if (start) node.stroke.markerStart = start;
      if (end) node.stroke.markerEnd = end;
    } else node.stroke = null;
    if (st.opacity != null) node.opacity = round(parseFloat(st.opacity));
    // sombras vindas de um filtro (deste elemento ou de um grupo acima). Sombra INTERNA não existe para vetores no
    // editor (o CSS drop-shadow só faz sombra externa), então ela é ignorada e contada no aviso.
    if (st._shadows) {
      const s = scaleOf(m);
      node.shadows = st._shadows.filter((sh) => !sh.inset).map((sh) => ({ ...sh, x: round(sh.x * s), y: round(sh.y * s), blur: round(sh.blur * s), spread: round(sh.spread * s) }));
      if (node.shadows.length < st._shadows.length) skip('sombra interna');
    }
    if (st._fx && Object.keys(st._fx).length) node.fx = st._fx;
    if (st._blur > 0) node.blur = st._blur;
    out.push(withMask(withClip(node, el, m), el, m));
  }

  /** <text> simples (sem texto em curva) → camada de texto do editor. */
  function emitText(el, st, m) {
    const content = el.textContent.replace(/\s+/g, ' ').trim();
    if (!content) return;
    const fs = parseFloat(st['font-size']) || 16;
    const p = apply(m, parseFloat(el.getAttribute('x')) || 0, parseFloat(el.getAttribute('y')) || 0);
    const size = round(fs * scaleOf(m));
    const node = createNode('text', { name: content.slice(0, 30), x: round(p.x), y: round(p.y - size * 0.9) });
    node.text = content;
    node.fontSize = size;
    if (st['font-family']) {
      const f = resolveFontName(st['font-family']);
      node.fontFamily = f.family;
      if (f.weight) node.fontWeight = f.weight;
      if (f.italic) node.fontStyle = 'italic';
    }
    // font-weight explícito vence o peso deduzido do nome
    if (st['font-weight']) node.fontWeight = st['font-weight'] === 'bold' ? 700 : parseInt(st['font-weight'], 10) || node.fontWeight;
    if (st['font-style'] === 'italic') node.fontStyle = 'italic';
    const c = parseColor(st.fill === 'currentColor' ? currentColor : st.fill || '#000');
    if (c) node.fill = { ...defaultFill(), type: 'solid', color: c.color, opacity: c.alpha };
    node.w = round(Math.max(20, content.length * size * 0.6));
    node.h = round(size * 1.3);
    if (st._fx && Object.keys(st._fx).length) node.fx = st._fx;
    if (st._blur > 0) node.blur = st._blur;
    out.push(node);
  }

  /** Percorre a árvore do SVG acumulando transformação e estilo. */
  function walk(el, m, parentStyle, depth = 0) {
    if (depth > 40) return;
    const tag = el.nodeName;
    if (['defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'pattern', 'symbol', 'style', 'title', 'desc', 'metadata', 'marker', 'filter'].includes(tag)) return;
    const st = styleOf(el, parentStyle);
    if (st.display === 'none' || st.visibility === 'hidden') return;
    const mm = multiply(m, parseTransform(el.getAttribute('transform')));
    const a = (k, d = 0) => { const v = parseFloat(el.getAttribute(k)); return Number.isFinite(v) ? v : d; };
    // filtro: se for sombra, vira sombra de verdade (e vale para tudo dentro do grupo); outro filtro é ignorado
    st._shadows = parentStyle._shadows;
    st._fx = parentStyle._fx;
    st._blur = parentStyle._blur || 0;
    const filter = el.getAttribute('filter') || st.filter;
    if (filter && filter !== 'none') {
      const id = (filter.match(/url\(\s*['"]?#([^'")]+)/) || [])[1];
      const filterDef = byId.get(id);
      const sh = shadowsOf(filterDef);
      const effects = filterEffectsOf(filterDef);
      if (sh) st._shadows = sh;
      if (effects) {
        st._fx = { ...(st._fx || {}), ...effects.fx };
        if (effects.blur > 0) st._blur = effects.blur;
      }
      if (!sh && !effects) skip('filtro');
    }
    switch (tag) {
      case 'svg': case 'g': case 'a': case 'switch':
        // um <svg> aninhado com x/y desloca o conteúdo
        {
          const start = out.length;
          for (const c of el.children) walk(c, tag === 'svg' && depth ? multiply(mm, [1, 0, 0, 1, a('x'), a('y')]) : mm, st, depth + 1);
          if (el.getAttribute('clip-path') && out.length > start) out.splice(start, out.length - start, ...withClipChildren(out.slice(start), el, mm));
          if (el.getAttribute('mask') && out.length > start) out.splice(start, out.length - start, ...withMaskChildren(out.slice(start), el, mm));
        }
        return;
      case 'use': {
        const href = el.getAttribute('href') || el.getAttribute('xlink:href') || '';
        const refId = href.replace(/^#/, '');
        const ref = byId.get(refId);
        if (!ref) { skip('referência a outro arquivo (<use>)'); return; }
        const holder = ref.nodeName === 'symbol' ? [...ref.children] : [ref];
        if (useStack.has(refId)) { skip('referência circular (<use>)'); return; }
        useStack.add(refId);
        let useMatrix = multiply(mm, [1, 0, 0, 1, a('x'), a('y')]);
        if (ref.nodeName === 'symbol') {
          const symbolBox = String(ref.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
          const hasSymbolBox = symbolBox.length === 4 && symbolBox.every(Number.isFinite) && symbolBox[2] > 0 && symbolBox[3] > 0;
          if (hasSymbolBox) {
            const sw = len(el.getAttribute('width'), len(ref.getAttribute('width'), symbolBox[2]));
            const sh = len(el.getAttribute('height'), len(ref.getAttribute('height'), symbolBox[3]));
            const sx = sw / symbolBox[2], sy = sh / symbolBox[3];
            const preserve = String(el.getAttribute('preserveAspectRatio') || ref.getAttribute('preserveAspectRatio') || 'xMidYMid meet').trim();
            let map;
            if (preserve.toLowerCase() === 'none') {
              map = [sx, 0, 0, sy, -symbolBox[0] * sx, -symbolBox[1] * sy];
            } else {
              const s = Math.min(sx, sy);
              const align = preserve.match(/x(Min|Mid|Max)Y(Min|Mid|Max)/i) || ['xMidYMid', 'Mid', 'Mid'];
              const ax = align[1].toLowerCase() === 'min' ? 0 : align[1].toLowerCase() === 'max' ? sw - symbolBox[2] * s : (sw - symbolBox[2] * s) / 2;
              const ay = align[2].toLowerCase() === 'min' ? 0 : align[2].toLowerCase() === 'max' ? sh - symbolBox[3] * s : (sh - symbolBox[3] * s) / 2;
              map = [s, 0, 0, s, ax - symbolBox[0] * s, ay - symbolBox[1] * s];
            }
            useMatrix = multiply(useMatrix, map);
          }
        }
        for (const c of holder) walk(c, useMatrix, st, depth + 1);
        useStack.delete(refId);
        return;
      }
      case 'path': emitShape(parsePathD(el.getAttribute('d')), el, st, mm); return;
      case 'rect': {
        const rx = el.hasAttribute('rx') ? a('rx') : a('ry'), ry = el.hasAttribute('ry') ? a('ry') : rx;
        if (a('width') > 0 && a('height') > 0) emitShape(rectContour(a('x'), a('y'), a('width'), a('height'), rx, ry), el, st, mm);
        return;
      }
      case 'circle': if (a('r') > 0) emitShape(ellipseContour(a('cx'), a('cy'), a('r'), a('r')), el, st, mm); return;
      case 'ellipse': if (a('rx') > 0 && a('ry') > 0) emitShape(ellipseContour(a('cx'), a('cy'), a('rx'), a('ry')), el, st, mm); return;
      case 'line': emitShape([{ closed: false, points: [{ x: a('x1'), y: a('y1'), hin: null, hout: null }, { x: a('x2'), y: a('y2'), hin: null, hout: null }] }], el, { ...st, fill: 'none' }, mm); return;
      case 'polyline': emitShape(polyContour(el.getAttribute('points'), false), el, st, mm); return;
      case 'polygon': emitShape(polyContour(el.getAttribute('points'), true), el, st, mm); return;
      case 'text': if (el.querySelector('textPath')) skip('texto em curva'); else emitText(el, st, mm); return;
      default: skip(whatTag(tag)); // image, foreignObject, animate...
    }
  }
  walk(svg, root, fill ? { color: currentColor, fill } : { color: currentColor });
  if (!out.length) throw new Error('Não encontrei formas desenháveis neste SVG.');

  const title = name || doc.querySelector('title')?.textContent?.trim() || 'SVG importado';
  // uma forma só → o próprio vetor; várias → um grupo, com os filhos relativos ao canto do grupo
  if (out.length === 1) {
    out[0].name = title;
    return { node: out[0], skipped, ignored: [...ignored] };
  }
  const x0 = Math.min(...out.map((n) => n.x)), y0 = Math.min(...out.map((n) => n.y));
  for (const n of out) { n.x = round(n.x - x0); n.y = round(n.y - y0); }
  const group = createNode('group', { name: title, x: round(x0), y: round(y0) });
  group.children = out;
  group.w = round(Math.max(...out.map((n) => n.x + n.w)));
  group.h = round(Math.max(...out.map((n) => n.y + n.h)));
  return { node: group, skipped, ignored: [...ignored] };
}

/** Nome legível do tipo de elemento. */
const label = (tag) => ({ path: 'Vetor', rect: 'Retângulo', circle: 'Círculo', ellipse: 'Elipse', line: 'Linha', polyline: 'Linha', polygon: 'Polígono' })[tag] || 'Vetor';
/** Arredonda para 2 casas (coordenadas e tamanhos). */
function round(v) { return Math.round(v * 100) / 100; }
