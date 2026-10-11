// TOKENS DO DESIGN: os estilos de cor (com modos claro/escuro), os estilos de texto e as variáveis de tamanho do
// projeto, exportados para quem vai construir o código (CSS, JSON ou Tailwind). Função pura: não altera nada.
import { slugify } from './model.js';
import { colorVarNames, rgba } from './css.js';
import { modesOf, styleValue, varCssNames, varsOf } from './modes.js';

export type TokenFormat = 'css' | 'json' | 'tailwind';
export interface TokenFile { path: string; content: string }

const colorOf = (v: { color: string; opacity?: number }) => rgba(v.color, v.opacity ?? 1);
const quote = (family: string) => (/^[\w-]+$/.test(family) ? family : `'${String(family).replace(/'/g, '')}'`);

/** Declarações CSS de um estilo de texto. */
function textDecls(t: any): string[] {
  const d: string[] = [];
  if (t.fontFamily) d.push(`font-family: ${quote(t.fontFamily)}, sans-serif`);
  if (t.fontSize != null) d.push(`font-size: ${t.fontSize}px`);
  if (t.fontWeight != null) d.push(`font-weight: ${t.fontWeight}`);
  if (t.fontStyle && t.fontStyle !== 'normal') d.push(`font-style: ${t.fontStyle}`);
  if (t.lineHeight != null) d.push(`line-height: ${t.lineHeight}`);
  if (t.letterSpacing) d.push(`letter-spacing: ${t.letterSpacing}px`);
  if (t.wordSpacing) d.push(`word-spacing: ${t.wordSpacing}px`);
  return d;
}

/** Nomes únicos (sem acento, com hífens) para uma lista de estilos de texto: id → "titulo". */
function textNames(texts: any[]) {
  const out = new Map<string, string>();
  const used = new Map<string, number>();
  for (const t of texts) {
    const base = slugify(t.name || 'texto');
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    out.set(t.id, n === 1 ? base : `${base}-${n}`);
  }
  return out;
}

/** Tudo que o projeto define, já com nomes de CSS resolvidos. */
export function collectTokens(doc: any) {
  const styles = doc.styles || {};
  const modes = modesOf(styles);
  const cNames = colorVarNames(styles);
  const sNames = varCssNames(styles, slugify);
  const tNames = textNames(styles.texts || []);
  return {
    modes: modes.map((m: any) => ({ id: m.id, name: m.name, slug: slugify(m.name), scheme: m.scheme || null })),
    colors: (styles.colors || []).map((c: any) => ({
      id: c.id, name: c.name, cssVar: cNames.get(c.id)!, value: colorOf(styleValue(c, null)), hex: c.color,
      modes: Object.fromEntries(modes.filter((m: any) => c.modes?.[m.id]).map((m: any) => [slugify(m.name), colorOf(styleValue(c, m.id))])),
    })),
    sizes: varsOf(styles).map((v: any) => ({ id: v.id, name: v.name, cssVar: sNames.get(v.id)!, value: v.value })),
    texts: (styles.texts || []).map((t: any) => ({ id: t.id, name: t.name, className: `texto-${tNames.get(t.id)}`, slug: tNames.get(t.id)!, decls: textDecls(t), raw: t })),
  };
}

function css(doc: any): string {
  const t = collectTokens(doc);
  const out: string[] = [];
  const root = [...t.colors.map((c) => `  ${c.cssVar}: ${c.value};`), ...t.sizes.map((s) => `  ${s.cssVar}: ${s.value}px;`)];
  if (root.length) out.push(`:root {\n${root.join('\n')}\n}`);
  for (const m of t.modes) {
    const list = t.colors.filter((c) => c.modes[m.slug]).map((c) => `${c.cssVar}: ${c.modes[m.slug]};`);
    if (!list.length) continue;
    out.push(`:root[data-theme="${m.slug}"] {\n${list.map((l) => `  ${l}`).join('\n')}\n}`);
    if (m.scheme) out.push(`@media (prefers-color-scheme: ${m.scheme}) {\n  :root:not([data-theme]) {\n${list.map((l) => `    ${l}`).join('\n')}\n  }\n}`);
  }
  for (const x of t.texts) if (x.decls.length) out.push(`.${x.className} {\n${x.decls.map((d) => `  ${d};`).join('\n')}\n}`);
  return out.join('\n\n') + (out.length ? '\n' : '');
}

