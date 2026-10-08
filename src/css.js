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

import { isFlow, hasLayout, hasAspect, hasSizeLimits, round, slugify, stateView, STATE_LIST, cleanTrackList, overflowOf, htmlTagIn, tagOf, BREAKPOINTS, bpView, hasBps } from './model.js';
import { googleFontsUrl, usedFonts } from './fonts.js';
import { modesOf, styleValue, varsOf, varCssNames } from './modes.js';

/** Formata um número como pixels CSS, arredondado: px(10.004) → "10px". */
const px = (v) => `${round(v)}px`;
/**
 * Tradução dos valores de alinhamento do flexbox (usados no modelo, ex. 'flex-start') para os do CSS Grid
 * ('start'). O grid não aceita 'flex-start' em justify-items/align-items. 'auto' (ou valor desconhecido) fica de fora:
 * o item herda o alinhamento do grid pai.
 */
const GRID_ALIGN = { 'flex-start': 'start', center: 'center', 'flex-end': 'end', stretch: 'stretch' };

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
 *  - conic  → background-image: conic-gradient(from Ndeg, ...)
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
    case 'conic':
      // cônico: as cores giram em volta do centro (como um relógio ou uma roda de cores); angle = onde começa
      return { 'background-image': `conic-gradient(from ${round(fill.angle)}deg at center, ${stopsCss(fill.stops)})` };
    case 'image': {
      const src = assets[fill.assetId];
      if (!src) return { 'background-color': '#c4c4c4' };
      // ajuste: cover | contain | fill (100% 100%) | size (largura = N% da camada, altura proporcional)
      const fit = fill.fit || 'cover';
      const bx = fill.posX ?? 50, by = fill.posY ?? 50; // posição da imagem em %, 50/50 = centro
      return {
        'background-image': `url("${src}")`,
        'background-size': fit === 'fill' ? '100% 100%' : fit === 'size' ? `${round(fill.size ?? 100)}% auto` : fit,
        'background-position': bx === 50 && by === 50 ? 'center' : `${round(bx)}% ${round(by)}%`,
        // repetir só faz sentido quando a imagem NÃO cobre a caixa toda (contain e tamanho próprio)
        'background-repeat': fit === 'contain' || fit === 'size' ? fill.repeat || 'no-repeat' : 'no-repeat',
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
    if (opts.fluid && node.fluid) {
      // largura FLUIDA (site responsivo): ocupa a janela até a largura desenhada, centralizada; a altura vira mínima
      s.width = '100%';
      s['max-width'] = px(node.w);
      s['min-height'] = px(node.h);
      s.margin = '0 auto';
    } else {
      // tela "Hug" (do tamanho do conteúdo) não pode sair com altura/largura fixa: cortaria o que cresceu
      s.width = node.sizeX === 'hug' ? 'max-content' : px(node.w);
      s.height = node.sizeY === 'hug' ? 'auto' : px(node.h);
    }
  } else if (flow && parent.layout.mode === 'grid') {
    // (b) Item de GRID: o tamanho 'fill' vira justify-self/align-self: stretch; colSpan/rowSpan viram `span N`.
    // Sem 'fill' e sem alinhamento próprio, o item NÃO escreve justify-self/align-self: assim vale o
    // justify-items/align-items do grid pai (como no CSS de verdade — um 'start' fixo aqui anulava o do pai).
    s.position = 'relative';
    marginCss(node, s);
    s.width = node.sizeX === 'fixed' ? px(node.w) : 'auto';
    s.height = node.sizeY === 'fixed' ? px(node.h) : 'auto';
    const js = node.sizeX === 'fill' ? 'stretch' : GRID_ALIGN[node.justifySelf];
    const as = node.sizeY === 'fill' ? 'stretch' : GRID_ALIGN[node.alignSelf];
    if (js) s['justify-self'] = js;
    if (as) s['align-self'] = as;
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
    marginCss(node, s);
    // fill no eixo principal divide o espaço sobrando; `grow` é o peso (1 e 2 = um terço e dois terços)
    s.flex = mainFill ? `${node.grow > 0 && node.grow !== 1 ? round(node.grow, 2) : 1} 1 0%` : '0 0 auto';
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

  // ---- limites de tamanho e proporção (min-/max-width/height, aspect-ratio) ------------
  sizeLimitsCss(node, s);

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
      // trilhas personalizadas (colsTemplate/rowsTemplate) mandam; senão: N colunas iguais e linhas automáticas ou N iguais
      s['grid-template-columns'] = L.colsTemplate ? cleanTrackList(L.colsTemplate) : `repeat(${L.cols || 2}, ${track})`;
      if (L.rowsTemplate) s['grid-template-rows'] = cleanTrackList(L.rowsTemplate);
      else if (L.rows > 0) s['grid-template-rows'] = `repeat(${L.rows}, minmax(0, 1fr))`;
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
  // Conteúdo que sai da caixa: cortar (overflow:hidden, que também faz os filhos respeitarem o border-radius), mostrar ou rolar.
  if (node.type === 'frame') overflowCss(node, s, opts);

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
    if (node.wordSpacing) s['word-spacing'] = px(node.wordSpacing);
    s['text-align'] = node.textAlign;
    if (node.textDecoration !== 'none') s['text-decoration'] = node.textDecoration;
    if (node.textTransform && node.textTransform !== 'none') s['text-transform'] = node.textTransform;
    // Alinhamento vertical só faz sentido com altura fixa: usa grid + align-content (centro/fim).
    if (node.sizeY === 'fixed' && node.textVAlign && node.textVAlign !== 'top') {
      s.display = 'grid';
      s['align-content'] = node.textVAlign === 'center' ? 'center' : 'end';
    }
    // hug sem largura máxima = uma linha só ('pre'); com largura máxima o texto QUEBRA ao chegar nela ('pre-wrap')
    s['white-space'] = node.sizeX === 'hug' && !(node.maxW > 0) ? 'pre' : 'pre-wrap';
    s['overflow-wrap'] = 'break-word';
    truncateCss(node, s);
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
    } else if (hasStrokeSides(node)) {
      // CONTORNO POR LADO: `border-top/right/bottom/left` de verdade (o que um dev escreveria). Com box-sizing:
      // border-box a borda fica DENTRO da caixa e, como em qualquer site, ocupa espaço do conteúdo.
      ['top', 'right', 'bottom', 'left'].forEach((side, i) => {
        if (st.sides[i] > 0) s[`border-${side}`] = `${px(st.sides[i])} ${st.style} ${rgba(st.color, st.opacity)}`;
      });
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
  filters.push(...colorFilters(node));
  if (filters.length) s.filter = filters.join(' ');
  if (node.bgBlur > 0) {
    s['backdrop-filter'] = `blur(${px(node.bgBlur)})`;
    s['-webkit-backdrop-filter'] = `blur(${px(node.bgBlur)})`;
  }
  if (node.opacity < 1) s.opacity = String(round(node.opacity, 3));
  if (node.blend && node.blend !== 'normal') s['mix-blend-mode'] = node.blend;
  // transição suave entre o estado normal e hover/pressionado/foco (e entre qualquer mudança de valores visuais)
  if (node.transition?.duration > 0) s.transition = `all ${round(node.transition.duration)}ms ${node.transition.easing || 'ease'}`;
  if (node.cursor && node.cursor !== 'auto') s.cursor = node.cursor;
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
 * Overflow do frame. Altera `s` diretamente. `opts.editor` = desenho do CANVAS: as variações de rolagem viram
 * "cortar", porque barras de rolagem dentro do canvas atrapalhariam o editor (a rolagem de verdade vale na
 * apresentação e no código exportado).
 */
function overflowCss(node, s, opts = {}) {
  const o = overflowOf(node);
  if (o === 'visible') return;
  if (o === 'hidden' || opts.editor) { s.overflow = 'hidden'; return; }
  if (o === 'scroll-y') { s['overflow-x'] = 'hidden'; s['overflow-y'] = 'auto'; } else if (o === 'scroll-x') { s['overflow-x'] = 'auto'; s['overflow-y'] = 'hidden'; } else s.overflow = 'auto';
}

/**
 * Margem de um item EM FLUXO (flex/grid): atalho `margin` com 1 valor (todos iguais) ou 4 (topo direita baixo esquerda).
 * Só aparece quando algum lado não é zero. Altera `s` diretamente. Camadas livres (position:absolute) não usam margem:
 * a posição delas já é o left/top.
 */
function marginCss(node, s) {
  const m = node.margin;
  if (!Array.isArray(m) || !m.some(Boolean)) return;
  s.margin = m.every((v) => v === m[0]) ? px(m[0]) : m.map((v) => px(v)).join(' ');
}

/** Funções de filtro de COR da camada, na ordem do CSS, só as que fogem do padrão: brightness, contrast, saturate, grayscale, hue-rotate. */
const COLOR_FILTERS = [['brightness', 'brightness', 100, '%'], ['contrast', 'contrast', 100, '%'], ['saturate', 'saturate', 100, '%'], ['grayscale', 'grayscale', 0, '%'], ['hue', 'hue-rotate', 0, 'deg']];
export function colorFilters(node) {
  const out = [];
  for (const [key, fn, def, unit] of COLOR_FILTERS) {
    const v = node.fx?.[key];
    if (v != null && v !== def) out.push(`${fn}(${round(v)}${unit})`);
  }
  return out;
}

/**
 * Truncar texto (campo `truncate`). Altera `s` diretamente; vale DEPOIS do alinhamento vertical e do white-space.
 *  - 'ellipsis': uma linha só, o que não cabe vira "…"  → white-space:nowrap + overflow:hidden + text-overflow:ellipsis
 *  - 'clamp': no máximo `lines` linhas, com "…" no fim → display:-webkit-box + -webkit-line-clamp (e line-clamp)
 * Os dois precisam de uma LARGURA (fixa ou máxima) para saber onde cortar. O alinhamento vertical por grid
 * (centro/fim) é desligado, porque o grid e o -webkit-box/ellipsis não funcionam juntos.
 */
function truncateCss(node, s) {
  if (node.truncate !== 'ellipsis' && node.truncate !== 'clamp') return;
  delete s['align-content'];
  s.overflow = 'hidden';
  if (node.truncate === 'ellipsis') {
    delete s.display;
    s['white-space'] = 'nowrap';
    s['text-overflow'] = 'ellipsis';
    return;
  }
  const lines = Math.max(1, Math.round(node.lines || 2));
  s['white-space'] = 'pre-wrap';
  s.display = '-webkit-box';
  s['-webkit-box-orient'] = 'vertical';
  s['-webkit-line-clamp'] = String(lines);
  s['line-clamp'] = String(lines);
}

/**
 * Limites de tamanho e proporção da camada. Altera `s` diretamente. Ficam DEPOIS do tamanho, então `min-width`
 * substitui o `min-width: 0` que o item "fill" de um flex escreve sozinho.
 *  - min-/max-width/height: só aparecem quando o usuário define (campos minW, maxW, minH, maxH).
 *  - aspect-ratio: só quando ALGUMA medida é flexível (hug/fill). A medida fixa vira `auto` no eixo oposto para a
 *    proporção valer (com as duas fixas o CSS ignoraria o aspect-ratio, e quem mantém a proporção é o editor).
 */
function sizeLimitsCss(node, s) {
  if (!hasSizeLimits(node)) return;
  if (node.minW > 0) s['min-width'] = px(node.minW);
  if (node.maxW > 0) s['max-width'] = px(node.maxW);
  if (node.minH > 0) s['min-height'] = px(node.minH);
  if (node.maxH > 0) s['max-height'] = px(node.maxH);
  if (hasAspect(node)) {
    const flexX = node.sizeX !== 'fixed', flexY = node.sizeY !== 'fixed';
    if (flexX || flexY) {
      s['aspect-ratio'] = String(round(node.aspect, 4));
      if (flexX && !flexY) s.height = 'auto';
      else if (flexY && !flexX) s.width = 'auto';
    }
  }
}

/**
 * Junta rotação e espelhamento numa única propriedade `transform`. Ordem: rotate primeiro, depois scale.
 * Devolve '' quando não há nada a aplicar (assim o CSS gerado não ganha `transform` à toa).
 */
export function transformOf(node) {
  const parts = [];
  if (node.rotation) parts.push(`rotate(${round(node.rotation, 2)}deg)`);
  if (node.flipX || node.flipY) parts.push(`scale(${node.flipX ? -1 : 1}, ${node.flipY ? -1 : 1})`);
  if (node.scale && node.scale !== 1) parts.push(`scale(${round(node.scale, 3)})`); // só nos estados (ver stateView)
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

/**
 * A camada usa contorno POR LADO? (`stroke.sides` = [cima, direita, baixo, esquerda] em px). Só retângulos, frames e
 * grupos de imagem — em elipse, texto e vetor "lado" não faz sentido.
 */
export const hasStrokeSides = (node) =>
  Array.isArray(node.stroke?.sides) && ['rect', 'frame'].includes(node.type);

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
 * `d` COMPLETO de um vetor: o contorno principal (`points`) + os contornos extras (`contours`), se houver.
 * Contornos extras existem em desenhos importados de SVG (ícones com "furos", letras como "o", várias formas
 * num só vetor). A regra de preenchimento (`fillRule`: 'nonzero' | 'evenodd') decide o que vira furo.
 * @param {object} node  camada do tipo 'path'
 * @param {(x:number)=>number} [tx]
 * @param {(y:number)=>number} [ty]
 */
export function nodePathData(node, tx, ty) {
  let d = pathData(node.points, node.closed, tx, ty);
  for (const c of node.contours || []) {
    const cd = pathData(c.points, c.closed, tx, ty);
    if (cd) d += (d ? ' ' : '') + cd;
  }
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
  if (fill.type === 'conic') { // o SVG não tem gradiente cônico: vetor usa a cor da 1ª parada
    const first = [...fill.stops].sort((a, b) => a.pos - b.pos)[0];
    return { paint: rgba(first.color, 1), opacity: first.opacity, defs: '' };
  }
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
  const d = nodePathData(node);
  const { paint, opacity, defs } = svgPaint(node.fill, node.id, assets);
  const rule = node.fillRule === 'evenodd' ? ' fill-rule="evenodd"' : '';
  const st = node.stroke;
  const w = st && st.width > 0 ? st.width : 0;
  const dash = !w ? '' : st.style === 'dashed' ? ` stroke-dasharray="${w * 3} ${w * 2}"` : st.style === 'dotted' ? ` stroke-dasharray="0 ${w * 2}"` : '';
  const stroke = w
    ? ` stroke="${rgba(st.color, 1)}" stroke-opacity="${st.opacity}" stroke-width="${w}" stroke-linecap="${st.cap || 'round'}" stroke-linejoin="${st.join || 'round'}"${dash}`
    : '';
  const fo = opacity != null && opacity < 1 ? ` fill-opacity="${opacity}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(node.vw)} ${num(node.vh)}" width="100%" height="100%" preserveAspectRatio="none" style="display:block;overflow:visible">` +
    `${defs ? `<defs>${defs}</defs>` : ''}` +
    `<path d="${d}" fill="${node.closed || paint !== 'none' ? paint : 'none'}"${fo}${rule}${stroke} vector-effect="non-scaling-stroke" data-vis="1"/>` +
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
    const rule = m.fillRule === 'evenodd' ? 'evenodd, ' : '';
    return `path(${rule}'${nodePathData({ ...m, closed: true }, (x) => m.x + x * sx, (y) => m.y + y * sy)}')`;
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
 * CSS de UM estado, só com o que MUDA em relação ao normal (é o que vai dentro de `.botao:hover { ... }`). Propriedade
 * que existia no normal e sumiu no estado vira `unset` (volta ao padrão do CSS: sem sombra, sem filtro, sem fundo...).
 * @param {object} node
 * @param {object|null} parent
 * @param {object} assets
 * @param {{root?: boolean}} opts  mesmas opções do nodeStyle
 * @param {string|string[]} states  'hover' | 'active' | 'focus' (ou lista, em ordem de cascata)
 */
export function stateStyle(node, parent, assets, opts, states) {
  const base = nodeStyle(node, parent, assets, opts);
  const st = nodeStyle(stateView(node, states), parent, assets, opts);
  const out = {};
  for (const [k, v] of Object.entries(st)) if (base[k] !== v) out[k] = v;
  for (const k of Object.keys(base)) if (!(k in st)) out[k] = 'unset';
  return out;
}

/**
 * Estilo de um ESTADO (hover, pressionado, foco) para o desenho DENTRO do <svg> de um vetor: o que o estado muda no
 * preenchimento e no contorno (cor, opacidade, espessura). Vira `.classe:hover path[data-vis] { fill: ...; stroke: ... }`.
 * Gradientes e imagens não entram (precisariam de outra definição no <svg>); a cor sólida e o contorno, sim.
 */
export function pathStateStyle(node, assets, state) {
  const v = stateView(node, state);
  const out = {};
  const a = svgPaint(node.fill, node.id, assets), b = svgPaint(v.fill, node.id, assets);
  if (!b.defs && (a.paint !== b.paint || a.opacity !== b.opacity)) {
    out.fill = b.paint;
    out['fill-opacity'] = String(b.opacity != null ? b.opacity : 1);
  }
  const sa = node.stroke, sb = v.stroke;
  if (sb && sb.width > 0) {
    if (!sa || sa.color !== sb.color) out.stroke = rgba(sb.color, 1);
    if (!sa || sa.opacity !== sb.opacity) out['stroke-opacity'] = String(sb.opacity);
    if (!sa || sa.width !== sb.width) out['stroke-width'] = String(sb.width);
  } else if (sa && sa.width > 0) {
    out.stroke = 'none';
  }
  return out;
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

/** Texto da nota da camada pronto para virar comentário de HTML ou CSS (uma linha, sem "--" nem "*\/" que fechariam o comentário); '' se não vai ao código. */
export const noteComment = (node) => {
  if (!node.note || node.noteInCode === false) return '';
  return String(node.note).trim().replace(/\s*\n\s*/g, ' ').replace(/-{2,}/g, '–').replace(/\*\//g, '* /');
};

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
export function generateCode(nodes, parent, assets = {}, { root = false, styles = null, ids = false } = {}) {
  const className = makeClassNamer();
  const rules = [];
  // VARIÁVEIS de CSS: camadas ligadas a um estilo de cor escrevem var(--cor-nome) em vez do hex; `tokens` guarda
  // quais variáveis foram usadas (nome → valor) para o chamador escrever o bloco :root (veja joinCss)
  const varNames = colorVarNames(styles);
  const tokens = new Map();
  const tokenStyle = new Map(); // nome da variável de cor → id do estilo (para escrever os valores de cada modo)
  const useTokens = (node, st) => {
    const f = node.fill;
    if (!varNames.size || !f?.styleId || f.type !== 'solid' || node.type === 'path') return;
    const name = varNames.get(f.styleId);
    const key = node.type === 'text' ? 'color' : 'background-color';
    const literal = rgba(f.color, f.opacity);
    if (name && st[key] === literal) { st[key] = `var(${name})`; tokens.set(name, literal); tokenStyle.set(name, f.styleId); }
  };
  // VARIÁVEIS de tamanho (gap, padding, border-radius, font-size): camadas ligadas escrevem var(--espaco-md)
  const sizeNames = varCssNames(styles, slugify);
  const sizeVars = varsOf(styles);
  const SIZE_CSS = { gap: 'gap', padding: 'padding', radius: 'border-radius', fontSize: 'font-size' };
  const useSizeVars = (node, st) => {
    if (!node.vars || !sizeNames.size) return;
    for (const [prop, id] of Object.entries(node.vars)) {
      const v = sizeVars.find((x) => x.id === id);
      const key = SIZE_CSS[prop];
      if (!v || !key || !(key in st)) continue;
      const one = px(v.value);
      const literal = prop === 'padding' ? `${one} ${one} ${one} ${one}` : one;
      if (st[key] === literal) { st[key] = `var(${sizeNames.get(id)})`; tokens.set(sizeNames.get(id), one); }
    }
  };
  // RESPONSIVO: se alguma camada tem sobrescritas de breakpoint, cada camada ganha, por breakpoint, uma regra com SÓ o que
  // muda (dentro de @media (max-width: N)). Camadas sem sobrescritas também entram: o layout do PAI pode ter mudado.
  let anyBps = false;
  const scan = (list) => list.forEach((n) => { if (hasBps(n)) anyBps = true; if (n.children) scan(n.children); });
  scan(nodes);
  const media = new Map(BREAKPOINTS.map((b) => [b.id, []]));
  const build = (node, par, depth, isRoot, ancestors) => {
    if (!node.visible) return '';
    const cls = className(node);
    const base = nodeStyle(node, par, assets, { root: isRoot, fluid: true });
    useTokens(node, base);
    useSizeVars(node, base);
    // a NOTA da camada vira comentário no HTML e no CSS (a menos que a pessoa tenha desligado)
    const note = noteComment(node);
    rules.push((note ? `/* ${note} */\n` : '') + cssRule(`.${cls}`, base));
    if (anyBps) {
      let prev = base, prevHidden = false;
      for (const bp of BREAKPOINTS) {
        const view = bpView(node, bp.id);
        const cur = nodeStyle(view, par && bpView(par, bp.id), assets, { root: isRoot, fluid: true });
        const diff = {};
        for (const [k, v] of Object.entries(cur)) if (prev[k] !== v) diff[k] = v;
        for (const k of Object.keys(prev)) if (!(k in cur)) diff[k] = 'unset';
        // tela FLUIDA: a largura que a tela tem no Tablet/Celular ("Telas em 390px") é só para VER no editor; no site
        // ela continua ocupando a janela inteira (senão, num celular de 412px, o site ficaria com 390 e faixas dos lados)
        if (isRoot && node.fluid) delete diff['max-width'];
        const hidden = view.visible === false;
        if (hidden && !prevHidden) diff.display = 'none';
        else if (!hidden && prevHidden) diff.display = cur.display || 'block';
        if (Object.keys(diff).length) media.get(bp.id).push(cssRule(`.${cls}`, diff));
        prev = cur; prevHidden = hidden;
      }
    }
    // estados: uma regra por estado com SÓ o que muda (.card:hover, .card:active, .card:focus-visible)
    for (const [state, , pseudo] of STATE_LIST) {
      if (!node.states?.[state] || !Object.keys(node.states[state]).length) continue;
      const diff = stateStyle(node, par, assets, { root: isRoot }, state);
      if (Object.keys(diff).length) rules.push(cssRule(`.${cls}${pseudo}`, diff));
      // vetor: cor e contorno ficam DENTRO do <svg>, então o estado precisa mirar o <path> de dentro
      if (node.type === 'path') {
        const inner = pathStateStyle(node, assets, state);
        if (Object.keys(inner).length) rules.push(cssRule(`.${cls}${pseudo} path[data-vis]`, inner));
      }
    }
    const pad = '  '.repeat(depth);
    // elemento que tem estado de foco precisa poder receber foco pelo teclado
    const focusable = node.states?.focus && Object.keys(node.states.focus).length ? ' tabindex="0"' : '';
    // etiqueta escolhida no painel (HTML) e seus atributos: link, tipo de botão, descrição para leitor de tela
    // etiqueta conferida contra os pais (htmlTagIn): um <li> fora de lista, por exemplo, vira <div>
    const tag = htmlTagIn(node, ancestors).tag;
    const hasKids = node.type !== 'text' && node.type !== 'path' && (node.children || []).length > 0;
    const attrs = ` class="${cls}"`
      + (tag === 'a' ? ` href="${escapeHtml(node.href || '#')}"` : '')
      + (tag === 'button' ? ' type="button"' : '')
      + (node.alt ? ` aria-label="${escapeHtml(node.alt)}"` : '')
      + (node.alt && node.type !== 'text' && !hasKids ? ' role="img"' : '')
      + focusable
      // `ids` (só para os testes de fidelidade): marca cada elemento com o id da camada para comparar com o editor
      + (ids ? ` data-node-id="${escapeHtml(node.id)}"` : '');
    const noteHtml = note ? `${pad}<!-- ${note} -->\n` : '';
    if (node.type === 'text') {
      return `${noteHtml}${pad}<${tag}${attrs}>${escapeHtml(node.text)}</${tag}>`;
    }
    if (node.type === 'path') {
      return `${noteHtml}${pad}<${tag}${attrs}>\n${pad}  ${pathSvg(node, assets)}\n${pad}</${tag}>`;
    }
    const kids = (node.children || []).map((c) => build(c, node, depth + 1, false, [...ancestors, tag])).filter(Boolean);
    if (!kids.length) return `${noteHtml}${pad}<${tag}${attrs}></${tag}>`;
    return `${noteHtml}${pad}<${tag}${attrs}>\n${kids.join('\n')}\n${pad}</${tag}>`;
  };
  // o pai (quando há, ex.: o painel Código mostrando um item) conta para a conferência das etiquetas
  const html = nodes.map((n, i) => build(n, parent, 0, root && i === 0, parent ? [tagOf(parent)] : [])).filter(Boolean).join('\n');
  // blocos @media (do maior para o menor breakpoint, para o menor vencer na cascata)
  for (const bp of BREAKPOINTS) {
    const list = media.get(bp.id);
    if (!list.length) continue;
    rules.push(`@media (max-width: ${bp.max}px) {\n${list.join('\n\n').split('\n').map((l) => (l ? `  ${l}` : l)).join('\n')}\n}`);
  }
  // MODOS de cor: para cada modo, o valor das variáveis de cor usadas que têm valor próprio nele
  const modes = modesOf(styles).map((m) => ({
    id: m.id, name: m.name, scheme: m.scheme || null,
    tokens: [...tokenStyle].map(([name, sid]) => {
      const st = styles.colors.find((c) => c.id === sid);
      if (!st?.modes?.[m.id]) return null;
      const v = styleValue(st, m.id);
      return [name, rgba(v.color, v.opacity)];
    }).filter(Boolean),
  })).filter((m) => m.tokens.length);
  return { html, css: rules.join('\n\n'), tokens: [...tokens], modes };
}

/**
 * Nomes das variáveis de CSS dos ESTILOS DE COR do documento: id do estilo → "--cor-nome" (nome sem acento, em
 * minúsculas, com hífens; nomes repetidos ganham -2, -3...). Vazio se não há estilos.
 */
export function colorVarNames(styles) {
  const out = new Map();
  const used = new Map();
  for (const st of styles?.colors || []) {
    const base = `--cor-${slugify(st.name || 'estilo')}`;
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    out.set(st.id, n === 1 ? base : `${base}-${n}`);
  }
  return out;
}

/**
 * Junta o CSS de várias chamadas de generateCode e escreve UM bloco `:root { --cor-x: ...; }` no topo com as
 * variáveis usadas por elas. Sem variáveis, devolve só as regras.
 * @param {{css: string, tokens?: [string, string][]}[]} parts
 */
export function joinCss(parts) {
  const tokens = new Map();
  for (const p of parts) for (const [k, v] of p.tokens || []) tokens.set(k, v);
  const rules = parts.map((p) => p.css).filter(Boolean).join('\n\n');
  const decls = (list, pad) => list.map(([k, v]) => `${pad}${k}: ${v};`).join('\n');
  const rootBlock = tokens.size ? `:root {\n${decls([...tokens], '  ')}\n}` : '';
  // modos de cor (claro/escuro...): um bloco por modo, ativado por <html data-theme="nome">; com `scheme`, também
  // automático pela preferência do sistema (prefers-color-scheme) quando a página não escolheu um modo
  const modes = new Map();
  for (const p of parts) for (const m of p.modes || []) {
    const cur = modes.get(m.id) || { ...m, tokens: new Map() };
    for (const [k, v] of m.tokens) cur.tokens.set(k, v);
    modes.set(m.id, cur);
  }
  const modeBlocks = [...modes.values()].map((m) => {
    const attr = slugify(m.name);
    const list = [...m.tokens];
    let out = `:root[data-theme="${attr}"] {\n${decls(list, '  ')}\n}`;
    if (m.scheme) out += `\n\n@media (prefers-color-scheme: ${m.scheme}) {\n  :root:not([data-theme]) {\n${decls(list, '    ')}\n  }\n}`;
    return out;
  });
  return [rootBlock, ...modeBlocks, rules].filter(Boolean).join('\n\n');
}

/**
 * "Zera" os estilos que o NAVEGADOR dá sozinho a cada etiqueta. O editor desenha tudo com <div>, que não tem estilo
 * próprio; no HTML exportado, porém, <ul> ganha recuo de 40px e marcadores, <button> ganha borda, fundo e texto
 * centralizado, <a> fica azul e sublinhado, <h1> fica maior... Sem este bloco o site exportado ficava diferente
 * do que o editor mostra. As regras das camadas (por classe) vêm depois e vencem estas.
 */
export const EXPORT_RESET = `*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
ul, ol { list-style: none; }
a { color: inherit; text-decoration: none; }
button { font: inherit; color: inherit; background: none; border: 0; border-radius: 0; text-align: inherit; cursor: pointer; }
a, span, label, button, li { display: block; }
h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; }`;

/**
 * Documento HTML COMPLETO e independente (um único arquivo, sem dependências) com a camada e seus filhos.
 * Abre direto no navegador; o CSS fica num <style> no <head>.
 */
export function exportHtml(node, assets, title = 'Design', styles = null, { ids = false } = {}) {
  const gen = generateCode([node], null, assets, { root: true, styles, ids });
  const html = gen.html;
  const css = joinCss([gen]);
  // fontes do Google usadas nos textos: o HTML exportado já leva o <link> (sem ele, cairia na fonte padrão)
  const fontsUrl = googleFontsUrl(usedFonts([node]));
  const fontLink = fontsUrl ? `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${fontsUrl}">\n` : '';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${fontLink}<style>
${EXPORT_RESET}
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
