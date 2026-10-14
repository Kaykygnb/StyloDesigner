/** Alterações de camadas, componentes, responsivo, estados e comentários. */
import { editBp, editState, BP_KEYS, STATE_KEYS, canHaveStates, DEFAULT_BREAKPOINTS } from '../../model.js';
import { withDocumentBreakpoints } from '../../document-breakpoints.ts';
import { makeComponent, createInstance } from '../../components.js';
import { addComment } from '../../comments.js';
import type { RunnerContext, ToolHandlers } from './types.ts';
import { applyProps } from './properties.ts';
import { summarize } from './presentation.ts';
import { applyMoves } from './arrange.ts';
export function createLayersTools(ctx: RunnerContext): ToolHandlers {
  const { store, commands, need, setLayoutMode, colorStyle, effectStyle, gradientStyle, targetList, insertAt, placeBeside } = ctx;
  /** `id` (uma) ou `ids` (várias): as camadas de uma alteração em lote. */
  const needAll = (id?: string, ids?: string[]) => {
    const list = ids?.length ? ids : id ? [id] : [];
    if (!list.length) throw new Error('Mande id (uma camada) ou ids (várias).');
    if (new Set(list).size !== list.length) throw new Error('ids não pode repetir a mesma camada.');
    return list.map(need);
  };
  return {
    update_layer({ id, props }) {
      const n = need(id);
      store.update(() => applyProps(n, props, { setLayoutMode, colorStyle, effectStyle, gradientStyle }));
      return { updated: summarize(n, 0) };
    },
    delete_layers({ ids = [] }) {
      const nodes = ids.map(need);
      store.update(() => nodes.forEach((n) => { const list = store.listOf(n.id); const i = list?.indexOf(n); if (i >= 0) list.splice(i, 1); }));
      store.setSelection(store.ui.selection.filter((s) => store.get(s)));
      return { deleted: ids };
    },
    move_layer({ id, parent_id, index }) {
      const n = need(id);
      const target = parent_id === 'root' ? null : parent_id ? need(parent_id) : store.parentOf(id);
      if (target && !target.children) throw new Error(`“${target.name}” não pode ter filhos.`);
      commands.reparent([n], target, Number.isInteger(index) ? index : null);
      if (store.parentOf(id) !== target) throw new Error('Não deu para mover para lá (uma camada não entra dentro dela mesma, e seções só guardam frames).');
      return { moved: summarize(n, 0), parent: target ? target.id : 'root' };
    },
    set_responsive({ id, ids, breakpoint, props, reset }) {
      const nodes = needAll(id, ids);
      const breakpoints = store.state.doc.breakpoints?.length ? store.state.doc.breakpoints : DEFAULT_BREAKPOINTS;
      if (!breakpoints.some((b) => b.id === breakpoint)) throw new Error(`breakpoint: use um destes: ${breakpoints.map((b) => `"${b.id}" (${b.name}, ≤${b.max}px)`).join(', ')}.`);
      const updated = nodes.length === 1 ? nodes[0].id : nodes.map((n) => n.id);
      if (reset) {
        store.update(() => { for (const n of nodes) if (n.bps) { delete n.bps[breakpoint]; if (!Object.keys(n.bps).length) delete n.bps; } });
        return { updated, breakpoint, reset: true };
      }
      if (!props) throw new Error('Mande props (ou reset: true para apagar os ajustes deste breakpoint).');
      const bad = Object.keys(props || {}).filter((k) => !BP_KEYS.includes(k));
      if (bad.length) throw new Error(`Não varia por largura: ${bad.join(', ')}. Aceitas: ${BP_KEYS.join(', ')}.`);
      // todas as camadas na MESMA alteração: um único passo no histórico (um Ctrl+Z desfaz o lote)
      store.update(() => withDocumentBreakpoints(store.state.doc, () => { for (const n of nodes) editBp(n, breakpoint, (d) => applyProps(d, props, { colorStyle, effectStyle, gradientStyle })); }));
      return { updated, breakpoint, hint: 'Vira @media no CSS; o Desktop continua igual.' };
    },
    set_state({ id, ids, state, props = {}, reset }) {
      const nodes = needAll(id, ids);
      if (!['hover', 'active', 'focus'].includes(state)) throw new Error('state: "hover", "active" ou "focus".');
      const blocked = nodes.find((n) => !canHaveStates(n));
      if (blocked) throw new Error(`Grupos, seções e linhas não têm estados (“${blocked.name}”).`);
      const updated = nodes.length === 1 ? nodes[0].id : nodes.map((n) => n.id);
      if (reset) {
        store.update(() => { for (const n of nodes) if (n.states) { delete n.states[state]; if (!Object.keys(n.states).length) delete n.states; } });
        return { updated, state, reset: true };
      }
      const bad = Object.keys(props).filter((k) => !STATE_KEYS.includes(k));
      if (bad.length) throw new Error(`Estados aceitam só: ${STATE_KEYS.join(', ')}.`);
      const { scale, ...rest } = props;
      store.update(() => { for (const n of nodes) editState(n, state, (d) => { applyProps(d, rest, { colorStyle, effectStyle, gradientStyle }); if (scale !== undefined) d.scale = Math.max(0.5, Math.min(2, Number(scale) || 1)); }); });
      return { updated, state };
    },
    create_component({ id }) {
      const n = need(id);
      if (n.instanceOf) throw new Error('Isto é uma cópia de componente; o principal é ' + n.instanceOf + '.');
      store.update(() => makeComponent(n));
      return { component: summarize(n, 0) };
    },
    create_instance({ component_id, parent_id, index, props = {} }) {
      const main = need(component_id);
      if (!main.component) throw new Error(`“${main.name}” não é componente. Use create_component antes.`);
      const list = targetList(parent_id);
      const inst = createInstance(main, store.state.doc.pages);
      if (!parent_id) placeBeside(inst);
      store.update(() => { applyProps(inst, props, { colorStyle, effectStyle, gradientStyle }); insertAt(list, inst, index); });
      store.setSelection([inst.id]);
      return { created: summarize(inst, 1) };
    },
    duplicate_layers({ ids = [], moves }) {
      ids.forEach(need);
      store.setSelection(ids);
      // o commit do histórico fica para o fim da ferramenta (o do comando separaria duplicar e mover em dois passos)
      const commit = store.commit;
      store.commit = () => {};
      try { commands.duplicate(); } finally { store.commit = commit; }
      const created = [...store.ui.selection];
      // `moves` leva as CÓPIAS para outro lugar na mesma chamada (um único Ctrl+Z desfaz duplicar e mover); id = o da ORIGINAL
      if (moves?.length) {
        const bad = moves.find((m: { id: string }) => !ids.includes(m.id));
        if (bad) throw new Error(`moves: “${bad.id}” não está em ids (use o id da camada ORIGINAL).`);
        if (created.length !== ids.length) throw new Error('Não deu para relacionar as cópias às originais; use move_layers depois.');
        applyMoves(ctx, moves.map((m: { id: string }) => ({ ...m, id: created[ids.indexOf(m.id)] })));
      }
      return { created: created.map((s) => summarize(store.get(s), 0)) };
    },
    add_interaction({ id, action, target_id, url, transition = 'dissolve' }) {
      const n = need(id);
      if (!['navigate', 'back', 'url'].includes(action)) throw new Error('action: navigate, back ou url.');
      if (action === 'navigate') need(target_id);
      if (action === 'url' && !/^https?:\/\//i.test(url || '')) throw new Error('url precisa começar com http:// ou https://.');
      store.update(() => { (n.interactions ||= []).push({ trigger: 'click', action, target: action === 'navigate' ? target_id : '', transition, ...(action === 'url' ? { url } : {}) }); });
      return { interactions: n.interactions };
    },
    add_comment({ id, text, rx, ry }, client) {
      need(id);
      let c: ReturnType<typeof addComment> = null;
      store.update(() => { c = addComment(store.state.doc, { nodeId: id, text, author: client, ...(rx !== undefined ? { rx } : {}), ...(ry !== undefined ? { ry } : {}) }); });
      const comment = c as ReturnType<typeof addComment>;
      if (!comment) throw new Error('Comentário vazio.');
      return { comment: { id: comment.id, text: comment.text } };
    }
  };
}
