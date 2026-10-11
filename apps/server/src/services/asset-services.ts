/**
 * services/asset-services.ts — O QUE O PLUGIN DE ASSETS USA DO SERVIDOR
 *
 * Junta a biblioteca da conta, as chaves dos provedores (conta → configuração do servidor → variável de ambiente), as fontes
 * de assets cadastradas pela pessoa (tabela AssetSource) e o download protegido contra SSRF.
 */

import type { Db } from '@stylo/db/client.ts';
import { BUILTIN_PROVIDERS } from '@stylo/plugins/assets/registry.ts';
import { checkCustomSource } from '@stylo/plugins/assets/custom.ts';
import type { AssetServices, CustomSource } from '@stylo/plugins/assets/types.ts';
import { httpError } from '../http-error.js';
import type { ConfigStore } from '../config.js';
import type { Library } from './library.js';
import type { Secrets } from './secrets.js';
import { fetchRemoteFile } from './remote-image.js';

const MAX_SOURCES = 20;

export function createAssetSources(db: Db) {
  const view = (row: any): CustomSource => ({ ...(row.config as CustomSource), id: row.id, name: row.name });
  return {
    async list(userId: string): Promise<CustomSource[]> { return (await db.assetSource.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })).map(view); },
    async add(userId: string, source: CustomSource): Promise<CustomSource> {
      const problem = checkCustomSource(source);
      if (problem) throw httpError(400, problem);
      const url = new URL(source.searchUrl.replace('{consulta}', 'x').replace('{pagina}', '1'));
      if (!/^[a-z0-9.-]+$/i.test(url.hostname) || /^(localhost|.*\.(local|internal))$/i.test(url.hostname)) throw httpError(400, 'Endereço de busca inválido.');
      if ((await db.assetSource.count({ where: { userId } })) >= MAX_SOURCES) throw httpError(400, `Limite de ${MAX_SOURCES} fontes por conta.`);
      const { id: _id, ...config } = source;
      const row = await db.assetSource.upsert({ where: { userId_name: { userId, name: source.name } }, create: { userId, name: source.name, config: config as any }, update: { config: config as any } });
      return view(row);
    },
    async remove(userId: string, name: string) { await db.assetSource.deleteMany({ where: { userId, name } }); },
  };
}
export type AssetSources = ReturnType<typeof createAssetSources>;

/** Os serviços do plugin de assets. */
export function createAssetServices({ library, secrets, sources, config }: { library: Library; secrets: Secrets; sources: AssetSources; config: ConfigStore }): AssetServices & { sources: AssetSources } {
  const envVarOf = new Map(BUILTIN_PROVIDERS.filter((p) => p.needsKey).map((p) => [p.id, p.needsKey!.envVar]));
  return {
    library: library as any,
    sources,
    async keyFor(userId, providerId) {
      const own = await secrets.get(userId, providerId);
      if (own) return own;
      const cfg = config.get() as any;
      const fromConfig = cfg.providers?.[providerId]?.apiKey || (providerId === 'pexels' ? cfg.pexels?.apiKey : '');
      if (fromConfig) return String(fromConfig);
      const env = envVarOf.get(providerId);
      return (env && process.env[env]) || null;
    },
    fetchRemoteFile: (url, opts) => fetchRemoteFile(url, opts),
    customSources: (userId) => sources.list(userId),
  };
}
