/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/colorpicker.js — SELETOR DE COR (popover) com gerenciador de paletas
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Abre ao clicar numa amostra de cor do painel. De cima para baixo:
 *    1. área saturação/brilho + barra de matiz (+ barra de opacidade quando o campo tem opacidade);
 *    2. a cor atual (ao lado da original) com campos HEX · RGB · HSL e conta-gotas;
 *    3. contraste da cor sobre branco e sobre preto (WCAG), para saber se o texto fica legível;
 *    4. SUGESTÕES de harmonia (complementar, análogas, tríade, tons): um clique escolhe, outro guarda na paleta;
 *    5. PALETAS PRÓPRIAS, gerenciáveis aqui mesmo: abas, nova paleta, renomear, guardar a cor atual, tirar cor,
 *       duplicar, copiar como variáveis CSS e excluir;
 *    6. cores recentes, as do projeto, estilos de cor e paletas prontas.
 *  Aplica ao vivo (`set`) e grava o histórico (`commit`) ao soltar. Fecha ao clicar fora, com Esc ou quando o campo
 *  que o abriu some do painel.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico, tip } from './dom.js';
import { showMenu } from './menus.js';
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, rgbToHsl, hslToRgb, harmonies, contrast, wcagLevel } from '../color.js';
import {
  getPalettes, onPalettes, changePalette, createPalette, deletePalette, addColor, removeColor, getActiveId, setActiveId,
  getRecents, pushRecent, paletteCss, normalizeHex,
} from '../palettes.js';

