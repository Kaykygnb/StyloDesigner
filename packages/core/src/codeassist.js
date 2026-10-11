/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  codeassist.js — AUTOCOMPLETAR DE CSS/HTML E ABREVIAÇÕES EMMET (lógica pura, sem DOM)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  O editor de código (ui/codeeditor.js) pergunta "o que sugerir aqui?" passando o texto e a posição do cursor.
 *  Este módulo descobre o CONTEXTO e devolve a lista já filtrada (busca "fuzzy") e ordenada:
 *   - CSS: propriedades, valores por propriedade, unidades depois de números, funções (calc, clamp, var...),
 *     variáveis do documento (estilos de cor e variáveis de tamanho), seletores (classes e ids das camadas,
 *     etiquetas, pseudo-classes) e @regras (@media com os breakpoints do projeto, @keyframes, @supports);
 *   - HTML: etiquetas, atributos por etiqueta, valores de atributos, fechamento de etiqueta e Emmet
 *     (`div.card>h2+p` vira o HTML completo).
 *  Cada sugestão: { label, kind, insert, detail?, doc?, color?, retrigger?, hits? }. Em `insert`, o caractere
 *  CARET (\u0001) marca onde o cursor fica depois de aceitar. Testado em tests/codeassist.test.js.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Marca de onde o cursor fica dentro de um `insert` (o editor remove a marca ao inserir). */
export const CARET = '\u0001';

// ================================================================== busca "fuzzy"
/**
 * Pontua `label` para a busca `q` (maior = melhor; -1 = não combina). Começo da palavra vale mais que meio,
 * letras seguidas valem mais que espalhadas, e começo de pedaço (depois de - . : # @ espaço) ganha bônus:
 * "jc" acha "justify-content". Devolve { score, hits } (hits = posições das letras que combinaram).
 */
