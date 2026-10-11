/** Busca de camadas por valores base, com páginas pequenas e orçamento de resposta. Sem DOM. */
import { tagOf } from '../../model.js';
import { hex } from './properties.ts';
import { summarize } from './presentation.ts';
import type { ToolArgs } from './types.ts';

export const DEFAULT_SEARCH_BYTES = 8192;
const bytesOf = (value: unknown) => new TextEncoder().encode(JSON.stringify(value, null, 2)).length;
const short = (value: unknown, limit: number) => {
  const chars: string[] = [];
  for (const char of String(value ?? '')) { chars.push(char); if (chars.length > limit) break; }
  return chars.length > limit ? chars.slice(0, limit - 1).join('') + '…' : chars.join('');
};

function* nodesIn(nodes: any[]): Generator<any> {
  for (const node of nodes) { yield node; if (node.children) yield* nodesIn(node.children); }
}

function matches(node: any, where: ToolArgs) {
  for (const [key, value] of Object.entries(where)) {
    if (key === 'fontFamily') { if (node.type !== 'text' || String(node.fontFamily ?? '').trim().toLowerCase() !== String(value).trim().toLowerCase()) return false; }
    else if (key === 'fontSize' || key === 'fontWeight') { if (node.type !== 'text' || Number(node[key]) !== value) return false; }
    else if (key === 'fillColor') { if (node.fill?.type !== 'solid' || hex(node.fill.color) !== hex(value)) return false; }
    else if (key === 'colorStyleId') { if (node.fill?.styleId !== value) return false; }
    else if (key === 'gradientStyleId') { if (node.fill?.gradientId !== value) return false; }
    else if (key === 'assetId') { if (node.fill?.assetId !== value && node.mediaAssetId !== value) return false; }
    else if (key === 'visible') { if ((node.visible !== false) !== value) return false; }
    else if (key === 'locked' || key === 'component') { if (!!node[key] !== value) return false; }
    else if (key === 'tag') { if (tagOf(node) !== value) return false; }
    else if (key === 'layoutMode') { if (node.layout?.mode !== value) return false; }
    else if (node[key] !== value) return false;
  }
  return true;
}

/** Inclui avisos do workspace no orçamento, sem perder alvos nem avançar o cursor sobre linhas omitidas. */
export function boundFindResponse(result: ToolArgs, maxBytes = DEFAULT_SEARCH_BYTES) {
  const out: ToolArgs = { ...result, layers: [...result.layers] };
  if (out.notice && bytesOf(out) > maxBytes) out.notice = 'O projeto mudou durante a sessão. Releia os dados antes de alterar.';
  while (bytesOf(out) > maxBytes && out.layers.length) {
    out.layers.pop();
    out.count = out.layers.length;
    out.hasMore = out.offset + out.count < out.total;
    out.nextOffset = out.hasMore ? out.offset + out.count : null;
  }
  if (bytesOf(out) > maxBytes || (!out.layers.length && result.layers.length)) throw new Error('Uma camada não cabe no limite de resposta. Aumente maxBytes (até 65536) ou use fields:"ids" e get_layer para detalhes.');
  return out;
}

export function findLayers(doc: any, { query = '', type, page_id, within_id, where = {}, limit = 20, offset = 0, fields = 'compact', maxBytes = DEFAULT_SEARCH_BYTES }: ToolArgs = {}) {
  if (page_id && !doc.pages.some((page) => page.id === page_id)) throw new Error(`Página "${page_id}" não existe. Consulte pages em get_document.`);
  let scoped: { page: any; root: any } | undefined;
  if (within_id) {
    for (const page of doc.pages) {
      let root: any;
      for (const node of nodesIn(page.children)) { if (node.id === within_id) { root = node; break; } }
      if (root) { scoped = { page, root }; break; }
    }
    if (!scoped) throw new Error(`Camada "${within_id}" não existe. Use find_layers ou get_document para achar o id certo.`);
  }
  const q = String(query).toLowerCase();
  const selected: Array<{ node: any; page: any }> = [];
  let total = 0;
  for (const page of doc.pages) {
    if ((page_id && page.id !== page_id) || (scoped && page !== scoped.page)) continue;
    for (const node of nodesIn(scoped ? [scoped.root] : page.children)) {
      if (type && node.type !== type) continue;
      if (q && !String(node.name ?? '').toLowerCase().includes(q) && !(node.type === 'text' && String(node.text ?? '').toLowerCase().includes(q))) continue;
      if (!matches(node, where)) continue;
      if (total >= offset && selected.length < limit) selected.push({ node, page });
      total++;
    }
  }
  const layers: ToolArgs[] = [];
  const response = () => ({ count: layers.length, total, offset, nextOffset: offset + layers.length < total ? offset + layers.length : null, hasMore: offset + layers.length < total, layers });
  for (const { node, page } of selected) {
    const row = fields === 'ids' ? { id: node.id }
      : fields === 'summary' ? { ...summarize(node, 0), name: short(node.name, 80), page: short(page.name, 60), page_id: page.id }
      : { id: node.id, name: short(node.name, 80), type: node.type, page_id: page.id, page: short(page.name, 60) };
    layers.push(row);
    if (bytesOf(response()) > maxBytes) {
      layers.pop();
      if (!layers.length) throw new Error('Uma camada não cabe no limite de resposta. Aumente maxBytes (até 65536) ou use fields:"ids" e get_layer para detalhes.');
      break;
    }
  }
  return response();
}
