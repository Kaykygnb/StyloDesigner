import { h } from './dom.js';

const suggestions = ['pessoas', 'escritório', 'natureza', 'comida', 'textura'];
const safeExternalUrl = (value) => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
};

export function createPhotosPanel({ store, commands, canvas, toast }) {
  let query = '';
  let orientation = '';
  let page = 1;
  let results = [];
  let busy = false;
  let hasMore = false;
  const status = h('p.photo-status', { role: 'status' }, 'Busque fotos gratuitas no Openverse.');
  const grid = h('div.photo-grid');
  const more = h('button.btn.photo-more', { type: 'button', onclick: () => search(true) }, 'Carregar mais');
  const input = h('input.comp-search', { type: 'search', placeholder: 'Buscar fotos', 'aria-label': 'Buscar fotos', onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') search(false); } });
  const orient = h('select.select.photo-orientation', { 'aria-label': 'Orientação da foto', onchange: () => { orientation = orient.value; search(false); } },
    h('option', { value: '' }, 'Todas as orientações'), h('option', { value: 'landscape' }, 'Horizontal'), h('option', { value: 'portrait' }, 'Vertical'), h('option', { value: 'square' }, 'Quadrada'));
  const suggestionsEl = h('div.photo-suggestions', suggestions.map((s) => h('button.photo-chip', { type: 'button', onclick: () => { input.value = s; search(false); } }, s)));
  const root = h('div.photo-lib', h('div.photo-search', h('div.field', input), h('button.btn.primary', { type: 'button', onclick: () => search(false) }, 'Buscar'), orient), suggestionsEl,
    h('p.photo-hint', 'Openverse permite uso comercial conforme a licença. O Pexels aparece quando há uma chave configurada no servidor.'), status, grid, more);

  async function download(item) {
    const response = await fetch(`/api/photos/fetch?url=${encodeURIComponent(item.full)}`);
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Não consegui baixar esta foto.'); }
    const blob = await response.blob();
    return new File([blob], `foto-${item.id.replace(':', '-')}.${(blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`, { type: blob.type || 'image/jpeg' });
  }

  function center() {
    const r = canvas.vpRect();
    return canvas.toWorld(r.left + r.width / 2, r.top + r.height / 2);
  }

  async function insert(item, at = null) {
    try {
      const file = await download(item);
      const ok = await commands.addImageFiles([file], at || center());
      if (!ok) throw new Error('Não foi possível inserir a foto.');
      const credit = { provider: item.provider, author: item.author, authorUrl: item.authorUrl, sourceUrl: item.sourceUrl, license: item.license, licenseUrl: item.licenseUrl, attribution: item.attribution, attributionRequired: !!item.attributionRequired };
      store.update(() => store.selected().forEach((n) => { n.photoCredit = credit; }), { commit: true });
      toast?.('Foto inserida com crédito.');
    } catch (err) { toast?.(err.message || 'Não consegui inserir a foto.'); }
  }

  async function useAsFill(item) {
    const targets = store.selected().filter((n) => n.type !== 'group' && n.type !== 'path' && n.type !== 'text');
    if (!targets.length) return toast?.('Selecione uma camada com preenchimento para usar a foto.');
    try {
      const file = await download(item);
      const { assetId, w, h: height } = await commands.importAsset(file);
      const credit = { provider: item.provider, author: item.author, authorUrl: item.authorUrl, sourceUrl: item.sourceUrl, license: item.license, licenseUrl: item.licenseUrl, attribution: item.attribution, attributionRequired: !!item.attributionRequired };
      store.update(() => targets.forEach((n) => { n.fill = { type: 'image', assetId, fit: 'cover', natW: w, natH: height }; n.photoCredit = credit; }), { commit: true });
      toast?.('Foto aplicada como preenchimento.');
    } catch (err) { toast?.(err.message || 'Não consegui aplicar a foto.'); }
  }

  function renderResults() {
    grid.replaceChildren(...results.map((item) => {
      const card = h('article.photo-card', { title: `${item.author} · ${item.license}` },
        h('button.photo-image', { type: 'button', draggable: true, 'aria-label': `Inserir foto de ${item.author}`, onclick: () => insert(item),
          ondragstart: (e) => { e.dataTransfer.setData('application/x-stylo-photo', item.id); e.dataTransfer.effectAllowed = 'copy'; card.dataset.dragging = '1'; },
          ondragend: (e) => { delete card.dataset.dragging; const r = canvas.vpRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) insert(item, canvas.toWorld(e.clientX, e.clientY)); },
        }, h('img', { src: item.thumb, alt: `Foto de ${item.author}`, loading: 'lazy' })),
        h('div.photo-meta', h('span.photo-provider', item.provider), h('span.photo-license', item.license),
          h('span.photo-author', item.author),
          safeExternalUrl(item.sourceUrl || item.authorUrl || item.licenseUrl) ? h('a.photo-source', { href: safeExternalUrl(item.sourceUrl || item.authorUrl || item.licenseUrl), target: '_blank', rel: 'noopener noreferrer', onclick: (e) => e.stopPropagation() }, 'Crédito e licença') : null),
        h('button.btn.small.photo-fill', { type: 'button', title: 'Usar a foto como preenchimento da camada selecionada', onclick: () => useAsFill(item) }, 'Usar como preenchimento'));
      return card;
    }));
    more.hidden = !hasMore;
  }

  async function search(append) {
    if (busy) return;
    const q = input.value.trim();
    if (!q) { status.textContent = 'Digite um tema ou escolha uma sugestão.'; return; }
    busy = true;
    page = append ? page + 1 : 1;
    status.textContent = 'Buscando fotos…';
    more.disabled = true;
    try {
      const params = new URLSearchParams({ q, page: String(page), orientation });
      const response = await fetch(`/api/photos/search?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não consegui buscar fotos.');
      results = append ? [...results, ...data.results] : data.results;
      hasMore = data.hasMore;
      status.textContent = results.length ? `${results.length} fotos encontradas${data.hasPexels ? ' · Openverse e Pexels' : ' · Openverse'}.` : 'Nenhuma foto encontrada.';
      renderResults();
    } catch (err) { if (!append) { results = []; hasMore = false; renderResults(); } status.textContent = err.message || 'Falha na busca de fotos.'; }
    finally { busy = false; more.disabled = false; }
  }

  return { el: root, search };
}
