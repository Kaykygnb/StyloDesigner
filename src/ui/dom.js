/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/dom.js — CRIAR ELEMENTOS + COMPONENTES DE FORMULÁRIO
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  O app não usa framework: a interface é feita com `h()` (criar elementos) e alguns componentes
 *  reutilizáveis (campo numérico com arrastar-para-ajustar, cor, lista suspensa, botões segmentados).
 *  Todo componente de formulário devolve { el, update }: `el` é o elemento e `update()` relê o valor do
 *  documento — é assim que o painel de propriedades se mantém em dia sem recriar tudo a cada mudança.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { icon } from './icons.js';
import { rgba, hexToRgb } from '../css.js';

/**
 * `h` = "hyperscript": cria elementos DOM com uma sintaxe curta (substitui um framework como React para este app).
 *
 *   h('button.btn.primary', { type: 'button', onclick: fazer }, ico('play'), ' Texto')
 *
 *  - 1º argumento: "tag.classe1.classe2" (sem tag = div)
 *  - 2º argumento (opcional): atributos. Chaves "onXxx" viram ouvintes de evento; `html` define innerHTML; `style` aceita
 *    objeto; `dataset` define data-*; o resto vira propriedade do elemento (ou atributo).
 *  - demais argumentos: filhos (elementos, textos ou listas aninhadas; null/false são ignorados)
 * Se o 2º argumento já for um filho (elemento/texto/lista), é tratado como filho.
 */
