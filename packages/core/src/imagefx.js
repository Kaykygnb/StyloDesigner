/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  imagefx.js — MATEMÁTICA DA IA DE FOTO (funções puras sobre pixels, sem DOM)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Tudo aqui trabalha com arrays de pixels RGBA (Uint8ClampedArray, 4 bytes por pixel, o mesmo formato do
 *  `ImageData` do canvas) e devolve arrays NOVOS (nunca altera a entrada). Por não depender do navegador, os
 *  testes do Node (tests/imagefx.test.js) conferem cada conta. Quem desenha na tela é ui/imageai.js.
 *
 *  Conteúdo:
 *   - AJUSTES: brilho, contraste, saturação, exposição, temperatura, nitidez e desfoque (adjustPixels)
 *   - FILTROS prontos (FILTERS / applyFilter): combinações de ajustes + P&B, sépia e vinheta
 *   - REMOVER FUNDO: estimativa automática pelas bordas (autoBackground), varinha mágica (magicWand),
 *     pincel de apagar/restaurar (paintMask) e aplicação da máscara no canal alfa (applyMask)
 *   - GEOMETRIA: recorte por proporção, redimensionar e o "plano" da edição generativa (planGenerative)
 *   - MULTIPART: monta o corpo multipart/form-data que a API de imagens recebe (buildMultipart, usado no servidor)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Limita v a [lo, hi]. */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** Número válido ou o padrão. */
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

// ---------------------------------------------------------------- ajustes
/** Ajustes neutros (nada muda). Faixas: -100..100, exceto nitidez 0..100 e desfoque 0..40 (px). */
export const ADJ_DEFAULTS = Object.freeze({ brightness: 0, contrast: 0, saturation: 0, exposure: 0, temperature: 0, sharpen: 0, blur: 0 });
/** Rótulos e faixas dos controles (a tela monta os controles a partir desta lista). */
export const ADJ_FIELDS = [
  ['exposure', 'Exposição', -100, 100],
  ['brightness', 'Brilho', -100, 100],
  ['contrast', 'Contraste', -100, 100],
  ['saturation', 'Saturação', -100, 100],
  ['temperature', 'Temperatura', -100, 100],
  ['sharpen', 'Nitidez', 0, 100],
  ['blur', 'Desfoque', 0, 40],
];

/** Ajustes completos e dentro da faixa (aceita objeto parcial ou com lixo). */
export function normalizeAdj(adj = {}) {
  const out = {};
  for (const [k, , lo, hi] of ADJ_FIELDS) out[k] = clamp(num(adj?.[k]), lo, hi);
  return out;
}
/** true se nenhum ajuste muda a imagem. */
export const isNeutral = (adj) => ADJ_FIELDS.every(([k]) => !num(adj?.[k]));

/**
 * Tabela (LUT) de 256 valores com exposição, brilho e contraste: a mesma conta para os três canais, feita uma vez só.
 *  - exposição: multiplica (como abrir o diafragma): 2^(e/50) → +100 = ×4, -100 = ×¼
 *  - brilho: soma até ±128
 *  - contraste: fórmula clássica de contraste em torno do cinza médio (128)
 */
export function toneLut({ exposure = 0, brightness = 0, contrast = 0 } = {}) {
  const k = 2 ** (num(exposure) / 50);
  const b = num(brightness) * 1.28;
  const c = clamp(num(contrast), -100, 100) * 2.55;
  const cf = (259 * (c + 255)) / (255 * (259 - c));
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = Math.round((v * k + b - 128) * cf + 128);
  return lut;
}

/**
 * Desfoque em caixa (box blur) separável, 3 passadas (fica parecido com o gaussiano). Raio em px.
 * Funciona no RGBA inteiro. Devolve um array novo.
 */
