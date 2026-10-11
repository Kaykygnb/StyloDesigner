/**
 * assets/custom.ts — FONTES DE ASSETS CADASTRADAS PELA PESSOA, SEM PROGRAMAR
 *
 * A pessoa informa: o endereço de busca (https, com {consulta} e, se quiser, {pagina}), os cabeçalhos (ex.: chave), onde
 * está a lista na resposta JSON e onde está cada campo (id, título, miniatura, arquivo para baixar, autor...). Não
 * há código nenhum: é só um mapa. A busca sai pelo mesmo download protegido contra SSRF do servidor (redes internas
 * bloqueadas, limite de tamanho), então uma fonte mal configurada não abre nada.
 */

import type { AssetResult, AssetServices, CustomSource, SearchOutcome, SearchParams } from './types.ts';

/** Lê um caminho como "data.items[0].url" dentro de um objeto. */
export function readPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  let cur: any = obj;
  for (const part of path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

/** Confere uma fonte antes de guardar. Devolve a mensagem do problema ou null. */
export function checkCustomSource(s: Partial<CustomSource>): string | null {
  if (!s.name || !/^[\p{L}\p{N} ._-]{2,40}$/u.test(s.name)) return 'Nome inválido (2 a 40 letras, números, espaço, ponto, hífen).';
  if (!s.searchUrl || !/^https:\/\//i.test(s.searchUrl)) return 'O endereço de busca precisa começar com https://.';
  if (!s.searchUrl.includes('{consulta}')) return 'O endereço de busca precisa ter {consulta} no lugar do termo.';
  if (!s.kinds?.length) return 'Diga o que a fonte entrega (kinds: image, video, audio, model3d, lottie, font, icon).';
  if (!s.resultsPath) return 'Faltou resultsPath: o caminho até a lista de resultados na resposta.';
  if (!s.fields?.id || !s.fields?.title || !s.fields?.download) return 'fields precisa de id, title e download.';
  if (!s.license?.name) return 'Informe a licença dos resultados (license.name).';
  return null;
}

export async function searchCustom(source: CustomSource, params: SearchParams, services: AssetServices): Promise<SearchOutcome> {
  const url = source.searchUrl.replace('{consulta}', encodeURIComponent(params.query)).replace('{pagina}', String(params.page));
  const { bytes } = await services.fetchRemoteFile(url, { maxBytes: 2 * 1024 * 1024, accept: 'application/json', headers: source.headers });
  let data: unknown;
  try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('a fonte não respondeu JSON'); }
  const list = readPath(data, source.resultsPath);
  if (!Array.isArray(list)) throw new Error(`não achei a lista de resultados em "${source.resultsPath}"`);
  const text = (item: unknown, path?: string) => { const v = path ? readPath(item, path) : undefined; return v == null ? undefined : String(v); };
  const results: AssetResult[] = [];
  for (const item of list.slice(0, 40)) {
    const id = text(item, source.fields.id), download = text(item, source.fields.download), title = text(item, source.fields.title);
    if (!id || !download || !/^https:\/\//i.test(download)) continue;
    const author = text(item, source.fields.author);
    results.push({
      ref: `custom:${source.name}:${id}`, provider: `custom:${source.name}`, kind: params.kind, title: (title ?? id).slice(0, 160),
      preview_url: text(item, source.fields.preview), page_url: text(item, source.fields.page), author,
      license: source.license, credit: `“${title ?? id}”${author ? ` de ${author}` : ''} — ${text(item, source.fields.license) ?? source.license.name} (via ${source.name})`,
      download: { url: download },
    });
  }
  return { results, hasMore: list.length >= 20 };
}
