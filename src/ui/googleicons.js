/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/googleicons.js — PAINEL "ÍCONES" (Material Symbols, os ícones do Google)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Aba do painel esquerdo. Busca entre os 4.299 ícones (lista embutida em src/data/material-icons.js), com
 *  estilo (contorno, arredondado, reto), versão preenchida, cor e tamanho. Clicar num ícone baixa o SVG dele
 *  de fonts.gstatic.com e insere como VETOR EDITÁVEL (svgimport.js): dentro do frame selecionado, ou no meio
 *  da tela. Depois de inserido, o ícone é um desenho do projeto: funciona sem internet.
 *
 *  Licença: Material Symbols são do Google, sob Apache 2.0 — pode usar em qualquer projeto, inclusive comercial.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { MATERIAL_ICONS } from '../data/material-icons.js';

/** Endereço do SVG de um ícone no servidor de arquivos do Google (responde com CORS liberado). */
export const iconUrl = (name, style, filled) =>
  `https://fonts.gstatic.com/s/i/short-term/release/materialsymbols${style}/${name}/${filled ? 'fill1' : 'default'}/24px.svg`;

/** Os mais usados aparecem primeiro quando a busca está vazia. */
const POPULAR = ['home', 'search', 'menu', 'close', 'settings', 'person', 'favorite', 'star', 'add', 'delete', 'edit', 'check',
  'arrow_forward', 'arrow_back', 'chevron_right', 'expand_more', 'shopping_cart', 'notifications', 'mail', 'call', 'chat',
  'calendar_month', 'schedule', 'lock', 'visibility', 'share', 'download', 'upload', 'image', 'photo_camera', 'play_arrow',
  'pause', 'location_on', 'account_circle', 'logout', 'login', 'info', 'help', 'warning', 'error', 'check_circle',
  'thumb_up', 'bookmark', 'filter_list', 'sort', 'more_vert', 'more_horiz', 'refresh', 'send', 'attach_file', 'link',
  'credit_card', 'payments', 'wallet', 'savings', 'receipt_long', 'storefront', 'local_shipping', 'dashboard', 'bar_chart',
  'folder', 'description', 'cloud', 'wifi', 'bolt', 'light_mode', 'dark_mode', 'language', 'translate', 'public'];
/** Quantos ícones mostrar por vez (a lista toda são milhares de imagens). */
const PAGE = 120;

/** Sinônimos em português → termos em inglês da lista do Google (a busca aceita os dois). */
export const PT = {
  casa: 'home', inicio: 'home', buscar: 'search', busca: 'search', lupa: 'search', fechar: 'close', configuracoes: 'settings',
  pessoa: 'person', usuario: 'person', coracao: 'favorite', estrela: 'star', mais: 'add', lixo: 'delete', apagar: 'delete',
  lapis: 'edit', editar: 'edit', seta: 'arrow', carrinho: 'shopping_cart', sino: 'notifications', email: 'mail', telefone: 'call',
  conversa: 'chat', calendario: 'calendar', relogio: 'schedule', cadeado: 'lock', olho: 'visibility', compartilhar: 'share',
  baixar: 'download', enviar: 'send', imagem: 'image', foto: 'photo', camera: 'camera', mapa: 'map', local: 'location',
  sair: 'logout', ajuda: 'help', aviso: 'warning', erro: 'error', curtir: 'thumb_up', pasta: 'folder', nuvem: 'cloud',
  dinheiro: 'payments', cartao: 'credit_card', carteira: 'wallet', loja: 'store', caminhao: 'local_shipping', grafico: 'chart',
  sol: 'light_mode', lua: 'dark_mode', idioma: 'language', mundo: 'public', musica: 'music', video: 'videocam', livro: 'book',
};
export const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Todos os nomes, com os mais usados primeiro. */
const ORDERED = [...POPULAR.filter((n) => MATERIAL_ICONS.includes(n)), ...MATERIAL_ICONS.filter((n) => !POPULAR.includes(n))];

/**
 * Busca ícones pelo nome em inglês ou por um sinônimo em português ("casa" → home). Quem COMEÇA com o termo vem
 * primeiro. Usada pelo painel e pelo agente de IA (ferramenta search_icons).
 * @param {string} query
 * @returns {string[]} nomes dos ícones (vazio = os mais usados)
 */
export function searchIcons(query) {
  const q = fold(query || '').replace(/\s+/g, '_');
  if (!q) return ORDERED;
  const terms = [q, PT[q]].filter(Boolean);
  const starts = [], has = [];
  for (const n of ORDERED) {
    if (terms.some((t) => n.startsWith(t))) starts.push(n);
    else if (terms.some((t) => n.includes(t))) has.push(n);
  }
  return [...starts, ...has];
}

