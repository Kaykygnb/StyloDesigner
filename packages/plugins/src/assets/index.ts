/**
 * Plugin "assets" — ASSETS GRATUITOS, BIBLIOTECA DA CONTA E FONTES
 *
 * O agente (ou a pessoa) BUSCA em vários provedores (fotos, vídeos, áudio, 3D, ícones, fontes), SALVA na biblioteca da conta
 * (com licença e crédito autênticos) e USA num projeto (copiando o arquivo para dentro dele). Também cadastra fontes de
 * assets novas, sem programar. Só uso comercial livre; os créditos vão no arquivo CREDITS.txt do site exportado.
 */

import { z } from 'zod';
import { definePlugin } from '@stylo/core/plugin.ts';
import { defineTool } from '@stylo/core/tools/schema.ts';
import { createNode } from '@stylo/core/model.ts';
import { MAX_BYTES, extensionFor, kindFromTool, kindToTool, sniffAsset, type AssetKindName } from '@stylo/core/asset-kinds.ts';
import { fromBase64, toDataUrl } from '@stylo/core/image-size.ts';
import { checkCustomSource } from './custom.ts';
import { fontFiles } from './providers/fontsource.ts';
import { providerStatuses, recallRef, searchAssets } from './registry.ts';
import type { AssetServices, CustomSource } from './types.ts';

const KINDS = ['image', 'video', 'audio', 'model3d', 'lottie', 'font', 'icon'] as const;
const svc = (ctx: { services: Record<string, any> }) => {
  if (!ctx.services?.assets) throw new Error('O serviço de assets não está ligado neste ambiente (ele existe no servidor Stylo: npm start).');
  return ctx.services.assets as AssetServices & { sources?: any };
};

/** Resumo curto de um asset da biblioteca para devolver ao agente. */
const brief = (a: any) => ({
  id: a.id, kind: kindToTool(a.kind), name: a.name, mime: a.mime, kb: Math.max(1, Math.round(a.size / 1024)),
  ...(a.width ? { width: a.width, height: a.height } : {}), ...(a.duration ? { duration: a.duration } : {}),
  tags: a.tags, source: a.source, license: a.license?.name ?? null, credit: a.credit ?? null,
});

const dedupeCredit = (store: any, entry: { text: string; license?: string }) => {
  store.update(() => {
    const doc = store.state.doc;
    doc.credits ||= [];
    if (entry.text && !doc.credits.some((c: any) => c.text === entry.text)) doc.credits.push(entry);
  });
};

/** Coloca os bytes de uma imagem em doc.assets (reaproveitando a que já existe) e devolve o id. */
function putImage(store: any, bytes: Uint8Array, mime: string) {
  const dataUrl = toDataUrl(bytes, mime);
  const assets = store.state.doc.assets || {};
  const existing = Object.keys(assets).find((k) => assets[k] === dataUrl);
  if (existing) return { assetId: existing, reused: true };
  const assetId = Math.random().toString(36).slice(2, 10);
  store.addAsset(assetId, dataUrl);
  return { assetId, reused: false };
}

/** Mídia dentro do PROJETO fica em memória como data URL a cada abertura: por isso o limite é bem menor que o da biblioteca. */
export const PROJECT_MEDIA_MAX_BYTES = 25 * 1024 * 1024;

export function assertFitsProject(kind: string, size: number, name = 'O arquivo') {
  if (kind !== 'IMAGE' && size > PROJECT_MEDIA_MAX_BYTES) {
    throw new Error(`${name} tem ${(size / 1048576).toFixed(1)} MB; dentro de um projeto o limite de mídia é ${PROJECT_MEDIA_MAX_BYTES / 1048576} MB (a biblioteca aceita mais). Use uma versão menor/comprimida.`);
  }
}

function putProjectAsset(store: any, bytes: Uint8Array, mime: string) {
  const dataUrl = toDataUrl(bytes, mime);
  const assets = store.state.doc.assets || {};
  const existing = Object.keys(assets).find((k) => assets[k] === dataUrl);
  if (existing) return { assetId: existing, reused: true };
  const assetId = Math.random().toString(36).slice(2, 10);
  store.addAsset(assetId, dataUrl);
  return { assetId, reused: false };
}

