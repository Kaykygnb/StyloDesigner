/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  color.js — MATEMÁTICA DE COR (puro): hex ↔ RGB ↔ HSL ↔ HSV, harmonias, tons e contraste
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Usado pelo seletor de cor (sugestões de harmonia, contraste) e testado no Node (tests/color.test.js).
 *  Convenções: RGB = {r,g,b} 0–255 · HSL = {h: 0–360, s: 0–1, l: 0–1} · HSV = {h: 0–360, s: 0–1, v: 0–1}.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** {r,g,b} (0–255) → "#RRGGBB". */
export const rgbToHex = ({ r, g, b }) => '#' + [r, g, b].map((n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase();

/** "#abc" / "#aabbcc" (com ou sem #) → {r,g,b}; texto inválido → preto. */
export function hexToRgb(hex) {
  let s = String(hex ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(s)) return { r: 0, g: 0, b: 0 };
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** RGB → HSV. */
export function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

/** HSV → RGB. */
export function hsvToRgb({ h, s, v }) {
  h = ((h % 360) + 360) % 360;
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** RGB → HSL. */
export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

/** HSL → RGB. */
export function hslToRgb({ h, s, l }) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** Gira o matiz de uma cor (graus) mantendo saturação e luminosidade. */
export function rotateHue(hex, deg) {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb({ h: h + deg, s, l }));
}

/** Muda a luminosidade (HSL) de uma cor para `l` (0–1). */
export function withLightness(hex, l) {
  const { h, s } = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb({ h, s, l: clamp(l, 0, 1) }));
}

/**
 * Harmonias de cor a partir de uma cor base: [{ key, title, colors }].
 *  - complementar: a oposta na roda de cores · análogas: vizinhas (±30°) · tríade: três cores a 120° ·
 *  - tons: da mais clara à mais escura, mesma cor (para estados, fundos e bordas).
 */
export function harmonies(hex) {
  const base = rgbToHex(hexToRgb(hex));
  const steps = [0.95, 0.85, 0.7, 0.55, 0.4, 0.28, 0.16];
  return [
    { key: 'complementar', title: 'Complementar', colors: [base, rotateHue(base, 180)] },
    { key: 'analogas', title: 'Análogas', colors: [rotateHue(base, -30), base, rotateHue(base, 30)] },
    { key: 'triade', title: 'Tríade', colors: [base, rotateHue(base, 120), rotateHue(base, 240)] },
    { key: 'tons', title: 'Tons', colors: steps.map((s) => withLightness(base, s)) },
  ];
}

/** Luminância relativa (WCAG 2) de uma cor, de 0 (preto) a 1 (branco). */
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Razão de contraste (1–21) entre duas cores, como na WCAG. */
export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Nível WCAG para texto normal: 'AAA' (≥7), 'AA' (≥4.5), 'AA grande' (≥3, só texto grande) ou 'falha'. */
export function wcagLevel(ratio) {
  return ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA grande' : 'falha';
}
