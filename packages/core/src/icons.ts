/**
 * icons.js — BUSCA DE ÍCONES (Material Symbols), SEM INTERFACE
 * Lista, sinônimos em português e endereço do SVG. Usada pelo painel de ícones (editor) e pelas ferramentas
 * search_icons / insert_icon (agentes). Puro: roda no Node e no navegador.
 */

import { MATERIAL_ICONS } from './data/material-icons.js';

/** Endereço do SVG de um ícone no servidor de arquivos do Google (responde com CORS liberado). */
export const iconUrl = (name, style, filled) =>
  `https://fonts.gstatic.com/s/i/short-term/release/materialsymbols${style}/${name}/${filled ? 'fill1' : 'default'}/24px.svg`;

/** URL estável do catálogo Lucide. O nome é validado no executor antes do download. */
export const lucideIconUrl = (name) => `https://unpkg.com/lucide-static@0.468.0/icons/${String(name).toLowerCase()}.svg`;

/** Os mais usados aparecem primeiro quando a busca está vazia. */
const POPULAR = ['home', 'search', 'menu', 'close', 'settings', 'person', 'favorite', 'star', 'add', 'delete', 'edit', 'check',
  'arrow_forward', 'arrow_back', 'chevron_right', 'expand_more', 'shopping_cart', 'notifications', 'mail', 'call', 'chat',
  'calendar_month', 'schedule', 'lock', 'visibility', 'share', 'download', 'upload', 'image', 'photo_camera', 'play_arrow',
  'pause', 'location_on', 'account_circle', 'logout', 'login', 'info', 'help', 'warning', 'error', 'check_circle',
  'thumb_up', 'bookmark', 'filter_list', 'sort', 'more_vert', 'more_horiz', 'refresh', 'send', 'attach_file', 'link',
  'credit_card', 'payments', 'wallet', 'savings', 'receipt_long', 'storefront', 'local_shipping', 'dashboard', 'bar_chart',
  'folder', 'description', 'cloud', 'wifi', 'bolt', 'light_mode', 'dark_mode', 'language', 'translate', 'public'];

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
  const starts: string[] = [], has: string[] = [];
  for (const n of ORDERED) {
    if (terms.some((t) => n.startsWith(t))) starts.push(n);
    else if (terms.some((t) => n.includes(t))) has.push(n);
  }
  return [...starts, ...has];
}

/** O ícone existe na lista do Google? */
export const iconExists = (name) => MATERIAL_ICONS.includes(name);