export function boxBlur(src, w, h, radius) {
  const r = Math.round(num(radius));
  if (r < 1 || w < 1 || h < 1) return new Uint8ClampedArray(src);
  let a = new Float32Array(src);
  let b = new Float32Array(src.length);
  const pass = (from, to, horizontal) => {
    const len = horizontal ? w : h, lines = horizontal ? h : w;
    const step = horizontal ? 4 : w * 4;
    const win = r * 2 + 1;
    for (let line = 0; line < lines; line++) {
      const base = horizontal ? line * w * 4 : line * 4;
      for (let ch = 0; ch < 4; ch++) {
        // soma da janela com as bordas "esticadas" (repete o pixel da ponta)
        let sum = 0;
        for (let i = -r; i <= r; i++) sum += from[base + clamp(i, 0, len - 1) * step + ch];
        for (let i = 0; i < len; i++) {
          to[base + i * step + ch] = sum / win;
          sum += from[base + clamp(i + r + 1, 0, len - 1) * step + ch] - from[base + clamp(i - r, 0, len - 1) * step + ch];
        }
      }
    }
  };
  for (let k = 0; k < 3; k++) {
    pass(a, b, true); [a, b] = [b, a];
    pass(a, b, false); [a, b] = [b, a];
  }
  return Uint8ClampedArray.from(a, (v) => Math.round(v));
}

/**
 * Aplica os ajustes a uma imagem RGBA (w × h). Ordem: tom (exposição/brilho/contraste) → saturação → temperatura
 * → desfoque → nitidez (máscara de nitidez: realça a diferença entre a imagem e ela mesma desfocada). O alfa não muda.
 * @param {Uint8ClampedArray} src
 * @param {number} w @param {number} h
 * @param {object} adj  ver ADJ_DEFAULTS
 * @returns {Uint8ClampedArray}
 */
export function adjustPixels(src, w, h, adj = {}) {
  const a = normalizeAdj(adj);
  const out = new Uint8ClampedArray(src);
  if (isNeutral(a)) return out;
  const lut = toneLut(a);
  const sat = 1 + a.saturation / 100;
  const t = a.temperature / 100;
  const tr = 40 * t, tb = -40 * t, tg = 6 * t;
  const doTone = a.exposure || a.brightness || a.contrast;
  for (let i = 0; i < out.length; i += 4) {
    let r = out[i], g = out[i + 1], b = out[i + 2];
    if (doTone) { r = lut[r]; g = lut[g]; b = lut[b]; }
    if (sat !== 1) {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
    }
    if (t) { r += tr; g += tg; b += tb; }
    out[i] = r; out[i + 1] = g; out[i + 2] = b;
  }
  let res = out;
  if (a.blur >= 1) res = keepAlpha(boxBlur(res, w, h, a.blur), src);
  if (a.sharpen > 0) {
    const soft = boxBlur(res, w, h, 1);
    const k = (a.sharpen / 100) * 1.6;
    const sh = new Uint8ClampedArray(res);
    for (let i = 0; i < sh.length; i += 4) {
      for (let c = 0; c < 3; c++) sh[i + c] = res[i + c] + k * (res[i + c] - soft[i + c]);
    }
    res = sh;
  }
  return res;
}
/** Copia o alfa de `from` para `to` (o desfoque não deve mexer na transparência). */
function keepAlpha(to, from) {
  for (let i = 3; i < to.length; i += 4) to[i] = from[i];
  return to;
}

// ---------------------------------------------------------------- filtros prontos
/**
 * Filtros: cada um é uma combinação de ajustes (adj) e, se quiser, P&B (mono), sépia (0..1) e vinheta (0..1).
 * A tela mostra uma miniatura de cada um aplicada à foto.
 */
