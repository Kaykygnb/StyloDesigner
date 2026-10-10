import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode } from '../src/model.js';
import { exportSite } from '../src/site-export.js';
import { createZip } from '../src/zip.js';

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
