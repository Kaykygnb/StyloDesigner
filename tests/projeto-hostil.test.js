// O projeto hostil de exemplo (tests/fixtures/projeto-hostil.json, gerado por gerar-projeto-hostil.mjs) abre com avisos
// e a exportação não deixa nada escapar do <style>, do atributo ou carregar recurso do filtro de camada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizeDoc } from '../src/validate.js';
import { exportHtml } from '../src/css.js';

const carregar = () => JSON.parse(readFileSync(new URL('./fixtures/projeto-hostil.json', import.meta.url), 'utf8'));

test('abrir o projeto hostil: avisos claros e documento consertado', () => {
  const doc = carregar();
  const avisos = sanitizeDoc(doc);
  const texto = avisos.join(' | ');
  assert.match(texto, /imagem/i, 'imagens externas e javascript: removidas');
  assert.match(texto, /rastreador\.invalid|css\.invalid/, 'hosts externos do CSS da página avisados');
  assert.deepEqual(Object.keys(doc.assets), ['boa'], 'só a imagem embutida sobrevive');
  const frame = doc.pages[0].children[0];
  assert.match(frame.children[0].id, /^[\w~-]+$/, 'id com aspas foi trocado');
});

test('exportar o projeto hostil: nada de <script>, nada fora do <style>, nenhum recurso externo vindo de camada', () => {
  const doc = carregar();
  sanitizeDoc(doc);
  const html = exportHtml(doc.pages[0].children[0], doc.assets, 'Hostil', doc.styles);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<\/style>\s*<(?!\/head)/i, 'nenhuma tag nova logo depois de fechar o <style>');
  assert.doesNotMatch(html, / onload=/i);
  // o CSS da camada e os estilos de camada nunca carregam endereço externo; o CSS da PÁGINA pode (e foi avisado)
  const semPagina = html.replace(/\.cartao[^}]*}/g, '');
  assert.doesNotMatch(semPagina.replace(/@import[^;]*;/g, ''), /rastreador\.invalid\/(x|y|pixel)/);
});
