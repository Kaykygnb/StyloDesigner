// Gera tests/fixtures/projeto-hostil.json: um projeto de "terceiros" com tudo que a validação deve conter. NADA aqui é
// perigoso de verdade (os endereços usam o domínio reservado .invalid e o script só escreve no console).
// Uso: node tests/fixtures/gerar-projeto-hostil.mjs
import { writeFileSync } from 'node:fs';
import { createNode, defaultFill, makeDoc } from '../../src/model.js';

const doc = makeDoc();
doc.name = 'Projeto hostil (teste de segurança)';
doc.assets = {
  boa: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pZsAAAAASUVORK5CYII=',
  externa: 'https://rastreador.invalid/pixel.png',
  js: 'javascript:alert(1)',
  fechaUrl: '");}</style><script>console.log("xss")</script>',
};
doc.styles.pageCss = '.cartao { background: url(https://rastreador.invalid/fundo.png) }\n@import url("https://css.invalid/tema.css");';

const frame = createNode('frame', { name: '2024 Hero', x: 40, y: 40, w: 600, h: 300 });
frame.fluid = true;
frame.blend = 'normal;}</style><script>console.log("xss")</script>';
frame.cursor = 'pointer;}body{background:url(https://rastreador.invalid/x)}/*';
frame.stroke = { color: '#000000', opacity: 1, width: 2, style: 'solid;}</style><script>console.log("xss")</script>', position: 'inside', sides: [0, 0, 0, 0] };
frame.fill = { ...defaultFill('#ffffff'), type: 'image', assetId: 'fechaUrl', fit: 'cover' };

const texto = createNode('text', { name: 'Título', text: 'Olá <script>console.log("xss")</script> & mundo', x: 24, y: 24, w: 300, h: 40 });
texto.id = 'x" onload="console.log(1)';
texto.customCss = 'color: red;}body{background:url(https://rastreador.invalid/y)}/*';
frame.children = [texto];

doc.pages[0].children = [frame];
const json = JSON.stringify(doc, null, 2);
writeFileSync(new URL('./projeto-hostil.json', import.meta.url), json);
console.log('tests/fixtures/projeto-hostil.json gerado');
