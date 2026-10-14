// Conversor de HTML em JSX, feito para o HTML que o próprio Stylo gera (tags simples, classes, SVG inline, estilos em
// linha, elementos customizados). Não é um conversor de HTML qualquer: se achar algo que não entende (tag mal fechada,
// <script>, <style> no meio do corpo), LANÇA erro e quem chamou usa uma saída segura (dangerouslySetInnerHTML).

type Node = { tag: string; attrs: [string, string | null][]; children: Node[] } | { text: string } | { comment: string };

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

/** Atributos HTML cujo nome em React é diferente (chaves em minúsculas). */
const ATTR_NAMES: Record<string, string> = {
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', autoplay: 'autoPlay', playsinline: 'playsInline', readonly: 'readOnly',
  maxlength: 'maxLength', minlength: 'minLength', srcset: 'srcSet', crossorigin: 'crossOrigin', frameborder: 'frameBorder',
  allowfullscreen: 'allowFullScreen', contenteditable: 'contentEditable', spellcheck: 'spellCheck', autocomplete: 'autoComplete',
  colspan: 'colSpan', rowspan: 'rowSpan', cellpadding: 'cellPadding', cellspacing: 'cellSpacing', datetime: 'dateTime',
  enctype: 'encType', formaction: 'formAction', novalidate: 'noValidate', usemap: 'useMap', accesskey: 'accessKey',
  'accept-charset': 'acceptCharset', 'http-equiv': 'httpEquiv', referrerpolicy: 'referrerPolicy', fetchpriority: 'fetchPriority',
  controlslist: 'controlsList', disablepictureinpicture: 'disablePictureInPicture', inputmode: 'inputMode', itemprop: 'itemProp',
  'xlink:href': 'xlinkHref', 'xml:space': 'xmlSpace',
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', hellip: '…', mdash: '—', ndash: '–' };
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') {
    const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
  }
  return ENTITIES[e.toLowerCase()] ?? m;
});

// ---------------------------------------------------------------- leitura
function parse(html: string): Node[] {
  const root: { children: Node[] } = { children: [] };
  const stack: { tag: string; children: Node[] }[] = [root as any];
  const top = () => stack[stack.length - 1];
  let i = 0;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      if (end < 0) throw new Error('comentário sem fim');
      top().children.push({ comment: html.slice(i + 4, end) });
      i = end + 3;
    } else if (html[i] === '<' && html[i + 1] === '/') {
      const end = html.indexOf('>', i);
      const name = html.slice(i + 2, end).trim();
      if (end < 0 || stack.length < 2 || top().tag !== name) throw new Error(`</${name}> não fecha a tag aberta`);
      stack.pop();
      i = end + 1;
    } else if (html[i] === '<' && /[a-zA-Z]/.test(html[i + 1] || '')) {
      const m = /^<([a-zA-Z][\w:-]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/.exec(html.slice(i));
      if (!m) throw new Error('tag que não consegui ler');
      const tag = m[1];
      if (/^(script|style|textarea|title)$/i.test(tag)) throw new Error(`<${tag}> no meio do corpo`);
      const attrs: [string, string | null][] = [];
      for (const a of m[2].matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) attrs.push([a[1], a[2] ?? a[3] ?? a[4] ?? null]);
      const node = { tag, attrs, children: [] as Node[] };
      top().children.push(node);
      if (!m[3] && !VOID.has(tag.toLowerCase())) stack.push(node);
      i += m[0].length;
    } else {
      let end = html.indexOf('<', i + 1);
      if (end < 0) end = html.length;
      top().children.push({ text: html.slice(i, end) });
      i = end;
    }
  }
  if (stack.length > 1) throw new Error(`<${top().tag}> não foi fechada`);
  return root.children;
}

// ---------------------------------------------------------------- escrita
const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
const str = (v: string) => JSON.stringify(v);

/** "display:block;--x: 1" → { display: 'block', '--x': '1' }, escrito como objeto JS. */
function styleObject(css: string): string {
  const parts = css.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const at = d.indexOf(':');
    if (at < 0) throw new Error('estilo em linha ilegível');
    const prop = d.slice(0, at).trim(), value = d.slice(at + 1).trim();
    // propriedades com prefixo de navegador: -webkit-x → WebkitX, -ms-x → msX; o resto vira camelCase; --var fica como está
    const key = prop.startsWith('--') ? prop : camel(prop.replace(/^-ms-/, 'ms-').replace(/^-(webkit|moz|o)-/, (_m, p: string) => `${p[0].toUpperCase()}${p.slice(1)}-`));
    return `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : str(key)}: ${str(value)}`;
  });
  return `{{ ${parts.join(', ')} }}`;
}

