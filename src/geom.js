/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  geom.js — GEOMETRIA DOS VETORES (sem DOM, sem dependências; testável no Node)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Pontos de vetor: { x, y, hin, hout, mode? } — hin/hout são as alças (null = sem alça) e `mode` diz como as alças
 *  se comportam ao arrastar uma delas:
 *    'mirror' → espelhadas (mesma direção oposta e mesmo comprimento: curva suave e simétrica)
 *    'asym'   → assimétricas (direção oposta, mas cada uma com o seu comprimento)
 *    'free'   → independentes (cada alça vai para onde quiser: forma um bico)
 *  Sem `mode`, o tipo é deduzido das alças (pointMode).
 *
 *  Conteúdo:
 *    rdp / fitCurve / smoothStroke     → lápis à mão livre (simplificação + ajuste de curvas de Bézier)
 *    flattenContour                    → curvas → polígono (para as booleanas)
 *    booleanPolygons                   → unir / subtrair / interseção / excluir entre polígonos
 *    polygonsToContours                → polígono do resultado → pontos de vetor (com curvas reajustadas)
 *    pointMode / dragHandle / smoothPoint / reversePoints → edição de pontos
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

// ------------------------------------------------------------------ vetores 2D básicos
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const len = (a) => Math.hypot(a.x, a.y);
const norm = (a) => { const l = len(a); return l ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Ponto da Bézier cúbica (a, c1, c2, b) em t. */
export function cubicAt(a, c1, c2, b, t) {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  };
}

// ------------------------------------------------------------------ edição de pontos
/**
 * Tipo do ponto: 'corner' (sem alças), 'mirror', 'asym' ou 'free'. Usa `pt.mode` quando existe e o ponto tem alças;
 * senão deduz: alças opostas e iguais = mirror; opostas e de tamanhos diferentes = asym; o resto = free.
 */
export function pointMode(pt) {
  if (!pt) return null;
  if (!pt.hin && !pt.hout) return 'corner';
  if (pt.mode && pt.mode !== 'corner') return pt.mode;
  if (!pt.hin || !pt.hout) return 'free';
  const a = sub(pt.hout, pt), b = sub(pt, pt.hin);
  const la = len(a), lb = len(b);
  if (!la || !lb) return 'free';
  const cos = dot(a, b) / (la * lb);
  if (cos < 0.999) return 'free';
  return Math.abs(la - lb) < 0.01 * Math.max(la, lb) ? 'mirror' : 'asym';
}

/**
 * Move a alça `kind` ('hin'|'hout') do ponto para `pos`, respeitando o modo do ponto:
 * mirror → a outra alça espelha; asym → a outra fica na direção oposta mas mantém o comprimento; free → só esta.
 * `breakMirror` (Alt) força 'free' e grava isso no ponto. Altera `pt` e o devolve.
 */
export function dragHandle(pt, kind, pos, breakMirror = false) {
  const other = kind === 'hin' ? 'hout' : 'hin';
  let mode = pointMode(pt);
  if (breakMirror) { mode = 'free'; pt.mode = 'free'; }
  pt[kind] = { x: pos.x, y: pos.y };
  if (pt[other] && mode !== 'free' && mode !== 'corner') {
    const v = sub(pt, pos);
    const l = mode === 'mirror' ? len(v) : len(sub(pt[other], pt));
    const d = norm(v);
    pt[other] = { x: pt.x + d.x * l, y: pt.y + d.y * l };
  }
  return pt;
}

/**
 * Transforma o ponto `pts[i]` num ponto CURVO (alças ao longo da direção vizinho anterior → próximo, com 1/4 da
 * distância entre eles) ou num CANTO (tira as alças). Num ponto da ponta de um caminho aberto, usa o único vizinho.
 */
export function smoothPoint(pts, i, closed, mode = 'mirror') {
  const pt = pts[i];
  const n = pts.length;
  const prev = i > 0 || closed ? pts[(i - 1 + n) % n] : null;
  const next = i < n - 1 || closed ? pts[(i + 1) % n] : null;
  let v;
  if (prev && next) v = mul(sub(next, prev), 0.25);
  else if (next) v = mul(sub(next, pt), 1 / 3);
  else if (prev) v = mul(sub(pt, prev), 1 / 3);
  else v = { x: 10, y: 0 };
  if (!len(v)) v = { x: 10, y: 0 };
  pt.hout = add(pt, v);
  pt.hin = sub(pt, v);
  pt.mode = mode;
  return pt;
}

