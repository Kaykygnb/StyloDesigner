/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  modes.js — MODOS DE COR (claro/escuro...) E VARIÁVEIS DE TAMANHO   (módulo puro, testado em tests/modes.test.js)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  MODOS: um estilo de cor ({ id, name, color, opacity }) pode ter um valor diferente por modo:
 *      style.modes = { [idDoModo]: { color, opacity } }
 *  Os modos do projeto ficam em `doc.styles.modes = [{ id, name, scheme }]` (`scheme`: 'dark' | 'light' | null, para o
 *  CSS escolher o modo sozinho pela preferência do sistema). O modo "padrão" é o próprio valor do estilo (sem entrada).
 *  No CSS isso vira variáveis: `:root { --cor-fundo: #fff }` e `:root[data-theme="escuro"] { --cor-fundo: #111 }`.
 *
 *  VARIÁVEIS: números reutilizáveis ({ id, name, value }) — espaçamentos, raios e tamanhos de fonte. Uma camada liga um
 *  campo a uma variável em `node.vars = { gap: id, padding: id, radius: id, fontSize: id }`; o valor continua guardado
 *  na camada (para o canvas) e `syncVars` o atualiza quando a variável muda. No CSS vira `gap: var(--espaco-md)`.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { uid, walk } from './model.js';
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb } from './color.js';

/** Campos que uma camada pode ligar a uma variável, e como cada um é lido/escrito. */
export const VAR_PROPS = ['gap', 'padding', 'radius', 'fontSize'];
const SETTERS = {
  gap: (n, v) => { if (n.layout) n.layout.gap = v; },
  padding: (n, v) => { if (n.layout) n.layout.padding = [v, v, v, v]; },
  radius: (n, v) => { n.radius = [v, v, v, v]; },
  fontSize: (n, v) => { n.fontSize = v; },
};

const GETTERS = {
  gap: (n) => n.layout?.gap,
  padding: (n) => (n.layout?.padding?.every((x) => x === n.layout.padding[0]) ? n.layout.padding[0] : undefined),
  radius: (n) => (n.radius?.every((x) => x === n.radius[0]) ? n.radius[0] : undefined),
  fontSize: (n) => n.fontSize,
};

// ---------------------------------------------------------------- modos de cor
/** Lista de modos do projeto (vazia se não há). */
export const modesOf = (styles) => styles?.modes || [];

/**
 * Cor "escura" automática: inverte a luminosidade (claro vira escuro e vice-versa), mantendo o matiz e atenuando um
 * pouco a saturação dos tons muito claros, que ficariam berrantes no escuro.
 */
export function darkVariant(hex) {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  const nl = 1 - l;
  return rgbToHex(hslToRgb({ h, s: nl < 0.5 ? s * 0.9 : s, l: Math.min(0.97, Math.max(0.05, nl)) }));
}

/**
 * Cria um modo. Com `auto`, já gera os valores de todos os estilos de cor (inversão de luminosidade); senão os estilos
 * começam iguais ao padrão e você ajusta um a um.
 * @returns {object} o modo criado
 */
export function addMode(styles, { name, scheme = null, auto = false }) {
  const mode = { id: uid(), name: String(name || '').trim() || `Modo ${modesOf(styles).length + 2}`, scheme: scheme || null };
  (styles.modes ||= []).push(mode);
  if (auto) for (const c of styles.colors || []) (c.modes ||= {})[mode.id] = { color: darkVariant(c.color), opacity: c.opacity };
  return mode;
}

/** Apaga um modo e os valores dele em todos os estilos. */
export function removeMode(styles, id) {
  styles.modes = modesOf(styles).filter((m) => m.id !== id);
  for (const c of styles.colors || []) if (c.modes) { delete c.modes[id]; if (!Object.keys(c.modes).length) delete c.modes; }
  if (!styles.modes.length) delete styles.modes;
}

