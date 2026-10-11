// Baixar imagem por endereço sem abrir a rede interna do servidor (SSRF).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRemoteUrl, fetchRemoteImage, isPrivateAddress } from '../apps/server/src/services/remote-image.ts';

test('isPrivateAddress: loopback, redes internas, metadados da nuvem, IPv6 e IPv4 embutido são recusados; públicos passam', () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.10', '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1',
    '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.1.2.3', 'não-é-ip']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.0.1', '172.32.0.1', '2606:4700:4700::1111']) assert.equal(isPrivateAddress(ip), false, ip);
});

test('checkRemoteUrl: só https, sem senha, sem localhost nem IP interno escrito direto', () => {
  assert.equal(checkRemoteUrl('https://exemplo.com/a.png').hostname, 'exemplo.com');
  for (const bad of ['http://exemplo.com/a.png', 'ftp://x.com/a', 'file:///etc/passwd', 'https://user:pass@exemplo.com/a.png', 'https://localhost/a.png',
    'https://127.0.0.1/a.png', 'https://[::1]/a.png', 'https://192.168.0.1/a.png', 'https://169.254.169.254/latest/meta-data/', 'https://servico.internal/a.png', 'https://x.local/a', 'nao e url']) {
    assert.throws(() => checkRemoteUrl(bad), undefined, bad);
  }
});

const respond = (status: number, body: Uint8Array | null, headers: Record<string, string> = {}) => ({
  status, ok: status >= 200 && status < 300, headers: new Headers(headers),
  body: body ? new Response(body).body : null,
});

test('fetchRemoteImage: devolve os bytes; segue redirecionamento conferindo cada passo; recusa redirecionar para rede interna', async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const seen: string[] = [];
  const impl = async (url: URL) => {
    seen.push(String(url));
    if (url.hostname === 'a.exemplo.com') return respond(302, null, { location: 'https://b.exemplo.com/final.png' });
    if (url.hostname === 'b.exemplo.com') return respond(200, bytes, { 'content-type': 'image/png; charset=x' });
    throw new Error('não devia chegar aqui');
  };
  const ok = await fetchRemoteImage('https://a.exemplo.com/x', { fetchImpl: impl as any, agent: undefined });
  assert.deepEqual([...ok.bytes], [1, 2, 3, 4]);
  assert.equal(ok.contentType, 'image/png');
  assert.deepEqual(seen, ['https://a.exemplo.com/x', 'https://b.exemplo.com/final.png']);

  const evil = async () => respond(302, null, { location: 'https://169.254.169.254/latest/meta-data/' });
  await assert.rejects(fetchRemoteImage('https://a.exemplo.com/x', { fetchImpl: evil as any, agent: undefined }), /rede interna/);
  const loop = async () => respond(302, null, { location: 'https://a.exemplo.com/outra' });
  await assert.rejects(fetchRemoteImage('https://a.exemplo.com/x', { fetchImpl: loop as any, agent: undefined }), /redirecionado vezes demais/);
});

test('fetchRemoteImage: erro HTTP e imagem enorme viram mensagens claras', async () => {
  await assert.rejects(fetchRemoteImage('https://a.exemplo.com/x', { fetchImpl: (async () => respond(404, null)) as any, agent: undefined }), /respondeu 404/);
  const huge = async () => respond(200, new Uint8Array(16), { 'content-length': String(40 * 1024 * 1024) });
  await assert.rejects(fetchRemoteImage('https://a.exemplo.com/x', { fetchImpl: huge as any, agent: undefined }), /grande demais/);
  await assert.rejects(fetchRemoteImage('http://a.exemplo.com/x'), /https/);
});

test('com o agente protegido de verdade: nome que resolve para a máquina local é barrado na conexão', async () => {
  // "localhost" já é recusado pelo checkRemoteUrl; aqui forçamos um host que passa na checagem de texto mas resolve para loopback
  await assert.rejects(fetchRemoteImage('https://127.0.0.1.nip.io/x.png'), (err: any) => /rede interna|Não consegui baixar/.test(err.message));
});
