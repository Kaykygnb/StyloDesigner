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
 * @returns {{el: HTMLElement, update: () => void, input: HTMLInputElement}} `update` relê o valor sem atrapalhar quem está digitando
 */
export function numField({ label, title, get, set, commit, min = -Infinity, max = Infinity, step = 1, decimals = 2, unit = '', width, disabled = false }) {
  // campo de texto (não type=number: queremos aceitar contas e vírgula)
  const input = h('input.num', { type: 'text', inputMode: 'decimal', spellcheck: false });
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
  input.addEventListener('change', () => apply(parse(input.value), true));
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

/** Botão só com ícone. `cls` opcional ('small', 'on'...). */
export function iconButton(name, title, onclick, cls = '') {
  // aria-label: botão só com ícone não tem texto; sem isso o leitor de tela diria apenas "botão"
  return h('button.icon-btn' + (cls ? '.' + cls : ''), { type: 'button', title, 'aria-label': title.replace(/\s*\(.*\)$/, ''), onclick }, ico(name));
}

/**
 * Linha de COR: amostra clicável (abre o seletor de cor do sistema) + campo HEX + (opcional) opacidade em % +
 * conta-gotas (onde o navegador oferece `EyeDropper`, ex.: Chrome/Edge). Aceita hex de 3 ou 6 dígitos, com ou sem "#".
 */
export function colorRow({ get, set, commit, opacity, setOpacity }) {
  // o input type=color do navegador fica invisível por cima da amostra: clicar na amostra abre o seletor nativo
  const picker = h('input.color-native', { type: 'color' });
  const swatch = h('div.swatch', h('div.swatch-fill'), picker);
  const hex = h('input.text.mono.hex', { type: 'text', spellcheck: false, maxLength: 7 });
  const op = opacity
    ? numField({ label: '%', get: () => Math.round(opacity() * 100), set: (v) => setOpacity(v / 100), commit, min: 0, max: 100, decimals: 0, width: '62px' })
    : null;

  picker.addEventListener('input', () => { set(picker.value.toUpperCase()); sync(); });
  picker.addEventListener('change', () => commit?.());
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
    const c = get();
    picker.value = c.toLowerCase();
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
