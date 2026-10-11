// Validação leve de um documento carregado (arquivo .json de terceiros, pasta, navegador ou MCP).
// Módulo puro (sem DOM) e que NUNCA lança: conserta o que dá, descarta o que é perigoso ou impossível de desenhar e
// devolve uma lista de avisos em português. A defesa final contra CSS/SVG malicioso fica na saída (css.js:
// isSafeCssValue, safeIdent, cssUrl); aqui o objetivo é não deixar lixo estrutural chegar até lá.
import { uid, FORMAT_VERSION } from './model.js';

/** Imagens aceitas no documento: só dados embutidos. Endereços externos (rastreamento) e esquemas como javascript: não. */
const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml)[;,]/i;
/** Campos numéricos da camada; o que não for número finito é convertido (texto numérico) ou removido (volta ao padrão). */
const NUMERIC = ['x', 'y', 'w', 'h', 'rotation', 'opacity', 'blur', 'bgBlur', 'colSpan', 'rowSpan', 'minW', 'maxW', 'minH', 'maxH', 'aspect', 'grow', 'wordSpacing', 'fontSize', 'lineHeight', 'letterSpacing', 'lines'];
/** Campos que guardam uma palavra-chave (blend, cursor...): só identificador simples; o resto volta ao padrão. */
const KEYWORDS = ['blend', 'cursor', 'alignSelf', 'justifySelf', 'sizeX', 'sizeY', 'overflow', 'truncate'];
/** Geometria e opacidade sempre existem numa camada: o valor inválido vira o padrão do createNode, não some. */
const GEOMETRY_DEFAULT = { x: 0, y: 0, w: 100, h: 100, rotation: 0, opacity: 1 };
const KEYWORD = /^[a-z][a-z-]{0,30}$/i;
const LIMIT = 10_000_000;
/** Profundidade máxima de camadas aninhadas (o editor real raramente passa de 15); acima disso é arquivo hostil. */
const MAX_DEPTH = 100;
/** Chaves que enganam conversões de tipo (Number({toString:null}) lança) ou mexem no protótipo se alguém usar Object.assign. */
const BAD_KEYS = ['toString', 'valueOf', 'toJSON', 'toLocaleString', '__proto__', 'constructor', 'prototype', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__'];
/** Id que vira atributo SVG, atributo data-* e parte de seletor: só letras, números, _, - e ~. */
const SAFE_ID = /^[\w~-]{1,200}$/; // `~` aparece nos ids das instâncias de componente (pai~filho)

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Remove BAD_KEYS de `root` e de tudo que está dentro dele (menos `children`, que o validador percorre por conta
 * própria). Iterativo e com teto de profundidade: JSON hostil não pode estourar a pilha por aqui.
 * @returns {number} quantas chaves foram removidas
 */
function scrub(root) {
  let removed = 0;
  const stack = [[root, 0]];
  while (stack.length) {
    const [obj, depth] = stack.pop();
    if (!obj || typeof obj !== 'object' || depth > 30) continue;
    if (!Array.isArray(obj)) {
      for (const key of BAD_KEYS) if (Object.hasOwn(obj, key)) { delete obj[key]; removed++; }
    }
    for (const key of Object.keys(obj)) {
      if (key === 'children' && depth === 0) continue;
      const v = obj[key];
      if (v && typeof v === 'object') stack.push([v, depth + 1]);
    }
  }
  return removed;
}

/**
 * Valida e normaliza `doc` NO LUGAR.
 * @param {any} doc  documento (objeto vindo de JSON.parse, store ou MCP)
 * @returns {string[]} avisos em português (lista vazia = nada foi alterado)
 */
export function sanitizeDoc(doc) {
  const warnings = [];
  if (!isObj(doc)) return warnings;

  // versão do formato: sem versão (ou inválida) = 1; de uma versão MAIS NOVA que a deste Stylo abre com aviso e a versão não é
  // rebaixada (regravar não pode fingir que o arquivo é do formato antigo)
  if (!Number.isInteger(doc.version) || doc.version < 1) doc.version = 1;
  else if (doc.version > FORMAT_VERSION) warnings.push(`Este projeto foi criado numa versão mais nova do Stylo (formato ${doc.version}; esta lê até o ${FORMAT_VERSION}). Algumas coisas podem não aparecer; atualize o Stylo antes de editar.`);
  if (!Array.isArray(doc.pages)) doc.pages = [];
  const pages = doc.pages.filter(isObj);
  if (pages.length !== doc.pages.length) warnings.push(`${doc.pages.length - pages.length} página(s) inválida(s) descartada(s).`);
  doc.pages = pages;
  for (const page of doc.pages) {
    if (scrub(page)) warnings.push('Chaves reservadas removidas de uma página.');
    if (typeof page.id !== 'string' || !SAFE_ID.test(page.id)) page.id = uid();
    if (typeof page.name !== 'string') page.name = 'Página';
    page.children = cleanChildren(page.children, warnings, 1);
  }

  if (!isObj(doc.assets)) doc.assets = {};
  let dropped = 0;
  for (const [id, src] of Object.entries(doc.assets)) {
    if (typeof src !== 'string' || !DATA_IMAGE.test(src)) { delete doc.assets[id]; dropped++; }
  }
  if (dropped) warnings.push(`${dropped} imagem(ns) fora do formato aceito (só imagens embutidas, data:image/...) foram removidas.`);

  if (!isObj(doc.styles)) doc.styles = { colors: [], texts: [] };
  if (!Array.isArray(doc.styles.colors)) doc.styles.colors = [];
  if (!Array.isArray(doc.styles.texts)) doc.styles.texts = [];
  if (doc.comments !== undefined && !Array.isArray(doc.comments)) doc.comments = [];
  // CSS da página pode carregar fontes e imagens de fora (recurso legítimo): não bloqueamos, mas quem abre um projeto
  // de terceiros precisa saber que o navegador vai acessar esses endereços
  const hosts = externalHosts(doc.styles.pageCss);
  if (hosts.length) warnings.push(`O CSS da página carrega recursos de fora (${hosts.join(', ')}). Abrir este projeto faz o navegador acessar esses endereços.`);
  if (typeof doc.name !== 'string') doc.name = 'Sem título';
  if (scrub(doc.styles) + scrub(doc.comments) + scrub(doc.breakpoints)) warnings.push('Chaves reservadas removidas dos estilos ou comentários.');
  return warnings;
}

/** Hosts que o Stylo e a exportação já usam por padrão (Google Fonts): não são surpresa. */
const KNOWN_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

/**
 * Hosts externos que um texto de CSS acessa (url(), @import, image-set), sem repetir e sem os conhecidos.
 * @param {unknown} css
 * @returns {string[]}
 */
function externalHosts(css) {
  if (typeof css !== 'string' || !css) return [];
  const hosts = new Set();
  const re = /(?:url\(\s*|@import\s+|image-set\(\s*|,\s*)["']?(?:https?:)?\/\/([^\/"'()\s?#]+)/gi;
  for (const m of css.matchAll(re)) {
    const host = m[1].toLowerCase().replace(/:\d+$/, '');
    if (host && !KNOWN_HOSTS.has(host)) hosts.add(host);
  }
  return [...hosts];
}

/** Limpa uma lista de camadas (recursivo): descarta o que não é camada e conserta campos básicos. */
function cleanChildren(list, warnings, depth = 1) {
  if (depth > MAX_DEPTH) {
    if (Array.isArray(list) && list.length) warnings.push(`Aninhamento profundo demais (mais de ${MAX_DEPTH} níveis): as camadas internas foram descartadas.`);
    return [];
  }
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const node of list) {
    if (!isObj(node) || typeof node.type !== 'string' || !node.type) { warnings.push('Uma camada inválida foi descartada.'); continue; }
    if (scrub(node)) warnings.push(`Camada "${String(node.name)}": chaves reservadas removidas.`);
    if (typeof node.id !== 'string' || !SAFE_ID.test(node.id)) { node.id = uid(); warnings.push('Uma camada tinha id inválido e recebeu um novo.'); }
    if (typeof node.name !== 'string') node.name = node.type;
    for (const key of NUMERIC) {
      if (!(key in node)) continue;
      const v = node[key];
      if (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= LIMIT) continue;
      if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()) && Math.abs(Number(v)) <= LIMIT) node[key] = Number(v);
      else { if (key in GEOMETRY_DEFAULT) node[key] = GEOMETRY_DEFAULT[key]; else delete node[key]; warnings.push(`Camada "${node.name}": ${key} inválido, voltou ao padrão.`); }
    }
    for (const key of KEYWORDS) {
      if (key in node && !(typeof node[key] === 'string' && KEYWORD.test(node[key]))) { delete node[key]; warnings.push(`Camada "${node.name}": ${key} inválido, voltou ao padrão.`); }
    }
    if ('children' in node) node.children = cleanChildren(node.children, warnings, depth + 1); // folhas continuam sem o campo
    out.push(node);
  }
  return out;
}
