/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/codeeditor.js — EDITOR DE CÓDIGO LEVE (sem dependências)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Um <textarea> transparente por cima de um <pre> colorido (o texto que você vê é o <pre>; o cursor e a seleção
 *  são do textarea). Tem números de linha, Tab/Shift+Tab indentam, Enter mantém o recuo, Ctrl+Enter aplica,
 *  autocompletar de propriedades CSS (e de alguns valores) e marcas de erro/aviso por linha.
 *  As edições usam execCommand('insertText'), então o Ctrl+Z do próprio campo continua funcionando.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h } from './dom.js';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Colore uma folha de CSS (ou só declarações): comentários, @regras, seletores, propriedades, valores. */
export function highlightCss(code) {
  let out = '';
  let depth = 0;
  const re = /(\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|(@[\w-]+)|([{}])|(;)|([^{};"'/@]+|\/)/g;
  let m;
  let inValue = false;
  // "declarações soltas" (editor da camada): o nível 0 já é de declarações
  const declsOnly = !/[{}]/.test(code);
  while ((m = re.exec(code))) {
    const [tok, comment, str, at, brace, semi, text] = m;
    if (comment) out += `<span class="tk-com">${esc(comment)}</span>`;
    else if (str) out += `<span class="tk-str">${esc(str)}</span>`;
    else if (at) out += `<span class="tk-at">${esc(at)}</span>`;
    else if (brace) { depth += brace === '{' ? 1 : -1; inValue = false; out += `<span class="tk-pun">${brace}</span>`; }
    else if (semi) { inValue = false; out += '<span class="tk-pun">;</span>'; }
    else if (text) {
      const inDecls = declsOnly || depth > 0;
      // dentro de { }: "prop: valor"; o seletor de uma regra aninhada em @media também cai aqui (tem "{" depois)
      const rest = code.slice(re.lastIndex);
      const isSelector = !declsOnly && /^\s*\{/.test(rest) && !inValue;
      if (isSelector || !inDecls) { out += `<span class="tk-sel">${esc(text)}</span>`; continue; }
      if (inValue) { out += valueHtml(text); continue; }
      const c = text.indexOf(':');
      if (c < 0) { out += `<span class="tk-prop">${esc(text)}</span>`; continue; }
      out += `<span class="tk-prop">${esc(text.slice(0, c))}</span><span class="tk-pun">:</span>${valueHtml(text.slice(c + 1))}`;
      inValue = true;
    } else out += esc(tok);
  }
  return out;
}
const valueHtml = (v) => esc(v)
  .replace(/(#[0-9a-fA-F]{3,8})\b/g, '<span class="tk-num"><i class="tk-sw" style="background:$1"></i>$1</span>')
  .replace(/(^|[\s,(])(-?\d*\.?\d+)(px|rem|em|%|vh|vw|deg|ms|s|fr|ch)?(?=[\s;,)]|$)/g, '$1<span class="tk-num">$2$3</span>')
  .replace(/!important/g, '<span class="tk-at">!important</span>');

/** Colore HTML: etiquetas, atributos, valores, comentários. */
export function highlightHtml(code) {
  return code.replace(/(<!--[\s\S]*?(?:-->|$))|(<\/?)([\w:-]+)((?:[^>"']|"[^"]*"|'[^']*')*)(\/?>)?|([^<]+|<)/g, (all, com, open, tag, attrs, close, text) => {
    if (com) return `<span class="tk-com">${esc(com)}</span>`;
    if (open) {
      const a = (attrs || '').replace(/([^\s=]+)(\s*=\s*)("[^"]*"|'[^']*'|[^\s"'>]+)?|([^\s=]+)|(\s+)/g, (x, k, eq, v, solo, sp) => {
        if (sp) return sp;
        if (solo) return `<span class="tk-prop">${esc(solo)}</span>`;
        return `<span class="tk-prop">${esc(k)}</span>${esc(eq)}${v ? `<span class="tk-str">${esc(v)}</span>` : ''}`;
      });
      return `<span class="tk-pun">${esc(open)}</span><span class="tk-sel">${esc(tag)}</span>${a}${close ? `<span class="tk-pun">${esc(close)}</span>` : ''}`;
    }
    return esc(text || all);
  });
}

// ------------------------------------------------------------------ autocompletar
let CSS_PROPS = null;
/** Todas as propriedades que ESTE navegador conhece (longhands do getComputedStyle + atalhos comuns). */
function cssProps() {
  if (CSS_PROPS) return CSS_PROPS;
  const set = new Set(['margin', 'padding', 'border', 'border-radius', 'background', 'font', 'flex', 'flex-flow', 'grid', 'grid-template',
    'grid-area', 'gap', 'inset', 'transition', 'animation', 'outline', 'place-items', 'place-content', 'place-self', 'overflow', 'text-decoration',
    'list-style', 'columns', 'border-top', 'border-right', 'border-bottom', 'border-left', 'margin-inline', 'margin-block', 'padding-inline', 'padding-block',
    'container', 'mask', 'scroll-margin', 'scroll-padding']);
  try { for (const p of getComputedStyle(document.documentElement)) if (!p.startsWith('--')) set.add(p); } catch { /* fora do navegador */ }
  CSS_PROPS = [...set].sort();
  return CSS_PROPS;
}
/** Valores sugeridos para algumas propriedades. */
const CSS_VALUES = {
  display: ['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'none', 'contents'],
  position: ['static', 'relative', 'absolute', 'fixed', 'sticky'],
  'flex-direction': ['row', 'column', 'row-reverse', 'column-reverse'],
  'flex-wrap': ['nowrap', 'wrap', 'wrap-reverse'],
  'justify-content': ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly', 'stretch'],
  'align-items': ['flex-start', 'center', 'flex-end', 'stretch', 'baseline'],
  'align-self': ['auto', 'flex-start', 'center', 'flex-end', 'stretch'],
  'text-align': ['left', 'center', 'right', 'justify'],
  'font-weight': ['400', '500', '600', '700', '800', 'normal', 'bold'],
  'font-style': ['normal', 'italic'],
  'text-transform': ['none', 'uppercase', 'lowercase', 'capitalize'],
  'text-decoration': ['none', 'underline', 'line-through'],
  overflow: ['visible', 'hidden', 'auto', 'scroll', 'clip'],
  cursor: ['pointer', 'default', 'text', 'move', 'grab', 'not-allowed'],
  'white-space': ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line'],
  'box-sizing': ['border-box', 'content-box'],
  'object-fit': ['cover', 'contain', 'fill', 'none', 'scale-down'],
  visibility: ['visible', 'hidden'],
  'pointer-events': ['auto', 'none'],
  'user-select': ['auto', 'none', 'text', 'all'],
};

/**
 * Cria um editor.
 * @param {{ language: 'css'|'decls'|'html', value?: string, placeholder?: string, label?: string,
 *           onInput?: (value:string)=>void, onApply?: ()=>void }} opts
 * @returns {{ el: HTMLElement, textarea: HTMLTextAreaElement, getValue: ()=>string, setValue: (v:string)=>void,
 *            setDiagnostics: (list:{line:number,level:string,msg:string}[])=>void, focus: ()=>void }}
 */
export function createCodeEditor({ language, value = '', placeholder = '', label = 'Editor de código', onInput, onApply }) {
  const gutter = h('div.ce-gutter', { 'aria-hidden': 'true' });
  const pre = h('pre.ce-hl', { 'aria-hidden': 'true' });
  const ta = h('textarea.ce-input', { spellcheck: false, autocapitalize: 'off', autocomplete: 'off', wrap: 'off', placeholder, 'aria-label': label });
  ta.setAttribute('autocorrect', 'off');
  const list = h('div.ce-complete', { role: 'listbox', hidden: true });
  const scroller = h('div.ce-scroll', pre, ta);
  const el = h('div.ce', { dataset: { lang: language } }, gutter, scroller, list);
  let diags = [];
  let items = [], active = 0, replaceFrom = 0;

  const paint = () => {
    const v = ta.value;
    pre.innerHTML = (language === 'html' ? highlightHtml(v) : highlightCss(v)) + '\n';
    const lines = v.split('\n').length;
    const byLine = new Map();
    for (const d of diags) if (!byLine.has(d.line) || d.level === 'error') byLine.set(d.line, d);
    let html = '';
    for (let i = 1; i <= lines; i++) {
      const d = byLine.get(i);
      html += d ? `<div class="ce-ln ${d.level}" title="${esc(d.msg).replace(/"/g, '&quot;')}">${i}</div>` : `<div class="ce-ln">${i}</div>`;
    }
    gutter.innerHTML = html;
    syncScroll();
  };
  const syncScroll = () => {
    pre.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
    gutter.style.transform = `translateY(${-ta.scrollTop}px)`;
  };
  ta.addEventListener('scroll', syncScroll);
  ta.value = value;

  /** Insere texto no lugar da seleção mantendo o desfazer nativo do campo. */
  const insert = (text, from = ta.selectionStart, to = ta.selectionEnd) => {
    ta.setSelectionRange(from, to);
    if (!document.execCommand?.('insertText', false, text)) {
      ta.setRangeText(text, from, to, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  };

  // ---- autocompletar (só CSS)
  const closeList = () => { list.hidden = true; items = []; };
  const caretInfo = () => {
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const lineStart = before.lastIndexOf('\n') + 1;
    const line = before.slice(lineStart);
    return { pos, line, lineNo: before.split('\n').length - 1, col: pos - lineStart };
  };
  const insideBlock = (pos) => {
    if (language === 'decls') return true;
    const t = ta.value.slice(0, pos).replace(/\/\*[\s\S]*?\*\//g, '');
    return t.split('{').length - t.split('}').length > 0;
  };
  const updateList = () => {
    if (language === 'html') return closeList();
    const { pos, line, lineNo, col } = caretInfo();
    if (!insideBlock(pos)) return closeList();
    const seg = line.slice(line.lastIndexOf(';') + 1).replace(/^.*\{/, '');
    let words = [];
    const pm = /^\s*([a-z-]*)$/.exec(seg);
    const vm = /^\s*([a-z-]+)\s*:\s*([a-z0-9-]*)$/.exec(seg);
    if (pm && pm[1].length >= 1) {
      const q = pm[1];
      words = cssProps().filter((p) => p.startsWith(q) && p !== q).slice(0, 8);
      if (words.length < 8) words.push(...cssProps().filter((p) => !p.startsWith(q) && p.includes(q)).slice(0, 8 - words.length));
      replaceFrom = pos - q.length;
      items = words.map((w) => ({ label: w, insert: `${w}: ` }));
    } else if (vm && CSS_VALUES[vm[1]]) {
      const q = vm[2];
      words = CSS_VALUES[vm[1]].filter((v) => v.startsWith(q) && v !== q);
      replaceFrom = pos - q.length;
      items = words.map((w) => ({ label: w, insert: `${w};` }));
    } else return closeList();
    if (!items.length) return closeList();
    active = 0;
    list.replaceChildren(...items.map((it, i) => h('div.ce-opt' + (i === active ? '.on' : ''), {
      role: 'option',
      onmousedown: (e) => { e.preventDefault(); active = i; accept(); },
    }, it.label)));
    list.hidden = false;
    // posição: logo abaixo do cursor (fonte monoespaçada: coluna × largura do caractere)
    const cs = getComputedStyle(ta);
    const lh = parseFloat(cs.lineHeight) || 18;
    const cw = charWidth(cs.font);
    list.style.left = `${Math.min(gutter.offsetWidth + parseFloat(cs.paddingLeft) + col * cw - ta.scrollLeft, el.clientWidth - 180)}px`;
    list.style.top = `${parseFloat(cs.paddingTop) + (lineNo + 1) * lh - ta.scrollTop + 2}px`;
  };
  const highlightActive = () => [...list.children].forEach((c, i) => { c.classList.toggle('on', i === active); if (i === active) c.scrollIntoView({ block: 'nearest' }); });
  const accept = () => {
    const it = items[active];
    if (!it) return;
    // completa até o fim da palavra atual
    const after = /^[a-z0-9-]*/.exec(ta.value.slice(ta.selectionStart))[0];
    insert(it.insert, replaceFrom, ta.selectionStart + after.length);
    closeList();
    if (it.insert.endsWith(': ')) updateList();
  };

  ta.addEventListener('input', () => { paint(); updateList(); onInput?.(ta.value); });
  ta.addEventListener('blur', () => setTimeout(closeList, 120));
  ta.addEventListener('click', closeList);
  ta.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!list.hidden && items.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; highlightActive(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; highlightActive(); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); accept(); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeList(); return; }
    }
    if (mod && (e.key === 'Enter' || e.key.toLowerCase() === 's')) { e.preventDefault(); e.stopPropagation(); onApply?.(); return; }
    if (mod && e.key === ' ') { e.preventDefault(); updateList(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: t, value: v } = ta;
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      if (s === t && !e.shiftKey) { insert('  '); return; }
      // várias linhas: (des)indenta todas
      const le = v.indexOf('\n', t - (t > s && v[t - 1] === '\n' ? 1 : 0));
      const end = le < 0 ? v.length : le;
      const block = v.slice(ls, end);
      const next = e.shiftKey ? block.replace(/^ {1,2}/gm, '') : block.replace(/^/gm, '  ');
      insert(next, ls, end);
      ta.setSelectionRange(ls, ls + next.length);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const { selectionStart: s, value: v } = ta;
      const line = v.slice(v.lastIndexOf('\n', s - 1) + 1, s);
      let ind = /^\s*/.exec(line)[0];
      const prev = line.trimEnd().slice(-1);
      const htmlOpen = language === 'html' && /<([a-z][\w-]*)[^>]*>\s*$/i.test(line) && !/<\/[^>]+>\s*$/.test(line) && !/\/>\s*$/.test(line);
      if (prev === '{' || htmlOpen) ind += '  ';
      insert(`\n${ind}`);
      return;
    }
    if (e.key === '}' && language !== 'html') {
      // fecha o bloco alinhado com a linha que abriu
      const { selectionStart: s, value: v } = ta;
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      if (/^\s+$/.test(v.slice(ls, s))) { e.preventDefault(); insert(`${v.slice(ls, s).slice(2)}}`, ls, s); }
    }
  });

  paint();
  return {
    el, textarea: ta,
    getValue: () => ta.value,
    setValue: (v) => { if (ta.value !== v) { ta.value = v; paint(); } },
    setDiagnostics: (list2) => { diags = list2 || []; paint(); },
    focus: () => ta.focus(),
  };
}

let cwCache = { font: '', w: 7 };
/** Largura de um caractere da fonte monoespaçada (mede uma vez por fonte). */
function charWidth(font) {
  if (cwCache.font === font) return cwCache.w;
  const c = document.createElement('canvas').getContext('2d');
  c.font = font;
  cwCache = { font, w: c.measureText('0000000000').width / 10 || 7 };
  return cwCache.w;
}
