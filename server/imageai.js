/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  server/imageai.js — EDIÇÃO GENERATIVA DE FOTO (preencher área, expandir, trocar objeto, gerar)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  O editor de imagem (src/ui/imageai.js) faz as edições LOCAIS sozinho, no navegador. As GENERATIVAS precisam de um
 *  modelo de imagem: o navegador manda a imagem (e a máscara) para cá, e ESTE arquivo fala com a API de imagens
 *  compatível com a OpenAI usando a chave guardada no servidor (config.agent.keys[endereço]). A chave nunca vai ao
 *  navegador.
 *
 *    POST {endereço}/images/edits        multipart: model, prompt, image (PNG), mask (PNG), size, n
 *    POST {endereço}/images/generations  JSON: model, prompt, size, n
 *
 *  Qual endereço/modelo: o de Configurações → Agente de IA e modelos → Modelo de imagem (config.imageai) ou, sem
 *  escolha, o do provedor do Agente — se ele tiver API de imagem (a OpenAI tem; NVIDIA NIM e Ollama não).
 *
 *  Rotas (ligadas em server.js → api(), que já confere Host, Origin e Content-Type JSON):
 *    GET  /api/imageai/config   → { available, reason, baseUrl, model, provider, hasKey, custom, maxMB, timeoutSec }
 *    PUT  /api/imageai/config   { baseUrl?, model?, apiKey? } → grava ("" volta ao padrão / apaga a chave)
 *    POST /api/imageai/edit     { image, mask?, prompt, size? } → { image } (data URLs PNG)
 *    POST /api/imageai/generate { prompt, size? } → { image }
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { PROVIDERS, providerOf, isLocalUrl } from '../src/agent/providers.js';
import { buildMultipart, parseDataUrl } from '../src/imagefx.js';

/** Modelo de imagem padrão por provedor (provedor fora da lista = sem API de imagem até alguém escolher um modelo). */
export const IMAGE_MODELS = { openai: 'gpt-image-1' };
/** Limite do pedido inteiro (imagem + máscara em base64) e de cada imagem decodificada. */
const MAX_REQUEST = 30 * 1024 * 1024;
const MAX_IMAGE = 12 * 1024 * 1024;
/** Tamanhos aceitos (os da API da OpenAI). */
const SIZES = ['1024x1024', '512x512', '256x256', '1536x1024', '1024x1536', 'auto'];

/** Erro com status e mensagem para a tela (o mesmo formato do server.js: expose = pode mostrar). */
const fail = (status, message, code = 'error') => Object.assign(new Error(message), { status, expose: true, code });

/**
 * Endereço, modelo e chave do modelo de imagem a partir da configuração do servidor.
 * @param {object} config  configuração inteira (designer.config.json)
 * @param {object} [env]   variáveis de ambiente (testes passam outras)
 */
export function imageConfigOf(config = {}, env = process.env) {
  const def = PROVIDERS[0];
  const agentBase = String(config.agent?.baseUrl || def.baseUrl).replace(/\/+$/, '');
  const custom = !!config.imageai?.baseUrl;
  const baseUrl = String(config.imageai?.baseUrl || agentBase).replace(/\/+$/, '');
  const provider = providerOf(baseUrl);
  const model = String(config.imageai?.model || IMAGE_MODELS[provider?.id] || '');
  const legacy = baseUrl === def.baseUrl ? config.agent?.apiKey : '';
  const apiKey = config.agent?.keys?.[baseUrl] || legacy || (provider?.envKey && env[provider.envKey]) || '';
  const local = isLocalUrl(baseUrl);
  const name = provider?.name || baseUrl;
  const timeoutSec = Math.max(10, Math.min(600, Math.round(Number(config.imageai?.timeoutSec) || 120)));
  let reason = '';
  if (!model) reason = `O provedor atual (${name}) não tem API de imagem. Escolha um endereço e um modelo de imagem em Configurações → Agente de IA e modelos → Modelo de imagem (ex.: OpenAI, gpt-image-1).`;
  else if (!apiKey && !local) reason = `Falta a chave de ${name} para o modelo de imagem. Coloque em Configurações → Agente de IA e modelos → Modelo de imagem.`;
  return { baseUrl, model, apiKey, provider, providerName: name, custom, local, timeoutSec, available: !reason, reason };
}

