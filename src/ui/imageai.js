/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/imageai.js — IA DE FOTO: o EDITOR DE IMAGEM (painel grande) e as edições usadas pelo agente
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Modelo HÍBRIDO:
 *   - EDIÇÕES LOCAIS, no navegador e sem chave: recortar (livre, 1:1, 4:3, 16:9, 3:2), girar e espelhar; ajustes
 *     (brilho, contraste, saturação, exposição, temperatura, nitidez, desfoque); filtros prontos com miniatura;
 *     REMOVER FUNDO (automático pelas bordas, varinha mágica e pincel de apagar/restaurar); tamanho e compressão
 *     (largura máxima, formato WebP/PNG/JPEG, qualidade, mostrando o tamanho final). A matemática está em ../imagefx.js.
 *   - EDIÇÃO GENERATIVA, pelo servidor (server/imageai.js, com a chave guardada lá): preencher uma área pintada,
 *     expandir para os lados e trocar objeto/gerar variação.
 *
 *  O editor tem o PRÓPRIO desfazer (Ctrl+Z dentro dele). "Aplicar" grava uma imagem NOVA em doc.assets, troca a
 *  imagem da camada (guardando a original em fill.origAssetId, para "Restaurar original") e vira UM passo do Ctrl+Z
 *  do documento.
 *
 *  O agente usa as mesmas funções sem abrir o painel: editImageLocal (ferramenta edit_image) e generativeEdit
 *  (ferramenta generate_image_edit), ver agent/runner.js.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { ask } from './menus.js';
import { uid } from '../model.js';
import {
  ADJ_DEFAULTS, ADJ_FIELDS, FILTERS, CROP_RATIOS, normalizeAdj, isNeutral, renderPixels,
  magicWand, autoBackground, combineSelection, paintStroke, resizeMask, maskCoverage,
  cropForRatio, clampCrop, fitWidth, formatBytes, planGenerative,
} from '../imagefx.js';

// ---------------------------------------------------------------- canvas: utilidades
/** Canvas novo w × h. */
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
/** Contexto 2D (com leitura frequente: getImageData é usado o tempo todo aqui). */
const ctx2d = (c) => c.getContext('2d', { willReadFrequently: true });
/** Carrega uma imagem (data URL) e espera ela estar pronta. */
export function loadImage(src) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error('Não consegui ler a imagem.'));
    img.src = src;
  });
}
/** Imagem → canvas do mesmo tamanho. */
function toCanvas(img) {
  const c = canvasOf(img.naturalWidth || img.width, img.naturalHeight || img.height);
  ctx2d(c).drawImage(img, 0, 0);
  return c;
}
/** Pixels (ImageData) do canvas inteiro. */
const pixelsOf = (c) => ctx2d(c).getImageData(0, 0, c.width, c.height);
/** Canvas a partir de um array RGBA. */
function fromPixels(data, w, h) {
  const c = canvasOf(w, h);
  ctx2d(c).putImageData(new ImageData(data, w, h), 0, 0);
  return c;
}
/** Redimensiona com boa qualidade (reduções grandes em etapas de metade, para não serrilhar). */
function resized(src, w, h) {
  let cur = src;
  while (cur.width / 2 >= w && cur.height / 2 >= h) {
    const half = canvasOf(cur.width / 2, cur.height / 2);
    const cx = ctx2d(half); cx.imageSmoothingQuality = 'high'; cx.drawImage(cur, 0, 0, half.width, half.height);
    cur = half;
  }
  const out = canvasOf(w, h);
  const cx = ctx2d(out); cx.imageSmoothingQuality = 'high'; cx.drawImage(cur, 0, 0, w, h);
  return out;
}
/** Gira 90° (sentido horário com dir=1, anti-horário com -1) ou 180°. */
function rotated(src, deg) {
  const d = ((deg % 360) + 360) % 360;
  const swap = d === 90 || d === 270;
  const out = canvasOf(swap ? src.height : src.width, swap ? src.width : src.height);
  const cx = ctx2d(out);
  cx.translate(out.width / 2, out.height / 2);
  cx.rotate((d * Math.PI) / 180);
  cx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}
/** Espelha na horizontal ('h') ou vertical ('v'). */
function flipped(src, axis) {
  const out = canvasOf(src.width, src.height);
  const cx = ctx2d(out);
  if (axis === 'h') { cx.translate(out.width, 0); cx.scale(-1, 1); } else { cx.translate(0, out.height); cx.scale(1, -1); }
  cx.drawImage(src, 0, 0);
  return out;
}
/** Recorta um retângulo. */
function cropped(src, r) {
  const out = canvasOf(r.w, r.h);
  ctx2d(out).drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  return out;
}
/** Tipo MIME de um data URL. */
const mimeOf = (url) => (/^data:([^;,]+)/.exec(String(url || ''))?.[1] || 'image/png');
/** Formato de saída → MIME. */
const FORMAT_MIME = { webp: 'image/webp', png: 'image/png', jpeg: 'image/jpeg' };
/** A imagem tem algum pixel não opaco? */
function hasAlpha(c) {
  const d = pixelsOf(c).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
  return false;
}
/**
 * Codifica o canvas no formato pedido. JPEG não tem transparência: o fundo vira branco. Devolve o data URL, os bytes
 * e o formato que o navegador realmente gerou (se ele não souber WebP, cai para PNG).
 */
export async function encodeCanvas(c, format = 'png', quality = 0.9) {
  let src = c;
  if (format === 'jpeg') {
    src = canvasOf(c.width, c.height);
    const cx = ctx2d(src); cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, src.width, src.height); cx.drawImage(c, 0, 0);
  }
  const mime = FORMAT_MIME[format] || 'image/png';
  const blob = await new Promise((ok) => src.toBlob(ok, mime, format === 'png' ? undefined : quality));
  if (!blob) throw new Error('O navegador não conseguiu gerar a imagem.');
  const dataUrl = await new Promise((ok, fail) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = fail; fr.readAsDataURL(blob); });
  return { dataUrl, bytes: blob.size, mime: blob.type || mime };
}

/** Desenha a máscara (0..255, 255 = mantém) num canvas cujo ALFA é a máscara (para usar com drawImage/composição). */
function maskCanvas(mask, w, h, invert = false) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) d[p * 4 + 3] = invert ? 255 - mask[p] : mask[p];
  return fromPixels(d, w, h);
}

// ---------------------------------------------------------------- documento: gravar e restaurar
/** A camada tem imagem de preenchimento (com o arquivo presente)? */
export function imageNodeOf(store, id) {
  const n = id && store.get(id);
  return n && n.fill?.type === 'image' && n.fill.assetId && store.state.doc.assets?.[n.fill.assetId] ? n : null;
}

/**
 * Grava a imagem nova como ARQUIVO NOVO em doc.assets e troca a imagem da camada. A original fica guardada em
 * fill.origAssetId (só a primeira: editar de novo não perde a original). Com `commit` (padrão) vira um passo do Ctrl+Z.
 */
export function applyImageToNode(store, id, { dataUrl, w, h }, { commit = true } = {}) {
  const n = store.get(id);
  if (!n) throw new Error('A camada não existe mais.');
  const assetId = uid();
  store.addAsset(assetId, dataUrl);
  store.update(() => {
    // a original só vale enquanto a imagem da camada for a que o editor gravou (trocou a imagem por fora = nova original)
    if (!hasOriginal(n)) n.fill.origAssetId = n.fill.assetId;
    n.fill.assetId = assetId;
    n.fill.editedAssetId = assetId;
    n.fill.natW = w; n.fill.natH = h;
  }, { structural: false });
  if (commit) store.commit();
  return assetId;
}

