/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  palettes.js — PALETAS DE COR PRÓPRIAS (salvas no navegador, valem para todos os projetos)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Uma paleta é uma lista nomeada de cores: { id, name, colors: ['#7C5CFF', ...] }. Diferente dos "estilos de cor"
 *  (que moram DENTRO do projeto e mudam todas as camadas ligadas a eles), as paletas são uma "gaveta de tintas" pessoal:
 *  ficam no navegador, aparecem no seletor de cor de qualquer projeto e podem virar estilos de cor quando você quiser.
 *
 *  As funções de cima são PURAS (testadas no Node, tests/palettes.test.js). O fim do arquivo é o armazenamento
 *  (localStorage) com um aviso para quem estiver ouvindo (painel Recursos e seletor de cor).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Máximo de cores por paleta e de paletas (evita lotar o armazenamento por engano). */
export const MAX_COLORS = 48;
export const MAX_PALETTES = 40;

const uid = () => 'pal_' + Math.random().toString(36).slice(2, 9);

/** "#abc", "abc", "#AABBCC" → "#AABBCC"; qualquer outra coisa → null. */
export function normalizeHex(v) {
  let s = String(v ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/i.test(s) ? '#' + s.toUpperCase() : null;
}

/** Cria uma paleta (cores inválidas e repetidas são descartadas). */
export function makePalette(name, colors = []) {
  const p = { id: uid(), name: String(name || '').trim() || 'Paleta', colors: [] };
  for (const c of colors) addColor(p, c);
  return p;
}

/** Acrescenta uma cor (se válida, nova e houver espaço). Devolve true se entrou. */
export function addColor(p, color) {
  const hex = normalizeHex(color);
  if (!hex || p.colors.includes(hex) || p.colors.length >= MAX_COLORS) return false;
  p.colors.push(hex);
  return true;
}

/** Tira uma cor da paleta. Devolve true se existia. */
export function removeColor(p, color) {
  const hex = normalizeHex(color);
  const i = p.colors.indexOf(hex);
  if (i < 0) return false;
  p.colors.splice(i, 1);
  return true;
}

/**
 * Lê cores de um texto livre: aceita "#7c5cff", "7c5cff", "#fff", "rgb(124, 92, 255)" separados por espaço, vírgula,
 * ponto e vírgula ou quebra de linha. Devolve só as válidas, sem repetir, na ordem em que aparecem.
 */
export function parseColors(text) {
  const out = [];
  const push = (hex) => { if (hex && !out.includes(hex)) out.push(hex); };
  const src = String(text || '');
  // rgb(r, g, b) primeiro (para as vírgulas dele não serem tratadas como separador)
  const rest = src.replace(/rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})[^)]*\)/gi, (_, r, g, b) => {
    push('#' + [r, g, b].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('').toUpperCase());
    return ' ';
  });
  for (const token of rest.split(/[\s,;]+/)) push(normalizeHex(token));
  return out;
}

/** As cores mais usadas num documento (preenchimentos sólidos, contornos e sombras), da mais para a menos usada. */
export function docColors(doc, max = MAX_COLORS) {
  const count = new Map();
  const bump = (c) => { const hex = normalizeHex(c); if (hex) count.set(hex, (count.get(hex) || 0) + 1); };
  const walk = (list) => (list || []).forEach((n) => {
    if (n.fill?.type === 'solid') bump(n.fill.color);
    if (n.fill && ['linear', 'radial', 'conic'].includes(n.fill.type)) (n.fill.stops || []).forEach((s) => bump(s.color));
    if (n.stroke) bump(n.stroke.color);
    (n.shadows || []).forEach((s) => bump(s.color));
    if (n.children) walk(n.children);
  });
  (doc?.pages || []).forEach((pg) => walk(pg.children));
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([c]) => c);
}

/** Nome de variável de CSS a partir do nome da paleta: "Marca Roxa" → "marca-roxa". */
export const slug = (s) => String(s || 'paleta').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'paleta';