export const FILTERS = [
  { id: 'none', name: 'Original' },
  { id: 'vivo', name: 'Vivo', adj: { saturation: 35, contrast: 12 } },
  { id: 'quente', name: 'Quente', adj: { temperature: 40, saturation: 8, brightness: 3 } },
  { id: 'frio', name: 'Frio', adj: { temperature: -40, contrast: 5 } },
  { id: 'suave', name: 'Suave', adj: { contrast: -22, brightness: 10, saturation: -12 } },
  { id: 'drama', name: 'Drama', adj: { contrast: 42, saturation: -18, exposure: -8 }, vignette: 0.35 },
  { id: 'pb', name: 'P&B', mono: true, adj: { contrast: 14 } },
  { id: 'noir', name: 'Noir', mono: true, adj: { contrast: 50, exposure: -12 }, vignette: 0.45 },
  { id: 'sepia', name: 'Sépia', sepia: 1, adj: { contrast: 5 } },
  { id: 'vintage', name: 'Vintage', sepia: 0.45, adj: { contrast: -12, temperature: 18, brightness: 6 }, vignette: 0.3 },
];
/** Filtro pelo id (ou o "Original"). */
export const filterById = (id) => FILTERS.find((f) => f.id === id) || FILTERS[0];

/**
 * Aplica um filtro pronto. `strength` (0..1) mistura com a imagem de entrada (1 = filtro inteiro).
 * @returns {Uint8ClampedArray}
 */
export function applyFilter(src, w, h, id, strength = 1) {
  const f = filterById(id);
  if (f.id === 'none' || strength <= 0) return new Uint8ClampedArray(src);
  let out = f.adj ? adjustPixels(src, w, h, f.adj) : new Uint8ClampedArray(src);
  if (f.mono || f.sepia) {
    const sp = num(f.sepia);
    for (let i = 0; i < out.length; i += 4) {
      const r = out[i], g = out[i + 1], b = out[i + 2];
      if (f.mono) {
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        out[i] = out[i + 1] = out[i + 2] = l;
      } else {
        // matriz de sépia clássica, misturada pela intensidade
        const sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b;
        out[i] = r + (sr - r) * sp; out[i + 1] = g + (sg - g) * sp; out[i + 2] = b + (sb - b) * sp;
      }
    }
  }
  if (f.vignette) out = vignette(out, w, h, f.vignette);
  if (strength < 1) for (let i = 0; i < out.length; i++) if ((i & 3) !== 3) out[i] = src[i] + (out[i] - src[i]) * strength;
  return out;
}

/** Escurece os cantos: multiplica por 1 − força·(distância ao centro)². */
export function vignette(src, w, h, amount) {
  const out = new Uint8ClampedArray(src);
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  const max = Math.hypot(cx, cy) || 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy) / max;
      const k = 1 - amount * d * d;
      const i = (y * w + x) * 4;
      out[i] *= k; out[i + 1] *= k; out[i + 2] *= k;
    }
  }
  return out;
}

/**
 * Pipeline completo dos pixels: filtro → ajustes → máscara (fundo removido). É o que a prévia e o "Aplicar" usam.
 * @param {{filter?: string, adj?: object, mask?: Uint8Array|null}} st
 */
export function renderPixels(src, w, h, { filter = 'none', adj = null, mask = null } = {}) {
  let out = filter && filter !== 'none' ? applyFilter(src, w, h, filter) : new Uint8ClampedArray(src);
  if (adj && !isNeutral(adj)) out = adjustPixels(out, w, h, adj);
  if (mask) out = applyMask(out, mask);
  return out;
}

// ---------------------------------------------------------------- remover fundo
/** Distância de cor ao quadrado (RGB). */
const dist2 = (d, i, r, g, b) => (d[i] - r) ** 2 + (d[i + 1] - g) ** 2 + (d[i + 2] - b) ** 2;
/** Tolerância 0..100 → distância máxima ao quadrado no espaço RGB (100 = 441,7, a diagonal do cubo). */
export const tolToDist2 = (tol) => (clamp(num(tol), 0, 100) * 4.417) ** 2;

