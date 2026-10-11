/**
 * Exporta as pranchetas visíveis do documento como páginas HTML independentes.
 * Este módulo não toca no DOM nem inicia downloads: a UI e o MCP podem reutilizar o mesmo resultado.
 */
import { exportHtml } from './css.js';
import { DEFAULT_BREAKPOINTS, isBoard, slugify } from './model.js';
import { parseDataUrl, parseImageDataUrl } from './image-size.js';
import { extensionFor } from './asset-kinds.js';
import { addMediaRuntime, type VendorProvider } from './media-runtime.ts';

/** Um arquivo do pacote: texto (HTML) ou bytes (imagens). */
export interface SiteFile { path: string; content: string | Uint8Array }

const IMAGE_EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

/** Hash curto e estável (FNV-1a de 32 bits) do conteúdo: o mesmo arquivo sempre ganha o mesmo nome. */
const fnv = (bytes: Uint8Array) => {
  let h = 0x811c9dc5;
  for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
};
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Troca cada imagem embutida (data URL) por um ARQUIVO em `assets/` e o caminho relativo no HTML. Site de verdade não
 * deve levar megabytes de base64 dentro do CSS: arquivos têm cache, nome estável e funcionam com qualquer empacotador.
 * Só entram as imagens que as páginas usam; a mesma imagem vira um arquivo só.
 */
export function externalizeAssets(files: SiteFile[], assets: Record<string, unknown> = {}): SiteFile[] {
  const replacements: [string, string][] = [];
  const out = new Map<string, Uint8Array>();
  for (const src of Object.values(assets)) {
    if (typeof src !== 'string' || !src.startsWith('data:')) continue;
    const escaped = escapeHtml(src);
    if (!files.some((f) => typeof f.content === 'string' && (f.content.includes(src) || f.content.includes(escaped)))) continue;
    const parsed = parseImageDataUrl(src) || (() => {
      const any = parseDataUrl(src);
      return any ? { bytes: any.bytes, info: { mime: any.declared || 'application/octet-stream' } } : null;
    })();
    if (!parsed) continue;
    const ext = IMAGE_EXT[parsed.info.mime] || extensionFor(parsed.info.mime);
    const prefix = String(parsed.info.mime).startsWith('image/') ? 'img' : 'media';
    let path = `assets/${prefix}-${fnv(parsed.bytes)}.${ext}`;
    // nome igual com conteúdo diferente (colisão do hash curto, raríssimo): acrescenta o tamanho
    if (out.has(path) && out.get(path)!.length !== parsed.bytes.length) path = `assets/${prefix}-${fnv(parsed.bytes)}-${parsed.bytes.length}.${ext}`;
    out.set(path, parsed.bytes);
    replacements.push([src, path], [escaped, path]);
  }
  if (!out.size) return files;
  const rewritten = files.map((f) => {
    if (typeof f.content !== 'string') return f;
    let content = f.content;
    for (const [from, to] of replacements) if (content.includes(from)) content = content.split(from).join(to);
    return { ...f, content };
  });
  return [...rewritten, ...[...out].map(([path, content]) => ({ path, content }))];
}

const boardsOf = (doc) => {
  const boards: any[] = [];
  const warnings: any[] = [];
  for (const page of doc.pages || []) {
    const found: any[] = [];
    const visitChildren = (layers, parent, ancestorsVisible) => {
      for (const layer of layers || []) {
        const visible = ancestorsVisible && layer.visible !== false;
        if (isBoard(layer, parent)) {
          if (visible) found.push(layer);
        } else if (layer.type === 'section') visitChildren(layer.children, layer, visible);
      }
    };
    visitChildren(page.children, null, true);
    if (!found.length) warnings.push(`A página “${page.name || 'Sem nome'}” não tem pranchetas visíveis para exportar.`);
    boards.push(...found);
  }
  if (!boards.length) throw new Error('O projeto não tem pranchetas visíveis para exportar.');
  return { boards, warnings };
};

const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const safeBaseName = (name) => {
  let base = slugify(name || 'pagina').slice(0, 120).replace(/-+$/, '') || 'pagina';
  if (WINDOWS_RESERVED.test(base)) base += '-page';
  return base;
};

const uniqueHtmlPath = (name, used) => {
  const base = safeBaseName(name);
  let path = `${base}.html`;
  let suffix = 2;
  while (used.has(path.toLowerCase())) path = `${base}-${suffix++}.html`;
  used.add(path.toLowerCase());
  return path;
};

const visit = (node, fn) => {
  fn(node);
  for (const child of node.children || []) visit(child, fn);
};

/**
 * @param {object} doc
 * @param {{ assets?: 'files' | 'inline' }} [options]  `files` (padrão): imagens como arquivos em assets/; `inline`: embutidas no HTML
 * @returns {{files: SiteFile[], warnings: string[]}}
 */
/** Nome de arquivo seguro para uma família de fonte ("Playfair Display" → "playfair-display"). */
const fontSlug = (family: string) => slugify(family || 'fonte').slice(0, 60) || 'fonte';

/**
 * FONTES HOSPEDADAS NO PROJETO (doc.fonts, via add_font): cada arquivo vira `fonts/<família>-<peso>-<estilo>-<alfabeto>.woff2`
 * e cada HTML ganha o @font-face correspondente (com unicode-range). Nada de CDN do Google no site exportado.
 */