/** A paleta como bloco de variáveis de CSS, pronto para colar: ":root { --marca-1: #7C5CFF; ... }". */
export function paletteCss(p) {
  const base = slug(p.name);
  return `:root {\n${p.colors.map((c, i) => `  --${base}-${i + 1}: ${c};`).join('\n')}\n}`;
}

/** Limpa uma lista lida do armazenamento (formato errado, cores inválidas, excesso). Nunca lança. */
export function sanitize(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const p of list) {
    if (!p || typeof p !== 'object') continue;
    const clean = makePalette(p.name, Array.isArray(p.colors) ? p.colors : []);
    if (typeof p.id === 'string' && /^[\w-]{1,40}$/.test(p.id)) clean.id = p.id;
    out.push(clean);
    if (out.length >= MAX_PALETTES) break;
  }
  return out;
}

// ---------------------------------------------------------------- armazenamento
const KEY = 'pd.palettes';
let list = null; // carregado sob demanda
const listeners = new Set();

/** Paletas atuais (carrega do navegador na 1ª chamada). */
export function getPalettes() {
  if (!list) {
    try { list = sanitize(JSON.parse(globalThis.localStorage?.getItem(KEY) || '[]')); } catch { list = []; }
  }
  return list;
}

/** Grava e avisa os ouvintes. */
function persist() {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(list)); } catch { /* sem armazenamento: vale só nesta sessão */ }
  listeners.forEach((fn) => { try { fn(); } catch { /* um ouvinte com defeito não derruba os outros */ } });
}

/** Cria uma paleta nova, já a deixa como a paleta ativa do seletor de cor, e devolve ela. */
export function createPalette(name, colors = []) {
  const all = getPalettes();
  if (all.length >= MAX_PALETTES) return null;
  const p = makePalette(name || `Paleta ${all.length + 1}`, colors);
  all.push(p);
  try { globalThis.localStorage?.setItem(ACTIVE, p.id); } catch { /* sem armazenamento */ }
  persist();
  return p;
}

/** Aplica uma mudança a uma paleta (por id) e salva. Devolve o que a função devolveu (ou undefined se não achou). */
export function changePalette(id, fn) {
  const p = getPalettes().find((x) => x.id === id);
  if (!p) return undefined;
  const r = fn(p);
  persist();
  return r;
}

const ACTIVE = 'pd.activePalette';
const RECENT = 'pd.recentColors';

/** Id da paleta ativa no seletor de cor (a escolhida por último; senão a 1ª). null se não há paletas. */
export function getActiveId() {
  const all = getPalettes();
  let id = null;
  try { id = globalThis.localStorage?.getItem(ACTIVE); } catch { /* idem */ }
  return all.some((p) => p.id === id) ? id : (all[0]?.id ?? null);
}

/** Escolhe a paleta ativa do seletor de cor. */
export function setActiveId(id) {
  try { globalThis.localStorage?.setItem(ACTIVE, id); } catch { /* idem */ }
  listeners.forEach((fn) => { try { fn(); } catch { /* idem */ } });
}

/** Últimas cores escolhidas (a mais recente primeiro, até 14). */
export function getRecents() {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(RECENT) || '[]');
    return Array.isArray(v) ? v.map(normalizeHex).filter(Boolean).slice(0, 14) : [];
  } catch { return []; }
}

/** Registra uma cor escolhida nas recentes (sem repetir). */
export function pushRecent(color) {
  const hex = normalizeHex(color);
  if (!hex) return;
  const next = [hex, ...getRecents().filter((c) => c !== hex)].slice(0, 14);
  try { globalThis.localStorage?.setItem(RECENT, JSON.stringify(next)); } catch { /* idem */ }
}

/** Apaga uma paleta. */
export function deletePalette(id) {
  const all = getPalettes();
  const i = all.findIndex((p) => p.id === id);
  if (i >= 0) { all.splice(i, 1); persist(); }
}

/** Ouve mudanças (devolve a função que desliga). */
export function onPalettes(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// outra aba do navegador mudou as paletas: recarrega e avisa
if (typeof addEventListener === 'function') {
  addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    list = null;
    listeners.forEach((fn) => { try { fn(); } catch { /* idem */ } });
  });
}