/** Texto claro para um erro HTTP da API de imagens. */
export function apiErrorText(status, detail, { baseUrl = '', model = '' } = {}) {
  const d = String(detail || '').slice(0, 300);
  if (status === 401 || status === 403) return `A API de imagem recusou a chave${d ? ` (${d})` : ''}. Confira em Configurações → Agente de IA e modelos → Modelo de imagem.`;
  if (status === 404) return `${baseUrl} não tem a API de imagens ou o modelo “${model}” não existe nesta conta${d ? ` (${d})` : ''}. Escolha outro em Configurações → Modelo de imagem.`;
  if (status === 413) return 'A imagem é grande demais para a API. Diminua em “Tamanho” e tente de novo.';
  if (status === 429) return `A API de imagem recusou por limite de uso ou créditos${d ? `: ${d}` : ''}. Espere um pouco ou confira a conta.`;
  if (status >= 500) return `A API de imagem falhou do lado dela (${status})${d ? `: ${d}` : ''}. Tente de novo em instantes.`;
  return `A API de imagem recusou o pedido (${status})${d ? `: ${d}` : ''}.`;
}

/**
 * Lê a resposta da API ({ data: [{ b64_json } | { url }] }) e devolve um data URL. Se vier só a URL, baixa a imagem
 * (com tempo e tamanho limitados).
 */
export async function readImageResult(json, { timeoutMs = 60000, fetchImpl = fetch } = {}) {
  const item = Array.isArray(json?.data) ? json.data[0] : null;
  if (item?.b64_json) return `data:image/png;base64,${String(item.b64_json).replace(/\s+/g, '')}`;
  if (item?.url && /^https?:\/\//i.test(item.url)) {
    let r;
    try { r = await fetchImpl(item.url, { signal: AbortSignal.timeout(timeoutMs) }); } catch (err) {
      throw fail(502, `A API gerou a imagem, mas não consegui baixá-la (${err.cause?.code || err.message}).`);
    }
    const type = (r.headers.get('content-type') || '').split(';')[0].trim();
    if (!r.ok || !/^image\/(png|jpeg|webp)$/.test(type)) throw fail(502, `A API gerou a imagem, mas o download falhou (${r.status} ${type || 'sem tipo'}).`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_IMAGE) throw fail(502, 'A imagem gerada é grande demais.');
    return `data:${type};base64,${buf.toString('base64')}`;
  }
  throw fail(502, 'A API de imagem respondeu sem imagem. Confira se o modelo escolhido gera imagens.');
}

/** Lê o corpo JSON com limite próprio (imagens em base64 são grandes, mas não tanto). */
async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_REQUEST) throw fail(413, `Imagem grande demais para a edição generativa (limite ${MAX_REQUEST / 1024 / 1024} MB por pedido). Diminua a imagem antes.`);
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw fail(400, 'JSON inválido.'); }
}

/** Data URL de imagem → bytes (com limite e só PNG/JPEG/WebP). */
function imageBytes(url, label) {
  const p = parseDataUrl(url);
  if (!p || p.type === 'image/gif') throw fail(400, `${label}: mande um data URL de imagem PNG, JPEG ou WebP.`);
  const buf = Buffer.from(p.b64, 'base64');
  if (!buf.length) throw fail(400, `${label}: imagem vazia.`);
  if (buf.length > MAX_IMAGE) throw fail(413, `${label}: imagem grande demais (limite ${MAX_IMAGE / 1024 / 1024} MB).`);
  return { buf, type: p.type };
}

/** Texto do pedido (prompt): obrigatório, até 1000 caracteres. */
function promptOf(v) {
  const p = String(v ?? '').trim();
  if (!p) throw fail(400, 'Descreva o que a IA deve fazer (o campo do pedido está vazio).');
  return p.slice(0, 1000);
}

/** Chama a API de imagens com tempo limite e transforma qualquer falha numa mensagem clara. */
async function callApi(ic, path, init) {
  let r;
  try {
    r = await fetch(`${ic.baseUrl}${path}`, { ...init, headers: { ...(ic.apiKey ? { Authorization: `Bearer ${ic.apiKey}` } : {}), ...init.headers }, signal: AbortSignal.timeout(ic.timeoutSec * 1000) });
  } catch (err) {
    if (err.name === 'TimeoutError') throw fail(504, `A API de imagem não respondeu em ${ic.timeoutSec} s. Tente de novo (imagens grandes demoram mais).`, 'timeout');
    throw fail(502, `Não consegui falar com ${ic.baseUrl} (${err.cause?.code || err.message}). Confira a internet e o endereço em Configurações.`, 'network');
  }
  const raw = await r.text().catch(() => '');
  let json = null;
  try { json = JSON.parse(raw); } catch { /* texto puro */ }
  if (!r.ok) {
    const detail = json?.error?.message || json?.detail || json?.message || raw.slice(0, 300);
    throw fail(r.status === 401 || r.status === 403 ? 401 : r.status === 404 ? 404 : r.status === 429 ? 429 : 502, apiErrorText(r.status, detail, ic), 'http');
  }
  if (!json) throw fail(502, 'A API de imagem respondeu algo que não é JSON.');
  return readImageResult(json, { timeoutMs: ic.timeoutSec * 1000 });
}

