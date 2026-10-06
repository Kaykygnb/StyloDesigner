/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  css.js — CAMADA → CSS / HTML / SVG   (módulo puro: sem DOM)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  O QUE É
 *    Converte as camadas do documento em CSS real. É a peça que faz o projeto cumprir a promessa
 *    "o canvas é CSS de verdade": o canvas, o painel Código e a exportação HTML/PNG usam EXATAMENTE
 *    as mesmas funções daqui, então não existe diferença entre o que você vê e o que é exportado.
 *
 *  PRINCIPAIS FUNÇÕES
 *    nodeStyle(node, parent)      → objeto { propriedade-css: valor } de uma camada
 *    generateCode(nodes, parent)  → { html, css } com classes legíveis (aba "Código")
 *    exportHtml(node)             → documento HTML completo e standalone
 *    pathSvg / pathData           → markup SVG dos vetores (caneta)
 *    maskClip                     → clip-path das máscaras
 *
 *  DECISÕES IMPORTANTES
 *    - Contorno usa `outline` (não border) para não alterar o layout.
 *    - Auto layout é flexbox/grid de verdade: o navegador calcula as posições; o editor só LÊ o
 *      resultado do DOM (ver canvas.js → measureBack).
 *    - Funções puras: dão para testar no Node (tests/css.test.js).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { isFlow, hasLayout, round, slugify } from './model.js';

/** Formata um número como pixels CSS, arredondado: px(10.004) → "10px". */
const px = (v) => `${round(v)}px`;
/**
 * Tradução dos valores de alinhamento do flexbox (usados no modelo, ex. 'flex-start') para os do CSS Grid
 * ('start'). O grid não aceita 'flex-start' em justify-items/align-items.
 */
const GRID_ALIGN = { 'flex-start': 'start', center: 'center', 'flex-end': 'end', auto: 'start' };

/**
 * Converte uma cor hexadecimal ("#RGB" ou "#RRGGBB") em { r, g, b } (0..255).
 * Entrada inválida vira preto em vez de lançar erro, para o app nunca travar por causa de uma cor ruim.
 */
