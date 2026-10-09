// Testes do lado servidor da IA de foto (server/imageai.js): de onde vêm endereço/modelo/chave e as mensagens de erro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { imageConfigOf, apiErrorText, readImageResult } from '../server/imageai.js';

test('modelo de imagem: OpenAI tem padrão, NVIDIA não tem; escolha própria vale', () => {
  const openai = imageConfigOf({ agent: { keys: { 'https://api.openai.com/v1': 'sk-x' } } }, {});
  assert.equal(openai.model, 'gpt-image-1');
  assert.equal(openai.available, true);
  assert.equal(openai.apiKey, 'sk-x');
  const nim = imageConfigOf({ agent: { baseUrl: 'https://integrate.api.nvidia.com/v1', keys: { 'https://integrate.api.nvidia.com/v1': 'nv' } } }, {});
  assert.equal(nim.available, false);
  assert.match(nim.reason, /NVIDIA NIM.*não tem API de imagem.*Modelo de imagem/);
  const own = imageConfigOf({ agent: { baseUrl: 'https://integrate.api.nvidia.com/v1', keys: { 'https://api.openai.com/v1': 'sk-y' } }, imageai: { baseUrl: 'https://api.openai.com/v1/' } }, {});
  assert.equal(own.baseUrl, 'https://api.openai.com/v1');
  assert.equal(own.apiKey, 'sk-y', 'usa a chave guardada para o endereço de imagem');
  assert.equal(own.available, true);
});

test('sem chave: indisponível com aviso; endereço local não precisa de chave; variável de ambiente vale', () => {
  const none = imageConfigOf({}, {});
  assert.equal(none.available, false);
  assert.match(none.reason, /Falta a chave/);
  assert.equal(imageConfigOf({}, { OPENAI_API_KEY: 'env' }).apiKey, 'env');
  const local = imageConfigOf({ imageai: { baseUrl: 'http://127.0.0.1:9999/v1', model: 'falso' } }, {});
  assert.equal(local.available, true);
  assert.equal(local.timeoutSec, 120);
  assert.equal(imageConfigOf({ imageai: { timeoutSec: 99999 } }, {}).timeoutSec, 600);
});

test('mensagens de erro claras por status', () => {
  assert.match(apiErrorText(401, 'bad key'), /recusou a chave/);
  assert.match(apiErrorText(404, '', { baseUrl: 'https://x/v1', model: 'm' }), /não tem a API de imagens.*“m”/);
  assert.match(apiErrorText(429, 'quota'), /limite de uso/);
  assert.match(apiErrorText(500, ''), /falhou do lado dela/);
});

test('resultado: b64_json vira data URL; url é baixada; sem imagem = erro', async () => {
  assert.equal(await readImageResult({ data: [{ b64_json: 'QUJD' }] }), 'data:image/png;base64,QUJD');
  const fake = async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } });
  assert.equal(await readImageResult({ data: [{ url: 'https://exemplo/x.png' }] }, { fetchImpl: fake }), 'data:image/png;base64,AQID');
  const html = async () => new Response('<html>', { headers: { 'content-type': 'text/html' } });
  await assert.rejects(readImageResult({ data: [{ url: 'https://exemplo/x' }] }, { fetchImpl: html }), /download falhou/);
  await assert.rejects(readImageResult({}), /sem imagem/);
});