/** Ponto de canto: tira as alças. */
export function cornerPoint(pt) {
  pt.hin = null; pt.hout = null; delete pt.mode;
  return pt;
}

/** Inverte a direção do caminho (troca hin/hout de cada ponto). Devolve uma lista nova. */
export function reversePoints(pts) {
  return [...pts].reverse().map((p) => {
    const q = { x: p.x, y: p.y, hin: p.hout || null, hout: p.hin || null };
    if (p.mode) q.mode = p.mode;
    return q;
  });
}

// ------------------------------------------------------------------ lápis: simplificação e ajuste de curvas
/** Distância do ponto p ao segmento a–b. */
function segDist(p, a, b) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (!l2) return dist(p, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return dist(p, add(a, mul(ab, t)));
}

/**
 * Ramer–Douglas–Peucker: remove pontos que se desviam menos que `eps` da reta entre os vizinhos que ficam.
 * Iterativo (não estoura a pilha com traços longos). Devolve pontos {x, y}.
 */
export function rdp(points, eps) {
  const n = points.length;
  if (n < 3) return points.map((p) => ({ x: p.x, y: p.y }));
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let md = -1, mi = -1;
    for (let i = s + 1; i < e; i++) {
      const d = segDist(points[i], points[s], points[e]);
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps && mi > 0) { keep[mi] = 1; stack.push([s, mi], [mi, e]); }
  }
  return points.filter((_, i) => keep[i]).map((p) => ({ x: p.x, y: p.y }));
}

/**
 * Ajusta curvas de Bézier cúbicas a uma sequência de pontos (algoritmo de Philip J. Schneider, "Graphics Gems", 1990).
 * Divide recursivamente onde o erro passa de `error` px. Devolve pontos de vetor { x, y, hin, hout, mode }:
 * os pontos internos ficam com alças alinhadas (curva contínua).
 */
export function fitCurve(points, error = 4) {
  const pts = [];
  for (const p of points) if (!pts.length || dist(pts[pts.length - 1], p) > 1e-6) pts.push({ x: p.x, y: p.y });
  if (pts.length < 2) return pts.map((p) => ({ ...p, hin: null, hout: null }));
  const segs = []; // [a, c1, c2, b]
  const t1 = norm(sub(pts[1], pts[0]));
  const t2 = norm(sub(pts[pts.length - 2], pts[pts.length - 1]));
  fitCubic(pts, 0, pts.length - 1, t1, t2, error, segs, 0);
  const out = [{ x: segs[0][0].x, y: segs[0][0].y, hin: null, hout: segs[0][1] }];
  for (let i = 0; i < segs.length; i++) {
    const [, , c2, b] = segs[i];
    const nx = segs[i + 1];
    out.push({ x: b.x, y: b.y, hin: c2, hout: nx ? nx[1] : null });
  }
  for (const p of out) { p.mode = pointMode({ ...p, mode: undefined }); if (p.mode === 'corner') delete p.mode; }
  return out;
}

function fitCubic(d, first, last, tHat1, tHat2, error, out, depth) {
  const nPts = last - first + 1;
  if (nPts === 2) {
    const dd = dist(d[first], d[last]) / 3;
    out.push([d[first], add(d[first], mul(tHat1, dd)), add(d[last], mul(tHat2, dd)), d[last]]);
    return;
  }
  let u = chordLength(d, first, last);
  let bez = generateBezier(d, first, last, u, tHat1, tHat2);
  let [maxErr, split] = maxError(d, first, last, bez, u);
  if (maxErr < error) { out.push(bez); return; }
  if (maxErr < error * 4) {
    for (let k = 0; k < 4; k++) {
      u = reparameterize(d, first, last, u, bez);
      bez = generateBezier(d, first, last, u, tHat1, tHat2);
      [maxErr, split] = maxError(d, first, last, bez, u);
      if (maxErr < error) { out.push(bez); return; }
    }
  }
  if (depth > 40) { out.push(bez); return; }
  // divide no ponto de maior erro; a tangente no meio é a média dos vizinhos (curva continua suave)
  split = Math.max(first + 1, Math.min(last - 1, split));
  let tc = norm(sub(d[split - 1], d[split + 1]));
  if (!len(tc)) tc = norm(sub(d[split - 1], d[split]));
  fitCubic(d, first, split, tHat1, tc, error, out, depth + 1);
  fitCubic(d, split, last, mul(tc, -1), tHat2, error, out, depth + 1);
}