/**
 * VARINHA MÁGICA: seleciona os pixels com cor parecida com a do ponto clicado. `contiguous` (padrão) = só os
 * que estão ligados ao ponto (preenchimento por inundação, 4 vizinhos); senão, todos da imagem com cor parecida.
 * Pixels já transparentes (alfa < 8) contam como "parecidos" (o fundo já removido não para a varinha).
 * @returns {Uint8Array} 1 = selecionado
 */
export function magicWand(src, w, h, x, y, tolerance = 32, contiguous = true) {
  const sel = new Uint8Array(w * h);
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return sel;
  const s = (y * w + x) * 4;
  const r = src[s], g = src[s + 1], b = src[s + 2];
  const max = tolToDist2(tolerance);
  const ok = (p) => src[p * 4 + 3] < 8 || dist2(src, p * 4, r, g, b) <= max;
  if (!contiguous) {
    for (let p = 0; p < w * h; p++) if (ok(p)) sel[p] = 1;
    return sel;
  }
  const stack = [y * w + x];
  sel[y * w + x] = 1;
  while (stack.length) {
    const p = stack.pop();
    const px = p % w, py = (p - px) / w;
    if (px > 0 && !sel[p - 1] && ok(p - 1)) { sel[p - 1] = 1; stack.push(p - 1); }
    if (px < w - 1 && !sel[p + 1] && ok(p + 1)) { sel[p + 1] = 1; stack.push(p + 1); }
    if (py > 0 && !sel[p - w] && ok(p - w)) { sel[p - w] = 1; stack.push(p - w); }
    if (py < h - 1 && !sel[p + w] && ok(p + w)) { sel[p + w] = 1; stack.push(p + w); }
  }
  return sel;
}

/**
 * Cores dominantes da BORDA da imagem (o que provavelmente é fundo): agrupa as cores da moldura de 1 px em
 * "caixas" de 32 níveis por canal e devolve a média das caixas que somam pelo menos 8% da borda (até 4 cores).
 * @returns {{r:number,g:number,b:number,share:number}[]}
 */
export function borderColors(src, w, h) {
  const bins = new Map();
  let total = 0;
  const add = (x, y) => {
    const i = (y * w + x) * 4;
    if (src[i + 3] < 8) return; // já transparente
    const key = ((src[i] >> 5) << 6) | ((src[i + 1] >> 5) << 3) | (src[i + 2] >> 5);
    const bin = bins.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    bin.r += src[i]; bin.g += src[i + 1]; bin.b += src[i + 2]; bin.n++;
    bins.set(key, bin);
    total++;
  };
  // passo para não ler mais que ~4000 pixels em imagens grandes
  const step = Math.max(1, Math.floor((w + h) / 2000));
  for (let x = 0; x < w; x += step) { add(x, 0); add(x, h - 1); }
  for (let y = 0; y < h; y += step) { add(0, y); add(w - 1, y); }
  if (!total) return [];
  return [...bins.values()].sort((a, b) => b.n - a.n).filter((b) => b.n / total >= 0.08).slice(0, 4)
    .map((b) => ({ r: Math.round(b.r / b.n), g: Math.round(b.g / b.n), b: Math.round(b.b / b.n), share: b.n / total }));
}

/**
 * REMOVER FUNDO AUTOMÁTICO (sem IA): estima as cores do fundo pela borda (borderColors) e "inunda" a partir de
 * todos os pixels da borda que têm essas cores, avançando para vizinhos parecidos com alguma cor de fundo. O que a
 * inundação alcança é fundo (alfa 0); o resto é o objeto. Ilhas de fundo fechadas (ex.: o miolo de um "O") ficam:
 * use a varinha. No fim tira `shrink` px da borda do objeto (a mistura com o fundo) e suaviza o recorte (`feather` px)
 * para não ficar serrilhado.
 * @returns {{mask: Uint8Array, colors: object[], removed: number}}  mask: 0..255 por pixel (255 = mantém)
 */
