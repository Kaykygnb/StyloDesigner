import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode } from '@stylo/core/model.js';
import { exportSite } from '@stylo/core/site-export.js';
import { createZip } from '@stylo/core/zip.js';

const frame = (name, children = [], props = {}) => createNode('frame', { name, children, ...props });
const docOf = (...children) => ({
  name: 'Projeto', assets: {}, styles: {},
  pages: [{ name: 'Design', children }],
});

test('exporta cada prancheta visível em HTML separado e reserva index.html para a primeira', () => {
  const doc = docOf(
    frame('Início', [createNode('text', { text: 'Home', tag: 'h1' })]),
    frame('Sobre nós'),
    frame('Sobre nós'),
    frame('Oculta', [], { visible: false }),
  );
  doc.pages.push({ name: 'Equipe', children: [frame('Equipe')] });
  const site = exportSite(doc);
  assert.deepEqual(site.files.map((f) => f.path), ['index.html', 'sobre-nos.html', 'sobre-nos-2.html', 'equipe.html']);
  assert.match(site.files[0].content, /<title>Início<\/title>/);
  assert.deepEqual(site.warnings, []);
});

test('inclui pranchetas dentro de seções e avisa sobre páginas vazias', () => {
  const section = createNode('section', { name: 'Grupo', children: [frame('Contato')] });
  const hidden = createNode('section', { name: 'Rascunhos', visible: false, children: [frame('Não exportar')] });
  const doc = docOf(section, hidden);
  doc.pages.push({ name: 'Rascunho', children: [frame('Oculta', [], { visible: false })] });
  const site = exportSite(doc);
  assert.deepEqual(site.files.map((f) => f.path), ['index.html']);
  assert.match(site.warnings.join('\n'), /Rascunhos|Rascunho/);
});

test('preserva links HTML relativos e avisa se o destino não está no pacote', () => {
  const nav = createNode('text', { text: 'Sobre', tag: 'a', href: 'sobre.html' });
  const missing = createNode('text', { text: 'Ajuda', tag: 'a', href: 'ajuda.html' });
  const dotLink = createNode('text', { text: 'Sobre também', tag: 'a', href: './sobre.html#topo' });
  const wrongCase = createNode('text', { text: 'Sobre caixa errada', tag: 'a', href: 'Sobre.html' });
  const site = exportSite(docOf(frame('Início', [nav, missing, dotLink, wrongCase]), frame('Sobre')));
  assert.match(site.files[0].content, /href="sobre\.html"/);
  assert.match(site.warnings.join('\n'), /ajuda\.html/);
  assert.doesNotMatch(site.warnings.join('\n'), /\.\/sobre\.html/);
  assert.match(site.warnings.join('\n'), /maiúsculas\/minúsculas/);
});

test('nomes de arquivo são limitados e não colidem com nomes reservados do Windows', () => {
  const longName = 'p'.repeat(300);
  const site = exportSite(docOf(frame('Início'), frame('Index'), frame('CON'), frame(longName), frame(undefined, [], { interactions: [{ type: 'navigate' }] })));
  assert.deepEqual(site.files.map((f) => f.path), ['index.html', 'index-2.html', 'con-page.html', `${'p'.repeat(120)}.html`, 'pagina.html']);
  assert.ok(site.files.every((f) => f.path.length <= 255 && /^[a-z0-9._-]+\.html$/.test(f.path)));
  assert.match(site.warnings.join('\n'), /“Página” contém interações/);
  assert.doesNotMatch(site.warnings.join('\n'), /undefined/);
});

test('avisa quando a página tem interações do protótipo que não viram JavaScript exportado', () => {
  const link = createNode('text', { text: 'Abrir', tag: 'a', href: '#', interactions: [{ type: 'navigate', target: 'x' }] });
  const site = exportSite(docOf(frame('Início', [link])));
  assert.match(site.warnings.join('\n'), /interações de protótipo/);
  assert.doesNotMatch(site.files[0].content, /<script\b/i);
});

