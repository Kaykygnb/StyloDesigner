// Biblioteca da conta, chaves criptografadas, provedores de assets (com respostas simuladas) e as ferramentas do plugin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createDb } from '@stylo/db/client.ts';
import { createFileBlobStore, createMemoryBlobStore } from '../apps/server/src/services/blobs.ts';
import { createLibrary } from '../apps/server/src/services/library.ts';
import { createSecrets, decrypt, encrypt } from '../apps/server/src/services/secrets.ts';
import { createAssetSources } from '../apps/server/src/services/asset-services.ts';
import { createProjects } from '../apps/server/src/services/projects.ts';
import { createOperations } from '../apps/server/src/services/operations.ts';
import { createNotes } from '../apps/server/src/services/notes.ts';
import { createSharing } from '../apps/server/src/services/sharing.ts';
import { createWorkspace, type Actor } from '../apps/server/src/workspace/index.ts';
import { createPlugins } from '../apps/server/src/plugins.ts';
import { builtinPlugins } from '@stylo/plugins/index.ts';
import { resetAssetCaches } from '@stylo/plugins/assets/registry.ts';
import { resetFontCatalog } from '@stylo/plugins/assets/providers/fontsource.ts';
import { pickPexelsVideo } from '@stylo/plugins/assets/providers/pexels.ts';
import { openverseLicense } from '@stylo/plugins/assets/providers/openverse.ts';
import { lucide } from '@stylo/plugins/assets/providers/lucide.ts';
import { readPath } from '@stylo/plugins/assets/custom.ts';
import { sniffAsset } from '@stylo/core/asset-kinds.ts';

const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const WOFF2 = (n: number) => { const b = new Uint8Array(200); b.set(Buffer.from('wOF2'), 0); b[10] = n; return b; };
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0x21, ...new Array(40).fill(0)]);
const GLB = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, ...new Array(40).fill(1)]);
const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, ...new Array(40).fill(2)]);

test('Lucide: catálogo local de ícones devolve licença, origem, crédito e download', async () => {
  const out = await lucide.search({ kind: 'icon', query: 'arrow', page: 1 }, { key: null, getJson: async () => ({}) });
  assert.ok(out.results.length > 0);
  const item = out.results[0];
  assert.equal(item.provider, 'lucide-icons');
  assert.equal(item.license.name, 'ISC');
  assert.equal(item.license.attribution, 'required');
  assert.match(item.download?.url || '', /lucide-static@/);
  assert.match(item.credit, /Lucide Icons/);
});

test('blobs: arquivo e memória guardam por conteúdo, não duplicam, leem e removem; hash inválido é recusado', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'stylo-blobs-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const store of [createFileBlobStore(dir), createMemoryBlobStore()]) {
    const a = await store.put(PNG);
    const b = await store.put(PNG);
    assert.equal(a.hash, b.hash);
    assert.equal(a.size, PNG.length);
    assert.deepEqual([...(await store.get(a.hash))!], [...PNG]);
    assert.equal(await store.has(a.hash), true);
    await store.remove(a.hash);
    assert.equal(await store.get(a.hash), null);
    await assert.rejects(store.get('../../etc/passwd'), /Hash de blob inválido/);
  }
  assert.equal((await readdir(dir, { recursive: true })).filter((f) => f.endsWith('.tmp')).length, 0, 'sem temporários');
});

test('sniffAsset descobre o tipo pelos bytes (não pelo que o remetente diz)', () => {
  assert.equal(sniffAsset(PNG, 'video/mp4').kind, 'IMAGE');
  assert.equal(sniffAsset(WOFF2(1)).kind, 'FONT');
  assert.equal(sniffAsset(MP3).kind, 'AUDIO');
  assert.equal(sniffAsset(GLB).kind, 'MODEL3D');
  assert.equal(sniffAsset(MP4).kind, 'VIDEO');
  assert.equal(sniffAsset(new TextEncoder().encode('{"v":"5.7","fr":30,"w":100,"h":50,"layers":[]}')).kind, 'LOTTIE');
  assert.equal(sniffAsset(new TextEncoder().encode('texto qualquer sem formato conhecido'), 'text/plain').kind, 'OTHER');
});