/** A camada tem uma imagem original guardada (e a imagem atual é uma edição dela)? */
export const hasOriginal = (n) => !!(n?.fill?.origAssetId && n.fill.assetId === n.fill.editedAssetId);

/** Volta para a imagem original (antes de qualquer edição). Devolve false se não houver original guardada. */
export async function restoreOriginal(store, id, { commit = true } = {}) {
  const n = store.get(id);
  const orig = hasOriginal(n) && n.fill.origAssetId;
  const src = orig && store.state.doc.assets?.[orig];
  if (!src) return false;
  const img = await loadImage(src);
  store.update(() => {
    n.fill.assetId = orig;
    delete n.fill.origAssetId;
    delete n.fill.editedAssetId;
    n.fill.natW = img.naturalWidth; n.fill.natH = img.naturalHeight;
  }, { structural: false });
  if (commit) store.commit();
  return true;
}

// ---------------------------------------------------------------- edições sem tela (agente)
/**
 * EDIÇÃO LOCAL em lote (ferramenta edit_image do agente). Ordem: girar/espelhar → recortar → remover fundo →
 * filtro → ajustes → largura máxima → codificar.
 * @param {string} src  data URL da imagem
 * @param {object} ops  { rotate: 90|180|270|-90, flip_h, flip_v, crop: {x,y,w,h} (px) | ratio: '1:1'|'4:3'|'16:9'|'3:2',
 *                        remove_background: true | {tolerance, feather}, filter, adjust: {...}, max_width, format, quality }
 * @returns {Promise<{dataUrl:string, w:number, h:number, bytes:number, removed?:number}>}
 */
export async function editImageLocal(src, ops = {}) {
  let c = toCanvas(await loadImage(src));
  const rot = Number(ops.rotate) || 0;
  if (rot % 90) throw new Error('rotate: use 90, 180, 270 ou -90.');
  if (rot) c = rotated(c, rot);
  if (ops.flip_h) c = flipped(c, 'h');
  if (ops.flip_v) c = flipped(c, 'v');
  if (ops.ratio) {
    const r = CROP_RATIOS.find(([label]) => label === ops.ratio);
    if (!r) throw new Error(`ratio: use ${CROP_RATIOS.filter(([, v]) => v).map(([l]) => l).join(', ')}.`);
    c = cropped(c, cropForRatio(c.width, c.height, r[1]));
  } else if (ops.crop) {
    const r = clampCrop({ x: +ops.crop.x || 0, y: +ops.crop.y || 0, w: +ops.crop.w || c.width, h: +ops.crop.h || c.height }, c.width, c.height);
    c = cropped(c, r);
  }
  let mask = null, removed;
  if (ops.remove_background) {
    const o = typeof ops.remove_background === 'object' ? ops.remove_background : {};
    const px = pixelsOf(c);
    const res = autoBackground(px.data, c.width, c.height, { tolerance: o.tolerance ?? 28, feather: o.feather ?? 1 });
    mask = res.mask;
    removed = Math.round(maskCoverage(mask) * 100);
  }
  if (ops.filter && !FILTERS.some((f) => f.id === ops.filter)) throw new Error(`filter: use ${FILTERS.map((f) => f.id).join(', ')}.`);
  const adj = ops.adjust ? normalizeAdj(ops.adjust) : null;
  if (mask || (ops.filter && ops.filter !== 'none') || (adj && !isNeutral(adj))) {
    c = fromPixels(renderPixels(pixelsOf(c).data, c.width, c.height, { filter: ops.filter, adj, mask }), c.width, c.height);
  }
  const fit = fitWidth(c.width, c.height, ops.max_width);
  if (fit.w !== c.width) c = resized(c, fit.w, fit.h);
  const fmt = FORMAT_MIME[ops.format] ? ops.format : mask || mimeOf(src) === 'image/png' ? 'png' : mimeOf(src) === 'image/webp' ? 'webp' : 'jpeg';
  const q = Math.max(0.3, Math.min(1, Number(ops.quality) || 0.9));
  const enc = await encodeCanvas(c, fmt, q);
  return { dataUrl: enc.dataUrl, w: c.width, h: c.height, bytes: enc.bytes, ...(removed !== undefined ? { removed } : {}) };
}