export const assets = definePlugin({
  id: 'assets',
  name: 'Assets gratuitos e biblioteca',
  description: 'Busca em provedores gratuitos, biblioteca da conta, fontes e fontes de assets cadastradas por você.',
  tools: [
    {
      def: defineTool({
        name: 'asset_providers',
        write: false, needs: 'read',
        description: 'Lista os provedores de assets (fotos, vídeos, áudio, 3D, ícones, fontes), o que cada um entrega, a licença e se está pronto para uso nesta conta. Provedores que pedem chave de API aparecem sem chave até a pessoa cadastrar a dela (a chave nunca é mostrada nem passa por aqui). Inclui as fontes cadastradas pela conta.',
        input: z.object({}),
      }),
      run: async (_args, ctx) => {
        const list = await providerStatuses(ctx.actor.userId, svc(ctx));
        return { providers: list, hint: 'Busque com search_assets. Provedores sem chave são pulados; a pessoa cadastra a chave nas configurações (ou na variável de ambiente indicada em needsKey.envVar).' };
      },
    },
    {
      def: defineTool({
        name: 'search_assets',
        write: false, needs: 'read',
        description: 'BUSCA assets gratuitos de uso comercial: image (fotos, ilustrações), video, audio, model3d (modelos .glb), font (catálogo do Google Fonts), icon (Material Symbols). Pergunta a todos os provedores prontos do tipo (ou a um só, com provider) e devolve resultados normalizados com licença, autor e crédito. Cada resultado tem uma `ref`: use library_save para guardar na biblioteca (fontes: add_font; ícones: insert_icon). Provedores sem chave ou que falharam vêm em `skipped`.',
        input: z.object({
          kind: z.enum(KINDS),
          query: z.string().describe('o que procurar (em inglês costuma achar mais; ícones aceitam português)'),
          provider: z.string().describe('buscar só neste provedor (veja asset_providers)').optional(),
          page: z.number().int().describe('página, a partir de 1').optional(),
          orientation: z.enum(['landscape', 'portrait', 'square']).describe('só imagens e vídeos').optional(),
          category: z.enum(['sans-serif', 'serif', 'display', 'handwriting', 'monospace']).describe('só fontes').optional(),
        }),
      }),
      run: async ({ kind, query, provider, page, orientation, category }, ctx) => {
        const report = await searchAssets(ctx.actor.userId, { kind, query: String(query), page: Math.max(1, page ?? 1), orientation, category, provider }, svc(ctx));
        return { count: report.results.length, results: report.results, hasMore: report.hasMore, searched: report.searched, skipped: report.skipped };
      },
    },
    {
      def: defineTool({
        name: 'library_save',
        write: true, noLock: true, needs: 'write',
        description: 'Guarda na BIBLIOTECA DA CONTA um resultado de search_assets (pela `ref`). O servidor baixa o arquivo e registra a licença e o crédito que o PROVEDOR informou. O asset fica disponível a todos os agentes desta conta e pode ser usado em qualquer projeto com library_use. Vale 1 hora depois da busca: se a ref expirou, busque de novo. Fontes usam add_font.',
        input: z.object({
          ref: z.string().describe('a ref do resultado (ex.: "pexels:photo:123")'),
          name: z.string().describe('nome na biblioteca (padrão: o título)').optional(),
          tags: z.array(z.string()).describe('etiquetas para achar depois').optional(),
        }),
      }),
      run: async ({ ref, name, tags }, ctx) => {
        const result = recallRef(ctx.actor.userId, String(ref));
        if (!result) throw new Error('Esta ref não está mais disponível (vale 1 hora após a busca). Rode search_assets de novo.');
        if (!result.download?.url) throw new Error(result.kind === 'font' ? 'Fontes não vão para a biblioteca por aqui: use add_font num projeto.' : 'Este resultado não tem arquivo para baixar.');
        if (!result.license.commercial) throw new Error('Este asset não tem licença de uso comercial; não será guardado.');
        const kindName: AssetKindName = result.kind === 'icon' ? 'IMAGE' : (kindFromTool(result.kind) ?? 'OTHER');
        const file = await svc(ctx).fetchRemoteFile(result.download.url, { maxBytes: MAX_BYTES[kindName] });
        const out = await svc(ctx).library.add(ctx.actor.userId, {
          bytes: file.bytes, name: name || result.title, mimeHint: file.contentType, kind: kindName, tags: [...(tags ?? []), result.provider],
          source: result.provider, sourceUrl: result.page_url ?? result.download.url, license: result.license, credit: result.credit,
          duration: result.duration, width: result.width, height: result.height,
        });
        return { saved: brief(out.asset), alreadyInLibrary: out.existed, hint: 'Use library_use com este id para colocá-lo num projeto.' };
      },
    },
    {
      def: defineTool({
        name: 'library_add',
        write: true, noLock: true, needs: 'write',
        description: 'Guarda na biblioteca da conta um arquivo SEU (não de um provedor): data_base64 ou source_url (https público, baixado pelo servidor com proteção contra redes internas). O tipo é descoberto pelo conteúdo (imagem, vídeo, áudio, .glb, Lottie, fonte). Informe a licença se souber; sem ela fica "enviado pela conta".',
        input: z.object({
          name: z.string().describe('nome do asset'),
          data_base64: z.string().describe('conteúdo em base64').optional(),
          source_url: z.string().describe('endereço https do arquivo').optional(),
          tags: z.array(z.string()).optional(),
          license: z.string().describe('licença/origem, texto livre (ex.: "comprado na Envato", "CC0")').optional(),
          credit: z.string().describe('crédito para o arquivo CREDITS.txt do site exportado').optional(),
        }),
      }),
      run: async ({ name, data_base64, source_url, tags, license, credit }, ctx) => {
        if ([data_base64, source_url].filter(Boolean).length !== 1) throw new Error('Mande exatamente UM entre data_base64 e source_url.');
        let bytes: Uint8Array, hint = '';
        if (source_url) {
          const file = await svc(ctx).fetchRemoteFile(String(source_url), { maxBytes: MAX_BYTES.VIDEO });
          bytes = file.bytes; hint = file.contentType;
        } else {
          const clean = String(data_base64).replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error('data_base64 inválido: precisa ser base64 puro.');
          bytes = fromBase64(clean);
        }
        const out = await svc(ctx).library.add(ctx.actor.userId, {
          bytes, name, mimeHint: hint, tags, source: 'upload', sourceUrl: source_url, credit,
          license: { name: license || 'Enviado pela conta', commercial: true, attribution: credit ? 'required' : 'none' },
        });
        return { saved: brief(out.asset), alreadyInLibrary: out.existed };
      },
    },
    {
      def: defineTool({
        name: 'library_list',
        write: false, needs: 'read',
        description: 'Lista os assets da BIBLIOTECA DA CONTA (todos os agentes e projetos desta pessoa enxergam os mesmos): filtre por tipo, por nome/etiqueta. Devolve também o espaço usado.',
        input: z.object({
          kind: z.enum(KINDS).optional(),
          query: z.string().describe('parte do nome ou uma etiqueta').optional(),
          tag: z.string().optional(),
          limit: z.number().int().describe('padrão 100, máximo 500').optional(),
        }),
      }),
      run: async ({ kind, query, tag, limit }, ctx) => {
        const k: AssetKindName | null | undefined = kind ? (kind === 'icon' ? 'IMAGE' : kindFromTool(kind)) : undefined;
        const list = await svc(ctx).library.list(ctx.actor.userId, { kind: k ?? undefined, query, tag, limit });
        const usage = await svc(ctx).library.usage(ctx.actor.userId);
        return { count: list.length, assets: list.map(brief), usage: { assets: usage.count, mb: Math.round(usage.bytes / 1048576), quotaMb: Math.round(usage.quotaBytes / 1048576) } };
      },
    },
    {
      def: defineTool({
        name: 'library_remove',
        write: true, noLock: true, needs: 'write',
        description: 'Remove um asset da biblioteca da conta. Projetos que já o usaram continuam com a cópia deles.',
        input: z.object({ id: z.string().describe('id devolvido por library_list') }),
      }),
      run: async ({ id }, ctx) => ({ removed: brief((await svc(ctx).library.remove(ctx.actor.userId, String(id))).removed) }),
    },
    {
      def: defineTool({
        name: 'library_use',
        write: true, needs: 'write',
        description: 'COPIA um asset da biblioteca para o PROJETO ABERTO (a partir daí ele faz parte do projeto, com o crédito registrado para o CREDITS.txt do site exportado). Imagens e ícones SVG viram um asset do projeto; vídeo, áudio, 3D e Lottie viram assets e, com insert:true, uma camada de mídia. Fontes: use add_font.',
        input: z.object({
          id: z.string().describe('id devolvido por library_list'),
          insert: z.boolean().describe('se true, já cria a camada correspondente no projeto').optional(),
          name: z.string().describe('nome da camada criada').optional(),
          parent_id: z.string().optional(),
          at: z.object({ x: z.number(), y: z.number() }).optional(),
        }),
      }),
      needsProject: true,
      run: async ({ id, insert, name, parent_id, at }, ctx) => {
        const { asset, data } = await svc(ctx).library.bytes(ctx.actor.userId, String(id));
        const sniff = sniffAsset(data, asset.mime);
        const store = ctx.project!.store;
        if (sniff.kind === 'FONT') throw new Error('Fontes entram no projeto com add_font.');
        if (!['IMAGE', 'VIDEO', 'AUDIO', 'MODEL3D', 'LOTTIE'].includes(sniff.kind)) throw new Error(`O tipo ${kindToTool(sniff.kind)} não pode ser usado no projeto.`);
        assertFitsProject(sniff.kind, data.length, `“${asset.name}”`);
        const { assetId, reused } = putProjectAsset(store, data, sniff.mime);
        if (asset.credit) dedupeCredit(store, { text: asset.credit, license: asset.license?.name });
        const out: Record<string, unknown> = { asset_id: assetId, reused, name: asset.name, kind: kindToTool(sniff.kind), width: sniff.width, height: sniff.height, _summary: `Usou “${asset.name}” da biblioteca` };
        if (insert) {
          if (sniff.kind === 'IMAGE') {
            const node = await ctx.project!.commands.insertImageAsset(assetId, at, { parentId: parent_id || null, name: name || asset.name });
            out.created = { id: node.id, name: node.name, w: node.w, h: node.h };
          } else {
            const node = createNode('media', { name: name || asset.name, mediaKind: kindToTool(sniff.kind) as 'video' | 'audio' | 'model3d' | 'lottie', mediaAssetId: assetId, w: sniff.width || 320, h: sniff.height || 180 });
            const parent = parent_id ? store.get(parent_id) : null;
            if (parent_id && !parent) throw new Error(`Frame "${parent_id}" não existe.`);
            store.update((page) => {
              if (parent) parent.children.push(node); else page.children.push(node);
            });
            store.setSelection([node.id]);
            store.commit();
            out.created = { id: node.id, name: node.name, w: node.w, h: node.h };
          }
        }
        return out;
      },
    },
    {
      def: defineTool({
        name: 'add_font',
        write: true, needs: 'write',
        description: 'ADICIONA UMA FONTE DO GOOGLE FONTS ao projeto aberto, HOSPEDADA no próprio projeto (os arquivos .woff2 vão para dentro dele e para o zip exportado, com @font-face pronto; nada de CDN do Google). Use o `id` de search_assets(kind:"font"). Depois, use o nome da família em fontFamily das camadas de texto. Escolha só os pesos que vai usar (cada peso é um arquivo): padrão 400 e 700.',
        input: z.object({
          id: z.string().describe('id da fonte (ex.: "inter", "playfair-display")'),
          weights: z.array(z.number().int()).describe('pesos, ex.: [400, 700]').optional(),
          styles: z.array(z.enum(['normal', 'italic'])).describe('padrão: ["normal"]').optional(),
          subsets: z.array(z.string()).describe('alfabetos, ex.: ["latin", "latin-ext"] (padrão: o principal da fonte)').optional(),
        }),
      }),
      needsProject: true,
      run: async ({ id, weights, styles, subsets }, ctx) => {
        const services = svc(ctx);
        const getJson = async (url: string) => {
          const { bytes } = await services.fetchRemoteFile(url, { maxBytes: 4 * 1024 * 1024, accept: 'application/json' });
          return JSON.parse(new TextDecoder().decode(bytes));
        };
        const detail = await fontFiles(String(id), { weights, styles, subsets }, getJson as any);
        if (!detail.files.length) throw new Error(`A fonte "${id}" não tem arquivos para os pesos/estilos/alfabetos pedidos. Veja os disponíveis com search_assets(kind:"font").`);
        const store = ctx.project!.store;
        const stored: any[] = [];
        for (const f of detail.files) {
          const file = await services.fetchRemoteFile(f.url, { maxBytes: MAX_BYTES.FONT, accept: 'font/woff2,*/*' });
          const sniff = sniffAsset(file.bytes);
          if (sniff.kind !== 'FONT') throw new Error(`O arquivo baixado de ${f.url} não é uma fonte.`);
          const dataUrl = toDataUrl(file.bytes, sniff.mime);
          const assets = store.state.doc.assets || {};
          const assetId = Object.keys(assets).find((k) => assets[k] === dataUrl) ?? Math.random().toString(36).slice(2, 10);
          if (!assets[assetId]) store.addAsset(assetId, dataUrl);
          stored.push({ weight: f.weight, style: f.style, subset: f.subset, assetId, unicodeRange: detail.entry.unicodeRange?.[f.subset] ?? null, bytes: file.bytes.length, ext: extensionFor(sniff.mime) });
        }
        store.update(() => {
          const doc = store.state.doc;
          doc.fonts ||= [];
          const credit = `${detail.family} — ${detail.license.name} (Google Fonts)`;
          const entry = doc.fonts.find((x: any) => x.family === detail.family);
          const files = stored.map(({ weight, style, subset, assetId, unicodeRange, ext }) => ({ weight, style, subset, assetId, unicodeRange, ext }));
          if (entry) {
            for (const nf of files) if (!entry.files.some((f: any) => f.weight === nf.weight && f.style === nf.style && f.subset === nf.subset)) entry.files.push(nf);
          } else doc.fonts.push({ family: detail.family, source: 'fontsource', fontId: String(id), license: detail.license.name, credit, files });
        });
        const usedCredit = `${detail.family} — ${detail.license.name} (Google Fonts)`;
        dedupeCredit(store, { text: usedCredit, license: detail.license.name });
        return {
          family: detail.family, license: detail.license.name,
          files: stored.map(({ weight, style, subset, bytes }) => ({ weight, style, subset, kb: Math.max(1, Math.round(bytes / 1024)) })),
          hint: `Use fontFamily: "${detail.family}" nas camadas de texto. A fonte está hospedada no projeto e sai em fonts/ no zip exportado.`,
          _summary: `Adicionou a fonte ${detail.family} (${stored.length} arquivo${stored.length > 1 ? 's' : ''})`,
        };
      },
    },
    {
      def: defineTool({
        name: 'asset_source_add',
        write: true, noLock: true, needs: 'write',
        description: 'Cadastra, SEM código, uma fonte de assets da conta: o endereço de busca (https) com {consulta} (e {pagina}), cabeçalhos (ex.: Authorization), onde está a lista na resposta JSON (resultsPath, como "data.items") e onde está cada campo dentro de um item. A busca passa pelo mesmo download protegido contra redes internas. Depois ela aparece em asset_providers e entra no search_assets.',
        input: z.object({
          name: z.string().describe('nome da fonte (2 a 40 caracteres)'),
          searchUrl: z.string().describe('https://api.exemplo.com/search?q={consulta}&page={pagina}'),
          kinds: z.array(z.enum(KINDS)),
          headers: z.record(z.string(), z.string()).describe('cabeçalhos extras, ex.: {"Authorization": "..."}').optional(),
          resultsPath: z.string().describe('caminho até a lista de resultados, ex.: "results" ou "data.items"'),
          fields: z.object({
            id: z.string(), title: z.string(), download: z.string().describe('caminho até o endereço do arquivo'),
            preview: z.string().optional(), author: z.string().optional(), page: z.string().optional(), license: z.string().optional(),
          }),
          license: z.object({
            name: z.string().describe('licença dos resultados (ex.: "CC0")'), url: z.string().optional(),
            attribution: z.enum(['required', 'optional', 'none']).optional(),
          }),
        }),
      }),
      run: async (args, ctx) => {
        const source: CustomSource = { id: '', name: args.name.trim(), searchUrl: args.searchUrl, kinds: args.kinds, headers: args.headers, resultsPath: args.resultsPath, fields: args.fields, license: { name: args.license.name, url: args.license.url, commercial: true, attribution: args.license.attribution ?? 'optional' } };
        const problem = checkCustomSource(source);
        if (problem) throw new Error(problem);
        const saved = await svc(ctx).sources.add(ctx.actor.userId, source);
        return { added: { name: saved.name, kinds: saved.kinds }, hint: 'Teste com search_assets (provider: "custom:' + saved.name + '").' };
      },
    },
    {
      def: defineTool({
        name: 'asset_source_remove',
        write: true, noLock: true, needs: 'write',
        description: 'Remove uma fonte de assets cadastrada pela conta (pelo nome).',
        input: z.object({ name: z.string() }),
      }),
      run: async ({ name }, ctx) => { await svc(ctx).sources.remove(ctx.actor.userId, String(name)); return { removed: name }; },
    },
  ],
});
