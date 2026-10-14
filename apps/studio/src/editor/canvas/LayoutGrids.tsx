// Grades de layout (colunas, linhas, quadrículas) desenhadas por cima dos frames. São só guia visual: não vão para o código.
import type { LayerNode } from '../../lib/types';
import type { Box } from './geometry';

type Grid = { type?: 'columns' | 'rows' | 'grid'; count?: number; gutter?: number; margin?: number; size?: number; color?: string; opacity?: number };

/** Faixas de uma grade de colunas/linhas, como no Figma: margem dos dois lados e calhas entre as faixas. */
export function gridBands(length: number, g: Grid): { start: number; size: number }[] {
  const count = Math.max(1, Math.round(Number(g.count) || 12));
  const gutter = Math.max(0, Number(g.gutter) || 0);
  const margin = Math.max(0, Number(g.margin) || 0);
  const band = (length - margin * 2 - gutter * (count - 1)) / count;
  if (!(band > 0)) return [];
  return Array.from({ length: count }, (_, i) => ({ start: margin + i * (band + gutter), size: band }));
}

const rgba = (hex: string | undefined, a: number) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0xff3d3d;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
};

export function LayoutGrids({ frames, aabbOf }: { frames: LayerNode[]; aabbOf: (id: string) => Box | null }) {
  return (
    <div className="layout-grids" aria-hidden="true">
      {frames.map((f) => {
        if (f.visible === false) return null;
        const box = aabbOf(f.id);
        if (!box || box.w <= 0 || box.h <= 0) return null;
        return (
          <div key={f.id} className="layout-grid" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
            {((f.grids ?? []) as Grid[]).map((g, i) => {
              const color = rgba(g.color, g.opacity ?? 0.12);
              if (g.type === 'grid') {
                const s = Math.max(2, Number(g.size) || 8);
                const line = rgba(g.color, Math.min(1, (g.opacity ?? 0.12) * 2));
                return <div key={i} className="layout-grid-cells" style={{ backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`, backgroundSize: `${s}px ${s}px` }} />;
              }
              const rows = g.type === 'rows';
              return gridBands(rows ? box.h : box.w, g).map((b, k) => (
                <div key={`${i}-${k}`} className="layout-grid-band" style={rows ? { top: b.start, height: b.size, left: 0, right: 0, background: color } : { left: b.start, width: b.size, top: 0, bottom: 0, background: color }} />
              ));
            })}
          </div>
        );
      })}
    </div>
  );
}