/** Configuração do modelo de imagem do servidor ({ available, reason, model, ... }) ou null sem servidor. */
export async function imageAiConfig() {
  try {
    const r = await fetch('/api/imageai/config');
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

/** POST na API de imagem do servidor; erro com a mensagem que o servidor mandou. */
async function postImageAi(path, body, signal) {
  let r;
  try {
    r = await fetch(`/api/imageai/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Sem servidor: a edição generativa precisa do npm start.');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.image) throw new Error(data.error || `O servidor respondeu ${r.status}.`);
  return data.image;
}

/**
 * EDIÇÃO GENERATIVA (servidor + modelo de imagem). Monta o quadrado que a API espera (planGenerative), a máscara
 * (transparente = a IA pode mudar), manda, recorta a resposta de volta e cola a imagem original por cima do que
 * não era para mudar (assim o resto fica idêntico, sem perder nitidez).
 * @param {object} o
 * @param {string} o.src  data URL da imagem atual
 * @param {'fill'|'replace'|'variation'|'expand'|'generate'} o.mode
 * @param {string} o.prompt
 * @param {Uint8Array} [o.mask]  área pintada (w×h, >0 = mudar) — editor
 * @param {{x,y,w,h}} [o.area]  área em % da imagem (0..100) — agente
 * @param {{top,right,bottom,left}} [o.expand]  margens em px (modo expand)
 * @param {AbortSignal} [o.signal]
 * @returns {Promise<{dataUrl:string, w:number, h:number}>}
 */
export async function generativeEdit({ src, mode, prompt, mask = null, area = null, expand = null, signal }) {
  const base = toCanvas(await loadImage(src));
  const W = base.width, H = base.height;
  if (mode === 'generate') {
    const img = await loadImage(await postImageAi('generate', { prompt, size: '1024x1024' }, signal));
    // a imagem nova cobre a proporção da camada (como background-size: cover)
    const k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const out = canvasOf(W, H);
    const cx = ctx2d(out); cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, (W - img.naturalWidth * k) / 2, (H - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
    return { dataUrl: out.toDataURL('image/png'), w: W, h: H };
  }
  if (!['fill', 'replace', 'variation', 'expand'].includes(mode)) throw new Error('mode: fill, replace, variation, expand ou generate.');
  // área do agente (% da imagem) → máscara
  if (!mask && area && mode !== 'expand') {
    mask = new Uint8Array(W * H);
    const x0 = Math.max(0, Math.round((area.x / 100) * W)), y0 = Math.max(0, Math.round((area.y / 100) * H));
    const x1 = Math.min(W, x0 + Math.round((area.w / 100) * W)), y1 = Math.min(H, y0 + Math.round((area.h / 100) * H));
    for (let y = y0; y < y1; y++) mask.fill(255, y * W + x0, y * W + x1);
  }
  if ((mode === 'fill' || mode === 'replace') && (!mask || !mask.some((v) => v))) {
    if (mode === 'fill') throw new Error('Pinte a área que a IA deve preencher.');
    mask = null; // trocar sem área = variação da imagem inteira
  }
  if (mode === 'expand' && !['top', 'right', 'bottom', 'left'].some((k) => Number(expand?.[k]) > 0)) throw new Error('Diga quanto expandir de algum lado.');
  const plan = planGenerative({ w: W, h: H, size: 1024, expand: mode === 'expand' ? expand : null });
  const S = plan.size, I = plan.image, O = plan.out;
  // imagem no quadrado
  const sq = canvasOf(S, S);
  const sx = ctx2d(sq); sx.imageSmoothingQuality = 'high';
  sx.drawImage(base, I.x, I.y, I.w, I.h);
  // máscara: opaca = manter; transparente = a IA muda
  const mk = canvasOf(S, S);
  const mx = ctx2d(mk);
  mx.fillStyle = '#000'; mx.fillRect(0, 0, S, S);
  if (mode === 'expand') {
    mx.clearRect(O.x, O.y, O.w, O.h);
    mx.fillRect(I.x + 2, I.y + 2, I.w - 4, I.h - 4); // 2 px de folga: a emenda fica por conta da IA
  } else if (mask) {
    mx.clearRect(I.x, I.y, I.w, I.h);
    mx.drawImage(maskCanvas(mask, W, H, true), I.x, I.y, I.w, I.h);
  } else {
    mx.clearRect(I.x, I.y, I.w, I.h); // variação: a imagem inteira
  }
  const result = await loadImage(await postImageAi('edit', {
    image: sq.toDataURL('image/png'), mask: mk.toDataURL('image/png'), prompt, size: `${S}x${S}`,
  }, signal));
  // recorta a área de saída da resposta (que pode vir em outra escala) e volta ao tamanho real
  const k = result.naturalWidth / S;
  const out = canvasOf(plan.outW, plan.outH);
  const ox = ctx2d(out); ox.imageSmoothingQuality = 'high';
  ox.drawImage(result, O.x * k, O.y * k, O.w * k, O.h * k, 0, 0, plan.outW, plan.outH);
  // o que era para manter volta EXATAMENTE como era (inclusive a transparência de um fundo removido)
  if (mode === 'expand') {
    const left = Math.max(0, Math.round(+expand.left || 0)), top = Math.max(0, Math.round(+expand.top || 0));
    ox.clearRect(left, top, W, H);
    ox.drawImage(base, left, top);
  } else if (mask) {
    // só a área pintada vem da IA (com a borda macia do pincel); o resto é a imagem original
    const edit = canvasOf(W, H);
    const ex = ctx2d(edit);
    ex.drawImage(out, 0, 0);
    ex.globalCompositeOperation = 'destination-in';
    ex.drawImage(maskCanvas(mask, W, H), 0, 0);
    ox.clearRect(0, 0, W, H);
    ox.drawImage(base, 0, 0);
    ox.drawImage(edit, 0, 0);
  }
  return { dataUrl: out.toDataURL('image/png'), w: out.width, h: out.height };
}

// ---------------------------------------------------------------- o editor (painel grande)
/** Ferramentas da barra da esquerda: id, ícone, nome. */
const TOOLS = [
  ['crop', 'crop', 'Recortar'],
  ['adjust', 'sliders', 'Ajustes'],
  ['filters', 'filters', 'Filtros'],
  ['background', 'wand', 'Remover fundo'],
  ['ai', 'sparkle', 'IA generativa'],
  ['size', 'resize', 'Tamanho'],
];
/** Editor aberto agora (só um por vez). */
let current = null;

/**
 * Abre o editor de imagem da camada `nodeId` (precisa ter preenchimento de imagem).
 * @param {object} deps
 * @param {object} deps.store
 * @param {string} deps.nodeId
 * @param {(msg: string) => void} [deps.toast]
 * @param {string} [deps.tool]  ferramenta inicial ('crop', 'adjust', 'filters', 'background', 'ai', 'size')
 */
export async function openImageEditor({ store, nodeId, toast = () => {}, tool = 'adjust' }) {
  if (current) current.close(true);
  const node = imageNodeOf(store, nodeId);
  if (!node) { toast('Esta camada não tem imagem para editar.'); return null; }
  const srcUrl = store.state.doc.assets[node.fill.assetId];
  const srcMime = mimeOf(srcUrl);
  const first = toCanvas(await loadImage(srcUrl));
  const app = document.getElementById('app');
  const returnFocus = document.activeElement;

  // ------------------------------------------------ estado
  // work: a imagem "assada" (recortes, giros, resultados da IA); adj/filter/mask: aplicados por cima, ao vivo
  let st = { work: first, adj: { ...ADJ_DEFAULTS }, filter: 'none', mask: null };
  /** Histórico do editor: cada item é uma foto do estado (canvases não mudam depois de criados: são compartilhados). */
  const hist = { stack: [], i: -1 };
  const snap = (s) => ({ work: s.work, adj: { ...s.adj }, filter: s.filter, mask: s.mask ? new Uint8Array(s.mask) : null });
  /** Fecha uma alteração: entra no desfazer do editor. */
  function commit() {
    hist.stack.length = hist.i + 1;
    hist.stack.push(snap(st));
    if (hist.stack.length > 30) hist.stack.shift();
    hist.i = hist.stack.length - 1;
    syncHeader();
    schedule();
  }
  function undo() { if (hist.i <= 0) return; hist.i--; restore(); }
  function redo() { if (hist.i >= hist.stack.length - 1) return; hist.i++; restore(); }
  function restore() {
    const workChanged = st.work !== hist.stack[hist.i].work;
    st = snap(hist.stack[hist.i]);
    if (workChanged) { crop = null; genMask = null; }
    workResized();
    renderSide();
    syncHeader();
  }
  // saída (Tamanho): largura máxima (0 = a atual), formato e qualidade
  const out = { maxW: 0, format: srcMime === 'image/png' ? 'png' : srcMime === 'image/webp' ? 'webp' : 'jpeg', quality: 0.9, touched: false };
  let active = TOOLS.some((t) => t[0] === tool) ? tool : 'adjust';
  let crop = null; let cropRatio = null; // recorte em andamento (coordenadas da imagem)
  // remover fundo: ferramenta da tela, tolerância, pincel
  const bg = { mode: 'wand-erase', tolerance: 28, feather: 1, size: 28, hardness: 0.6 };
  // IA generativa: modo, área pintada, margens do Expandir, pedido
  const gen = { mode: 'fill', size: 40, prompt: '', expand: { top: 0, right: 0, bottom: 0, left: 0 }, busy: null, config: undefined, error: '' };
  let genMask = null;

  // ------------------------------------------------ elementos
  const view = h('canvas.ia-view', { 'aria-label': 'Prévia da imagem', role: 'img' });
  const overlay = h('canvas.ia-overlay', { 'aria-hidden': 'true' });
  const brush = h('div.ia-brush', { hidden: true });
  const cropBox = h('div.ia-crop', { hidden: true },
    h('div.ia-crop-grid'),
    ...['nw', 'ne', 'sw', 'se'].map((c) => h(`div.ia-crop-handle.${c}`, { dataset: { corner: c } })));
  const wrap = h('div.ia-canvas-wrap', view, overlay, cropBox, brush);
  const stageInfo = h('span.ia-stage-info');
  const stageHint = h('span.ia-stage-hint');
  const compareBtn = h('button.btn.small.ia-compare', { type: 'button', 'aria-label': 'Comparar com a original', title: 'Segure para ver a imagem original' }, ico('eye', 13), ' Comparar');
  const stage = h('div.ia-stage', wrap, h('div.ia-stage-bar', stageInfo, h('div.spacer'), stageHint, compareBtn));
  const side = h('div.ia-side');
  const rail = h('nav.ia-rail', { 'aria-label': 'Ferramentas do editor de imagem' },
    TOOLS.map(([id, icon, label]) => h('button.ia-tool', { type: 'button', dataset: { tool: id }, onclick: () => setTool(id) }, ico(icon, 20), h('span', label))));
  const undoBtn = h('button.icon-btn', { type: 'button', title: 'Desfazer (Ctrl+Z)', 'aria-label': 'Desfazer no editor', onclick: undo }, ico('undo'));
  const redoBtn = h('button.icon-btn', { type: 'button', title: 'Refazer (Ctrl+Shift+Z)', 'aria-label': 'Refazer no editor', onclick: redo }, ico('redo'));
  const restoreBtn = h('button.btn', { type: 'button', 'aria-label': 'Restaurar original', title: 'Volta a camada para a imagem de antes de qualquer edição', onclick: onRestore }, ico('history', 13), ' Restaurar original');
  const applyBtn = h('button.btn.primary', { type: 'button', onclick: apply }, ico('check', 13), ' Aplicar');
  const dims = h('span.ia-dims');
  const head = h('header.ia-head',
    h('div.ia-title', ico('image', 18), h('div', h('h2', { id: 'ia-title' }, 'Editar imagem'), h('span.ia-sub', node.name || 'Imagem', ' · ', dims))),
    h('div.ia-head-mid', undoBtn, redoBtn),
    h('div.ia-head-actions', restoreBtn, h('button.btn', { type: 'button', onclick: () => close() }, 'Cancelar'), applyBtn));
  const root = h('section.ia-editor', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ia-title', tabindex: -1 }, head, h('div.ia-body', rail, stage, side));

  // ------------------------------------------------ prévia
  // A prévia trabalha numa cópia REDUZIDA (do tamanho da tela): ajustes e filtros ficam instantâneos.
  let vs = 1; // escala da prévia (px da tela por px da imagem)
  let small = null; // { data, w, h } da imagem de trabalho reduzida
  let smallMask = null;
  let rafId = 0;
  let comparing = false;
  /** Recalcula a escala da prévia (tamanho do palco) e a cópia reduzida. */
  function workResized() {
    const W = st.work.width, H = st.work.height;
    const r = stage.getBoundingClientRect();
    const availW = Math.max(120, r.width - 64), availH = Math.max(120, r.height - 96);
    vs = Math.min(1, availW / W, availH / H);
    const vw = Math.max(1, Math.round(W * vs)), vh = Math.max(1, Math.round(H * vs));
    view.width = overlay.width = vw; view.height = overlay.height = vh;
    wrap.style.width = `${vw}px`; wrap.style.height = `${vh}px`;
    const sc = vw === W ? st.work : resized(st.work, vw, vh);
    small = { data: pixelsOf(sc).data, w: vw, h: vh };
    maskChanged();
    dims.textContent = `${W} × ${H} px`;
    stageInfo.textContent = `${W} × ${H} px · ${Math.round(vs * 100)}%`;
  }
  /** A máscara de fundo mudou: refaz a versão reduzida. */
  function maskChanged() { smallMask = st.mask && small ? resizeMask(st.mask, st.work.width, st.work.height, small.w, small.h) : null; schedule(); }
  /** Agenda um redesenho (no máximo um por quadro). */
  function schedule() { root.dataset.state = JSON.stringify(summary()); cancelAnimationFrame(rafId); rafId = requestAnimationFrame(draw); }
  /** Resumo do estado em data-state (testes automáticos e depuração leem daqui). */
  const summary = () => ({ tool: active, w: st.work.width, h: st.work.height, adj: { ...st.adj }, filter: st.filter, removed: st.mask ? maskCoverage(st.mask) : 0, history: hist.i, painted: !!genMask?.some((v) => v) });
  function draw() {
    root.dataset.state = JSON.stringify(summary());
    if (!small) return;
    const cx = ctx2d(view);
    if (comparing) {
      cx.clearRect(0, 0, view.width, view.height);
      cx.drawImage(first, 0, 0, view.width, view.height);
    } else {
      const adj = { ...st.adj, blur: st.adj.blur * vs };
      cx.putImageData(new ImageData(renderPixels(small.data, small.w, small.h, { filter: st.filter, adj, mask: smallMask }), small.w, small.h), 0, 0);
    }
    drawOverlay();
  }
  /** Camada por cima da prévia: a área pintada da IA generativa (vermelho) e o contorno do Expandir. */
  function drawOverlay() {
    const cx = ctx2d(overlay);
    cx.clearRect(0, 0, overlay.width, overlay.height);
    if (active !== 'ai' || comparing) return;
    if (genMask && (gen.mode === 'fill' || gen.mode === 'replace')) {
      const m = resizeMask(genMask, st.work.width, st.work.height, overlay.width, overlay.height);
      const d = new Uint8ClampedArray(overlay.width * overlay.height * 4);
      for (let p = 0; p < m.length; p++) if (m[p]) { d[p * 4] = 255; d[p * 4 + 1] = 64; d[p * 4 + 2] = 96; d[p * 4 + 3] = Math.round(m[p] * 0.55); }
      cx.putImageData(new ImageData(d, overlay.width, overlay.height), 0, 0);
    }
  }

  // ------------------------------------------------ recorte (caixa com alças)
  function placeCrop() {
    cropBox.hidden = !(active === 'crop' && crop);
    if (cropBox.hidden) { stageInfo.textContent = `${st.work.width} × ${st.work.height} px · ${Math.round(vs * 100)}%`; return; }
    Object.assign(cropBox.style, { left: `${crop.x * vs}px`, top: `${crop.y * vs}px`, width: `${crop.w * vs}px`, height: `${crop.h * vs}px` });
    stageInfo.textContent = `Recorte: ${crop.w} × ${crop.h} px`;
  }
  cropBox.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const corner = e.target.dataset?.corner || null;
    const start = { x: e.clientX, y: e.clientY, c: { ...crop } };
    cropBox.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const dx = (ev.clientX - start.x) / vs, dy = (ev.clientY - start.y) / vs;
      const c = start.c;
      const W = st.work.width, H = st.work.height;
      if (!corner) { crop = clampCrop({ ...c, x: c.x + dx, y: c.y + dy }, W, H); placeCrop(); return; }
      // canto arrastado: o oposto fica parado
      let x0 = c.x, y0 = c.y, x1 = c.x + c.w, y1 = c.y + c.h;
      if (corner.includes('w')) x0 = Math.min(x1 - 8, Math.max(0, c.x + dx)); else x1 = Math.max(x0 + 8, Math.min(W, x1 + dx));
      if (corner.includes('n')) y0 = Math.min(y1 - 8, Math.max(0, c.y + dy)); else y1 = Math.max(y0 + 8, Math.min(H, y1 + dy));
      let nw = x1 - x0, nh = y1 - y0;
      if (cropRatio) { if (nw / nh > cropRatio) nw = nh * cropRatio; else nh = nw / cropRatio; }
      crop = {
        x: Math.round(corner.includes('w') ? x1 - nw : x0), y: Math.round(corner.includes('n') ? y1 - nh : y0),
        w: Math.round(nw), h: Math.round(nh),
      };
      placeCrop();
    };
    const up = () => { cropBox.removeEventListener('pointermove', move); cropBox.removeEventListener('pointerup', up); };
    cropBox.addEventListener('pointermove', move);
    cropBox.addEventListener('pointerup', up);
  });

  // ------------------------------------------------ pincel e varinha no palco
  const toImage = (e) => {
    const r = view.getBoundingClientRect();
    return { x: (e.clientX - r.left) / vs, y: (e.clientY - r.top) / vs };
  };
  const brushOn = () => (active === 'background' && bg.mode.startsWith('brush')) || (active === 'ai' && (gen.mode === 'fill' || gen.mode === 'replace'));
  const brushSize = () => (active === 'ai' ? gen.size : bg.size);
  wrap.addEventListener('pointermove', (e) => {
    if (!brushOn()) { brush.hidden = true; return; }
    const r = wrap.getBoundingClientRect();
    const d = brushSize() * 2 * vs;
    Object.assign(brush.style, { width: `${d}px`, height: `${d}px`, left: `${e.clientX - r.left - d / 2}px`, top: `${e.clientY - r.top - d / 2}px` });
    brush.hidden = false;
  });
  wrap.addEventListener('pointerleave', () => { brush.hidden = true; });
  wrap.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.ia-crop')) return;
    const p = toImage(e);
    const W = st.work.width, H = st.work.height;
    if (active === 'background' && bg.mode.startsWith('wand')) {
      const sel = magicWand(pixelsOf(st.work).data, W, H, p.x, p.y, bg.tolerance);
      st.mask = combineSelection(st.mask || new Uint8Array(W * H).fill(255), sel, bg.mode === 'wand-keep' ? 'keep' : 'erase');
      afterMask();
      return;
    }
    if (!brushOn()) return;
    e.preventDefault();
    wrap.setPointerCapture(e.pointerId);
    const isGen = active === 'ai';
    if (isGen) genMask ||= new Uint8Array(W * H);
    else st.mask ||= new Uint8Array(W * H).fill(255);
    const target = isGen ? genMask : st.mask;
    const value = isGen ? 255 : bg.mode === 'brush-keep' ? 255 : 0;
    const hard = isGen ? 0.85 : bg.hardness;
    let last = p;
    paintStroke(target, W, H, p, p, brushSize(), value, hard);
    isGen ? drawOverlay() : maskChanged();
    const move = (ev) => {
      const q = toImage(ev);
      paintStroke(target, W, H, last, q, brushSize(), value, hard);
      last = q;
      isGen ? drawOverlay() : maskChanged();
    };
    const up = () => {
      wrap.removeEventListener('pointermove', move); wrap.removeEventListener('pointerup', up);
      if (isGen) renderSide(); else afterMask();
    };
    wrap.addEventListener('pointermove', move);
    wrap.addEventListener('pointerup', up);
  });
  /** A máscara de fundo terminou de mudar: prévia, histórico, formato com transparência e painel. */
  function afterMask() {
    maskChanged();
    if (!out.touched && out.format === 'jpeg' && st.mask) out.format = 'png'; // JPEG perderia a transparência
    commit();
    renderSide();
  }
  compareBtn.addEventListener('pointerdown', () => { comparing = true; draw(); });
  for (const ev of ['pointerup', 'pointerleave']) compareBtn.addEventListener(ev, () => { if (comparing) { comparing = false; draw(); } });

  // ------------------------------------------------ operações que "assam" a imagem
  /** Imagem de trabalho com filtro, ajustes e fundo removido já aplicados (tamanho real). */
  function rendered() {
    if (st.filter === 'none' && isNeutral(st.adj) && !st.mask) return st.work;
    return fromPixels(renderPixels(pixelsOf(st.work).data, st.work.width, st.work.height, st), st.work.width, st.work.height);
  }
  /** Troca a imagem de trabalho (giro, recorte, resultado da IA). `bake` = aplica antes os ajustes/filtro/fundo. */
  function setWork(c, { bake = false } = {}) {
    if (bake) { st.adj = { ...ADJ_DEFAULTS }; st.filter = 'none'; }
    st.work = c;
    st.mask = null; genMask = null; crop = null;
    workResized();
    commit();
    renderSide();
  }
  /** Giro/espelho: o fundo removido é aplicado antes (a máscara é do tamanho antigo). */
  const geometry = (fn) => {
    const base = st.mask ? fromPixels(renderPixels(pixelsOf(st.work).data, st.work.width, st.work.height, { mask: st.mask }), st.work.width, st.work.height) : st.work;
    setWork(fn(base));
  };

  // ------------------------------------------------ painel da direita (por ferramenta)
  const sec = (title, ...body) => h('div.ia-sec', title ? h('h3', title) : null, ...body);
  const seg = (label, options, get, set) => h('div.ia-seg', { role: 'radiogroup', 'aria-label': label },
    options.map(([v, text]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(get() === v), class: get() === v ? 'on' : '', onclick: () => set(v) }, text)));
  /** Controle deslizante com valor: `onInput` ao vivo, `onDone` ao soltar (histórico). */
  function slider(label, value, min, max, step, onInput, onDone, fmt = (v) => String(v)) {
    const out2 = h('output', fmt(value));
    const input = h('input.ia-range', { type: 'range', min, max, step, value, 'aria-label': label });
    input.addEventListener('input', () => { out2.textContent = fmt(Number(input.value)); onInput(Number(input.value)); });
    input.addEventListener('change', () => onDone?.(Number(input.value)));
    input.addEventListener('dblclick', () => { input.value = min < 0 ? 0 : min; input.dispatchEvent(new Event('input')); input.dispatchEvent(new Event('change')); });
    return h('label.ia-slider', h('span.ia-slider-head', h('span', label), out2), input);
  }
  const numIn = (label, value, onChange, attrs = {}) => {
    const input = h('input.text.ia-num', { type: 'number', value, 'aria-label': label, ...attrs });
    input.addEventListener('change', () => onChange(Number(input.value) || 0));
    return h('label.ia-field', h('span', label), h('div.field', input));
  };

  function renderSide() {
    const hints = {
      crop: 'Arraste o recorte ou as alças dos cantos.',
      adjust: 'Dois cliques num controle voltam ao zero.',
      filters: 'Clique num filtro para aplicar.',
      background: bg.mode.startsWith('wand') ? 'Clique numa cor para ' + (bg.mode === 'wand-keep' ? 'restaurar' : 'apagar') + ' a região parecida.' : 'Pinte sobre a imagem para ' + (bg.mode === 'brush-keep' ? 'restaurar.' : 'apagar.'),
      ai: gen.mode === 'expand' ? 'Diga quanto expandir de cada lado.' : 'Pinte a área que a IA vai mudar.',
      size: 'O tamanho final é calculado com a imagem pronta.',
    };
    stageHint.textContent = hints[active] || '';
    for (const b of rail.children) { const on = b.dataset.tool === active; b.classList.toggle('on', on); on ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current'); }
    wrap.dataset.tool = active;
    wrap.classList.toggle('brushing', brushOn());
    wrap.classList.toggle('wand', active === 'background' && bg.mode.startsWith('wand'));
    const title = TOOLS.find((t) => t[0] === active)[2];
    side.replaceChildren(h('h2.ia-side-title', title), ...(PANELS[active]() || []));
    // o botão clicado pode ter sido recriado: o foco fica no editor (Ctrl+Z e Esc continuam valendo)
    if (!root.contains(document.activeElement)) root.focus({ preventScroll: true });
    placeCrop();
    draw();
  }

  const PANELS = {
    crop() {
      if (!crop) crop = cropForRatio(st.work.width, st.work.height, cropRatio);
      return [
        sec('Proporção', h('div.ia-chips', CROP_RATIOS.map(([label, r]) => h('button.ia-chip', {
          type: 'button', class: cropRatio === r ? 'on' : '', 'aria-pressed': String(cropRatio === r),
          onclick: () => { cropRatio = r; crop = cropForRatio(st.work.width, st.work.height, r); renderSide(); },
        }, label)))),
        sec('Girar e espelhar', h('div.ia-grid2',
          h('button.btn', { type: 'button', 'aria-label': 'Girar 90° à esquerda', onclick: () => geometry((c) => rotated(c, -90)) }, h('span.ia-mirror', ico('rotate', 14)), ' Girar ←'),
          h('button.btn', { type: 'button', 'aria-label': 'Girar 90° à direita', onclick: () => geometry((c) => rotated(c, 90)) }, ico('rotate', 14), ' Girar →'),
          h('button.btn', { type: 'button', 'aria-label': 'Espelhar na horizontal', onclick: () => geometry((c) => flipped(c, 'h')) }, ico('flipH', 14), ' Espelhar ↔'),
          h('button.btn', { type: 'button', 'aria-label': 'Espelhar na vertical', onclick: () => geometry((c) => flipped(c, 'v')) }, ico('flipV', 14), ' Espelhar ↕'))),
        sec(null, h('div.ia-row',
          h('button.btn', { type: 'button', onclick: () => { cropRatio = null; crop = cropForRatio(st.work.width, st.work.height, null); renderSide(); } }, 'Redefinir'),
          h('button.btn.primary.wide', {
            type: 'button',
            onclick: () => {
              const r = clampCrop(crop, st.work.width, st.work.height);
              if (r.w === st.work.width && r.h === st.work.height) return;
              geometry((c) => cropped(c, r));
            },
          }, ico('crop', 14), ' Aplicar recorte'))),
      ];
    },
    adjust() {
      return [
        sec(null, ...ADJ_FIELDS.map(([k, label, min, max]) => slider(label, st.adj[k], min, max, 1,
          (v) => { st.adj[k] = v; schedule(); }, () => commit(), (v) => (k === 'blur' ? `${v} px` : v > 0 && min < 0 ? `+${v}` : String(v))))),
        sec(null, h('button.btn', { type: 'button', disabled: isNeutral(st.adj), onclick: () => { st.adj = { ...ADJ_DEFAULTS }; commit(); renderSide(); } }, 'Redefinir ajustes')),
      ];
    },
    filters() {
      // miniaturas: a imagem atual (com o fundo removido), pequena, em cada filtro
      const tw = 120, th = Math.max(40, Math.round((120 * st.work.height) / st.work.width));
      const thumbH = Math.min(th, 120);
      const base = resized(st.work, tw, thumbH);
      const px = pixelsOf(base).data;
      // cada miniatura = o filtro + os ajustes atuais + o fundo removido (o mesmo que a prévia grande mostra)
      const tmask = st.mask ? resizeMask(st.mask, st.work.width, st.work.height, tw, thumbH) : null;
      return [h('div.ia-filters', FILTERS.map((f) => {
        const c = fromPixels(renderPixels(px, tw, thumbH, { filter: f.id, adj: st.adj, mask: tmask }), tw, thumbH);
        c.className = 'ia-filter-thumb';
        return h('button.ia-filter', {
          type: 'button', class: st.filter === f.id ? 'on' : '', 'aria-pressed': String(st.filter === f.id), 'aria-label': `Filtro ${f.name}`,
          onclick: () => { st.filter = f.id; commit(); renderSide(); },
        }, c, h('span', f.name));
      }))];
    },
    background() {
      const pct = st.mask ? Math.round(maskCoverage(st.mask) * 100) : 0;
      return [
        sec('Automático', h('p.ia-help', 'Estima a cor do fundo pelas bordas da foto e tira tudo que está ligado a elas. Funciona melhor com fundo liso.'),
          slider('Tolerância', bg.tolerance, 1, 80, 1, (v) => { bg.tolerance = v; }, null),
          slider('Suavizar borda', bg.feather, 0, 6, 1, (v) => { bg.feather = v; }, null, (v) => `${v} px`),
          h('button.btn.primary', {
            type: 'button',
            onclick: () => {
              const { mask, removed } = autoBackground(pixelsOf(st.work).data, st.work.width, st.work.height, { tolerance: bg.tolerance, feather: bg.feather });
              if (!removed) { toast('Não achei um fundo liso nas bordas. Use a varinha ou o pincel.'); return; }
              st.mask = mask;
              afterMask();
            },
          }, ico('wand', 14), ' Remover fundo automaticamente')),
        sec('Refinar', seg('Ferramenta de refinar', [['wand-erase', 'Varinha: apagar'], ['wand-keep', 'Varinha: restaurar'], ['brush-erase', 'Pincel: apagar'], ['brush-keep', 'Pincel: restaurar']],
          () => bg.mode, (v) => { bg.mode = v; renderSide(); }),
        bg.mode.startsWith('brush')
          ? [slider('Tamanho do pincel', bg.size, 2, 200, 1, (v) => { bg.size = v; }, null, (v) => `${v} px`), slider('Dureza', Math.round(bg.hardness * 100), 0, 100, 1, (v) => { bg.hardness = v / 100; }, null, (v) => `${v}%`)]
          : h('p.ia-help', 'A varinha usa a mesma tolerância do automático.')),
        sec(null, h('div.ia-meter', h('div', { style: { width: `${pct}%` } })), h('p.ia-help', st.mask ? `${pct}% da imagem removido.` : 'Nada removido ainda.'),
          h('button.btn', { type: 'button', disabled: !st.mask, onclick: () => { st.mask = null; afterMask(); } }, 'Desfazer remoção (mostrar tudo)')),
      ];
    },
    ai() {
      if (gen.config === undefined) {
        gen.config = null;
        imageAiConfig().then((c) => { gen.config = c || { available: false, reason: 'Sem servidor: a edição generativa precisa do npm start.' }; if (active === 'ai') renderSide(); });
        return [h('p.ia-help', 'Consultando o modelo de imagem…')];
      }
      const c = gen.config;
      if (!c) return [h('p.ia-help', 'Consultando o modelo de imagem…')];
      const status = c.available
        ? h('div.ia-status.ok', ico('sparkle', 14), h('span', 'Modelo ', h('code', c.model), ` em ${c.providerName}`))
        : h('div.ia-status.warn', h('strong', 'Edição generativa indisponível'), h('p', c.reason),
          h('button.btn.small', { type: 'button', onclick: () => { close(true); document.dispatchEvent(new CustomEvent('stylo:abrir-configuracoes', { detail: 'ai' })); } }, 'Abrir Configurações'));
      const modes = [['fill', 'Preencher área'], ['replace', 'Trocar objeto'], ['expand', 'Expandir']];
      const prompt = h('textarea.text.ia-prompt', { rows: 3, maxLength: 1000, 'aria-label': 'Pedido para a IA', placeholder: gen.mode === 'fill' ? 'ex.: tire a pessoa e continue a parede' : gen.mode === 'replace' ? 'ex.: troque a caneca por um vaso de flores (sem área pintada = variação da foto toda)' : 'ex.: continue a paisagem com o mesmo céu' });
      prompt.value = gen.prompt;
      prompt.addEventListener('input', () => { gen.prompt = prompt.value; });
      const W = st.work.width, H = st.work.height;
      const painted = genMask && genMask.some((v) => v);
      const body = [];
      if (gen.mode === 'expand') {
        const e = gen.expand;
        body.push(sec('Quanto expandir (px)',
          h('div.ia-grid2', numIn('Esquerda', e.left, (v) => { e.left = Math.max(0, v); renderSide(); }, { min: 0 }), numIn('Direita', e.right, (v) => { e.right = Math.max(0, v); renderSide(); }, { min: 0 }),
            numIn('Em cima', e.top, (v) => { e.top = Math.max(0, v); renderSide(); }, { min: 0 }), numIn('Embaixo', e.bottom, (v) => { e.bottom = Math.max(0, v); renderSide(); }, { min: 0 })),
          h('div.ia-chips',
            h('button.ia-chip', { type: 'button', onclick: () => { const v = Math.round(W * 0.25); Object.assign(e, { left: v, right: v }); renderSide(); } }, '+25% nos lados'),
            h('button.ia-chip', { type: 'button', onclick: () => { const v = Math.round(H * 0.25); Object.assign(e, { top: v, bottom: v }); renderSide(); } }, '+25% em cima/embaixo'),
            h('button.ia-chip', { type: 'button', onclick: () => { Object.assign(e, { top: 0, right: 0, bottom: 0, left: 0 }); renderSide(); } }, 'Zerar')),
          h('p.ia-help', `Tamanho final: ${W + e.left + e.right} × ${H + e.top + e.bottom} px`)));
      } else {
        body.push(sec('Área', slider('Tamanho do pincel', gen.size, 4, 200, 1, (v) => { gen.size = v; }, null, (v) => `${v} px`),
          h('div.ia-row', h('span.ia-help', painted ? 'Área pintada (em vermelho).' : 'Nenhuma área pintada.'), h('div.spacer'),
            h('button.btn.small', { type: 'button', disabled: !painted, onclick: () => { genMask = null; renderSide(); } }, 'Limpar área'))));
      }
      const busy = gen.busy;
      body.push(sec('Pedido', prompt,
        gen.error ? h('p.ia-error', { role: 'alert' }, gen.error) : null,
        busy
          ? h('div.ia-row', h('span.ia-spinner'), h('span.ia-help', { 'aria-live': 'polite' }, `Gerando… ${busy.secs} s`), h('div.spacer'), h('button.btn.small', { type: 'button', onclick: () => busy.ctrl.abort() }, 'Cancelar'))
          : h('button.btn.primary', { type: 'button', disabled: !c.available, onclick: runGen }, ico('sparkle', 14), ' Gerar')));
      return [status, sec('O que fazer', seg('Modo da IA generativa', modes, () => gen.mode, (v) => { gen.mode = v; gen.error = ''; renderSide(); })), ...body,
        h('p.ia-help.small', 'A imagem vai para o modelo de imagem configurado, pelo servidor deste computador. A chave nunca sai do servidor.')];
    },
    size() {
      const fit = fitWidth(st.work.width, st.work.height, out.maxW);
      const info = h('div.ia-size-out', { 'aria-live': 'polite' }, h('strong', `${fit.w} × ${fit.h} px`), h('span', 'calculando…'));
      sizeEstimate(info);
      const transparent = !!st.mask || srcMime !== 'image/jpeg';
      return [
        sec('Largura máxima', numIn('Largura máxima (px)', out.maxW || st.work.width, (v) => { out.maxW = v >= st.work.width ? 0 : Math.max(16, v); renderSide(); }, { min: 16, max: st.work.width }),
          h('div.ia-chips', [1600, 1200, 800, 400].filter((v) => v < st.work.width).map((v) => h('button.ia-chip', { type: 'button', class: out.maxW === v ? 'on' : '', onclick: () => { out.maxW = v; renderSide(); } }, `${v}px`)),
            h('button.ia-chip', { type: 'button', class: !out.maxW ? 'on' : '', onclick: () => { out.maxW = 0; renderSide(); } }, 'Original'))),
        sec('Formato', seg('Formato', [['webp', 'WebP'], ['png', 'PNG'], ['jpeg', 'JPEG']], () => out.format, (v) => { out.format = v; out.touched = true; renderSide(); }),
          out.format === 'png' ? h('p.ia-help', 'PNG não perde qualidade e guarda transparência, mas fica maior.')
            : slider('Qualidade', Math.round(out.quality * 100), 30, 100, 1, (v) => { out.quality = v / 100; }, () => sizeEstimate(info), (v) => `${v}%`),
          out.format === 'jpeg' && transparent && st.mask ? h('p.ia-error', 'JPEG não tem transparência: o fundo removido vira branco.') : null),
        sec('Resultado', info),
      ];
    },
  };

  // ------------------------------------------------ tamanho final (codifica de verdade, com pausa)
  let estTimer = 0;
  let estSeq = 0;
  function sizeEstimate(info) {
    clearTimeout(estTimer);
    const seq = ++estSeq;
    estTimer = setTimeout(async () => {
      try {
        const res = await finalImage();
        if (seq !== estSeq || !info.isConnected) return;
        const before = srcUrl.length * 0.75;
        info.replaceChildren(...[h('strong', `${res.w} × ${res.h} px · ${formatBytes(res.bytes)}`),
          h('span', `Antes: ${first.width} × ${first.height} px · ${formatBytes(Math.round(before))}`),
          res.mime !== FORMAT_MIME[out.format] ? h('span.ia-error', 'Este navegador não gera WebP: vai como PNG.') : null].filter(Boolean));
      } catch (err) { if (info.isConnected) info.replaceChildren(h('span.ia-error', err.message)); }
    }, 250);
  }
  /** A imagem final (tudo aplicado, no tamanho e formato escolhidos). */
  async function finalImage() {
    let c = rendered();
    const fit = fitWidth(c.width, c.height, out.maxW);
    if (fit.w !== c.width) c = resized(c, fit.w, fit.h);
    const fmt = out.format === 'jpeg' && st.mask ? 'jpeg' : out.format;
    const enc = await encodeCanvas(c, fmt, out.quality);
    return { ...enc, w: c.width, h: c.height };
  }

  // ------------------------------------------------ IA generativa
  async function runGen() {
    const ctrl = new AbortController();
    const t0 = Date.now();
    gen.error = '';
    gen.busy = { ctrl, secs: 0 };
    const tick = setInterval(() => { if (gen.busy) { gen.busy.secs = Math.round((Date.now() - t0) / 1000); const el = side.querySelector('.ia-spinner + .ia-help'); if (el) el.textContent = `Gerando… ${gen.busy.secs} s`; } }, 1000);
    renderSide();
    try {
      const base = rendered();
      const prompt = gen.prompt.trim() || (gen.mode === 'expand' ? 'continue a imagem de forma natural, mesmo estilo e iluminação' : '');
      if (!prompt) throw new Error('Escreva o pedido para a IA.');
      const res = await generativeEdit({ src: base.toDataURL('image/png'), mode: gen.mode, prompt, mask: genMask, expand: gen.expand, signal: ctrl.signal });
      const c = toCanvas(await loadImage(res.dataUrl));
      if (gen.mode === 'expand') gen.expand = { top: 0, right: 0, bottom: 0, left: 0 };
      gen.busy = null;
      setWork(c, { bake: true });
      if (!out.touched && out.format === 'jpeg') out.format = 'png';
      toast('Pronto: a IA editou a imagem. Ctrl+Z (no editor) desfaz.');
    } catch (err) {
      gen.error = err.name === 'AbortError' ? 'Cancelado.' : err.message || 'A edição falhou.';
    } finally {
      clearInterval(tick);
      gen.busy = null;
      if (root.isConnected) renderSide();
    }
  }

  // ------------------------------------------------ cabeçalho, ferramentas, aplicar e fechar
  function syncHeader() {
    undoBtn.disabled = hist.i <= 0;
    redoBtn.disabled = hist.i >= hist.stack.length - 1;
    restoreBtn.hidden = !hasOriginal(store.get(nodeId));
  }
  function setTool(id) {
    if (active === id) return;
    active = id;
    crop = null;
    renderSide();
    side.querySelector('h2')?.focus?.();
  }
  /** Houve alguma mudança (para perguntar antes de fechar e para o Aplicar não gravar uma cópia igual). */
  const dirty = () => hist.i > 0 || out.maxW > 0 || out.touched;
  async function apply() {
    if (gen.busy) return;
    if (!dirty()) { close(true); return; }
    applyBtn.disabled = true;
    try {
      const res = await finalImage();
      applyImageToNode(store, nodeId, { dataUrl: res.dataUrl, w: res.w, h: res.h });
      toast(`Imagem editada (${res.w} × ${res.h} px, ${formatBytes(res.bytes)}). Ctrl+Z desfaz.`);
      close(true);
    } catch (err) {
      toast(err.message || 'Não consegui aplicar.');
      applyBtn.disabled = false;
    }
  }
  async function onRestore() {
    if (!(await restoreOriginal(store, nodeId))) return;
    toast('Imagem original restaurada. Ctrl+Z desfaz.');
    close(true);
    openImageEditor({ store, nodeId, toast, tool: active });
  }
  async function close(force = false) {
    if (!root.isConnected) return;
    if (!force && dirty()) {
      const v = await ask({ title: 'Descartar as edições?', message: 'As mudanças feitas nesta imagem ainda não foram aplicadas.', buttons: [{ label: 'Continuar editando', value: false }, { label: 'Descartar', value: true, danger: true }] });
      if (!v) return;
    }
    gen.busy?.ctrl.abort();
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onWindowKey, true);
    root.remove();
    current = null;
    if (!store.ui.homeOpen && !store.ui.settingsOpen && app) { app.inert = false; app.removeAttribute('aria-hidden'); }
    if (returnFocus?.isConnected) returnFocus.focus?.();
  }
  // teclado: Ctrl+Z/Ctrl+Shift+Z desfazem DENTRO do editor; Esc fecha. Nada vaza para os atalhos do app.
  root.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'range';
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); }
    else if (e.key === 'Escape' && !document.querySelector('.modal-backdrop')) { e.preventDefault(); close(); }
    else if (e.key === 'Enter' && mod) { e.preventDefault(); apply(); }
    e.stopPropagation();
  });
  // foco perdido (no <body>): as teclas chegam aqui e não vão para os atalhos do app
  const onWindowKey = (e) => {
    if (e.target !== document.body && e.target !== document.documentElement) return;
    root.focus({ preventScroll: true });
    root.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey, bubbles: true, cancelable: true }));
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener('keydown', onWindowKey, true);
  const onResize = () => { workResized(); placeCrop(); };
  window.addEventListener('resize', onResize);

  if (app) { app.inert = true; app.setAttribute('aria-hidden', 'true'); }
  document.body.append(root);
  workResized();
  commit();
  renderSide();
  root.focus();
  current = {
    close, el: root, apply, undo, redo, setTool,
    /** Para testes/depuração: o estado atual (tamanho, ajustes, filtro, % removido). */
    state: summary,
  };
  return current;
}

/** O editor de imagem está aberto? */
export const imageEditorOpen = () => !!current;

// ---------------------------------------------------------------- Configurações: "Modelo de imagem"
/**
 * Cartão "Modelo de imagem" da seção Agente de IA e modelos (ui/settings.js). Mostra se a edição generativa está
 * disponível e permite escolher outro endereço/modelo/chave só para imagens.
 * @param {{ card: Function, row: Function, toast: Function }} deps  peças de layout das Configurações
 */
export function imageModelCard({ card, row, toast }) {
  const msg = h('p.set-msg', { role: 'status' });
  const status = h('p.sp-muted', 'Consultando…');
  const base = h('input.text.mono', { type: 'text', placeholder: 'mesmo endereço do Agente', spellcheck: false, 'aria-label': 'Endereço da API de imagem' });
  const model = h('input.text.mono', { type: 'text', placeholder: 'ex.: gpt-image-1', spellcheck: false, 'aria-label': 'Modelo de imagem' });
  const key = h('input.text.mono', { type: 'password', autocomplete: 'off', spellcheck: false, 'aria-label': 'Chave da API de imagem', placeholder: 'só se o endereço for outro' });
  const paint = (c) => {
    if (!c) { status.textContent = 'Precisa do servidor (npm start).'; return; }
    status.className = c.available ? 'set-status on' : 'set-status off';
    status.textContent = c.available ? `● Disponível: ${c.model} em ${c.providerName}${c.hasKey || c.local ? '' : ' (sem chave)'}` : `● ${c.reason}`;
    base.value = c.custom ? c.baseUrl : '';
    model.value = c.model || '';
    key.placeholder = c.hasKey ? '•••••••• (chave salva para este endereço)' : 'chave do endereço de imagem';
  };
  imageAiConfig().then(paint);
  const save = h('button.btn.primary', {
    type: 'button',
    onclick: async () => {
      msg.className = 'set-msg';
      try {
        const body = { baseUrl: base.value.trim(), model: model.value.trim(), ...(key.value.trim() ? { apiKey: key.value.trim() } : {}) };
        const r = await fetch('/api/imageai/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        key.value = '';
        paint(data);
        toast('Modelo de imagem salvo.');
      } catch (err) { msg.className = 'set-msg error'; msg.textContent = err.message || 'Não consegui salvar.'; }
    },
  }, 'Salvar');
  return card('Modelo de imagem', 'Usado pela edição generativa do editor de imagem (preencher área, expandir, trocar objeto).',
    'As edições comuns (recortar, ajustes, filtros, remover fundo, tamanho) rodam no navegador e não usam modelo nem chave. As generativas usam a API de imagens compatível com a OpenAI (/images/edits e /images/generations). Sem escolha, vale o endereço do Agente: a OpenAI tem API de imagem (gpt-image-1); NVIDIA NIM e Ollama não têm. A chave fica só no servidor.',
    status,
    row('Endereço', 'Vazio = o mesmo do Agente', h('div.field.grow', base)),
    row('Modelo', 'ex.: gpt-image-1, dall-e-2', h('div.field.grow', model)),
    row('Chave', 'Só se o endereço for diferente', h('div.field.grow', key)),
    h('div.sp-card-foot', msg, h('div.spacer'), save));
}