test('recusa pacote vazio, caminhos perigosos e arquivos duplicados', () => {
  assert.throws(() => exportSite({ pages: [] }), /pranchetas visíveis/);
  assert.throws(() => createZip([{ path: '../escape.html', content: 'x' }]), /inseguro/);
  assert.throws(() => createZip([{ path: 'index.html', content: 'a' }, { path: 'INDEX.html', content: 'b' }]), /duplicado/);
});

test('createZip escreve cabeçalhos ZIP Store UTF-8 e o conteúdo integral de cada página', () => {
  const bytes = createZip([{ path: 'index.html', content: '<h1>Olá</h1>' }, { path: 'sobre-nos.html', content: 'Sobre' }]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let offset = 0;
  const entries = [];
  while (view.getUint32(offset, true) === 0x04034b50) {
    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 18, true);
    const nameSize = view.getUint16(offset + 26, true);
    const extraSize = view.getUint16(offset + 28, true);
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameSize));
    const contentStart = offset + 30 + nameSize + extraSize;
    entries.push([name, decoder.decode(bytes.subarray(contentStart, contentStart + size))]);
    assert.equal(flags & 0x0800, 0x0800);
    assert.equal(method, 0);
    offset = contentStart + size;
  }
  assert.deepEqual(entries, [['index.html', '<h1>Olá</h1>'], ['sobre-nos.html', 'Sobre']]);
  assert.equal(view.getUint32(offset, true), 0x02014b50, 'diretório central segue as entradas locais');
  const endOffset = bytes.length - 22;
  assert.equal(view.getUint32(endOffset, true), 0x06054b50, 'registro EOCD encerra o arquivo');
  assert.equal(view.getUint16(endOffset + 10, true), 2);
});

const PNG_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const GIF_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const imageLayer = (name, assetId) => createNode('rect', { name, w: 100, h: 60, fill: { type: 'image', color: '#ffffff', opacity: 1, stops: [], angle: 0, assetId, fit: 'cover' } });

test('imagens saem como ARQUIVOS em assets/ e o HTML aponta para eles (sem base64); a mesma imagem vira um arquivo só', () => {
  const doc = docOf(frame('Home', [imageLayer('Foto A', 'a'), imageLayer('Foto B', 'b'), imageLayer('Outra', 'c')]));
  doc.assets = { a: PNG_URL, b: PNG_URL, c: GIF_URL, sobra: 'data:image/png;base64,AAAA' };
  const site = exportSite(doc);
  const html = site.files.find((f) => f.path === 'index.html').content;
  assert.equal(html.includes('base64'), false, 'nenhum base64 no HTML');
  const images = site.files.filter((f) => f.path.startsWith('assets/'));
  assert.equal(images.length, 2, 'duas imagens distintas (PNG repetido vira um arquivo só); a que ninguém usa não vai');
  for (const image of images) {
    assert.ok(image.content instanceof Uint8Array && image.content.length > 10, image.path);
    assert.ok(html.includes(`url("${image.path}")`) || html.includes(image.path), `o HTML referencia ${image.path}`);
  }
  assert.ok(images.some((i) => i.path.endsWith('.png')) && images.some((i) => i.path.endsWith('.gif')));
  assert.deepEqual(images.map((i) => i.path), [...new Set(images.map((i) => i.path))], 'nomes únicos');
  // o mesmo conteúdo sempre dá o mesmo nome (estável entre exportações)
  assert.deepEqual(exportSite(doc).files.map((f) => f.path), site.files.map((f) => f.path));
});