export function h(tag, attrs, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Ícone SVG pronto para usar como filho: ico('trash', 14). Os desenhos estão em icons.js. */
export const ico = (name, size = 16) => h('span.ico', { html: icon(name, size), 'aria-hidden': 'true' });

/** Limita `v` ao intervalo [min, max]. */
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * CAMPO NUMÉRICO no estilo Figma:
 *  - digite um valor ou uma CONTA simples ("100/2", "24+8" — só dígitos e + - * / ( ) são aceitos)
 *  - ↑/↓ mudam 1 (Shift = 10) · Enter confirma · Esc cancela
 *  - ARRASTAR o rótulo (a letra à esquerda) ajusta o valor: Shift = ×10, Alt = ×0.1
 *
 * Quando o valor muda (`set`) ele NÃO entra no histórico (é "ao vivo"); só ao terminar (Enter, sair do campo ou soltar
 * o arrasto) chama `commit` — assim um Ctrl+Z desfaz a edição inteira.
 *
 * @param {object} o
 * @param {string} o.label  letra/símbolo à esquerda (também serve de "alça" de arrasto)
 * @param {string} [o.title]  dica ao passar o mouse (costuma ser a propriedade CSS)
 * @param {() => number} o.get  lê o valor atual
 * @param {(v:number) => void} o.set  aplica um valor (sem histórico)
 * @param {() => void} [o.commit]  fecha a edição (histórico)
 * @param {number} [o.min] [o.max] [o.step] [o.decimals] [o.unit] [o.width] [o.disabled]
 * @param {boolean} [o.nullable]  true: campo vazio = sem valor (`set(null)`); `get` pode devolver null
 * @param {string} [o.placeholder]  texto cinza quando vazio (ex.: "sem limite")
 * @returns {{el: HTMLElement, update: () => void, input: HTMLInputElement}} `update` relê o valor sem atrapalhar quem está digitando
 */
export function numField({ label, title, get, set, commit, min = -Infinity, max = Infinity, step = 1, decimals = 2, unit = '', width, disabled = false, nullable = false, placeholder = '' }) {
  // campo de texto (não type=number: queremos aceitar contas e vírgula)
  const input = h('input.num', { type: 'text', inputMode: 'decimal', spellcheck: false });
  if (placeholder) input.placeholder = placeholder; // ex.: "sem limite" quando o campo está vazio (nullable)
  const lab = h('span.num-label', { title: title || '' }, label);
  if (disabled) input.disabled = true;
  const wrap = h('label.field.num-field' + (disabled ? '.off' : ''), { style: width ? { width } : null }, lab, input);

  /** Número → texto no campo (arredondado às casas decimais, com unidade). */
  const fmt = (v) => (v == null || Number.isNaN(v) ? '' : `${+Number(v).toFixed(decimals)}${unit}`);
  /**
   * Texto → número. Aceita vírgula decimal e contas. Segurança: só passa para Function() se o texto tiver APENAS
   * dígitos e operadores (regex abaixo), então nenhum código arbitrário consegue ser executado.
   */
  const parse = (txt) => {
    const clean = String(txt).replace(',', '.').replace(unit, '').trim();
    if (!/^[-+*/().\d\s]+$/.test(clean)) return NaN;
    try {
      // aceita contas simples: 100/2, 24+8
      return clean ? Function(`"use strict";return (${clean})`)() : NaN;
    } catch {
      return NaN;
    }
  };

  // não sobrescreve o campo enquanto o usuário está digitando nele
  const refresh = () => {
    if (document.activeElement !== input) input.value = fmt(get());
  };

  // aplica o valor (respeitando min/max); `final` = terminou a edição → grava no histórico
  const apply = (v, final) => {
    if (!Number.isFinite(v)) return refresh();
    set(clamp(v, min, max));
    if (final) commit?.();
    input.value = fmt(get());
  };

  // ao focar, seleciona tudo (digitar já substitui)
  input.addEventListener('focus', () => input.select());
  input.addEventListener('change', () => {
    // campo "anulável" (ex.: largura máxima): apagar o texto REMOVE o valor (set(null)) em vez de ser ignorado
    if (nullable && input.value.trim() === '') { set(null); commit?.(); input.value = fmt(get()); return; }
    apply(parse(input.value), true);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = fmt(get()); input.blur(); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const dir = e.key === 'ArrowUp' ? 1 : -1;
      apply((Number(get()) || 0) + dir * step * (e.shiftKey ? 10 : 1), true);
      input.select();
    }
  });

  // ARRASTAR O RÓTULO: o deslocamento horizontal do mouse vira variação do valor. Um clique sem arrastar só foca o campo.
  lab.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    lab.setPointerCapture(e.pointerId);
    const x0 = e.clientX, v0 = Number(get()) || 0;
    let moved = false;
    const move = (ev) => {
      const dx = ev.clientX - x0;
      if (!moved && Math.abs(dx) < 2) return;
      moved = true;
      document.body.classList.add('scrubbing');
      apply(v0 + dx * step * (ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1), false);
    };
    const up = () => {
      lab.removeEventListener('pointermove', move);
      lab.removeEventListener('pointerup', up);
      document.body.classList.remove('scrubbing');
      if (moved) commit?.();
      else input.focus();
    };
    lab.addEventListener('pointermove', move);
    lab.addEventListener('pointerup', up);
  });

  return { el: wrap, update: refresh, input };
}

/** Campo de texto simples (usado para nomes e links). Mesma ideia: `set` ao digitar, `commit` ao terminar. */
export function textField({ get, set, commit, placeholder = '', mono = false }) {
  const input = h('input.text' + (mono ? '.mono' : ''), { type: 'text', spellcheck: false, placeholder });
  input.addEventListener('input', () => set(input.value));
  input.addEventListener('change', () => commit?.());
  input.addEventListener('keydown', (e) => e.key === 'Enter' && input.blur());
  return { el: input, update: () => document.activeElement !== input && (input.value = get() ?? ''), input };
}