export function autoBackground(src, w, h, { tolerance = 28, feather = 1, shrink = 1 } = {}) {
  const colors = borderColors(src, w, h);
  const mask = new Uint8Array(w * h).fill(255);
  if (!colors.length) return { mask, colors, removed: 0 };
  const max = tolToDist2(tolerance);
  const isBg = (p) => {
    const i = p * 4;
    if (src[i + 3] < 8) return true;
    for (const c of colors) if (dist2(src, i, c.r, c.g, c.b) <= max) return true;
    return false;
  };
  const seen = new Uint8Array(w * h);
  const stack = [];
  const seed = (p) => { if (!seen[p] && isBg(p)) { seen[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  let removed = 0;
  while (stack.length) {
    const p = stack.pop();
    mask[p] = 0;
    removed++;
    const px = p % w, py = (p - px) / w;
    if (px > 0) seed(p - 1);
    if (px < w - 1) seed(p + 1);
    if (py > 0) seed(p - w);
    if (py < h - 1) seed(p + w);
  }
  // a borda do objeto mistura a cor dele com a do fundo (antisserrilhado): sem tirar 1 px, sobra um "contorno" do fundo
  for (let k = 0; k < shrink; k++) removed += erodeMask(mask, w, h);
  return { mask: feather > 0 ? featherMask(mask, w, h, feather) : mask, colors, removed };
}

/** Tira 1 px do objeto em volta de tudo que já é fundo (4 vizinhos). Altera `mask` no lugar; devolve quantos saíram. */
export function erodeMask(mask, w, h) {
  const edge = [];
  for (let p = 0; p < w * h; p++) {
    if (!mask[p]) continue;
    const x = p % w;
    if ((x > 0 && !mask[p - 1]) || (x < w - 1 && !mask[p + 1]) || (p >= w && !mask[p - w]) || (p < w * (h - 1) && !mask[p + w])) edge.push(p);
  }
  for (const p of edge) mask[p] = 0;
  return edge.length;
}

/** Suaviza a máscara (desfoque em caixa só no canal da máscara). */
export function featherMask(mask, w, h, radius) {
  const r = Math.round(num(radius));
  if (r < 1) return new Uint8Array(mask);
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) rgba[p * 4] = mask[p];
  const soft = boxBlur(rgba, w, h, r);
  const out = new Uint8Array(w * h);
  // suaviza só PARA DENTRO (o menor entre a máscara e a versão desfocada): o que já era fundo continua fundo, senão a
  // borda desfocada traria de volta um anel com a cor do fundo em volta do objeto
  for (let p = 0; p < w * h; p++) { const v = soft[p * 4] > 249 ? 255 : soft[p * 4]; out[p] = Math.min(mask[p], v); }
  return out;
}

/**
 * Junta uma seleção (da varinha) à máscara: modo "erase" apaga (vira fundo) e "keep" restaura (volta a aparecer).
 * @returns {Uint8Array} máscara nova
 */
export function combineSelection(mask, sel, mode = 'erase') {
  const out = new Uint8Array(mask);
  const v = mode === 'keep' ? 255 : 0;
  for (let p = 0; p < sel.length; p++) if (sel[p]) out[p] = v;
  return out;
}

/**
 * PINCEL na máscara: círculo de raio `r` em (x, y). `value` 0 = apagar, 255 = restaurar. `hardness` (0..1) é a
 * parte do raio com força total; dali até a borda, a força cai até zero (borda macia). Altera `mask` NO LUGAR
 * (o pincel roda a cada movimento do mouse; copiar a máscara inteira a cada passo ficaria lento) e devolve ela.
 */
export function paintMask(mask, w, h, x, y, r, value, hardness = 0.6) {
  const rad = Math.max(0.5, num(r, 10));
  const inner = rad * clamp(num(hardness, 0.6), 0, 1);
  const x0 = Math.max(0, Math.floor(x - rad)), x1 = Math.min(w - 1, Math.ceil(x + rad));
  const y0 = Math.max(0, Math.floor(y - rad)), y1 = Math.min(h - 1, Math.ceil(y + rad));
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const d = Math.hypot(px + 0.5 - x, py + 0.5 - y);
      if (d > rad) continue;
      const t = d <= inner ? 1 : 1 - (d - inner) / (rad - inner || 1);
      const p = py * w + px;
      mask[p] = Math.round(mask[p] + (value - mask[p]) * t);
    }
  }
  return mask;
}