export function addFonts(files: SiteFile[], doc: any): SiteFile[] {
  const fonts: any[] = Array.isArray(doc.fonts) ? doc.fonts : [];
  const out = new Map<string, Uint8Array>();
  const faces: string[] = [];
  for (const font of fonts) {
    for (const f of font.files || []) {
      const src = doc.assets?.[f.assetId];
      const parsed = typeof src === 'string' ? parseDataUrl(src) : null;
      if (!parsed) continue;
      const path = `fonts/${fontSlug(font.family)}-${f.weight}-${f.style}-${f.subset}.${f.ext || extensionFor('font/woff2')}`;
      out.set(path, parsed.bytes);
      const format = path.endsWith('.woff2') ? 'woff2' : path.endsWith('.woff') ? 'woff' : path.endsWith('.otf') ? 'opentype' : 'truetype';
      faces.push(`@font-face { font-family: '${String(font.family).replace(/'/g, '')}'; font-style: ${f.style}; font-weight: ${f.weight}; font-display: swap; src: url(${path}) format('${format}');${f.unicodeRange ? ` unicode-range: ${f.unicodeRange};` : ''} }`);
    }
  }
  if (!faces.length) return files;
  const style = `<style id="fontes-do-projeto">\n${faces.join('\n')}\n</style>\n`;
  const withFaces = files.map((f) => (typeof f.content === 'string' && f.content.includes('</head>') ? { ...f, content: f.content.replace('</head>', style + '</head>') } : f));
  return [...withFaces, ...[...out].map(([path, content]) => ({ path, content }))];
}

/** Créditos dos assets usados (doc.credits): um arquivo de texto no pacote, para cumprir as licenças. */
export function addCredits(files: SiteFile[], doc: any): SiteFile[] {
  const credits: { text: string; license?: string }[] = Array.isArray(doc.credits) ? doc.credits : [];
  if (!credits.length) return files;
  const lines = credits.map((c) => `- ${c.text}${c.license && !c.text.includes(c.license) ? ` — ${c.license}` : ''}`);
  return [...files, { path: 'CREDITS.txt', content: `Créditos dos assets usados neste site\n\n${lines.join('\n')}\n` }];
}

export function exportSite(doc, { assets = 'files', vendor = null, mediaRuntime = true }: { assets?: 'files' | 'inline'; vendor?: VendorProvider | null; mediaRuntime?: boolean } = {}): { files: SiteFile[]; warnings: string[] } {
  if (!doc || !Array.isArray(doc.pages)) throw new Error('Projeto inválido: páginas não encontradas.');
  const { boards, warnings } = boardsOf(doc);
  const used = new Set();
  let files: SiteFile[] = boards.map((board, index) => ({
    path: index === 0 ? (used.add('index.html'), 'index.html') : uniqueHtmlPath(board.name, used),
    content: exportHtml(board, doc.assets || {}, board.name || 'Página', doc.styles || null, { selfHosted: new Set((doc.fonts || []).map((f: any) => f.family)) } as any),
  }));
  const paths = new Map(files.map((file) => [file.path.toLowerCase(), file.path]));
  if (assets === 'files') files = externalizeAssets(files, doc.assets || {});
  files = addFonts(files, doc);
  if (mediaRuntime) files = addMediaRuntime(files, vendor, warnings);
  files = addCredits(files, doc);

  // Tela de largura FIXA maior que o menor aparelho do projeto vira rolagem horizontal no celular. Não mudamos o
  // padrão (alteraria exportações existentes): avisamos e dizemos onde ligar a largura fluida.
  const smallest = (doc.breakpoints?.length ? doc.breakpoints : DEFAULT_BREAKPOINTS).reduce((a, b) => (b.preview < a.preview ? b : a));
  for (const board of boards) {
    if (!board.fluid && board.sizeX !== 'hug' && board.w > smallest.preview) {
      warnings.push(`“${board.name || 'Página'}” tem largura fixa de ${Math.round(board.w)} px: em ${smallest.name.toLowerCase()} (${smallest.preview} px) ela vai rolar na horizontal. Ative “Largura fluida no site exportado” nas propriedades da tela.`);
    }
  }

  for (const board of boards) {
    const boardName = board.name || 'Página';
    visit(board, (node) => {
      if (node.interactions?.length) {
        warnings.push(`“${boardName}” contém interações de protótipo; elas não são executadas no site exportado.`);
      }
      if (node.tag === 'a' && typeof node.href === 'string') {
        const href = node.href.trim();
        const localHtml = /\.html(?:[?#].*)?$/i.test(href) && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
        if (localHtml) {
          const rawTarget = href.split(/[?#]/, 1)[0].replace(/^\.\//, '');
          const generatedPath = paths.get(rawTarget.toLowerCase());
          if (rawTarget.includes('/') || !generatedPath) warnings.push(`O link “${node.href}” em “${boardName}” não corresponde a um arquivo exportado.`);
          else if (rawTarget !== generatedPath) warnings.push(`O link “${node.href}” em “${boardName}” diferencia maiúsculas/minúsculas do arquivo “${generatedPath}”; ajuste o endereço.`);
        }
      }
    });
  }
  return { files, warnings: [...new Set(warnings)] };
}
