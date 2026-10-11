/**
 * Pixabay — fotos, ilustrações, vetores e VÍDEOS (chave de API grátis).
 * Documentação oficial: https://pixabay.com/api/docs/ — imagens em /api/, vídeos em /api/videos/; 100 pedidos por 60 s por
 * chave; as respostas devem ficar em cache por 24 h; NÃO se deve ligar permanentemente às URLs das imagens (por isso a
 * biblioteca baixa o arquivo). Pede-se mostrar de onde vêm as imagens: o crédito é registrado. Licença: Pixabay Content License.
 */

import type { AssetProvider, AssetResult, License } from '../types.ts';

const LICENSE: License = { name: 'Pixabay Content License', url: 'https://pixabay.com/service/license-summary/', commercial: true, attribution: 'none' };

export const pixabay: AssetProvider = {
  id: 'pixabay',
  name: 'Pixabay',
  kinds: ['image', 'video'],
  needsKey: { label: 'Chave da API do Pixabay (grátis)', signupUrl: 'https://pixabay.com/api/docs/', envVar: 'PIXABAY_API_KEY' },
  licenseSummary: 'Pixabay Content License: uso comercial livre, sem atribuição obrigatória (mostramos a origem).',
  cacheMs: 24 * 60 * 60_000, // exigência do Pixabay
  async search({ kind, query, page, orientation }, { key, getJson }) {
    if (!key) throw new Error('Sem chave do Pixabay.');
    const video = kind === 'video';
    const params = new URLSearchParams({ key, q: query.slice(0, 100), page: String(page), per_page: '20', safesearch: 'true' });
    if (!video && orientation && orientation !== 'square') params.set('orientation', orientation === 'landscape' ? 'horizontal' : 'vertical');
    const data = await getJson(`https://pixabay.com/api/${video ? 'videos/' : ''}?${params}`);
    const results: AssetResult[] = [];
    for (const h of data.hits || []) {
      const credit = `${video ? 'Vídeo' : 'Imagem'} de ${h.user ?? 'autor desconhecido'} no Pixabay (${h.pageURL})`;
      if (video) {
        const file = ['large', 'medium', 'small'].map((q) => h.videos?.[q]).find((f) => f?.url && f.size > 0);
        if (!file) continue;
        results.push({
          ref: `pixabay:video:${h.id}`, provider: 'pixabay', kind: 'video', title: String(h.tags || `Vídeo ${h.id}`).slice(0, 160), preview_url: h.videos?.medium?.thumbnail || h.videos?.small?.thumbnail,
          page_url: h.pageURL, author: h.user, width: file.width, height: file.height, duration: h.duration, license: LICENSE, credit, download: { url: file.url, mime: 'video/mp4', size: file.size },
        });
      } else if (h.largeImageURL) {
        results.push({
          ref: `pixabay:image:${h.id}`, provider: 'pixabay', kind: 'image', title: String(h.tags || `Imagem ${h.id}`).slice(0, 160), preview_url: h.webformatURL || h.previewURL,
          page_url: h.pageURL, author: h.user, width: h.imageWidth, height: h.imageHeight, license: LICENSE, credit, download: { url: h.largeImageURL },
        });
      }
    }
    return { results, hasMore: (data.totalHits || 0) > page * 20 };
  },
};