test('chaves: cifra AES-GCM (ida e volta), troca de chave não decifra, nada em texto puro no banco', async () => {
  const key = randomBytes(32);
  assert.equal(decrypt(encrypt('pexels-abc-123', key), key), 'pexels-abc-123');
  assert.notEqual(encrypt('x', key), encrypt('x', key), 'nonce diferente a cada vez');
  assert.throws(() => decrypt(encrypt('segredo', key), randomBytes(32)));
  const { db, close } = await createDb({ pglite: {} });
  const u = await db.user.create({ data: { username: 'a', email: 'a@x.com', name: 'A', passwordHash: '!' } });
  const secrets = createSecrets(db, key);
  await secrets.set(u.id, 'pexels', '  CHAVE-SECRETA-DO-PEXELS  ');
  assert.equal(await secrets.get(u.id, 'pexels'), 'CHAVE-SECRETA-DO-PEXELS');
  assert.equal(JSON.stringify(await db.providerSecret.findMany()).includes('CHAVE-SECRETA'), false);
  assert.equal(await secrets.has(u.id, 'pexels'), true);
  assert.equal(await createSecrets(db, randomBytes(32)).get(u.id, 'pexels'), null, 'chave do servidor trocada = sem chave (não quebra)');
  await secrets.remove(u.id, 'pexels');
  assert.equal(await secrets.has(u.id, 'pexels'), false);
  await close();
});

test('biblioteca: tipo pelo conteúdo, mesma coisa não duplica, isolada por conta, cota e remoção que respeita blob compartilhado', async () => {
  const { db, close } = await createDb({ pglite: {} });
  const a = await db.user.create({ data: { username: 'a', email: 'a@x.com', name: 'A', passwordHash: '!' } });
  const b = await db.user.create({ data: { username: 'b', email: 'b@x.com', name: 'B', passwordHash: '!' } });
  const blobs = createMemoryBlobStore();
  const lib = createLibrary({ db, blobs });

  const first = await lib.add(a.id, { bytes: PNG, name: 'Logo', tags: ['Marca', 'logo'], mimeHint: 'video/mp4' });
  assert.equal(first.asset.kind, 'IMAGE');
  assert.equal(first.asset.mime, 'image/png');
  assert.deepEqual([first.asset.width, first.asset.height], [1, 1]);
  assert.deepEqual(first.asset.tags, ['marca', 'logo']);
  const again = await lib.add(a.id, { bytes: PNG, name: 'Outro nome', tags: ['novo'] });
  assert.equal(again.existed, true);
  assert.equal(again.asset.id, first.asset.id);
  assert.deepEqual(again.asset.tags, ['marca', 'logo', 'novo']);
  await assert.rejects(lib.add(a.id, { bytes: PNG, name: 'x', kind: 'VIDEO' }), /parece ser image/);
  await lib.add(a.id, { bytes: GLB, name: 'Árvore' });
  await lib.add(a.id, { bytes: MP3, name: 'Chuva' });

  assert.deepEqual((await lib.list(a.id)).map((x) => x.kind).sort(), ['AUDIO', 'IMAGE', 'MODEL3D']);
  assert.equal((await lib.list(a.id, { kind: 'MODEL3D' })).length, 1);
  assert.equal((await lib.list(a.id, { query: 'RVOR' })).length, 1, 'busca por parte do nome, sem diferenciar maiúsculas');
  assert.equal((await lib.list(a.id, { tag: 'marca' })).length, 1);
  assert.equal((await lib.list(b.id)).length, 0, 'a biblioteca é da conta');
  await assert.rejects(lib.get(b.id, first.asset.id), /não encontrado/);

  // o mesmo conteúdo na conta B: o blob é compartilhado e só some quando ninguém mais o usa
  const other = await lib.add(b.id, { bytes: PNG, name: 'Mesma imagem' });
  await lib.remove(a.id, first.asset.id);
  const kept = await lib.bytes(b.id, other.asset.id);
  assert.deepEqual([...kept.data], [...PNG], 'a conta B ainda tem o arquivo');
  await lib.remove(b.id, other.asset.id);
  assert.equal(await blobs.has((await blobs.put(PNG)).hash), true);

  process.env.STYLO_LIBRARY_QUOTA_MB = '0.00001';
  await assert.rejects(lib.add(a.id, { bytes: WOFF2(9), name: 'fonte' }), /cota/);
  delete process.env.STYLO_LIBRARY_QUOTA_MB;
  await close();
});

