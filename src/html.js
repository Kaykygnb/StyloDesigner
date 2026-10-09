/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  html.js — HTML E CSS ESCRITOS À MÃO (sanitização, CSS da página, atributos HTML)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Funções PURAS (rodam no navegador e no Node, sem DOM) usadas pela aba Código, pelo canvas e pela exportação:
 *   - sanitizeHtml: limpa o HTML da camada "Código HTML" (sem <script>, sem on*, sem javascript:...);
 *   - parseCssBlocks / scopePageCss / safePageCss: o CSS GLOBAL da página (doc.styles.pageCss) com seletores,
 *     @media, :hover e @keyframes. No canvas as regras são "escopadas" (só valem dentro do canvas);
 *   - htmlAttrs: atributos extras de uma camada (id, classes, title, role, aria-label, target/rel, type...).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Escapa & < > " para texto e valores de atributo. */
export const escapeAttr = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * URL segura para href/src: http(s), mailto, tel, âncora (#), caminho relativo e data:image (só em src).
 * Qualquer outro esquema (javascript:, vbscript:, data:text/html...) devolve ''.
 */
export function safeUrl(url, { image = false } = {}) {
  const u = String(url ?? '').trim();
  if (!u) return '';
  // tira espaços/controles que o navegador ignora dentro do esquema ("java\tscript:")
  const probe = u.replace(/[\u0000- ]/g, '').toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(probe);
  if (!scheme) return u; // relativo, #ancora, /caminho, ?busca
  if (['http', 'https', 'mailto', 'tel'].includes(scheme[1])) return u;
  if (image && /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);/.test(probe)) return u;
  return '';
}

// ------------------------------------------------------------------ sanitização de HTML
/** Etiquetas permitidas no "Código HTML" (o resto some, mas o texto de dentro fica). */
const ALLOWED_TAGS = new Set(`a abbr address article aside audio b bdi bdo blockquote br button caption cite code col colgroup
data datalist dd del details dfn div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr i
iframe img input ins kbd label legend li main mark menu meter nav ol optgroup option output p picture pre progress q rp rt
ruby s samp search section select small source span strong sub summary sup table tbody td textarea tfoot th thead time tr
track u ul var video wbr
svg g path circle ellipse line polyline polygon rect text tspan defs lineargradient radialgradient stop clippath mask
symbol use title desc pattern filter fegaussianblur feoffset feblend fecolormatrix`.split(/\s+/));
/** Etiquetas removidas JUNTO com tudo o que está dentro (código, estilos globais, objetos externos). */
const DROP_WITH_CONTENT = new Set(['script', 'style', 'noscript', 'template', 'object', 'embed', 'applet', 'frame', 'frameset', 'noembed', 'xmp', 'plaintext', 'math']);
/** Etiquetas sem fechamento. */
const VOID = new Set(['br', 'hr', 'img', 'input', 'col', 'source', 'track', 'wbr']);
/** Atributos que levam URL. */
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster', 'cite', 'xlink:href', 'background']);
/** Nomes das etiquetas SVG com maiúsculas (o filtro compara em minúsculas). */
const SVG_CASE = { lineargradient: 'linearGradient', radialgradient: 'radialGradient', clippath: 'clipPath', fegaussianblur: 'feGaussianBlur', feoffset: 'feOffset', feblend: 'feBlend', fecolormatrix: 'feColorMatrix' };

/** Valor de `style=""` seguro: sem expression(), sem url(javascript:), sem behavior/-moz-binding. */
export function safeStyleValue(v) {
  const s = String(v);
  if (/expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding|@import/i.test(s.replace(/\\/g, ''))) return '';
  return s;
}

/**
 * Limpa o HTML escrito pela pessoa para ele poder ir ao canvas e ao arquivo exportado:
 *  - remove <script>, <style>, <object>, <embed>... (com o conteúdo) e comentários;
 *  - etiquetas desconhecidas somem (o texto de dentro fica);
 *  - remove atributos on* (onclick...), srcdoc, e URLs perigosas (javascript:, data: fora de imagens);
 *  - <iframe> só com endereço https:// (e ganha sandbox); sem endereço válido, some;
 *  - <a target="_blank"> ganha rel="noopener noreferrer".
 * @param {string} input
 * @returns {{ html: string, removed: string[] }}  `removed` = o que foi tirado (para avisar a pessoa)
 */
