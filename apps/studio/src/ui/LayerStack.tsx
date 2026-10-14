// Pilha de camadas em 3D: uma tela de exemplo "explodida" nas camadas que a formam,
// cada uma uma tinta que se mistura com as de baixo. Inclina com o ponteiro e respira devagar.
// Parada para quem pede menos movimento; puramente decorativa (aria-hidden).
import { useEffect, useRef } from 'react';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';

export function LayerStack({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const scene = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scene.current;
    if (!el || !window.matchMedia('(pointer: fine)').matches) return;
    let raf = 0;
    // o ponteiro em qualquer lugar da janela inclina a pilha (não só em cima dela)
    const move = (e: PointerEvent) => {
      if (reduced()) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const px = e.clientX / window.innerWidth - 0.5;
        const py = e.clientY / window.innerHeight - 0.5;
        el.style.setProperty('--tilt-y', `${(px * 16).toFixed(2)}deg`);
        el.style.setProperty('--tilt-x', `${(-py * 10).toFixed(2)}deg`);
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div ref={scene} className={`stack-scene${compact ? ' compact' : ''} ${className}`.trim()} aria-hidden="true">
      <div className="stack">
        <div className="plane p-paper"><i /><i /><i /><i /></div>
        <div className="plane p-c"><span className="tag">&lt;img&gt;</span></div>
        <div className="plane p-m"><span className="tag">&lt;svg&gt;</span></div>
        <div className="plane p-y"><span className="tag">&lt;button&gt;</span></div>
        <div className="plane p-k"><b /><b /><b /><span className="tag">&lt;h1&gt;</span></div>
        <div className="plane p-sel"><em /><em /><em /><em /></div>
      </div>
      <div className="stack-shadow" />
    </div>
  );
}
