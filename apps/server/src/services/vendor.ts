// Scripts de terceiros que o site exportado leva dentro do zip (players de mídia). Saem de node_modules,
// lidos uma vez; assim o zip funciona offline e sem CDN. Nome → arquivo da biblioteca.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { VendorProvider } from '@stylo/core/media-runtime.ts';

const require = createRequire(import.meta.url);
const packageDir = (pkg: string) => dirname(require.resolve(`${pkg}/package.json`));

const SOURCES: Record<string, () => string> = {
  'model-viewer.min.js': () => join(packageDir('@google/model-viewer'), 'dist', 'model-viewer.min.js'),
  'lottie_light.min.js': () => join(packageDir('lottie-web'), 'build', 'player', 'lottie_light.min.js'),
};

const cache = new Map<string, Uint8Array | null>();

export const vendorFiles: VendorProvider = (name) => {
  if (!SOURCES[name]) return null;
  if (!cache.has(name)) {
    try { cache.set(name, new Uint8Array(readFileSync(SOURCES[name]()))); } catch { cache.set(name, null); }
  }
  return cache.get(name)!;
};
