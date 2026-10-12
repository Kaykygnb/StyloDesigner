/** Ferramentas do CÓDIGO (CSS da camada) e dos COMENTÁRIOS (responder, resolver, editar, apagar) — o que as abas Código e Comentários do editor fazem. */
import { z } from 'zod';
import type { ToolDef } from './schema.ts';
const id = z.string().min(1).max(200);

export const CODE_TOOLS: Omit<ToolDef, 'inputSchema'>[] = [
  {
    name: 'set_layer_css',
    write: true,
    description: 'Aplica CSS escrito à mão numa camada: o que o painel Design entende vira campo do modelo (cor, tamanho, raio, sombra, fonte…) e o resto vai para o CSS livre da camada (customCss), que vem por último. css = declarações ("propriedade: valor;" uma por linha) ou a regra inteira. Devolve o que virou campo (mapped), o que ficou no CSS livre (custom), o que foi desligado (unset) e o que foi ignorado por ser inválido. Regras com seletor, @media e :hover NÃO entram aqui: use set_project_css. Para ver as declarações atuais: get_code → declarations.',
    input: z.object({ id, css: z.string().max(20000) }).strict(),
  },
  {
    name: 'manage_comment',
    write: true, noLock: true, needs: 'comment',
    description: 'Mexe num comentário existente (veja get_comments para os ids): action "reply" responde (text), "edit" troca o texto do comentário (ou de uma resposta, com reply_id), "resolve" marca como resolvido, "reopen" reabre, "delete" apaga (com as respostas). Para criar um comentário novo use add_comment.',
    input: z.object({
      comment_id: id,
      action: z.enum(['reply', 'edit', 'resolve', 'reopen', 'delete']),
      text: z.string().max(4000).optional(),
      reply_id: id.optional(),
    }).strict(),
  },
];
