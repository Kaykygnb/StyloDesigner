/** Inspeção textual: renderiza a tela inteira, entrega só o trecho pedido e não altera o modelo. */
import { DEFAULT_BREAKPOINTS } from '../../model.js';
import { boundPagedLayers, shortName } from './response-budget.ts';
import type { RunnerContext, ToolArgs } from './types.ts';

const BUDGET = 8192;
export function boundLayoutResponse(result: ToolArgs, maxBytes = BUDGET) {
  return boundPagedLayers(result, maxBytes, 'Uma medida não cabe no limite de resposta. Aumente maxBytes (até 65536) ou reduza o escopo com within_id e depth.');
}

export async function inspectLayoutReport(ctx: RunnerContext, { id, breakpoint, width, within_id, depth = 1, limit = 20, offset = 0, maxBytes = BUDGET }: ToolArgs) {
  const { store, need, inspectLayout } = ctx;
  if (breakpoint !== undefined && width !== undefined) throw new Error('Escolha breakpoint OU width, não os dois.');
  const original = need(id);
  const parent = store.parentOf(id);
  if (original.type !== 'frame' || (parent && (parent.type !== 'section' || store.parentOf(parent.id)))) throw new Error('id deve ser uma tela: frame na raiz da página ou dentro de uma seção da raiz. Use find_layers para localizar a tela e within_id para inspecionar um filho no contexto dela.');
  const source = store.state.doc;
  const bp = breakpoint === undefined ? null : (source.breakpoints?.length ? source.breakpoints : DEFAULT_BREAKPOINTS).find(b => b.id === breakpoint);
  if (breakpoint !== undefined && !bp) throw new Error(`Breakpoint "${breakpoint}" não existe. Consulte get_document para ver os disponíveis.`);
  const chosenWidth = width ?? bp?.preview ?? Math.round(original.w);
  if (!Number.isInteger(chosenWidth) || chosenWidth < 200 || chosenWidth > 4000) throw new Error('A largura de inspeção deve ser inteira, entre 200 e 4000 px. Use width ou ajuste a largura da tela/breakpoint.');
  if (!inspectLayout) throw new Error('inspect_layout precisa do Chromium no servidor para medir CSS. Medidas reais NÃO foram conferidas. Use get_layer/get_code para ler os dados base.');
  // Captura os dados usados pelo HTML antes do await: uma escrita concorrente não mistura nomes e estilos novos com medidas antigas.
  const root = structuredClone(original);
  const doc = { ...source, styles: structuredClone(source.styles), fonts: structuredClone(source.fonts), assets: { ...source.assets } };
  const all: Array<{ node: any; parentId: string | null }> = [];
  function walk(node: any, parentId: string | null) {
    all.push({ node, parentId });
    for (const child of node.children || []) walk(child, node.id);
  }
  walk(root, null);
  const scoped = within_id ? all.find(item => item.node.id === within_id) : all[0];
  if (!scoped) throw new Error('within_id não pertence à tela escolhida. Use find_layers com within_id da tela para localizar seus filhos.');
  const rows: Array<{ node: any; parentId: string | null; depth: number }> = [];
  function collect(node: any, parentId: string | null, level: number) {
    rows.push({ node, parentId, depth: level });
    if (level < depth) for (const child of node.children || []) collect(child, node.id, level + 1);
  }
  collect(scoped.node, scoped.parentId, 0);
  const selected = rows.slice(offset, offset + limit);
  const measured = await inspectLayout(root, doc, { width: chosenWidth, ids: selected.map(item => item.node.id), opaqueIds: all.filter(item => ['html', 'path', 'media'].includes(item.node.type)).map(item => item.node.id) });
  const byId = new Map(measured.layers.map(row => [row.id, row]));
  const layers = selected.map(item => {
    const data = byId.get(item.node.id);
    if (!data) throw new Error('O renderizador não devolveu uma camada solicitada. Repita a inspeção; medidas não foram confirmadas.');
    return { ...data, parentId: item.parentId, name: shortName(item.node.name, 80), type: item.node.type, depth: item.depth };
  });
  return boundLayoutResponse({
    screen: { id: root.id, name: shortName(root.name, 80) }, scopeId: scoped.node.id,
    ...(bp ? { breakpoint: bp.id } : {}), viewport: measured.viewport, root: measured.root, units: 'css-px', coordinates: 'screen-relative', includesTransforms: true,
    count: layers.length, total: rows.length, offset, nextOffset: offset + layers.length < rows.length ? offset + layers.length : null,
    hasMore: offset + layers.length < rows.length, layers,
    note: 'Indícios geométricos, não erros; visible não confere oclusão. JS/rede externos desativados; fontes não hospedadas podem ser substituídas. Recomece a paginação após alterações.',
  }, maxBytes);
}
