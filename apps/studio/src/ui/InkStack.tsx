// A pilha de tintas em 3D (three.js), com a pilha em CSS como reserva.
// O three.js só é baixado quando a cena aparece. Sem WebGL (ou se algo falhar), fica a versão em CSS, que já existia.
// A animação de entrada (camadas caindo) toca só na primeira vez da sessão, para não cansar quem volta várias vezes.
import { useEffect, useRef, useState } from 'react';
import { LayerStack } from './LayerStack';

const INTRO_KEY = 'stylo.inkIntro';

function firstTimeThisSession(): boolean {
  try {
    if (sessionStorage.getItem(INTRO_KEY)) return false;
    sessionStorage.setItem(INTRO_KEY, '1');
    return true;
  } catch { return false; }
}

export function InkStack({ className = '' }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'loading' | '3d' | 'css'>('loading');

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let handle: { dispose(): void } | null = null;
    let cancelled = false;
    // só baixa e liga o 3D quando a área aparece de fato (em telas estreitas ela fica escondida)
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === 0 || el.clientHeight === 0) return;
      ro.disconnect();
      import('./ink3d/scene')
        .then(({ createInkScene }) => {
          if (cancelled) return;
          handle = createInkScene(el, { intro: firstTimeThisSession() });
          setMode('3d');
        })
        .catch(() => { if (!cancelled) setMode('css'); });
    });
    ro.observe(el);
    return () => { cancelled = true; ro.disconnect(); handle?.dispose(); };
  }, []);

  if (mode === 'css') return <LayerStack className={className} />;
  return <div ref={host} className={`ink3d ${mode === '3d' ? 'ready' : ''} ${className}`.trim()} aria-hidden="true" />;
}