/** Tamanho pedido (só os aceitos); dall-e-2 só faz quadrado. */
const sizeOf = (s, model) => {
  const v = SIZES.includes(s) ? s : '1024x1024';
  return /^dall-e-2/.test(model) && !/^(1024|512|256)x\1$/.test(v) ? '1024x1024' : v;
};

/**
 * Cria o tratador das rotas /api/imageai/...
 * @param {{ getConfig: () => object, saveConfig: (next: object) => Promise<void> }} deps
 */
export function createImageAi({ getConfig, saveConfig }) {
  const send = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  const publicInfo = () => {
    const ic = imageConfigOf(getConfig());
    return {
      available: ic.available, reason: ic.reason, baseUrl: ic.baseUrl, model: ic.model, provider: ic.provider?.id || 'custom',
      providerName: ic.providerName, hasKey: !!ic.apiKey, custom: ic.custom, local: ic.local, maxMB: MAX_IMAGE / 1024 / 1024, timeoutSec: ic.timeoutSec,
    };
  };

  return async function handle(req, res, parts) {
    const [what] = parts;
    if (what === 'config' && req.method === 'GET') return send(res, 200, publicInfo());
    if (what === 'config' && req.method === 'PUT') {
      const body = await readJson(req);
      const config = getConfig();
      const img = { ...(config.imageai || {}) };
      if (body.baseUrl !== undefined) {
        const u = String(body.baseUrl).trim().replace(/\/+$/, '');
        if (u && !/^https?:\/\/[^\s]+$/i.test(u)) throw fail(400, 'Endereço inválido: use algo como https://api.openai.com/v1.');
        if (u) img.baseUrl = u.slice(0, 300); else delete img.baseUrl;
      }
      if (body.model !== undefined) {
        const m = String(body.model).trim();
        if (m && !/^[\w.:/@+-]{1,120}$/.test(m)) throw fail(400, 'Nome de modelo inválido.');
        if (m) img.model = m; else delete img.model;
      }
      if (body.timeoutSec !== undefined) { const t = Number(body.timeoutSec); if (Number.isFinite(t) && t > 0) img.timeoutSec = t; else delete img.timeoutSec; }
      const next = { ...config, imageai: img };
      if (!Object.keys(img).length) delete next.imageai;
      // a chave vale para o endereço de imagem escolhido; fica no mesmo lugar das chaves do Agente (uma por endereço)
      if (body.apiKey !== undefined) {
        const url = imageConfigOf(next).baseUrl;
        const keys = { ...(config.agent?.keys || {}) };
        const k = String(body.apiKey).trim();
        if (k) keys[url] = k.slice(0, 400); else delete keys[url];
        next.agent = { ...(config.agent || {}), keys };
        if (!Object.keys(keys).length) delete next.agent.keys;
      }
      await saveConfig(next);
      return send(res, 200, { ok: true, ...publicInfo() });
    }
    if ((what === 'edit' || what === 'generate') && req.method === 'POST') {
      const body = await readJson(req);
      const ic = imageConfigOf(getConfig());
      if (!ic.available) throw fail(400, ic.reason, 'unavailable');
      const prompt = promptOf(body.prompt);
      const size = sizeOf(body.size, ic.model);
      const t0 = Date.now();
      let image;
      if (what === 'generate') {
        image = await callApi(ic, '/images/generations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: ic.model, prompt, size, n: 1, ...(/^dall-e/.test(ic.model) ? { response_format: 'b64_json' } : {}) }),
        });
      } else {
        const img = imageBytes(body.image, 'Imagem');
        const mask = body.mask ? imageBytes(body.mask, 'Máscara') : null;
        const ext = img.type.split('/')[1].replace('jpeg', 'jpg');
        const mp = buildMultipart([
          { name: 'model', value: ic.model },
          { name: 'prompt', value: prompt },
          { name: 'n', value: '1' },
          { name: 'size', value: size },
          /^dall-e/.test(ic.model) ? { name: 'response_format', value: 'b64_json' } : null,
          { name: 'image', data: img.buf, filename: `imagem.${ext}`, type: img.type },
          mask ? { name: 'mask', data: mask.buf, filename: 'mascara.png', type: 'image/png' } : null,
        ]);
        image = await callApi(ic, '/images/edits', { method: 'POST', headers: { 'Content-Type': mp.contentType }, body: mp.body });
      }
      return send(res, 200, { image, model: ic.model, ms: Date.now() - t0 });
    }
    throw fail(404, 'Rota não encontrada.');
  };
}
