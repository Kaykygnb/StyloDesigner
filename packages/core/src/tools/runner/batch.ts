/** Alterações em lote: prepara cópias, valida tudo e publica uma única atualização. */
import { walk } from '../../model.js';
import { applyProps } from './properties.ts';
import { summarize } from './presentation.ts';
import type { RunnerContext, ToolArgs, ToolHandlers } from './types.ts';

export const MAX_LAYER_UPDATES = 100;
interface LayerUpdate { id: string; props: ToolArgs }

export function prepareLayerUpdates(ctx: RunnerContext, updates: LayerUpdate[]) {
  const { store, need, setLayoutMode, colorStyle, effectStyle, gradientStyle } = ctx;
  if (!Array.isArray(updates) || !updates.length || updates.length > MAX_LAYER_UPDATES) throw new Error(`updates: envie de 1 a ${MAX_LAYER_UPDATES} alterações {id, props}.`);
  const ids = new Set(updates.map((update) => update.id));
  if (ids.size !== updates.length) throw new Error('Cada id deve aparecer uma única vez no lote. Junte as propriedades dessa camada em um item.');
  const nodes = updates.map((update, index) => {
    try { return need(update.id); }
    catch (error: any) { throw new Error(`updates[${index}]: ${error.message}`); }
  });
  // Se pai e filho estão no lote, compartilham a mesma cópia. Resize/layout podem alterar filhos.
  const roots = nodes.filter((node) => {
    for (let parent = store.parentOf(node.id); parent; parent = store.parentOf(parent.id)) if (ids.has(parent.id)) return false;
    return true;
  });
  const originals = new Map<string, any>();
  walk(roots, (node) => originals.set(node.id, node));
  const staged = new Map<string, any>();
  walk(structuredClone(roots), (node) => staged.set(node.id, node));
  for (const [index, update] of updates.entries()) {
    const node = staged.get(update.id);
    try {
      if (update.props && 'text' in update.props && typeof update.props.text !== 'string') throw new Error('text precisa ser uma string. Use "" para limpar o texto.');
      applyProps(node, update.props, { setLayoutMode, colorStyle, effectStyle, gradientStyle });
    }
    catch (error: any) { throw new Error(`updates[${index}] (“${node.name}”): ${error.message}`); }
  }
  // Monte os patches completos antes de escrever: não execute comandos no documento vivo.
  const patches = [...staged].map(([id, node]) => {
    const original = originals.get(id);
    const removed = Object.keys(original).filter((key) => key !== 'children' && !(key in node));
    const values: ToolArgs = {};
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'children' && JSON.stringify(value) !== JSON.stringify(original[key])) values[key] = value;
    }
    if (node.children) {
      const children = node.children.map((child) => {
        const existing = originals.get(child.id);
        if (!existing) throw new Error('O lote não pode criar filhos. Use build_layout ou create_layer para criar camadas.');
        return existing;
      });
      if (children.some((child, index) => original.children?.[index] !== child) || children.length !== original.children?.length) values.children = children;
    }
    return { original, removed, values };
  });
  // A resposta também é preparada antes da escrita: erro de resumo não pode deixar um lote aplicado pela metade.
  const result = { count: nodes.length, updated: nodes.map((node) => summarize(staged.get(node.id), 0)) };
  return {
    apply() {
      store.update(() => {
        for (const { original, removed, values } of patches) {
          for (const key of removed) delete original[key];
          Object.assign(original, values);
        }
      });
      return result;
    },
  };
}

export function createBatchTools(ctx: RunnerContext): ToolHandlers {
  return {
    update_layers({ updates }) {
      // Reprepare após a aprovação: o projeto pode ter mudado enquanto a pessoa respondia.
      return prepareLayerUpdates(ctx, updates).apply();
    },
  };
}
