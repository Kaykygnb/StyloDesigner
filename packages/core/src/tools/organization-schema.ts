/** Definições brutas: schema.ts aplica defineTool para produzir o JSON Schema. */
import { z } from 'zod';
import type { ToolDef } from './schema.ts';
const id = z.string().min(1).max(200);
const ids = (min = 1) => z.array(id).min(min).max(100);
const name = z.string().trim().min(1).max(60);
const index = z.number().int().min(0);
export const ORGANIZATION_TOOLS: Omit<ToolDef, 'inputSchema'>[] = [
  { name: 'align_layers', write: true, description: 'Alinha 1–100 camadas irmãs na página aberta. Uma camada alinha no pai; várias alinham entre si. Recusa itens em fluxo flex/grid: ajuste o layout do pai. Conserva a seleção anterior. Resposta lista até20 IDs; confira detalhes com find_layers/inspect_layout. Geometria do servidor é aproximada para grid; ancestrais girados são recusados.', input: z.object({ ids: ids(), alignment: z.enum(['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom']) }).strict() },
  { name: 'distribute_layers', write: true, description: 'Distribui 3–100 camadas irmãs com vãos iguais, mantendo extremos. axis h horizontal, v vertical. Recusa fluxo flex/grid e ancestrais girados; use layout do pai. Conserva a seleção anterior. Resposta lista até20 IDs; confira detalhes com find_layers/inspect_layout.', input: z.object({ ids: ids(3), axis: z.enum(['h', 'v']) }).strict() },
  { name: 'group_layers', write: true, description: 'Agrupa 2–100 camadas irmãs consecutivas na página aberta, preservando posição e ordem visual. Recusa seções, fluxo flex/grid, pai+filho e ancestrais girados. Seleciona o novo grupo. name opcional, até 60 caracteres. Recusa sobrescritas posicionais, filhos de instância e itens ul/ol. Não agrupa telas raiz nem cria grupos em seções; organize filhos dentro da tela.', input: z.object({ ids: ids(2), name: name.optional() }).strict() },
  { name: 'ungroup_layers', write: true, description: 'Desagrupa 1–100 grupos ou seções irmãos, preservando posição. Recusa componentes, instâncias, grupos girados, fluxo flex/grid e ancestrais girados. Seleciona os filhos resultantes. Recusa efeitos/recorte/interações/variações do contêiner e sobrescritas posicionais dos filhos. Não desmonta frames: seu fundo/layout/efeitos poderiam se perder.', input: z.object({ ids: ids() }).strict() },
  { name: 'reorder_layer', write: true, description: 'Move uma camada ao índice exato entre suas irmãs na página aberta. index começa em 0 (fundo); último índice fica na frente. Dentro de flex/grid a ordem também altera o fluxo. Conserva a seleção anterior. Resposta lista até20 IDs; confira detalhes com find_layers/inspect_layout. Se já estiver no índice, retorna changed:false.', input: z.object({ id, index }).strict() },
  { name: 'rename_page', write: true, description: 'Renomeia uma página existente, sem trocar a página aberta. Nome não vazio de até 60 caracteres.', input: z.object({ id, name }).strict() },
  { name: 'reorder_page', write: true, description: 'Move uma página ao índice exato na lista, sem trocar a página aberta. index começa em 0; não pode ultrapassar o último índice.', input: z.object({ id, index }).strict() },
];
