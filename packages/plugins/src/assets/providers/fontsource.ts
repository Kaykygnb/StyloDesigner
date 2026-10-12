/**
 * Fontsource — o catálogo do Google Fonts (cerca de 2.000 famílias), sem chave.
 * https://api.fontsource.org/v1/fonts — metadados (categoria, pesos, estilos, subconjuntos, licença) e, por família,
 * os arquivos .woff2 de cada peso/estilo/subconjunto (hospedados no jsDelivr). Todas as famílias têm licença livre
 * (SIL OFL 1.1, Apache 2.0...), com uso comercial permitido e sem crédito obrigatório. Usamos para HOSPEDAR a fonte no
 * projeto e no zip exportado, em vez de depender do CDN do Google.
 */

import type { AssetProvider, AssetResult, License, ProviderEnv } from '../types.ts';

const LICENSES: Record<string, License> = {
  'OFL-1.1': { name: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org/', commercial: true, attribution: 'none' },
  'Apache-2.0': { name: 'Apache License 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0', commercial: true, attribution: 'none' },
};
const licenseOf = (id: string): License => LICENSES[id] ?? { name: id || 'Licença livre', commercial: true, attribution: 'none' };

export interface FontEntry { id: string; family: string; subsets: string[]; weights: number[]; styles: string[]; defSubset: string; variable: boolean; category: string; license: string }

let catalog: { at: number; list: FontEntry[] } | null = null;
const DAY = 24 * 60 * 60_000;

/** O catálogo inteiro (guardado por 24 h na memória). */
export async function fontCatalog(getJson: ProviderEnv['getJson']): Promise<FontEntry[]> {
  if (catalog && Date.now() - catalog.at < DAY) return catalog.list;
  const data = await getJson('https://api.fontsource.org/v1/fonts?type=google');
  catalog = { at: Date.now(), list: (Array.isArray(data) ? data : []) as FontEntry[] };
  return catalog.list;
}
/** Só para testes. */
export const resetFontCatalog = () => { catalog = null; };

export interface FontFile { weight: number; style: string; subset: string; url: string }

/** Arquivos .woff2 de uma família: um por peso/estilo/subconjunto pedidos. */
export async function fontFiles(
  id: string, { weights, styles = ['normal'], subsets }: { weights?: number[]; styles?: string[]; subsets?: string[] }, getJson: ProviderEnv['getJson'],
): Promise<{ family: string; license: License; files: FontFile[]; entry: any }> {
  const data = await getJson(`https://api.fontsource.org/v1/fonts/${encodeURIComponent(id)}`);
  const wanted = subsets?.length ? subsets : [data.defSubset || 'latin'];
  const chosenWeights = (weights?.length ? weights : [400, 700].filter((w) => (data.weights || []).includes(w))).filter((w) => (data.weights || []).includes(w));
  const files: FontFile[] = [];
  for (const w of chosenWeights.length ? chosenWeights : [(data.weights || [400])[0]]) {
    for (const style of styles) {
      for (const subset of wanted) {
        const url = data.variants?.[String(w)]?.[style]?.[subset]?.url?.woff2;
        if (url) files.push({ weight: w, style, subset, url });
      }
    }
  }
  return { family: data.family, license: licenseOf(data.license), files, entry: data };
}

export const fontsource: AssetProvider = {
  id: 'fontsource',
  name: 'Google Fonts (via Fontsource)',
  kinds: ['font'],
  sourceUrl: 'https://fontsource.org/fonts', licenseUrl: 'https://openfontlicense.org/',
  licenseSummary: 'Licenças livres (OFL, Apache): uso comercial permitido, sem crédito obrigatório.',
  cacheMs: DAY,
  async search({ query, page, category }, { getJson }) {
    const list = await fontCatalog(getJson);
    const q = query.trim().toLowerCase();
    const matches = list.filter((f) => (!q || f.family.toLowerCase().includes(q) || f.id.includes(q.replace(/\s+/g, '-'))) && (!category || f.category === category));
    const start = (page - 1) * 20;
    const results: AssetResult[] = matches.slice(start, start + 20).map((f) => {
      const license = licenseOf(f.license);
      return {
        ref: `fontsource:${f.id}`, provider: 'fontsource', kind: 'font', title: f.family, page_url: `https://fonts.google.com/specimen/${encodeURIComponent(f.family).replace(/%20/g, '+')}`,
        license, credit: `${f.family} — ${license.name} (Google Fonts)`,
        extra: { id: f.id, category: f.category, weights: f.weights, styles: f.styles, subsets: f.subsets, variable: f.variable, defaultSubset: f.defSubset },
      };
    });
    return { results, hasMore: start + 20 < matches.length };
  },
};
