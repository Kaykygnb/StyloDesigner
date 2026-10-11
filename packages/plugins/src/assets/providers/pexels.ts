/**
 * Pexels — fotos e VÍDEOS gratuitos (chave de API grátis).
 * Documentação oficial: https://www.pexels.com/api/documentation/ — `Authorization: <chave>`; fotos em /v1/search, vídeos
 * em /v1/videos/search (até 80 por página); limite de 200 pedidos por hora. Licença Pexels: uso comercial livre, crédito
 * ao fotógrafo e link para o Pexels pedidos (registramos o crédito; o arquivo de créditos do site exportado os mostra).
 */

import type { AssetProvider, AssetResult, License } from '../types.ts';

const LICENSE: License = { name: 'Licença Pexels', url: 'https://www.pexels.com/license/', commercial: true, attribution: 'optional' };

/** Escolhe o arquivo de vídeo: MP4 em HD até 1920 px de largura (o maior), senão o melhor disponível. */
export function pickPexelsVideo(files: any[]): any | null {
  const mp4 = files.filter((f) => f.link && /mp4/.test(f.file_type || '') && f.quality !== 'hls');
  const fit = mp4.filter((f) => (f.width || 0) <= 1920).sort((a, b) => (b.width || 0) - (a.width || 0));
  return fit[0] ?? mp4.sort((a, b) => (a.width || 0) - (b.width || 0))[0] ?? null;
}

export const pexels: AssetProvider = {
  id: 'pexels',
  name: 'Pexels',
  kinds: ['image', 'video'],
  needsKey: { label: 'Chave da API do Pexels (grátis)', signupUrl: 'https://www.pexels.com/api/', envVar: 'PEXELS_API_KEY' },
  licenseSummary: 'Licença Pexels: uso comercial livre; crédito ao autor e link para o Pexels recomendados.',
  cacheMs: 10 * 60_000,
  async search({ kind, query, page, orientation }, { key, getJson }) {
    if (!key) throw new Error('Sem chave do Pexels.');
    const video = kind === 'video';
    const params = new URLSearchParams({ query, page: String(page), per_page: '20' });
    if (orientation) params.set('orientation', orientation);
    const data = await getJson(`https://api.pexels.com/v1/${video ? 'videos/' : ''}search?${params}`, { headers: { Authorization: key } });
    const results: AssetResult[] = [];
    if (video) {
      for (const v of data.videos || []) {
        const file = pickPexelsVideo(v.video_files || []);
        if (!file) continue;
        results.push({
          ref: `pexels:video:${v.id}`, provider: 'pexels', kind: 'video', title: `Vídeo ${v.id}${v.user?.name ? ` de ${v.user.name}` : ''}`, preview_url: v.image, page_url: v.url,
          author: v.user?.name, author_url: v.user?.url, width: file.width, height: file.height, duration: v.duration, license: LICENSE,
          credit: `Vídeo de ${v.user?.name ?? 'autor desconhecido'} no Pexels (${v.url})`, download: { url: file.link, mime: file.file_type },
        });
      }
    } else {
      for (const p of data.photos || []) {
        results.push({
          ref: `pexels:photo:${p.id}`, provider: 'pexels', kind: 'image', title: p.alt || `Foto ${p.id}`, preview_url: p.src?.medium, page_url: p.url,
          author: p.photographer, author_url: p.photographer_url, width: p.width, height: p.height, license: LICENSE,
          credit: `Foto de ${p.photographer ?? 'autor desconhecido'} no Pexels (${p.url})`, download: { url: p.src?.large2x || p.src?.large || p.src?.original },
        });
      }
    }
    return { results: results.filter((r) => r.download?.url), hasMore: !!data.next_page };
  },
};
