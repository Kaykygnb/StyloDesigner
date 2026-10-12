/** Ferramentas de "arranjo" que o editor faz com o botão direito e atalhos: ordem, espelhar, envolver, máscara, componente, colar. */
import { z } from 'zod';
import type { ToolDef } from './schema.ts';
const id = z.string().min(1).max(200);
const ids = (min = 1) => z.array(id).min(min).max(100);

export const ARRANGE_ACTIONS = ['front', 'forward', 'backward', 'back', 'flip_h', 'flip_v', 'wrap_in_frame', 'toggle_auto_layout', 'create_component', 'detach_instance', 'toggle_mask'] as const;

export const ARRANGE_TOOLS: Omit<ToolDef, 'inputSchema'>[] = [
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
