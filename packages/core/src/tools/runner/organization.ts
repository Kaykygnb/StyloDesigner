/** Organização por MCP, reutilizando comandos de geometria sem alterar o editor. */
import { hasLayout } from '../../model.js';
import type { RunnerContext, ToolArgs, ToolHandlers } from './types.ts';

export const MAX_ORGANIZATION_IDS = 100;
const ALIGNMENTS = ['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom'];
const GEOMETRIC = ['align_layers', 'distribute_layers', 'group_layers', 'ungroup_layers'];

const POSITIONAL = new Set(['x','y','w','h','rotation','scale','layout','sizeX','sizeY','minW','maxW','minH','maxH','absolute','margin','grow','alignSelf','justifySelf','aspect']);
function hasPositionOverrides(node: any): boolean {
  return ['bps','states'].some(key => Object.values(node[key] || {}).some((view: any) => Object.keys(view).some(prop => POSITIONAL.has(prop)))) || (node.children || []).some(hasPositionOverrides);
}
function hasContainerEffects(node: any): boolean {
  return node.visible === false || !!node.customCss || !!node.isMask || !!node.children?.some((child: any) => child.isMask) || !!node.stroke || (node.fill?.type && node.fill.type !== 'none') || !!node.href || !!node.role || !!node.alt || (node.tag && node.tag !== 'div') || (node.overflow && node.overflow !== 'visible') || (node.opacity ?? 1) !== 1 || !!node.rotation || !!node.blur || !!node.bgBlur || !!node.effectStyleId || !!node.shadows?.length || !!node.clip || !!node.clipContent || (node.blend && node.blend !== 'normal') || !!node.interactions?.length || hasLayout(node) || Object.keys(node.bps || {}).length > 0 || Object.keys(node.states || {}).length > 0;
}

/** Valida tudo antes da aprovação; handlers repetem a validação após o await. */
export function prepareOrganization(ctx: RunnerContext, tool: string, args: ToolArgs): ToolArgs {
  const { store, commands, need } = ctx;
  if (tool === 'rename_page' || tool === 'reorder_page') {
    const page = store.state.doc.pages.find((item) => item.id === args.id);
    if (!page) throw new Error(`Página "${args.id}" não existe. Veja get_document.`);
    if (tool === 'rename_page') validateName(args.name);
    else validateIndex(args.index, store.state.doc.pages.length);
    return { page };
  }
  const ids = tool === 'reorder_layer' ? [args.id] : args.ids;
  const minimum = tool === 'distribute_layers' ? 3 : tool === 'group_layers' ? 2 : 1;
  if (!Array.isArray(ids) || ids.length < minimum || ids.length > MAX_ORGANIZATION_IDS) throw new Error(`ids: envie de ${minimum} a ${MAX_ORGANIZATION_IDS} camadas.`);
  if (new Set(ids).size !== ids.length) throw new Error('ids: cada camada deve aparecer uma única vez.');
  const nodes = ids.map(need);
  const entries = nodes.map((node) => store.entry(node.id));
  if (entries.some((entry) => entry.page !== entries[0].page)) throw new Error('Use camadas da mesma página.');
  if (entries[0].page !== store.page()) throw new Error('Abra a página dessas camadas antes de organizar.');
  if (ids.some((id) => ids.some((other) => other !== id && store.isAncestor(other, id)))) throw new Error('Não selecione pai e filho no mesmo pedido.');
  if (entries.some((entry) => entry.parent !== entries[0].parent)) throw new Error('Use camadas irmãs, com o mesmo pai.');
  if (GEOMETRIC.includes(tool)) {
    if (['group_layers', 'ungroup_layers'].includes(tool) && entries.some((entry) => hasLayout(entry.parent))) throw new Error('Agrupar ou desagrupar dentro de flex/grid mudaria o fluxo. Use layout do pai ou mova as camadas para um pai livre antes.');
    if (entries.some((entry) => hasLayout(entry.parent) && !entry.node.absolute)) throw new Error('Camadas em fluxo flex/grid têm posição definida pelo layout. Use update_layers para ajustar layout, gap, padding ou alinhamento do pai.');
    for (const node of nodes) {
      for (let parent = store.parentOf(node.id); parent; parent = store.parentOf(parent.id)) {
        if (parent.rotation) throw new Error('A geometria de ancestrais girados não é exata no servidor. Organize as camadas antes de girar o pai.');
      }
    }
  }
  if (['group_layers','ungroup_layers','reorder_layer'].includes(tool)) {
    for (const node of nodes) for (let parent = store.parentOf(node.id); parent; parent = store.parentOf(parent.id)) if (parent.instanceOf) throw new Error('Organize a estrutura do componente principal, não os filhos de uma instância.');
  }
  if (['group_layers','ungroup_layers'].includes(tool) && nodes.some(hasPositionOverrides)) throw new Error('Sobrescritas posicionais de breakpoint/estado não podem ser preservadas por este agrupamento. Organize antes de definir essas variações.');
  const method = tool === 'align_layers' ? 'align' : tool === 'distribute_layers' ? 'distribute' : tool === 'group_layers' ? 'group' : tool === 'ungroup_layers' ? 'ungroup' : 'reorder';
  if (tool !== 'reorder_layer' && typeof commands[method] !== 'function') throw new Error(`O comando ${method} não está disponível neste ambiente.`);
  if (tool === 'align_layers' && !ALIGNMENTS.includes(args.alignment)) throw new Error(`alignment: use ${ALIGNMENTS.join(', ')}.`);
  if (tool === 'align_layers' && nodes.length === 1 && !entries[0].parent) throw new Error('Para alinhar uma camada sozinha, ela precisa estar dentro de um pai. Na raiz, selecione duas ou mais camadas.');
  if (tool === 'distribute_layers' && !['h', 'v'].includes(args.axis)) throw new Error('axis: use h (horizontal) ou v (vertical).');
  if (tool === 'group_layers') {
    const positions = nodes.map(node => entries[0].list.indexOf(node)).sort((a,b)=>a-b);
    if (positions.some((position,index)=>index>0 && position !== positions[index-1]+1)) throw new Error('Agrupe apenas irmãs consecutivas; agrupar camadas intercaladas mudaria a ordem visual. Reordene primeiro se essa mudança for intencional.');
    if (['ul','ol'].includes(entries[0].parent?.tag)) throw new Error('Agrupar itens dentro de ul/ol mudaria a estrutura da lista HTML. Use uma caixa externa ou organize os itens diretamente.');
    if (entries[0].parent?.type === 'section' || (!entries[0].parent && nodes.some(node => node.type === 'frame'))) throw new Error('Não agrupe telas raiz nem crie grupos dentro de seções: isso esconderia telas na exportação. Agrupe filhos dentro de uma tela.');
    if (nodes.some((node) => node.type === 'section')) throw new Error('Seções não podem entrar em grupos.');
    if (args.name !== undefined) validateName(args.name);
  }
  if (tool === 'ungroup_layers') {
    if (nodes.some((node) => !['group', 'section'].includes(node.type) || node.component || node.instanceOf)) throw new Error('Desagrupe apenas grupos ou seções; componentes e instâncias não são aceitos.');
    if (nodes.some((node) => node.rotation)) throw new Error('Não é possível preservar posições ao desagrupar um grupo girado. Remova a rotação antes.');
    if (nodes.some(hasContainerEffects)) throw new Error('Desagrupar removeria efeitos, recorte, interação ou variações do contêiner. Remova essas propriedades explicitamente primeiro.');
  }
  if (tool === 'reorder_layer') validateIndex(args.index, entries[0].list.length);
  return { nodes, entries };
}
function validateIndex(index: number, length: number) {
  if (!Number.isInteger(index) || index < 0 || index >= length) throw new Error(`index: use um inteiro entre 0 e ${length - 1}.`);
}
function validateName(name: string) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 60) throw new Error('name: use um nome não vazio de até 60 caracteres.');
}