export function hexToRgb(hex) {
  let h = String(hex || '#000000').replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Monta a cor CSS final. Opacidade total (>= 1) devolve o hex curto "#rrggbb"; menor que 1 devolve
 * "rgba(r, g, b, a)". Assim o código gerado fica o mais limpo possível.
 * @param {string} hex  cor base
 * @param {number} [a=1]  opacidade 0..1
 */
export function rgba(hex, a = 1) {
  const { r, g, b } = hexToRgb(hex);
  if (a >= 1) return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  return `rgba(${r}, ${g}, ${b}, ${round(a, 3)})`;
}

/** Lista de paradas de gradiente em CSS, ordenada por posição: "#7c5cff 0%, #2dd4ff 100%". */
const stopsCss = (stops) =>
  [...stops]
    .sort((a, b) => a.pos - b.pos)
    .map((s) => `${rgba(s.color, s.opacity)} ${round(s.pos)}%`)
    .join(', ');

/**
 * Propriedades CSS de um PREENCHIMENTO (fill). Devolve um objeto { propriedade: valor }.
 *  - solid  → background-color
 *  - linear → background-image: linear-gradient(...)
 *  - radial → background-image: radial-gradient(...)
 *  - image  → background-image: url(data:...) + size/position/repeat (se a imagem não existir mais, cinza neutro)
 *  - none   → nada
 * @param {object} fill  preenchimento (ver model.js → defaultFill)
 * @param {Object<string,string>} [assets]  doc.assets: id → data URL das imagens
 */
export function fillCss(fill, assets = {}) {
  if (!fill) return {};
  switch (fill.type) {
    case 'solid':
      return { 'background-color': rgba(fill.color, fill.opacity) };
    case 'linear':
      return { 'background-image': `linear-gradient(${round(fill.angle)}deg, ${stopsCss(fill.stops)})` };
    case 'radial':
      return { 'background-image': `radial-gradient(circle at center, ${stopsCss(fill.stops)})` };
    case 'image': {
      const src = assets[fill.assetId];
      if (!src) return { 'background-color': '#c4c4c4' };
      return {
        'background-image': `url("${src}")`,
        'background-size': fill.fit === 'fill' ? '100% 100%' : fill.fit,
        'background-position': 'center',
        'background-repeat': 'no-repeat',
      };
    }
    default:
      return {};
  }
}

/** Monta a lista de fontes com alternativas: 'Inter', system-ui, sans-serif. Se o usuário já digitou uma lista (com vírgula), respeita. */
const fontStack = (family) => (family.includes(',') ? family : `'${family}', system-ui, sans-serif`);

/**
 * ★ O CORAÇÃO DO PROJETO ★ — converte UMA camada em CSS.
 * O mesmo resultado é usado em 3 lugares: (1) o canvas (cada camada é um elemento com este estilo),
 * (2) o painel "Código" e (3) a exportação HTML/PNG. Por isso o que você vê no editor é o que o navegador
 * renderiza de verdade.
 *
 * @param {object} node  a camada
 * @param {object|null} parent  o pai (decide se a camada está em fluxo de flex/grid ou é absoluta)
 * @param {Object<string,string>} [assets]  imagens do documento
 * @param {{root?: boolean}} [opts]  `root: true` na exportação: o elemento raiz vira position:relative (sem left/top)
 * @returns {Object<string,string>} propriedades CSS em ordem de inserção (kebab-case)
 */
export function nodeStyle(node, parent, assets = {}, opts = {}) {
  // `s` acumula as propriedades CSS. Ordem importa só para leitura do código gerado.
  const s = {};
  // flow = true quando o PAI tem auto layout e esta camada não é "absoluta": o navegador posiciona.
  const flow = !opts.root && isFlow(node, parent);
  const isText = node.type === 'text';
  // border-box: width/height já incluem padding; é a convenção de todo design tool.
  s['box-sizing'] = 'border-box';

  // ---- posição e tamanho ------------------------------------------------------------
  // 4 casos: (a) raiz da exportação, (b) item de CSS Grid, (c) item de flexbox, (d) camada livre (absolute).
  if (opts.root) {
    s.position = 'relative';
    s.width = px(node.w);
    s.height = px(node.h);
  } else if (flow && parent.layout.mode === 'grid') {
    // (b) Item de GRID: o tamanho 'fill' vira justify-self/align-self: stretch; colSpan/rowSpan viram `span N`.
    s.position = 'relative';
    s.width = node.sizeX === 'fixed' ? px(node.w) : 'auto';
    s.height = node.sizeY === 'fixed' ? px(node.h) : 'auto';
    s['justify-self'] = node.sizeX === 'fill' ? 'stretch' : 'start';
    s['align-self'] = node.sizeY === 'fill' ? 'stretch' : GRID_ALIGN[node.alignSelf] || 'start';
    if ((node.colSpan || 1) > 1) s['grid-column'] = `span ${node.colSpan}`;
    if ((node.rowSpan || 1) > 1) s['grid-row'] = `span ${node.rowSpan}`;
  } else if (flow) {
    // (c) Item de FLEXBOX. "Eixo principal" = o da direção do pai (row → horizontal, column → vertical).
    //   fill no eixo principal  → flex: 1 1 0% (divide o espaço sobrando; min-width:0 evita estourar por conteúdo)
    //   fill no eixo cruzado    → align-self: stretch
    //   fixed                   → flex: 0 0 auto + tamanho em px     |  hug → width/height: auto (tamanho do conteúdo)
    const row = parent.layout.mode === 'row';
    const mainFill = row ? node.sizeX === 'fill' : node.sizeY === 'fill';
    const crossFill = row ? node.sizeY === 'fill' : node.sizeX === 'fill';
    s.position = 'relative';
    s.flex = mainFill ? '1 1 0%' : '0 0 auto';
    if (mainFill) s[row ? 'min-width' : 'min-height'] = '0';
    if (crossFill) s['align-self'] = 'stretch';
    else if (node.alignSelf && node.alignSelf !== 'auto') s['align-self'] = node.alignSelf;
    s.width = node.sizeX === 'fixed' ? px(node.w) : 'auto';
    s.height = node.sizeY === 'fixed' ? px(node.h) : 'auto';
  } else {
    // (d) Camada LIVRE: position:absolute com left/top (x/y do modelo). 'hug' na largura vira max-content.
    s.position = 'absolute';
    s.left = px(node.x);
    s.top = px(node.y);
    s.width = node.sizeX === 'hug' ? 'max-content' : px(node.w);
    s.height = node.sizeY === 'hug' ? 'auto' : px(node.h);
  }

  // ---- auto layout = flexbox ou grid --------------------------------------------------
  // Aplica no PRÓPRIO frame as regras que organizam os filhos. Os nomes do modelo são os do CSS.
  if (hasLayout(node)) {
    const L = node.layout;
    const [t, r, b, l] = L.padding;
    // GRID: colunas iguais (1fr). Em 'hug' as colunas usam max-content para o frame encolher junto com o conteúdo.
    if (L.mode === 'grid') {
      const hug = node.sizeX === 'hug';
      const track = hug ? 'max-content' : 'minmax(0, 1fr)';
      s.display = 'grid';
      s['grid-template-columns'] = `repeat(${L.cols || 2}, ${track})`;
      if (L.rows > 0) s['grid-template-rows'] = `repeat(${L.rows}, minmax(0, 1fr))`;
      s.gap = `${px(L.rowGap ?? L.gap)} ${px(L.colGap ?? L.gap)}`;
      s['justify-items'] = GRID_ALIGN[L.justify] || 'start';
      s['align-items'] = GRID_ALIGN[L.align] || 'start';
    } else {
      // FLEX: direção, gap, justify-content (eixo principal), align-items (eixo cruzado) e quebra de linha opcional.
      s.display = 'flex';
      s['flex-direction'] = L.mode;
      s.gap = px(L.gap);
      s['justify-content'] = L.justify;
      s['align-items'] = L.align;
      if (L.wrap) {
        s['flex-wrap'] = 'wrap';
        s['align-content'] = 'flex-start';
      }
    }
    // padding só entra no CSS se algum lado for diferente de zero (código gerado mais enxuto).
    if (t || r || b || l) s.padding = `${px(t)} ${px(r)} ${px(b)} ${px(l)}`;
  }
  // "Cortar conteúdo" = overflow:hidden. Também faz os filhos respeitarem o border-radius do frame.
  if (node.type === 'frame' && node.clip) s.overflow = 'hidden';

  // Linhas têm um desenho próprio (barra com gradiente) e não usam fill/radius/outline: retorna cedo.
  if (node.type === 'line') {
    lineStyle(node, s, flow);
    return s;
  }

  // ---- texto ------------------------------------------------------------------------
  // Texto usa `color` (não background). white-space: 'pre' = não quebra linha (largura 'hug'); 'pre-wrap' = quebra
  // na largura da caixa e preserva as quebras de linha digitadas.
  if (isText) {
    s['font-family'] = fontStack(node.fontFamily);
    s['font-size'] = px(node.fontSize);
    s['font-weight'] = node.fontWeight;
    if (node.fontStyle !== 'normal') s['font-style'] = node.fontStyle;
    s['line-height'] = node.lineHeight ? String(round(node.lineHeight, 3)) : 'normal';
    if (node.letterSpacing) s['letter-spacing'] = px(node.letterSpacing);
    s['text-align'] = node.textAlign;
    if (node.textDecoration !== 'none') s['text-decoration'] = node.textDecoration;
    if (node.textTransform && node.textTransform !== 'none') s['text-transform'] = node.textTransform;
    // Alinhamento vertical só faz sentido com altura fixa: usa grid + align-content (centro/fim).
    if (node.sizeY === 'fixed' && node.textVAlign && node.textVAlign !== 'top') {
      s.display = 'grid';
      s['align-content'] = node.textVAlign === 'center' ? 'center' : 'end';
    }
    s['white-space'] = node.sizeX === 'hug' ? 'pre' : 'pre-wrap';
    s['overflow-wrap'] = 'break-word';
    // Cor do texto vem do fill. Com GRADIENTE usa o truque `background-clip: text` + `color: transparent`.
    const f = node.fill;
    if (!f || f.type === 'none') s.color = 'transparent';
    else if (f.type === 'solid') s.color = rgba(f.color, f.opacity);
    else {
      Object.assign(s, fillCss(f, assets));
      s['-webkit-background-clip'] = 'text';
      s['background-clip'] = 'text';
      s.color = 'transparent';
    }
  } else if (node.type !== 'path') {
    // Demais camadas: o fill vira background. (Vetores desenham o próprio fill dentro do <svg>.)
    Object.assign(s, fillCss(node.fill, assets));
  }

  // ---- forma ------------------------------------------------------------------------
  // Elipse = border-radius 50%. Retângulos/frames: 1 valor se os 4 cantos forem iguais, senão os 4 valores.
  if (node.type === 'ellipse') s['border-radius'] = '50%';
  else if (node.radius && node.radius.some(Boolean) && !isText) {
    const [a, b, c, d] = node.radius;
    s['border-radius'] = a === b && b === c && c === d ? px(a) : `${px(a)} ${px(b)} ${px(c)} ${px(d)}`;
  }

  // ---- contorno ---------------------------------------------------------------------
  // Usamos `outline` (não border): ele segue o border-radius nos navegadores atuais e NÃO muda o tamanho da caixa
  // nem empurra vizinhos no auto layout. 'inside' = offset negativo (desenha para dentro).
  // Em texto o contorno vira -webkit-text-stroke.
  const st = node.stroke;
  if (st && st.width > 0 && node.type !== 'path') {
    if (isText) {
      s['-webkit-text-stroke'] = `${px(st.width)} ${rgba(st.color, st.opacity)}`;
    } else {
      s.outline = `${px(st.width)} ${st.style} ${rgba(st.color, st.opacity)}`;
      s['outline-offset'] =
        st.position === 'inside' ? px(-st.width) : st.position === 'center' ? px(-st.width / 2) : '0px';
    }
  }

  // ---- efeitos ----------------------------------------------------------------------
  // Sombras: box-shadow (camadas), text-shadow (texto) ou filter: drop-shadow (vetores, que não têm "caixa").
  // blur → filter: blur(); bgBlur → backdrop-filter: blur() (efeito vidro); opacity e mix-blend-mode completam.
  const isPath = node.type === 'path';
  const filters = [];
  if (node.shadows?.length) {
    if (isPath) {
      for (const sh of node.shadows) filters.push(`drop-shadow(${px(sh.x)} ${px(sh.y)} ${px(sh.blur)} ${rgba(sh.color, sh.opacity)})`);
    } else {
      const list = node.shadows.map((sh) =>
        isText
          ? `${px(sh.x)} ${px(sh.y)} ${px(sh.blur)} ${rgba(sh.color, sh.opacity)}`
          : `${sh.inset ? 'inset ' : ''}${px(sh.x)} ${px(sh.y)} ${px(sh.blur)} ${px(sh.spread)} ${rgba(sh.color, sh.opacity)}`,
      );
      s[isText ? 'text-shadow' : 'box-shadow'] = list.join(', ');
    }
  }
  if (node.blur > 0) filters.push(`blur(${px(node.blur)})`);
  if (filters.length) s.filter = filters.join(' ');
  if (node.bgBlur > 0) {
    s['backdrop-filter'] = `blur(${px(node.bgBlur)})`;
    s['-webkit-backdrop-filter'] = `blur(${px(node.bgBlur)})`;
  }
  if (node.opacity < 1) s.opacity = String(round(node.opacity, 3));
  if (node.blend && node.blend !== 'normal') s['mix-blend-mode'] = node.blend;
  const tf = transformOf(node);
  if (tf) s.transform = tf;
  // A camada marcada como máscara some (display:none): ela só serve para recortar o grupo via clip-path.
  if (node.isMask) s.display = 'none';
  // Grupo com máscara: recorta os irmãos usando a forma da camada-máscara (ver maskClip).
  if (node.type === 'group') {
    const clip = maskClip(node);
    if (clip) s['clip-path'] = clip;
  }

  return s;
}


/**
 * Junta rotação e espelhamento numa única propriedade `transform`. Ordem: rotate primeiro, depois scale.
 * Devolve '' quando não há nada a aplicar (assim o CSS gerado não ganha `transform` à toa).
 */
export function transformOf(node) {
  const parts = [];
  if (node.rotation) parts.push(`rotate(${round(node.rotation, 2)}deg)`);
  if (node.flipX || node.flipY) parts.push(`scale(${node.flipX ? -1 : 1}, ${node.flipY ? -1 : 1})`);
  return parts.join(' ');
}

/**
 * Estilo da LINHA. Em vez de border ou SVG, a linha é uma caixa de ≥12px de altura com um `background` que
 * desenha uma barra de `stroke.width` px no meio: sólida (linear-gradient), tracejada (gradiente repetido)
 * ou pontilhada (radial-gradient repetido). Os 12px de altura só existem para facilitar clicar nela.
 * Altera `s` diretamente.
 */
function lineStyle(node, s, flow) {
  const st = node.stroke || { color: '#000000', opacity: 1, width: 2, style: 'solid' };
  const w = Math.max(0.5, st.width);
  const col = rgba(st.color, st.opacity);
  s.height = px(Math.max(12, w));
  if (flow) s.height = px(Math.max(12, w));
  const none = 'transparent';
  s['background-repeat'] = 'repeat-x';
  s['background-position'] = 'center';
  if (st.style === 'dashed') {
    s['background-image'] = `linear-gradient(90deg, ${col} 0 ${w * 3}px, ${none} ${w * 3}px ${w * 5}px)`;
    s['background-size'] = `${w * 5}px ${w}px`;
  } else if (st.style === 'dotted') {
    s['background-image'] = `radial-gradient(circle, ${col} 0 ${w / 2}px, ${none} ${w / 2}px)`;
    s['background-size'] = `${w * 2}px ${w}px`;
  } else {
    s['background-image'] = `linear-gradient(${col}, ${col})`;
    s['background-size'] = `100% ${w}px`;
  }
  if (node.shadows?.length) {
    s.filter = node.shadows.map((sh) => `drop-shadow(${px(sh.x)} ${px(sh.y)} ${px(sh.blur)} ${rgba(sh.color, sh.opacity)})`).join(' ');
  }
  if (node.opacity < 1) s.opacity = String(round(node.opacity, 3));
  if (node.blend && node.blend !== 'normal') s['mix-blend-mode'] = node.blend;
  const tf = transformOf(node);
  if (tf) s.transform = tf;
}

// ---------------------------------------------------------------- vetores (caminhos SVG)
/** Arredonda para 2 casas (coordenadas de SVG). */
const num = (n) => round(n, 2);

/**
 * Gera o atributo `d` de um <path> SVG a partir dos pontos do vetor.
 * Segmento reto quando nenhum dos dois pontos tem alça (comando L); curva de Bézier cúbica quando algum tem (C).
 * @param {{x:number,y:number,hin?:object,hout?:object}[]} points  pontos; hin/hout = alças de entrada/saída
 * @param {boolean} closed  fecha o caminho com Z (liga o último ao primeiro)
 * @param {(x:number)=>number} [tx]  transformação opcional de x (usada pelo clip-path e pelo SVG exportado)
 * @param {(y:number)=>number} [ty]  idem para y
 */
export function pathData(points, closed, tx = (x) => x, ty = (y) => y) {
  if (!points.length) return '';
  const P = (pt) => `${num(tx(pt.x))} ${num(ty(pt.y))}`;
  let d = `M ${P(points[0])}`;
  const seg = (a, b) => {
    if (!a.hout && !b.hin) return ` L ${P(b)}`;
    const c1 = a.hout || a, c2 = b.hin || b;
    return ` C ${P(c1)} ${P(c2)} ${P(b)}`;
  };
  for (let i = 1; i < points.length; i++) d += seg(points[i - 1], points[i]);
  if (closed && points.length > 1) d += seg(points[points.length - 1], points[0]) + ' Z';
  return d;
}

/**
 * Preenchimento de um vetor em SVG. Gradientes precisam de uma definição (<linearGradient>) referenciada por
 * url(#id); devolve { paint (valor do atributo fill), defs (markup das definições), opacity }.
 * O ângulo CSS (0° = para cima) é convertido em x1,y1→x2,y2 do SVG (0..1).
 */
function svgPaint(fill, id, assets) {
  if (!fill || fill.type === 'none') return { paint: 'none', defs: '' };
  if (fill.type === 'solid') return { paint: rgba(fill.color, 1), opacity: fill.opacity, defs: '' };
  if (fill.type === 'image') return { paint: '#c4c4c4', defs: '' };
  const stops = [...fill.stops].sort((a, b) => a.pos - b.pos)
    .map((st) => `<stop offset="${round(st.pos)}%" stop-color="${rgba(st.color, 1)}" stop-opacity="${st.opacity}"/>`).join('');
  if (fill.type === 'radial') {
    return { paint: `url(#g-${id})`, defs: `<radialGradient id="g-${id}">${stops}</radialGradient>` };
  }
  const a = (fill.angle * Math.PI) / 180;
  const dx = Math.sin(a) / 2, dy = -Math.cos(a) / 2;
  return {
    paint: `url(#g-${id})`,
    defs: `<linearGradient id="g-${id}" x1="${num(0.5 - dx)}" y1="${num(0.5 - dy)}" x2="${num(0.5 + dx)}" y2="${num(0.5 + dy)}">${stops}</linearGradient>`,
  };
}

/**
 * Markup <svg> de um nó `path` (usado no canvas, no HTML exportado e no modo apresentar).
 *  - preserveAspectRatio="none": o desenho estica junto com a caixa da camada.
 *  - vector-effect="non-scaling-stroke": a espessura do traço NÃO muda ao esticar.
 *  - 2º <path> transparente e grosso (stroke-width 12): serve só de "área de clique" para linhas finas.
 */
export function pathSvg(node, assets = {}) {
  const d = pathData(node.points, node.closed);
  const { paint, opacity, defs } = svgPaint(node.fill, node.id, assets);
  const st = node.stroke;
  const w = st && st.width > 0 ? st.width : 0;
  const dash = !w ? '' : st.style === 'dashed' ? ` stroke-dasharray="${w * 3} ${w * 2}"` : st.style === 'dotted' ? ` stroke-dasharray="0 ${w * 2}"` : '';
  const stroke = w
    ? ` stroke="${rgba(st.color, 1)}" stroke-opacity="${st.opacity}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${dash}`
    : '';
  const fo = opacity != null && opacity < 1 ? ` fill-opacity="${opacity}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(node.vw)} ${num(node.vh)}" width="100%" height="100%" preserveAspectRatio="none" style="display:block;overflow:visible">` +
    `${defs ? `<defs>${defs}</defs>` : ''}` +
    `<path d="${d}" fill="${node.closed || paint !== 'none' ? paint : 'none'}"${fo}${stroke} vector-effect="non-scaling-stroke" data-vis="1"/>` +
    `<path d="${d}" fill="none" stroke="transparent" stroke-width="12" vector-effect="non-scaling-stroke" data-hit="1"/>` +
    `</svg>`;
}

/**
 * Converte a camada marcada como máscara (`isMask`) do grupo em um `clip-path` CSS:
 * elipse → ellipse(), vetor → path(), retângulo → inset() (com cantos arredondados se houver).
 * Devolve '' se o grupo não tem máscara.
 */
export function maskClip(group) {
  const m = group.children?.find((c) => c.isMask);
  if (!m) return '';
  if (m.type === 'ellipse') {
    return `ellipse(${px(m.w / 2)} ${px(m.h / 2)} at ${px(m.x + m.w / 2)} ${px(m.y + m.h / 2)})`;
  }
  if (m.type === 'path') {
    const sx = m.w / (m.vw || 1), sy = m.h / (m.vh || 1);
    return `path('${pathData(m.points, true, (x) => m.x + x * sx, (y) => m.y + y * sy)}')`;
  }
  const [a, b, c, d] = m.radius || [0, 0, 0, 0];
  const round_ = a || b || c || d ? ` round ${px(a)} ${px(b)} ${px(c)} ${px(d)}` : '';
  return `inset(${px(m.y)} ${px(group.w - m.x - m.w)} ${px(group.h - m.y - m.h)} ${px(m.x)}${round_})`;
}

/** Objeto de estilo → texto para `element.style.cssText` ("a:1;b:2"). */
export const toCssText = (style) =>
  Object.entries(style)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');

/** Objeto de estilo → regra CSS legível com uma propriedade por linha (usada no painel Código e no HTML exportado). */
export function cssRule(selector, style, indent = '') {
  const body = Object.entries(style)
    .map(([k, v]) => `${indent}  ${k}: ${v};`)
    .join('\n');
  return `${indent}${selector} {\n${body}\n${indent}}`;
}

/**
 * Cria um gerador de nomes de classe únicos a partir do nome da camada: "Botão" → "botao", e a segunda camada
 * com o mesmo nome vira "botao-2". Um gerador novo por exportação garante nomes estáveis e sem colisão.
 */
function makeClassNamer() {
  const used = new Map();
  return (node) => {
    const base = slugify(node.name);
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
}

/** Escapa & < > " para que texto digitado pelo usuário nunca vire HTML/atributo no código exportado. */
const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Gera { html, css } legíveis para uma lista de camadas: uma <div> (ou <p> para texto) por camada, cada uma com
 * uma classe própria, e uma regra CSS por classe. Camadas ocultas não entram.
 * @param {object[]} nodes  camadas irmãs a exportar
 * @param {object|null} parent  pai delas (define se são itens de flex/grid)
 * @param {object} [assets]  imagens do documento
 * @param {{root?: boolean}} [opts]  root: a 1ª camada vira o elemento raiz (position:relative)
 */
export function generateCode(nodes, parent, assets = {}, { root = false } = {}) {
  const className = makeClassNamer();
  const rules = [];
  const build = (node, par, depth, isRoot) => {
    if (!node.visible) return '';
    const cls = className(node);
    rules.push(cssRule(`.${cls}`, nodeStyle(node, par, assets, { root: isRoot })));
    const pad = '  '.repeat(depth);
    if (node.type === 'text') {
      return `${pad}<p class="${cls}">${escapeHtml(node.text)}</p>`;
    }
    if (node.type === 'path') {
      return `${pad}<div class="${cls}">\n${pad}  ${pathSvg(node, assets)}\n${pad}</div>`;
    }
    const kids = (node.children || []).map((c) => build(c, node, depth + 1, false)).filter(Boolean);
    if (!kids.length) return `${pad}<div class="${cls}"></div>`;
    return `${pad}<div class="${cls}">\n${kids.join('\n')}\n${pad}</div>`;
  };
  const html = nodes.map((n, i) => build(n, parent, 0, root && i === 0)).filter(Boolean).join('\n');
  return { html, css: rules.join('\n\n') };
}

/**
 * Documento HTML COMPLETO e independente (um único arquivo, sem dependências) com a camada e seus filhos.
 * Abre direto no navegador; o CSS fica num <style> no <head>.
 */
export function exportHtml(node, assets, title = 'Design') {
  const { html, css } = generateCode([node], null, assets, { root: true });
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
* { margin: 0; box-sizing: border-box; }
body { display: grid; place-items: start center; padding: 24px; background: #f3f3f5; }
${css}
</style>
</head>
<body>
${html}
</body>
</html>
`;
}