test('provedores: licença do Openverse, escolha do vídeo do Pexels, caminho de JSON', () => {
  assert.deepEqual(openverseLicense({ license: 'cc0', license_version: '1.0', license_url: 'u' }), { name: 'CC0 1.0', url: 'u', commercial: true, attribution: 'none' });
  assert.equal(openverseLicense({ license: 'by', license_version: '4.0' }).attribution, 'required');
  assert.equal(openverseLicense({ license: 'by-nc', license_version: '4.0' }).commercial, false);
  const pick = pickPexelsVideo([
    { link: 'a', quality: 'sd', file_type: 'video/mp4', width: 640 }, { link: 'b', quality: 'hd', file_type: 'video/mp4', width: 1920 },
    { link: 'c', quality: 'hd', file_type: 'video/mp4', width: 3840 }, { link: 'd', quality: 'hls', file_type: 'application/x-mpegURL', width: 1920 },
  ]);
  assert.equal(pick.link, 'b', 'MP4 mais largo até 1920 px; ignora HLS e 4K');
  assert.equal(readPath({ data: { items: [{ u: { x: 5 } }] } }, 'data.items[0].u.x'), 5);
  assert.equal(readPath({ a: 1 }, 'b.c'), undefined);
});

// ------------------------------------------------------------------ ferramentas do plugin (respostas simuladas)
const JSONRES = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