/** Pinta uma linha do pincel (de a até b), com passos de ¼ do raio: o traço sai contínuo mesmo com o mouse rápido. */
export function paintStroke(mask, w, h, a, b, r, value, hardness) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(len / Math.max(1, r / 4)));
  for (let i = 1; i <= steps; i++) paintMask(mask, w, h, a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps, r, value, hardness);
  return mask;
}

/** Multiplica o alfa de cada pixel pela máscara (0..255). Devolve um array novo. */
export function applyMask(src, mask) {
  const out = new Uint8ClampedArray(src);
  for (let p = 0; p < mask.length; p++) out[p * 4 + 3] = (src[p * 4 + 3] * mask[p] + 127) / 255;
  return out;
}

/** Quanto da imagem a máscara tira (0..1). */
export function maskCoverage(mask) {
  let off = 0;
  for (let p = 0; p < mask.length; p++) off += 255 - mask[p];
  return mask.length ? off / (mask.length * 255) : 0;
}

/** Máscara redimensionada (vizinho mais próximo): para levar a máscara da prévia ao tamanho real e vice-versa. */
export function resizeMask(mask, w, h, nw, nh) {
  const out = new Uint8Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(h - 1, Math.floor(((y + 0.5) * h) / nh));
    for (let x = 0; x < nw; x++) out[y * nw + x] = mask[sy * w + Math.min(w - 1, Math.floor(((x + 0.5) * w) / nw))];
  }
  return out;
}

// ---------------------------------------------------------------- geometria
/** Proporções do recorte (rótulo, largura/altura; null = livre). */
export const CROP_RATIOS = [['Livre', null], ['1:1', 1], ['4:3', 4 / 3], ['16:9', 16 / 9], ['3:2', 3 / 2]];

/** Maior retângulo centralizado com a proporção `ratio` (largura/altura) dentro de w × h. Sem ratio, a imagem toda. */
export function cropForRatio(w, h, ratio) {
  if (!ratio) return { x: 0, y: 0, w, h };
  let cw = w, ch = Math.round(w / ratio);
  if (ch > h) { ch = h; cw = Math.round(h * ratio); }
  return { x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), w: cw, h: ch };
}

/**
 * Ajusta um recorte para caber na imagem, com tamanho mínimo e (se pedido) a proporção. Usado ao arrastar as alças.
 * `anchor` = canto oposto ao que está sendo arrastado ('nw' | 'ne' | 'sw' | 'se'), para manter a proporção a partir dele.
 */
export function clampCrop(c, w, h, ratio = null, min = 8) {
  let { x, y, w: cw, h: ch } = c;
  cw = clamp(Math.round(cw), min, w); ch = clamp(Math.round(ch), min, h);
  if (ratio) {
    if (cw / ch > ratio) cw = Math.round(ch * ratio); else ch = Math.round(cw / ratio);
    if (cw > w) { cw = w; ch = Math.round(w / ratio); }
    if (ch > h) { ch = h; cw = Math.round(h * ratio); }
  }
  x = clamp(Math.round(x), 0, w - cw); y = clamp(Math.round(y), 0, h - ch);
  return { x, y, w: cw, h: ch };
}

/** Tamanho final com largura máxima (mantém a proporção; nunca aumenta). */
export function fitWidth(w, h, maxW) {
  const m = Math.round(num(maxW));
  if (!m || m >= w) return { w, h };
  return { w: m, h: Math.max(1, Math.round((h * m) / w)) };
}

