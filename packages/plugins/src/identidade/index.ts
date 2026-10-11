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
import { pickPairs } from './fontes.ts';

const bad = (name: string, value: string) => { throw new Error(`${name}: "${value}" não é uma cor hexadecimal (#RGB ou #RRGGBB).`); };
const rgbOf = (name: string, value: string) => parseHex(value) ?? bad(name, value);

/** O brief do projeto: um lugar fixo para quem é o público, o tom, os valores. Fica no documento e viaja com ele. */
const BRIEF_TEXT = ['summary', 'audience', 'goals', 'avoid', 'notes'] as const;
const BRIEF_LIST = ['tone', 'values'] as const;
const briefOf = (doc: any) => doc.brief ?? {};

export const identidade = definePlugin({
  id: 'identidade',
  name: 'Identidade visual',
  description: 'Auxiliares que calculam paletas, contraste, harmonias e escalas. Não criam nada sozinhos.',
  tools: [
    {
      def: defineTool({
        name: 'font_pairs',
        write: false, needs: 'read',
        description: 'PARES DE FONTES do Google Fonts (título + texto corrido) que combinam, com o clima de cada um. Passe mood em palavras (ex.: "elegante restaurante", "tecnologia", "infantil") para filtrar; sem mood devolve todos. Cada par traz os ids para add_font e os pesos sugeridos. É um ponto de partida: escolha e use add_font para hospedar no projeto.',
        input: z.object({
          mood: z.string().describe('clima/assunto em palavras, ex.: "luxo", "esportivo", "startup de tecnologia"').optional(),
          limit: z.number().int().min(1).max(20).optional(),
        }),
      }),
      run: ({ mood, limit }) => {
        const pairs = pickPairs(mood).slice(0, limit ?? 6);
        return {
          mood: mood ?? null,
          count: pairs.length,
          pairs: pairs.map((p) => ({
            id: p.id, heading: p.heading, body: p.body, moods: p.moods, suits: p.suits,
            add_font: [{ id: p.headingId, weights: p.headingWeights }, { id: p.bodyId, weights: p.bodyWeights }],
          })),
          hint: pairs.length ? 'Hospede com add_font (um por família) e use os nomes em fontFamily; ou crie estilos com create_text_styles.' : 'Nada com esse clima: tente outra palavra ou chame sem mood para ver todos.',
        };
      },
    },
    {
      def: defineTool({
        name: 'get_project_brief',
        write: false, needs: 'read',
        description: 'Lê o BRIEF do projeto aberto: o que ele é, para quem, o tom, os valores, o que evitar. Leia antes de decidir cores, fontes e textos, para manter a identidade coerente entre agentes e pessoas.',
        input: z.object({}),
      }),
      needsProject: true,
      run: (_args, ctx) => {
        const brief = briefOf(ctx.project!.store.state.doc);
        return { brief, empty: !Object.keys(brief).length, hint: Object.keys(brief).length ? undefined : 'Ainda não há brief. Se você já sabe (ou perguntou à pessoa) para quem é o projeto, grave com set_project_brief.' };
      },
    },
    {
      def: defineTool({
        name: 'set_project_brief',
        write: true, needs: 'write',
        description: 'Grava o BRIEF do projeto (fica no documento). Só o que você mandar muda; texto vazio ou lista vazia apaga o campo. summary: o que é o projeto; audience: para quem; tone: palavras de tom (["calmo","direto"]); values: valores da marca; goals: o que o site precisa conseguir; avoid: o que evitar; notes: o resto.',
        input: z.object({
          summary: z.string().optional(),
          audience: z.string().optional(),
          tone: z.array(z.string()).optional(),
          values: z.array(z.string()).optional(),
          goals: z.string().optional(),
          avoid: z.string().optional(),
          notes: z.string().optional(),
        }),
      }),
      needsProject: true,
      run: (args, ctx) => {
        const store = ctx.project!.store;
        const next: Record<string, unknown> = { ...briefOf(store.state.doc) };
        for (const k of BRIEF_TEXT) {
          if (!(k in args)) continue;
          const v = String(args[k] ?? '').trim().slice(0, 2000);
          if (v) next[k] = v; else delete next[k];
        }
        for (const k of BRIEF_LIST) {
          if (!(k in args)) continue;
          const list = (args[k] as string[]).map((x) => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, 20);
          if (list.length) next[k] = list; else delete next[k];
        }
        store.update(() => { if (Object.keys(next).length) store.state.doc.brief = next; else delete store.state.doc.brief; }, { commit: true });
        return { brief: next, _summary: 'Atualizou o brief do projeto' };
      },
    },
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
