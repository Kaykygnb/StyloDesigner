const CACHE_MS = 4 * 60 * 1000;
/** Openverse sem login aceita no máximo 20 por página (com 24 responde 401). */
export const OPENVERSE_PAGE = 20;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const cache = new Map();

const allowedHosts = [
  'api.openverse.org', 'media.openverse.org', 'images.pexels.com', 'images.unsplash.com', 'live.staticflickr.com',
  'upload.wikimedia.org', 'cdn.pixabay.com',
];

export function commercialLicense(result) {
  const type = String(result?.license_type || '').toLowerCase();
  const license = String(result?.license || '').toLowerCase();
  // "nd" (sem derivações) fica de fora: recortar ou editar a foto num design já é uma obra derivada
  if (/(^|-)nd(-|$)|(^|-)nc(-|$)/.test(license)) return false;
  return type === 'commercial' || (!type && /^(cc0|pdm|by|by-sa)$/.test(license));
}

export function normalizeOpenverse(item) {
  const license = String(item.license || '');
  const author = String(item.creator || 'Autor desconhecido');
  const licenseUrl = item.license_url || '';
  const attributionRequired = /(^|-)by(-|$)/i.test(license);
  let full = item.url || item.thumbnail;
  try { validateProxyUrl(full); } catch { full = item.thumbnail || item.url; }
  return {
    id: `openverse:${item.id}`, provider: 'Openverse', thumb: item.thumbnail || item.url,
    full, width: Number(item.width) || 0, height: Number(item.height) || 0,
    author, authorUrl: item.creator_url || '', sourceUrl: item.foreign_landing_url || '',
    license, licenseUrl, attribution: `${author} · ${license}${licenseUrl ? ` · ${licenseUrl}` : ''}`,
    attributionRequired,
  };
}

export function normalizePexels(item) {
  const author = String(item.photographer || 'Fotógrafo desconhecido');
  const license = 'Pexels';
  return {
    id: `pexels:${item.id}`, provider: 'Pexels', thumb: item.src?.medium || item.src?.small,
    full: item.src?.large2x || item.src?.large || item.src?.original,
    width: Number(item.width) || 0, height: Number(item.height) || 0,
    author, authorUrl: item.photographer_url || '', sourceUrl: item.url || '',
    license, licenseUrl: 'https://www.pexels.com/license/',
    attribution: `${author} · Pexels`, attributionRequired: false,
  };
}

export function normalizeResults(openverse = [], pexels = []) {
  return [
    ...openverse.filter(commercialLicense).map(normalizeOpenverse).filter((x) => x.thumb && x.full),
    ...pexels.map(normalizePexels).filter((x) => x.thumb && x.full),
  ];
}

export function validateProxyUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('URL de imagem inválida.'); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !allowedHosts.includes(host)) {
    throw new Error('Este endereço de imagem não pertence a um provedor permitido.');
  }
  return url;
}

export function validateImageResponse(contentType, contentLength) {
  // só formatos de bitmap: SVG pode carregar script e seria servido pela origem do próprio editor (XSS)
  if (!/^image\/(png|jpe?g|webp|gif|avif)(?:\s*;|$)/i.test(String(contentType || ''))) throw new Error('O provedor não devolveu um tipo de imagem permitido.');
  const size = Number(contentLength);
  if (Number.isFinite(size) && size > MAX_PHOTO_BYTES) throw new Error('A imagem ultrapassa o limite de 8 MB.');
}

export async function boundedPhotoBytes(response) {
  validateImageResponse(response.headers.get('content-type'), response.headers.get('content-length'));
  if (!response.body) throw new Error('O provedor devolveu uma resposta vazia.');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PHOTO_BYTES) { await reader.cancel(); throw new Error('A imagem ultrapassa o limite de 8 MB.'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

export function createPhotosHandler({ getKey = () => '', fetchImpl = fetch, now = Date.now } = {}) {
  return async function photos(req, res, config = {}) {
    const url = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET') return json(res, 405, { error: 'Use GET nesta rota.' });
    if (url.pathname === '/api/photos/fetch') {
      let target;
      try { target = validateProxyUrl(url.searchParams.get('url') || ''); }
      catch (err) { return json(res, 400, { error: err.message }); }
      try {
        let response;
        for (let hop = 0; hop <= 3; hop++) {
          response = await fetchImpl(target, { redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { Accept: 'image/*' } });
          if (![301, 302, 303, 307, 308].includes(response.status)) break;
          const location = response.headers.get('location');
          if (!location || hop === 3) throw new Error('O provedor redirecionou a imagem em excesso.');
          target = validateProxyUrl(new URL(location, target).href);
        }
        if (!response.ok) throw new Error(`O provedor respondeu ${response.status}.`);
        const bytes = await boundedPhotoBytes(response);
        res.writeHead(200, { 'Content-Type': response.headers.get('content-type').split(';')[0], 'Content-Length': bytes.length, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" });
        return res.end(bytes);
      } catch (err) {
        if (res.headersSent) return res.end();
        return json(res, 502, { error: err.name === 'TimeoutError' ? 'O provedor demorou demais para entregar a imagem.' : err.message || 'Falha ao baixar a imagem.' });
      }
    }
    if (url.pathname !== '/api/photos/search') return json(res, 404, { error: 'Rota de fotos não encontrada.' });
    const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
    if (!q) return json(res, 400, { error: 'Digite o que deseja buscar.' });
    const page = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1));
    const orientation = ['landscape', 'portrait', 'square'].includes(url.searchParams.get('orientation')) ? url.searchParams.get('orientation') : '';
    const key = String(getKey(config) || '').trim();
    const cacheKey = JSON.stringify([q.toLowerCase(), page, orientation, !!key]);
    const saved = cache.get(cacheKey);
    if (saved && saved.until > now()) return json(res, 200, saved.value);
    const common = new URLSearchParams({ q, page: String(page), page_size: String(OPENVERSE_PAGE), license_type: 'commercial' });
    if (orientation) common.set('aspect_ratio', ({ landscape: 'wide', portrait: 'tall', square: 'square' })[orientation]);
    const tasks = [fetchImpl(`https://api.openverse.org/v1/images/?${common}`, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' } }).then(async (r) => {
      if (!r.ok) throw new Error(`Openverse respondeu ${r.status}.`);
      const d = await r.json();
      return normalizeResults(d.results || []).slice(0, 30);
    })];
    if (key) {
      const p = new URLSearchParams({ query: q, page: String(page), per_page: '24' });
      if (orientation) p.set('orientation', orientation);
      tasks.push(fetchImpl(`https://api.pexels.com/v1/search?${p}`, { signal: AbortSignal.timeout(10000), headers: { Authorization: key, Accept: 'application/json' } }).then(async (r) => {
        if (!r.ok) throw new Error(`Pexels respondeu ${r.status}.`);
        const d = await r.json();
        return normalizeResults([], d.photos || []);
      }));
    }
    const settled = await Promise.allSettled(tasks);
    const results = settled.flatMap((x) => x.status === 'fulfilled' ? x.value : []);
    if (!results.length) {
      const reasons = settled.filter((x) => x.status === 'rejected').map((x) => x.reason?.message).filter(Boolean);
      return json(res, 502, { error: reasons.join(' ') || 'Nenhuma imagem encontrada.' });
    }
    const value = { results: results.slice(0, 48), page, hasMore: results.length >= OPENVERSE_PAGE, hasPexels: !!key };
    for (const [entry, item] of cache) if (item.until <= now()) cache.delete(entry);
    if (cache.size >= 200) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { until: now() + CACHE_MS, value });
    return json(res, 200, value);
  };
}
