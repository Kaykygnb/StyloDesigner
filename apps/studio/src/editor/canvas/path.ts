// Contas do vetor desenhado à mão (caneta/lápis), sem DOM: dá para testar no Node.
import { flattenContour } from '@stylo/core/geom.js';

export interface StrokePoint { x: number; y: number; hin?: { x: number; y: number } | null; hout?: { x: number; y: number } | null }

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Pontos desenhados no mundo → vetor pronto para criar: caixa (x0, y0, w, h) e pontos relativos a ela.
 * A caixa é a da CURVA desenhada, não a das alças de controle (que ficam de fora do desenho e esticariam a seleção).
 */
export function pathFromStroke(pts: StrokePoint[], closed: boolean) {
  const curve = flattenContour(pts, closed, 0.25);
  const xs = curve.map((p) => p.x), ys = curve.map((p) => p.y);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const w = Math.max(1, Math.round(Math.max(...xs) - x0)), h = Math.max(1, Math.round(Math.max(...ys) - y0));
  const rel = (p?: { x: number; y: number } | null) => (p ? { x: round2(p.x - x0), y: round2(p.y - y0) } : null);
  const points = pts.map((p) => ({ x: round2(p.x - x0), y: round2(p.y - y0), hin: rel(p.hin), hout: rel(p.hout) }));
  return { x0, y0, w, h, points };
}

/** Atributo `d` de um <path> SVG com os pontos do vetor (curvas cúbicas; reta quando não há alças). */
export function pathD(node: { points?: { x: number; y: number; hin?: { x: number; y: number } | null; hout?: { x: number; y: number } | null }[]; closed?: boolean; contours?: { points: { x: number; y: number; hin?: { x: number; y: number } | null; hout?: { x: number; y: number } | null }[]; closed?: boolean }[] }): string {
  const drawContour = (points: NonNullable<typeof node.points>, closed: boolean) => {
    if (!points.length) return [] as string[];
    const parts = [`M ${points[0].x} ${points[0].y}`];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const c1 = a.hout ?? { x: a.x, y: a.y }, c2 = b.hin ?? { x: b.x, y: b.y };
      parts.push(`C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`);
    }
    if (closed) parts.push('Z');
    return parts;
  };
  const parts = drawContour(node.points ?? [], node.closed === true);
  for (const contour of node.contours ?? []) parts.push(...drawContour(contour.points, contour.closed !== false));
  return parts.join(' ');
}
