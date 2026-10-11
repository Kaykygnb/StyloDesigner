/**
 * identidade/cor.ts — MATEMÁTICA DE COR (OKLCH, contraste WCAG, escalas e harmonias)
 *
 * Funções puras, sem dependências. OKLCH é um espaço de cor "perceptual": mudar a luminosidade (L) ou girar o matiz (H)
 * dá passos que parecem iguais para o olho, ao contrário do HSL. Por isso as escalas e harmonias saem melhores.
 *   L = luminosidade 0..1 · C = croma (intensidade) 0..~0.4 · H = matiz 0..360
 */

export interface Oklch { l: number; c: number; h: number }
export interface Rgb { r: number; g: number; b: number }

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** "#abc" | "#aabbcc" | "aabbcc" → RGB 0..255; null se inválido. */
export function parseHex(value: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value).trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export const toHex = ({ r, g, b }: Rgb) => `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

const toLinear = (v: number) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const fromLinear = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** RGB (0..255) → OKLCH. */
export function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  return { l: L, c, h: c < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

/** OKLCH → RGB linear sem recortar (para saber se cabe no sRGB). */
function oklchToLinearRgb({ l, c, h }: Oklch) {
  const a = c * Math.cos((h * Math.PI) / 180), b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    g: -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    b: -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  };
}

const inGamut = ({ r, g, b }: { r: number; g: number; b: number }) => [r, g, b].every((v) => v >= -0.0005 && v <= 1.0005);

/** OKLCH → RGB 0..255. Se a cor não cabe no sRGB, reduz o croma até caber (mantém luminosidade e matiz). */
export function oklchToRgb(color: Oklch): Rgb {
  let { l, c, h } = color;
  l = clamp01(l);
  let lin = oklchToLinearRgb({ l, c, h });
  if (!inGamut(lin)) {
    let lo = 0, hi = c;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinearRgb({ l, c: mid, h }))) lo = mid; else hi = mid;
    }
    c = lo;
    lin = oklchToLinearRgb({ l, c, h });
  }
  return { r: fromLinear(clamp01(lin.r)), g: fromLinear(clamp01(lin.g)), b: fromLinear(clamp01(lin.b)) };
}

export const hexToOklch = (hex: string): Oklch | null => { const rgb = parseHex(hex); return rgb ? rgbToOklch(rgb) : null; };
export const oklchToHex = (color: Oklch) => toHex(oklchToRgb(color));

/** Luminância relativa (WCAG 2.x), 0..1. */
export function luminance({ r, g, b }: Rgb) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function contrastRatio(a: Rgb, b: Rgb) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** O que a razão de contraste atende (WCAG 2.x). */
export function wcag(ratio: number) {
  return {
    normalText: { AA: ratio >= 4.5, AAA: ratio >= 7 },
    largeText: { AA: ratio >= 3, AAA: ratio >= 4.5 },
    uiComponents: { AA: ratio >= 3 },
  };
}

// ---------------------------------------------------------------- escala 50..950
export const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
/** Luminosidades-alvo de cada degrau (do mais claro ao mais escuro), no estilo das escalas do Tailwind/Radix. */
const SCALE_L = [0.975, 0.945, 0.89, 0.82, 0.73, 0.64, 0.55, 0.47, 0.4, 0.33, 0.25];

export interface ScaleEntry { step: number; hex: string; l: number; c: number; h: number }

/**
 * Escala de 11 degraus (50..950) a partir de UMA cor. O matiz da cor é mantido; a luminosidade segue degraus fixos; o
 * croma acompanha a cor original com uma curva suave (as pontas ficam mais acinzentadas). O degrau mais próximo da cor
 * original é devolvido em `baseStep`, e esse degrau usa exatamente a cor dada.
 */
export function colorScale(baseHex: string): { base: string; baseStep: number; scale: ScaleEntry[] } | null {
  const base = hexToOklch(baseHex);
  if (!base) return null;
  const baseHexNorm = toHex(parseHex(baseHex)!);
  let baseIdx = 0;
  SCALE_L.forEach((l, i) => { if (Math.abs(l - base.l) < Math.abs(SCALE_L[baseIdx] - base.l)) baseIdx = i; });
  const scale = SCALE_L.map((l, i) => {
    if (i === baseIdx) return { step: SCALE_STEPS[i], hex: baseHexNorm, l: round(base.l), c: round(base.c), h: round(base.h, 1) };
    // croma: 1 no degrau da cor, diminui para as pontas (muito claro/escuro ficam menos saturados)
    const dist = Math.abs(l - base.l);
    const c = base.c * Math.max(0.15, 1 - dist * 1.1);
    const color = { l, c, h: base.h };
    const rgb = oklchToRgb(color);
    const back = rgbToOklch(rgb);
    return { step: SCALE_STEPS[i], hex: toHex(rgb), l: round(back.l), c: round(back.c), h: round(back.c < 0.005 ? base.h : back.h, 1) };
  });
  return { base: baseHexNorm, baseStep: SCALE_STEPS[baseIdx], scale };
}

const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

// ---------------------------------------------------------------- harmonias
export type Scheme = 'complementary' | 'analogous' | 'triadic' | 'split-complementary' | 'tetradic' | 'monochromatic';

/** Giro de matiz de cada esquema, em graus (os degraus de luminosidade do monocromático ficam à parte). */
const ROTATIONS: Record<Exclude<Scheme, 'monochromatic'>, number[]> = {
  complementary: [180],
  analogous: [-30, 30],
  triadic: [120, 240],
  'split-complementary': [150, 210],
  tetradic: [90, 180, 270],
};

/** Cores que combinam com a dada, no esquema pedido. A primeira é sempre a cor original. */
export function harmony(baseHex: string, scheme: Scheme): { hex: string; role: string }[] | null {
  const base = hexToOklch(baseHex);
  if (!base) return null;
  const original = toHex(parseHex(baseHex)!);
  if (scheme === 'monochromatic') {
    return [{ hex: original, role: 'base' },
      ...[0.88, 0.7, 0.4, 0.3].map((l, i) => ({ hex: oklchToHex({ l, c: base.c * (i < 2 ? 0.7 : 1), h: base.h }), role: i < 2 ? `claro ${i + 1}` : `escuro ${i - 1}` }))];
  }
  const rotations = ROTATIONS[scheme];
  if (!rotations) return null;
  return [{ hex: original, role: 'base' }, ...rotations.map((deg) => ({ hex: oklchToHex({ ...base, h: (base.h + deg + 360) % 360 }), role: `${deg > 0 ? '+' : ''}${deg}°` }))];
}

/** A melhor cor de texto sobre um fundo, entre as candidatas (padrão: preto e branco), e o contraste dela. */
export function textOn(backgroundHex: string, candidates: string[] = ['#000000', '#FFFFFF']) {
  const bg = parseHex(backgroundHex);
  if (!bg) return null;
  const ranked = candidates.map((c) => ({ hex: c, rgb: parseHex(c) })).filter((c) => c.rgb)
    .map((c) => ({ hex: toHex(c.rgb!), ratio: round(contrastRatio(c.rgb!, bg), 2) }))
    .sort((a, b) => b.ratio - a.ratio);
  return ranked.length ? ranked : null;
}
