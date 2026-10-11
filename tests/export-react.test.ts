// Exportação para React: o conversor de HTML em JSX e o projeto Vite que sai dele.
// (O build real com `npm install && vite build` foi conferido à mão; aqui ficam as garantias que não dependem de rede.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssClasses, htmlToJsx } from '@stylo/core/html-to-jsx.ts';
import { exportReact } from '@stylo/core/export-react.ts';
import { createNode, makeDoc } from '@stylo/core/model.ts';

test('htmlToJsx: classes, estilos, atributos, vazios, comentários e elementos customizados', () => {
  const jsx = htmlToJsx(
    '<div class="a b" style="display:block;--x: 1;-webkit-box-shadow:0 0 1px">'
    + '<label for="n" tabindex="0">Nome</label><input type="text" disabled maxlength="5"><br>'
    + '<svg viewBox="0 0 10 10" stroke-width="2" xmlns:xlink="http://www.w3.org/1999/xlink"><path stroke-linecap="round" d="M0 0"/></svg>'
    + '<!-- crédito */ aqui --><model-viewer class="m" camera-controls src="/a.glb"></model-viewer>'
    + '<video autoplay muted playsinline></video></div>',
    { moduleClasses: new Set(['a', 'm']) },
  );
  assert.match(jsx, /className=\{\[styles\["a"\], "b"\]\.join\(' '\)\}/, 'classe do módulo + literal');
  assert.match(jsx, /style=\{\{ display: "block", "--x": "1", WebkitBoxShadow: "0 0 1px" \}\}/);
  assert.match(jsx, /htmlFor="n" tabIndex="0"/);
  assert.match(jsx, /<input type="text" disabled maxLength="5" \/>/);
  assert.match(jsx, /<br \/>/);
  assert.match(jsx, /strokeWidth="2"/);
  assert.doesNotMatch(jsx, /xmlns:xlink/);
  assert.match(jsx, /strokeLinecap="round"/);
  assert.match(jsx, /\{\/\* crédito \* \/ aqui \*\/\}/, '*/ dentro do comentário não fecha o JSX');
  assert.match(jsx, /<model-viewer class=\{styles\["m"\]\} camera-controls src="\/a\.glb"/, 'elemento customizado: class e atributos kebab');
  assert.match(jsx, /autoPlay muted playsInline/);
});

test('htmlToJsx: texto com chaves, aspas, < e quebra de linha vira expressão; espaços de formatação somem; manipuladores on* são descartados', () => {
  const jsx = htmlToJsx('<div>\n  <p onclick="x()">a {b} "c" &lt;d&gt; &amp; e\nf</p>\n  <span>simples</span>\n</div>');
  assert.match(jsx, /\{"a \{b\} \\"c\\" <d> & e\\nf"\}/);
  assert.match(jsx, /<span>\n\s+simples\n\s+<\/span>/);
  assert.doesNotMatch(jsx, /onclick|onClick/);
  assert.equal(htmlToJsx('<p></p><p></p>').startsWith('<>'), true, 'várias raízes viram fragmento');
});

test('htmlToJsx: recusa o que não entende (script no meio, tag mal fechada)', () => {
  assert.throws(() => htmlToJsx('<div><script>1</script></div>'), /<script>/);
  assert.throws(() => htmlToJsx('<div><p></div>'), /não fecha/);
  assert.throws(() => htmlToJsx('<div>'), /não foi fechada/);
});

test('cssClasses: acha classes, ignora números, url() e textos', () => {
  const set = cssClasses('.titulo { line-height: 1.4; background: url(a.png) } .menu-item:hover, a.btn { content: ".fake"; margin: .5px } /* .nota */');
  assert.deepEqual([...set].sort(), ['btn', 'menu-item', 'titulo']);
});

