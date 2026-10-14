import test from 'node:test';
import assert from 'node:assert/strict';
import { googleCssUrl, localizeGoogleFonts, parseGoogleFontsCss, usedFontWeights } from '@stylo/core/google-fonts-bundle.ts';
import { exportSiteBundled, clearGoogleFontsCache, downloadGoogleFonts } from '../apps/server/src/services/google-fonts.ts';
import { createNode, makeDoc } from '@stylo/core/model.ts';

const CSS = `/* latin-ext */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/v1/ext.woff2) format('woff2');
  unicode-range: U+0100-02BA;
}
/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/v1/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}`;

function docWithText(family = 'Inter', weight = 400) {
  const doc: any = makeDoc('Teste');
  const frame: any = createNode('frame', { name: 'Tela 1', w: 400, h: 300 });
  const text: any = createNode('text', { text: 'Olá', fontFamily: family, fontWeight: weight });
  frame.children = [text];
  doc.pages[0].children = [frame];
  return doc;
}
const fakeFetch = (log: string[] = [], failFonts = false) => async (url: string) => {
  log.push(url);
  if (url.startsWith('https://fonts.googleapis.com/')) return { bytes: new TextEncoder().encode(CSS) };
  if (failFonts) throw new Error('sem rede');
  return { bytes: new TextEncoder().encode('FONT:' + url) };
};

test('parseGoogleFontsCss lê cada bloco com alfabeto, faixa e endereço', () => {
  const faces = parseGoogleFontsCss(CSS);
  assert.deepEqual(faces.map((f) => [f.family, f.subset, f.weight, f.format]), [['Inter', 'latin-ext', '400', 'woff2'], ['Inter', 'latin', '400', 'woff2']]);
  assert.equal(faces[1].unicodeRange, 'U+0000-00FF');
});

test('parseGoogleFontsCss ignora arquivos que não são do fonts.gstatic.com', () => {
  assert.equal(parseGoogleFontsCss("@font-face { font-family: 'X'; src: url(https://evil.example/x.woff2) format('woff2'); }").length, 0);
});

test('usedFontWeights junta família e pesos usados; googleCssUrl pede só esses', () => {
  const weights = usedFontWeights(docWithText('Inter', 700));
  assert.deepEqual([...weights.get('Inter')!], [700]);
  assert.match(googleCssUrl('Inter', [700]), /family=Inter:wght@700&display=swap$/);
  assert.equal(googleCssUrl('Arial', [400]), '');
});

test('exportSiteBundled troca o <link> por @font-face locais e põe os arquivos no zip', async () => {
  clearGoogleFontsCache();
  const log: string[] = [];
  const site = await exportSiteBundled(docWithText(), { fetchFile: fakeFetch(log) as any });
  const html = site.files.find((f) => f.path === 'index.html')!.content as string;
  assert.ok(!html.includes('fonts.googleapis.com'), 'sem link do Google');
  assert.ok(!html.includes('fonts.gstatic.com'), 'sem preconnect do Google');
  assert.match(html, /<style id="fontes-google">[\s\S]*src: url\(fonts\/inter-400-normal-latin\.woff2\) format\('woff2'\)/);
  assert.match(html, /unicode-range: U\+0000-00FF/);
  const fontFiles = site.files.filter((f) => f.path.startsWith('fonts/'));
  assert.deepEqual(fontFiles.map((f) => f.path).sort(), ['fonts/inter-400-normal-latin-ext.woff2', 'fonts/inter-400-normal-latin.woff2']);
  assert.deepEqual(site.bundledFonts, ['Inter']);
  assert.equal(log.filter((u) => u.includes('googleapis')).length, 1);
});

test('segunda exportação reaproveita os arquivos já baixados', async () => {
  clearGoogleFontsCache();
  const log: string[] = [];
  await exportSiteBundled(docWithText(), { fetchFile: fakeFetch(log) as any });
  await exportSiteBundled(docWithText(), { fetchFile: fakeFetch(log) as any });
  assert.equal(log.filter((u) => u.includes('gstatic')).length, 2, 'cada arquivo baixado uma vez só');
});

test('sem rede: o zip sai com o <link> antigo e um aviso em português', async () => {
  clearGoogleFontsCache();
  const site = await exportSiteBundled(docWithText(), { fetchFile: fakeFetch([], true) as any });
  const html = site.files.find((f) => f.path === 'index.html')!.content as string;
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=Inter/);
  assert.equal(site.files.filter((f) => f.path.startsWith('fonts/')).length, 0);
  assert.ok(site.warnings.some((w) => w.includes('“Inter” não foi embutida')), site.warnings.join('|'));
});

test('fonte do sistema não gera download', async () => {
  const log: string[] = [];
  const result = await downloadGoogleFonts(docWithText('Arial'), { fetchFile: fakeFetch(log) as any });
  assert.equal(log.length, 0);
  assert.deepEqual(result.warnings, []);
});

test('família que falhou continua no <link> enquanto as outras são embutidas', () => {
  const html = '<head>\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400&family=Lobster&display=swap">\n</head>';
  const faces = parseGoogleFontsCss(CSS);
  const downloaded = new Map(faces.map((f) => [f.url, new Uint8Array([1])]));
  const { files } = localizeGoogleFonts([{ path: 'index.html', content: html }], faces, downloaded);
  const out = files[0].content as string;
  assert.match(out, /family=Lobster&display=swap/);
  assert.ok(!/family=Inter/.test(out.split('<style')[0] + out.split('</style>')[1]));
});