export interface JsxOptions {
  /** Classes que existem no CSS Module da página: viram `styles['x']`; as outras ficam como texto. */
  moduleClasses?: Set<string>;
  /** Nome do objeto dos módulos CSS (padrão "styles"). */
  stylesName?: string;
  /** Troca de endereço (href/src): recebe o valor, devolve o novo (ou o mesmo). */
  rewriteUrl?: (name: string, value: string) => string;
  /** Atributo extra na raiz (ex.: ref={root}). */
  rootAttr?: string;
}

function attr(tag: string, name: string, value: string | null, o: JsxOptions): string | null {
  const lname = name.toLowerCase();
  const custom = tag.includes('-');
  if (/^on/i.test(name)) return null; // o HTML gerado não leva manipuladores; não inventamos nenhum
  if (name === 'xmlns' || /^xmlns:/.test(name)) return name === 'xmlns' ? `xmlns=${str(value ?? '')}` : null;
  if (lname === 'style' && value != null) return `style=${styleObject(decode(value))}`;
  if (lname === 'class') {
    const attrName = custom ? 'class' : 'className'; // elementos customizados (model-viewer) usam `class`
    const tokens = decode(value ?? '').split(/\s+/).filter(Boolean);
    const styles = o.stylesName ?? 'styles';
    const parts = tokens.map((t) => (o.moduleClasses?.has(t) ? `${styles}[${str(t)}]` : null));
    if (!o.moduleClasses || parts.every((p) => p === null)) return `${attrName}=${str(tokens.join(' '))}`;
    if (tokens.length === 1) return `${attrName}={${parts[0]}}`;
    return `${attrName}={[${tokens.map((t, i) => parts[i] ?? str(t)).join(', ')}].join(' ')}`;
  }
  const jsxName = custom ? name : (ATTR_NAMES[lname] ?? (/^(data|aria)-/i.test(name) ? name : name.includes('-') ? camel(name) : name));
  if (value == null) return jsxName;
  const decoded = o.rewriteUrl ? o.rewriteUrl(lname, decode(value)) : decode(value);
  return /["\\\r\n{}]/.test(decoded) ? `${jsxName}={${str(decoded)}}` : `${jsxName}="${decoded}"`;
}

function textJsx(raw: string): string | null {
  const text = decode(raw);
  if (!text.trim()) return /[\r\n]/.test(text) || !text ? null : '{" "}';
  return /^[^{}<>&\r\n]+$/.test(text) ? text : `{${str(text)}}`;
}

function emit(nodes: Node[], tabs: number, o: JsxOptions, isRoot: boolean): string[] {
  const pad = '  '.repeat(tabs);
  const out: string[] = [];
  for (const n of nodes) {
    if ('comment' in n) { out.push(`${pad}{/* ${n.comment.trim().replace(/\*\//g, '* /')} */}`); continue; }
    if ('text' in n) { const t = textJsx(n.text); if (t) out.push(pad + t); continue; }
    const attrs = n.attrs.map(([k, v]) => attr(n.tag, k, v, o)).filter((a): a is string => !!a);
    if (isRoot && o.rootAttr) attrs.push(o.rootAttr);
    const open = `${n.tag}${attrs.length ? ' ' + attrs.join(' ') : ''}`;
    if (!n.children.length) { out.push(`${pad}<${open} />`); continue; }
    const inner = emit(n.children, tabs + 1, o, false);
    out.push(inner.length ? `${pad}<${open}>\n${inner.join('\n')}\n${pad}</${n.tag}>` : `${pad}<${open} />`);
  }
  return out;
}

/** Converte um trecho HTML em JSX (uma linha por elemento). Lança se não entender o HTML. */
export function htmlToJsx(html: string, options: JsxOptions = {}, tabs = 0): string {
  const nodes = parse(html).filter((n) => !('text' in n) || n.text.trim());
  const elements = nodes.filter((n) => 'tag' in n);
  const single = elements.length === 1 && nodes.filter((n) => !('comment' in n)).length === 1;
  const body = emit(nodes, single ? tabs : tabs + 1, options, single).join('\n');
  if (single) return body;
  return `${'  '.repeat(tabs)}<>\n${body}\n${'  '.repeat(tabs)}</>`;
}

/** Nomes das classes definidas num CSS (`.caixa`, `.menu-item`), ignorando url(...) e textos entre aspas. */
export function cssClasses(css: string): Set<string> {
  const clean = css.replace(/url\([^)]*\)/g, '').replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Set<string>();
  for (const m of clean.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) out.add(m[1]);
  return out;
}