/** Valor de um estilo de cor num modo (o do próprio estilo se o modo não tem entrada). */
export const styleValue = (style, modeId) => (modeId && style.modes?.[modeId]) || { color: style.color, opacity: style.opacity };

/** Muda a cor de um estilo no modo dado (null = o valor padrão do estilo). */
export function setStyleColor(style, modeId, color, opacity) {
  if (!modeId) { style.color = color; if (opacity != null) style.opacity = opacity; return; }
  (style.modes ||= {})[modeId] = { color, opacity: opacity ?? style.modes?.[modeId]?.opacity ?? style.opacity };
}

/**
 * "Visão" de uma camada num modo de cor: se o preenchimento sólido está ligado a um estilo que tem valor para o modo,
 * devolve uma cópia com essa cor. Senão, a própria camada. Não altera nada.
 */
export function modeView(node, styles, modeId) {
  if (!modeId || node.fill?.type !== 'solid' || !node.fill.styleId) return node;
  const st = styles?.colors?.find((c) => c.id === node.fill.styleId);
  const m = st?.modes?.[modeId];
  if (!m) return node;
  return { ...node, fill: { ...node.fill, color: m.color, opacity: m.opacity ?? st.opacity } };
}

// ---------------------------------------------------------------- variáveis de tamanho
/** Variáveis do projeto. */
export const varsOf = (styles) => styles?.vars || [];

/** Cria uma variável ({ id, name, value }). */
export function addVar(styles, name, value) {
  const v = { id: uid(), name: String(name || '').trim() || `Variável ${varsOf(styles).length + 1}`, value: Math.max(0, Number(value) || 0) };
  (styles.vars ||= []).push(v);
  return v;
}

/** Apaga uma variável (as camadas ligadas a ela mantêm o valor que tinham; `syncVars` solta as ligações). */
export function removeVar(styles, id) {
  styles.vars = varsOf(styles).filter((v) => v.id !== id);
  if (!styles.vars.length) delete styles.vars;
}

/** Liga um campo de uma camada a uma variável e já aplica o valor. */
export function bindVar(node, prop, v) {
  if (!VAR_PROPS.includes(prop)) return;
  (node.vars ||= {})[prop] = v.id;
  SETTERS[prop](node, v.value);
}

/** Desliga um campo da variável (o valor atual fica). */
export function unbindVar(node, prop) {
  if (!node.vars) return;
  delete node.vars[prop];
  if (!Object.keys(node.vars).length) delete node.vars;
}

/**
 * Reconcilia as camadas ligadas a variáveis. Roda a cada commit (como syncStyles):
 *  - ligação a uma variável que não existe mais, ou a um campo que a camada não tem (gap em texto), é solta;
 *  - se o valor do campo FOI EDITADO à mão (difere da variável), a ligação é solta e o valor da pessoa fica;
 *  - com `force` (quando a própria variável mudou de valor), o valor da variável é escrito em todas as camadas ligadas.
 */
export function syncVars(doc, force = false) {
  const vars = varsOf(doc.styles);
  for (const page of doc.pages || []) {
    walk(page.children, (n) => {
      if (!n.vars) return;
      for (const [prop, id] of Object.entries(n.vars)) {
        const v = vars.find((x) => x.id === id);
        if (!v || !SETTERS[prop] || GETTERS[prop](n) === undefined) { unbindVar(n, prop); continue; }
        if (force) SETTERS[prop](n, v.value);
        else if (GETTERS[prop](n) !== v.value) unbindVar(n, prop);
      }
    });
  }
}

/**
 * Nomes de variável de CSS das variáveis de tamanho: id → "--espaco-md" (nome sem acento, minúsculo, com hífens;
 * repetidos ganham -2). Vazio se não há.
 */
export function varCssNames(styles, slugify) {
  const out = new Map();
  const used = new Map();
  for (const v of varsOf(styles)) {
    const base = `--${slugify(v.name || 'variavel')}`;
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    out.set(v.id, n === 1 ? base : `${base}-${n}`);
  }
  return out;
}
