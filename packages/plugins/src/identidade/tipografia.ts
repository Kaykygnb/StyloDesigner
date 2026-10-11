/**
 * identidade/tipografia.ts — ESCALAS (tipográfica, de espaçamento, de cantos e de sombras)
 * Funções puras que CALCULAM números; quem decide usar (e como) é o agente ou a pessoa.
 */

import { parseHex } from './cor.ts';

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Razões clássicas de escala modular. */
export const RATIOS: Record<string, number> = {
  'minor-second': 1.067, 'major-second': 1.125, 'minor-third': 1.2, 'major-third': 1.25, 'perfect-fourth': 1.333,
  'augmented-fourth': 1.414, 'perfect-fifth': 1.5, 'golden-ratio': 1.618,
};

export interface TypeStep { name: string; px: number; rem: number; lineHeight: number }

/** Nomes dos degraus: ... xs, sm, base, lg, xl, 2xl, 3xl... */
const stepName = (i: number) => (i === 0 ? 'base' : i < 0 ? ['sm', 'xs', '2xs', '3xs'][-i - 1] ?? `${i}` : i === 1 ? 'lg' : i === 2 ? 'xl' : `${i - 1}xl`);

/**
 * Escala tipográfica modular: cada degrau = base × razão^n. A altura de linha diminui conforme o texto cresce
 * (texto corrido precisa de ~1.5; títulos grandes ficam bem com ~1.1).
 */
export function typeScale({ base = 16, ratio = 1.25, up = 6, down = 2 }: { base?: number; ratio?: number; up?: number; down?: number } = {}): TypeStep[] {
  const out: TypeStep[] = [];
  for (let i = down * -1; i <= up; i++) {
    const px = base * ratio ** i;
    // 1.6 no menor tamanho até 1.1 nos maiores (interpolação pelo tamanho relativo à base)
    const lineHeight = Math.min(1.6, Math.max(1.1, 1.5 - Math.log(px / base) * 0.45));
    out.push({ name: stepName(i), px: round(px), rem: round(px / 16, 3), lineHeight: round(lineHeight) });
  }
  return out.reverse();
}

/** Escala de espaçamento: múltiplos da unidade base (4 ou 8 px), com os degraus mais usados em interfaces. */
export function spacingScale({ base = 4, steps = [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24] }: { base?: number; steps?: number[] } = {}) {
  return steps.map((s) => ({ name: String(s), px: round(s * base), rem: round((s * base) / 16, 3) }));
}

/** Escala de raios de canto: do reto ao totalmente arredondado. */
export function radiusScale({ base = 4 }: { base?: number } = {}) {
  return [
    { name: 'none', px: 0 }, { name: 'sm', px: round(base * 0.5) }, { name: 'md', px: base }, { name: 'lg', px: base * 2 },
    { name: 'xl', px: base * 3 }, { name: '2xl', px: base * 4 }, { name: 'full', px: 9999 },
  ];
}

/** Escala de sombras: cada nível levanta o elemento um pouco mais (desfoque e deslocamento crescem juntos). */
export function shadowScale({ color = '#000000', opacity = 0.18 }: { color?: string; opacity?: number } = {}) {
  const rgb = parseHex(color) ?? { r: 0, g: 0, b: 0 };
  const level = (name: string, y: number, blur: number, spread = 0) => {
    const alpha = round(opacity * (0.7 + Math.min(y, 24) / 40));
    return { name, x: 0, y, blur, spread, opacity: alpha, css: `0 ${y}px ${blur}px ${spread}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` };
  };
  return [level('xs', 1, 2), level('sm', 2, 6), level('md', 6, 16, -2), level('lg', 12, 28, -4), level('xl', 20, 44, -6), level('2xl', 32, 64, -8)];
}
