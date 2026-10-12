/** Arranjo de camadas (ordem, espelhar, envolver, máscara, componente, colar), reutilizando os comandos do editor. */
import type { RunnerContext, ToolArgs, ToolHandlers } from './types.ts';
import { withSelection } from './organization.ts';

const unique = (ids: string[]) => new Set(ids).size === ids.length;

/** Confere os ids (existem, na página aberta, sem repetir) e devolve as camadas. */
function target(ctx: RunnerContext, ids: string[]) {
  const { store, need } = ctx;
  if (!unique(ids)) throw new Error('ids: cada camada deve aparecer uma única vez.');
  const nodes = ids.map(need);
  for (const n of nodes) if (store.entry(n.id).page !== store.page()) throw new Error('Abra a página dessas camadas (switch_page) antes de organizar.');
  return nodes;
}

export function createArrangeTools(ctx: RunnerContext): ToolHandlers {
  const { store, commands, need } = ctx;
  const ids = () => [...store.state.ui.selection];
  return {
    arrange_layers({ ids: list, action }: ToolArgs) {
      const nodes = target(ctx, list);
      const run: Record<string, () => unknown> = {
        front: () => commands.reorder('front'),
        forward: () => commands.reorder('forward'),
        backward: () => commands.reorder('backward'),
        back: () => commands.reorder('back'),
        flip_h: () => commands.flip('x'),
        flip_v: () => commands.flip('y'),
        wrap_in_frame: () => commands.frameSelection(),
        toggle_auto_layout: () => commands.toggleAutoLayout(),
        create_component: () => commands.createComponent(),
        detach_instance: () => {
          if (!nodes.some((n) => n.instanceOf)) throw new Error('Nenhuma das camadas é uma cópia de componente (instância).');
          commands.detach();
        },
        toggle_mask: () => {
          const parent = store.parentOf(nodes[0].id);
          if (nodes.length < 2 && parent?.type !== 'group') throw new Error('Máscara: selecione duas ou mais camadas, ou uma camada que já esteja dentro de um grupo.');
          commands.toggleMask();
        },
      };
      if (action === 'toggle_auto_layout' && nodes.some((n) => n.type === 'section')) throw new Error('Seções não têm layout automático.');
      if (action === 'wrap_in_frame' && nodes.every((n) => n.type === 'section')) throw new Error('Seções não podem ser envolvidas num frame.');
      withSelection(ctx, list, true, run[action]);
      return { action, selected: ids().slice(0, 20), selectedCount: ids().length };
    },
    paste_layers({ ids: list, parent_id }: ToolArgs) {
      target(ctx, list);
      let into: any = null;
      if (parent_id) {
        into = need(parent_id);
        if (into.type !== 'frame') throw new Error('parent_id precisa ser um frame.');
        if (list.some((id: string) => id === parent_id || store.isAncestor(id, parent_id))) throw new Error('Não dá para colar uma camada dentro dela mesma.');
      }
      withSelection(ctx, list, true, () => { commands.copy(); });
      store.setSelection(into ? [into.id] : []);
      const before = store.state.ui.selection;
      const commit = store.commit;
      store.commit = () => {};
      try { commands.paste(); } finally { store.commit = commit; }
      const created = ids();
      if (!created.length || created.every((id) => before.includes(id))) throw new Error('Não consegui colar.');
      return { created: created.slice(0, 20), selected: created.slice(0, 20), count: created.length };
    },
    paste_style({ source_id, ids: list }: ToolArgs) {
      need(source_id);
      const nodes = target(ctx, list);
      withSelection(ctx, [source_id], false, () => { commands.copyStyle(); });
      const ok = withSelection(ctx, list, false, () => commands.pasteStyle());
      if (!ok) throw new Error('Nada para colar.');
      return { styled: nodes.slice(0, 20).map((n) => n.id), count: nodes.length };
    },
  };
}