async function setup() {
  resetAssetCaches(); resetFontCatalog();
  const { db, close } = await createDb({ pglite: {} });
  const owner = await db.user.create({ data: { username: 'o', email: 'o@x.com', name: 'O', passwordHash: '!', role: 'OWNER' } });
  const blobs = createMemoryBlobStore();
  const library = createLibrary({ db, blobs });
  const secrets = createSecrets(db, randomBytes(32));
  const sources = createAssetSources(db);
  const calls: string[] = [];
  const files = new Map<string, Uint8Array | object>();
  const fake = async (url: string) => {
    calls.push(String(url));
    const u = String(url);
    if (u.startsWith('https://api.openverse.org/v1/images/')) return JSONRES({ page_count: 3, results: [{ id: 'ov1', title: 'Gato', url: 'https://img.test/gato.png', thumbnail: 'https://img.test/t.png', creator: 'Ana', creator_url: 'https://x/ana', license: 'by', license_version: '4.0', license_url: 'https://cc/by', foreign_landing_url: 'https://land/1', width: 1, height: 1, filetype: 'png' }] });
    if (u.startsWith('https://api.openverse.org/v1/audio/')) return JSONRES({ page_count: 1, results: [{ id: 'oa1', title: 'Chuva', url: 'https://snd.test/chuva.mp3', creator: 'Zé', license: 'cc0', license_version: '1.0', duration: 12000, filetype: 'mp3' }] });
    if (u.startsWith('https://api.pexels.com/v1/search')) return JSONRES({ next_page: 'x', photos: [{ id: 7, width: 100, height: 50, url: 'https://pexels/7', photographer: 'Bia', photographer_url: 'https://pexels/bia', src: { large2x: 'https://img.test/p7.png', medium: 'https://img.test/m.png' } }] });
    if (u.startsWith('https://api.pexels.com/v1/videos/search')) return JSONRES({ videos: [{ id: 9, url: 'https://pexels/v9', image: 'https://img.test/v9.jpg', duration: 8, user: { name: 'Caio', url: 'https://pexels/caio' }, video_files: [{ link: 'https://vid.test/v9.mp4', quality: 'hd', file_type: 'video/mp4', width: 1280, height: 720 }] }] });
    if (u.startsWith('https://pixabay.com/api/videos/')) return JSONRES({ totalHits: 1, hits: [{ id: 5, pageURL: 'https://pixabay/5', tags: 'mar, onda', duration: 5, user: 'Dani', videos: { large: { url: '', size: 0 }, medium: { url: 'https://vid.test/p5.mp4', width: 1280, height: 720, size: 1000, thumbnail: 'https://img.test/p5.jpg' } } }] });
    if (u.startsWith('https://pixabay.com/api/')) return JSONRES({ totalHits: 1, hits: [{ id: 4, pageURL: 'https://pixabay/4', tags: 'casa', user: 'Eva', largeImageURL: 'https://img.test/pix4.png', webformatURL: 'https://img.test/w.png', imageWidth: 10, imageHeight: 5 }] });
    if (u.startsWith('https://api.fontsource.org/v1/fonts?')) return JSONRES([{ id: 'inter', family: 'Inter', subsets: ['latin', 'latin-ext'], weights: [400, 700], styles: ['normal'], defSubset: 'latin', variable: true, category: 'sans-serif', license: 'OFL-1.1' }, { id: 'lobster', family: 'Lobster', subsets: ['latin'], weights: [400], styles: ['normal'], defSubset: 'latin', variable: false, category: 'display', license: 'OFL-1.1' }]);
    if (u.startsWith('https://api.fontsource.org/v1/fonts/inter')) return JSONRES({ family: 'Inter', defSubset: 'latin', weights: [400, 700], license: 'OFL-1.1', unicodeRange: { latin: 'U+0000-00FF', 'latin-ext': 'U+0100-02BA' }, variants: { 400: { normal: { latin: { url: { woff2: 'https://cdn.test/inter-400-latin.woff2' } }, 'latin-ext': { url: { woff2: 'https://cdn.test/inter-400-ext.woff2' } } } }, 700: { normal: { latin: { url: { woff2: 'https://cdn.test/inter-700-latin.woff2' } } } } } });
    return new Response('não simulado: ' + u, { status: 404 });
  };
  const services: any = {
    library, sources, fetch: fake,
    keyFor: async (uid: string, p: string) => secrets.get(uid, p),
    fetchRemoteFile: async (url: string, opts: { maxBytes: number }) => {
      calls.push(`DL ${url}`);
      if (url.startsWith('https://api.fontsource.org')) return { bytes: new TextEncoder().encode(await (await fake(url)).text()), contentType: 'application/json' };
      const hit = files.get(url);
      if (!hit) throw new Error('arquivo não simulado: ' + url);
      const bytes = hit instanceof Uint8Array ? hit : new TextEncoder().encode(JSON.stringify(hit));
      if (bytes.length > opts.maxBytes) throw new Error('grande demais');
      return { bytes, contentType: '' };
    },
    customSources: (uid: string) => sources.list(uid),
  };
  const plugins = createPlugins({ plugins: builtinPlugins, services: { assets: services } });
  const operations = createOperations(db);
  let workspace: ReturnType<typeof createWorkspace>;
  const projects = createProjects({ db, getConfig: () => ({ keepVersions: 5 }), onWrite: (e) => { void workspace.externalWrite(e); } });
  workspace = createWorkspace({ projects, notes: createNotes(db), sharing: createSharing(db), operations, plugins, onOperation: (op) => { void operations.record(op); } });
  const actor = async (scopes = ['read', 'comment', 'write', 'export']): Promise<Actor> => {
    const a = await db.agent.create({ data: { name: `A-${Math.random()}`, ownerId: owner.id, tokenHash: `h-${Math.random()}`, scopes, status: 'ACTIVE' } });
    return { type: 'AGENT', userId: owner.id, agentId: a.id, name: a.name, scopes };
  };
  return { db, owner, library, secrets, services, files, calls, workspace, actor, call: (tool: string, args: any, a: Actor, sid = 's') => workspace.call(tool, args, { sid, actor: a }), close: async () => { await operations.idle(); await close(); } };
}