export function fuzzyMatch(q, label) {
  if (!q) return { score: 1, hits: [] };
  const s = label.toLowerCase();
  q = q.toLowerCase();
  if (s.startsWith(q)) return { score: 10000 - s.length, hits: [...Array(q.length).keys()] };
  const at = s.indexOf(q);
  if (at > 0 && /[-.:#@ (]/.test(s[at - 1])) return { score: 6000 - at - s.length, hits: [...Array(q.length).keys()].map((k) => k + at) };
  let score = 0, from = 0, prev = -2;
  const hits = [];
  for (const ch of q) {
    // prefere uma letra no começo de um pedaço; senão, a próxima ocorrência
    let j = -1;
    for (let k = from; k < s.length; k++) {
      if (s[k] !== ch) continue;
      if (j < 0) j = k;
      if (k === 0 || /[-.:#@ (]/.test(s[k - 1])) { j = k; break; }
      if (k === prev + 1) { j = k; break; }
    }
    if (j < 0) return { score: -1, hits: [] };
    score += (j === prev + 1 ? 6 : 0) + (j === 0 || /[-.:#@ (]/.test(s[j - 1]) ? 10 : 0);
    hits.push(j);
    prev = j;
    from = j + 1;
  }
  if (at > 0) score += 40;
  return { score: 1000 + score * 10 - s.length, hits };
}

/** Filtra e ordena as sugestões pela busca (a ordem original desempata: as mais usadas vêm primeiro). */
export function rank(items, q, max = 60) {
  const out = [];
  items.forEach((it, i) => {
    const m = fuzzyMatch(q, it.filter || it.label);
    if (m.score < 0) return;
    // letras destacadas: medidas no rótulo (o filtro pode ter palavras extras, como o nome do breakpoint)
    const hl = it.filter ? fuzzyMatch(q, it.label) : m;
    out.push({ ...it, hits: hl.score < 0 ? [] : hl.hits, score: m.score, i });
  });
  out.sort((a, b) => b.score - a.score || a.i - b.i);
  return out.slice(0, max).map(({ score, i, ...it }) => it);
}

// ================================================================== dados de CSS
/** Propriedades mais usadas (aparecem primeiro quando a busca está vazia ou empata). */
const COMMON_PROPS = `display position top right bottom left inset width height min-width max-width min-height max-height
margin padding gap row-gap column-gap flex-direction flex-wrap justify-content align-items align-self align-content
flex flex-grow flex-shrink flex-basis order grid-template-columns grid-template-rows grid-column grid-row grid-area
place-items place-content color background background-color background-image border border-radius border-color
box-shadow opacity font-family font-size font-weight line-height letter-spacing text-align text-decoration
text-transform white-space overflow cursor transition transform z-index object-fit aspect-ratio outline
pointer-events content box-sizing visibility filter backdrop-filter animation`.split(/\s+/);

/** Lista completa das propriedades CSS modernas (além das comuns acima). */
const MORE_PROPS = `accent-color align-tracks all anchor-name animation-composition animation-delay animation-direction
animation-duration animation-fill-mode animation-iteration-count animation-name animation-play-state animation-range
animation-timeline animation-timing-function appearance backface-visibility background-attachment background-blend-mode
background-clip background-origin background-position background-position-x background-position-y background-repeat
background-size block-size border-block border-block-color border-block-end border-block-start border-block-style
border-block-width border-bottom border-bottom-color border-bottom-left-radius border-bottom-right-radius
border-bottom-style border-bottom-width border-collapse border-end-end-radius border-end-start-radius border-image
border-image-outset border-image-repeat border-image-slice border-image-source border-image-width border-inline
border-inline-color border-inline-end border-inline-start border-inline-style border-inline-width border-left
border-left-color border-left-style border-left-width border-right border-right-color border-right-style
border-right-width border-spacing border-start-end-radius border-start-start-radius border-style border-top
border-top-color border-top-left-radius border-top-right-radius border-top-style border-top-width border-width
box-decoration-break break-after break-before break-inside caption-side caret-color clear clip-path clip-rule
color-scheme column-count column-fill column-rule column-rule-color column-rule-style column-rule-width column-span
column-width columns contain contain-intrinsic-size container container-name container-type content-visibility
counter-increment counter-reset counter-set direction empty-cells fill fill-opacity fill-rule flex-flow float
font font-display font-feature-settings font-kerning font-optical-sizing font-palette font-size-adjust font-stretch
font-style font-synthesis font-variant font-variant-caps font-variant-ligatures font-variant-numeric
font-variation-settings forced-color-adjust grid grid-auto-columns grid-auto-flow grid-auto-rows grid-column-end
grid-column-start grid-row-end grid-row-start grid-template grid-template-areas hanging-punctuation hyphens
image-rendering inline-size inset-block inset-block-end inset-block-start inset-inline inset-inline-end
inset-inline-start isolation justify-items justify-self line-break line-clamp list-style list-style-image
list-style-position list-style-type margin-block margin-block-end margin-block-start margin-bottom margin-inline
margin-inline-end margin-inline-start margin-left margin-right margin-top mask mask-clip mask-composite mask-image
mask-mode mask-origin mask-position mask-repeat mask-size mask-type math-style max-block-size max-inline-size
min-block-size min-inline-size mix-blend-mode object-position offset offset-anchor offset-distance offset-path
offset-rotate outline-color outline-offset outline-style outline-width overflow-anchor overflow-clip-margin
overflow-wrap overflow-x overflow-y overscroll-behavior overscroll-behavior-x overscroll-behavior-y padding-block
padding-block-end padding-block-start padding-bottom padding-inline padding-inline-end padding-inline-start
padding-left padding-right padding-top paint-order perspective perspective-origin place-self position-anchor
print-color-adjust quotes resize rotate rule scale scroll-behavior scroll-margin scroll-margin-block
scroll-margin-bottom scroll-margin-inline scroll-margin-left scroll-margin-right scroll-margin-top scroll-padding
scroll-padding-block scroll-padding-bottom scroll-padding-inline scroll-padding-left scroll-padding-right
scroll-padding-top scroll-snap-align scroll-snap-stop scroll-snap-type scroll-timeline scrollbar-color
scrollbar-gutter scrollbar-width shape-image-threshold shape-margin shape-outside stroke stroke-dasharray
stroke-dashoffset stroke-linecap stroke-linejoin stroke-opacity stroke-width tab-size table-layout text-align-last
text-combine-upright text-decoration-color text-decoration-line text-decoration-skip-ink text-decoration-style
text-decoration-thickness text-emphasis text-indent text-orientation text-overflow text-rendering text-shadow
text-underline-offset text-underline-position text-wrap touch-action transform-box transform-origin transform-style
transition-behavior transition-delay transition-duration transition-property transition-timing-function translate
unicode-bidi user-select vertical-align view-timeline view-transition-name will-change word-break word-spacing
writing-mode zoom -webkit-line-clamp -webkit-box-orient -webkit-text-stroke -webkit-font-smoothing`.split(/\s+/);

/** Todas as propriedades (comuns primeiro, depois o resto em ordem alfabética). */
export const CSS_PROPERTIES = [...new Set([...COMMON_PROPS, ...MORE_PROPS.sort()])];

/** Descrição curta (rodapé da lista) das propriedades mais usadas. */
const PROP_DOC = {
  display: 'Tipo de caixa: block, inline, flex, grid, none…',
  position: 'Como a caixa é posicionada (relative, absolute, fixed, sticky).',
  top: 'Distância do topo (com position diferente de static).',
  inset: 'Atalho de top, right, bottom e left.',
  width: 'Largura da caixa.', height: 'Altura da caixa.',
  'min-width': 'Largura mínima.', 'max-width': 'Largura máxima.', 'min-height': 'Altura mínima.', 'max-height': 'Altura máxima.',
  margin: 'Espaço por fora da borda (1 a 4 valores).', padding: 'Espaço por dentro da borda (1 a 4 valores).',
  gap: 'Espaço entre itens de flex/grid.', 'row-gap': 'Espaço entre linhas.', 'column-gap': 'Espaço entre colunas.',
  'flex-direction': 'Eixo principal do flex: linha ou coluna.', 'flex-wrap': 'Itens quebram para a próxima linha?',
  'justify-content': 'Distribui os itens no eixo principal.', 'align-items': 'Alinha os itens no eixo cruzado.',
  'align-self': 'Alinhamento só deste item no eixo cruzado.', 'align-content': 'Distribui as linhas (flex com wrap / grid).',
  flex: 'Atalho de flex-grow, flex-shrink e flex-basis.', 'flex-grow': 'Quanto o item cresce para ocupar sobra.',
  'flex-shrink': 'Quanto o item encolhe quando falta espaço.', 'flex-basis': 'Tamanho inicial do item no eixo principal.',
  order: 'Ordem visual do item em flex/grid.',
  'grid-template-columns': 'Colunas da grade (ex.: repeat(3, 1fr)).', 'grid-template-rows': 'Linhas da grade.',
  'grid-column': 'Em quais colunas o item fica (ex.: span 2).', 'grid-row': 'Em quais linhas o item fica.',
  'grid-area': 'Área nomeada ou linhas do item na grade.', 'grid-template-areas': 'Desenho da grade com nomes de áreas.',
  'place-items': 'Atalho de align-items + justify-items.', 'place-content': 'Atalho de align-content + justify-content.',
  color: 'Cor do texto.', background: 'Atalho do fundo (cor, imagem, gradiente…).', 'background-color': 'Cor de fundo.',
  'background-image': 'Imagem ou gradiente de fundo.', 'background-size': 'Tamanho da imagem de fundo (cover, contain…).',
  border: 'Atalho da borda: largura, estilo e cor.', 'border-radius': 'Arredonda os cantos.',
  'border-color': 'Cor da borda.', 'box-shadow': 'Sombra da caixa (x y desfoque espalhamento cor).',
  opacity: 'Transparência de 0 (invisível) a 1.', 'font-family': 'Família da fonte.', 'font-size': 'Tamanho da fonte.',
  'font-weight': 'Peso da fonte (400 normal, 700 negrito).', 'line-height': 'Altura da linha do texto.',
  'letter-spacing': 'Espaço entre as letras.', 'text-align': 'Alinhamento horizontal do texto.',
  'text-decoration': 'Sublinhado, riscado…', 'text-transform': 'MAIÚSCULAS, minúsculas, Capitalizado.',
  'white-space': 'Como espaços e quebras de linha são tratados.', overflow: 'O que fazer com o conteúdo que sobra.',
  cursor: 'Ponteiro do mouse sobre o elemento.', transition: 'Anima a mudança de propriedades.',
  transform: 'Move, gira, escala ou inclina o elemento.', 'z-index': 'Ordem de empilhamento (maior fica na frente).',
  'object-fit': 'Como a imagem/vídeo preenche a caixa.', 'aspect-ratio': 'Proporção da caixa (ex.: 16 / 9).',
  outline: 'Contorno por fora da borda (não ocupa espaço).', 'pointer-events': 'O elemento recebe cliques?',
  content: 'Conteúdo gerado de ::before/::after.', 'box-sizing': 'Se width/height incluem padding e borda.',
  visibility: 'Esconde sem tirar o espaço.', filter: 'Efeitos: blur, brilho, contraste…',
  'backdrop-filter': 'Efeitos no que está ATRÁS (vidro fosco).', animation: 'Aplica uma @keyframes.',
  'text-overflow': 'Reticências (…) quando o texto não cabe.', 'user-select': 'O texto pode ser selecionado?',
  'scroll-behavior': 'Rolagem suave ao navegar por âncoras.', 'container-type': 'Torna a caixa um container (@container).',
  'mix-blend-mode': 'Mistura de cores com o que está atrás.', 'text-wrap': 'Quebra de texto equilibrada (balance, pretty).',
};

const POS_KEYWORDS = ['flex-start', 'center', 'flex-end', 'start', 'end', 'stretch', 'baseline'];
const DIST_KEYWORDS = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly', 'stretch', 'start', 'end'];
const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double', 'none', 'groove', 'ridge', 'inset', 'outset'];
const EASINGS = ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'step-start', 'step-end'];
const BLEND = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
const CURSORS = ['pointer', 'default', 'text', 'move', 'grab', 'grabbing', 'not-allowed', 'wait', 'progress', 'help', 'crosshair', 'zoom-in', 'zoom-out', 'none', 'auto', 'col-resize', 'row-resize', 'ew-resize', 'ns-resize', 'copy', 'context-menu', 'cell', 'all-scroll'];

/** Valores (palavras-chave) sugeridos por propriedade. */
export const CSS_VALUES = {
  display: ['flex', 'grid', 'block', 'inline', 'inline-block', 'inline-flex', 'inline-grid', 'none', 'contents', 'flow-root', 'table', 'list-item'],
  position: ['relative', 'absolute', 'fixed', 'sticky', 'static'],
  'flex-direction': ['row', 'column', 'row-reverse', 'column-reverse'],
  'flex-wrap': ['wrap', 'nowrap', 'wrap-reverse'],
  'flex-flow': ['row', 'column', 'wrap', 'nowrap', 'row wrap', 'column wrap'],
  'justify-content': DIST_KEYWORDS.concat(['left', 'right']),
  'align-content': DIST_KEYWORDS,
  'place-content': DIST_KEYWORDS,
  'align-items': POS_KEYWORDS,
  'justify-items': ['start', 'center', 'end', 'stretch', 'baseline', 'legacy'],
  'place-items': ['center', 'start', 'end', 'stretch', 'baseline'],
  'align-self': ['auto', ...POS_KEYWORDS],
  'justify-self': ['auto', 'start', 'center', 'end', 'stretch'],
  'place-self': ['auto', 'center', 'start', 'end', 'stretch'],
  'grid-auto-flow': ['row', 'column', 'dense', 'row dense', 'column dense'],
  'grid-template-columns': ['none', 'auto', 'min-content', 'max-content', 'subgrid', '1fr', '1fr 1fr', 'repeat(3, 1fr)', 'repeat(auto-fill, minmax(200px, 1fr))'],
  'grid-template-rows': ['none', 'auto', 'min-content', 'max-content', 'subgrid', '1fr', 'auto 1fr auto'],
  'grid-auto-columns': ['auto', 'min-content', 'max-content', '1fr'],
  'grid-auto-rows': ['auto', 'min-content', 'max-content', '1fr'],
  'grid-column': ['auto', 'span 2', 'span 3', '1 / -1', '1 / 3'],
  'grid-row': ['auto', 'span 2', 'span 3', '1 / -1'],
  'grid-column-start': ['auto', 'span 2'], 'grid-column-end': ['auto', 'span 2', '-1'],
  'grid-row-start': ['auto', 'span 2'], 'grid-row-end': ['auto', 'span 2', '-1'],
  'text-align': ['left', 'center', 'right', 'justify', 'start', 'end'],
  'text-align-last': ['auto', 'left', 'center', 'right', 'justify'],
  'vertical-align': ['middle', 'top', 'bottom', 'baseline', 'text-top', 'text-bottom', 'sub', 'super'],
  'font-weight': ['400', '500', '600', '700', '800', '900', '300', '200', '100', 'normal', 'bold', 'bolder', 'lighter'],
  'font-style': ['normal', 'italic', 'oblique'],
  'font-family': ['system-ui, sans-serif', 'Inter, sans-serif', 'Poppins, sans-serif', '"DM Sans", sans-serif', '"Playfair Display", serif', '"JetBrains Mono", monospace', 'Georgia, serif', 'sans-serif', 'serif', 'monospace', 'cursive'],
  'font-display': ['swap', 'block', 'fallback', 'optional', 'auto'],
  'font-variant-numeric': ['tabular-nums', 'proportional-nums', 'oldstyle-nums', 'lining-nums', 'slashed-zero'],
  'text-transform': ['uppercase', 'lowercase', 'capitalize', 'none'],
  'text-decoration': ['none', 'underline', 'line-through', 'overline', 'underline dotted'],
  'text-decoration-line': ['none', 'underline', 'line-through', 'overline'],
  'text-decoration-style': ['solid', 'double', 'dotted', 'dashed', 'wavy'],
  'text-overflow': ['ellipsis', 'clip'],
  'text-wrap': ['wrap', 'nowrap', 'balance', 'pretty', 'stable'],
  'text-rendering': ['auto', 'optimizeLegibility', 'optimizeSpeed', 'geometricPrecision'],
  'white-space': ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces'],
  'word-break': ['normal', 'break-all', 'keep-all', 'break-word'],
  'overflow-wrap': ['normal', 'anywhere', 'break-word'],
  hyphens: ['none', 'manual', 'auto'],
  'writing-mode': ['horizontal-tb', 'vertical-rl', 'vertical-lr'],
  direction: ['ltr', 'rtl'],
  overflow: ['hidden', 'auto', 'visible', 'scroll', 'clip'],
  'overflow-x': ['hidden', 'auto', 'visible', 'scroll', 'clip'],
  'overflow-y': ['hidden', 'auto', 'visible', 'scroll', 'clip'],
  'overscroll-behavior': ['auto', 'contain', 'none'],
  cursor: CURSORS,
  'box-sizing': ['border-box', 'content-box'],
  'object-fit': ['cover', 'contain', 'fill', 'none', 'scale-down'],
  'object-position': ['center', 'top', 'bottom', 'left', 'right', 'center top'],
  visibility: ['visible', 'hidden', 'collapse'],
  'pointer-events': ['none', 'auto'],
  'user-select': ['none', 'auto', 'text', 'all'],
  'touch-action': ['auto', 'none', 'manipulation', 'pan-x', 'pan-y'],
  resize: ['none', 'both', 'horizontal', 'vertical'],
  float: ['left', 'right', 'none', 'inline-start', 'inline-end'],
  clear: ['both', 'left', 'right', 'none'],
  isolation: ['isolate', 'auto'],
  'mix-blend-mode': BLEND, 'background-blend-mode': BLEND,
  'background-size': ['cover', 'contain', 'auto', '100% 100%'],
  'background-repeat': ['no-repeat', 'repeat', 'repeat-x', 'repeat-y', 'space', 'round'],
  'background-position': ['center', 'top', 'bottom', 'left', 'right', 'center top', 'center bottom'],
  'background-attachment': ['scroll', 'fixed', 'local'],
  'background-clip': ['border-box', 'padding-box', 'content-box', 'text'],
  'background-origin': ['border-box', 'padding-box', 'content-box'],
  'border-style': BORDER_STYLES, 'outline-style': [...BORDER_STYLES, 'auto'],
  'border-top-style': BORDER_STYLES, 'border-right-style': BORDER_STYLES, 'border-bottom-style': BORDER_STYLES, 'border-left-style': BORDER_STYLES,
  'border-collapse': ['collapse', 'separate'],
  'table-layout': ['auto', 'fixed'],
  'list-style': ['none', 'disc', 'decimal', 'square', 'circle', 'inside', 'outside'],
  'list-style-type': ['none', 'disc', 'decimal', 'circle', 'square', 'lower-alpha', 'upper-roman'],
  'list-style-position': ['inside', 'outside'],
  'transition-timing-function': EASINGS, 'animation-timing-function': EASINGS,
  'transition-property': ['all', 'none', 'opacity', 'transform', 'background-color', 'color', 'box-shadow'],
  'transition-behavior': ['allow-discrete', 'normal'],
  transition: ['all .2s ease', 'opacity .2s ease', 'transform .2s ease', 'none'],
  'animation-direction': ['normal', 'reverse', 'alternate', 'alternate-reverse'],
  'animation-fill-mode': ['none', 'forwards', 'backwards', 'both'],
  'animation-iteration-count': ['infinite', '1', '2', '3'],
  'animation-play-state': ['running', 'paused'],
  'transform-origin': ['center', 'top left', 'top', 'bottom', 'left', 'right', 'bottom right'],
  'transform-style': ['flat', 'preserve-3d'],
  'transform-box': ['content-box', 'border-box', 'fill-box', 'stroke-box', 'view-box'],
  'backface-visibility': ['visible', 'hidden'],
  'will-change': ['transform', 'opacity', 'auto', 'scroll-position', 'contents'],
  'scroll-behavior': ['smooth', 'auto'],
  'scroll-snap-type': ['x mandatory', 'y mandatory', 'x proximity', 'y proximity', 'none'],
  'scroll-snap-align': ['start', 'center', 'end', 'none'],
  'scroll-snap-stop': ['normal', 'always'],
  'scrollbar-width': ['auto', 'thin', 'none'],
  'scrollbar-gutter': ['auto', 'stable', 'stable both-edges'],
  'container-type': ['inline-size', 'size', 'normal'],
  'content-visibility': ['visible', 'auto', 'hidden'],
  contain: ['none', 'strict', 'content', 'size', 'layout', 'style', 'paint', 'inline-size'],
  appearance: ['none', 'auto'],
  'color-scheme': ['light dark', 'light', 'dark', 'normal'],
  'image-rendering': ['auto', 'pixelated', 'crisp-edges', 'smooth'],
  'aspect-ratio': ['1', '16 / 9', '4 / 3', '3 / 2', '1 / 1', 'auto'],
  'z-index': ['1', '10', '100', '999', 'auto', '-1'],
  opacity: ['0', '0.5', '1'],
  content: ['""', 'none', 'normal', 'attr()', 'counter()', 'open-quote', 'close-quote'],
  'box-shadow': ['none', '0 1px 2px rgb(0 0 0 / .08)', '0 8px 24px rgb(0 0 0 / .12)', 'inset 0 0 0 1px currentColor'],
  'text-shadow': ['none', '0 1px 2px rgb(0 0 0 / .25)'],
  'border-radius': ['4px', '8px', '12px', '999px', '50%'],
  'line-height': ['1', '1.2', '1.4', '1.5', '1.6', 'normal'],
  'font-size': ['12px', '14px', '16px', '20px', '24px', '32px', 'clamp(1rem, 2vw, 1.5rem)', 'smaller', 'larger'],
  'letter-spacing': ['normal', '0.02em', '-0.02em'],
  width: ['100%', 'auto', 'fit-content', 'max-content', 'min-content', '100vw'],
  height: ['100%', 'auto', 'fit-content', 'max-content', 'min-content', '100vh', '100dvh'],
  'max-width': ['100%', 'none', 'fit-content', '1200px', '65ch'],
  'min-width': ['0', 'auto', 'fit-content', 'min-content'],
  'min-height': ['0', 'auto', '100vh', '100dvh'],
  'max-height': ['none', '100%', '100vh'],
  margin: ['0', 'auto', '0 auto'], padding: ['0'],
  flex: ['1', '1 1 0', '0 0 auto', 'none', 'auto'],
  'flex-grow': ['0', '1'], 'flex-shrink': ['0', '1'], 'flex-basis': ['auto', '0', '100%', 'content'],
  border: ['none', '1px solid', '1px solid currentColor'],
  outline: ['none', '2px solid', '2px solid currentColor'],
  filter: ['none'], 'backdrop-filter': ['none'],
  'clip-path': ['none'],
  quotes: ['auto', 'none'],
  'caption-side': ['top', 'bottom'],
  'empty-cells': ['show', 'hide'],
  'break-inside': ['avoid', 'auto'],
  'print-color-adjust': ['exact', 'economy'],
  'paint-order': ['normal', 'stroke', 'fill'],
  'stroke-linecap': ['butt', 'round', 'square'],
  'stroke-linejoin': ['miter', 'round', 'bevel'],
  'fill-rule': ['nonzero', 'evenodd'],
  '-webkit-box-orient': ['vertical', 'horizontal'],
  '-webkit-font-smoothing': ['antialiased', 'subpixel-antialiased', 'auto'],
};
/** Valores que servem para qualquer propriedade. */
const GLOBAL_VALUES = ['inherit', 'initial', 'unset', 'revert'];

/** Propriedades de UM valor só: aceitar a sugestão já põe o ";" no fim da linha. */
const SINGLE = new Set(['display', 'position', 'flex-direction', 'flex-wrap', 'justify-content', 'align-content', 'align-items',
  'justify-items', 'align-self', 'justify-self', 'text-align', 'vertical-align', 'font-weight', 'font-style', 'text-transform',
  'text-overflow', 'text-wrap', 'white-space', 'word-break', 'overflow', 'overflow-x', 'overflow-y', 'cursor', 'box-sizing',
  'object-fit', 'visibility', 'pointer-events', 'user-select', 'resize', 'float', 'clear', 'isolation', 'mix-blend-mode',
  'background-repeat', 'background-attachment', 'background-clip', 'border-style', 'border-collapse', 'table-layout',
  'list-style-type', 'animation-direction', 'animation-fill-mode', 'animation-play-state', 'transform-style',
  'backface-visibility', 'scroll-behavior', 'scrollbar-width', 'container-type', 'appearance', 'hyphens', 'direction',
  'writing-mode', 'overflow-wrap', 'font-display', 'image-rendering', 'grid-auto-flow', 'touch-action', 'content-visibility']);

/** As 148 cores com nome do CSS (+ transparent e currentColor). */
export const NAMED_COLORS = `transparent currentColor white black red green blue yellow orange purple pink gray grey silver
maroon olive lime aqua teal navy fuchsia aliceblue antiquewhite aquamarine azure beige bisque blanchedalmond blueviolet
brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod
darkgray darkgreen darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
darkslateblue darkslategray darkturquoise darkviolet deeppink deepskyblue dimgray dodgerblue firebrick floralwhite
forestgreen gainsboro ghostwhite gold goldenrod greenyellow honeydew hotpink indianred indigo ivory khaki lavender
lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightpink
lightsalmon lightseagreen lightskyblue lightslategray lightsteelblue lightyellow limegreen linen magenta mediumaquamarine
mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred
midnightblue mintcream mistyrose moccasin navajowhite oldlace olivedrab orangered orchid palegoldenrod palegreen
paleturquoise palevioletred papayawhip peachpuff peru plum powderblue rebeccapurple rosybrown royalblue saddlebrown
salmon sandybrown seagreen seashell sienna skyblue slateblue slategray snow springgreen steelblue tan thistle tomato
turquoise violet wheat whitesmoke yellowgreen`.split(/\s+/);

/** Funções de CSS: nome → descrição curta. */
const FN_DOC = {
  var: 'Usa uma variável CSS (--nome).', calc: 'Conta com unidades misturadas: calc(100% - 32px).',
  clamp: 'Valor fluido entre um mínimo e um máximo: clamp(mín, ideal, máx).', min: 'O menor dos valores.', max: 'O maior dos valores.',
  rgb: 'Cor por vermelho, verde e azul: rgb(255 0 0 / .5).', hsl: 'Cor por matiz, saturação e luz.', oklch: 'Cor perceptual (luz, croma, matiz).',
  'color-mix': 'Mistura duas cores: color-mix(in srgb, red 40%, blue).', 'light-dark': 'Uma cor no tema claro e outra no escuro.',
  'linear-gradient': 'Gradiente em linha reta.', 'radial-gradient': 'Gradiente circular.', 'conic-gradient': 'Gradiente em volta de um ponto.',
  'repeating-linear-gradient': 'Gradiente linear que se repete (listras).', url: 'Endereço de uma imagem ou arquivo.',
  repeat: 'Repete faixas da grade: repeat(3, 1fr).', minmax: 'Faixa com mínimo e máximo: minmax(200px, 1fr).', 'fit-content': 'Do tamanho do conteúdo, até um limite.',
  translate: 'Move em x e y.', translateX: 'Move na horizontal.', translateY: 'Move na vertical.', rotate: 'Gira (deg, turn).',
  scale: 'Aumenta ou diminui.', skew: 'Inclina.', matrix: 'Transformação por matriz.', perspective: 'Profundidade 3D.',
  blur: 'Desfoca.', brightness: 'Brilho.', contrast: 'Contraste.', 'drop-shadow': 'Sombra que segue o desenho.', grayscale: 'Tons de cinza.',
  'hue-rotate': 'Gira as cores.', invert: 'Inverte as cores.', saturate: 'Saturação.', sepia: 'Tom sépia.', opacity: 'Transparência.',
  'cubic-bezier': 'Curva de aceleração própria.', steps: 'Animação em degraus.', inset: 'Recorte retangular.', circle: 'Recorte em círculo.',
  ellipse: 'Recorte em elipse.', polygon: 'Recorte por pontos.', attr: 'Valor de um atributo do HTML.', counter: 'Valor de um contador.',
  env: 'Variável do ambiente (ex.: safe-area-inset-top).',
};
const COLOR_FNS = ['var', 'rgb', 'hsl', 'oklch', 'color-mix', 'light-dark'];
const LENGTH_FNS = ['var', 'calc', 'clamp', 'min', 'max'];
/** Funções sugeridas por "tipo" de propriedade. */
function fnsFor(prop) {
  if (/^(background|background-image|mask|mask-image|border-image|border-image-source|list-style-image)$/.test(prop)) return ['linear-gradient', 'radial-gradient', 'conic-gradient', 'repeating-linear-gradient', 'url', ...COLOR_FNS];
  if (isColorProp(prop)) return COLOR_FNS;
  if (/^(grid-template-columns|grid-template-rows|grid-auto-columns|grid-auto-rows|grid-template|grid)$/.test(prop)) return ['repeat', 'minmax', 'fit-content', ...LENGTH_FNS];
  if (prop === 'transform') return ['translate', 'translateX', 'translateY', 'rotate', 'scale', 'skew', 'matrix', 'perspective', 'var'];
  if (prop === 'filter' || prop === 'backdrop-filter') return ['blur', 'brightness', 'contrast', 'drop-shadow', 'grayscale', 'hue-rotate', 'invert', 'opacity', 'saturate', 'sepia', 'var'];
  if (/timing-function$|^(transition|animation)$/.test(prop)) return ['cubic-bezier', 'steps', 'var'];
  if (prop === 'clip-path' || prop === 'shape-outside') return ['inset', 'circle', 'ellipse', 'polygon', 'url', 'var'];
  if (prop === 'content') return ['attr', 'counter', 'url', 'var'];
  if (/^(padding|margin|top|right|bottom|left|inset)/.test(prop)) return [...LENGTH_FNS, 'env'];
  return LENGTH_FNS;
}
/** Sugestões DENTRO de uma função: nome da função → valores. */
const FN_ARGS = {
  repeat: ['auto-fill', 'auto-fit', 'minmax()', '1fr', '2', '3', '4'],
  minmax: ['0', '1fr', 'auto', 'min-content', 'max-content', '200px'],
  'linear-gradient': ['to right', 'to bottom', 'to left', 'to top', 'to bottom right', '45deg', '135deg', '180deg'],
  'repeating-linear-gradient': ['45deg', 'to right'],
  'radial-gradient': ['circle', 'ellipse', 'circle at center', 'circle at top', 'closest-side', 'farthest-corner'],
  'conic-gradient': ['from 0deg', 'from 90deg at center'],
  'color-mix': ['in srgb', 'in oklch', 'in hsl'],
  steps: ['4', 'jump-start', 'jump-end', 'jump-none', 'start', 'end'],
  env: ['safe-area-inset-top', 'safe-area-inset-right', 'safe-area-inset-bottom', 'safe-area-inset-left'],
  'cubic-bezier': ['0.4, 0, 0.2, 1', '0.16, 1, 0.3, 1', '0.34, 1.56, 0.64, 1'],
};
/** As funções que recebem cores entre os argumentos. */
const COLOR_ARG_FNS = new Set(['linear-gradient', 'radial-gradient', 'conic-gradient', 'repeating-linear-gradient', 'color-mix', 'light-dark', 'drop-shadow']);

const isColorProp = (p) => /color$|^(fill|stroke|background|border|border-(top|right|bottom|left|block|inline)|outline|box-shadow|text-shadow|text-decoration|column-rule|scrollbar-color)$/.test(p);
const TIME_PROPS = /^(transition|animation)(-duration|-delay)?$/;
const ANGLE_PROPS = /^(rotate|transform|filter|backdrop-filter|background|background-image)$/;
const FR_PROPS = /^grid-(template|auto)-(columns|rows)$|^grid-template$|^grid$/;
const UNITLESS = /^(opacity|z-index|font-weight|flex-grow|flex-shrink|order|scale|orphans|widows|aspect-ratio|column-count|animation-iteration-count|zoom|fill-opacity|stroke-opacity|line-clamp|-webkit-line-clamp)$/;
const LENGTH_UNITS = [['px', 'pixels'], ['rem', 'relativo à fonte da raiz'], ['%', 'porcentagem do pai'], ['em', 'relativo à fonte do elemento'],
  ['vw', '% da largura da janela'], ['vh', '% da altura da janela'], ['dvh', 'altura dinâmica da janela (celular)'], ['ch', 'largura do "0"'],
  ['svh', 'menor altura da janela'], ['vmin', '% do menor lado da janela'], ['vmax', '% do maior lado da janela'], ['cqi', '% do container (@container)'], ['ex', 'altura do "x"']];
/** Unidades possíveis para a propriedade (vazio = sem unidade). */
function unitsFor(prop) {
  if (UNITLESS.test(prop)) return [];
  if (TIME_PROPS.test(prop)) return [['ms', 'milissegundos'], ['s', 'segundos']];
  const out = [];
  if (FR_PROPS.test(prop)) out.push(['fr', 'fração do espaço livre da grade']);
  out.push(...LENGTH_UNITS);
  if (ANGLE_PROPS.test(prop)) out.push(['deg', 'graus'], ['turn', 'voltas'], ['rad', 'radianos']);
  if (/^(transition|animation)$/.test(prop)) out.push(['ms', 'milissegundos'], ['s', 'segundos']);
  return out;
}

// ---- seletores e @regras
/** Etiquetas HTML mais usadas no CSS (seletores). */
const SELECTOR_TAGS = `body main header footer nav section article aside div span p a h1 h2 h3 h4 h5 h6 img picture figure figcaption
ul ol li dl dt dd button input textarea select label form fieldset legend table thead tbody tr th td strong em small
blockquote code pre hr svg video iframe details summary dialog html :root *`.split(/\s+/);
/** Pseudo-classes e pseudo-elementos (o `()` indica que recebe argumento). */
const PSEUDOS = [
  [':hover', 'mouse por cima'], [':focus-visible', 'foco pelo teclado'], [':focus', 'com foco'], [':active', 'sendo clicado'],
  [':focus-within', 'algum filho com foco'], [':visited', 'link já visitado'], [':disabled', 'desativado'], [':checked', 'marcado'],
  [':first-child', 'primeiro filho'], [':last-child', 'último filho'], [':nth-child()', 'n-ésimo filho (2n, odd…)'],
  [':nth-of-type()', 'n-ésimo do mesmo tipo'], [':not()', 'que NÃO combina com'], [':is()', 'que combina com qualquer um'],
  [':where()', 'como :is(), sem especificidade'], [':has()', 'que contém'], [':empty', 'sem filhos'], [':root', 'a raiz (html)'],
  [':placeholder-shown', 'mostrando o placeholder'], [':invalid', 'campo inválido'], [':valid', 'campo válido'], [':required', 'obrigatório'],
  [':target', 'alvo da âncora (#)'], [':only-child', 'filho único'], [':first-of-type', 'primeiro do tipo'], [':last-of-type', 'último do tipo'],
  ['::before', 'conteúdo antes'], ['::after', 'conteúdo depois'], ['::placeholder', 'texto do placeholder'], ['::selection', 'texto selecionado'],
  ['::marker', 'marcador da lista'], ['::first-line', 'primeira linha'], ['::first-letter', 'primeira letra'], ['::backdrop', 'fundo do <dialog>'],
];
/** @regras (snippets): o CARET marca onde o cursor fica. */
const AT_RULES = [
  ['@keyframes', `@keyframes ${CARET}nome {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}`, 'Animação: passos de from a to.'],
  ['@supports', `@supports (${CARET}display: grid) {\n  \n}`, 'Só aplica se o navegador suportar.'],
  ['@container', `@container (max-width: ${CARET}400px) {\n  \n}`, 'Conforme a largura do container (container-type).'],
  ['@font-face', `@font-face {\n  font-family: "${CARET}";\n  src: url("") format("woff2");\n  font-display: swap;\n}`, 'Carrega uma fonte própria.'],
  ['@media (prefers-color-scheme: dark)', `@media (prefers-color-scheme: dark) {\n  ${CARET}\n}`, 'Quando o sistema está no tema escuro.'],
  ['@media (prefers-reduced-motion: reduce)', `@media (prefers-reduced-motion: reduce) {\n  ${CARET}\n}`, 'Quando a pessoa pediu menos animação.'],
  ['@media (hover: hover)', `@media (hover: hover) {\n  ${CARET}\n}`, 'Só em telas com mouse (hover de verdade).'],
  ['@import', `@import url("${CARET}");`, 'Importa outra folha de estilo.'],
  ['@layer', `@layer ${CARET};`, 'Camadas de cascata.'],
  ['@property', `@property --${CARET}nome {\n  syntax: "<length>";\n  inherits: false;\n  initial-value: 0px;\n}`, 'Registra uma variável com tipo (animável).'],
];
/** Condições do @media (além das larguras dos breakpoints). */
const MEDIA_FEATURES = [
  ['(min-width: )', 'a partir de uma largura'], ['(max-width: )', 'até uma largura'], ['(prefers-color-scheme: dark)', 'tema escuro'],
  ['(prefers-color-scheme: light)', 'tema claro'], ['(prefers-reduced-motion: reduce)', 'menos animação'], ['(hover: hover)', 'com mouse'],
  ['(pointer: coarse)', 'toque (dedo)'], ['(orientation: portrait)', 'retrato'], ['(orientation: landscape)', 'paisagem'],
  ['screen', 'telas'], ['print', 'impressão'], ['and', 'e'], ['not', 'não'],
];

// ================================================================== CSS: contexto
/**
 * Lê o CSS até o cursor e diz onde ele está: { in: 'comment'|'string' } ou
 * { stack: [cabeçalhos dos blocos abertos], stmt: texto desde o último { } ; , stmtStart }.
 */
export function scanCss(text, pos) {
  const stack = [];
  let stmtStart = 0;
  let i = 0;
  while (i < pos) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '*') {
      const e = text.indexOf('*/', i + 2);
      if (e < 0 || e + 2 > pos) return { in: 'comment' };
      i = e + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < pos && text[j] !== c && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
      if (j >= pos) return { in: 'string' };
      i = j + 1;
      continue;
    }
    if (c === '{') { stack.push(text.slice(stmtStart, i).trim()); stmtStart = i + 1; }
    else if (c === '}') { stack.pop(); stmtStart = i + 1; }
    else if (c === ';') stmtStart = i + 1;
    i++;
  }
  return { stack, stmt: text.slice(stmtStart, pos), stmtStart };
}

/** Tipo do bloco onde o cursor está: 'decls' (propriedades), 'rules' (seletores/@regras) ou 'keyframes'. */
function blockKind(stack, decls) {
  if (decls && !stack.length) return 'decls';
  const top = stack[stack.length - 1];
  if (top === undefined) return 'rules';
  if (/^@(media|supports|container|layer|scope|document|starting-style)\b/i.test(top)) return 'rules';
  if (/^@(-webkit-)?keyframes\b/i.test(top)) return 'keyframes';
  return 'decls';
}

/** Variáveis declaradas no próprio texto (`--nome: valor`), além das do documento. */
function localVars(text) {
  const out = new Map();
  for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;{}]*)/g)) if (!out.has(m[1])) out.set(m[1], m[2].trim());
  return out;
}

