/** Consultas do projeto, catálogos e seleção, sem gravar o documento. */
import { tagOf, walk, DEFAULT_BREAKPOINTS } from '../../model.js';
import { generateCode, joinCss } from '../../css.js';
import { withDocumentBreakpoints } from '../../document-breakpoints.ts';
import { GOOGLE, SYSTEM_FONTS } from '../../fonts.js';
import { searchIcons } from '../../icons.js';
import { imageAssetCatalog } from '../../image-assets.js';
import { modesOf } from '../../modes.js';
import type { RunnerContext, ToolHandlers, ToolArgs } from './types.ts';
import { summarize } from './presentation.ts';
import { findLayers } from './search.ts';
export function createReadTools(ctx: RunnerContext): ToolHandlers {
  const { store, need, folder } = ctx;
  return {
    get_document({ depth = 3 } = {}) {
      const d = Math.max(0, Math.min(8, Number(depth) || 3));
      const doc = store.state.doc;
      const page = store.page();
      return {
        project: doc.name,
        pages: doc.pages.map((p) => ({ id: p.id, name: p.name, current: p.id === page.id, layers: p.children.length })),
        page: { id: page.id, name: page.name, layers: page.children.map((n) => summarize(n, d - 1)) },
        selection: store.ui.selection,
        colorStyles: (doc.styles?.colors || []).map((c) => ({ id: c.id, name: c.name, color: c.color })),
        textStyles: (doc.styles?.texts || []).map((t) => ({ id: t.id, name: t.name })),
        effectStyles: (doc.styles?.effects || []).map((e) => ({ id: e.id, name: e.name })),
        gradientStyles: (doc.styles?.gradients || []).map((g) => ({ id: g.id, name: g.name, type: g.type })),
        colorModes: modesOf(doc.styles).map((m) => ({ id: m.id, name: m.name, scheme: m.scheme })),
        sizeVars: (doc.styles?.vars || []).map((v) => ({ id: v.id, name: v.name, value: v.value })),
        breakpoints: (doc.breakpoints?.length ? doc.breakpoints : DEFAULT_BREAKPOINTS).map((b) => ({ id: b.id, name: b.name, maxWidth: b.max })),
        activeBreakpoint: store.ui.bp,
        hint: 'x/y são relativos ao pai. Camadas dentro de frames com layout são posicionadas pelo navegador (flex/grid).',
      };
    },
    get_comments({ id, page_id, unresolved_only = false } = {}) {
      const doc = store.state.doc;
      const nodePages = new Map();
      for (const page of doc.pages) walk(page.children, (node) => nodePages.set(node.id, page));
      const comments = (doc.comments || []).filter((comment) => {
        const page = nodePages.get(comment.nodeId);
        return page && (!id || comment.nodeId === id) && (!page_id || page.id === page_id) && (!unresolved_only || !comment.resolved);
      }).map((comment) => {
        const page = nodePages.get(comment.nodeId);
        const node = store.get(comment.nodeId);
        return { ...comment, page: { id: page.id, name: page.name }, layer: { id: node.id, name: node.name } };
      });
      return { count: comments.length, comments };
    },
    get_project_css() {
      return { css: store.state.doc.styles?.pageCss || '' };
    },
    list_assets({ query = '' } = {}) {
      const q = String(query).trim().toLowerCase();
      const assets = imageAssetCatalog(store.state.doc).filter((asset) => !q || [asset.name, asset.id, asset.format, ...asset.usedBy.map((x) => x.page)].some((value) => value.toLowerCase().includes(q)));
      return { count: assets.length, assets, hint: 'Use insert_asset com o id para reutilizar uma imagem. O conteúdo binário não é enviado na listagem.' };
    },
    get_layer({ id }) {
      const n = need(id);
      const { children, ...rest } = n;
      const parent = store.parentOf(id);
      return { ...rest, tag: tagOf(n), parent: parent ? { id: parent.id, name: parent.name, layout: parent.layout?.mode || null } : null, children: (children || []).map((c) => summarize(c, 0)) };
    },
    get_code({ id }) {
      const n = need(id);
      const doc = store.state.doc;
      // O CSS legado aceita styles, mas sua anotação JS descreve apenas root.
      const options = { styles: doc.styles };
      const gen = withDocumentBreakpoints(doc, () => generateCode([n], store.parentOf(id), doc.assets, options as Parameters<typeof generateCode>[3]));
      return { html: gen.html, css: joinCss([gen]) };
    },
    find_layers(args = {}) { return findLayers(store.state.doc, args); },
    get_selection() {
      return { layers: store.ui.selection.map((id) => store.get(id)).filter(Boolean).map((n) => summarize(n, 1)) };
    },
    select_layers({ ids = [] }) {
      const ok = ids.filter((id) => store.get(id));
      store.setSelection(ok);
      return { selected: ok };
    },
    search_icons({ query = '', limit = 20 }) {
      const all = searchIcons(query);
      return { count: all.length, icons: all.slice(0, Math.max(1, Math.min(60, Number(limit) || 20))) };
    },
    list_fonts({ query = '', category } = {}) {
      const q = String(query).toLowerCase();
      const out: { name: string; category: string; weights: number[] }[] = [];
      for (const [name, info] of GOOGLE) {
        if (category && info.category !== category) continue;
        if (q && !name.toLowerCase().includes(q)) continue;
        out.push({ name, category: info.category, weights: info.weights });
        if (out.length >= 40) break;
      }
      const system = SYSTEM_FONTS.filter((f) => !q || f.toLowerCase().includes(q));
      return { google: out, system, hint: 'Use o nome exato em fontFamily e um peso da lista em fontWeight.' };
    },
    async list_projects() {
      if (!folder) throw new Error('Sem servidor (npm start): não há pasta de projetos.');
      const list = await folder.list();
      return { open: store.ui.link?.file || null, projects: list.map((p) => ({ file: p.file, modified: new Date(p.modified).toISOString(), size: p.size })) };
    },
    switch_page({ id }) {
      const page = store.state.doc.pages.find((p) => p.id === id);
      if (!page) throw new Error(`Página "${id}" não existe (veja pages em get_document).`);
      store.switchPage(id);
      return { page: { id: page.id, name: page.name } };
    }
  };
}