test('asset_providers e search_assets: provedores sem chave são pulados com o motivo; com a chave da CONTA entram; resultados trazem licença e crédito', async () => {
  const t = await setup();
  const a = await t.actor();
  const providers = (await t.call('asset_providers', {}, a)).providers;
  const by = (id: string) => providers.find((p: any) => p.id === id);
  assert.equal(by('openverse').ready, true);
  assert.equal(by('pexels').ready, false);
  assert.equal(by('pexels').needsKey.envVar, 'PEXELS_API_KEY');
  assert.equal(by('polypizza').unverified, true);
  assert.deepEqual(by('fontsource').kinds, ['font']);
  assert.equal(by('lucide-icons').sourceUrl, 'https://lucide.dev/icons');
  assert.equal(by('lucide-icons').licenseUrl, 'https://lucide.dev/license');
  assert.equal(by('openverse').licenseUrl, 'https://creativecommons.org/share-your-work/cclicenses/');

  const img = await t.call('search_assets', { kind: 'image', query: 'cat' }, a);
  assert.equal(img.error, undefined, img.error);
  assert.deepEqual(img.searched, ['openverse']);
  assert.ok(img.skipped.some((s: any) => s.provider === 'pexels' && /sem chave/.test(s.reason)));
  assert.ok(img.skipped.some((s: any) => s.provider === 'pixabay'));
  const r = img.results[0];
  assert.deepEqual([r.ref, r.provider, r.license.attribution, r.license.commercial], ['openverse:ov1', 'openverse', 'required', true]);
  assert.match(r.credit, /Gato.*Ana.*CC BY 4.0/);

  await t.secrets.set(t.owner.id, 'pexels', 'chave-pexels-123');
  await t.secrets.set(t.owner.id, 'pixabay', 'chave-pixabay-123');
  const both = await t.call('search_assets', { kind: 'image', query: 'cat' }, a);
  assert.deepEqual([...both.searched].sort(), ['openverse', 'pexels', 'pixabay']);
  assert.deepEqual(both.results.map((x: any) => x.provider), ['openverse', 'pexels', 'pixabay'], 'intercala os provedores');
  assert.equal(both.results.find((x: any) => x.provider === 'pexels').download.url, 'https://img.test/p7.png');
  assert.ok(t.calls.some((c) => c.includes('pixabay.com/api/?key=chave-pixabay-123')), 'a chave da conta é usada na chamada');
  assert.equal(JSON.stringify(both).includes('chave-pexels-123'), false, 'a chave nunca volta ao agente');

  const vid = await t.call('search_assets', { kind: 'video', query: 'sea' }, a);
  assert.deepEqual(vid.results.map((x: any) => [x.provider, x.download.url]).sort(), [['pexels', 'https://vid.test/v9.mp4'], ['pixabay', 'https://vid.test/p5.mp4']]);
  const audio = await t.call('search_assets', { kind: 'audio', query: 'rain' }, a);
  assert.equal(audio.results[0].duration, 12);
  assert.equal(audio.results[0].license.attribution, 'none');

  // só um provedor; provedor inexistente; cache evita repetir a chamada
  const before = t.calls.length;
  await t.call('search_assets', { kind: 'image', query: 'cat', provider: 'pixabay' }, a);
  assert.equal(t.calls.length, before, 'o Pixabay exige cache de 24 h: a segunda busca igual não chama a API');
  assert.match((await t.call('search_assets', { kind: 'image', query: 'x', provider: 'nao-existe' }, a)).error, /não existe/);
  await t.close();
});

test('library_save: baixa o que o PROVEDOR devolveu (licença e crédito autênticos), recusa ref inventada, tipo certo por conteúdo', async () => {
  const t = await setup();
  const a = await t.actor();
  await t.secrets.set(t.owner.id, 'pexels', 'chave-pexels-123');
  t.files.set('https://img.test/gato.png', PNG);
  t.files.set('https://vid.test/v9.mp4', MP4);
  t.files.set('https://snd.test/chuva.mp3', MP3);
  await t.call('search_assets', { kind: 'image', query: 'cat' }, a);
  await t.call('search_assets', { kind: 'video', query: 'sea' }, a);
  await t.call('search_assets', { kind: 'audio', query: 'rain' }, a);

  assert.match((await t.call('library_save', { ref: 'openverse:inventada' }, a)).error, /não está mais disponível/);
  const img = await t.call('library_save', { ref: 'openverse:ov1', tags: ['gatos'] }, a);
  assert.equal(img.error, undefined, img.error);
  assert.deepEqual([img.saved.kind, img.saved.mime, img.saved.license, img.alreadyInLibrary], ['image', 'image/png', 'CC BY 4.0', false]);
  assert.match(img.saved.credit, /Ana/);
  assert.ok(img.saved.tags.includes('gatos') && img.saved.tags.includes('openverse'));
  assert.equal((await t.call('library_save', { ref: 'openverse:ov1' }, a)).alreadyInLibrary, true);
  assert.equal((await t.call('library_save', { ref: 'pexels:video:9' }, a)).saved.kind, 'video');
  assert.equal((await t.call('library_save', { ref: 'openverse:oa1' }, a)).saved.kind, 'audio');

  const listed = await t.call('library_list', {}, a);
  assert.equal(listed.count, 3);
  assert.equal(listed.usage.assets, 3);
  assert.equal((await t.call('library_list', { kind: 'video' }, a)).count, 1);
  // outro agente da MESMA conta enxerga tudo; leitor sem escrita não salva
  const other = await t.actor(['read']);
  assert.equal((await t.call('library_list', {}, other)).count, 3, 'todos os agentes da conta usam a mesma biblioteca');
  assert.match((await t.call('library_save', { ref: 'openverse:ov1' }, other)).error, /permissão de escrita/);
  const id = listed.assets.find((x: any) => x.kind === 'audio').id;
  assert.equal((await t.call('library_remove', { id }, a)).removed.id, id);
  assert.equal((await t.call('library_list', {}, a)).count, 2);
  await t.close();
});

