/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  cssedit.js — CSS DA CAMADA EDITADO À MÃO (aba Código → CSS → Editar)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  A pessoa edita as declarações que a camada gera (o mesmo CSS da exportação) e aplica. Como o desenho é guardado
 *  em campos do modelo (w, fill, radius...) e não em CSS, a aplicação funciona em 3 passos:
 *   1. MAPEIA o que dá para virar campo do modelo (largura/altura em px, posição, cor sólida, raio, opacidade,
 *      fonte, gap/padding do auto layout...). Assim o painel Design continua mostrando o valor certo;
 *   2. tudo o que não é mapeável vai para o CSS LIVRE da camada (node.customCss), que vem por último no CSS gerado e
 *      vence. Declarações APAGADAS que o desenho ainda gera viram `propriedade: unset` no CSS livre;
 *   3. só guarda no CSS livre o que difere do que o modelo já gera (nada de duplicar).
 *  Função PURA: muda o nó recebido (chame dentro de store.update) e devolve o relatório. Testada em tests/codigo.test.js.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { nodeStyle, parseCustomCss } from './css.js';
import { parseDeclarations, checkDecl } from './html.js';
import { hasLayout } from './model.js';

const PX = /^(-?\d+(?:\.\d+)?)px$/;
const num = (v) => (PX.test(v) ? parseFloat(PX.exec(v)[1]) : null);
const pxList = (v) => {
  const parts = v.trim().split(/\s+/).map(num);
  if (!parts.length || parts.length > 4 || parts.some((p) => p === null)) return null;
  const [t, r = t, b = t, l = r] = parts;
  return [t, r, b, l];
};

/** Cor CSS (#rgb, #rrggbb, #rrggbbaa, rgb()/rgba()) → { color: '#RRGGBB', opacity }; null se for outro formato. */
export function parseColor(v) {
  const s = String(v).trim().toLowerCase();
  let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = h.split('').map((c) => c + c).join('');
    const a = h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1;
    return { color: `#${h.slice(0, 6).toUpperCase()}`, opacity: Math.round(a * 1000) / 1000 };
  }
  m = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d*(?:\.\d+)?)(%?))?\s*\)$/.exec(s);
  if (m) {
    const hex = [m[1], m[2], m[3]].map((x) => Math.max(0, Math.min(255, Math.round(+x))).toString(16).padStart(2, '0')).join('');
    let a = m[4] === undefined || m[4] === '' ? 1 : +m[4];
    if (m[5]) a /= 100;
    return { color: `#${hex.toUpperCase()}`, opacity: Math.max(0, Math.min(1, a)) };
  }
  return null;
}

/**
 * Propriedades que viram campo do modelo: set(node, valor, ctx) devolve true se conseguiu.
 * ctx = { before } (o CSS que a camada gerava antes).
 */