/** Lista suspensa estilizada. `options`: [[valor, rótulo], ...]. Ao escolher, aplica e já grava no histórico. */
export function selectField({ options, get, set, commit, title, label }) {
  const sel = h('select.select', { title: title || '' },
    options.map(([v, l]) => h('option', { value: v }, l)));
  sel.addEventListener('change', () => { set(sel.value); commit?.(); });
  // `label` opcional: rótulo curto à esquerda, dentro do campo (ex.: "W" no modo de largura), como nos campos numéricos
  const lab = label ? h('span.sel-label', { title: title || '' }, label) : null;
  return { el: h('label.field.select-wrap' + (label ? '.labeled' : ''), lab, sel, ico('chevron', 12)), update: () => { sel.value = String(get()); }, input: sel };
}

/** Grupo de botões de ícone onde um fica "ligado" (ex.: alinhamento de texto). `options`: [[valor, ícone, dica], ...]. */
export function segmented({ options, get, set, commit }) {
  const btns = options.map(([v, i, title]) =>
    h('button.seg-btn', { type: 'button', title, dataset: { v }, onclick: () => { set(v); commit?.(); } }, ico(i, 16)));
  const el = h('div.segmented', btns);
  return { el, update: () => btns.forEach((b) => b.classList.toggle('on', String(get()) === b.dataset.v)) };
}

// ---------------------------------------------------------------- dicas ricas (título + CSS + explicação)
// Dica flutuante nossa para os controles do painel: título curto, o CSS de verdade que o controle gera (colorido, em
// fonte mono) e uma frase explicando. Substitui o `title=""` nativo (feio, lento e sem formatação). `tip()` só guarda
// dados em `data-tip-*`; UM ouvinte global (instalado na 1ª chamada) mostra e esconde. Por isso é barato chamar `tip`
// de novo toda vez que o painel é redesenhado.

/** Quanto o mouse precisa ficar parado em cima antes da dica aparecer (ms): evita piscar ao atravessar o painel. */
const TIP_DELAY = 320;
let tipBox = null; // o elemento flutuante (criado na 1ª vez)
let tipTimer = 0;
let tipCurrent = null; // elemento com a dica aberta (ou agendada)
let tipInstalled = false;

/** Esconde a dica e cancela a que estava agendada. */
function hideTip() {
  clearTimeout(tipTimer);
  tipCurrent = null;
  tipBox?.classList.remove('show');
}

/** Mostra a dica ao lado do elemento: à esquerda (o painel fica à direita da tela) ou, sem espaço, à direita/embaixo. */
function showTip(target) {
  if (!target.isConnected) return;
  if (!tipBox) { tipBox = h('div.rich-tip', { role: 'tooltip' }); document.body.append(tipBox); }
  const d = target.dataset;
  const parts = [];
  if (d.tipTitle) parts.push(h('div.tip-title', d.tipTitle));
  if (d.tipCss) {
    // cada linha "prop: valor;" vira "prop" colorida + valor, como num editor de código
    parts.push(h('div.tip-code', d.tipCss.split('\n').map((line) => {
      const i = line.indexOf(':');
      return i < 0 ? h('div', line) : h('div', h('span.tip-prop', line.slice(0, i)), ':', h('span.tip-val', line.slice(i + 1)));
    })));
  }
  if (d.tipText) parts.push(h('div.tip-text', d.tipText));
  tipBox.replaceChildren(...parts);
  tipBox.style.left = '0px';
  tipBox.style.top = '0px';
  tipBox.classList.add('show');
  const r = target.getBoundingClientRect();
  const w = tipBox.offsetWidth, hh = tipBox.offsetHeight, gap = 12, m = 8;
  let x = r.left - w - gap;
  let below = false;
  if (x < m) x = r.right + gap; // sem espaço à esquerda: tenta à direita
  if (x + w > innerWidth - m) { x = Math.max(m, Math.min(r.left, innerWidth - w - m)); below = true; } // nenhum: embaixo
  let y = below ? r.bottom + gap : r.top + r.height / 2 - hh / 2;
  y = Math.max(m, Math.min(y, innerHeight - hh - m));
  tipBox.style.left = `${Math.round(x)}px`;
  tipBox.style.top = `${Math.round(y)}px`;
}

