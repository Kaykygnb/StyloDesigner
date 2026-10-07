/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/fontpicker.js — SELETOR DE FONTES (Google Fonts + fontes do sistema)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Um campo que mostra a fonte atual (escrita nela mesma). Ao clicar, abre uma caixa flutuante com:
 *   - busca por nome; filtros por categoria (sans, serif, display, manuscrita, mono);
 *   - lista com PRÉVIA de cada fonte no próprio estilo (só as fontes que aparecem na tela são baixadas, e só as
 *     letras do nome: ver fonts.js → loadPreview);
 *   - teclado: ↑/↓ escolhem, Enter aplica, Esc fecha.
 *  As mais usadas aparecem primeiro; as do sistema ficam no topo quando a busca está vazia.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { GOOGLE, SYSTEM_FONTS, loadPreview, previewFamily } from '../fonts.js';

/** Categorias (rótulo na tela → valor salvo na lista). */
const CATS = [['', 'Todas'], ['sans', 'Sans'], ['serif', 'Serif'], ['display', 'Display'], ['manuscrita', 'Manuscrita'], ['mono', 'Mono']];
/** Quantas linhas por vez (a lista tem quase 2 mil fontes). */
const PAGE = 80;
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// caixa aberta no momento (só uma por vez)
let open = null;

/**
 * Campo de fonte para o painel de propriedades.
 * @param {{get: () => string, set: (family: string) => void}} o  get lê a fonte atual; set aplica (e grava)
 * @returns {{el: HTMLElement, update: () => void}}
 */
export function fontField({ get, set }) {
  const label = h('span.font-current');
  const btn = h('button.field.font-field', {
    type: 'button', title: 'font-family — clique para escolher entre as fontes do Google e do sistema', 'aria-haspopup': 'listbox',
    onclick: () => openPicker(btn, get(), set),
  }, label, ico('chevron', 12));
  const update = () => {
    const f = get() || '';
    label.textContent = f || 'Misto';
    label.style.fontFamily = f ? `'${f}', system-ui` : '';
  };
  update();
  return { el: btn, update };
}

/** Abre a caixa de escolha embaixo de `anchor`. */
function openPicker(anchor, current, onPick) {
  close();
  let query = '';
  let cat = '';
  let shown = PAGE;
  let active = 0;
  let rows = [];
  const returnFocus = document.activeElement;

  const search = h('input.text', { type: 'search', placeholder: `Buscar entre ${GOOGLE.size + SYSTEM_FONTS.length} fontes`, 'aria-label': 'Buscar fonte' });
  const chips = h('div.font-cats', CATS.map(([v, l]) => h('button.tab-chip' + (v === cat ? '.on' : ''), {
    type: 'button', dataset: { cat: v }, onclick: () => { cat = v; shown = PAGE; chips.querySelectorAll('.tab-chip').forEach((c) => c.classList.toggle('on', c.dataset.cat === v)); render(); search.focus(); },
  }, l)));
  const list = h('div.font-list', { role: 'listbox', 'aria-label': 'Fontes' });
  const box = h('div.font-picker', { role: 'dialog', 'aria-label': 'Escolher fonte' },
    h('div.field.font-search', ico('search', 14), search), chips, list,
    h('p.hint', 'Google Fonts: baixadas da internet quando usadas. No PNG exportado, só fontes instaladas no computador aparecem.'));

  // só baixa a prévia das linhas que estão VISÍVEIS na lista
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { loadPreview(e.target.dataset.font); io.unobserve(e.target); }
  }, { root: list, rootMargin: '120px' });

  function items() {
    const q = fold(query.trim());
    const google = [...GOOGLE.entries()].filter(([n, m]) => (!cat || m.category === cat) && (!q || fold(n).includes(q)));
    if (q) google.sort((a, b) => (fold(a[0]).startsWith(q) ? 0 : 1) - (fold(b[0]).startsWith(q) ? 0 : 1)); // quem começa com o termo primeiro
    const sys = cat ? [] : SYSTEM_FONTS.filter((n) => !q || fold(n).includes(q)).map((n) => [n, { category: 'sistema' }]);
    return [...(q ? [] : sys), ...google, ...(q ? sys : [])];
  }

  function render() {
    const all = items();
    rows = all.slice(0, shown);
    active = Math.max(0, rows.findIndex(([n]) => n === current));
    io.disconnect();
    list.replaceChildren(...rows.map(([name, meta], i) => {
      const isGoogle = GOOGLE.has(name);
      const el = h('div.font-row' + (name === current ? '.selected' : '') + (i === active ? '.active' : ''), {
        role: 'option', 'aria-selected': String(name === current), dataset: { font: name, i: String(i) },
        onclick: () => pick(name),
      }, h('span.font-name', { style: { fontFamily: isGoogle ? `'${previewFamily(name)}', system-ui` : `'${name}', system-ui` } }, name),
      h('span.font-cat', meta.category));
      if (isGoogle) io.observe(el);
      return el;
    }));
    if (!all.length) list.append(h('p.hint.font-empty', `Nenhuma fonte com "${query}".`));
    if (all.length > shown) list.append(h('button.btn.font-more', { type: 'button', onclick: () => { shown += PAGE; render(); } }, `Mostrar mais (${all.length - shown})`));
    list.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }

  function pick(name) {
    close();
    onPick(name);
    returnFocus?.focus?.();
  }
  function move(delta) {
    if (!rows.length) return;
    active = (active + delta + rows.length) % rows.length;
    list.querySelectorAll('.font-row').forEach((r) => r.classList.toggle('active', Number(r.dataset.i) === active));
    list.querySelector('.font-row.active')?.scrollIntoView({ block: 'nearest' });
  }

  search.addEventListener('input', () => { query = search.value; shown = PAGE; render(); active = 0; move(0); });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter' && rows[active]) { e.preventDefault(); pick(rows[active][0]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); returnFocus?.focus?.(); }
    e.stopPropagation(); // nada daqui deve virar atalho do canvas (ex.: digitar "v" na busca)
  });

  document.body.append(box);
  // posição: embaixo do campo; se não couber, para cima; sempre dentro da janela
  const r = anchor.getBoundingClientRect();
  const bh = box.offsetHeight, bw = box.offsetWidth;
  const top = r.bottom + 6 + bh > innerHeight ? Math.max(8, r.top - bh - 6) : r.bottom + 6;
  box.style.top = `${top}px`;
  box.style.left = `${Math.max(8, Math.min(r.right - bw, innerWidth - bw - 8))}px`;
  const outside = (e) => { if (!box.contains(e.target) && !anchor.contains(e.target)) close(); };
  setTimeout(() => window.addEventListener('pointerdown', outside, true));
  open = { box, io, outside };
  render();
  search.focus();
}

/** Fecha a caixa aberta (se houver). */
function close() {
  if (!open) return;
  open.io.disconnect();
  open.box.remove();
  window.removeEventListener('pointerdown', open.outside, true);
  open = null;
}