/** Paletas prontas (de fábrica). */
const BUILTIN = [
  ['Neutros', ['#000000', '#1A1A24', '#3D3D4E', '#6B6B80', '#9A9AAE', '#C8C8D6', '#E6E6EE', '#FFFFFF']],
  ['Vivas', ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#00C7BE', '#0A84FF', '#7C5CFF', '#FF2D92']],
  ['Suaves', ['#FFD6D6', '#FFE5C2', '#FFF4B8', '#D3F5DC', '#CBF1EE', '#CFE4FF', '#E0D8FF', '#FFD3EA']],
];

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const round = Math.round;

let open = null; // seletor aberto agora ({ anchor, pop, close })
/** Fecha o seletor de cor aberto, se houver. */
export function closeColorPicker() { open?.close(); }
/** O campo (amostra) que abriu o seletor agora, ou null. */
export const colorPickerAnchor = () => open?.anchor || null;

/**
 * Abre o seletor de cor.
 * @param {{anchor: HTMLElement, get: () => string, set: (hex: string) => void, commit?: () => void,
 *          opacity?: () => number, setOpacity?: (v: number) => void,
 *          groups?: () => {title: string, colors: string[]}[], onClose?: () => void}} o
 */
export function openColorPicker({ anchor, get, set, commit, opacity, setOpacity, groups, onClose }) {
  closeColorPicker();
  const original = (normalizeHex(get()) || '#000000');
  let hsv = rgbToHsv(hexToRgb(original));
  let alpha = opacity ? clamp01(opacity()) : 1;
  let mode = 'hex'; // 'hex' | 'rgb' | 'hsl'
  let harmony = 'complementar';
  let renamingNext = false; // a paleta recém-criada abre já no modo "renomear"
  let renaming = null; // id da paleta em renomeação
  let confirmDelete = null; // id da paleta com a confirmação de exclusão aberta

  const current = () => rgbToHex(hsvToRgb(hsv));

  // ------------------------------------------------------------ 1. área de cor e barras
  const svKnob = h('div.cp-knob'), hueKnob = h('div.cp-knob'), alphaKnob = h('div.cp-knob');
  const sv = h('div.cp-sv', { role: 'group', tabindex: 0, 'aria-label': 'Saturação e brilho. Use as setas para ajustar.' }, svKnob);
  const hue = h('div.cp-hue', {
    role: 'slider', tabindex: 0, 'aria-label': 'Matiz', 'aria-valuemin': 0, 'aria-valuemax': 360,
  }, hueKnob);
  const alphaBar = opacity ? h('div.cp-alpha', {
    role: 'slider', tabindex: 0, 'aria-label': 'Opacidade', 'aria-valuemin': 0, 'aria-valuemax': 100,
  }, h('div.cp-alpha-fill'), alphaKnob) : null;
  const prevNew = h('div.cp-prev-new'), prevOld = h('div.cp-prev-old', { title: 'Cor original: clique para voltar a ela' });
  const prev = h('div.cp-prev', prevOld, prevNew);
  const fields = h('div.cp-fields');
  const modeBtn = h('button.cp-mode', { type: 'button', title: 'Trocar o formato: HEX, RGB ou HSL' });
  const contrastBox = h('div.cp-contrast');
  const harmonyBox = h('div.cp-harmony');
  const palBox = h('div.cp-pals');
  const recentBox = h('div.cp-recent');
  const moreBox = h('div.cp-more');

  /** Redesenha os controles a partir de `hsv`/`alpha` (sem mexer no campo que a pessoa está digitando). */
  function paint() {
    const base = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));
    sv.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${base})`;
    svKnob.style.left = `${hsv.s * 100}%`;
    svKnob.style.top = `${(1 - hsv.v) * 100}%`;
    hueKnob.style.left = `${(hsv.h / 360) * 100}%`;
    hue.setAttribute('aria-valuenow', String(round(hsv.h)));
    hue.setAttribute('aria-valuetext', `${round(hsv.h)} graus`);
    sv.setAttribute('aria-label', `Saturação ${round(hsv.s * 100)}%, brilho ${round(hsv.v * 100)}%. Use as setas para ajustar.`);
    const c = current();
    if (alphaBar) {
      alphaBar.firstChild.style.background = `linear-gradient(to right, transparent, ${c})`;
      alphaKnob.style.left = `${alpha * 100}%`;
      alphaBar.setAttribute('aria-valuenow', String(round(alpha * 100)));
      alphaBar.setAttribute('aria-valuetext', `${round(alpha * 100)}%`);
    }
    prevNew.style.background = c;
    prevNew.style.opacity = String(alpha);
    prevOld.style.background = original;
    modeBtn.textContent = mode.toUpperCase();
    paintFields();
    paintContrast(c);
  }

  /** Campos do formato atual: HEX | R G B | H S L (+ opacidade em %, se houver). */
  function buildFields() {
    const rgb = () => hexToRgb(current());
    const inp = (label, get, onSet, { min = 0, max = 255, width = 44 } = {}) => {
      const i = h('input.cp-num', { type: 'text', inputmode: 'numeric', 'aria-label': label, style: { width: `${width}px` } });
      i.dataset.get = '1';
      i._get = get;
      i.addEventListener('focus', () => i.select());
      i.addEventListener('change', () => {
        const v = Number(String(i.value).replace(',', '.'));
        if (Number.isFinite(v)) onSet(Math.min(max, Math.max(min, v)));
        finish();
      });
      i.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') i.blur();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const d = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1); i.value = String(Math.min(max, Math.max(min, Number(i.value) + d))); i.dispatchEvent(new Event('change')); }
      });
      return h('label.cp-field', h('span', label), i);
    };
    const setRgb = (patch) => { const c = { ...hexToRgb(current()), ...patch }; applyRgb(c); };
    const setHsl = (patch) => { const l = { ...rgbToHsl(hexToRgb(current())), ...patch }; applyRgb(hslToRgb(l), true); };
    let out;
    if (mode === 'hex') {
      const i = h('input.text.mono.cp-hex', { type: 'text', spellcheck: false, maxLength: 7, 'aria-label': 'Cor em hexadecimal' });
      i._get = () => current().slice(1);
      i.addEventListener('focus', () => i.select());
      i.addEventListener('input', () => {
        const v = normalizeHex(i.value);
        if (v) { hsv = rgbToHsv(hexToRgb(v)); push(); paintExceptFields(); }
      });
      i.addEventListener('change', () => finish());
      i.addEventListener('keydown', (e) => e.key === 'Enter' && i.blur());
      out = [h('span.hash', '#'), i];
    } else if (mode === 'rgb') {
      out = [inp('R', () => rgb().r, (v) => setRgb({ r: v })), inp('G', () => rgb().g, (v) => setRgb({ g: v })), inp('B', () => rgb().b, (v) => setRgb({ b: v }))];
    } else {
      out = [
        inp('H', () => round(rgbToHsl(rgb()).h), (v) => setHsl({ h: v }), { max: 360 }),
        inp('S', () => round(rgbToHsl(rgb()).s * 100), (v) => setHsl({ s: v / 100 }), { max: 100 }),
        inp('L', () => round(rgbToHsl(rgb()).l * 100), (v) => setHsl({ l: v / 100 }), { max: 100 }),
      ];
    }
    if (opacity) {
      const i = h('input.cp-num', { type: 'text', inputmode: 'numeric', 'aria-label': 'Opacidade em %', style: { width: '42px' } });
      i._get = () => round(alpha * 100);
      i.addEventListener('focus', () => i.select());
      i.addEventListener('change', () => { const v = Number(i.value); if (Number.isFinite(v)) { alpha = clamp01(v / 100); pushAlpha(); } finish(); });
      i.addEventListener('keydown', (e) => e.key === 'Enter' && i.blur());
      out.push(h('label.cp-field', h('span', '%'), i));
    }
    fields.replaceChildren(...out);
  }
  /** Atualiza só os valores dos campos (se a pessoa não está digitando num deles). */
  function paintFields() {
    fields.querySelectorAll('input').forEach((i) => {
      if (document.activeElement !== i && i._get) i.value = String(i._get());
    });
  }
  const paintExceptFields = () => { paint(); };

  /** Contraste da cor sobre branco e sobre preto, no padrão WCAG. */
  function paintContrast(c) {
    const box = (bg, label) => {
      const r = contrast(c, bg);
      const lvl = wcagLevel(r);
      return tip(h('span.cp-cbox', { dataset: { level: lvl } },
        h('span.cp-cdemo', { style: { background: bg, color: c } }, 'Aa'),
        h('span.cp-cinfo', h('b', r.toFixed(1)), h('i', lvl))),
      { title: `Contraste sobre ${label}`, text: 'Mede se um texto desta cor é legível sobre este fundo (WCAG). AA = bom para texto normal; AAA = ótimo; "AA grande" = só serve para títulos grandes; "falha" = difícil de ler.' });
    };
    contrastBox.replaceChildren(h('span.cp-clabel', 'Contraste'), box('#FFFFFF', 'branco'), box('#000000', 'preto'), ...(eye ? [h('span.cp-spacer'), eye] : []));
  }

  // ------------------------------------------------------------ aplicar mudanças
  /** Aplica a cor atual (e a opacidade) ao campo, ao vivo. */
  function push() { set(current()); }
  function pushAlpha() { setOpacity?.(alpha); paint(); }
  /** Cor nova vinda de RGB (campos, chips). `keepHue`: mantém o matiz quando a cor fica sem saturação. */
  function applyRgb(rgb, keepHue = false) {
    const next = rgbToHsv(rgb);
    if (keepHue || next.s === 0 || next.v === 0) next.h = hsv.h;
    hsv = next;
    push();
    paint();
  }
  /** Fim de uma edição: grava no histórico e guarda nas recentes. */
  function finish(quiet = false) {
    commit?.();
    pushRecent(current());
    paintRecent();
    if (!quiet) paintHarmony(); // as sugestões acompanham a cor (menos quando o clique veio delas)
  }
  /** Escolhe uma cor pronta (chip): aplica e grava. */
  function pick(c, quiet = false) {
    hsv = rgbToHsv(hexToRgb(c));
    push();
    paint();
    finish(quiet);
  }
  /** Arrasto numa área/barra: `fn(x, y)` recebe a posição relativa 0–1; grava ao soltar. */
  const drag = (el, fn) => el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const mv = (ev) => { const r = el.getBoundingClientRect(); fn(clamp01((ev.clientX - r.left) / r.width), clamp01((ev.clientY - r.top) / r.height)); };
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); finish(); };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
    mv(e);
  });
  drag(sv, (x, y) => { hsv.s = x; hsv.v = 1 - y; push(); paint(); });
  drag(hue, (x) => { hsv.h = x * 360; push(); paint(); });
  if (alphaBar) drag(alphaBar, (x) => { alpha = x; pushAlpha(); });
  /** Faz os controles de cor responderem às setas sem roubar os atalhos do canvas. */
  const keyboardAdjust = (el, adjust) => el.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    adjust(e);
    push();
    paint();
    finish();
  });
  keyboardAdjust(sv, (e) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    if (e.key === 'ArrowLeft') hsv.s = clamp01(hsv.s - step);
    else if (e.key === 'ArrowRight') hsv.s = clamp01(hsv.s + step);
    else if (e.key === 'ArrowDown') hsv.v = clamp01(hsv.v - step);
    else if (e.key === 'ArrowUp') hsv.v = clamp01(hsv.v + step);
    else if (e.key === 'Home') hsv.s = 0;
    else if (e.key === 'End') hsv.s = 1;
  });
  keyboardAdjust(hue, (e) => {
    if (e.key === 'Home') hsv.h = 0;
    else if (e.key === 'End') hsv.h = 360;
    else hsv.h = (hsv.h + ((e.key === 'ArrowLeft' || e.key === 'ArrowDown') ? -1 : 1) * (e.shiftKey ? 10 : 1) + 360) % 360;
  });
  if (alphaBar) keyboardAdjust(alphaBar, (e) => {
    if (e.key === 'Home') alpha = 0;
    else if (e.key === 'End') alpha = 1;
    else alpha = clamp01(alpha + ((e.key === 'ArrowLeft' || e.key === 'ArrowDown') ? -1 : 1) * (e.shiftKey ? 0.1 : 0.01));
    setOpacity?.(alpha);
  });
  prevOld.addEventListener('click', () => pick(original));
  modeBtn.addEventListener('click', () => { mode = mode === 'hex' ? 'rgb' : mode === 'rgb' ? 'hsl' : 'hex'; buildFields(); paint(); });

  // ------------------------------------------------------------ chips
  const chip = (c, quiet = false) => h('button.chip', { type: 'button', title: c, 'aria-label': c, style: { background: c }, onclick: () => pick(c, quiet) });
  const chipRow = (colors, quiet = false) => h('div.color-chips', colors.map((c) => chip(c, quiet)));

  // ------------------------------------------------------------ 4. sugestões
  function paintHarmony() {
    const all = harmonies(current());
    const cur = all.find((x) => x.key === harmony) || all[0];
    const tabs = h('div.cp-tabs', all.map((x) => h('button.cp-tab' + (x.key === cur.key ? '.on' : ''), {
      type: 'button', onclick: () => { harmony = x.key; paintHarmony(); },
    }, x.title)));
    const useAll = h('button.cp-link', {
      type: 'button', title: 'Guardar estas cores na paleta ativa (cria uma se ainda não houver)',
      onclick: () => {
        const id = getActiveId();
        if (id) changePalette(id, (p) => cur.colors.forEach((c) => addColor(p, c)));
        else createPalette('Paleta 1', cur.colors);
      },
    }, '+ guardar na paleta');
    harmonyBox.replaceChildren(h('div.cp-title', h('span', 'Sugestões'), useAll), tabs, chipRow(cur.colors, true));
  }

  // ------------------------------------------------------------ 5. paletas
  function paintPalettes() {
    const pals = getPalettes();
    const active = getActiveId();
    const pills = h('div.cp-pills',
      pals.map((p) => h('button.cp-pill' + (p.id === active ? '.on' : ''), {
        type: 'button', title: p.id === active ? 'Paleta ativa. Duplo clique para renomear' : p.name,
        onclick: () => { confirmDelete = null; renaming = null; setActiveId(p.id); },
        ondblclick: () => { setActiveId(p.id); renaming = p.id; paintPalettes(); },
      }, p.name)),
      h('button.cp-pill.new', {
        type: 'button', title: 'Nova paleta, já com a cor atual',
        onclick: () => { renamingNext = true; if (!createPalette(`Paleta ${pals.length + 1}`, [current()])) renamingNext = false; },
      }, '+ Nova'));
    const parts = [h('div.cp-title', h('span', 'Minhas paletas')), pills];
    const p = pals.find((x) => x.id === active);
    if (!p) {
      parts.push(h('p.cp-hint', 'Você ainda não tem nenhuma paleta. Crie uma e guarde aqui as cores que mais usa: ela fica disponível em todos os projetos.'));
    } else {
      if (renamingNext) { renaming = p.id; renamingNext = false; }
      parts.push(paletteBody(p));
    }
    palBox.replaceChildren(...parts);
    if (renaming) {
      const i = palBox.querySelector('.cp-rename');
      if (i) { i.focus(); i.select(); }
    }
  }
  function paletteBody(p) {
    const nameEl = renaming === p.id
      ? (() => {
        const i = h('input.text.cp-rename', { type: 'text', value: p.name, maxLength: 40, 'aria-label': 'Nome da paleta' });
        let done = false;
        const save = (ok) => { if (done) return; done = true; renaming = null; if (ok && i.value.trim()) changePalette(p.id, (x) => { x.name = i.value.trim(); }); else paintPalettes(); };
        i.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') save(true); if (e.key === 'Escape') save(false); });
        i.addEventListener('blur', () => save(true));
        return i;
      })()
      : h('button.cp-pname', { type: 'button', title: 'Clique para renomear', onclick: () => { renaming = p.id; paintPalettes(); } }, h('span', p.name), ico('more', 12));
    const menuBtn = h('button.icon-btn.small', {
      type: 'button', title: 'Mais ações da paleta', 'aria-label': 'Mais ações da paleta',
      onclick: (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        showMenu(r.right, r.bottom + 4, [
          { label: 'Renomear', onClick: () => { renaming = p.id; paintPalettes(); } },
          { label: 'Duplicar', onClick: () => { renamingNext = true; createPalette(`${p.name} (cópia)`, p.colors); } },
          { label: 'Copiar como variáveis CSS', icon: 'code', disabled: !p.colors.length, onClick: () => navigator.clipboard?.writeText(paletteCss(p)).catch(() => {}) },
          'sep',
          { label: 'Excluir paleta', danger: true, icon: 'trash', onClick: () => { confirmDelete = p.id; paintPalettes(); } },
        ], { anchorRight: true });
      },
    }, ico('more', 14));
    const head = h('div.cp-phead', nameEl, h('span.cp-pcount', `${p.colors.length} ${p.colors.length === 1 ? 'cor' : 'cores'}`), menuBtn);
    const chips = h('div.cp-pchips',
      p.colors.map((c) => h('div.cp-pchip-wrap',
        h('button.cp-pchip', { type: 'button', style: { background: c }, title: `${c} — clique para usar`, 'aria-label': `Usar ${c}`, onclick: () => pick(c) }),
        h('button.cp-pchip-x', { type: 'button', title: 'Tirar da paleta', 'aria-label': `Tirar ${c} da paleta`, onclick: () => changePalette(p.id, (x) => removeColor(x, c)) }, '×'))),
      h('button.cp-pchip.add', {
        type: 'button', title: 'Guardar a cor atual nesta paleta', 'aria-label': 'Guardar a cor atual nesta paleta',
        onclick: () => changePalette(p.id, (x) => addColor(x, current())),
      }, '+'));
    const body = [head, chips];
    if (!p.colors.length) body.push(h('p.cp-hint', 'Paleta vazia. Use o + para guardar a cor atual, ou "+ guardar na paleta" nas sugestões.'));
    if (confirmDelete === p.id) {
      body.push(h('div.cp-confirm', h('span', `Excluir "${p.name}"?`),
        h('button.btn.small', { type: 'button', onclick: () => { confirmDelete = null; paintPalettes(); } }, 'Cancelar'),
        h('button.btn.small.danger', { type: 'button', onclick: () => { confirmDelete = null; deletePalette(p.id); } }, 'Excluir')));
    }
    return h('div.cp-pbody', body);
  }

  // ------------------------------------------------------------ 6. recentes, projeto, prontas
  function paintRecent() {
    const r = getRecents();
    recentBox.replaceChildren(...(r.length ? [h('div.cp-title', h('span', 'Recentes')), chipRow(r)] : []));
  }
  function paintMore() {
    const g = (groups?.() || []).filter((x) => x.colors.length);
    const items = [...g, ...BUILTIN.map(([title, colors]) => ({ title, colors }))];
    const d = h('details.cp-det', h('summary', ico('chevron', 10), ' Neste projeto e paletas prontas'),
      h('div.cp-groups', items.map((x) => h('div.cp-group', h('div.cp-group-title', x.title), chipRow(x.colors)))));
    moreBox.replaceChildren(d);
  }

  // ------------------------------------------------------------ montar
  const eye = globalThis.EyeDropper
    ? h('button.icon-btn.small', {
      type: 'button', title: 'Conta-gotas: pega uma cor de qualquer lugar da tela',
      onclick: async () => { try { const { sRGBHex } = await new globalThis.EyeDropper().open(); pick(sRGBHex.toUpperCase()); } catch { /* cancelado */ } },
    }, ico('eyedropper', 14))
    : null;
  const pop = h('div.cp', { role: 'dialog', 'aria-label': 'Seletor de cor' },
    sv, hue, alphaBar,
    h('div.cp-row', prev, h('div.cp-fieldbox', modeBtn, fields)),
    contrastBox, harmonyBox, palBox, recentBox, moreBox);
  document.body.append(pop);
  buildFields();
  paint();
  paintHarmony();
  paintPalettes();
  paintRecent();
  paintMore();
  const offPalettes = onPalettes(() => { paintPalettes(); });

  // posição: ao lado do campo (à esquerda, pois o painel fica à direita), sempre dentro da janela
  const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, hh = pop.offsetHeight;
  let x = r.left - w - 12;
  if (x < 8) x = Math.min(innerWidth - w - 8, r.right + 12);
  pop.style.left = `${Math.max(8, x)}px`;
  pop.style.top = `${Math.max(8, Math.min(r.top - 8, innerHeight - hh - 8))}px`;

  // o seletor cresce (paletas, sugestões): mantém sempre inteiro dentro da janela, empurrando-o para cima se preciso
  const keepInside = () => {
    const top = parseFloat(pop.style.top) || 8;
    pop.style.top = `${Math.max(8, Math.min(top, innerHeight - pop.offsetHeight - 8))}px`;
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(keepInside) : null;
  ro?.observe(pop);

  // clicar fora fecha (menus e janelas abertos a partir do seletor não contam como "fora")
  const off = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target) && !e.target.closest?.('.menu, .modal, .rich-tip')) close(); };
  const esc = (e) => { if (e.key === 'Escape' && !renaming) close(); };
  const watch = setInterval(() => { if (!anchor.isConnected) close(); }, 250);
  function close() {
    clearInterval(watch);
    ro?.disconnect();
    offPalettes();
    window.removeEventListener('pointerdown', off, true);
    window.removeEventListener('keydown', esc, true);
    pop.remove();
    if (open?.pop === pop) open = null;
    onClose?.();
  }
  window.addEventListener('pointerdown', off, true);
  window.addEventListener('keydown', esc, true);
  open = { anchor, pop, close };
}
