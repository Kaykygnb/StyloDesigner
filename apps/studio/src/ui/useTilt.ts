// Inclinação 3D sutil em cartões (perspectiva + brilho que segue o ponteiro).
// Desligada em telas de toque e quando a pessoa prefere menos movimento.
import { useCallback, useRef, type CSSProperties, type PointerEvent } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

export interface Tilt {
  style: CSSProperties;
  onPointerMove: (e: PointerEvent) => void;
  onPointerLeave: (e: PointerEvent) => void;
}

export function useTilt(max = 7): Tilt {
  const raf = useRef(0);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!finePointer() || reduced()) return;
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.setProperty('--ry', `${((px - 0.5) * max).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${((0.5 - py) * max).toFixed(2)}deg`);
      el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    });
  }, [max]);

  const onPointerLeave = useCallback((e: PointerEvent) => {
    cancelAnimationFrame(raf.current);
    const el = e.currentTarget as HTMLElement;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }, []);

  return { style: { '--rx': '0deg', '--ry': '0deg' } as CSSProperties, onPointerMove, onPointerLeave };
}