/** Liga os ouvintes globais das dicas (uma única vez). */
function installTips() {
  if (tipInstalled) return;
  tipInstalled = true;
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest?.('[data-tip-title]');
    if (t === tipCurrent) return;
    hideTip();
    if (!t) return;
    tipCurrent = t;
    tipTimer = setTimeout(() => showTip(t), TIP_DELAY);
  });
  // saiu de cima do elemento (e não foi para um filho dele): some
  document.addEventListener('mouseout', (e) => { if (tipCurrent && !tipCurrent.contains(e.relatedTarget)) hideTip(); });
  // qualquer interação fecha a dica (clicar, digitar, rolar)
  document.addEventListener('pointerdown', hideTip, true);
  document.addEventListener('keydown', hideTip, true);
  document.addEventListener('scroll', hideTip, true);
}

/**
 * Liga uma dica rica a um elemento. Remove o `title` nativo dele e dos filhos (senão as duas dicas apareceriam).
 * @param {HTMLElement} el  o elemento que mostra a dica ao passar o mouse
 * @param {{title: string, css?: string, text?: string}} doc  título, CSS (uma declaração por linha) e explicação
 * @returns {HTMLElement} o próprio `el` (para usar inline)
 */
export function tip(el, { title, css = '', text = '' }) {
  installTips();
  el.removeAttribute('title');
  el.querySelectorAll('[title]').forEach((c) => c.removeAttribute('title'));
  el.dataset.tipTitle = title;
  if (css) el.dataset.tipCss = css; else delete el.dataset.tipCss;
  if (text) el.dataset.tipText = text; else delete el.dataset.tipText;
  return el;
}

/** Botão só com ícone. `cls` opcional ('small', 'on'...). */
export function iconButton(name, title, onclick, cls = '') {
  // aria-label: botão só com ícone não tem texto; sem isso o leitor de tela diria apenas "botão"
  return h('button.icon-btn' + (cls ? '.' + cls : ''), { type: 'button', title, 'aria-label': title.replace(/\s*\(.*\)$/, ''), onclick }, ico(name));
}

