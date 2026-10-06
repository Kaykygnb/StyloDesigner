// Helpers mínimos de DOM e componentes de formulário (campo numérico com "scrub", cor, select, segmentado).
import { icon } from './icons.js';
import { rgba, hexToRgb } from '../css.js';

/** h('div.classe#id', { onclick, dataset }, ...filhos) */
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

export const ico = (name, size = 16) => h('span.ico', { html: icon(name, size) });

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Campo numérico. Arraste o rótulo para ajustar (como no Figma), ↑/↓ mudam o valor (Shift = ×10).
 * onInput: durante a edição (sem histórico); onCommit: ao terminar (cria entrada no histórico).
 */
export function numField({ label, title, get, set, commit, min = -Infinity, max = Infinity, step = 1, decimals = 2, unit = '', width, disabled = false }) {
  const input = h('input.num', { type: 'text', inputMode: 'decimal', spellcheck: false });
  const lab = h('span.num-label', { title: title || '' }, label);
  if (disabled) input.disabled = true;
  const wrap = h('label.field.num-field' + (disabled ? '.off' : ''), { style: width ? { width } : null }, lab, input);

  const fmt = (v) => (v == null || Number.isNaN(v) ? '' : `${+Number(v).toFixed(decimals)}${unit}`);
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

  const refresh = () => {
    if (document.activeElement !== input) input.value = fmt(get());
  };

  const apply = (v, final) => {
    if (!Number.isFinite(v)) return refresh();
    set(clamp(v, min, max));
    if (final) commit?.();
    input.value = fmt(get());
  };

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

  // arrastar o rótulo ajusta o valor
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

/** Campo de texto simples. */
export function textField({ get, set, commit, placeholder = '', mono = false }) {
  const input = h('input.text' + (mono ? '.mono' : ''), { type: 'text', spellcheck: false, placeholder });
  input.addEventListener('input', () => set(input.value));
  input.addEventListener('change', () => commit?.());
  input.addEventListener('keydown', (e) => e.key === 'Enter' && input.blur());
  return { el: input, update: () => document.activeElement !== input && (input.value = get() ?? ''), input };
}

/** <select> estilizado. options: [[valor, rótulo], ...] */
export function selectField({ options, get, set, commit, title }) {
  const sel = h('select.select', { title: title || '' },
    options.map(([v, l]) => h('option', { value: v }, l)));
  sel.addEventListener('change', () => { set(sel.value); commit?.(); });
  return { el: h('label.field.select-wrap', sel, ico('chevron', 12)), update: () => { sel.value = String(get()); }, input: sel };
}

/** Grupo de botões segmentados com ícones. options: [[valor, ícone, título], ...] */
export function segmented({ options, get, set, commit }) {
  const btns = options.map(([v, i, title]) =>
    h('button.seg-btn', { type: 'button', title, dataset: { v }, onclick: () => { set(v); commit?.(); } }, ico(i, 16)));
  const el = h('div.segmented', btns);
  return { el, update: () => btns.forEach((b) => b.classList.toggle('on', String(get()) === b.dataset.v)) };
}

export function iconButton(name, title, onclick, cls = '') {
  return h('button.icon-btn' + (cls ? '.' + cls : ''), { type: 'button', title, onclick }, ico(name));
}

/** Seletor de cor: amostra (input color nativo) + hex + opacidade. */
export function colorRow({ get, set, commit, opacity, setOpacity }) {
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

  function sync() {
    const c = get();
    picker.value = c.toLowerCase();
    swatch.firstChild.style.background = rgba(c, opacity ? opacity() : 1);
    if (document.activeElement !== hex) hex.value = c.replace('#', '').toUpperCase();
  }
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
