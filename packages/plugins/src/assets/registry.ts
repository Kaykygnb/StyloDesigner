/**
 * assets/registry.ts — OS PROVEDORES E A BUSCA ENTRE ELES
 *
 * `searchAssets` pergunta a todos os provedores que sabem o tipo pedido (ou a um só), em paralelo; o que falhou ou não tem
 * chave vira um aviso em `skipped`, sem derrubar a busca dos outros. Resultados ficam em cache pelo tempo que cada
 * provedor permite/exige (Pixabay: 24 h) e as REFERÊNCIAS ficam guardadas por 1 h, para `library_save` salvar exatamente o
 * que o provedor devolveu (licença e crédito autênticos), e não o que um agente escreveu.
 */

import { fontsource } from './providers/fontsource.ts';
import { material } from './providers/material.ts';
import { lucide } from './providers/lucide.ts';
import { openverse } from './providers/openverse.ts';
import { pexels } from './providers/pexels.ts';
import { pixabay } from './providers/pixabay.ts';
import { polypizza } from './providers/polypizza.ts';
import { searchCustom } from './custom.ts';
import type { AssetKindTool, AssetProvider, AssetResult, AssetServices, SearchParams } from './types.ts';

export const BUILTIN_PROVIDERS: AssetProvider[] = [openverse, pexels, pixabay, polypizza, fontsource, material, lucide];

const REF_TTL = 60 * 60_000;
const refs = new Map<string, { at: number; result: AssetResult }>();
const searches = new Map<string, { at: number; value: { results: AssetResult[]; hasMore: boolean } }>();

const rememberRefs = (userId: string, results: AssetResult[]) => {
  const now = Date.now();
  for (const [k, v] of refs) if (now - v.at > REF_TTL) refs.delete(k);
  for (const r of results) refs.set(`${userId}:${r.ref}`, { at: now, result: r });
};

/** O resultado de uma busca recente, pela referência. */
export const recallRef = (userId: string, ref: string): AssetResult | null => {
  const hit = refs.get(`${userId}:${ref}`);
  return hit && Date.now() - hit.at <= REF_TTL ? hit.result : null;
};

export const resetAssetCaches = () => { refs.clear(); searches.clear(); };

const jsonFetcher = (services: AssetServices) => async (url: string, init: { headers?: Record<string, string> } = {}) => {
  const doFetch = services.fetch ?? fetch;
  let res: Response;
  try { res = await doFetch(url, { headers: { Accept: 'application/json', ...init.headers }, signal: AbortSignal.timeout(15_000) }); } catch (err: any) {
    throw new Error(err?.name === 'TimeoutError' ? 'o provedor demorou demais' : `não consegui falar com o provedor (${err?.cause?.code || err?.message})`);
  }
  if (res.status === 401 || res.status === 403) throw new Error('o provedor recusou a chave (confira se ela está certa)');
  if (res.status === 429) throw new Error('limite de pedidos do provedor atingido; tente de novo mais tarde');
  if (!res.ok) throw new Error(`o provedor respondeu ${res.status}`);
  return res.json();
};

export interface ProviderStatus { id: string; name: string; kinds: AssetKindTool[]; custom: boolean; ready: boolean; needsKey: AssetProvider['needsKey'] | null; hasKey: boolean; unverified: boolean; licenseSummary: string; sourceUrl?: string; licenseUrl?: string }

/** Todos os provedores desta conta (embutidos + cadastrados) e se estão prontos para uso. */
export async function providerStatuses(userId: string, services: AssetServices): Promise<ProviderStatus[]> {
  const out: ProviderStatus[] = [];
  for (const p of BUILTIN_PROVIDERS) {
    const hasKey = p.needsKey ? !!(await services.keyFor(userId, p.id)) : true;
    out.push({ id: p.id, name: p.name, kinds: p.kinds, custom: false, ready: hasKey, needsKey: p.needsKey ?? null, hasKey, unverified: !!p.unverified, licenseSummary: p.licenseSummary, sourceUrl: p.sourceUrl, licenseUrl: p.licenseUrl });
  }
  for (const s of (await services.customSources?.(userId)) ?? []) {
    out.push({ id: `custom:${s.name}`, name: s.name, kinds: s.kinds, custom: true, ready: true, needsKey: null, hasKey: true, unverified: false, licenseSummary: `${s.license.name} (informada por você)`, sourceUrl: s.searchUrl, licenseUrl: s.license.url });
  }
  return out;
}

export interface SearchReport { results: AssetResult[]; hasMore: boolean; searched: string[]; skipped: { provider: string; reason: string }[] }

export async function searchAssets(userId: string, params: SearchParams & { provider?: string }, services: AssetServices): Promise<SearchReport> {
  const getJson = jsonFetcher(services);
  const custom = (await services.customSources?.(userId)) ?? [];
  const builtin = BUILTIN_PROVIDERS.filter((p) => p.kinds.includes(params.kind) && (!params.provider || params.provider === p.id));
  const customs = custom.filter((s) => s.kinds.includes(params.kind) && (!params.provider || params.provider === `custom:${s.name}` || params.provider === s.name));
  if (params.provider && !builtin.length && !customs.length) {
    throw new Error(`O provedor "${params.provider}" não existe ou não busca ${params.kind}. Veja asset_providers.`);
  }
  const searched: string[] = [], skipped: SearchReport['skipped'] = [];
  const tasks: Promise<AssetResult[] | null>[] = [];
  let more = false;

  for (const p of builtin) {
    tasks.push((async () => {
      const key = p.needsKey ? await services.keyFor(userId, p.id) : null;
      if (p.needsKey && !key) { skipped.push({ provider: p.id, reason: `sem chave (${p.needsKey.label}: ${p.needsKey.signupUrl})` }); return null; }
      const cacheKey = JSON.stringify([userId, p.id, params.kind, params.query.toLowerCase(), params.page, params.orientation ?? '', params.category ?? '']);
      const cached = searches.get(cacheKey);
      try {
        const value = cached && Date.now() - cached.at < (p.cacheMs ?? 0) ? cached.value : await p.search(params, { key, getJson });
        if (!cached || cached.value !== value) searches.set(cacheKey, { at: Date.now(), value });
        searched.push(p.id);
        more ||= value.hasMore;
        return value.results;
      } catch (err: any) { skipped.push({ provider: p.id, reason: err?.message || String(err) }); return null; }
    })());
  }
  for (const s of customs) {
    tasks.push((async () => {
      try { const value = await searchCustom(s, params, services); searched.push(`custom:${s.name}`); more ||= value.hasMore; return value.results; } catch (err: any) { skipped.push({ provider: `custom:${s.name}`, reason: err?.message || String(err) }); return null; }
    })());
  }
  const lists = (await Promise.all(tasks)).filter((l): l is AssetResult[] => !!l);
  // intercala os provedores (um de cada vez) para a primeira tela misturar as fontes
  const results: AssetResult[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) results.push(l[i]);
  rememberRefs(userId, results);
  return { results, hasMore: more, searched, skipped };
}