test('o ZIP leva os arquivos de imagem como bytes; modo inline mantém tudo dentro do HTML', () => {
  const doc = docOf(frame('Home', [imageLayer('Foto', 'a')]));
  doc.assets = { a: PNG_URL };
  const site = exportSite(doc);
  const zip = createZip(site.files);
  const text = new TextDecoder('latin1').decode(zip);
  assert.ok(text.includes('assets/img-') && text.includes('index.html'));
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(view.getUint16(zip.length - 22 + 10, true), site.files.length);
  const inline = exportSite(doc, { assets: 'inline' });
  assert.equal(inline.files.length, 1);
  assert.ok(inline.files[0].content.includes('data:image/png;base64'));
});

test('projeto sem imagens continua com um arquivo por prancheta', () => {
  const site = exportSite(docOf(frame('Home')));
  assert.deepEqual(site.files.map((f) => f.path), ['index.html']);
});

const woff2Url = (n) => `data:font/woff2;base64,${Buffer.from(Uint8Array.from([0x77, 0x4f, 0x46, 0x32, n, ...new Array(60).fill(n)])).toString('base64')}`;
const textLayer = (family) => createNode('text', { name: 'Título', text: 'Olá', fontFamily: family });

test('fontes do projeto saem como arquivos em fonts/ com @font-face; só famílias que NÃO são do projeto vão para o CDN do Google', () => {
  const doc = docOf(frame('Home', [textLayer('Inter'), textLayer('Lobster')]));
  doc.assets = { f1: woff2Url(1), f2: woff2Url(2) };
  doc.fonts = [{ family: 'Inter', files: [
    { weight: 400, style: 'normal', subset: 'latin', assetId: 'f1', unicodeRange: 'U+0000-00FF', ext: 'woff2' },
    { weight: 700, style: 'normal', subset: 'latin', assetId: 'f2', ext: 'woff2' },
  ] }];
  const site = exportSite(doc);
  const html = site.files.find((f) => f.path === 'index.html').content;
  const fonts = site.files.filter((f) => f.path.startsWith('fonts/')).map((f) => f.path).sort();
  assert.deepEqual(fonts, ['fonts/inter-400-normal-latin.woff2', 'fonts/inter-700-normal-latin.woff2']);
  assert.ok(site.files.filter((f) => f.path.startsWith('fonts/')).every((f) => f.content instanceof Uint8Array));
  assert.match(html, /@font-face \{ font-family: 'Inter'; font-style: normal; font-weight: 400; font-display: swap; src: url\(fonts\/inter-400-normal-latin\.woff2\) format\('woff2'\); unicode-range: U\+0000-00FF;/);
  assert.equal(html.includes('base64'), false, 'a fonte não fica embutida no HTML');
  assert.ok(html.includes('fonts.googleapis.com') && /family=Lobster/.test(html), 'Lobster (que não é do projeto) continua pelo CDN');
  assert.equal(/family=Inter/.test(html), false, 'Inter é hospedada: fora do CDN do Google');
});

test('créditos do projeto viram arquivos de crédito no pacote; sem créditos, nenhum arquivo extra', () => {
  const doc = docOf(frame('Home'));
  doc.credits = [{ text: 'Foto de Bia no Pexels (https://pexels/7)', license: 'Licença Pexels' }, { text: 'Inter — SIL Open Font License 1.1 (Google Fonts)' }];
  const credits = exportSite(doc).files.find((f) => f.path === 'CREDITS.txt');
  assert.match(credits.content, /Créditos dos assets/);
  assert.match(credits.content, /- Foto de Bia no Pexels \(https:\/\/pexels\/7\) — Licença Pexels/);
  assert.match(credits.content, /- Inter — SIL Open Font License 1\.1/);
  assert.match(String(exportSite(doc).files.find((f) => f.path === 'CREDITS.md')?.content), /# Créditos dos assets/);
  assert.match(String(exportSite(doc).files.find((f) => f.path === 'THIRD-PARTY-NOTICES')?.content), /THIRD-PARTY NOTICES/);
  assert.equal(exportSite(docOf(frame('Home'))).files.some((f) => f.path === 'CREDITS.md'), false);
});
