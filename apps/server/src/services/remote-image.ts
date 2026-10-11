/**
 * services/remote-image.ts — BAIXAR UMA IMAGEM POR ENDEREÇO, COM PROTEÇÃO CONTRA SSRF
 *
 * Um agente pode pedir `add_asset { source_url }`. Sem cuidado, isso deixaria qualquer um fazer o servidor acessar a rede
 * interna (127.0.0.1, 10.x, 192.168.x, o serviço de metadados da nuvem 169.254.169.254...). Por isso:
 *   - só https;
 *   - o endereço IP é conferido NA HORA DE CONECTAR (hook `lookup` do undici): não adianta um DNS que muda de resposta
 *     entre a conferência e a conexão;
 *   - IP privado, de loopback, link-local ou reservado é recusado (IPv4 e IPv6, inclusive IPv4 embutido em IPv6);
 *   - no máximo 3 redirecionamentos, cada um conferido de novo; tempo limite de 12 s; tamanho máximo lido em fluxo.
 */

import { lookup as dnsLookup } from 'node:dns';
import { isIP } from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';
import { MAX_ASSET_BYTES } from './assets.js';

const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;

/** O IP é de uso interno/reservado (nunca deve ser alcançado por um pedido de agente)? */
export function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '').split('%')[0];
  const kind = isIP(ip);
  if (kind === 4) {
    const [a, b, c] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0 && c === 0) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  if (kind === 6) {
    const v = ip.toLowerCase();
    if (v === '::' || v === '::1') return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v); // IPv4 embutido
    if (mapped) return isPrivateAddress(mapped[1]);
    const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16), lo = parseInt(mappedHex[2], 16);
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('ff'); // fc00::/7, fe80::/10, multicast
  }
  return true; // não é um IP válido: recusa
}

/** Valida o endereço (https, sem usuário/senha, host que não é IP privado escrito direto). */
export function checkRemoteUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Endereço de imagem inválido.'); }
  if (url.protocol !== 'https:') throw new Error('Só endereços https são aceitos.');
  if (url.username || url.password) throw new Error('O endereço não pode ter usuário e senha.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && isPrivateAddress(host)) throw new Error('Este endereço aponta para a rede interna e não é permitido.');
  if (/^localhost$/i.test(host) || /\.(local|internal|localhost)$/i.test(host)) throw new Error('Este endereço aponta para a rede interna e não é permitido.');
  return url;
}

/** Agente HTTP cuja resolução de nomes recusa endereços internos (confere no momento de conectar). */
const guardedAgent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      dnsLookup(hostname, { ...(options as object), all: true }, (err, addresses: any) => {
        if (err) return callback(err, '', 0);
        const list = Array.isArray(addresses) ? addresses : [addresses];
        if (!list.length || list.some((a: any) => isPrivateAddress(a.address))) return callback(new Error('Este endereço aponta para a rede interna e não é permitido.'), '', 0);
        return callback(null, list);
      });
    },
  },
});

export interface RemoteImage { bytes: Uint8Array; contentType: string }

/** Baixa a imagem (https público). Lança Error com mensagem em português. */
export async function fetchRemoteImage(value: string, { fetchImpl = undiciFetch as any, agent = guardedAgent as any } = {}): Promise<RemoteImage> {
  let url = checkRemoteUrl(value);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: any;
    try {
      res = await fetchImpl(url, { dispatcher: agent, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'image/*' } });
    } catch (err: any) {
      const cause = err?.cause?.message || err?.message || String(err);
      throw new Error(err?.name === 'TimeoutError' ? 'O servidor da imagem demorou demais.' : `Não consegui baixar a imagem (${cause}).`);
    }
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location || hop === MAX_REDIRECTS) throw new Error('A imagem foi redirecionada vezes demais.');
      url = checkRemoteUrl(new URL(location, url).href);
      continue;
    }
    if (!res.ok) throw new Error(`O servidor da imagem respondeu ${res.status}.`);
    const declared = Number(res.headers.get('content-length'));
    if (declared > MAX_ASSET_BYTES) throw new Error('A imagem é grande demais (limite 16 MB).');
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      size += chunk.byteLength;
      if (size > MAX_ASSET_BYTES) { await reader.cancel(); throw new Error('A imagem é grande demais (limite 16 MB).'); }
      chunks.push(chunk);
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) { bytes.set(c, at); at += c.byteLength; }
    return { bytes, contentType: String(res.headers.get('content-type') || '').split(';')[0] };
  }
  throw new Error('A imagem foi redirecionada vezes demais.');
}
