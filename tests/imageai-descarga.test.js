// Download da imagem gerada quando a API devolve só uma URL (issue #2): endereço restrito e tamanho limitado de verdade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readImageResult } from '../server/imageai.js';

const png = (bytes) => new Response(bytes, { status: 200, headers: { 'content-type': 'image/png' } });
const okFetch = async () => png(new Uint8Array([1, 2, 3]));
const via = (url) => readImageResult({ data: [{ url }] }, { fetchImpl: okFetch });

test('só baixa https de hosts públicos, sem credenciais na URL', async () => {
  assert.match(await via('https://cdn.exemplo.com/x.png'), /^data:image\/png;base64,/);
  await assert.rejects(via('http://cdn.exemplo.com/x.png'), /endereço/i, 'http puro não');
  await assert.rejects(via('https://10.0.0.5/x.png'), /endereço/i, 'IP privado não');
  await assert.rejects(via('https://192.168.1.10/x.png'), /endereço/i);
  await assert.rejects(via('https://127.0.0.1:5173/api/status'), /endereço/i, 'o próprio servidor não');
  await assert.rejects(via('https://localhost/x.png'), /endereço/i);
  await assert.rejects(via('https://169.254.169.254/latest/meta-data'), /endereço/i, 'metadados de nuvem não');
  await assert.rejects(via('https://[::1]/x.png'), /endereço/i);
  await assert.rejects(via('https://usuario:senha@cdn.exemplo.com/x.png'), /endereço/i, 'credencial na URL não');
});

test('o download não segue redirecionamento (pedido ao fetch com redirect: error)', async () => {
  let seen;
  await readImageResult({ data: [{ url: 'https://cdn.exemplo.com/x.png' }] }, { fetchImpl: async (u, opts) => { seen = opts; return png(new Uint8Array([1])); } });
  assert.equal(seen.redirect, 'error');
});

test('o limite vale durante a leitura, mesmo sem Content-Length', async () => {
  let pulled = 0;
  const stream = new ReadableStream({
    pull(controller) { pulled += 1024 * 1024; controller.enqueue(new Uint8Array(1024 * 1024)); if (pulled > 40 * 1024 * 1024) controller.close(); },
  });
  const huge = async () => new Response(stream, { status: 200, headers: { 'content-type': 'image/png' } });
  await assert.rejects(readImageResult({ data: [{ url: 'https://cdn.exemplo.com/x.png' }] }, { fetchImpl: huge }), /grande demais/);
  assert.ok(pulled < 20 * 1024 * 1024, `deixou de ler logo após o limite (leu ${pulled / 1048576} MB)`);
});