// ---------------------------------------------------------------- seletor de cor (popover próprio)
/** Paletas prontas que aparecem no seletor de cor, em grupos. */
const PALETTES = [
  ['Neutros', ['#000000', '#1A1A24', '#3D3D4E', '#6B6B80', '#9A9AAE', '#C8C8D6', '#E6E6EE', '#FFFFFF']],
  ['Vivas', ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#00C7BE', '#0A84FF', '#7C5CFF', '#FF2D92']],
  ['Suaves', ['#FFD6D6', '#FFE5C2', '#FFF4B8', '#D3F5DC', '#CBF1EE', '#CFE4FF', '#E0D8FF', '#FFD3EA']],
];
/** {r,g,b} (0–255) → "#RRGGBB". */
const toHex = ({ r, g, b }) => '#' + [r, g, b].map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')).join('').toUpperCase();
/** {r,g,b} (0–255) → {h: 0–360, s: 0–1, v: 0–1}. */
function rgb2hsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let hh = 0;
  if (d) {
    if (max === r) hh = ((g - b) / d) % 6; else if (max === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4;
    hh *= 60;
    if (hh < 0) hh += 360;
  }
  return { h: hh, s: max ? d / max : 0, v: max };
}
/** {h,s,v} → {r,g,b} (0–255). */
function hsv2rgb({ h: hh, s, v }) {
  const c = v * s, x = c * (1 - Math.abs(((hh / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0]; else if (hh < 120) [r, g, b] = [x, c, 0]; else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c]; else if (hh < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

let cpOpen = null; // seletor aberto agora ({ anchor, close })
/** Fecha o seletor de cor aberto, se houver. */
export function closeColorPicker() { cpOpen?.close(); }

/**
 * Abre o SELETOR DE COR: um popover com a área saturação/brilho, a barra de matiz, o campo HEX, o conta-gotas e
 * grupos de cores (as do projeto, os estilos de cor e paletas prontas). Aplica ao vivo (`set`) e grava o histórico
 * (`commit`) ao soltar. Fecha ao clicar fora, com Esc ou quando o campo que o abriu some do painel.
 * @param {{anchor: HTMLElement, get: () => string, set: (hex: string) => void, commit?: () => void, groups?: () => {title: string, colors: string[]}[]}} o
 */
function openColorPicker({ anchor, get, set, commit, groups }) {
  closeColorPicker();
  let hsv = rgb2hsv(hexToRgb(get()));
  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  const svKnob = h('div.cp-knob'), hueKnob = h('div.cp-knob');
  const sv = h('div.cp-sv', svKnob);
  const hue = h('div.cp-hue', hueKnob);
  const prev = h('div.cp-prev');
  const hex = h('input.text.mono', { type: 'text', spellcheck: false, maxLength: 7, 'aria-label': 'Cor em hexadecimal' });
  const chipBox = h('div.cp-groups');

  /** Redesenha knobs, fundo da área e campo hex a partir do HSV. */
  const paint = () => {
    const base = toHex(hsv2rgb({ h: hsv.h, s: 1, v: 1 }));
    sv.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${base})`;
    svKnob.style.left = `${hsv.s * 100}%`;
    svKnob.style.top = `${(1 - hsv.v) * 100}%`;
    hueKnob.style.left = `${(hsv.h / 360) * 100}%`;
    const c = toHex(hsv2rgb(hsv));
    prev.style.background = c;
    if (document.activeElement !== hex) hex.value = c.slice(1);
    return c;
  };
  /** Aplica a cor atual do HSV ao campo (ao vivo). */
  const apply = () => set(paint());
  /** Arrasto numa área/barra: `fn(x, y)` recebe a posição relativa 0–1; grava no histórico ao soltar. */
  const drag = (el, fn) => el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const mv = (ev) => { const r = el.getBoundingClientRect(); fn(clamp01((ev.clientX - r.left) / r.width), clamp01((ev.clientY - r.top) / r.height)); };
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); commit?.(); };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
    mv(e);
  });
  drag(sv, (x, y) => { hsv.s = x; hsv.v = 1 - y; apply(); });
  drag(hue, (x) => { hsv.h = x * 360; apply(); });

  /** Escolhe uma cor pronta (chip): atualiza HSV, aplica e grava. */
  const pick = (c) => { hsv = rgb2hsv(hexToRgb(c)); apply(); commit?.(); };
  const chip = (c) => h('button.chip', { type: 'button', title: c, 'aria-label': c, style: { background: c }, onclick: () => pick(c) });
  const all = [...(groups?.() || []), ...PALETTES.map(([title, colors]) => ({ title, colors }))].filter((g) => g.colors.length);
  chipBox.append(...all.map((g) => h('div.cp-group', h('div.cp-group-title', g.title), h('div.color-chips', g.colors.map(chip)))));

  hex.addEventListener('input', () => {
    const v = '#' + hex.value.replace('#', '').trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) { hsv = rgb2hsv(hexToRgb(v)); set(toHex(hsv2rgb(hsv))); paint(); }
  });
  hex.addEventListener('change', () => commit?.());
  hex.addEventListener('keydown', (e) => e.key === 'Enter' && hex.blur());
  hex.addEventListener('focus', () => hex.select());
  const eye = globalThis.EyeDropper
    ? h('button.icon-btn.small', {
      type: 'button', title: 'Conta-gotas',
      onclick: async () => { try { const { sRGBHex } = await new globalThis.EyeDropper().open(); pick(sRGBHex.toUpperCase()); } catch { /* cancelado */ } },
    }, ico('eyedropper', 14))
    : null;

  const pop = h('div.cp', { role: 'dialog', 'aria-label': 'Seletor de cor' }, sv, hue,
    h('div.cp-row', prev, h('span.hash', '#'), hex, eye), chipBox);
  document.body.append(pop);
  paint();
  // posição: ao lado do campo (à esquerda, pois o painel fica à direita), sempre dentro da janela
  const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, hh = pop.offsetHeight;
  let x = r.left - w - 12;
  if (x < 8) x = Math.min(innerWidth - w - 8, r.right + 12);
  pop.style.left = `${Math.max(8, x)}px`;
  pop.style.top = `${Math.max(8, Math.min(r.top - 8, innerHeight - hh - 8))}px`;

  const off = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) close(); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  // se o campo que abriu sumiu (o painel foi redesenhado para outra camada), fecha
  const watch = setInterval(() => { if (!anchor.isConnected) close(); }, 250);
  function close() {
    clearInterval(watch);
    window.removeEventListener('pointerdown', off, true);
    window.removeEventListener('keydown', esc, true);
    pop.remove();
    if (cpOpen?.pop === pop) cpOpen = null;
  }
  window.addEventListener('pointerdown', off, true);
  window.addEventListener('keydown', esc, true);
  cpOpen = { anchor, pop, close };
}

/**
 * Linha de COR: amostra clicável (abre o seletor de cor próprio, com grupos de cores) + campo HEX + (opcional)
 * opacidade em % + conta-gotas (onde o navegador oferece `EyeDropper`). Aceita hex de 3 ou 6 dígitos, com ou sem "#".
 * `groups` (opcional): função que devolve grupos extras de cores para o seletor ([{title, colors}]).
 */
export function colorRow({ get, set, commit, opacity, setOpacity, groups }) {
  const swatch = h('button.swatch', { type: 'button', title: 'Escolher cor', 'aria-label': 'Escolher cor' }, h('div.swatch-fill'));
  swatch.addEventListener('click', () => {
    if (cpOpen?.anchor === swatch) { closeColorPicker(); return; }
    openColorPicker({ anchor: swatch, get, set: (v) => { set(v); sync(); }, commit, groups });
  });
  const hex = h('input.text.mono.hex', { type: 'text', spellcheck: false, maxLength: 7 });
  const op = opacity
    ? numField({ label: '%', get: () => Math.round(opacity() * 100), set: (v) => setOpacity(v / 100), commit, min: 0, max: 100, decimals: 0, width: '62px' })
    : null;

  hex.addEventListener('change', () => {
    let v = hex.value.trim();
    if (!v.startsWith('#')) v = '#' + v;
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) {
      const { r, g, b } = hexToRgb(v);
      set('#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase());
      commit?.();
    }
    sync();
  });
  hex.addEventListener('keydown', (e) => e.key === 'Enter' && hex.blur());
  hex.addEventListener('focus', () => hex.select());

  /** Atualiza amostra, seletor e campo hex a partir do valor atual (sem mexer no hex enquanto digitam). */
  function sync() {
    const c = get() || '#000000'; // cor ausente (documento antigo/estranho): mostra preto em vez de quebrar
    swatch.firstChild.style.background = rgba(c, opacity ? opacity() : 1);
    if (document.activeElement !== hex) hex.value = c.replace('#', '').toUpperCase();
  }
  // conta-gotas: só existe em navegadores que suportam a API EyeDropper
  const eye = globalThis.EyeDropper
    ? h('button.icon-btn.small', {
      type: 'button', title: 'Conta-gotas',
      onclick: async () => {
        try {
          const { sRGBHex } = await new globalThis.EyeDropper().open();
          set(sRGBHex.toUpperCase());
          commit?.();
          sync();
        } catch { /* cancelado */ }
      },
    }, ico('eyedropper', 14))
    : null;
  const el = h('div.color-row', swatch, h('span.hash', '#'), hex, eye, op?.el);
  hex.value = '';
  return { el, update: () => { sync(); op?.update(); } };
}