/** Função aberta mais interna no valor (ex.: "repeat(auto-fill, " → "repeat"), ou ''. */
function openFn(value) {
  const stack = [];
  const re = /([\w-]*)\(|\)/g;
  let m;
  while ((m = re.exec(value))) {
    if (m[0] === ')') stack.pop();
    else stack.push(m[1].toLowerCase());
  }
  return stack.length ? stack[stack.length - 1] : null;
}

/** Itens de variáveis: { name: '--cor-x', value, kind: 'color'|'size' } → var(--x). */
function varItems(vars, { bare = false } = {}) {
  return vars.map((v) => ({
    label: bare ? v.name : `var(${v.name})`, filter: bare ? v.name : `${v.name} var(${v.name})`, kind: 'variable',
    insert: bare ? v.name : `var(${v.name})`, detail: v.value || '', color: v.kind === 'color' ? v.value : undefined,
    doc: v.label ? `Variável do projeto: ${v.label}` : 'Variável CSS',
  }));
}

/** Itens de função: "calc()" com o cursor dentro dos parênteses. */
const fnItem = (name) => ({ label: `${name}()`, filter: name, kind: 'function', insert: `${name}(${CARET})`, doc: FN_DOC[name] || '', retrigger: true });

/**
 * SUGESTÕES DE CSS para o cursor em `pos`.
 * @param {string} text  todo o texto do editor
 * @param {number} pos   posição do cursor
 * @param {{ decls?: boolean, manual?: boolean, vars?: {name:string,value:string,kind:string,label?:string}[],
 *           classes?: string[], ids?: string[], breakpoints?: {name:string,max:number}[], colors?: {name:string,value:string}[] }} [opts]
 *   decls = o texto é só uma lista de declarações (CSS da camada) · manual = Ctrl+Espaço (mostra mesmo sem nada digitado)
 * @returns {{ from: number, to: number, items: object[], context: string } | null}
 */