/** Comandos legados são síncronos; o runner faz o commit único ao término. */
function withSelection(ctx: RunnerContext, ids: string[], keepSelection: boolean, action: () => any) {
  const { store } = ctx;
  const previous = [...store.state.ui.selection];
  const commit = store.commit;
  store.setSelection(ids);
  store.commit = () => {};
  let succeeded = false;
  try { const result = action(); succeeded = true; return result; }
  finally {
    store.commit = commit;
    if (!keepSelection || !succeeded) store.setSelection(previous.filter((id) => store.get(id)));
  }
}

export function createOrganizationTools(ctx: RunnerContext): ToolHandlers {
  const { store, commands } = ctx;
  return {
    align_layers(args) {
      const { nodes } = prepareOrganization(ctx, 'align_layers', args);
      withSelection(ctx, args.ids, false, () => commands.align(args.alignment));
      return { count: nodes.length, aligned: nodes.slice(0, 20).map(node => ({id: node.id})), truncated: nodes.length > 20 };
    },
    distribute_layers(args) {
      const { nodes } = prepareOrganization(ctx, 'distribute_layers', args);
      withSelection(ctx, args.ids, false, () => commands.distribute(args.axis));
      return { count: nodes.length, distributed: nodes.slice(0, 20).map(node => ({id: node.id})), truncated: nodes.length > 20 };
    },
    group_layers(args) {
      prepareOrganization(ctx, 'group_layers', args);
      withSelection(ctx, args.ids, true, () => {
        commands.group();
        if (args.name !== undefined) store.update(() => { store.selected()[0].name = args.name.trim(); });
      });
      const group = store.selected()[0];
      return { group: { id: group.id, name: group.name, childCount: group.children.length, children: group.children.slice(0, 20).map((node) => node.id) }, selected: [...store.state.ui.selection] };
    },
    ungroup_layers(args) {
      prepareOrganization(ctx, 'ungroup_layers', args);
      withSelection(ctx, args.ids, true, () => commands.ungroup());
      return { count: store.selected().length, children: store.selected().slice(0, 20).map(node => ({id: node.id})), selected: store.state.ui.selection.slice(0, 20), truncated: store.selected().length > 20 };
    },
    reorder_layer(args) {
      const { entries } = prepareOrganization(ctx, 'reorder_layer', args);
      const { list, node } = entries[0];
      const initial = list.indexOf(node);
      // O comando legado só aceita passos/front/back. Índice exato usa uma única edição,
      // evitando milhares de chamadas quando a lista de irmãs é grande.
      if (initial !== args.index) store.update(() => {
        list.splice(initial, 1); list.splice(args.index, 0, node);
      }, { structural: true });
      return { id: args.id, index: args.index, changed: initial !== args.index };
    },
    rename_page(args) {
      const { page } = prepareOrganization(ctx, 'rename_page', args);
      store.update(() => { page.name = args.name.trim(); });
      return { id: page.id, name: page.name };
    },
    reorder_page(args) {
      const { page } = prepareOrganization(ctx, 'reorder_page', args);
      store.update(() => {
        const pages = store.state.doc.pages;
        pages.splice(pages.indexOf(page), 1); pages.splice(args.index, 0, page);
      }, { structural: true });
      return { id: page.id, index: args.index };
    },
  };
}