function json(doc: any): string {
  const t = collectTokens(doc);
  const tree = {
    $description: 'Tokens do design (formato próximo ao W3C Design Tokens).',
    color: Object.fromEntries(t.colors.map((c) => [c.name, { $type: 'color', $value: c.value, ...(Object.keys(c.modes).length ? { $modes: c.modes } : {}), $cssVar: c.cssVar }])),
    size: Object.fromEntries(t.sizes.map((s) => [s.name, { $type: 'dimension', $value: `${s.value}px`, $cssVar: s.cssVar }])),
    typography: Object.fromEntries(t.texts.map((x) => [x.name, {
      $type: 'typography',
      $value: Object.fromEntries(Object.entries({
        fontFamily: x.raw.fontFamily, fontSize: x.raw.fontSize != null ? `${x.raw.fontSize}px` : undefined, fontWeight: x.raw.fontWeight,
        fontStyle: x.raw.fontStyle, lineHeight: x.raw.lineHeight, letterSpacing: x.raw.letterSpacing ? `${x.raw.letterSpacing}px` : undefined,
      }).filter(([, v]) => v !== undefined)),
      $className: x.className,
    }])),
    modes: t.modes.map((m) => ({ name: m.name, key: m.slug, scheme: m.scheme })),
  };
  return JSON.stringify(tree, null, 2) + '\n';
}

/** Tailwind (v3): as cores apontam para as variáveis CSS, então os modos claro/escuro funcionam sem trabalho extra. */
function tailwind(doc: any): TokenFile[] {
  const t = collectTokens(doc);
  const colors = Object.fromEntries(t.colors.map((c) => [slugify(c.name), `var(${c.cssVar})`]));
  const spacing = Object.fromEntries(t.sizes.map((s) => [slugify(s.name), `var(${s.cssVar})`]));
  const fontSize = Object.fromEntries(t.texts.filter((x) => x.raw.fontSize != null).map((x) => [x.slug, [`${x.raw.fontSize}px`, {
    ...(x.raw.lineHeight != null ? { lineHeight: String(x.raw.lineHeight) } : {}),
    ...(x.raw.letterSpacing ? { letterSpacing: `${x.raw.letterSpacing}px` } : {}),
    ...(x.raw.fontWeight != null ? { fontWeight: String(x.raw.fontWeight) } : {}),
  }]]));
  const families = [...new Set(t.texts.map((x) => x.raw.fontFamily).filter(Boolean))] as string[];
  const fontFamily = Object.fromEntries(families.map((f) => [slugify(f), [f, 'sans-serif']]));
  const theme = { extend: { colors, spacing, fontSize, fontFamily } };
  return [
    { path: 'tailwind.config.js', content: `/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n  content: ['./**/*.html'],\n  theme: ${JSON.stringify(theme, null, 2).replace(/\n/g, '\n  ')},\n};\n` },
    { path: 'tokens.css', content: css(doc) },
  ];
}

/** Exporta os tokens do projeto. css/json: 1 arquivo; tailwind: tailwind.config.js + tokens.css (as variáveis que ele usa). */
export function exportTokens(doc: any, format: TokenFormat): TokenFile[] {
  if (format === 'css') return [{ path: 'tokens.css', content: css(doc) }];
  if (format === 'json') return [{ path: 'tokens.json', content: json(doc) }];
  if (format === 'tailwind') return tailwind(doc);
  throw new Error(`Formato "${format}" não existe. Use css, json ou tailwind.`);
}
