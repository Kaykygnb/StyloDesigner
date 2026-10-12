/** Validação e aplicação das propriedades aceitas em uma camada. */
import { defaultFill, defaultStroke, resizeNode, tagOf, TEXT_TAGS, BOX_TAGS } from '../../model.js';
import type { PropertyContext, ToolArgs } from './types.ts';
/** Campos simples (número, texto ou booleano) que podem ser copiados direto para a camada. */
const SIMPLE = [
  'name', 'x', 'y', 'rotation', 'opacity', 'visible', 'locked', 'blend', 'note', 'sizeX', 'sizeY', 'minW', 'maxW', 'minH',
  'maxH', 'aspect', 'blur', 'bgBlur', 'clip', 'absolute', 'alignSelf', 'justifySelf', 'grow', 'colSpan', 'rowSpan', 'overflow',
  'href', 'alt', 'fluid', 'sticky', 'pointerEvents', 'cursor',
  'text', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing', 'textAlign',
  'textDecoration', 'textTransform', 'textVAlign', 'truncate', 'lines',
  'mediaAutoplay', 'mediaControls', 'mediaLoop', 'mediaMuted',
  'flipX', 'flipY', 'lockRatio', 'skewX', 'skewY', 'order', 'shrink', 'whiteSpace', 'wordBreak', 'textWrap',
  'html', 'htmlId', 'classes', 'title', 'role', 'target', 'rel', 'buttonType', 'dateTime', 'cite', 'lang',
];
/** Tipos esperados de alguns campos (o resto é conferido pelo uso). */
const BOOLEANS = ['flipX', 'flipY', 'lockRatio', 'shrink'];
const NUMBERS = ['skewX', 'skewY', 'order'];
const STRINGS = ['html', 'htmlId', 'classes', 'title', 'role', 'target', 'rel', 'buttonType', 'dateTime', 'cite', 'lang', 'whiteSpace', 'wordBreak', 'textWrap'];
const CONSTRAINT_H = ['left', 'right', 'leftright', 'center', 'scale'];
const CONSTRAINT_V = ['top', 'bottom', 'topbottom', 'center', 'scale'];
const FX_KEYS = ['brightness', 'contrast', 'saturate', 'grayscale', 'hue'];
const MEDIA_FLAGS = ['mediaAutoplay', 'mediaControls', 'mediaLoop', 'mediaMuted'];
/** Campos com tratamento próprio (ver applyProps). */
const SPECIAL = ['w', 'h', 'fill', 'stroke', 'radius', 'margin', 'shadows', 'effectStyleId', 'layout', 'tag', 'constraints', 'fx'];
/** Tudo que update_layer / create_layer aceitam. */
export const PROPS = [...SIMPLE, ...SPECIAL];
/** Valores válidos de alguns campos (o resto é conferido pelo tipo). */
const ENUMS = {
  sizeX: ['fixed', 'hug', 'fill'], sizeY: ['fixed', 'hug', 'fill'],
  textAlign: ['left', 'center', 'right', 'justify'], fontStyle: ['normal', 'italic'],
};
const LAYOUT_MODES = ['none', 'row', 'column', 'grid'];
const LAYOUT_KEYS = ['mode', 'gap', 'padding', 'justify', 'align', 'wrap', 'cols', 'rows', 'colGap', 'rowGap', 'colsTemplate', 'rowsTemplate'];