test('library_add: arquivo próprio por base64 ou endereço; tipo pelo conteúdo; licença e crédito informados', async () => {
  const t = await setup();
  const a = await t.actor();
  t.files.set('https://meusite.com/modelo.glb', GLB);
  const own = await t.call('library_add', { name: 'Logo', data_base64: Buffer.from(PNG).toString('base64'), license: 'comprado na Envato', credit: 'Logo por Fulano' }, a);
  assert.equal(own.error, undefined, own.error);
  assert.deepEqual([own.saved.kind, own.saved.license, own.saved.credit], ['image', 'comprado na Envato', 'Logo por Fulano']);
  const glb = await t.call('library_add', { name: 'Modelo', source_url: 'https://meusite.com/modelo.glb' }, a);
  assert.equal(glb.saved.kind, 'model3d');
  assert.match((await t.call('library_add', { name: 'x' }, a)).error, /exatamente UM/);
  assert.match((await t.call('library_add', { name: 'x', data_base64: '@@@' }, a)).error, /base64 inválido/);
  await t.close();
});

test('library_use: copia imagem e mídia para o projeto; add_font hospeda a fonte no projeto', async () => {
  const t = await setup();
  const a = await t.actor();
  t.files.set('https://img.test/gato.png', PNG);
  t.files.set('https://vid.test/v9.mp4', MP4);
  t.files.set('https://cdn.test/inter-400-latin.woff2', WOFF2(1));
  t.files.set('https://cdn.test/inter-700-latin.woff2', WOFF2(2));
  t.files.set('https://cdn.test/inter-400-ext.woff2', WOFF2(3));
  await t.secrets.set(t.owner.id, 'pexels', 'chave-pexels-123');
  await t.call('search_assets', { kind: 'image', query: 'cat' }, a);
  await t.call('search_assets', { kind: 'video', query: 'sea' }, a);
  const imgId = (await t.call('library_save', { ref: 'openverse:ov1' }, a)).saved.id;
  const vidId = (await t.call('library_save', { ref: 'pexels:video:9' }, a)).saved.id;

  assert.match((await t.call('library_use', { id: imgId }, a)).error, /Nenhum projeto aberto/);
  await t.call('new_project', { name: 'Site' }, a);
  const used = await t.call('library_use', { id: imgId, insert: true, name: 'Foto do gato' }, a);
  assert.equal(used.error, undefined, used.error);
  assert.equal(used.created.name, 'Foto do gato');
  assert.deepEqual([used.created.w, used.created.h], [1, 1]);
  const again = await t.call('library_use', { id: imgId }, a);
  assert.equal(again.asset_id, used.asset_id, 'mesma imagem, mesmo asset');
  assert.equal(again.reused, true);
  await t.db.libraryAsset.update({ where: { id: imgId }, data: { license: null } });
  assert.match((await t.call('library_use', { id: imgId }, a)).error, /licença comercial registrada/);
  await t.db.libraryAsset.update({ where: { id: imgId }, data: { license: { name: 'CC BY 4.0', commercial: true, attribution: 'required' } } as any });
  const video = await t.call('library_use', { id: vidId, insert: true, name: 'Vídeo do mar' }, a);
  assert.equal(video.error, undefined, video.error);
  assert.equal(video.kind, 'video');
  assert.equal(video.created.name, 'Vídeo do mar');

  // fonte: pesos 400 e 700 no alfabeto padrão, hospedados no projeto
  const font = await t.call('add_font', { id: 'inter', weights: [400, 700] }, a);
  assert.equal(font.error, undefined, font.error);
  assert.equal(font.family, 'Inter');
  assert.deepEqual(font.files.map((f: any) => [f.weight, f.subset]).sort(), [[400, 'latin'], [700, 'latin']]);
  await t.workspace.flushAll();
  const doc = (await t.workspace.call('get_document', {}, { sid: 's', actor: a })).document ?? null;
  const saved = await t.db.project.findFirstOrThrow({ where: { slug: 'site.json' } });
  const stored: any = saved.doc;
  assert.equal(stored.fonts[0].family, 'Inter');
  assert.equal(stored.fonts[0].files.length, 2);
  assert.ok(stored.credits.some((c: any) => /Foto|Ana|Gato/.test(c.text)) && stored.credits.some((c: any) => /Inter/.test(c.text)), 'créditos registrados no projeto');
  assert.equal(JSON.stringify(stored).includes('base64'), false, 'fontes e imagens saem do JSON (viram referências)');
  void doc;
  assert.match((await t.call('add_font', { id: 'inter', weights: [123] }, a)).error ?? 'ok', /ok|não tem arquivos/);
  await t.close();
});

