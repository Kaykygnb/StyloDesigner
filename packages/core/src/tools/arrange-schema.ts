/** Ferramentas de "arranjo" que o editor faz com o botão direito e atalhos: ordem, espelhar, envolver, máscara, componente, colar. */
import { z } from 'zod';
import type { ToolDef } from './schema.ts';
const id = z.string().min(1).max(200);
const ids = (min = 1) => z.array(id).min(min).max(100);
const index = z.number().int().min(0);

export const ARRANGE_ACTIONS = ['front', 'forward', 'backward', 'back', 'flip_h', 'flip_v', 'wrap_in_frame', 'toggle_auto_layout', 'create_component', 'detach_instance', 'toggle_mask'] as const;

const move = z.object({
  id,
  parent_id: id.describe('novo pai (id de um frame/grupo) ou "root" para a raiz da página; omita para manter o pai').optional(),
  index: index.describe('posição entre as irmãs no pai de destino (0 = fundo); omita para ir ao fim').optional(),
  x: z.number().optional(),
  y: z.number().optional(),
}).strict();

export const ARRANGE_TOOLS: Omit<ToolDef, 'inputSchema'>[] = [
  {
    name: 'set_guides',
    write: true,
    description: 'Define as GUIAS de régua de uma página (page_id; padrão: a aberta): a lista completa [{axis, pos}], até 200. axis "x" = linha vertical em x = pos; "y" = linha horizontal em y = pos (px do canvas). Guias só ajudam a alinhar no editor (o arrasto gruda nelas); não entram no CSS nem na exportação. Para apagar todas, mande [].',
    input: z.object({ page_id: id.optional(), guides: z.array(z.object({ axis: z.enum(['x', 'y']), pos: z.number().finite() }).strict()).max(200) }).strict(),
  },
  {
    name: 'move_layers',
    write: true,
    description: 'Move 1–100 camadas de uma vez, tudo ou nada e com UM desfazer: cada item pode mudar de pai (parent_id, ou "root"), de posição entre as irmãs (index) e de posição dentro do pai (x, y; sem efeito em itens de auto layout). É o que o editor faz ao soltar camadas arrastadas. Recusa mover uma camada para dentro dela mesma, seção fora da raiz e pais que não aceitam filhos.',
    input: z.object({ moves: z.array(move).min(1).max(100) }).strict(),
  },
  {
    name: 'arrange_layers',
    write: true,
    description: 'Faz com 1–100 camadas o que o editor faz no botão direito. action: front/forward/backward/back (ordem entre irmãs: frente, um à frente, um atrás, fundo); flip_h/flip_v (espelhar; repetir desfaz); wrap_in_frame (envolve num frame novo, sem layout, mantendo a posição); toggle_auto_layout (frame: liga/desliga o layout automático deduzindo direção, gap e padding dos filhos; várias camadas: envolve num frame com layout); create_component (a camada vira componente principal; várias camadas são envolvidas num frame); detach_instance (instâncias viram camadas comuns); toggle_mask (várias camadas: agrupa e usa a de baixo como máscara; uma camada dentro de um grupo: liga/desliga o papel de máscara). Use a página aberta; um desfazer desfaz tudo. Devolve ids das camadas resultantes (selected). Para a ordem EXATA use reorder_layer.',
    input: z.object({ ids: ids(), action: z.enum(ARRANGE_ACTIONS) }).strict(),
  },
  {
    name: 'paste_layers',
    write: true,
    description: 'Copia 1–100 camadas (com tudo que há dentro) e cola a cópia: em parent_id (um frame) ou, sem parent_id, ao lado do original, no mesmo pai, com deslocamento de 16 px. Devolve os ids das cópias (selected). Diferente de duplicate_layers, a cópia pode ir para OUTRO frame. parent_id precisa ser um frame.',
    input: z.object({ ids: ids(), parent_id: id.optional() }).strict(),
  },
  {
    name: 'paste_style',
    write: true,
    description: 'Copia a APARÊNCIA de source_id (preenchimento, contorno, cantos, sombras, blur, opacidade, mesclagem, filtros de cor e, se for texto, a tipografia) para 1–100 camadas ids. Ignora o que não faz sentido no destino (tipografia em retângulo, cantos em elipse). Não muda posição, tamanho nem conteúdo.',
    input: z.object({ source_id: id, ids: ids() }).strict(),
  },
];
