// Contas do canvas, sem tela nem DOM (por isso dá para testar): encaixe (snap) nas bordas e centros dos vizinhos, medidas entre
// camadas, redimensionar com rotação/proporção/centro, escala de várias camadas e a posição de soltura num auto layout.

export interface Box { x: number; y: number; w: number; h: number }
/** Uma linha-guia rosa do encaixe: `axis:'x'` = linha vertical em x=pos, indo de `from` a `to` em y. */
export interface SnapGuide { axis: 'x' | 'y'; pos: number; from: number; to: number }

export const SNAP_PX = 6;

export function union(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export const intersects = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const contains = (outer: Box, inner: Box) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
export const normalize = (a: { x: number; y: number }, b: { x: number; y: number }): Box => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

interface Targets { rects: Box[]; guidesX: number[]; guidesY: number[] }

/**
 * Encaixe ao MOVER: ajusta (dx, dy) para que bordas e centro da caixa alinhem com as dos vizinhos e com as guias de régua,
 * quando estiverem a menos de `threshold` (6 px de tela ÷ zoom). Devolve também as linhas-guia onde houve alinhamento exato.
 */
export function snapMove(b: Box, dx: number, dy: number, { rects, guidesX, guidesY }: Targets, threshold: number): { dx: number; dy: number; guides: SnapGuide[] } {
  const xs = [...guidesX], ys = [...guidesY];
  for (const r of rects) { xs.push(r.x, r.x + r.w / 2, r.x + r.w); ys.push(r.y, r.y + r.h / 2, r.y + r.h); }
  const best = (cands: number[], edges: number[]) => {
    let delta = 0, min = threshold;
    for (const c of cands) for (const m of edges) if (Math.abs(c - m) < min) { min = Math.abs(c - m); delta = c - m; }
    return min < threshold ? delta : 0;
  };
  dx += best(xs, [b.x + dx, b.x + b.w / 2 + dx, b.x + b.w + dx]);
  dy += best(ys, [b.y + dy, b.y + b.h / 2 + dy, b.y + b.h + dy]);
  const guides: SnapGuide[] = [];
  const mx = [b.x + dx, b.x + b.w / 2 + dx, b.x + b.w + dx];
  const my = [b.y + dy, b.y + b.h / 2 + dy, b.y + b.h + dy];
  for (const r of rects) {
    const rx = [r.x, r.x + r.w / 2, r.x + r.w], ry = [r.y, r.y + r.h / 2, r.y + r.h];
    for (const m of mx) for (const c of rx) if (Math.abs(m - c) < 0.5) guides.push({ axis: 'x', pos: c, from: Math.min(r.y, b.y + dy), to: Math.max(r.y + r.h, b.y + b.h + dy) });
    for (const m of my) for (const c of ry) if (Math.abs(m - c) < 0.5) guides.push({ axis: 'y', pos: c, from: Math.min(r.x, b.x + dx), to: Math.max(r.x + r.w, b.x + b.w + dx) });
  }
  for (const g of guidesX) if (mx.some((m) => Math.abs(m - g) < 0.5)) guides.push({ axis: 'x', pos: g, from: Math.min(b.y + dy, ...rects.map((r) => r.y)), to: Math.max(b.y + b.h + dy, ...rects.map((r) => r.y + r.h)) });
  for (const g of guidesY) if (my.some((m) => Math.abs(m - g) < 0.5)) guides.push({ axis: 'y', pos: g, from: Math.min(b.x + dx, ...rects.map((r) => r.x)), to: Math.max(b.x + b.w + dx, ...rects.map((r) => r.x + r.w)) });
  return { dx, dy, guides };
}

/**
 * Encaixe ao REDIMENSIONAR: só a borda que a alça puxa (hx/hy = ±1) procura um alvo (bordas dos vizinhos/pai e guias).
 * Centros não entram: grudar neles atrapalharia quem quer um tamanho livre.
 */
export function snapResize(b: Box, dx: number, dy: number, hx: number, hy: number, { rects, guidesX, guidesY }: Targets, threshold: number): { dx: number; dy: number; guides: SnapGuide[] } {
  const xs = [...guidesX], ys = [...guidesY];
  for (const r of rects) { xs.push(r.x, r.x + r.w); ys.push(r.y, r.y + r.h); }
  const nearest = (cands: number[], v: number) => {
    let best: number | null = null, min = threshold;
    for (const c of cands) if (Math.abs(c - v) < min) { min = Math.abs(c - v); best = c; }
    return best;
  };
  const guides: SnapGuide[] = [];
  if (hx) {
    const edge = (hx === 1 ? b.x + b.w : b.x) + dx;
    const t = nearest(xs, edge);
    if (t != null) {
      dx += t - edge;
      const near = rects.filter((r) => [r.x, r.x + r.w].some((c) => Math.abs(c - t) < 0.5));
      const ys2 = [b.y, b.y + b.h, ...near.flatMap((r) => [r.y, r.y + r.h])];
      guides.push({ axis: 'x', pos: t, from: Math.min(...ys2), to: Math.max(...ys2) });
    }
  }
  if (hy) {
    const edge = (hy === 1 ? b.y + b.h : b.y) + dy;
    const t = nearest(ys, edge);
    if (t != null) {
      dy += t - edge;
      const near = rects.filter((r) => [r.y, r.y + r.h].some((c) => Math.abs(c - t) < 0.5));
      const xs2 = [b.x, b.x + b.w, ...near.flatMap((r) => [r.x, r.x + r.w])];
      guides.push({ axis: 'y', pos: t, from: Math.min(...xs2), to: Math.max(...xs2) });
    }
  }
  return { dx, dy, guides };
}

/**
 * Distâncias entre a seleção A e a camada B (o "Alt" do Figma): A dentro de B → as 4 margens internas; separadas → o vão
 * horizontal e/ou vertical no meio da faixa onde as duas se sobrepõem; sobrepostas em parte → nada.
 */
export function measures(A: Box, B: Box): { x1: number; y1: number; x2: number; y2: number; len: number }[] {
  const out: { x1: number; y1: number; x2: number; y2: number; len: number }[] = [];
  const ov = (a0: number, a1: number, b0: number, b1: number): [number, number] => [Math.max(a0, b0), Math.min(a1, b1)];
  if (contains(B, A)) {
    const cy = A.y + A.h / 2, cx = A.x + A.w / 2;
    out.push({ x1: B.x, y1: cy, x2: A.x, y2: cy, len: A.x - B.x }, { x1: A.x + A.w, y1: cy, x2: B.x + B.w, y2: cy, len: B.x + B.w - A.x - A.w },
      { x1: cx, y1: B.y, x2: cx, y2: A.y, len: A.y - B.y }, { x1: cx, y1: A.y + A.h, x2: cx, y2: B.y + B.h, len: B.y + B.h - A.y - A.h });
    return out.filter((m) => m.len > 0.01);
  }
  const [oy0, oy1] = ov(A.y, A.y + A.h, B.y, B.y + B.h);
  const [ox0, ox1] = ov(A.x, A.x + A.w, B.x, B.x + B.w);
  if (oy1 > oy0) {
    const y = (oy0 + oy1) / 2;
    if (A.x + A.w <= B.x) out.push({ x1: A.x + A.w, y1: y, x2: B.x, y2: y, len: B.x - A.x - A.w });
    else if (B.x + B.w <= A.x) out.push({ x1: B.x + B.w, y1: y, x2: A.x, y2: y, len: A.x - B.x - B.w });
  }
  if (ox1 > ox0) {
    const x = (ox0 + ox1) / 2;
    if (A.y + A.h <= B.y) out.push({ x1: x, y1: A.y + A.h, x2: x, y2: B.y, len: B.y - A.y - A.h });
    else if (B.y + B.h <= A.y) out.push({ x1: x, y1: B.y + B.h, x2: x, y2: A.y, len: A.y - B.y - B.h });
  }
  return out.filter((m) => m.len > 0.01);
}

// ---------------------------------------------------------------- redimensionar
export interface ResizeInput {
  x: number; y: number; w: number; h: number; rotation: number;
  hx: number; hy: number;
  /** deslocamento do ponteiro no mundo (já ajustado pelo encaixe) */
  dx: number; dy: number;
  shift: boolean; alt: boolean;
  lockRatio?: boolean;
  /** proporção largura/altura imposta (aspect-ratio do CSS) */
  aspect?: number;
  min?: { w?: number; h?: number }; max?: { w?: number; h?: number };
}

/**
 * Redimensiona UMA camada (com rotação): converte o deslocamento do ponteiro para os eixos da camada, muda w/h e recalcula x/y
 * para que o lado OPOSTO (a âncora) fique parado no mundo. Shift (ou lockRatio/aspect) mantém a proporção; Alt cresce a partir do centro.
 */
export function resizeSingle(i: ResizeInput): { x: number; y: number; w: number; h: number } {
  const rad = (i.rotation * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const ldx = i.dx * cos + i.dy * sin, ldy = -i.dx * sin + i.dy * cos;
  const k = i.alt ? 2 : 1;
  let nw = i.w + i.hx * ldx * k, nh = i.h + i.hy * ldy * k;
  if (i.shift || i.lockRatio || i.aspect) {
    const ratio = i.aspect || i.w / i.h;
    if (i.hx && i.hy) { nw = Math.max(nw, nh * ratio); nh = nw / ratio; }
    else if (i.hx) nh = nw / ratio;
    else nw = nh * ratio;
  }
  const clamp = (v: number, lo?: number, hi?: number) => Math.max(lo ?? 1, hi != null ? Math.min(v, hi) : v);
  nw = Math.round(clamp(nw, i.min?.w, i.max?.w));
  nh = Math.round(clamp(nh, i.min?.h, i.max?.h));
  const a0x = i.alt ? 0 : (-i.hx * i.w) / 2, a0y = i.alt ? 0 : (-i.hy * i.h) / 2;
  const a1x = i.alt ? 0 : (-i.hx * nw) / 2, a1y = i.alt ? 0 : (-i.hy * nh) / 2;
  const c0x = i.x + i.w / 2, c0y = i.y + i.h / 2;
  const ax = c0x + a0x * cos - a0y * sin, ay = c0y + a0x * sin + a0y * cos;
  const c1x = ax - (a1x * cos - a1y * sin), c1y = ay - (a1x * sin + a1y * cos);
  return { x: Math.round(c1x - nw / 2), y: Math.round(c1y - nh / 2), w: nw, h: nh };
}

/** Escala um CONJUNTO pela caixa envolvente (posição relativa e tamanho multiplicados por sx/sy). Devolve a nova caixa e os fatores. */
export function resizeGroupBox(b: Box, hx: number, hy: number, dx: number, dy: number, shift: boolean): { box: Box; sx: number; sy: number } {
  let nw = b.w + hx * dx, nh = b.h + hy * dy;
  if (shift && hx && hy) { const s = Math.max(nw / b.w, nh / b.h); nw = b.w * s; nh = b.h * s; }
  nw = Math.max(1, nw); nh = Math.max(1, nh);
  const sx = hx ? nw / b.w : 1, sy = hy ? nh / b.h : 1;
  return { box: { x: hx === -1 ? b.x + b.w - nw : b.x, y: hy === -1 ? b.y + b.h - nh : b.y, w: nw, h: nh }, sx, sy };
}

/** Onde cada camada de um conjunto vai parar quando o conjunto é escalado (a caixa `from` vira `to`). */
export function scaleInto(item: Box, from: Box, to: Box): Box {
  const sx = from.w ? to.w / from.w : 1, sy = from.h ? to.h / from.h : 1;
  return { x: to.x + (item.x - from.x) * sx, y: to.y + (item.y - from.y) * sy, w: item.w * sx, h: item.h * sy };
}

// ---------------------------------------------------------------- rotacionar
export const angleOf = (cx: number, cy: number, px: number, py: number) => (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
/** Rotação nova: ângulo inicial + quanto o ponteiro girou em torno do centro; Shift trava de 15 em 15°. Resultado em (-180, 180]. */
export function rotateBy(start: number, pointerStart: number, pointerNow: number, snap15: boolean): number {
  let r = start + (pointerNow - pointerStart);
  if (snap15) r = Math.round(r / 15) * 15;
  r = ((((r + 180) % 360) + 360) % 360) - 180;
  return Math.round(r * 10) / 10 || 0;
}

// ---------------------------------------------------------------- auto layout
/**
 * Dentro de um auto layout o item não tem posição livre: arrastar REORDENA. Acha o irmão cujo centro está mais perto do
 * ponteiro e diz onde inserir (antes/depois dele, conforme o ponteiro esteja antes/depois do centro no eixo principal).
 * @returns índice entre `siblings` (a lista dos outros itens em fluxo, já sem o que arrasta) onde o item entra, e a linha de inserção.
 */
export function flowDrop(siblings: Box[], p: { x: number; y: number }, row: boolean): { index: number; line: SnapGuide | null } {
  if (!siblings.length) return { index: 0, line: null };
  let bestD = Infinity, bestI = 0;
  siblings.forEach((b, i) => {
    const d = (b.x + b.w / 2 - p.x) ** 2 + (b.y + b.h / 2 - p.y) ** 2;
    if (d < bestD) { bestD = d; bestI = i; }
  });
  const b = siblings[bestI];
  const after = row ? p.x > b.x + b.w / 2 : p.y > b.y + b.h / 2;
  const line: SnapGuide = row
    ? { axis: 'x', pos: after ? b.x + b.w : b.x, from: b.y, to: b.y + b.h }
    : { axis: 'y', pos: after ? b.y + b.h : b.y, from: b.x, to: b.x + b.w };
  return { index: bestI + (after ? 1 : 0), line };
}