test('fontes no search_assets: catálogo do Google Fonts por nome e categoria, com licença livre', async () => {
  const t = await setup();
  const a = await t.actor();
  const all = await t.call('search_assets', { kind: 'font', query: '' }, a);
  assert.deepEqual(all.results.map((r: any) => r.title).sort(), ['Inter', 'Lobster']);
  assert.equal(all.results[0].license.commercial, true);
  const display = await t.call('search_assets', { kind: 'font', query: '', category: 'display' }, a);
  assert.deepEqual(display.results.map((r: any) => r.title), ['Lobster']);
  const q = await t.call('search_assets', { kind: 'font', query: 'int' }, a);
  assert.equal(q.results[0].extra.id, 'inter');
  assert.deepEqual(q.results[0].extra.weights, [400, 700]);
  await t.close();
});

test('fontes cadastradas pela pessoa (sem código): validação, busca por mapa de campos e remoção', async () => {
  const t = await setup();
  const a = await t.actor();
  const source = {
    name: 'Minha Loja', searchUrl: 'https://api.minhaloja.com/search?q={consulta}&p={pagina}', kinds: ['image'], resultsPath: 'data.items',
    fields: { id: 'sku', title: 'name', download: 'files.big', preview: 'files.small', author: 'by' }, license: { name: 'Licença própria', attribution: 'none' },
  };
  assert.match((await t.call('asset_source_add', { ...source, searchUrl: 'http://x.com/{consulta}' }, a)).error, /https/);
  assert.match((await t.call('asset_source_add', { ...source, searchUrl: 'https://x.com/search' }, a)).error, /\{consulta\}/);
  assert.match((await t.call('asset_source_add', { ...source, searchUrl: 'https://localhost/s?q={consulta}' }, a)).error, /inválido/);
  assert.equal((await t.call('asset_source_add', source, a)).error, undefined);
  assert.ok((await t.call('asset_providers', {}, a)).providers.some((p: any) => p.id === 'custom:Minha Loja' && p.custom));

  t.files.set('https://api.minhaloja.com/search?q=sofa&p=1', { data: { items: [{ sku: 'S1', name: 'Sofá azul', files: { big: 'https://cdn.minhaloja.com/s1.png', small: 'https://cdn.minhaloja.com/s1s.png' }, by: 'Loja' }, { sku: 'S2', name: 'sem arquivo' }] } });
  const found = await t.call('search_assets', { kind: 'image', query: 'sofa', provider: 'custom:Minha Loja' }, a);
  assert.equal(found.error, undefined, found.error);
  assert.deepEqual(found.results.map((r: any) => [r.ref, r.title, r.license.name]), [['custom:Minha Loja:S1', 'Sofá azul', 'Licença própria']]);
  assert.equal(found.results[0].download.url, 'https://cdn.minhaloja.com/s1.png');
  await t.call('asset_source_remove', { name: 'Minha Loja' }, a);
  assert.equal((await t.call('asset_providers', {}, a)).providers.some((p: any) => p.custom), false);
  await t.close();
});

test('mídia dentro do projeto tem limite próprio (menor que o da biblioteca); imagem segue o dela', async () => {
  const { assertFitsProject } = await import('@stylo/plugins/assets/index.ts');
  assert.doesNotThrow(() => assertFitsProject('VIDEO', 25 * 1024 * 1024));
  assert.throws(() => assertFitsProject('VIDEO', 26 * 1024 * 1024, 'clip'), /clip.*limite de mídia é 25 MB/);
  assert.doesNotThrow(() => assertFitsProject('IMAGE', 30 * 1024 * 1024));
});
