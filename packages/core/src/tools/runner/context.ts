/** Acesso ao documento atual e helpers compartilhados de camadas. */

import type { RunnerDependencies, RunnerContext } from './types.ts';
export function createRunnerContext(deps: RunnerDependencies): RunnerContext {
  const { store, commands } = deps;
  /** Camada pelo id ou erro claro (a IA às vezes inventa ids: a mensagem manda ela procurar antes). */
  const need = (id) => {
    const n = id && store.get(id);
    if (!n) throw new Error(`Camada "${id}" não existe. Use get_document ou find_layers para achar o id certo.`);
    return n;
  };
  /** Liga/desliga o layout com a lógica do painel (deduz direção, gap e padding ao ligar). */
  const setLayoutMode = (node, mode) => commands.setLayoutMode([node], mode);

  /** Cor e opacidade de um estilo de cor do projeto (ou null). */
  const colorStyle = (id) => (store.state.doc.styles?.colors || []).find((c) => c.id === id) || null;
  const effectStyle = (id) => (store.state.doc.styles?.effects || []).find((e) => e.id === id) || null;
  const gradientStyle = (id) => (store.state.doc.styles?.gradients || []).find((g) => g.id === id) || null;
  /** Lista onde uma camada nova entra (filhos do pai ou a raiz da página), conferindo se o pai aceita filhos. */
  const targetList = (parent_id) => {
    const parent = parent_id ? need(parent_id) : null;
    if (parent && !parent.children) throw new Error(`“${parent.name}” não pode ter filhos (só frames, grupos e seções).`);
    return parent ? parent.children : store.page().children;
  };
  /** Insere na posição pedida (ou no fim). */
  const insertAt = (list, node, index) => list.splice(Number.isInteger(index) ? Math.max(0, Math.min(index, list.length)) : list.length, 0, node);
  /** Tela nova na raiz: à direita do que já existe na página (não cai em cima de nada). */
  function placeBeside(node) {
    const items = store.page().children;
    if (!items.length) { node.x = 0; node.y = 0; return; }
    node.x = Math.round(Math.max(...items.map((n) => n.x + n.w)) + 160);
    node.y = Math.round(Math.min(...items.map((n) => n.y)));
  }

  return { ...deps, need, setLayoutMode, colorStyle, effectStyle, gradientStyle, targetList, insertAt, placeBeside };
}