const MAPPERS = {
  opacity: (n, v) => {
    const x = /%$/.test(v) ? parseFloat(v) / 100 : parseFloat(v);
    if (!Number.isFinite(x) || !/^[\d.]+%?$/.test(v)) return false;
    n.opacity = Math.max(0, Math.min(1, x));
    return true;
  },
  width: (n, v, { before }) => {
    const x = num(v);
    if (x === null || x <= 0 || n.type === 'line' || !PX.test(before.width || '')) return false;
    n.w = x; n.sizeX = 'fixed';
    return true;
  },
  height: (n, v, { before }) => {
    const x = num(v);
    if (x === null || x <= 0 || n.type === 'line' || !PX.test(before.height || '')) return false;
    n.h = x; n.sizeY = 'fixed';
    return true;
  },
  left: (n, v, { before }) => {
    const x = num(v);
    if (x === null || before.position !== 'absolute' || !PX.test(before.left || '')) return false;
    n.x += x - num(before.left);
    return true;
  },
  top: (n, v, { before }) => {
    const x = num(v);
    if (x === null || before.position !== 'absolute' || !PX.test(before.top || '')) return false;
    n.y += x - num(before.top);
    return true;
  },
  'border-radius': (n, v) => {
    if (n.type === 'ellipse' || n.type === 'text' || n.type === 'line') return false;
    const l = pxList(v);
    if (!l || l.some((x) => x < 0)) return false;
    n.radius = l;
    return true;
  },
  'background-color': (n, v) => {
    if (n.type === 'text' || n.type === 'path' || n.type === 'line') return false;
    const c = parseColor(v);
    if (!c) return false;
    n.fill = { ...(n.fill || {}), type: 'solid', color: c.color, opacity: c.opacity };
    delete n.fill.styleId;
    return true;
  },
  color: (n, v) => {
    if (n.type !== 'text') return false;
    const c = parseColor(v);
    if (!c) return false;
    n.fill = { ...(n.fill || {}), type: 'solid', color: c.color, opacity: c.opacity };
    delete n.fill.styleId;
    return true;
  },
  'font-size': (n, v) => { const x = num(v); if (n.type !== 'text' || x === null || x <= 0) return false; n.fontSize = x; return true; },
  'font-weight': (n, v) => { if (n.type !== 'text' || !/^[1-9]00$/.test(v)) return false; n.fontWeight = +v; return true; },
  'line-height': (n, v) => { if (n.type !== 'text' || !/^\d+(\.\d+)?$/.test(v)) return false; n.lineHeight = +v; return true; },
  'letter-spacing': (n, v) => { const x = num(v); if (n.type !== 'text' || x === null) return false; n.letterSpacing = x; return true; },
  'text-align': (n, v) => { if (n.type !== 'text' || !['left', 'center', 'right', 'justify'].includes(v)) return false; n.textAlign = v; return true; },
  'font-style': (n, v) => { if (n.type !== 'text' || !['normal', 'italic'].includes(v)) return false; n.fontStyle = v; return true; },
  'text-transform': (n, v) => { if (n.type !== 'text' || !['none', 'uppercase', 'lowercase', 'capitalize'].includes(v)) return false; n.textTransform = v; return true; },
  gap: (n, v) => {
    if (!hasLayout(n) || n.layout.mode === 'grid') return false;
    const x = num(v);
    if (x === null || x < 0) return false;
    n.layout.gap = x;
    return true;
  },
  padding: (n, v) => {
    if (!hasLayout(n)) return false;
    const l = pxList(v);
    if (!l || l.some((x) => x < 0)) return false;
    n.layout.padding = l;
    return true;
  },
};

/** Tira o "seletor { }" se a pessoa colou a regra inteira: fica só o que está dentro da 1ª chave. */
export function declarationsText(text) {
  const s = String(text ?? '');
  const open = s.indexOf('{');
  if (open < 0) return { body: s, offset: 0, extra: false };
  // declarações e DEPOIS uma regra ("color: red; .x { }"): vale só a parte de declarações
  if (s.slice(0, open).includes(';')) return { body: s.slice(0, s.lastIndexOf(';', open) + 1), offset: 0, extra: true };
  const close = s.lastIndexOf('}');
  const body = s.slice(open + 1, close > open ? close : s.length);
  // mais de uma regra: o resto é ignorado (o CSS com seletores próprios vai na aba Página)
  const extra = s.slice(open + 1, close > open ? close : s.length).includes('{');
  return { body, offset: s.slice(0, open + 1).split('\n').length - 1, extra };
}

/**
 * Confere o texto do editor de CSS da camada. `supports` = CSS.supports do navegador (opcional).
 * @returns {{line:number, level:'error'|'warn', msg:string}[]}  linhas a partir de 1
 */
export function lintLayerCss(text, supports) {
  const { body, offset, extra } = declarationsText(text);
  const out = [];
  if (extra) out.push({ line: 1, level: 'error', msg: 'aqui vão só declarações desta camada; regras com seletor, @media e :hover vão na aba "Página"' });
  for (const d of parseDeclarations(body)) out.push(...checkDecl(d, offset + d.line + 1, supports));
  return out;
}