function chordLength(d, first, last) {
  const u = [0];
  for (let i = first + 1; i <= last; i++) u.push(u[u.length - 1] + dist(d[i], d[i - 1]));
  const tot = u[u.length - 1] || 1;
  return u.map((x) => x / tot);
}

function generateBezier(d, first, last, u, tHat1, tHat2) {
  const p0 = d[first], p3 = d[last];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < u.length; i++) {
    const t = u[i], s = 1 - t;
    const a1 = mul(tHat1, 3 * s * s * t), a2 = mul(tHat2, 3 * s * t * t);
    c00 += dot(a1, a1); c01 += dot(a1, a2); c11 += dot(a2, a2);
    const base = add(add(mul(p0, s * s * s + 3 * s * s * t), mul(p3, 3 * s * t * t + t * t * t)), { x: 0, y: 0 });
    const tmp = sub(d[first + i], base);
    x0 += dot(a1, tmp); x1 += dot(a2, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  let al = det ? (x0 * c11 - x1 * c01) / det : 0;
  let ar = det ? (c00 * x1 - c01 * x0) / det : 0;
  const segLen = dist(p0, p3);
  const eps = 1e-6 * segLen;
  if (al < eps || ar < eps) { al = ar = segLen / 3; }
  return [p0, add(p0, mul(tHat1, al)), add(p3, mul(tHat2, ar)), p3];
}

function reparameterize(d, first, last, u, bez) {
  return u.map((t, i) => newtonRoot(bez, d[first + i], t));
}

function newtonRoot(b, p, t) {
  const q = cubicAt(b[0], b[1], b[2], b[3], t);
  const s = 1 - t;
  const q1 = add(add(mul(sub(b[1], b[0]), 3 * s * s), mul(sub(b[2], b[1]), 6 * s * t)), mul(sub(b[3], b[2]), 3 * t * t));
  const q2 = add(mul(add(sub(b[2], mul(b[1], 2)), b[0]), 6 * s), mul(add(sub(b[3], mul(b[2], 2)), b[1]), 6 * t));
  const num = dot(sub(q, p), q1);
  const den = dot(q1, q1) + dot(sub(q, p), q2);
  if (!den) return t;
  const r = t - num / den;
  return Math.max(0, Math.min(1, r));
}

function maxError(d, first, last, bez, u) {
  let maxD = 0, split = Math.floor((last - first + 1) / 2) + first;
  for (let i = first + 1; i < last; i++) {
    const p = cubicAt(bez[0], bez[1], bez[2], bez[3], u[i - first]);
    const e = dist(p, d[i]);
    if (e > maxD) { maxD = e; split = i; }
  }
  return [maxD, split];
}

/**
 * Traço do LÁPIS → pontos de vetor. `level` (0..100) é a suavização: 0 segue o traço quase exatamente,
 * 100 vira poucas curvas largas. `scale` = px de tela por unidade (para a tolerância valer em px de tela).
 * Etapas: tira pontos repetidos/colados → RDP (tira o tremido) → ajuste de curvas de Schneider.
 */
export function smoothStroke(raw, level = 50, scale = 1) {
  const lv = Math.max(0, Math.min(100, Number(level) || 0)) / 100;
  const pts = [];
  for (const p of raw) if (!pts.length || dist(pts[pts.length - 1], p) * scale > 0.75) pts.push({ x: p.x, y: p.y });
  if (pts.length < 2) return pts.map((p) => ({ ...p, hin: null, hout: null }));
  const simplified = rdp(pts, (0.3 + lv * 3) / scale);
  // o ajuste usa os pontos densos (curva fiel) mas com tolerância que cresce com a suavização
  const dense = lv > 0.05 ? densify(simplified, 4 / scale) : simplified;
  if (lv <= 0.05) return simplified.map((p) => ({ ...p, hin: null, hout: null }));
  return fitCurve(dense, (1 + lv * 10) / scale);
}

/** Acrescenta pontos intermediários para nenhum trecho passar de `step`. */
function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

// ------------------------------------------------------------------ curvas → polígonos
/**
 * Achata um contorno (pontos com alças) em polígono. Cada curva vira N retas (N pela extensão do polígono de
 * controle e pela tolerância `tol` em unidades do desenho). Retas ficam como estão.
 */
export function flattenContour(points, closed, tol = 0.5) {
  const out = [];
  const n = points.length;
  if (!n) return out;
  out.push({ x: points[0].x, y: points[0].y });
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = points[i], b = points[(i + 1) % n];
    if (!a.hout && !b.hin) { out.push({ x: b.x, y: b.y }); continue; }
    const c1 = a.hout || a, c2 = b.hin || b;
    const ctrl = dist(a, c1) + dist(c1, c2) + dist(c2, b);
    const steps = Math.max(4, Math.min(200, Math.ceil(Math.sqrt(ctrl / Math.max(tol, 1e-3)) * 1.5)));
    for (let k = 1; k <= steps; k++) out.push(cubicAt(a, c1, c2, b, k / steps));
  }
  if (closed && out.length > 1 && dist(out[0], out[out.length - 1]) < 1e-9) out.pop();
  return out;
}

