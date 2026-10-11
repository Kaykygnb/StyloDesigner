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
  return out;
}