/** "#abc" / "#AABBCC" → "#AABBCC"; outra coisa → null. */
export const hex = (v) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(v || '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return `#${h.toUpperCase()}`;
};
/** Número ou lista de 4 → lista de 4 (padding, margin, radius). */
const four = (v, what) => {
  if (typeof v === 'number') return [v, v, v, v];
  if (Array.isArray(v) && v.length === 4 && v.every((x) => typeof x === 'number')) return v.slice();
  if (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number')) return [v[0], v[1], v[0], v[1]];
  throw new Error(`${what}: use um número ou uma lista [topo, direita, baixo, esquerda].`);
};

/**
 * Aplica `props` numa camada (dentro de um store.update). Lança Error com mensagem clara se algo não vale.
 * @param {object} node
 * @param {object} props
 * @param {{ setLayoutMode: (node, mode) => void }} ctx  liga/desliga o layout com a mesma lógica do painel
 */
export function applyProps(node, props: ToolArgs, ctx: PropertyContext = {}) {
  if (!props || typeof props !== 'object' || Array.isArray(props)) throw new Error('props precisa ser um objeto, ex.: {"fill": "#FF0000"}.');
  const unknown = Object.keys(props).filter((k) => !PROPS.includes(k));
  if (unknown.length) throw new Error(`Propriedade desconhecida: ${unknown.join(', ')}. Aceitas: ${PROPS.join(', ')}.`);
  for (const [k, v] of Object.entries(props)) {
    if (!SIMPLE.includes(k)) continue;
    if (ENUMS[k] && !ENUMS[k].includes(v)) throw new Error(`${k} precisa ser um destes: ${ENUMS[k].join(', ')}.`);
    if (BOOLEANS.includes(k) && typeof v !== 'boolean') throw new Error(`${k} precisa ser true ou false.`);
    if (NUMBERS.includes(k) && !Number.isFinite(v)) throw new Error(`${k} precisa ser um número.`);
    if (STRINGS.includes(k) && typeof v !== 'string') throw new Error(`${k} precisa ser um texto (use "" para limpar).`);
    if (k === 'html' && (node.type !== 'html' || v.length > 200000)) throw new Error('html só vale para camadas de código HTML (type "html") e vai até 200.000 caracteres.');
    if (['text'].includes(k) && node.type !== 'text') throw new Error('text só vale para camadas de texto.');
    if (MEDIA_FLAGS.includes(k)) {
      if (node.type !== 'media') throw new Error(`${k} só vale para camadas de mídia (vídeo, áudio, 3D, Lottie).`);
      if (typeof v !== 'boolean') throw new Error(`${k} precisa ser true ou false.`);
    }
    node[k] = v;
  }
  if ('w' in props || 'h' in props) {
    const w = 'w' in props ? Number(props.w) : node.w, h = 'h' in props ? Number(props.h) : node.h;
    if (!(w > 0) || !(h > 0)) throw new Error('w e h precisam ser números maiores que zero.');
    if ('w' in props) resizeNode(node, w, node.h, 'w');
    if ('h' in props) resizeNode(node, node.w, h, 'h');
    // w/h mandam o tamanho "fixo" por padrão; se o pedido também diz sizeX/sizeY ("hug", "fill"), isso vale (o w/h fica como tamanho inicial)
    if ('sizeX' in props) node.sizeX = props.sizeX;
    if ('sizeY' in props) node.sizeY = props.sizeY;
  }
  if ('fill' in props) {
    const f = props.fill;
    if (f === 'none' || f === null) node.fill = { ...(node.fill || defaultFill()), type: 'none' };
    else if (typeof f === 'string') {
      const c = hex(f);
      if (!c) throw new Error('fill: use uma cor "#RRGGBB", "none" ou um objeto de preenchimento.');
      node.fill = { ...(node.fill || defaultFill()), type: 'solid', color: c, opacity: node.fill?.opacity ?? 1 };
      delete node.fill.styleId; // cor escolhida à mão desliga o estilo de cor
    } else if (typeof f === 'object' && f.gradientId) {
      // ligar a um ESTILO de gradiente (vira var(--gradiente-x) no CSS): tipo, ângulo e paradas vêm do estilo
      const g = ctx.gradientStyle?.(f.gradientId);
      if (!g) throw new Error(`Estilo de gradiente "${f.gradientId}" não existe. Veja gradientStyles em get_document ou crie com create_gradient_styles.`);
      node.fill = { ...(node.fill || defaultFill()), type: g.type, angle: g.angle, stops: JSON.parse(JSON.stringify(g.stops)), gradientId: g.id };
      delete node.fill.styleId;
    } else if (typeof f === 'object' && f.styleId) {
      // ligar a um ESTILO de cor do projeto (vira var(--cor-...) no CSS): a cor vem do estilo
      const st = ctx.colorStyle?.(f.styleId);
      if (!st) throw new Error(`Estilo de cor "${f.styleId}" não existe. Veja colorStyles em get_document ou crie com create_color_styles.`);
      node.fill = { ...(node.fill || defaultFill()), type: 'solid', color: st.color, opacity: st.opacity ?? 1, styleId: f.styleId };
    } else if (typeof f === 'object') {
      const next = { ...(node.fill || defaultFill()), ...f };
      if (f.color) next.color = hex(f.color) || next.color;
      node.fill = next;
    }
  }
  if ('fill' in props && node.fill?.gradientId && !(props.fill && typeof props.fill === 'object' && props.fill.gradientId)) delete node.fill.gradientId; // mexeu no fill à mão: solta o estilo
  if ('stroke' in props) {
    const s = props.stroke;
    if (s === null || s === 'none') node.stroke = null;
    else if (typeof s === 'string') {
      const c = hex(s);
      if (!c) throw new Error('stroke: use uma cor "#RRGGBB", null ou um objeto {color, width, style, position}.');
      node.stroke = { ...(node.stroke || defaultStroke()), color: c };
    } else if (typeof s === 'object') node.stroke = { ...(node.stroke || defaultStroke()), ...s, ...(s.color ? { color: hex(s.color) || s.color } : {}) };
  }
  if ('radius' in props) node.radius = four(props.radius, 'radius').map((x) => Math.max(0, x));
  if ('constraints' in props) {
    const c = props.constraints || {};
    if (typeof c !== 'object' || Array.isArray(c) || Object.keys(c).some((k) => !['h', 'v'].includes(k))) throw new Error('constraints: use {h, v}.');
    if ('h' in c && !CONSTRAINT_H.includes(c.h)) throw new Error(`constraints.h: ${CONSTRAINT_H.join(', ')}.`);
    if ('v' in c && !CONSTRAINT_V.includes(c.v)) throw new Error(`constraints.v: ${CONSTRAINT_V.join(', ')}.`);
    node.constraints = { ...(node.constraints || { h: 'left', v: 'top' }), ...c };
  }
  if ('fx' in props) {
    const f = props.fx;
    if (f === null) delete node.fx;
    else {
      if (typeof f !== 'object' || Array.isArray(f) || Object.keys(f).some((k) => !FX_KEYS.includes(k) || !Number.isFinite(f[k]))) throw new Error(`fx: use null ou um objeto com números em ${FX_KEYS.join(', ')} (brightness/contrast/saturate/grayscale em %, hue em graus).`);
      if (Object.keys(f).length) node.fx = { ...f }; else delete node.fx;
    }
  }
  if ('margin' in props) node.margin = four(props.margin, 'margin');
  if ('shadows' in props) {
    if (!Array.isArray(props.shadows)) throw new Error('shadows precisa ser uma lista de sombras.');
    node.shadows = props.shadows.map((s) => ({ x: 0, y: 4, blur: 16, spread: 0, ...{ color: '#000000' }, opacity: 0.25, inset: false, ...s, color: hex(s.color) || '#000000' }));
    delete node.effectStyleId; // sombra feita à mão solta o estilo
  }
  if ('effectStyleId' in props) {
    if (!props.effectStyleId) delete node.effectStyleId;
    else {
      const e = ctx.effectStyle?.(props.effectStyleId);
      if (!e) throw new Error(`Estilo de sombra "${props.effectStyleId}" não existe. Veja effectStyles em get_document ou crie com create_effect_styles.`);
      node.effectStyleId = e.id;
      node.shadows = JSON.parse(JSON.stringify(e.shadows || []));
    }
  }
  if ('layout' in props) {
    if (node.type !== 'frame') throw new Error('layout só vale para frames (o que vira flex/grid). Para uma forma, crie um frame.');
    const L = props.layout || {};
    const bad = Object.keys(L).filter((k) => !LAYOUT_KEYS.includes(k));
    if (bad.length) throw new Error(`layout: chave desconhecida ${bad.join(', ')}. Aceitas: ${LAYOUT_KEYS.join(', ')}.`);
    if ('mode' in L) {
      if (!LAYOUT_MODES.includes(L.mode)) throw new Error(`layout.mode precisa ser um destes: ${LAYOUT_MODES.join(', ')}.`);
      if (L.mode !== node.layout.mode) ctx.setLayoutMode ? ctx.setLayoutMode(node, L.mode) : (node.layout.mode = L.mode);
    }
    for (const [k, v] of Object.entries(L)) {
      if (k === 'mode') continue;
      node.layout[k] = k === 'padding' ? four(v, 'layout.padding') : v;
    }
  }
  if ('tag' in props) {
    const list = node.type === 'text' ? TEXT_TAGS : BOX_TAGS;
    if (props.tag !== null && !list.includes(props.tag)) throw new Error(`tag para ${node.type === 'text' ? 'texto' : 'esta camada'}: ${list.join(', ')}.`);
    delete node.tag;
    if (props.tag && props.tag !== tagOf(node)) node.tag = props.tag;
  }
}