export function completeCss(text, pos, opts = {}) {
  const { decls = false, manual = false } = opts;
  const scan = scanCss(text, pos);
  if (scan.in) return null;
  const kind = blockKind(scan.stack, decls);
  const after = text.slice(pos);
  const wordAfter = /^[\w-]*/.exec(after)[0];
  const lineRest = after.slice(wordAfter.length).split('\n')[0];
  const docVars = [...(opts.vars || [])];
  for (const [name, value] of localVars(text)) if (!docVars.some((v) => v.name === name)) docVars.push({ name, value, kind: /^(#|rgb|hsl|oklch)/.test(value) ? 'color' : 'size' });
  const out = (from, items, context, to = pos + wordAfter.length) => {
    const ranked = rank(items, text.slice(from, pos));
    return ranked.length ? { from, to, items: ranked, context } : null;
  };

  if (kind === 'decls') {
    const stmt = scan.stmt;
    const colon = stmt.indexOf(':');
    // ---- nome da propriedade
    if (colon < 0) {
      const m = /(-{0,2}[\w-]*)$/.exec(stmt);
      const word = m[1];
      if (!/^\s*-{0,2}[\w-]*$/.test(stmt)) return null; // algo estranho (seletor aninhado etc.)
      if (!word && !manual) return null;
      if (/^\d/.test(word)) return null;
      const hasColon = /^\s*:/.test(after.slice(wordAfter.length));
      const items = CSS_PROPERTIES.map((p) => ({ label: p, kind: 'property', insert: hasColon ? p : `${p}: `, doc: PROP_DOC[p] || '', retrigger: !hasColon }));
      if (word.startsWith('--')) docVars.forEach((v) => items.unshift({ label: v.name, kind: 'variable', insert: hasColon ? v.name : `${v.name}: `, detail: v.value, color: v.kind === 'color' ? v.value : undefined }));
      return out(pos - word.length, items, 'property');
    }
    // ---- valor
    const prop = stmt.slice(0, colon).trim().toLowerCase();
    const value = stmt.slice(colon + 1);
    if (/!\w*$/.test(value)) return out(pos - /!\w*$/.exec(value)[0].length, [{ label: '!important', kind: 'value', insert: '!important', doc: 'Vence as outras regras (use com moderação).' }], 'value');
    const word = /[\w.#%-]*$/.exec(value)[0];
    const from = pos - word.length;
    const fn = openFn(value);
    const endOfLine = !lineRest.trim() || /^\s*\}/.test(lineRest);
    const semi = (v) => (SINGLE.has(prop) && endOfLine && !/^\s*;/.test(lineRest) && !fn ? `${v};` : v);
    // número → unidades
    const num = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i.exec(word);
    if (num) {
      if (/^-?0*\.?0*$/.test(num[1]) && !num[2]) return null;
      const units = unitsFor(prop);
      if (!units.length) return null;
      const items = units.map(([u, d]) => ({ label: `${num[1]}${u}`, filter: u, kind: 'unit', insert: `${num[1]}${u}`, detail: u, doc: d }));
      const r = rank(items, num[2]);
      return r.length ? { from, to: pos + wordAfter.length, items: r, context: 'unit' } : null;
    }
    // dentro de var( → nomes das variáveis
    if (fn === 'var') {
      if (!word && !manual && !/\(\s*$/.test(value)) return null;
      return out(from, varItems(docVars, { bare: true }), 'variable');
    }
    // --algo fora do var( → var(--algo)
    if (word.startsWith('--')) return out(from, varItems(docVars), 'variable');
    // #… → cores do projeto em hex
    if (word.startsWith('#')) {
      const items = (opts.colors || []).map((c) => ({ label: c.value, filter: `${c.value} ${c.name}`, kind: 'color', insert: c.value, detail: c.name, color: c.value }));
      return out(from, items, 'color');
    }
    const start = !value.trim() || /\(\s*$/.test(value) || /,\s*$/.test(value);
    if (!word && !manual && !start) return null;
    const items = [];
    if (fn) (FN_ARGS[fn] || []).forEach((v) => items.push(v.endsWith('()') ? fnItem(v.slice(0, -2)) : { label: v, kind: 'value', insert: v }));
    else (CSS_VALUES[prop] || []).forEach((v) => items.push({ label: v, kind: 'value', insert: semi(v) }));
    const colorish = fn ? COLOR_ARG_FNS.has(fn) : isColorProp(prop);
    // variáveis do projeto: de cor nas propriedades de cor; de tamanho nas outras
    items.push(...varItems(docVars.filter((v) => (colorish ? v.kind === 'color' : v.kind !== 'color'))));
    (fn ? (colorish ? COLOR_FNS : LENGTH_FNS) : fnsFor(prop)).forEach((f) => items.push(fnItem(f)));
    if (colorish) {
      (opts.colors || []).forEach((c) => items.push({ label: c.value, filter: `${c.value} ${c.name}`, kind: 'color', insert: c.value, detail: c.name, color: c.value }));
      NAMED_COLORS.forEach((c) => items.push({ label: c, kind: 'color', insert: fn ? c : semi(c), color: c }));
    }
    if (!fn) GLOBAL_VALUES.forEach((v) => items.push({ label: v, kind: 'value', insert: semi(v), detail: 'global' }));
    return out(from, items, 'value');
  }

  // ---- @keyframes: from / to / %
  if (kind === 'keyframes') {
    const word = /[\w%]*$/.exec(scan.stmt)[0];
    if (!word && !manual) return null;
    return out(pos - word.length, ['from', 'to', '0%', '50%', '100%'].map((v) => ({ label: v, kind: 'selector', insert: v })), 'keyframes');
  }

  // ---- seletores e @regras
  const stmt = scan.stmt;
  const trimmed = stmt.replace(/^\s+/, '');
  if (trimmed.startsWith('@')) {
    // @media … → condições (larguras dos breakpoints do projeto e mais)
    const mm = /^@media\s+([\s\S]*)$/i.exec(trimmed);
    if (mm) {
      const word = /[\w(:-]*$/.exec(mm[1])[0];
      if (!word && !manual && !/\s$/.test(mm[1])) return null;
      const items = (opts.breakpoints || []).map((b) => ({ label: `(max-width: ${b.max}px)`, filter: `(max-width: ${b.max}px) ${b.name}`, kind: 'at', insert: `(max-width: ${b.max}px)`, detail: b.name, doc: `Breakpoint do projeto: ${b.name} (até ${b.max}px).` }));
      MEDIA_FEATURES.forEach(([f, d]) => items.push({ label: f, kind: 'at', insert: f.replace(': )', `: ${CARET})`), detail: d }));
      return out(pos - word.length, items, 'media');
    }
    if (/\s/.test(trimmed)) return null;
    const items = (opts.breakpoints || []).map((b) => ({
      label: `@media (max-width: ${b.max}px)`, filter: `@media ${b.name}`, kind: 'at', detail: b.name,
      insert: `@media (max-width: ${b.max}px) {\n  ${CARET}\n}`, doc: `Regras para o breakpoint ${b.name} (telas até ${b.max}px).`,
    }));
    items.push({ label: '@media', kind: 'at', insert: `@media ${CARET}`, doc: 'Regras que valem só em certas telas.', retrigger: true });
    AT_RULES.forEach(([label, insert, doc]) => items.push({ label, kind: 'at', insert, doc }));
    return out(pos - trimmed.length, items, 'at');
  }
  // última parte do seletor: .classe, #id, :pseudo, etiqueta
  const m = /(::?[\w-]*|[.#][\w-]*|[\w-]+)$/.exec(stmt);
  const word = m ? m[1] : '';
  if (!word && !manual) return null;
  const items = [];
  const classes = (opts.classes || []).map((c) => ({ label: `.${c}`, kind: 'class', insert: `.${c}`, detail: 'classe', doc: 'Classe de uma camada (ou classe extra) do projeto.' }));
  const ids = (opts.ids || []).map((c) => ({ label: `#${c}`, kind: 'id', insert: `#${c}`, detail: 'id', doc: 'id de uma camada do projeto.' }));
  const pseudos = PSEUDOS.map(([p, d]) => ({ label: p, kind: 'pseudo', insert: p.endsWith('()') ? `${p.slice(0, -1)}${CARET})` : p, detail: d }));
  if (word.startsWith('.')) items.push(...classes);
  else if (word.startsWith('#')) items.push(...ids);
  else if (word.startsWith(':')) items.push(...pseudos);
  else {
    items.push(...classes, ...ids);
    SELECTOR_TAGS.forEach((t) => items.push({ label: t, kind: 'tag', insert: t, detail: t === ':root' ? 'variáveis globais' : 'etiqueta' }));
    if (!word && !/\S/.test(stmt)) {
      AT_RULES.slice(0, 1).forEach(([label, insert, doc]) => items.push({ label, kind: 'at', insert, doc }));
    }
  }
  return out(pos - word.length, items, 'selector');
}

// ================================================================== dados de HTML
/** Etiquetas HTML: nome → descrição curta. */
export const HTML_TAGS = {
  div: 'Caixa genérica', section: 'Seção temática', header: 'Cabeçalho', footer: 'Rodapé', main: 'Conteúdo principal', nav: 'Navegação',
  article: 'Conteúdo independente', aside: 'Conteúdo lateral', h1: 'Título nível 1', h2: 'Título nível 2', h3: 'Título nível 3',
  h4: 'Título nível 4', h5: 'Título nível 5', h6: 'Título nível 6', p: 'Parágrafo', a: 'Link', span: 'Trecho de texto', strong: 'Importante (negrito)',
  em: 'Ênfase (itálico)', small: 'Texto pequeno', b: 'Negrito', i: 'Itálico', u: 'Sublinhado', s: 'Riscado', mark: 'Destaque',
  code: 'Código', pre: 'Texto pré-formatado', kbd: 'Tecla', sub: 'Subscrito', sup: 'Sobrescrito', abbr: 'Abreviação', time: 'Data/hora',
  q: 'Citação curta', blockquote: 'Citação em bloco', cite: 'Título de obra', br: 'Quebra de linha', hr: 'Linha divisória',
  ul: 'Lista com marcadores', ol: 'Lista numerada', li: 'Item de lista', dl: 'Lista de definições', dt: 'Termo', dd: 'Definição',
  img: 'Imagem', picture: 'Imagem responsiva', source: 'Fonte de mídia', figure: 'Figura', figcaption: 'Legenda da figura',
  video: 'Vídeo', audio: 'Áudio', iframe: 'Página incorporada (https)', svg: 'Desenho vetorial', canvas: 'Área de desenho',
  button: 'Botão', form: 'Formulário', input: 'Campo', textarea: 'Campo de várias linhas', select: 'Lista de opções', option: 'Opção',
  optgroup: 'Grupo de opções', label: 'Rótulo de campo', fieldset: 'Grupo de campos', legend: 'Título do grupo', datalist: 'Sugestões do campo',
  output: 'Resultado', progress: 'Barra de progresso', meter: 'Medidor', table: 'Tabela', thead: 'Cabeçalho da tabela', tbody: 'Corpo da tabela',
  tfoot: 'Rodapé da tabela', tr: 'Linha', th: 'Célula de cabeçalho', td: 'Célula', caption: 'Legenda da tabela', colgroup: 'Grupo de colunas', col: 'Coluna',
  details: 'Bloco que abre/fecha', summary: 'Título do details', dialog: 'Caixa de diálogo', address: 'Contato', template: 'Modelo (não aparece)',
  slot: 'Espaço de componente', wbr: 'Ponto de quebra opcional', data: 'Valor legível por máquina', menu: 'Lista de comandos', search: 'Área de busca', hgroup: 'Grupo de títulos',
};
/** Etiquetas que não têm fechamento. */
export const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/** Etiquetas "de linha" (no Emmet, ficam na mesma linha do pai). */
const INLINE_TAGS = new Set(['a', 'span', 'strong', 'em', 'b', 'i', 'u', 's', 'small', 'mark', 'code', 'kbd', 'sub', 'sup', 'abbr', 'time', 'q', 'cite', 'img', 'br', 'wbr', 'label', 'data', 'input', 'output']);
/** Atributos que valem em qualquer etiqueta. */
const GLOBAL_ATTRS = [['class', 'classes CSS'], ['id', 'identificador único'], ['title', 'dica ao passar o mouse'], ['style', 'CSS só deste elemento'],
  ['role', 'papel para acessibilidade'], ['aria-label', 'nome para leitor de tela'], ['aria-hidden', 'esconde do leitor de tela'],
  ['aria-labelledby', 'nome vindo de outro elemento'], ['aria-describedby', 'descrição vinda de outro elemento'], ['aria-expanded', 'aberto/fechado'],
  ['aria-current', 'item atual (navegação)'], ['tabindex', 'ordem do foco (Tab)'], ['lang', 'idioma'], ['dir', 'direção do texto'], ['hidden', 'escondido'],
  ['data-', 'dado próprio (data-*)'], ['draggable', 'pode arrastar'], ['contenteditable', 'texto editável'], ['inert', 'ignora cliques e foco'], ['popover', 'vira um popover']];
/** Atributos próprios de cada etiqueta. */
const TAG_ATTRS = {
  a: ['href', 'target', 'rel', 'download', 'hreflang', 'type'], img: ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'srcset', 'sizes', 'fetchpriority'],
  source: ['src', 'srcset', 'type', 'media', 'sizes'], video: ['src', 'poster', 'controls', 'autoplay', 'muted', 'loop', 'playsinline', 'preload', 'width', 'height'],
  audio: ['src', 'controls', 'autoplay', 'muted', 'loop', 'preload'], iframe: ['src', 'title', 'width', 'height', 'loading', 'allow', 'allowfullscreen', 'referrerpolicy'],
  button: ['type', 'disabled', 'name', 'value', 'popovertarget', 'form'], input: ['type', 'name', 'value', 'placeholder', 'required', 'disabled', 'checked', 'min', 'max', 'step', 'pattern', 'autocomplete', 'inputmode', 'readonly', 'maxlength', 'list', 'autofocus'],
  textarea: ['name', 'rows', 'cols', 'placeholder', 'required', 'disabled', 'maxlength', 'readonly'], select: ['name', 'required', 'disabled', 'multiple'],
  option: ['value', 'selected', 'disabled'], label: ['for'], form: ['action', 'method', 'autocomplete', 'novalidate'], fieldset: ['disabled'],
  ol: ['start', 'reversed', 'type'], li: ['value'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan', 'scope'], time: ['datetime'],
  blockquote: ['cite'], q: ['cite'], details: ['open', 'name'], dialog: ['open'], progress: ['value', 'max'], meter: ['value', 'min', 'max', 'low', 'high', 'optimum'],
  svg: ['viewBox', 'width', 'height', 'fill', 'xmlns'], abbr: ['title'], data: ['value'], col: ['span'], colgroup: ['span'],
};
/** Atributos sem valor (só o nome). */
const BOOLEAN_ATTRS = new Set(['hidden', 'disabled', 'required', 'checked', 'selected', 'readonly', 'multiple', 'autofocus', 'autoplay', 'controls',
  'muted', 'loop', 'playsinline', 'open', 'novalidate', 'reversed', 'allowfullscreen', 'inert', 'download', 'popover']);
/** Valores de atributos comuns: "etiqueta.atributo" ou só "atributo". */
const ATTR_VALUES = {
  'input.type': ['text', 'email', 'password', 'number', 'tel', 'url', 'search', 'checkbox', 'radio', 'date', 'time', 'datetime-local', 'month', 'color', 'range', 'file', 'hidden', 'submit', 'reset', 'button'],
  'button.type': ['button', 'submit', 'reset'], 'ol.type': ['1', 'a', 'A', 'i', 'I'],
  target: ['_blank', '_self', '_parent', '_top'], rel: ['noopener', 'noreferrer', 'nofollow', 'external', 'me', 'author', 'preload', 'stylesheet'],
  loading: ['lazy', 'eager'], decoding: ['async', 'sync', 'auto'], fetchpriority: ['high', 'low', 'auto'], preload: ['none', 'metadata', 'auto'],
  method: ['get', 'post', 'dialog'], dir: ['ltr', 'rtl', 'auto'], lang: ['pt-BR', 'en', 'es', 'fr', 'de'], scope: ['col', 'row', 'colgroup', 'rowgroup'],
  autocomplete: ['on', 'off', 'name', 'email', 'username', 'current-password', 'new-password', 'tel', 'street-address', 'postal-code', 'country', 'one-time-code'],
  inputmode: ['text', 'numeric', 'decimal', 'tel', 'email', 'url', 'search', 'none'], draggable: ['true', 'false'], contenteditable: ['true', 'false', 'plaintext-only'],
  'aria-hidden': ['true', 'false'], 'aria-expanded': ['true', 'false'], 'aria-current': ['page', 'step', 'location', 'date', 'true'],
  'aria-live': ['polite', 'assertive', 'off'], popover: ['auto', 'manual'], referrerpolicy: ['no-referrer', 'origin', 'strict-origin-when-cross-origin'],
  role: ['button', 'link', 'banner', 'navigation', 'main', 'contentinfo', 'complementary', 'region', 'list', 'listitem', 'img', 'dialog', 'alert', 'status', 'tab', 'tablist', 'tabpanel', 'presentation', 'none', 'search', 'heading', 'menu', 'menuitem'],
  tabindex: ['0', '-1'], allow: ['fullscreen', 'autoplay', 'clipboard-write', 'encrypted-media', 'picture-in-picture'],
};

/** Pilha das etiquetas abertas (e não fechadas) no HTML até `pos` — a última é a que um "</" deve fechar. */
export function openTags(text) {
  const stack = [];
  const clean = text.replace(/<!--[\s\S]*?(-->|$)/g, '');
  for (const m of clean.matchAll(/<(\/?)([a-zA-Z][\w-]*)(?:\s(?:[^<>"']|"[^"]*"|'[^']*')*)?(\/?)>/g)) {
    const tag = m[2].toLowerCase();
    if (m[1]) { const i = stack.lastIndexOf(tag); if (i >= 0) stack.length = i; }
    else if (!m[3] && !VOID_TAGS.has(tag)) stack.push(tag);
  }
  return stack;
}

/**
 * SUGESTÕES DE HTML para o cursor em `pos`: etiquetas (depois de "<"), fechamento ("</"), atributos (dentro da
 * etiqueta), valores de atributos (entre aspas, inclusive as classes do projeto em class="") e, no texto,
 * etiquetas e abreviações Emmet.
 * @param {string} text
 * @param {number} pos
 * @param {{ manual?: boolean, classes?: string[], ids?: string[] }} [opts]
 * @returns {{ from: number, to: number, items: object[], context: string } | null}
 */
export function completeHtml(text, pos, opts = {}) {
  const { manual = false } = opts;
  const before = text.slice(0, pos);
  if (before.lastIndexOf('<!--') > before.lastIndexOf('-->')) return null;
  const after = text.slice(pos);
  const wordAfter = /^[\w:-]*/.exec(after)[0];
  const out = (from, items, context, to = pos + wordAfter.length) => {
    const ranked = rank(items, text.slice(from, pos));
    return ranked.length ? { from, to, items: ranked, context } : null;
  };
  const lt = before.lastIndexOf('<');
  const gt = before.lastIndexOf('>');
  if (lt > gt) {
    const inside = before.slice(lt + 1);
    // ---- </ → fecha a etiqueta aberta
    if (/^\/[\w-]*$/.test(inside)) {
      const open = openTags(text.slice(0, lt));
      const hasGt = after.slice(wordAfter.length).startsWith('>');
      const items = [...open].reverse().map((t, i) => ({ label: `/${t}`, filter: t, kind: 'tag', insert: hasGt ? `/${t}` : `/${t}>`, detail: i === 0 ? 'fechar' : '', doc: `Fecha o <${t}> aberto.` }));
      const r = rank(items, inside.slice(1));
      return r.length ? { from: lt + 1, to: pos + wordAfter.length, items: r, context: 'close' } : null;
    }
    // ---- <eti… → nome da etiqueta
    if (/^[\w-]*$/.test(inside)) {
      if (!inside && !manual && !before.endsWith('<')) return null;
      const items = Object.entries(HTML_TAGS).map(([t, d]) => ({ label: t, kind: 'tag', insert: t, doc: d }));
      return out(lt + 1, items, 'tag');
    }
    const tm = /^([\w-]+)([\s\S]*)$/.exec(inside);
    if (!tm) return null;
    const tag = tm[1].toLowerCase();
    const rest = tm[2];
    // ---- valor de atributo (entre aspas)
    const vm = /([\w:@.-]+)\s*=\s*(["'])([^"']*)$/.exec(rest);
    if (vm) {
      const attr = vm[1].toLowerCase();
      const word = attr === 'class' || attr === 'rel' ? /[^\s"']*$/.exec(vm[3])[0] : vm[3];
      const valueAfter = /^[^\s"'<>]*/.exec(after)[0];
      let list;
      if (attr === 'class') list = (opts.classes || []).map((c) => ({ label: c, kind: 'class', insert: c, detail: 'classe' }));
      else if (attr === 'for' || attr === 'aria-labelledby' || attr === 'aria-describedby' || attr === 'list') list = (opts.ids || []).map((c) => ({ label: c, kind: 'id', insert: c, detail: 'id' }));
      else list = (ATTR_VALUES[`${tag}.${attr}`] || ATTR_VALUES[attr] || []).map((v) => ({ label: v, kind: 'value', insert: v }));
      if (!word && !manual && !/["']$/.test(vm[0]) && !/\s$/.test(vm[3])) return null;
      const r = rank(list, word);
      return r.length ? { from: pos - word.length, to: pos + valueAfter.length, items: r, context: 'attr-value' } : null;
    }
    if (/=\s*[^\s"'>]*$/.test(rest)) return null; // valor sem aspas
    // ---- nome de atributo
    const am = /\s([\w:@-]*)$/.exec(rest);
    if (!am) return null;
    const word = am[1];
    if (!word && !manual && !/\s$/.test(rest)) return null;
    const used = new Set([...rest.matchAll(/([\w:@-]+)\s*(=|\s|$)/g)].map((x) => x[1].toLowerCase()));
    const hasEq = /^\s*=/.test(after.slice(wordAfter.length));
    const mk = (a, d) => ({
      label: a, kind: 'attr', detail: d || '', doc: d ? `${a}: ${d}` : '',
      insert: hasEq || BOOLEAN_ATTRS.has(a) ? a : a === 'data-' ? `data-${CARET}=""` : `${a}="${CARET}"`,
      retrigger: !hasEq && !BOOLEAN_ATTRS.has(a) && a !== 'data-',
    });
    const items = [...(TAG_ATTRS[tag] || []).map((a) => mk(a, '')), ...GLOBAL_ATTRS.map(([a, d]) => mk(a, d))].filter((it) => !used.has(it.label) || it.label === word);
    return out(pos - word.length, items, 'attr');
  }
  // ---- texto: etiquetas e Emmet
  const lineBefore = before.slice(before.lastIndexOf('\n') + 1);
  const abbr = emmetAbbrBefore(lineBefore);
  if (!abbr) return null;
  const startOfLine = !lineBefore.slice(0, lineBefore.length - abbr.length).replace(/<\/?[a-zA-Z][^<>]*>/g, '').trim();
  if (!startOfLine && !manual) return null;
  const from = pos - abbr.length;
  const indent = /^\s*/.exec(lineBefore)[0];
  if (/^[a-z][\w-]*$/i.test(abbr)) {
    const items = Object.entries(HTML_TAGS)
      .filter(([t]) => t.startsWith(abbr.toLowerCase()) || manual)
      .map(([t, d]) => ({ label: t, kind: 'tag', insert: expandEmmet(t) || t, detail: `<${t}>`, doc: d }));
    const r = rank(items, abbr);
    return r.length ? { from, to: pos, items: r, context: 'tag-text' } : null;
  }
  const exp = expandEmmet(abbr);
  if (!exp) return null;
  return { from, to: pos, items: [{ label: abbr, kind: 'emmet', insert: exp, detail: 'Emmet', doc: exp.replaceAll(CARET, '').split('\n').map((l) => l.replace(indent, '')).join('\n') }], context: 'emmet' };
}

// ================================================================== Emmet
/**
 * Pega a abreviação Emmet logo antes do cursor (ex.: "  ul>li.item*3" → "ul>li.item*3"). Para no espaço (fora de
 * [] e {}) e no fim da última etiqueta HTML da linha. Devolve '' se não houver.
 */
export function emmetAbbrBefore(lineBefore) {
  let start = 0;
  for (const m of lineBefore.matchAll(/<\/?[a-zA-Z][^<>]*>|<!--[\s\S]*?-->/g)) start = m.index + m[0].length;
  const s = lineBefore.slice(start);
  let depth = 0;
  let i = s.length - 1;
  for (; i >= 0; i--) {
    const c = s[i];
    if (c === ']' || c === '}' || c === ')') depth++;
    else if (c === '[' || c === '{' || c === '(') { if (depth === 0) break; depth--; }
    else if (depth === 0 && (/\s/.test(c) || c === '<')) break;
  }
  const abbr = s.slice(i + 1);
  return /^[a-zA-Z.#([]/.test(abbr) ? abbr : '';
}

/** Lê a abreviação e monta a árvore: [{ tag, id, classes, attrs, text, children, count, group }]. Lança erro se inválida. */
export function parseEmmet(src) {
  let i = 0;
  const fail = () => { throw new Error(`Emmet inválido perto de "${src.slice(i)}"`); };
  const readName = () => { const m = /^[a-zA-Z][\w:-]*/.exec(src.slice(i)); if (!m) return ''; i += m[0].length; return m[0]; };
  const readWord = () => { const m = /^[\w$@-]+/.exec(src.slice(i)); if (!m) fail(); i += m[0].length; return m[0]; };
  function element() {
    const node = { tag: readName(), classes: [], attrs: [], children: [], count: 1 };
    let any = !!node.tag;
    for (;;) {
      const c = src[i];
      if (c === '.') { i++; node.classes.push(readWord()); any = true; }
      else if (c === '#') { i++; node.id = readWord(); any = true; }
      else if (c === '[') {
        i++;
        const end = src.indexOf(']', i);
        if (end < 0) fail();
        for (const m of src.slice(i, end).matchAll(/([\w:@.-]+)(?:=("[^"]*"|'[^']*'|[^\s\]]*))?/g)) node.attrs.push([m[1], m[2] === undefined ? null : m[2].replace(/^["']|["']$/g, '')]);
        i = end + 1;
        any = true;
      } else if (c === '{') {
        let d = 0, j = i;
        for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; }
        if (j >= src.length) fail();
        node.text = src.slice(i + 1, j);
        i = j + 1;
        any = true;
      } else break;
    }
    if (!any) fail();
    return node;
  }
  function term() {
    let node;
    if (src[i] === '(') {
      i++;
      node = { group: true, children: expr(), count: 1 };
      if (src[i] !== ')') fail();
      i++;
    } else node = element();
    if (src[i] === '*') {
      i++;
      const m = /^\d+/.exec(src.slice(i));
      if (!m) fail();
      node.count = Math.min(100, +m[0]);
      i += m[0].length;
    }
    return node;
  }
  function expr() {
    const roots = [];
    const stack = [roots];
    for (;;) {
      const node = term();
      stack[stack.length - 1].push(node);
      const op = src[i];
      if (op === '>') { i++; stack.push(node.children); }
      else if (op === '+') i++;
      else if (op === '^') { while (src[i] === '^') { i++; if (stack.length > 1) stack.pop(); } }
      else break;
    }
    return roots;
  }
  const tree = expr();
  if (i !== src.length) fail();
  return tree;
}

/** Etiqueta implícita (quando a abreviação começa com . ou #): li dentro de ul/ol, td em tr, span em linha... */
function implicitTag(parent) {
  if (parent === 'ul' || parent === 'ol' || parent === 'menu') return 'li';
  if (parent === 'table' || parent === 'tbody' || parent === 'thead' || parent === 'tfoot') return 'tr';
  if (parent === 'tr') return 'td';
  if (parent === 'select' || parent === 'optgroup' || parent === 'datalist') return 'option';
  if (INLINE_TAGS.has(parent) || /^(p|h[1-6]|button)$/.test(parent || '')) return 'span';
  return 'div';
}
/** Atributos que já vêm por padrão em algumas etiquetas. */
const DEFAULT_ATTRS = { a: [['href', '']], img: [['src', ''], ['alt', '']], input: [['type', 'text']], label: [['for', '']], form: [['action', '']], iframe: [['src', ''], ['title', '']], video: [['src', '']], source: [['src', '']], button: [['type', 'button']], abbr: [['title', '']] };

/**
 * EXPANDE uma abreviação Emmet em HTML indentado (2 espaços). Suporta etiqueta, .classe, #id, [atributos],
 * {texto}, > (filho), + (irmão), ^ (sobe), *N (repete) com $ numerando, e (grupos). O cursor (CARET) fica no
 * primeiro lugar vazio. Devolve '' se a abreviação for inválida.
 *   expandEmmet('div.card>h2+p') → '<div class="card">\n  <h2>⁁</h2>\n  <p></p>\n</div>'
 */
export function expandEmmet(abbr) {
  let tree;
  try { tree = parseEmmet(abbr.trim()); } catch { return ''; }
  const num = (s, n) => (s == null ? s : s.replace(/\$+/g, (d) => String(n).padStart(d.length, '0')));
  const escAttr = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  // nós "de linha" sem filhos de bloco ficam na mesma linha
  const isInline = (n, parent) => !n.group && INLINE_TAGS.has(n.tag || implicitTag(parent));
  function render(nodes, parentTag, depth, idx) {
    const lines = [];
    for (const n of nodes) {
      for (let k = 1; k <= n.count; k++) {
        const i = n.count > 1 ? k : idx;
        if (n.group) { lines.push(...render(n.children, parentTag, depth, i)); continue; }
        lines.push(renderEl(n, parentTag, depth, i));
      }
    }
    return lines;
  }
  function open(n, tag, i) {
    const attrs = [];
    if (n.id) attrs.push(['id', num(n.id, i)]);
    if (n.classes.length) attrs.push(['class', n.classes.map((c) => num(c, i)).join(' ')]);
    for (const [k, v] of n.attrs) attrs.push([k, v == null ? (BOOLEAN_ATTRS.has(k) ? null : '') : num(v, i)]);
    for (const [k, v] of DEFAULT_ATTRS[tag] || []) if (!attrs.some(([a]) => a === k)) attrs.push([k, v]);
    return `<${tag}${attrs.map(([k, v]) => (v === null ? ` ${k}` : ` ${k}="${v === '' ? CARET : escAttr(v)}"`)).join('')}>`;
  }
  function renderEl(n, parentTag, depth, i) {
    let tag = n.tag || implicitTag(parentTag);
    // input:email, button:submit → etiqueta com type
    const typed = /^(input|button):([\w-]+)$/i.exec(tag);
    if (typed) {
      tag = typed[1].toLowerCase();
      if (!n.attrs.some(([k]) => k === 'type')) n = { ...n, attrs: [['type', typed[2]], ...n.attrs] };
    }
    const pad = '  '.repeat(depth);
    const o = open(n, tag, i);
    if (VOID_TAGS.has(tag)) return pad + o;
    const text = n.text != null ? num(n.text, i) : '';
    if (!n.children.length) return `${pad}${o}${text || CARET}</${tag}>`;
    // filhos todos "de linha" e sem filhos próprios: tudo numa linha
    const flat = n.children.every((c) => isInline(c, tag) && !c.children.length);
    if (flat) return `${pad}${o}${text}${render(n.children, tag, 0, i).join('')}</${tag}>`;
    const inner = render(n.children, tag, depth + 1, i);
    return [`${pad}${o}${text ? text : ''}`, ...inner, `${pad}</${tag}>`].join('\n');
  }
  const out = render(tree, null, 0, 1).join('\n');
  // só o primeiro lugar vazio recebe o cursor
  const first = out.indexOf(CARET);
  return first < 0 ? out : out.slice(0, first + 1) + out.slice(first + 1).replaceAll(CARET, '');
}
