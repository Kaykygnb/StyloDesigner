/**
 * Material Symbols (Google) — ícones, sem chave. Lista de 4.299 nomes embutida no núcleo (busca com sinônimos em português);
 * o SVG vem do servidor de arquivos do Google. Licença Apache 2.0: uso comercial livre, sem crédito obrigatório.
 * Para colocar o ícone no design como vetor editável, use a ferramenta `insert_icon`.
 */

import { iconUrl, searchIcons } from '@stylo/core/icons.ts';
import type { AssetProvider } from '../types.ts';

export const material: AssetProvider = {
  id: 'material-symbols',
  name: 'Material Symbols (Google)',
  kinds: ['icon'],
  sourceUrl: 'https://fonts.google.com/icons', licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
  licenseSummary: 'Apache 2.0: uso comercial livre, sem crédito obrigatório.',
  async search({ query, page }) {
    const all: string[] = searchIcons(query);
    const start = (page - 1) * 20;
    const license = { name: 'Apache License 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0', commercial: true, attribution: 'none' as const };
    return {
      results: all.slice(start, start + 20).map((name) => ({
        ref: `material-symbols:${name}`, provider: 'material-symbols', kind: 'icon' as const, title: name, preview_url: iconUrl(name, 'outlined', false),
        page_url: `https://fonts.google.com/icons?icon.query=${encodeURIComponent(name)}`, license, credit: 'Material Symbols (Google), Apache 2.0',
        download: { url: iconUrl(name, 'outlined', false), mime: 'image/svg+xml' }, extra: { name },
      })),
      hasMore: start + 20 < all.length,
    };
  },
};
