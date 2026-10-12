/** Catálogo Lucide Icons. O pacote embutido fornece nomes; o SVG é baixado apenas quando usado. */
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { AssetProvider } from '../types.ts';

const require = createRequire(import.meta.url);
const packageJson = require('lucide-static/package.json') as { version: string };
const version = packageJson.version;
const iconBase = `https://unpkg.com/lucide-static@${version}/icons`;
let namesPromise: Promise<string[]> | null = null;

async function iconNames() {
  if (!namesPromise) {
    namesPromise = readFile(require.resolve('lucide-static/icons/activity.svg')).then(async () => {
      const { readdir } = await import('node:fs/promises');
      const dir = require.resolve('lucide-static/icons/activity.svg').replace(/[\\/]activity\.svg$/, '');
      return (await readdir(dir)).filter((name) => name.endsWith('.svg')).map((name) => name.slice(0, -4)).sort();
    });
  }
  return namesPromise;
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const lucide: AssetProvider = {
  id: 'lucide-icons',
  name: 'Lucide Icons',
  kinds: ['icon'],
  sourceUrl: 'https://lucide.dev/icons', licenseUrl: 'https://lucide.dev/license',
  licenseSummary: 'ISC: uso comercial livre; preserve o aviso de licença.',
  async search({ query, page }) {
    const needle = slug(query);
    const all = await iconNames();
    const matches = (needle ? all.filter((name) => slug(name).includes(needle)) : all);
    const start = (page - 1) * 20;
    const license = { name: 'ISC', url: 'https://lucide.dev/license', commercial: true, attribution: 'required' as const };
    return {
      results: matches.slice(start, start + 20).map((name) => ({
        ref: `lucide-icons:${name}`, provider: 'lucide-icons', kind: 'icon' as const, title: name,
        preview_url: `${iconBase}/${name}.svg`, page_url: 'https://lucide.dev/icons',
        license, credit: `Lucide Icons (${name}), ISC`,
        download: { url: `${iconBase}/${name}.svg`, mime: 'image/svg+xml' }, extra: { collection: 'Lucide', version },
      })),
      hasMore: start + 20 < matches.length,
    };
  },
};