/** "184 KB", "1,2 MB" (base 1024, vírgula decimal). */
export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
/** Bytes de um data URL base64 (sem decodificar). */
export function dataUrlBytes(url) {
  const i = String(url).indexOf(',');
  if (i < 0) return 0;
  const b64 = String(url).slice(i + 1);
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
}

/**
 * PLANO DA EDIÇÃO GENERATIVA. A API de imagens trabalha num quadrado (ex.: 1024 × 1024). Para qualquer proporção:
 *  - a área de saída E (a imagem, ou a imagem + as margens de "Expandir") é encaixada no quadrado, centralizada;
 *  - a imagem original ocupa o retângulo R dentro de E;
 *  - depois, o servidor devolve o quadrado e a tela recorta E de volta, no tamanho outW × outH.
 * @param {{w:number,h:number,size?:number,expand?:{top?:number,right?:number,bottom?:number,left?:number}}} o
 *        expand em px da imagem original (só no modo Expandir)
 * @returns {{size:number, scale:number, out:{x,y,w,h}, image:{x,y,w,h}, outW:number, outH:number}}
 */
export function planGenerative({ w, h, size = 1024, expand = null }) {
  const e = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const k of Object.keys(e)) e[k] = Math.max(0, Math.round(num(expand?.[k])));
  const outW = w + e.left + e.right, outH = h + e.top + e.bottom;
  const scale = size / Math.max(outW, outH);
  const ow = Math.round(outW * scale), oh = Math.round(outH * scale);
  const out = { x: Math.floor((size - ow) / 2), y: Math.floor((size - oh) / 2), w: ow, h: oh };
  const image = { x: out.x + Math.round(e.left * scale), y: out.y + Math.round(e.top * scale), w: Math.round(w * scale), h: Math.round(h * scale) };
  return { size, scale, out, image, outW, outH };
}

// ---------------------------------------------------------------- multipart (servidor)
/**
 * Monta um corpo multipart/form-data (o formato de envio de arquivos por formulário), que o POST /images/edits
 * das APIs compatíveis com a OpenAI exige. Sem dependências: concatena as partes em bytes.
 * @param {{name:string, value?:string, data?:Uint8Array, filename?:string, type?:string}[]} parts
 *        texto (value) ou arquivo (data + filename + type)
 * @param {string} [boundary]  separador (precisa não aparecer no conteúdo; o padrão é aleatório o bastante)
 * @returns {{body: Uint8Array, contentType: string, boundary: string}}
 */
export function buildMultipart(parts, boundary = `----stylo${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`) {
  const enc = new TextEncoder();
  const chunks = [];
  const safe = (s) => String(s).replace(/["\r\n]/g, '_');
  for (const p of parts) {
    if (p == null || (p.value == null && !p.data)) continue;
    let head = `--${boundary}\r\nContent-Disposition: form-data; name="${safe(p.name)}"`;
    if (p.data) head += `; filename="${safe(p.filename || 'arquivo')}"\r\nContent-Type: ${p.type || 'application/octet-stream'}`;
    chunks.push(enc.encode(`${head}\r\n\r\n`));
    chunks.push(p.data ? p.data : enc.encode(String(p.value)));
    chunks.push(enc.encode('\r\n'));
  }
  chunks.push(enc.encode(`--${boundary}--\r\n`));
  const body = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
  let at = 0;
  for (const c of chunks) { body.set(c, at); at += c.length; }
  return { body, contentType: `multipart/form-data; boundary=${boundary}`, boundary };
}

/** Lê um data URL de imagem: { type, bytes } ou null se não for imagem base64. */
export function parseDataUrl(url) {
  const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(url || ''));
  if (!m) return null;
  return { type: m[1], b64: m[2].replace(/\s+/g, '') };
}
