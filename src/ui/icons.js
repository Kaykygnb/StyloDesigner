/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/icons.js — ÍCONES SVG (inline, sem dependências)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Os desenhos dos ícones, só o miolo do SVG (viewBox 24×24, traço de 1.8px herdando a cor do texto).
 * Estilo "linha": mesmo traço e cantos arredondados em todos, para a interface ficar coesa.
 */
const P = {
  move: '<path d="M5 3l14 7.5-6.2 1.9L10.5 19z"/>',
  frame: '<path d="M7 3v18M17 3v18M3 7h18M3 17h18"/>',
  rect: '<rect x="4" y="5" width="16" height="14" rx="2"/>',
  ellipse: '<circle cx="12" cy="12" r="8"/>',
  text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 9"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 013 0V11m0-5.5a1.5 1.5 0 013 0V11m0-3.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-.5a6 6 0 01-5-2.7L4 14.5a1.5 1.5 0 012.4-1.7L8 14.5"/>',
  group: '<rect x="3.5" y="3.5" width="17" height="17" rx="2" stroke-dasharray="3 3"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  eye: '<path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.7 9.7 0 0112 6c6.3 0 10 6 10 6a17 17 0 01-3.2 3.9M6.5 7.6A16 16 0 002 12s3.7 7 10 7a9.6 9.6 0 004-.9"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 017.6-1.7"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',
  alignL: '<path d="M4 3v18"/><rect x="8" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="7" height="4" rx="1"/>',
  alignCH: '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
  alignR: '<path d="M20 3v18"/><rect x="4" y="6" width="12" height="4" rx="1"/><rect x="9" y="14" width="7" height="4" rx="1"/>',
  alignT: '<path d="M3 4h18"/><rect x="6" y="8" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="7" rx="1"/>',
  alignCV: '<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
  alignB: '<path d="M3 20h18"/><rect x="6" y="4" width="4" height="12" rx="1"/><rect x="14" y="9" width="4" height="7" rx="1"/>',
  distH: '<path d="M4 3v18M20 3v18"/><rect x="9" y="7" width="6" height="10" rx="1"/>',
  distV: '<path d="M3 4h18M3 20h18"/><rect x="7" y="9" width="10" height="6" rx="1"/>',
  row: '<rect x="3" y="6" width="5" height="12" rx="1"/><rect x="10" y="6" width="5" height="12" rx="1"/><rect x="17" y="6" width="4" height="12" rx="1"/>',
  column: '<rect x="6" y="3" width="12" height="5" rx="1"/><rect x="6" y="10" width="12" height="5" rx="1"/><rect x="6" y="17" width="12" height="4" rx="1"/>',
  none: '<circle cx="12" cy="12" r="8"/><path d="M6.3 6.3l11.4 11.4"/>',
  wrap: '<path d="M4 6h12a4 4 0 010 8H8m0 0l3-3m-3 3l3 3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
  download: '<path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/>',
  upload: '<path d="M12 16V5m0 0L8 9m4-4l4 4M5 20h14"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  page: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  corner: '<path d="M5 19V10a5 5 0 015-5h9"/>',
  corners: '<path d="M4 9V6a2 2 0 012-2h3M15 4h3a2 2 0 012 2v3M20 15v3a2 2 0 01-2 2h-3M9 20H6a2 2 0 01-2-2v-3"/>',
  rotate: '<path d="M20 12a8 8 0 11-2.6-5.9M20 4v5h-5"/>',
  alignTextL: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  alignTextC: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  alignTextR: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  italic: '<path d="M10 5h8M6 19h8M14 5l-4 14"/>',
  underline: '<path d="M7 4v7a5 5 0 0010 0V4M5 20h14"/>',
  strike: '<path d="M4 12h16M8 6.5C8.5 5 10 4 12 4c2.5 0 4 1.3 4 3M8 17c.5 1.7 2 3 4.2 3 2.5 0 4-1.2 4-3.2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.7-1.5 1.2-1.5 2.5M12 17.5v.01"/>',
  shadow: '<rect x="5" y="5" width="12" height="12" rx="2"/><path d="M20 9v8a3 3 0 01-3 3H9"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/>',
  folder: '<path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  fit: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  flipH: '<path d="M12 3v18M8 7L3 12l5 5V7zM16 7l5 5-5 5V7z"/>',
  flipV: '<path d="M3 12h18M7 8l5-5 5 5H7zM7 16l5 5 5-5H7z"/>',
  grid: '<path d="M4 4h16v16H4zM4 12h16M12 4v16"/>',
  component: '<path d="M12 3l3 3-3 3-3-3zM6 9l3 3-3 3-3-3zM18 9l3 3-3 3-3-3zM12 15l3 3-3 3-3-3z"/>',
  pen: '<path d="M12 19l7-7-3-3-7 7zM9 16l-5 4 4-5M16 9l3-3-2-2-3 3"/>',
  line: '<path d="M5 19L19 5"/>',
  polygon: '<path d="M12 3l8.5 6.2-3.2 10H6.7l-3.2-10z"/>',
  star: '<path d="M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  eyedropper: '<path d="M14 6l4 4M5 19l1-4 9-9 3 3-9 9zM16 4l1-1a2 2 0 013 3l-1 1"/>',
  front: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 14V6a2 2 0 012-2h8"/>',
  back: '<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M20 10v8a2 2 0 01-2 2h-8"/>',
};

/**
 * Markup SVG completo de um ícone pelo nome (ver `P`). Nome inexistente gera um SVG vazio em vez de quebrar.
 * @param {string} name
 * @param {number} [size=16]  px
 */
export const icon = (name, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

/** Ícone usado na lista de camadas para cada tipo de camada. */
export const nodeIcon = (type) =>
  ({ frame: 'frame', rect: 'rect', ellipse: 'ellipse', text: 'text', group: 'group', line: 'line', path: 'pen' })[type] || 'rect';