/** Área com sinal do polígono (positiva = sentido horário na tela, com y para baixo). */
export function polygonArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/** Número de voltas (winding) dos anéis em torno de p. */
function winding(rings, p) {
  let w = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (a.y <= p.y) {
        if (b.y > p.y && (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y) > 0) w++;
      } else if (b.y <= p.y && (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y) < 0) w--;
    }
  }
  return w;
}

/** p está dentro da forma (anéis + regra de preenchimento)? */
export function insideShape(shape, p) {
  const w = winding(shape.rings, p);
  return shape.rule === 'evenodd' ? (w & 1) === 1 : w !== 0;
}

/**
 * OPERAÇÃO BOOLEANA entre formas poligonais. Cada forma: { rings: [[{x,y}...]...], rule: 'nonzero'|'evenodd' }.
 * op: 'union' (unir), 'subtract' (a 1ª menos as outras), 'intersect' (só onde todas se sobrepõem),
 *     'exclude' (onde um número ÍMPAR de formas se sobrepõe).
 *
 * Como funciona (sem dependências, robusto a bordas coincidentes):
 *  1. Junta todas as arestas e as divide em TODOS os cruzamentos (inclusive pontas encostadas no meio de outra aresta).
 *  2. Para cada pedacinho, testa um ponto um pouco à esquerda e outro à direita: a aresta faz parte da borda do
 *     resultado se um lado está DENTRO do resultado e o outro FORA. Ela é orientada com o "dentro" sempre do mesmo lado
 *     (assim furos saem no sentido contrário e a regra nonzero funciona).
 *  3. Encadeia as arestas que sobraram em anéis fechados.
 * Devolve uma lista de anéis (polígonos) — vazia se o resultado é vazio.
 */
export function booleanPolygons(shapes, op) {
  const valid = shapes.filter((s) => s.rings.some((r) => r.length >= 3));
  if (!valid.length) return [];
  const test = (p) => {
    const ins = valid.map((s) => insideShape(s, p));
    if (op === 'union') return ins.some(Boolean);
    if (op === 'intersect') return ins.every(Boolean);
    if (op === 'subtract') return ins[0] && !ins.slice(1).some(Boolean);
    if (op === 'exclude') return ins.filter(Boolean).length % 2 === 1;
    throw new Error(`operação booleana desconhecida: ${op}`);
  };
  // escala do desenho (para as tolerâncias)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of valid) for (const r of s.rings) for (const p of r) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const size = Math.max(x1 - x0, y1 - y0, 1e-6);
  const EPS = size * 1e-9;
  // 1) arestas
  const edges = [];
  for (const s of valid) {
    for (const r of s.rings) {
      if (r.length < 3) continue;
      for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length];
        if (dist(a, b) > EPS) edges.push({ a, b, cuts: [] });
      }
    }
  }
  // 2) cruzamentos (O(n²), suficiente para formas de editor). Ponto de corte compartilhado pelas duas arestas.
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const ex0 = Math.min(e.a.x, e.b.x) - EPS, ex1 = Math.max(e.a.x, e.b.x) + EPS, ey0 = Math.min(e.a.y, e.b.y) - EPS, ey1 = Math.max(e.a.y, e.b.y) + EPS;
    for (let j = i + 1; j < edges.length; j++) {
      const f = edges[j];
      if (Math.max(f.a.x, f.b.x) < ex0 || Math.min(f.a.x, f.b.x) > ex1 || Math.max(f.a.y, f.b.y) < ey0 || Math.min(f.a.y, f.b.y) > ey1) continue;
      intersectEdges(e, f, EPS);
    }
  }
  // 3) pedaços + classificação
  const OFF = size * 1e-6;
  const kept = new Map();
  const key = (p) => `${Math.round(p.x / (size * 1e-7))},${Math.round(p.y / (size * 1e-7))}`;
  for (const e of edges) {
    const cuts = e.cuts.sort((m, n) => m.t - n.t);
    const seq = [e.a, ...cuts.map((c) => c.p), e.b];
    for (let k = 1; k < seq.length; k++) {
      const p = seq[k - 1], q = seq[k];
      const d = dist(p, q);
      if (d <= EPS * 10) continue;
      const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
      const nx = (-(q.y - p.y) / d) * OFF, ny = ((q.x - p.x) / d) * OFF;
      const L = test({ x: m.x + nx, y: m.y + ny }), R = test({ x: m.x - nx, y: m.y - ny });
      if (L === R) continue;
      const [s, t] = L ? [p, q] : [q, p];
      const k1 = key(s), k2 = key(t);
      if (k1 === k2) continue;
      const id = `${k1}>${k2}`;
      if (!kept.has(id)) kept.set(id, { s, t, k1, k2, used: false });
    }
  }
  // 4) encadear em anéis
  const byStart = new Map();
  for (const e of kept.values()) {
    if (!byStart.has(e.k1)) byStart.set(e.k1, []);
    byStart.get(e.k1).push(e);
  }
  const rings = [];
  for (const start of kept.values()) {
    if (start.used) continue;
    const ring = [];
    let e = start;
    let guard = kept.size + 2;
    while (e && !e.used && guard-- > 0) {
      e.used = true;
      ring.push(e.s);
      if (e.k2 === start.k1) break;
      const nexts = (byStart.get(e.k2) || []).filter((x) => !x.used);
      if (!nexts.length) { e = null; break; }
      // em cruzamentos com várias saídas, vira o MÍNIMO possível à esquerda (mantém os anéis simples)
      if (nexts.length > 1) {
        const din = norm(sub(e.t, e.s));
        nexts.sort((u, v) => turn(din, u) - turn(din, v));
      }
      e = nexts[0];
    }
    if (ring.length >= 3 && Math.abs(polygonArea(ring)) > size * size * 1e-9) rings.push(ring);
  }
  return rings;
}

