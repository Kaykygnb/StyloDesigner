// Os "players" que o site exportado precisa para a mídia que o projeto USA: <model-viewer> (3D) e Lottie.
// Vídeo e áudio são nativos do navegador e não precisam de nada. Os scripts vão para dentro do zip (vendor/),
// nunca de um CDN: o site exportado funciona offline e não depende de terceiros.
import type { SiteFile } from './site-export.ts';

/** Entrega os bytes de um script empacotado ("model-viewer.min.js", "lottie_light.min.js"); null se o servidor não tem. */
export type VendorProvider = (name: string) => Uint8Array | null;

/** Liga cada <div data-lottie-src> ao player (lottie-web). */
const LOTTIE_INIT = `// Inicia as animações Lottie do site (elementos com data-lottie-src).
document.querySelectorAll('[data-lottie-src]').forEach(function (el) {
  window.lottie.loadAnimation({
    container: el,
    renderer: 'svg',
    path: el.getAttribute('data-lottie-src'),
    loop: el.hasAttribute('data-loop'),
    autoplay: el.hasAttribute('data-autoplay'),
  });
});
`;

/** Gira os <model-viewer data-scroll-orbit> conforme a rolagem da página (uma volta do topo ao fim). Parado com "menos movimento". */
export const MODEL_SCROLL = `// Gira os modelos 3D marcados com data-scroll-orbit conforme a página rola.
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var queued = false;
  function update() {
    queued = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    document.querySelectorAll('model-viewer[data-scroll-orbit]').forEach(function (el) {
      if (!el.dataset.orbitBase) el.dataset.orbitBase = el.getAttribute('camera-orbit') || '0deg 75deg auto';
      var base = el.dataset.orbitBase.split(/\\s+/);
      el.setAttribute('camera-orbit', ((parseFloat(base[0]) || 0) + progress * 360) + 'deg ' + base[1] + ' ' + base[2]);
    });
  }
  window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('load', update);
})();
`;

const NEEDS = [
  { marker: '<model-viewer', vendor: 'model-viewer.min.js', label: '3D', tags: ['<script type="module" src="vendor/model-viewer.min.js"></script>'] },
  {
    marker: 'data-lottie-src', vendor: 'lottie_light.min.js', label: 'Lottie',
    tags: ['<script src="vendor/lottie_light.min.js"></script>', '<script defer src="vendor/stylo-lottie.js"></script>'],
    extra: [{ path: 'vendor/stylo-lottie.js', content: LOTTIE_INIT }],
  },
];

/** Acrescenta os scripts dos players usados em cada página (e só neles). Sem `vendor`, avisa que o player faltou. */
export function addMediaRuntime(files: SiteFile[], vendor: VendorProvider | null | undefined, warnings: string[]): SiteFile[] {
  let out = files;
  for (const need of NEEDS) {
    const uses = (f: SiteFile) => typeof f.content === 'string' && f.content.includes(need.marker);
    if (!out.some(uses)) continue;
    const bytes = vendor?.(need.vendor) ?? null;
    if (!bytes) {
      warnings.push(`O projeto usa mídia ${need.label}, mas este servidor não tem o player (${need.vendor}); o elemento vai aparecer vazio.`);
      continue;
    }
    const tags = need.tags.join('\n') + '\n';
    out = out.map((f) => (uses(f) && typeof f.content === 'string' && f.content.includes('</head>') ? { ...f, content: f.content.replace('</head>', tags + '</head>') } : f));
    out = [...out, { path: `vendor/${need.vendor}`, content: bytes }, ...(need.extra || [])];
  }
  // giro do modelo conforme a rolagem: um script pequeno nosso, só nas páginas que pedem
  const scrolls = (f: SiteFile) => typeof f.content === 'string' && f.content.includes('data-scroll-orbit') && f.content.includes('</head>');
  if (out.some(scrolls)) {
    out = out.map((f) => (scrolls(f) ? { ...f, content: (f.content as string).replace('</head>', '<script defer src="vendor/stylo-model-scroll.js"></script>\n</head>') } : f));
    out = [...out, { path: 'vendor/stylo-model-scroll.js', content: MODEL_SCROLL }];
  }
  return out;
}
