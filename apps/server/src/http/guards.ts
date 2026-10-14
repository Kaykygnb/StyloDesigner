/**
 * http/guards.ts — PROTEÇÕES DE ENTRADA (Host, Origin, tipo do corpo, tamanho, erros)
 *
 * O servidor escreve no disco e no banco, então só aceita pedidos feitos para a máquina/rede privada:
 *   - Host precisa ser localhost ou IPv4 privado (bloqueia DNS rebinding e hosts públicos);
 *   - pedidos que ESCREVEM exigem JSON e, se vierem de uma página, Origin = este servidor (mesma porta);
 *   - corpo com limite por rota; erros internos nunca vazam detalhes.
 */

import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { httpError } from '../http-error.js';

export const MAX_JSON = 1024 * 1024; // configuração, conta, renomear etc.
export const MAX_MEDIUM = 32 * 1024 * 1024; // miniaturas, MCP (imagens em ferramentas)
export const MAX_PROJECT = 200 * 1024 * 1024; // um projeto com imagens embutidas

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
const PRIVATE_IPV4 = /^(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3})\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3})\.\d{1,3})(?::\d+)?$/;
export const isLocalHost = (host = '') => {
  if (LOCAL_HOST.test(host)) return true;
  const address = host.replace(/:\d+$/, '');
  if (!PRIVATE_IPV4.test(host)) return false;
  return address.split('.').every((part) => Number(part) >= 0 && Number(part) <= 255);
};

/** Origens aceitas: a própria página deste servidor (mesma porta). Sem Origin (curl, MCP stdio, testes) também vale. */
export const ownOrigins = (port: number) => [`http://localhost:${port}`, `http://127.0.0.1:${port}`, `http://[::1]:${port}`];

const isWrite = (method: string) => method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';

/** Host local obrigatório; em escritas, Origin próprio. */
export function localOnly(port: number, { requireJson = false, originAlways = false } = {}): MiddlewareHandler {
  const origins = ownOrigins(port);
  return async (c, next) => {
    if (!isLocalHost(c.req.header('host'))) throw httpError(403, 'Acesso negado.');
    if (originAlways || isWrite(c.req.method)) {
      const origin = c.req.header('origin');
      if (origin) {
        const parsed = (() => { try { return new URL(origin); } catch { return null; } })();
        const requestHost = c.req.header('host') || '';
        const sameHost = parsed && parsed.protocol === 'http:' && parsed.host.toLowerCase() === requestHost.toLowerCase();
        if (!origins.includes(origin.toLowerCase()) && !sameHost) throw httpError(403, 'Acesso negado.');
      }
    }
    if (requireJson && isWrite(c.req.method) && !/^application\/json\b/i.test(c.req.header('content-type') || '')) throw httpError(415, 'Envie JSON.');
    await next();
  };
}

/** Limite de tamanho do corpo para a rota (413 com mensagem em português). */
export const limit = (maxSize: number) => bodyLimit({
  maxSize,
  onError: () => { throw httpError(413, `Conteúdo grande demais (limite ${Math.round(maxSize / 1048576)} MB para esta rota).`); },
});

/** Lê o corpo como JSON e exige um OBJETO (null, lista ou texto solto viram 400 em vez de TypeError lá na frente). */
export async function readObject(c: Context): Promise<Record<string, any>> {
  let value: unknown;
  try { value = JSON.parse((await c.req.text()) || '{}'); } catch { throw httpError(400, 'JSON inválido.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, 'Envie um objeto JSON.');
  return value as Record<string, any>;
}

/** Resposta de erro: mensagem própria (httpError) sai como está; o resto vira texto genérico e vai para o log. */
export function errorHandler(err: any, c: Context) {
  // corpo grande demais: o cliente ainda está enviando; fechar a conexão evita reaproveitar um socket com bytes sobrando
  if (err?.status === 413) c.header('Connection', 'close');
  if (err?.expose) return c.json({ error: err.message }, err.status);
  const notFound = err && (err.code === 'ENOENT' || err.code === 'ENOTDIR' || err instanceof URIError);
  if (err instanceof SyntaxError) return c.json({ error: 'JSON inválido.' }, 400);
  if (!notFound) console.error(err);
  const denied = err?.code === 'EACCES' || err?.code === 'EPERM' || err?.code === 'EROFS';
  const msg = notFound ? 'Não encontrado.' : denied ? 'Sem permissão para usar esta pasta.' : 'Erro interno. Veja o terminal do servidor para o detalhe.';
  return c.json({ error: msg }, notFound ? 404 : denied ? 403 : 500);
}
