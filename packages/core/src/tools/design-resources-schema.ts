/** Contratos estritos da manutenção de estilos, variáveis e modos do projeto. */
import { z } from 'zod';
import type { ToolDef } from './schema.ts';

export const RESOURCE_KINDS = ['color', 'text', 'effect', 'gradient', 'variable', 'mode'] as const;
const name = z.string().trim().min(1).max(80);
const color = z.string().regex(/^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i, 'Use uma cor hexadecimal #RGB ou #RRGGBB.');
const opacity = z.number().min(0).max(1);
const shadow = z.strictObject({ x: z.number().optional(), y: z.number().optional(), blur: z.number().nonnegative().optional(), spread: z.number().optional(), color: color.optional(), opacity: opacity.optional(), inset: z.boolean().optional() });
const stop = z.strictObject({ color, opacity: opacity.optional(), pos: z.number().min(0).max(100).optional() });
export const resourceChangesSchemas = {
  color: z.strictObject({ name: name.optional(), color: color.optional(), opacity: opacity.optional(), mode_id: z.string().min(1).optional() }),
  text: z.strictObject({ name: name.optional(), fontFamily: z.string().trim().min(1).max(200).optional(), fontSize: z.number().positive().optional(), fontWeight: z.number().int().min(100).max(900).optional(), fontStyle: z.enum(['normal', 'italic']).optional(), lineHeight: z.number().positive().optional(), letterSpacing: z.number().optional(), wordSpacing: z.number().optional() }),
  effect: z.strictObject({ name: name.optional(), shadows: z.array(shadow).min(1).max(16).optional() }),
  gradient: z.strictObject({ name: name.optional(), type: z.enum(['linear', 'radial', 'conic']).optional(), angle: z.number().optional(), stops: z.array(stop).min(2).max(32).optional() }),
  variable: z.strictObject({ name: name.optional(), value: z.number().nonnegative().optional() }),
  mode: z.strictObject({ name: name.optional(), scheme: z.enum(['light', 'dark']).nullable().optional() }),
};
export type ResourceKind = typeof RESOURCE_KINDS[number];

export const DESIGN_RESOURCE_TOOLS: Omit<ToolDef, 'inputSchema'>[] = [
  {
    name: 'list_design_resources', write: false,
    description: 'Lista estilos de cor/texto/sombra/gradiente, variáveis e modos do projeto, com IDs, resumo e número de vínculos (inclui overrides e snapshots de componentes). kind filtra o tipo; query filtra nome/id. resources é paginado: padrão 20 linhas/8 KiB; continue offset:nextOffset enquanto hasMore. Não lista todas as camadas usuárias nem mede aparência. O modo padrão é implícito e não é um recurso removível. Efeitos/gradientes mostram contagens, não listas completas.',
    input: z.strictObject({ kind: z.enum(RESOURCE_KINDS).optional(), query: z.string().max(200).optional(), limit: z.number().int().min(1).max(100).optional(), offset: z.number().int().nonnegative().optional(), maxBytes: z.number().int().min(1024).max(65536).optional() }),
  },
  {
    name: 'update_design_resource', write: true,
    description: 'Atualiza um recurso existente sem trocar seu ID, em um passo de desfazer. kind escolhe os campos estritos de changes: color name/color/opacity/mode_id; text name/fontFamily/fontSize/fontWeight/fontStyle/lineHeight/letterSpacing/wordSpacing; effect name/shadows; gradient name/type/angle/stops; variable name/value; mode name/scheme. Nome não pode colidir com outro do mesmo tipo. mode_id altera apenas a cor naquele modo existente; exige color ou opacity. Valores propagam para vínculos; overrides locais sem vínculo explícito permanecem. Não cria recursos nem aceita ID em changes. CSS escrito à mão não é reescrito; confira referências textuais após renomear.',
    input: z.strictObject({ kind: z.enum(RESOURCE_KINDS), id: z.string().min(1), changes: z.union(Object.values(resourceChangesSchemas)) }),
  },
  {
    name: 'delete_design_resource', write: true,
    description: 'Remove recurso existente. Por padrão recusa se houver vínculos; detach:true permite desligá-los preservando os valores literais padrão e overrides locais. Desligar cor perde suas variações por modo: elas dependem do estilo compartilhado. Remover modo elimina seus valores nos estilos de cor, preservando o padrão; não existe ID removível do modo padrão implícito. Um passo de desfazer, não apaga camadas. CSS escrito à mão não é reescrito; vínculos contados são os estruturados do documento.',
    input: z.strictObject({ kind: z.enum(RESOURCE_KINDS), id: z.string().min(1), detach: z.boolean().optional() }),
  },
];
