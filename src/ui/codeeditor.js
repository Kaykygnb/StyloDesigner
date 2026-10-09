/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/codeeditor.js — EDITOR DE CÓDIGO LEVE (sem dependências)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Um <textarea> transparente por cima de um <pre> colorido (o texto que você vê é o <pre>; o cursor e a seleção
 *  são do textarea). Tem:
 *   - números de linha, linha atual destacada, marcas de erro/aviso por linha;
 *   - Tab/Shift+Tab indentam, Enter mantém o recuo (e abre o bloco entre { } ou entre <a></a>);
 *   - colchetes e aspas fecham sozinhos, Ctrl+/ comenta a linha, Ctrl+F procura, Ctrl+Enter/Ctrl+S aplicam;
 *   - AUTOCOMPLETAR de verdade (ver codeassist.js): popup com ícone do tipo, descrição e prévia de cor, setas
 *     navegam, Enter/Tab aceitam, Esc fecha, Ctrl+Espaço abre; no HTML, fecha etiquetas e expande Emmet com Tab.
 *  As edições usam execCommand('insertText'), então o Ctrl+Z do próprio campo continua funcionando.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { completeCss, completeHtml, emmetAbbrBefore, expandEmmet, CARET, VOID_TAGS } from '../codeassist.js';

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
  .replace(/(^|[\s,(])(-?\d*\.?\d+)(px|rem|em|%|vh|vw|dvh|svh|deg|turn|ms|s|fr|ch|vmin|vmax)?(?=[\s;,)/]|$)/g, '$1<span class="tk-num">$2$3</span>')
  .replace(/([\w-]+)(?=\()/g, '<span class="tk-fn">$1</span>')
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

/** Ícone (letra) e nome de cada tipo de sugestão, no popup. */
const KINDS = {
  property: ['P', 'propriedade'], value: ['V', 'valor'], unit: ['U', 'unidade'], function: ['ƒ', 'função'], variable: ['$', 'variável'],
  color: ['●', 'cor'], class: ['.', 'classe'], id: ['#', 'id'], pseudo: [':', 'pseudo'], tag: ['<>', 'etiqueta'], selector: ['S', 'seletor'],
  at: ['@', '@regra'], attr: ['=', 'atributo'], emmet: ['⚡', 'Emmet'],
};
const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
const CLOSERS = new Set([')', ']', '}', '"', "'"]);

/**
 * Cria um editor.
 * @param {{ language: 'css'|'decls'|'html', value?: string, placeholder?: string, label?: string,
 *           onInput?: (value:string)=>void, onApply?: ()=>void, onCursor?: (pos:{line:number,col:number})=>void,
 *           context?: ()=>object }} opts
 *   context: devolve { vars, classes, ids, breakpoints, colors } do documento para o autocompletar
 * @returns {{ el: HTMLElement, textarea: HTMLTextAreaElement, getValue: ()=>string, setValue: (v:string)=>void,
 *            setDiagnostics: (list:{line:number,level:string,msg:string}[])=>void, focus: ()=>void,
 *            complete: (manual?:boolean)=>void, openFind: ()=>void, refresh: ()=>void }}
 */
export function createCodeEditor({ language, value = '', placeholder = '', label = 'Editor de código', onInput, onApply, onCursor, context }) {
  const isHtml = language === 'html';
  const lines = h('div.ce-lines');
  const gutter = h('div.ce-gutter', { 'aria-hidden': 'true' }, lines);
  const pre = h('pre.ce-hl', { 'aria-hidden': 'true' });
  const curLine = h('div.ce-curline', { 'aria-hidden': 'true' });
  const marks = h('div.ce-marks', { 'aria-hidden': 'true' });
  const ta = h('textarea.ce-input', { spellcheck: false, autocapitalize: 'off', autocomplete: 'off', wrap: 'off', placeholder, 'aria-label': label });
  ta.setAttribute('autocorrect', 'off');
  ta.setAttribute('aria-autocomplete', 'list');
  // popup do autocompletar: lista + descrição do item ativo
  const listBox = h('div.ce-list', { role: 'listbox', id: `ce-list-${Math.random().toString(36).slice(2, 8)}` });
  const docBox = h('div.ce-doc');
  const popup = h('div.ce-complete', { hidden: true }, listBox, docBox);
  // barra de procurar (Ctrl+F)
  const findInput = h('input.ce-find-input', { type: 'text', placeholder: 'Procurar', spellcheck: false, 'aria-label': 'Procurar no código' });
  const findCount = h('span.ce-find-count');
  const findBar = h('div.ce-find', { hidden: true },
    ico('search', 13), findInput, findCount,
    h('button.ce-find-btn', { type: 'button', title: 'Anterior (Shift+Enter)', 'aria-label': 'Anterior', onclick: () => findStep(-1) }, '↑'),
    h('button.ce-find-btn', { type: 'button', title: 'Próxima (Enter)', 'aria-label': 'Próxima', onclick: () => findStep(1) }, '↓'),
    h('button.ce-find-btn', { type: 'button', title: 'Fechar (Esc)', 'aria-label': 'Fechar a busca', onclick: () => closeFind(true) }, ico('x', 12)));
  const scroller = h('div.ce-scroll', curLine, marks, pre, ta);
  const el = h('div.ce', { dataset: { lang: language } }, gutter, scroller, popup, findBar);
  let diags = [];
  let items = [], active = 0, range = null;
  let metrics = null;

  /** Altura da linha, largura do caractere e recuos (fonte monoespaçada; medido uma vez por fonte). */
  const measure = () => {
    const cs = getComputedStyle(ta);
    // (cs.font pode vir vazio quando há font-variant-*: monta a fonte com as partes)
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const key = `${font}|${cs.lineHeight}|${cs.paddingTop}|${cs.paddingLeft}`;
    if (metrics?.key === key) return metrics;
    const m = { key, lh: parseFloat(cs.lineHeight) || 20, cw: charWidth(font), padTop: parseFloat(cs.paddingTop) || 0, padLeft: parseFloat(cs.paddingLeft) || 0 };
    // fora da página (ainda não montado) as medidas são falsas: não guarda
    if (ta.isConnected) metrics = m;
    return m;
  };
  /** Linha e coluna (0-based) de uma posição do texto. */
  const lineCol = (pos) => {
    const before = ta.value.slice(0, pos);
    const ls = before.lastIndexOf('\n') + 1;
    return { line: before.split('\n').length - 1, col: pos - ls };
  };

  const paint = () => {
    const v = ta.value;
    pre.innerHTML = (isHtml ? highlightHtml(v) : highlightCss(v)) + '\n';
    const n = v.split('\n').length;
    const byLine = new Map();
    for (const d of diags) if (!byLine.has(d.line) || d.level === 'error') byLine.set(d.line, d);
    let html = '';
    for (let i = 1; i <= n; i++) {
      const d = byLine.get(i);
      html += d ? `<div class="ce-ln ${d.level}" title="${esc(d.msg).replace(/"/g, '&quot;')}">${i}</div>` : `<div class="ce-ln">${i}</div>`;
    }
    lines.innerHTML = html;
    lastLine = -1;
    paintCaret();
    if (!findBar.hidden) paintMatches();
    syncScroll();
  };
  // linha atual: faixa de fundo + número em destaque
  let lastLine = -1;
  const paintCaret = () => {
    const { line, col } = lineCol(ta.selectionStart);
    const { lh, padTop } = measure();
    curLine.style.top = `${padTop + line * lh}px`;
    curLine.style.height = `${lh}px`;
    if (line !== lastLine) {
      lines.children[lastLine]?.classList.remove('on');
      lines.children[line]?.classList.add('on');
      lastLine = line;
    }
    onCursor?.({ line: line + 1, col: col + 1 });
  };
  const syncScroll = () => {
    const x = ta.scrollLeft, y = ta.scrollTop;
    pre.style.transform = `translate(${-x}px, ${-y}px)`;
    marks.style.transform = `translate(${-x}px, ${-y}px)`;
    curLine.style.transform = `translateY(${-y}px)`;
    lines.style.transform = `translateY(${-y}px)`;
    if (!popup.hidden) placePopup();
  };
  ta.addEventListener('scroll', syncScroll);
  ta.value = value;

  /** Insere texto no lugar de [from, to] mantendo o desfazer nativo do campo. */
  let quiet = false;
  const insert = (text, from = ta.selectionStart, to = ta.selectionEnd) => {
    quiet = true;
    ta.setSelectionRange(from, to);
    if (!document.execCommand?.('insertText', false, text)) {
      ta.setRangeText(text, from, to, 'end');
      ta.dispatchEvent(new Event('input'));
    }
    quiet = false;
  };
  /** Insere um trecho com a marca CARET (onde o cursor fica) e recua as linhas novas como a linha atual. */
  const insertSnippet = (text, from, to) => {
    const ls = ta.value.lastIndexOf('\n', from - 1) + 1;
    const indent = /^[ \t]*/.exec(ta.value.slice(ls, from))[0];
    const body = text.replace(/\n/g, `\n${indent}`);
    const at = body.indexOf(CARET);
    const clean = body.replace(CARET, '');
    insert(clean, from, to);
    const caret = from + (at < 0 ? clean.length : at);
    ta.setSelectionRange(caret, caret);
    paintCaret();
  };

  // ------------------------------------------------------------------ autocompletar
  const closeList = () => { popup.hidden = true; items = []; range = null; ta.removeAttribute('aria-activedescendant'); };
  /** Calcula as sugestões para o cursor e mostra o popup (ou fecha, se não houver). */
  const complete = (manual = false) => {
    if (ta.selectionStart !== ta.selectionEnd) return closeList();
    const pos = ta.selectionStart;
    const ctx = { ...(context?.() || {}), manual };
    const res = isHtml ? completeHtml(ta.value, pos, ctx) : completeCss(ta.value, pos, { ...ctx, decls: language === 'decls' });
    if (!res || !res.items.length) return closeList();
    items = res.items;
    range = { from: res.from, to: res.to };
    active = 0;
    listBox.replaceChildren(...items.map((it, i) => {
      const [glyph, kindName] = KINDS[it.kind] || ['•', it.kind];
      const icon = it.color
        ? h('span.ce-ico.swatch', { title: kindName }, h('i', { style: { background: it.color } }))
        : h(`span.ce-ico.k-${it.kind}`, { title: kindName }, glyph);
      return h('div.ce-opt', { role: 'option', id: `${listBox.id}-${i}`, dataset: { i }, onmousedown: (e) => { e.preventDefault(); active = i; accept(); } },
        icon, h('span.ce-label', { html: markHits(it.label, it.hits) }), it.detail ? h('span.ce-detail', it.detail) : null);
    }));
    popup.hidden = false;
    listBox.scrollTop = 0;
    highlightActive();
    placePopup();
  };
  /** Posiciona o popup logo abaixo do cursor (ou acima, se embaixo não couber); encolhe a lista se faltar espaço. */
  const placePopup = () => {
    if (!range) return;
    const { line, col } = lineCol(range.from);
    const { lh, cw, padTop, padLeft } = measure();
    const gw = gutter.offsetWidth;
    const box = el.getBoundingClientRect();
    const x = gw + padLeft + col * cw - ta.scrollLeft - 30;
    const yLine = padTop + line * lh - ta.scrollTop;
    const below = yLine + lh + 3;
    listBox.style.maxHeight = '';
    const ph = popup.offsetHeight;
    const spaceBelow = window.innerHeight - (box.top + below) - 8;
    const spaceAbove = box.top + yLine - 12;
    const up = ph > spaceBelow && spaceAbove > spaceBelow;
    const room = up ? spaceAbove : spaceBelow;
    if (ph > room) listBox.style.maxHeight = `${Math.max(60, room - (ph - listBox.offsetHeight))}px`;
    popup.style.left = `${Math.max(gw + 4, Math.min(x, el.clientWidth - popup.offsetWidth - 8))}px`;
    popup.style.top = `${up ? yLine - 4 - popup.offsetHeight : below}px`;
    popup.classList.toggle('above', up);
  };
  const highlightActive = () => {
    [...listBox.children].forEach((c, i) => {
      c.classList.toggle('on', i === active);
      c.setAttribute('aria-selected', String(i === active));
    });
    // rola só a lista (scrollIntoView rolaria também a página)
    const opt = listBox.children[active];
    if (opt) {
      const t = opt.offsetTop - listBox.offsetTop;
      const bottom = t + opt.offsetHeight;
      if (t < listBox.scrollTop) listBox.scrollTop = t - 4;
      else if (bottom > listBox.scrollTop + listBox.clientHeight) listBox.scrollTop = bottom - listBox.clientHeight + 4;
    }
    ta.setAttribute('aria-activedescendant', `${listBox.id}-${active}`);
    const it = items[active];
    const doc = it?.doc || '';
    docBox.hidden = !doc;
    docBox.classList.toggle('code', it?.kind === 'emmet');
    docBox.textContent = doc;
  };
  const accept = () => {
    const it = items[active];
    if (!it || !range) return;
    const { from, to } = range;
    closeList();
    insertSnippet(it.insert, from, Math.max(to, ta.selectionStart));
    if (it.retrigger) complete(false);
  };

  // ------------------------------------------------------------------ comentar linha (Ctrl+/)
  const toggleComment = () => {
    const { selectionStart: s, selectionEnd: t, value: v } = ta;
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    let le = v.indexOf('\n', t > s && v[t - 1] === '\n' ? t - 1 : t);
    if (le < 0) le = v.length;
    const [open, close] = isHtml ? ['<!-- ', ' -->'] : ['/* ', ' */'];
    const block = v.slice(ls, le).split('\n');
    const filled = block.filter((l) => l.trim());
    const re = isHtml ? /^(\s*)<!--\s?(.*?)\s?-->\s*$/ : /^(\s*)\/\*\s?(.*?)\s?\*\/\s*$/;
    const all = filled.length && filled.every((l) => re.test(l));
    const next = block.map((l) => {
      if (!l.trim()) return l;
      if (all) return l.replace(re, '$1$2');
      const ind = /^\s*/.exec(l)[0];
      return `${ind}${open}${l.slice(ind.length)}${close}`;
    }).join('\n');
    insert(next, ls, le);
    if (s === t && block.length === 1) {
      // uma linha: o cursor fica no mesmo lugar do texto (andando junto com o "/* " que entrou ou saiu)
      const c = Math.min(ls + next.length, Math.max(ls, s + (all ? -open.length : open.length)));
      ta.setSelectionRange(c, c);
    } else ta.setSelectionRange(ls, ls + next.length);
    paintCaret();
  };

  // ------------------------------------------------------------------ procurar (Ctrl+F)
  let matches = [], current = -1;
  const findAll = () => {
    const q = findInput.value.toLowerCase();
    matches = [];
    if (q) {
      const v = ta.value.toLowerCase();
      for (let i = v.indexOf(q); i >= 0 && matches.length < 2000; i = v.indexOf(q, i + q.length)) matches.push(i);
    }
  };
  const paintMatches = () => {
    findAll();
    const { lh, cw, padTop, padLeft } = measure();
    const len = findInput.value.length;
    marks.replaceChildren(...matches.slice(0, 400).map((p, i) => {
      const { line, col } = lineCol(p);
      return h('i.ce-match' + (i === current ? '.on' : ''), { style: { top: `${padTop + line * lh}px`, left: `${padLeft + col * cw}px`, width: `${len * cw}px`, height: `${lh}px` } });
    }));
    findCount.textContent = !findInput.value ? '' : matches.length ? `${current + 1 > 0 ? current + 1 : 0} de ${matches.length}` : 'Nada';
    findCount.classList.toggle('none', !!findInput.value && !matches.length);
  };
  /** Rola o campo para a posição ficar visível. */
  const reveal = (pos) => {
    const { line, col } = lineCol(pos);
    const { lh, cw } = measure();
    const top = line * lh;
    if (top < ta.scrollTop || top > ta.scrollTop + ta.clientHeight - lh * 2) ta.scrollTop = Math.max(0, top - ta.clientHeight / 2);
    const left = col * cw;
    if (left < ta.scrollLeft || left > ta.scrollLeft + ta.clientWidth - 60) ta.scrollLeft = Math.max(0, left - ta.clientWidth / 2);
  };
  const findStep = (dir) => {
    findAll();
    if (!matches.length) { current = -1; paintMatches(); return; }
    const from = ta.selectionStart + (dir > 0 && current >= 0 ? 1 : 0);
    if (dir > 0) { const i = matches.findIndex((p) => p >= from); current = i < 0 ? 0 : i; }
    else { let i = -1; matches.forEach((p, k) => { if (p < ta.selectionStart) i = k; }); current = i < 0 ? matches.length - 1 : i; }
    const p = matches[current];
    ta.setSelectionRange(p, p + findInput.value.length);
    reveal(p);
    paintCaret();
    paintMatches();
    syncScroll();
  };
  const openFind = () => {
    const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
    if (sel && !sel.includes('\n')) findInput.value = sel;
    findBar.hidden = false;
    current = -1;
    findInput.focus();
    findInput.select();
    paintMatches();
  };
  const closeFind = (focusEditor) => {
    findBar.hidden = true;
    marks.replaceChildren();
    if (focusEditor) ta.focus();
  };
  // ao digitar a busca, procura a partir do começo da seleção atual
  findInput.addEventListener('input', () => { current = -1; ta.setSelectionRange(ta.selectionStart, ta.selectionStart); findStep(1); });
  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(true); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); findInput.select(); }
    e.stopPropagation();
  });

  // ------------------------------------------------------------------ eventos do campo
  ta.addEventListener('input', (e) => {
    paint();
    onInput?.(ta.value);
    if (quiet) return;
    // digitou uma letra/símbolo: sugere; apagou: só atualiza a lista se ela já estava aberta
    if (e.inputType === 'insertText' && e.data && e.data.length === 1) complete(false);
    else if (e.inputType?.startsWith('delete') && !popup.hidden) complete(false);
    else closeList();
  });
  ta.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== ta) closeList(); }, 150));
  ta.addEventListener('mousedown', closeList);
  for (const ev of ['click', 'keyup', 'select', 'focus']) ta.addEventListener(ev, paintCaret);

  ta.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const { selectionStart: s, selectionEnd: t, value: v } = ta;
    // ---- popup aberto: navegação
    if (!popup.hidden && items.length) {
      const page = 8;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; highlightActive(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; highlightActive(); return; }
      if (e.key === 'PageDown') { e.preventDefault(); active = Math.min(items.length - 1, active + page); highlightActive(); return; }
      if (e.key === 'PageUp') { e.preventDefault(); active = Math.max(0, active - page); highlightActive(); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && !mod)) {
        // Enter com a palavra JÁ completa (ex.: "red" e a sugestão é "red"): só pula a linha
        const word = v.slice(range.from, s);
        if (e.key === 'Enter' && items[active].insert.replace(/[;\u0001]/g, '') === word) closeList();
        else { e.preventDefault(); accept(); return; }
      }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeList(); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') closeList();
    }
    if (mod && (e.key === 'Enter' || e.key.toLowerCase() === 's') && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); closeList(); onApply?.(); return; }
    if (mod && (e.key === ' ' || e.code === 'Space')) { e.preventDefault(); complete(true); return; }
    if (mod && (e.key === '/' || e.code === 'Slash')) { e.preventDefault(); toggleComment(); return; }
    if (mod && e.key.toLowerCase() === 'f' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); openFind(); return; }
    if (e.key === 'Escape' && !findBar.hidden) { e.preventDefault(); e.stopPropagation(); closeFind(true); return; }
    if (mod || e.altKey) return;

    // ---- Tab: Emmet (HTML) ou recuo
    if (e.key === 'Tab') {
      e.preventDefault();
      if (s === t && !e.shiftKey && isHtml) {
        const lineBefore = v.slice(v.lastIndexOf('\n', s - 1) + 1, s);
        const abbr = emmetAbbrBefore(lineBefore);
        const inTag = v.lastIndexOf('<', s - 1) > v.lastIndexOf('>', s - 1);
        const exp = abbr && !inTag ? expandEmmet(abbr) : '';
        if (exp) { insertSnippet(exp, s - abbr.length, s); return; }
      }
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      if (s === t && !e.shiftKey) { insert('  '); return; }
      // várias linhas (ou Shift+Tab): (des)indenta todas
      const le = v.indexOf('\n', t - (t > s && v[t - 1] === '\n' ? 1 : 0));
      const end = le < 0 ? v.length : le;
      const block = v.slice(ls, end);
      const next = e.shiftKey ? block.replace(/^ {1,2}/gm, '') : block.replace(/^/gm, '  ');
      insert(next, ls, end);
      if (s === t) { const c = Math.max(ls, s + (next.length - block.length)); ta.setSelectionRange(c, c); }
      else ta.setSelectionRange(ls, ls + next.length);
      return;
    }
    // ---- Enter: mantém o recuo; entre { } ou <a></a> abre o bloco
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const line = v.slice(v.lastIndexOf('\n', s - 1) + 1, s);
      let ind = /^\s*/.exec(line)[0];
      const prev = line.trimEnd().slice(-1);
      const htmlOpen = isHtml && /<([a-z][\w-]*)[^>]*>\s*$/i.test(line) && !/<\/[^>]+>\s*$/.test(line) && !/\/>\s*$/.test(line) && !VOID_TAGS.has((/<([a-z][\w-]*)[^<]*>\s*$/i.exec(line) || [])[1]?.toLowerCase());
      const opens = prev === '{' || prev === '(' || prev === '[' || htmlOpen;
      const nextChars = v.slice(t, t + 40);
      const closesNext = (prev === '{' && /^\s*\}/.test(nextChars)) || (prev === '(' && /^\s*\)/.test(nextChars)) || (prev === '[' && /^\s*\]/.test(nextChars)) || (htmlOpen && /^\s*<\//.test(nextChars));
      if (closesNext) {
        const ws = /^\s*/.exec(nextChars)[0].length;
        insertSnippet(`\n${ind}  ${CARET}\n${ind}`, s, t + ws);
        return;
      }
      if (opens) ind += '  ';
      insert(`\n${ind}`, s, t);
      return;
    }
    // ---- fechar pares e "pular" o fechamento já digitado
    if (CLOSERS.has(e.key) && s === t && v[s] === e.key) {
      e.preventDefault();
      ta.setSelectionRange(s + 1, s + 1);
      paintCaret();
      return;
    }
    if (e.key === '}' && !isHtml) {
      // fecha o bloco alinhado com a linha que abriu
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      if (s === t && /^\s+$/.test(v.slice(ls, s))) { e.preventDefault(); insert(`${v.slice(ls, s).slice(2)}}`, ls, s); return; }
    }
    if (PAIRS[e.key]) {
      const close = PAIRS[e.key];
      const isQuote = e.key === '"' || e.key === "'";
      if (s !== t) { e.preventDefault(); const sel = v.slice(s, t); insert(`${e.key}${sel}${close}`, s, t); ta.setSelectionRange(s + 1, t + 1); return; }
      const nextCh = v[s] || '';
      const prevCh = v[s - 1] || '';
      // só fecha se o que vem depois é espaço/fim/fechamento (e, nas aspas, se não é o meio de uma palavra)
      if (!/^$|[\s)\]};,>]/.test(nextCh)) return;
      if (isQuote && /[\w"'\\]/.test(prevCh)) return;
      if (isQuote && isHtml && !inHtmlTag(v, s)) return; // texto do HTML: apóstrofo de verdade
      e.preventDefault();
      insert(`${e.key}${close}`, s, t);
      ta.setSelectionRange(s + 1, s + 1);
      if (e.key === '(' || isQuote) complete(false);
      paintCaret();
      return;
    }
    // ---- Backspace entre um par vazio apaga os dois
    if (e.key === 'Backspace' && s === t && s > 0 && PAIRS[v[s - 1]] && v[s] === PAIRS[v[s - 1]]) {
      e.preventDefault();
      insert('', s - 1, s + 1);
      if (!popup.hidden) complete(false);
      return;
    }
    // ---- HTML: ">" fecha a etiqueta aberta (<div class="x"> → <div class="x">|</div>)
    if (isHtml && e.key === '>' && s === t) {
      const before = v.slice(0, s);
      const m = /<([a-zA-Z][\w-]*)(?:\s(?:[^<>"']|"[^"]*"|'[^']*')*)?$/.exec(before);
      if (m && !before.endsWith('/') && !VOID_TAGS.has(m[1].toLowerCase()) && !v.slice(s).startsWith(`</${m[1]}>`)) {
        e.preventDefault();
        insertSnippet(`>${CARET}</${m[1]}>`, s, t);
        closeList();
      }
    }
  });

  paint();
  return {
    el, textarea: ta,
    getValue: () => ta.value,
    setValue: (v) => { if (ta.value !== v) { ta.value = v; closeList(); paint(); } },
    setDiagnostics: (list2) => { diags = list2 || []; paint(); },
    focus: () => ta.focus(),
    complete: (manual = true) => { ta.focus(); complete(manual); },
    openFind,
    /** Mede de novo (depois de mudar a fonte/tamanho do editor). */
    refresh: () => { metrics = null; paint(); },
  };
}

/** O cursor está dentro de uma etiqueta (<a href="…">)? Usado para decidir se aspas fecham sozinhas no HTML. */
function inHtmlTag(v, pos) {
  return v.lastIndexOf('<', pos - 1) > v.lastIndexOf('>', pos - 1);
}

/** Rótulo com as letras que combinaram com a busca em negrito. */
function markHits(label, hits = []) {
  if (!hits?.length) return esc(label);
  const set = new Set(hits);
  let out = '';
  for (let i = 0; i < label.length; i++) out += set.has(i) ? `<b>${esc(label[i])}</b>` : esc(label[i]);
  return out.replace(/<\/b><b>/g, '');
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