/**
 * Aplica o CSS editado na camada (muda `node`). Ver o topo do arquivo.
 * @param {object} node
 * @param {object|null} parent
 * @param {object} assets
 * @param {string} text  declarações ("prop: valor;" por linha) ou a regra inteira
 * @returns {{ mapped: string[], custom: string[], unset: string[], ignored: string[] }}
 */
export function applyLayerCss(node, parent, assets, text) {
  const { body } = declarationsText(text);
  const wanted = new Map();
  const ignored = [];
  for (const d of parseDeclarations(body)) {
    if (checkDecl(d, 0).some((e) => e.level === 'error')) { ignored.push(d.prop); continue; }
    wanted.set(d.prop, d.value);
  }
  const opts = { fluid: true };
  const before = nodeStyle(node, parent, assets, opts);
  const mapped = [];
  for (const [k, v] of wanted) {
    if (before[k] === v) continue;
    const fn = MAPPERS[k];
    if (fn && fn(node, v, { before })) mapped.push(k);
  }
  // o que o modelo gera agora, SEM o CSS livre
  const plain = { ...node };
  delete plain.customCss;
  const gen = nodeStyle(plain, parent, assets, opts);
  const custom = {};
  const unset = [];
  for (const [k, v] of wanted) if (!mapped.includes(k) && gen[k] !== v) custom[k] = v;
  for (const k of Object.keys(gen)) {
    if (wanted.has(k) || k === 'box-sizing') continue;
    // apagada pela pessoa: só vira unset se ela existia no que era mostrado (antes)
    if (k in before) { custom[k] = 'unset'; unset.push(k); }
  }
  // guarda só o que o CSS livre aceita (parseCustomCss é a mesma régua do gerador)
  const text2 = Object.entries(custom).map(([k, v]) => `${k}: ${v};`).join('\n');
  const accepted = parseCustomCss(text2);
  for (const k of Object.keys(custom)) if (!(k in accepted)) ignored.push(k);
  const final = Object.entries(accepted).map(([k, v]) => `${k}: ${v};`).join('\n');
  if (final) node.customCss = final; else delete node.customCss;
  return { mapped, custom: Object.keys(accepted).filter((k) => accepted[k] !== 'unset'), unset, ignored };
}

/** Declarações que a camada mostra no editor (o CSS da exportação), uma por linha. */
export function layerCssText(node, parent, assets) {
  return Object.entries(nodeStyle(node, parent, assets, { fluid: true })).map(([k, v]) => `${k}: ${v};`).join('\n');
}

/**
 * O painel Design mandou de novo: tira do CSS livre da camada as propriedades cujo valor GERADO pelo modelo mudou
 * nesta edição (ex.: o CSS editado à mão fixou `width` e agora a pessoa mexeu na largura pelo painel). Sem isso,
 * o CSS livre (que vem por último) continuaria vencendo e o painel pareceria não funcionar.
 * @param {object} node
 * @param {Record<string, string>} beforePlain  nodeStyle da camada SEM o CSS livre, antes da edição
 * @param {Record<string, string>} afterPlain   idem, depois da edição
 * @returns {string[]} propriedades liberadas
 */
export function releaseOverrides(node, beforePlain, afterPlain) {
  if (!node.customCss) return [];
  const custom = parseCustomCss(node.customCss);
  const changed = new Set([...Object.keys(beforePlain), ...Object.keys(afterPlain)].filter((k) => beforePlain[k] !== afterPlain[k]));
  // mexer na posição/tamanho também libera as formas "atalho" que as escrevem (inset, flex, margin…)
  const related = { left: ['inset'], top: ['inset'], width: ['flex', 'flex-basis'], height: ['flex', 'flex-basis'], flex: ['flex-grow', 'flex-basis', 'flex-shrink'] };
  for (const k of [...changed]) for (const r of related[k] || []) changed.add(r);
  const freed = Object.keys(custom).filter((k) => changed.has(k));
  if (!freed.length) return [];
  for (const k of freed) delete custom[k];
  const text = Object.entries(custom).map(([k, v]) => `${k}: ${v};`).join('\n');
  if (text) node.customCss = text; else delete node.customCss;
  return freed;
}
