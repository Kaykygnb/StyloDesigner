/** CSS da camada e comentários, reutilizando os módulos puros do editor (cssedit.ts, comments.ts). */
import { applyLayerCss } from '../../cssedit.ts';
import { addReply, commentsOf, editText, removeComment, setResolved } from '../../comments.ts';
import type { RunnerContext, ToolArgs, ToolHandlers } from './types.ts';

export function createCodeTools(ctx: RunnerContext): ToolHandlers {
  const { store, need } = ctx;
  return {
    set_layer_css({ id, css }: ToolArgs, client?: string) {
      void client;
      const n = need(id);
      const parent = store.parentOf(id);
      let out: ReturnType<typeof applyLayerCss> | undefined;
      store.update(() => { out = applyLayerCss(n, parent, store.state.doc.assets, css); });
      return { id, ...out, customCss: n.customCss ?? '' };
    },
    manage_comment({ comment_id, action, text, reply_id }: ToolArgs, client?: string) {
      const doc = store.state.doc;
      const c = commentsOf(doc).find((x: ToolArgs) => x.id === comment_id);
      if (!c) throw new Error(`Comentário "${comment_id}" não existe. Veja get_comments.`);
      const author = client || 'Assistente';
      store.update(() => {
        if (action === 'reply') {
          if (!addReply(c, { text, author })) throw new Error('A resposta está vazia: mande text.');
        } else if (action === 'edit') {
          const target = reply_id ? (c.replies || []).find((r: ToolArgs) => r.id === reply_id) : c;
          if (!target) throw new Error(`Resposta "${reply_id}" não existe neste comentário.`);
          if (!editText(target, text)) throw new Error('O texto novo está vazio ou igual ao atual.');
        } else if (action === 'resolve') setResolved(c, true);
        else if (action === 'reopen') setResolved(c, false);
        else removeComment(doc, c.id);
      });
      return { comment_id, action, replies: action === 'delete' ? 0 : (c.replies || []).length, resolved: !!c.resolved };
    },
  };
}
