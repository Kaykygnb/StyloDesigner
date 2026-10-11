/**
 * Openverse (WordPress) — imagens e ÁUDIO de licença aberta, sem chave.
 * Só pedimos licenças de uso comercial (`license_type=commercial`). Cada resultado traz a licença e o texto de atribuição.
 * https://api.openverse.org/ — sem conta, até 20 resultados por página.
 */

import type { AssetProvider, AssetResult, License } from '../types.ts';

const CC_NAMES: Record<string, string> = { by: 'CC BY', 'by-sa': 'CC BY-SA', 'by-nd': 'CC BY-ND', cc0: 'CC0', pdm: 'Domínio público (PDM)', 'by-nc': 'CC BY-NC' };

export function openverseLicense(item: any): License {
  const code = String(item.license || '').toLowerCase();
  const version = item.license_version ? ` ${item.license_version}` : '';
  const name = code === 'cc0' || code === 'pdm' ? (CC_NAMES[code] ?? code) + version : `${CC_NAMES[code] ?? `CC ${code.toUpperCase()}`}${version}`;
  return { name, url: item.license_url || undefined, commercial: !/nc/.test(code), attribution: code === 'cc0' || code === 'pdm' ? 'none' : 'required' };
}

const creditOf = (item: any, license: License) =>
  item.attribution || `“${item.title || 'Sem título'}”${item.creator ? ` de ${item.creator}` : ''} — ${license.name}${item.foreign_landing_url ? ` (${item.foreign_landing_url})` : ''}`;

export const openverse: AssetProvider = {
  id: 'openverse',
  name: 'Openverse',
  kinds: ['image', 'audio'],
  licenseSummary: 'Creative Commons e domínio público, só uso comercial; atribuição conforme a licença de cada item.',
  cacheMs: 10 * 60_000,
  async search({ kind, query, page, orientation }, { getJson }) {
    const audio = kind === 'audio';
    const params = new URLSearchParams({ q: query, page: String(page), page_size: '20', license_type: 'commercial' });
    if (!audio && orientation) params.set('aspect_ratio', ({ landscape: 'wide', portrait: 'tall', square: 'square' })[orientation]);
    const data = await getJson(`https://api.openverse.org/v1/${audio ? 'audio' : 'images'}/?${params}`);
    const results: AssetResult[] = (data.results || []).filter((r: any) => r.url).map((r: any) => {
      const license = openverseLicense(r);
      return {
        ref: `openverse:${r.id}`, provider: 'openverse', kind, title: String(r.title || 'Sem título').slice(0, 160),
        preview_url: r.thumbnail || (audio ? undefined : r.url), page_url: r.foreign_landing_url, author: r.creator || undefined, author_url: r.creator_url || undefined,
        width: r.width || undefined, height: r.height || undefined, duration: audio && r.duration ? Math.round(r.duration / 1000) : undefined,
        license, credit: creditOf(r, license), download: { url: r.url, mime: audio ? (r.filetype ? `audio/${r.filetype}` : undefined) : (r.filetype ? `image/${r.filetype}` : undefined), size: r.filesize || undefined },
      } satisfies AssetResult;
    });
    return { results, hasMore: Number(data.page_count || 0) > page };
  },
};