function projeto() {
  const doc: any = makeDoc();
  doc.name = 'Loja de Plantas';
  doc.assets = { img: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', lot: 'data:application/json;base64,e30=', glb: 'data:model/gltf-binary;base64,AAAA' };
  doc.styles.colors.push({ id: 'c1', name: 'Marca', color: '#2F6A4A', opacity: 1 });
  doc.credits = [{ text: 'Foto por Ana', license: 'CC0' }];
  const home: any = createNode('frame', { name: 'Home', w: 400, h: 300 }); home.layout.mode = 'column';
  home.children.push(createNode('text', { name: 'Título', text: 'Olá', tag: 'h1' }));
  const link: any = createNode('frame', { name: 'Ir', tag: 'a', href: 'sobre-nos.html', w: 50, h: 20 }); link.layout.mode = 'row'; home.children.push(link);
  const foto: any = createNode('rect', { name: 'Foto', w: 100, h: 100 }); foto.fill = { ...foto.fill, type: 'image', assetId: 'img', fit: 'cover' }; home.children.push(foto);
  home.children.push(createNode('media', { name: 'Anim', mediaKind: 'lottie', mediaAssetId: 'lot', mediaAutoplay: true }));
  home.children.push(createNode('media', { name: 'Modelo', mediaKind: 'model3d', mediaAssetId: 'glb' }));
  const sobre: any = createNode('frame', { name: 'Sobre nós', w: 400, h: 200 }); sobre.layout.mode = 'column';
  sobre.children.push(createNode('text', { name: 'Título', text: 'Sobre', tag: 'h1' }));
  doc.pages[0].children.push(home, sobre);
  return doc;
}

test('exportReact: projeto Vite com uma página por tela, CSS Modules, rotas, assets em public/ e dependências só do que é usado', () => {
  const { files } = exportReact(projeto());
  const paths = files.map((f) => f.path);
  for (const p of ['package.json', 'vite.config.js', 'index.html', 'README.md', '.gitignore', 'src/main.jsx', 'src/App.jsx', 'src/styles/reset.css', 'src/styles/tokens.css',
    'src/pages/Home.jsx', 'src/pages/Home.module.css', 'src/pages/SobreNos.jsx', 'src/pages/SobreNos.module.css', 'CREDITS.txt']) assert.ok(paths.includes(p), p);
  assert.ok(paths.some((p) => /^public\/assets\/img-.*\.png$/.test(p)), 'imagem em public/assets');
  assert.ok(!paths.some((p) => p.startsWith('vendor/')) && !paths.some((p) => p.endsWith('.html') && p !== 'index.html'), 'sem páginas html nem vendor/');
  const get = (p: string) => String(files.find((f) => f.path === p)!.content);

  const home = get('src/pages/Home.jsx');
  assert.match(home, /import styles from '\.\/Home\.module\.css';/);
  assert.match(home, /import lottie from 'lottie-web';/);
  assert.match(home, /import '@google\/model-viewer';/);
  assert.match(home, /<a className=\{styles\["ir"\]\} href="#\/sobre-nos"/, 'link para outra página vira rota #');
  assert.match(home, /ref=\{root\}/);
  assert.match(get('src/pages/SobreNos.jsx'), /<h1 className=\{styles\["titulo"\]\}>/);
  assert.doesNotMatch(get('src/pages/SobreNos.jsx'), /lottie/, 'página sem Lottie não importa Lottie');
  assert.match(get('src/pages/Home.module.css'), /url\("?\/assets\/img-/, 'url do CSS aponta para public/ na raiz');
  assert.doesNotMatch(get('src/pages/Home.module.css'), /box-sizing: border-box;\n\}\nul, ol/, 'o reset não é repetido em cada página');

  const app = get('src/App.jsx');
  assert.match(app, /'\/': Home,/);
  assert.match(app, /'\/sobre-nos': SobreNos,/);
  const pkg = JSON.parse(get('package.json'));
  assert.equal(pkg.name, 'loja-de-plantas');
  assert.ok(pkg.dependencies['lottie-web'] && pkg.dependencies['@google/model-viewer'] && pkg.dependencies.react);
  assert.match(get('src/styles/tokens.css'), /--cor-marca: #2f6a4a/);
  assert.match(get('src/main.jsx'), /import '\.\/styles\/tokens\.css';/);
  assert.match(get('CREDITS.txt'), /Foto por Ana/);
});

test('exportReact: sem Lottie/3D as dependências não aparecem; sem tela dá erro claro; HTML que não dá para converter cai em HTML bruto com aviso', () => {
  const doc: any = makeDoc();
  assert.throws(() => exportReact(doc), /pranchetas visíveis/);
  const frame: any = createNode('frame', { name: 'Só texto', w: 300, h: 100 }); frame.layout.mode = 'column';
  frame.children.push(createNode('text', { name: 'T', text: 'oi' }));
  doc.pages[0].children.push(frame);
  const pkg = JSON.parse(String(exportReact(doc).files.find((f) => f.path === 'package.json')!.content));
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['react', 'react-dom']);

  // HTML escrito à mão que o conversor não entende (<textarea> no corpo): a página entra como HTML bruto, com CSS global e aviso
  frame.children.push(createNode('html', { name: 'Código', html: '<textarea>oi</textarea>' }));
  const bruto = exportReact(doc);
  assert.ok(bruto.warnings.some((w) => /não consegui converter para JSX/.test(w)));
  const jsx = String(bruto.files.find((f) => f.path === 'src/pages/Home.jsx')!.content);
  assert.match(jsx, /dangerouslySetInnerHTML/);
  assert.ok(jsx.includes("import './Home.css';"));
  assert.ok(bruto.files.some((f) => f.path === 'src/pages/Home.css'));
});