function turn(din, e) {
  const dv = norm(sub(e.t, e.s));
  return Math.atan2(din.x * dv.y - din.y * dv.x, dot(din, dv));
}

/** Registra o(s) ponto(s) de encontro entre as arestas e e f (cruzamento ou sobreposição colinear). */
function intersectEdges(e, f, EPS) {
  const r = sub(e.b, e.a), s = sub(f.b, f.a);
  const den = r.x * s.y - r.y * s.x;
  const qp = sub(f.a, e.a);
  const lr = len(r), ls = len(s);
  if (Math.abs(den) > EPS * Math.max(lr, ls)) {
    const t = (qp.x * s.y - qp.y * s.x) / den;
    const u = (qp.x * r.y - qp.y * r.x) / den;
    const te = EPS / lr, tf = EPS / ls;
    if (t < -te || t > 1 + te || u < -tf || u > 1 + tf) return;
    const p = add(e.a, mul(r, t));
    if (t > te && t < 1 - te) e.cuts.push({ t, p: u <= tf ? f.a : u >= 1 - tf ? f.b : p });
    if (u > tf && u < 1 - tf) f.cuts.push({ t: u, p: t <= te ? e.a : t >= 1 - te ? e.b : p });
    return;
  }
  // paralelas: só importa se colineares (sobreposição) — cada ponta que cai no meio da outra aresta vira corte
  if (Math.abs(qp.x * r.y - qp.y * r.x) > EPS * lr * 10) return;
  const onEdge = (g, p) => {
    const v = sub(g.b, g.a), l2 = dot(v, v);
    const t = dot(sub(p, g.a), v) / l2;
    const tol = EPS / Math.sqrt(l2);
    if (t > tol && t < 1 - tol) g.cuts.push({ t, p });
  };
  onEdge(e, f.a); onEdge(e, f.b); onEdge(f, e.a); onEdge(f, e.b);
}

/**
 * Anéis do resultado → contornos de vetor. Tira pontos colineares (RDP com `tol`) e, com `smooth`, reajusta curvas
 * nos trechos que eram curvos (sequências de muitos pontos com pouca virada), mantendo as QUINAS (virada > 30°) como
 * pontos de canto. Devolve [{ points, closed: true }].
 */