export function sanitizeHtml(input) {
  const src = String(input ?? '');
  const removed = new Set();
  let out = '';
  const re = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<![^>]*>|<\?[^>]*>|<\/?([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|<|[^<]+/g;
  let m;
  while ((m = re.exec(src))) {
    const tok = m[0];
    if (tok === '<') { out += '&lt;'; continue; }
    if (!tok.startsWith('<')) { out += tok.replace(/>/g, '&gt;'); continue; }
    if (tok.startsWith('<!--') || tok.startsWith('<!') || tok.startsWith('<?')) continue; // comentários, doctype
    const closing = tok[1] === '/';
    const name = m[1].toLowerCase();
    if (DROP_WITH_CONTENT.has(name)) {
      removed.add(`<${name}>`);
      if (!closing && !/\/\s*>$/.test(tok)) {
        // pula até o fechamento correspondente (ou o fim)
        const end = new RegExp(`</${name}\\s*>`, 'ig');
        end.lastIndex = re.lastIndex;
        const e = end.exec(src);
        re.lastIndex = e ? end.lastIndex : src.length;
      }
      continue;
    }
    if (!ALLOWED_TAGS.has(name)) { removed.add(`<${name}>`); continue; }
    const tag = SVG_CASE[name] || name;
    if (closing) { if (!VOID.has(name)) out += `</${tag}>`; continue; }
    const attrs = parseAttrs(m[2] || '');
    const kept = [];
    let iframeOk = name !== 'iframe';
    for (const [rawK, v] of attrs) {
      const k = rawK.toLowerCase();
      if (!/^[a-z_:][\w:.-]*$/.test(k)) continue;
      if (k.startsWith('on') || k === 'srcdoc') { removed.add(`atributo ${k}`); continue; }
      if (k === 'style') { const st = safeStyleValue(v); if (st) kept.push([k, st]); else removed.add('style perigoso'); continue; }
      if (URL_ATTRS.has(k)) {
        if (name === 'iframe' && k === 'src') {
          if (/^https:\/\//i.test(String(v).trim())) { kept.push([k, String(v).trim()]); iframeOk = true; } else removed.add('<iframe> sem https');
          continue;
        }
        if ((name === 'use' && (k === 'href' || k === 'xlink:href')) && !String(v).trim().startsWith('#')) { removed.add('<use> externo'); continue; }
        const safe = safeUrl(v, { image: k === 'src' || k === 'poster' });
        if (safe || v === '') kept.push([k, safe]); else removed.add(`URL perigosa em ${k}`);
        continue;
      }
      if (k === 'srcset') { if (!/javascript:|data:(?!image)/i.test(v)) kept.push([k, v]); continue; }
      kept.push([rawK, v]);
    }
    if (!iframeOk) {
      removed.add('<iframe> sem https');
      const end = /<\/iframe\s*>/ig;
      end.lastIndex = re.lastIndex;
      const e = end.exec(src);
      if (e) re.lastIndex = end.lastIndex;
      continue;
    }
    if (name === 'iframe') {
      const i = kept.findIndex(([k]) => k === 'sandbox');
      if (i >= 0) kept.splice(i, 1);
      kept.push(['sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation'], ['loading', 'lazy']);
    }
    if (name === 'a' && kept.some(([k, v]) => k === 'target' && v === '_blank') && !kept.some(([k]) => k === 'rel')) kept.push(['rel', 'noopener noreferrer']);
    const attrText = kept.map(([k, v]) => (v === null ? ` ${k}` : ` ${k}="${escapeAttr(v)}"`)).join('');
    out += `<${tag}${attrText}${/\/\s*>$/.test(tok) && !VOID.has(name) && name !== 'iframe' ? ' /' : ''}>`;
    // <iframe> fechado: não aceita conteúdo (o navegador mostraria como texto)
    if (name === 'iframe') {
      const end = /<\/iframe\s*>/ig;
      end.lastIndex = re.lastIndex;
      const e = end.exec(src);
      re.lastIndex = e ? end.lastIndex : src.length;
      out += '</iframe>';
    }
  }
  return { html: out, removed: [...removed] };
}

/** Lê `a="1" b='2' c=3 d` → [[a,'1'],[b,'2'],[c,'3'],[d,null]] (entidades &quot; etc. são decodificadas). */
function parseAttrs(text) {
  const out = [];
  const re = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[2] ?? m[3] ?? m[4];
    out.push([m[1], raw === undefined ? null : decodeEntities(raw)]);
  }
  return out;
}
const decodeEntities = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|quot|amp|lt|gt|apos|colon|tab|newline);?/gi, (_, e) => {
  const k = e.toLowerCase();
  if (k[0] === '#') { const n = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
  return { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", colon: ':', tab: '\t', newline: '\n' }[k];
});

// ------------------------------------------------------------------ CSS da página
/**
 * Lê uma folha de CSS em blocos (sem depender do navegador): regras `seletor { decls }` e at-rules com bloco
 * (`@media ... { regras }`) ou sem (`@import ...;`). Guarda a linha de cada bloco para as mensagens de erro.
 * @returns {{ blocks: object[], errors: {line:number, msg:string}[] }}
 *   bloco = { kind: 'rule', selector, body, line } | { kind: 'at', name, prelude, children?: bloco[], body?, line }
 */
export function parseCssBlocks(text) {
  const src = String(text ?? '').replace(/\r\n?/g, '\n');
  const errors = [];
  let i = 0;
  const lineAt = (pos) => src.slice(0, pos).split('\n').length;
  // pula comentários e espaços
  const skip = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
      return;
    }
  };
  /** Lê até `{`, `;` ou `}` no nível atual (respeitando aspas e parênteses). */
  const readPrelude = () => {
    const start = i;
    let depth = 0, q = '';
    while (i < src.length) {
      const c = src[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = ''; }
      else if (c === '"' || c === "'") q = c;
      else if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (depth <= 0 && (c === '{' || c === ';' || c === '}')) break;
      else if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
      i++;
    }
    return src.slice(start, i).trim();
  };
  /** Lê o corpo entre { } (já depois da `{`) sem interpretar; devolve o texto. */
  const readBody = () => {
    const start = i;
    let depth = 1, q = '';
    while (i < src.length) {
      const c = src[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = ''; }
      else if (c === '"' || c === "'") q = c;
      else if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (!depth) { const body = src.slice(start, i); i++; return body; } }
      i++;
    }
    return null;
  };
  const NESTED = /^@(media|supports|container|layer|document|scope|starting-style)\b/i;
  const parseList = (offset, until) => {
    const list = [];
    for (;;) {
      skip();
      if (i >= until) return list;
      if (src[i] === '}') { errors.push({ line: lineAt(i), msg: '"}" sobrando' }); i++; continue; }
      const at = i;
      const prelude = readPrelude();
      const line = lineAt(at);
      if (i >= src.length || src[i] === '}') {
        if (prelude) errors.push({ line, msg: `faltou "{" depois de "${prelude.slice(0, 40)}"` });
        if (src[i] === '}') i++;
        continue;
      }
      if (src[i] === ';') {
        i++;
        if (prelude.startsWith('@')) list.push({ kind: 'at', name: prelude.split(/[\s(]/)[0].slice(1).toLowerCase(), prelude, line });
        else errors.push({ line, msg: `declaração fora de uma regra: "${prelude.slice(0, 40)}" (escreva dentro de "seletor { ... }")` });
        continue;
      }
      // src[i] === '{'
      i++;
      if (NESTED.test(prelude)) {
        const bodyStart = i;
        const body = readBody();
        if (body === null) { errors.push({ line, msg: `faltou fechar "}" do bloco "${prelude.slice(0, 40)}"` }); return list; }
        const save = i;
        i = bodyStart;
        const children = parseList(bodyStart, bodyStart + body.length);
        i = save;
        list.push({ kind: 'at', name: prelude.split(/[\s(]/)[0].slice(1).toLowerCase(), prelude, children, line });
      } else {
        const body = readBody();
        if (body === null) { errors.push({ line, msg: `faltou fechar "}" da regra "${prelude.slice(0, 40)}"` }); return list; }
        if (prelude.startsWith('@')) list.push({ kind: 'at', name: prelude.split(/[\s(]/)[0].slice(1).toLowerCase(), prelude, body, line });
        else if (!prelude) errors.push({ line, msg: 'regra sem seletor' });
        else list.push({ kind: 'rule', selector: prelude, body, line, bodyLine: line });
      }
    }
  };
  const blocks = parseList(0, src.length);
  return { blocks, errors };
}

/**
 * Declarações de um corpo de regra `a: b; c: d` → [{prop, value, important, line}] (linha relativa ao corpo, 0 = 1ª).
 * Respeita aspas e parênteses (url(data:...;...) não quebra).
 */
export function parseDeclarations(body) {
  const out = [];
  const src = String(body ?? '').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  let start = 0, depth = 0, q = '';
  const push = (end) => {
    const part = src.slice(start, end);
    const lineOff = src.slice(0, start).split('\n').length - 1 + (part.match(/^\s*/)[0].split('\n').length - 1);
    const t = part.trim();
    start = end + 1;
    if (!t) return;
    const c = t.indexOf(':');
    if (c < 0) { out.push({ prop: t, value: '', important: false, line: lineOff, error: 'falta ":"' }); return; }
    let value = t.slice(c + 1).trim();
    const important = /!\s*important$/i.test(value);
    if (important) value = value.replace(/\s*!\s*important$/i, '');
    out.push({ prop: t.slice(0, c).trim().toLowerCase(), value, important, line: lineOff });
  };
  for (let k = 0; k < src.length; k++) {
    const c = src[k];
    if (q) { if (c === '\\') k++; else if (c === q) q = ''; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ';' && depth <= 0) push(k);
  }
  push(src.length);
  return out;
}

/** O valor de CSS é seguro (sem javascript:, expression(), quebra de <style>)? */
const unsafeCss = (s) => /javascript:|vbscript:|expression\s*\(|-moz-binding|behavior\s*:|<\/?\s*style/i.test(String(s).replace(/\\/g, ''));

/**
 * Reescreve um seletor para valer SÓ dentro do canvas do editor, onde cada camada é um <div> com
 * data-tag (etiqueta), data-cls (classes) e data-hid (id). `.card` → `:is([data-cls~="card"], .card)` (a 2ª forma pega o
 * HTML real das camadas "Código HTML"), `#topo` e `h1` do mesmo jeito; html/body/:root viram o próprio escopo. Pseudo-classes (:hover...) ficam como estão.
 */
export function scopeSelector(selector, scope) {
  return splitTop(selector, ',').map((part) => {
    let s = part.trim();
    if (!s) return '';
    let out = '';
    let k = 0;
    let rootHit = false;
    const identAt = (p) => /^-?[_a-zA-Z -￿][\w -￿-]*/.exec(s.slice(p));
    let prevBoundary = true; // início de seletor composto (pode vir uma etiqueta)
    while (k < s.length) {
      const c = s[k];
      if (c === '[') { const e = matchClose(s, k, '[', ']'); out += s.slice(k, e + 1); k = e + 1; prevBoundary = false; continue; }
      if (c === '"' || c === "'") { const e = s.indexOf(c, k + 1); out += s.slice(k, e < 0 ? s.length : e + 1); k = e < 0 ? s.length : e + 1; continue; }
      if (c === '.') { const m = identAt(k + 1); if (m) { out += `:is([data-cls~="${m[0]}"], .${m[0]})`; k += 1 + m[0].length; prevBoundary = false; continue; } }
      if (c === '#') { const m = identAt(k + 1); if (m) { out += `:is([data-hid="${m[0]}"], #${m[0]})`; k += 1 + m[0].length; prevBoundary = false; continue; } }
      if (c === ':') {
        const dbl = s[k + 1] === ':';
        const m = identAt(k + (dbl ? 2 : 1));
        const name = m ? m[0].toLowerCase() : '';
        if (!dbl && name === 'root') { out += scope; rootHit = true; k += 5; prevBoundary = false; continue; }
        out += s.slice(k, k + (dbl ? 2 : 1) + name.length);
        k += (dbl ? 2 : 1) + name.length;
        if (s[k] === '(') {
          const e = matchClose(s, k, '(', ')');
          const inner = s.slice(k + 1, e);
          // :not(h1) / :is(.a, .b) / :has(...) reescrevem o interior; :nth-child(2n+1), :lang(pt) não
          out += /^(not|is|where|has)$/.test(name) ? `(${scopeSelector(inner, '').trim()})` : `(${inner})`;
          k = e + 1;
        }
        prevBoundary = false;
        continue;
      }
      if (/[\s>+~]/.test(c)) { out += c; k++; prevBoundary = true; continue; }
      if (c === '*') { out += c; k++; prevBoundary = false; continue; }
      if (prevBoundary) {
        const m = identAt(k);
        if (m) {
          const t = m[0].toLowerCase();
          if (t === 'html' || t === 'body') { out += scope || '*'; rootHit = true; }
          else out += `:is([data-tag="${t}"], ${t})`;
          k += m[0].length;
          prevBoundary = false;
          continue;
        }
      }
      out += c; k++; prevBoundary = false;
    }
    if (!scope) return out;
    if (!rootHit) return `${scope} ${out}`;
    // "html body .x" → ".world .world .x" → ".world .x"
    const twice = `${scope} ${scope}`;
    while (out.includes(twice)) out = out.replace(twice, scope);
    return out;
  }).filter(Boolean).join(', ');
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function matchClose(s, k, open, close) {
  let d = 0;
  for (let j = k; j < s.length; j++) { if (s[j] === open) d++; else if (s[j] === close && !--d) return j; }
  return s.length - 1;
}
function splitTop(s, sep) {
  const out = [];
  let d = 0, start = 0, q = '';
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (q) { if (c === q) q = ''; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '(' || c === '[') d++;
    else if (c === ')' || c === ']') d--;
    else if (c === sep && !d) { out.push(s.slice(start, k)); start = k + 1; }
  }
  out.push(s.slice(start));
  return out;
}

/** Monta o texto de uma lista de blocos de volta (com transformação do seletor e das declarações). */
function printBlocks(blocks, { selector = (s) => s, decls = (d) => d, indent = '' } = {}) {
  const out = [];
  for (const b of blocks) {
    if (b.kind === 'rule') {
      const sel = selector(b.selector);
      const body = decls(parseDeclarations(b.body).filter((d) => !d.error && d.prop && d.value && !unsafeCss(d.value)));
      if (!sel || !body.length) continue;
      out.push(`${indent}${sel} {\n${body.map((d) => `${indent}  ${d.prop}: ${d.value}${d.important ? ' !important' : ''};`).join('\n')}\n${indent}}`);
    } else if (b.children) {
      if (unsafeCss(b.prelude)) continue;
      const inner = printBlocks(b.children, { selector, decls, indent: indent + '  ' });
      if (inner) out.push(`${indent}${b.prelude} {\n${inner}\n${indent}}`);
    } else if (b.body != null) {
      // @keyframes, @font-face, @property, @page: copiados como estão (só sem nada perigoso)
      if (unsafeCss(b.prelude) || unsafeCss(b.body)) continue;
      if (!/^(keyframes|-webkit-keyframes|font-face|property|counter-style|font-feature-values|page)$/.test(b.name)) continue;
      out.push(`${indent}${b.prelude} {${b.body.replace(/\s+$/, '')}\n${indent}}`);
    } else if (b.name === 'import') {
      // @import só de fontes (Google Fonts e afins, https)
      if (/^@import\s+(url\()?\s*['"]?https:\/\//i.test(b.prelude) && !unsafeCss(b.prelude)) out.push(`${indent}${b.prelude};`);
    }
  }
  return out.join('\n\n');
}

/**
 * CSS da página pronto para o ARQUIVO EXPORTADO (e a apresentação): o mesmo texto, relido e reescrito sem
 * nada perigoso (javascript:, expression(), "</style>"). @import só de https vai para o topo (exigência do CSS).
 */
export function safePageCss(text) {
  if (!text || !String(text).trim()) return '';
  const { blocks } = parseCssBlocks(text);
  const imports = blocks.filter((b) => b.name === 'import');
  const rest = blocks.filter((b) => b.name !== 'import');
  return [printBlocks(imports), printBlocks(rest)].filter(Boolean).join('\n\n').replace(/<\//g, '<\\/');
}

/**
 * CSS da página para o CANVAS do editor: cada seletor só vale dentro de `scope` (ver scopeSelector) e as
 * declarações ganham !important, porque no canvas o estilo de cada camada é inline (venceria qualquer regra).
 * @imports ficam no topo (fontes).
 */
export function scopePageCss(text, scope = '.world') {
  if (!text || !String(text).trim()) return '';
  const { blocks } = parseCssBlocks(text);
  const imports = blocks.filter((b) => b.name === 'import');
  const rest = blocks.filter((b) => b.name !== 'import');
  const body = printBlocks(rest, {
    selector: (s) => scopeSelector(s, scope),
    decls: (list) => list.map((d) => ({ ...d, important: true })),
  });
  return [printBlocks(imports), body].filter(Boolean).join('\n\n').replace(/<\//g, '<\\/');
}

/**
 * Confere uma folha de CSS: erros de estrutura (chaves) e, se `supports` for dado (CSS.supports do navegador),
 * propriedades/valores que o navegador não entende. Devolve mensagens com o número da linha.
 * @param {string} text
 * @param {(prop:string, value:string) => boolean} [supports]
 * @returns {{line:number, msg:string, level:'error'|'warn'}[]}
 */
export function lintCss(text, supports) {
  const { blocks, errors } = parseCssBlocks(text);
  const out = errors.map((e) => ({ ...e, level: 'error' }));
  const src = String(text ?? '').replace(/\r\n?/g, '\n');
  const walk = (list) => {
    for (const b of list) {
      if (b.children) walk(b.children);
      if (b.kind !== 'rule') continue;
      // linha da `{` + linhas dentro do corpo
      const open = src.split('\n').slice(0, b.line - 1).join('\n').length + (b.line > 1 ? 1 : 0);
      const braceLine = b.line + (src.slice(open, src.indexOf('{', open)).split('\n').length - 1);
      for (const d of parseDeclarations(b.body)) out.push(...checkDecl(d, braceLine + d.line, supports));
    }
  };
  walk(blocks);
  return out.sort((a, b) => a.line - b.line);
}

/** Confere UMA declaração (usada pelo lintCss e pelo editor de CSS da camada). */
export function checkDecl(d, line, supports) {
  if (d.error) return [{ line, level: 'error', msg: `"${d.prop.slice(0, 40)}": ${d.error}` }];
  if (!d.value) return [{ line, level: 'error', msg: `"${d.prop}" está sem valor` }];
  if (/\n\s*-?[a-z][a-z-]*\s*:/.test(d.value)) return [{ line, level: 'error', msg: `faltou ";" no fim da linha de "${d.prop}"` }];
  if (!/^(--[\w-]+|-?[a-z][a-z0-9-]*)$/.test(d.prop)) return [{ line, level: 'error', msg: `nome de propriedade inválido: "${d.prop.slice(0, 40)}"` }];
  if (unsafeCss(d.value)) return [{ line, level: 'error', msg: `valor bloqueado por segurança em "${d.prop}"` }];
  if (supports && !d.prop.startsWith('--') && !/var\(|env\(|attr\(/.test(d.value) && !supports(d.prop, d.value)) {
    return [{ line, level: 'warn', msg: `o navegador não entende "${d.prop}: ${d.value.slice(0, 60)}"` }];
  }
  return [];
}

// ------------------------------------------------------------------ atributos HTML das camadas
/** Valores aceitos em alguns atributos (lista fechada: o texto vai para o HTML). */
export const LINK_TARGETS = ['_self', '_blank', '_parent', '_top'];
export const BUTTON_TYPES = ['button', 'submit', 'reset'];
/** Campos da camada que viram atributos (todos opcionais). */
export const ATTR_KEYS = ['htmlId', 'classes', 'title', 'role', 'target', 'rel', 'buttonType', 'dateTime', 'cite', 'lang'];

/** Id válido de HTML/CSS (letra primeiro; letras, números, - e _). '' se inválido. */
export const cleanId = (v) => (/^[A-Za-z][\w-]{0,63}$/.test(String(v ?? '').trim()) ? String(v).trim() : '');
/** Lista de classes extras válidas (sem duplicadas). */
export const cleanClasses = (v) => [...new Set(String(v ?? '').split(/\s+/).filter((c) => /^-?[A-Za-z_][\w-]{0,63}$/.test(c)))];

/**
 * Atributos extras de uma camada, já escapados, prontos para entrar na etiqueta (cada um começa com espaço).
 * A classe da camada (gerada) e o href/aria-label continuam no gerador (css.js); aqui ficam os novos.
 * @param {object} node
 * @param {string} tag  etiqueta efetiva no HTML exportado
 */
export function htmlAttrs(node, tag) {
  let out = '';
  const id = cleanId(node.htmlId);
  if (id) out += ` id="${id}"`;
  if (node.title) out += ` title="${escapeAttr(String(node.title).slice(0, 300))}"`;
  if (node.role && /^[a-z]+( [a-z]+)*$/.test(node.role)) out += ` role="${node.role}"`;
  if (node.lang && /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(node.lang)) out += ` lang="${node.lang}"`;
  if (tag === 'a') {
    const target = LINK_TARGETS.includes(node.target) ? node.target : '';
    if (target && target !== '_self') out += ` target="${target}"`;
    const rel = String(node.rel || '').split(/\s+/).filter((r) => /^[a-z-]+$/.test(r));
    if (target === '_blank' && !rel.includes('noopener')) rel.push('noopener', 'noreferrer');
    if (rel.length) out += ` rel="${rel.join(' ')}"`;
  }
  if (tag === 'time' && node.dateTime) out += ` datetime="${escapeAttr(node.dateTime)}"`;
  if ((tag === 'blockquote' || tag === 'q') && node.cite) { const u = safeUrl(node.cite); if (u) out += ` cite="${escapeAttr(u)}"`; }
  return out;
}
