/**
 * Plugin "identidade" — AUXILIARES DE IDENTIDADE VISUAL
 *
 * Ferramentas que CALCULAM (paleta a partir de uma cor, contraste, harmonias, escalas); não criam nada no projeto sozinhas
 * e não escolhem por ninguém. O agente (ou a pessoa) decide o que fazer com o resultado: por exemplo, criar estilos de cor
 * com `create_color_styles` usando uma escala devolvida aqui.
 */

import { z } from 'zod';
import { definePlugin } from '@stylo/core/plugin.ts';
import { defineTool } from '@stylo/core/tools/schema.ts';
import { colorScale, contrastRatio, harmony, hexToOklch, parseHex, textOn, toHex, wcag, type Scheme } from './cor.ts';
import { RATIOS, radiusScale, shadowScale, spacingScale, typeScale } from './tipografia.ts';

const bad = (name: string, value: string) => { throw new Error(`${name}: "${value}" não é uma cor hexadecimal (#RGB ou #RRGGBB).`); };
const rgbOf = (name: string, value: string) => parseHex(value) ?? bad(name, value);

export const identidade = definePlugin({
  id: 'identidade',
  name: 'Identidade visual',
  description: 'Auxiliares que calculam paletas, contraste, harmonias e escalas. Não criam nada sozinhos.',
  tools: [
    {
      def: defineTool({
        name: 'color_scale',
        write: false, needs: 'read',
        description: 'Gera uma ESCALA de 11 degraus (50, 100, 200 ... 900, 950) a partir de UMA cor, no espaço OKLCH (passos que parecem iguais para o olho). O degrau mais próximo da cor dada usa exatamente essa cor (`baseStep`). Só calcula: para virar estilos do projeto, use create_color_styles com os valores devolvidos.',
        input: z.object({ color: z.string().describe('cor base em hexadecimal, ex.: #2F6AE0') }),
      }),
      run: ({ color }) => {
        const out = colorScale(color) ?? bad('color', color);
        return { base: out.base, baseStep: out.baseStep, scale: out.scale.map(({ step, hex, l, c, h }) => ({ step, hex, oklch: { l, c, h } })) };
      },
    },
    {
      def: defineTool({
        name: 'color_contrast',
        write: false, needs: 'read',
        description: 'Contraste WCAG 2.x entre duas cores: a razão (1 a 21) e o que ela atende (AA/AAA para texto normal e grande, e AA para componentes de interface).',
        input: z.object({
          foreground: z.string().describe('cor do texto/ícone, hexadecimal'),
          background: z.string().describe('cor do fundo, hexadecimal'),
        }),
      }),
      run: ({ foreground, background }) => {
        const ratio = Math.round(contrastRatio(rgbOf('foreground', foreground), rgbOf('background', background)) * 100) / 100;
        return { foreground: toHex(rgbOf('foreground', foreground)), background: toHex(rgbOf('background', background)), ratio, ...wcag(ratio) };
      },
    },
    {
      def: defineTool({
        name: 'color_harmony',
        write: false, needs: 'read',
        description: 'Cores que combinam com a dada, por esquema: complementary (oposta), analogous (vizinhas), triadic, split-complementary, tetradic ou monochromatic (claras e escuras da mesma cor). A primeira da lista é sempre a cor original. É uma SUGESTÃO calculada; a escolha é de quem usa.',
        input: z.object({
          color: z.string().describe('cor base, hexadecimal'),
          scheme: z.enum(['complementary', 'analogous', 'triadic', 'split-complementary', 'tetradic', 'monochromatic']),
        }),
      }),
      run: ({ color, scheme }) => ({ scheme, colors: harmony(color, scheme as Scheme) ?? bad('color', color) }),
    },
    {
      def: defineTool({
        name: 'color_text_on',
        write: false, needs: 'read',
        description: 'Qual cor de texto fica mais legível sobre um fundo: compara as candidatas (padrão: preto e branco) e devolve todas ordenadas pelo contraste, da melhor para a pior.',
        input: z.object({
          background: z.string().describe('cor do fundo, hexadecimal'),
          candidates: z.array(z.string()).describe('cores de texto a comparar (padrão: #000000 e #FFFFFF)').optional(),
        }),
      }),
      run: ({ background, candidates }) => {
        const ranked = textOn(background, candidates?.length ? candidates : undefined) ?? bad('background', background);
        return { background: toHex(rgbOf('background', background)), best: ranked[0], ranked };
      },
    },
    {
      def: defineTool({
        name: 'design_scale',
        write: false, needs: 'read',
        description: 'Calcula uma escala de design. kind "type": escala tipográfica modular (base em px e razão: número ou nome como "major-third"), com rem e altura de linha sugerida; "spacing": espaçamentos como múltiplos da unidade (padrão 4 px); "radius": raios de canto; "shadow": níveis de sombra com o CSS pronto. Só calcula: quem decide usar é o agente ou a pessoa.',
        input: z.object({
          kind: z.enum(['type', 'spacing', 'radius', 'shadow']),
          base: z.number().describe('type: tamanho base em px (16); spacing/radius: unidade em px (4)').optional(),
          ratio: z.union([z.number(), z.enum(['minor-second', 'major-second', 'minor-third', 'major-third', 'perfect-fourth', 'augmented-fourth', 'perfect-fifth', 'golden-ratio'])]).describe('só type: razão (1.25) ou o nome').optional(),
          steps_up: z.number().int().describe('só type: quantos degraus acima da base (6)').optional(),
          steps_down: z.number().int().describe('só type: quantos abaixo (2)').optional(),
          color: z.string().describe('só shadow: cor da sombra, hexadecimal (#000000)').optional(),
          opacity: z.number().describe('só shadow: opacidade base (0.18)').optional(),
        }),
      }),
      run: ({ kind, base, ratio, steps_up, steps_down, color, opacity }) => {
        if (kind === 'type') {
          const r = typeof ratio === 'string' ? RATIOS[ratio] : ratio;
          return { kind, base: base ?? 16, ratio: r ?? 1.25, steps: typeScale({ base, ratio: r, up: steps_up, down: steps_down }) };
        }
        if (kind === 'spacing') return { kind, base: base ?? 4, steps: spacingScale({ base }) };
        if (kind === 'radius') return { kind, base: base ?? 4, steps: radiusScale({ base }) };
        if (color && !hexToOklch(color)) bad('color', color);
        return { kind, steps: shadowScale({ color, opacity }) };
      },
    },
  ],
});