export function polygonsToContours(rings, { tol = 0.1, smooth = true } = {}) {
  return rings.map((ring) => {
    const closedRing = [...ring, ring[0]];
    let pts = rdp(closedRing, tol);
    pts.pop();
    if (pts.length < 3) pts = ring.map((p) => ({ x: p.x, y: p.y }));
    if (!smooth || ring.length < 8) return { closed: true, points: pts.map((p) => ({ x: p.x, y: p.y, hin: null, hout: null })) };
    return { closed: true, points: refitRing(ring, tol) };
  });
}

/** Reajusta curvas num anel fechado, quebrando nas quinas. */
function refitRing(ring, tol) {
  const n = ring.length;
  const corner = ring.map((p, i) => {
    const a = ring[(i - 1 + n) % n], b = ring[(i + 1) % n];
    const u = norm(sub(p, a)), v = norm(sub(b, p));
    return Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) > (30 * Math.PI) / 180;
  });
  let first = corner.indexOf(true);
  if (first < 0) {
    // sem quinas (círculo, gota): ajusta como um caminho que começa e termina no mesmo ponto
    const fit = fitCurve([...ring, ring[0]], Math.max(tol * 2, 0.25));
    const last = fit.pop();
    fit[0].hin = last.hin;
    fit[0].mode = pointMode({ ...fit[0], mode: undefined });
    return fit;
  }
  const out = [];
  let i = first;
  do {
    let j = (i + 1) % n;
    const run = [ring[i]];
    while (!corner[j] && j !== first) { run.push(ring[j]); j = (j + 1) % n; }
    run.push(ring[j]);
    const fit = run.length > 3 ? fitCurve(run, Math.max(tol * 2, 0.25)) : run.map((p) => ({ x: p.x, y: p.y, hin: null, hout: null }));
    // cola o pedaço: o primeiro ponto do pedaço é o último do anterior (une as alças)
    if (out.length) {
      const prevEnd = out[out.length - 1];
      prevEnd.hout = fit[0].hout;
      fit.shift();
    }
    out.push(...fit);
    i = j;
  } while (i !== first);
  // o último ponto repetiu o primeiro: transfere a alça de entrada e tira
  const end = out.pop();
  out[0].hin = end.hin;
  for (const p of out) { delete p.mode; const m = pointMode(p); if (m !== 'corner' && p.hin && p.hout) p.mode = m; }
  return out;
}

// ------------------------------------------------------------------ formas simples → contornos
const K = 0.5522847498; // constante para aproximar um quarto de círculo com uma Bézier cúbica

/** Elipse w×h (origem no canto) como 4 pontos curvos. */
export function ellipseContour(w, h) {
  const rx = w / 2, ry = h / 2, cx = rx, cy = ry, kx = rx * K, ky = ry * K;
  return [
    { x: cx, y: 0, hin: { x: cx - kx, y: 0 }, hout: { x: cx + kx, y: 0 } },
    { x: w, y: cy, hin: { x: w, y: cy - ky }, hout: { x: w, y: cy + ky } },
    { x: cx, y: h, hin: { x: cx + kx, y: h }, hout: { x: cx - kx, y: h } },
    { x: 0, y: cy, hin: { x: 0, y: cy + ky }, hout: { x: 0, y: cy - ky } },
  ];
}

/** Retângulo w×h com cantos arredondados [tl, tr, br, bl] (raios limitados à metade do lado). */
export function rectContour(w, h, radius = [0, 0, 0, 0]) {
  const lim = Math.min(w, h) / 2;
  const [tl, tr, br, bl] = [0, 1, 2, 3].map((i) => Math.max(0, Math.min(lim, Number(radius?.[i]) || 0)));
  const pts = [];
  const corner = (r, px, py, ax, ay, bx, by) => {
    // (px,py) = vértice; (ax,ay) = direção de chegada; (bx,by) = direção de saída
    if (!r) { pts.push({ x: px, y: py, hin: null, hout: null }); return; }
    const p1 = { x: px - ax * r, y: py - ay * r }, p2 = { x: px + bx * r, y: py + by * r };
    pts.push({ x: p1.x, y: p1.y, hin: null, hout: { x: p1.x + ax * r * K, y: p1.y + ay * r * K } });
    pts.push({ x: p2.x, y: p2.y, hin: { x: p2.x - bx * r * K, y: p2.y - by * r * K }, hout: null });
  };
  corner(tl, 0, 0, 0, -1, 1, 0);
  corner(tr, w, 0, 1, 0, 0, 1);
  corner(br, w, h, 0, 1, -1, 0);
  corner(bl, 0, h, -1, 0, 0, -1);
  return pts;
}
