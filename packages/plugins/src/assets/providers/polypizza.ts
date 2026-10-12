/**
 * Poly Pizza — modelos 3D low-poly (.glb), CC0 e CC-BY (chave de API grátis).
 * ATENÇÃO: não consegui conferir a documentação oficial desta API (só descrições de terceiros: base
 * https://api.poly.pizza/v1, cabeçalho `X-Auth-Token`, busca em /search/{consulta}). Por isso o provedor é marcado
 * `unverified` e a leitura da resposta é defensiva (aceita variações de nome de campo). Se a API mudar, só este arquivo muda.
 */

import type { AssetProvider, AssetResult, License } from '../types.ts';

const pick = (o: any, ...names: string[]) => { for (const n of names) if (o?.[n] != null && o[n] !== '') return o[n]; return undefined; };

function licenseOf(raw: unknown): License {
  const text = String(raw ?? '').toLowerCase();
  if (/cc0|public domain|zero/.test(text)) return { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/', commercial: true, attribution: 'none' };
  return { name: 'CC BY 3.0/4.0', url: 'https://creativecommons.org/licenses/by/4.0/', commercial: true, attribution: 'required' };
}

export const polypizza: AssetProvider = {
  id: 'polypizza',
  name: 'Poly Pizza',
  kinds: ['model3d'],
  sourceUrl: 'https://poly.pizza/', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  needsKey: { label: 'Chave da API do Poly Pizza (grátis)', signupUrl: 'https://poly.pizza/settings/api', envVar: 'POLYPIZZA_API_KEY' },
  licenseSummary: 'CC0 (sem crédito) ou CC BY (crédito ao autor obrigatório).',
  unverified: true,
  cacheMs: 10 * 60_000,
  async search({ query, page }, { key, getJson }) {
    if (!key) throw new Error('Sem chave do Poly Pizza.');
    const params = new URLSearchParams({ Limit: '20', Page: String(Math.max(0, page - 1)) });
    const data = await getJson(`https://api.poly.pizza/v1/search/${encodeURIComponent(query)}?${params}`, { headers: { 'X-Auth-Token': key } });
    const list: any[] = data?.results ?? data?.Results ?? data?.models ?? (Array.isArray(data) ? data : []);
    const results: AssetResult[] = [];
    for (const m of list) {
      const id = pick(m, 'ID', 'id', 'Id');
      const download = pick(m, 'Download', 'download', 'DownloadURL', 'glb', 'GLB');
      if (!id || !download) continue;
      const title = String(pick(m, 'Title', 'title', 'Name', 'name') ?? `Modelo ${id}`);
      const creator = pick(m, 'Creator', 'creator', 'Author', 'author');
      const author = typeof creator === 'object' ? pick(creator, 'Username', 'username', 'Name', 'name') : creator;
      const license = licenseOf(pick(m, 'Licence', 'License', 'licence', 'license'));
      results.push({
        ref: `polypizza:${id}`, provider: 'polypizza', kind: 'model3d', title: title.slice(0, 160), preview_url: pick(m, 'Thumbnail', 'thumbnail', 'Image', 'image'),
        page_url: `https://poly.pizza/m/${id}`, author: author ? String(author) : undefined, license,
        credit: `“${title}”${author ? ` de ${author}` : ''} — ${license.name} (https://poly.pizza/m/${id})`, download: { url: String(download), mime: 'model/gltf-binary' },
        extra: { triangles: pick(m, 'Tri Count', 'TriCount', 'tricount', 'triCount'), animated: pick(m, 'Animated', 'animated') },
      });
    }
    return { results, hasMore: list.length >= 20 };
  },
};