/** O ícone existe na lista do Google? */
export const iconExists = (name) => MATERIAL_ICONS.includes(name);

/**
 * Cria a aba "Ícones": busca nos Material Symbols (aceita palavras em português), escolha de estilo, cor e
 * tamanho, e insere o ícone escolhido como vetor editável (commands.insertSvg).
 * @param {object} deps
 * @param {object} deps.commands   usa commands.insertSvg
 * @param {HTMLElement} deps.container
 * @param {(m: string) => void} deps.toast
 */
export function createIconsPanel({ commands, container, toast }) {
  // opções escolhidas (lembradas enquanto o app está aberto)
  const opt = { query: '', style: 'outlined', filled: false, color: '#111111', size: 48, shown: PAGE };
  // SVGs já baixados (não baixa o mesmo ícone duas vezes)
  const cache = new Map();
  /** Ícones que casam com a busca (em inglês ou pelos sinônimos em português). */
  const matches = () => searchIcons(opt.query);

  /** Baixa (ou pega do cache) e insere o ícone como vetor. */
  async function insert(name) {
    const url = iconUrl(name, opt.style, opt.filled);
    try {
      if (!cache.has(url)) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        cache.set(url, await res.text());
      }
      commands.insertSvg(cache.get(url), { name, fill: opt.color, currentColor: opt.color, size: opt.size });
    } catch {
      toast('Não consegui baixar o ícone. Você está conectado à internet?');
    }
  }

  // ---------------------------------------------------------------- desenho
  const search = h('input.text', {
    type: 'search', placeholder: 'Buscar ícone (ex.: casa, seta, cart)', 'aria-label': 'Buscar ícone',
    oninput: () => { opt.query = search.value; opt.shown = PAGE; renderGrid(); },
  });
  const styleSel = h('select.select', { 'aria-label': 'Estilo do ícone', onchange: () => { opt.style = styleSel.value; renderGrid(); } },
    h('option', { value: 'outlined' }, 'Contorno'), h('option', { value: 'rounded' }, 'Arredondado'), h('option', { value: 'sharp' }, 'Reto'));
  const filledInput = h('input', { type: 'checkbox', onchange: () => { opt.filled = filledInput.checked; renderGrid(); } });
  const color = h('input.icon-color', { type: 'color', value: opt.color, 'aria-label': 'Cor do ícone', oninput: () => { opt.color = color.value; } });
  const size = h('input.text', { type: 'number', min: 8, max: 1024, value: opt.size, 'aria-label': 'Tamanho do ícone em px', onchange: () => { opt.size = Math.max(8, Math.min(1024, Number(size.value) || 48)); size.value = opt.size; } });
  const grid = h('div.gicon-grid', { role: 'list' });
  const count = h('p.hint');

  container.append(
    h('div.gicon-panel',
      h('div.field.gicon-search', ico('search', 14), search),
      h('div.gicon-options',
        h('div.field.select-wrap', styleSel, ico('chevron', 12)),
        h('label.check', filledInput, h('span.box', ico('check', 10)), h('span', 'Preenchido'))),
      h('div.gicon-options',
        h('label.gicon-opt', 'Cor', color),
        h('label.gicon-opt', 'Tamanho', h('div.field', size), h('span.muted', 'px'))),
      count,
      grid,
      h('p.hint.gicon-credit', 'Material Symbols do Google (licença Apache 2.0, uso livre). Clique para inserir; com um frame selecionado, o ícone entra nele.')));

  function renderGrid() {
    const list = matches();
    count.textContent = opt.query ? `${list.length} ${list.length === 1 ? 'ícone' : 'ícones'}` : `${MATERIAL_ICONS.length} ícones · os mais usados primeiro`;
    const items = list.slice(0, opt.shown).map((name) => h('button.gicon', {
      type: 'button', title: name.replace(/_/g, ' '), 'aria-label': `Inserir ícone ${name.replace(/_/g, ' ')}`, role: 'listitem',
      onclick: () => insert(name),
    }, h('img', { src: iconUrl(name, opt.style, opt.filled), alt: '', loading: 'lazy', decoding: 'async', width: 24, height: 24 })));
    if (!list.length) items.push(h('p.hint', `Nada para "${opt.query}". Tente em inglês (ex.: "arrow", "cart").`));
    if (list.length > opt.shown) {
      items.push(h('button.btn.gicon-more', { type: 'button', onclick: () => { opt.shown += PAGE; renderGrid(); } }, `Mostrar mais (${list.length - opt.shown})`));
    }
    grid.replaceChildren(...items);
  }
  renderGrid();

  return { render: renderGrid, focus: () => search.focus() };
}
