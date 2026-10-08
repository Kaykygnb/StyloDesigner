/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  model.js — MODELO DE DADOS DO DOCUMENTO
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  O QUE É
 *    Define como um documento de design é guardado na memória (e, depois, no navegador e no
 *    arquivo .json da pasta): páginas → árvore de camadas ("nós"). Também tem as funções puras que mexem
 *    nessa árvore (clonar, percorrer, ajustar grupos, aplicar constraints...).
 *
 *  POR QUE É ASSIM
 *    - Tudo é dado simples (objetos/arrays/strings/números): dá para salvar com JSON.stringify,
 *      comparar com === no histórico e testar no Node, sem navegador.
 *    - Os nomes dos campos imitam CSS (gap, padding, justify, align, opacity, blend...). Assim o
 *      editor, o painel e o gerador de código falam a mesma língua e não precisam "traduzir".
 *    - Este arquivo NÃO usa DOM nem `window`. Quem desenha na tela é o canvas.js.
 *
 *  QUEM USA ESTE ARQUIVO
 *    css.js (gera CSS) · store.js (estado) · commands.js/tools.js (edição) · components.js · svg.js
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Gera um id curto (8 caracteres) para camadas, páginas, estilos etc.
 * Usa `crypto.randomUUID` quando existe (todo navegador moderno e Node 19+) e, se não, um
 * fallback com Math.random + data. Colisão é praticamente impossível para o tamanho de um documento.
 */
export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 8);

/**
 * Arredonda `n` para `d` casas decimais (padrão 2).
 * Usado em quase todo lugar onde um número vai para o documento ou para o CSS, para evitar
 * valores como 10.000000000002 que aparecem depois de contas com ponto flutuante.
 * @param {number} n  número a arredondar
 * @param {number} [d=2]  casas decimais
 */
export const round = (n, d = 2) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/**
 * Fontes oferecidas no painel de texto. As 4 últimas (Poppins, DM Sans, Playfair, JetBrains Mono) são
 * carregadas do Google Fonts pelo index.html; sem internet o navegador usa uma fonte do sistema no lugar.
 * O usuário também pode usar qualquer família que esteja instalada no computador dele.
 */
export const FONT_FAMILIES = [
  'Inter', 'system-ui', 'Arial', 'Helvetica', 'Verdana', 'Trebuchet MS', 'Georgia',
  'Times New Roman', 'Courier New', 'Poppins', 'DM Sans', 'Playfair Display', 'JetBrains Mono',
];

/** Pesos de fonte do CSS (`font-weight`) com o nome que o Figma/Penpot usam. Formato: [valor, rótulo]. */
export const FONT_WEIGHTS = [
  [100, 'Thin'], [200, 'Extra Light'], [300, 'Light'], [400, 'Regular'],
  [500, 'Medium'], [600, 'Semi Bold'], [700, 'Bold'], [800, 'Extra Bold'], [900, 'Black'],
];

/** Modos de mesclagem aceitos em `mix-blend-mode` (mesma lista do CSS). 'normal' = sem mesclagem. */
export const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge',
  'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue',
  'saturation', 'color', 'luminosity',
];

/**
 * Nome padrão (em português) de cada tipo de camada. Usado para nomear camadas novas
 * ("Retângulo 3") e como fallback na lista de camadas.
 */
export const TYPE_LABEL = {
  frame: 'Frame', rect: 'Retângulo', ellipse: 'Elipse', text: 'Texto', group: 'Grupo',
  line: 'Linha', path: 'Vetor', section: 'Seção',
};

/**
 * Cria um objeto de PREENCHIMENTO (fill) completo. Um fill guarda os dados de TODOS os tipos ao mesmo
 * tempo, de propósito: assim, ao trocar de "cor sólida" para "gradiente" e voltar, o usuário não perde
 * a cor que tinha escolhido. Só o campo `type` decide qual parte vale.
 *
 *  - type:    'none' | 'solid' | 'linear' | 'radial' | 'image'
 *  - color/opacity: cor sólida (hex #RRGGBB) e opacidade 0..1
 *  - stops:   paradas do gradiente [{ color, opacity, pos(0..100) }]
 *  - angle:   ângulo do gradiente linear em graus (CSS: 0 = para cima, 90 = para a direita)
 *  - assetId/fit: imagem (id em doc.assets) e como encaixa ('cover' | 'contain' | 'fill' | 'size' = tamanho próprio)
 *  - campos OPCIONAIS da imagem (ausente = padrão): posX/posY (posição 0–100%, padrão 50 = centro), size (% da largura da
 *    camada, só no ajuste 'size', padrão 100), repeat ('no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y', só em
 *    'contain'/'size', padrão 'no-repeat') e natW/natH (tamanho original da imagem, para o SVG exportado calcular o ladrilho)
 *  - styleId (opcional): liga a um estilo de cor compartilhado (ver components.js → syncStyles)
 * @param {string} [color='#D9D9D9']  cor sólida inicial
 */
export const defaultFill = (color = '#D9D9D9') => ({
  type: 'solid',
  color,
  opacity: 1,
  stops: [
    { color: '#7C5CFF', opacity: 1, pos: 0 },
    { color: '#2DD4FF', opacity: 1, pos: 100 },
  ],
  angle: 135,
  assetId: null,
  fit: 'cover',
});

/**
 * Contorno (stroke). No CSS vira `outline` (não `border`) porque o outline NÃO altera o layout nem o
 * tamanho da caixa — por isso trocar a espessura não "empurra" os vizinhos num auto layout.
 * `position`: 'inside' | 'center' | 'outside' controla o `outline-offset`.
 */
export const defaultStroke = () => ({ color: '#000000', opacity: 1, width: 1, style: 'solid', position: 'inside' });

/** Sombra (vira `box-shadow`; em textos vira `text-shadow`). `inset` = sombra interna. */
export const defaultShadow = () => ({ x: 0, y: 4, blur: 16, spread: 0, color: '#000000', opacity: 0.25, inset: false });

/**
 * Configuração de auto layout de um FRAME. É literalmente CSS:
 *  - mode: 'none' (filhos livres, position:absolute) | 'row' | 'column' (display:flex) | 'grid' (display:grid)
 *  - gap / colGap / rowGap: espaço entre itens (flex usa `gap`; grid usa colGap e rowGap)
 *  - cols / rows: colunas e linhas do grid (rows 0 = linhas automáticas)
 *  - padding: [topo, direita, baixo, esquerda] — mesma ordem do atalho `padding` do CSS
 *  - justify: justify-content (flex) ou justify-items (grid)
 *  - align:   align-items
 *  - wrap:    flex-wrap: wrap
 */
export const defaultLayout = () => ({
  mode: 'none', // none | row | column (display:flex) | grid (display:grid)
  gap: 8,
  cols: 2, // só no modo grid
  rows: 0, // 0 = linhas automáticas
  colGap: 8,
  rowGap: 8,
  padding: [0, 0, 0, 0], // top right bottom left
  justify: 'flex-start',
  align: 'flex-start',
  wrap: false,
});

/**
 * Cria uma camada ("nó") nova, com todos os campos que qualquer camada tem + os do seu tipo.
 *
 * SISTEMA DE COORDENADAS: `x` e `y` são relativos ao canto superior esquerdo do PAI (ou ao mundo, se for
 * uma camada na raiz da página) e SEM rotação. A rotação gira a caixa em torno do próprio centro.
 *
 * @param {'frame'|'rect'|'ellipse'|'text'|'group'|'line'|'path'|'section'} type  tipo da camada
 * @param {object} [props]  campos que sobrescrevem os padrões (ex.: { x: 10, name: 'Botão' })
 * @returns {object} o nó, já pronto para entrar em `page.children` ou `node.children`
 */
export function createNode(type, props = {}) {
  const node = {
    // --- identidade ---
    // id único (nunca muda; é a chave do índice, da seleção e do histórico)
    id: uid(),
    type,
    name: TYPE_LABEL[type] || type,
    // --- geometria (px). Em auto layout os valores de x/y são ignorados; w/h valem quando o tamanho é 'fixed'
    // e são atualizados com a medida real do DOM quando é 'hug' ou 'fill' (ver canvas.js → measureBack)
    x: 0, y: 0, w: 100, h: 100,
    // rotação em graus, horária, em torno do centro
    rotation: 0,
    // visible=false → display:none (some do canvas e do código exportado); locked=true → não é clicável no canvas
    visible: true,
    locked: false,
    // opacidade 0..1 (CSS opacity) e modo de mesclagem (CSS mix-blend-mode)
    opacity: 1,
    blend: 'normal',
    // aparência: preenchimento, contorno (null = sem contorno), cantos [tl, tr, br, bl] e efeitos
    fill: defaultFill(),
    stroke: null,
    radius: [0, 0, 0, 0],
    shadows: [],
    blur: 0,
    bgBlur: 0,
    // Como a camada calcula o tamanho (como no Figma): 'fixed' = usa w/h; 'hug' = ajusta ao conteúdo (width:auto);
    // 'fill' = preenche o espaço do pai (flex:1 no eixo principal, align-self:stretch no cruzado). 'fill' só faz
    // sentido dentro de um pai com auto layout.
    sizeX: 'fixed', // fixed | hug | fill
    sizeY: 'fixed',
    // true = a camada IGNORA o auto layout do pai e usa x/y (position:absolute) — útil para enfeites e badges
    absolute: false, // true = ignora o auto layout do pai (position:absolute)
    // CSS align-self do item dentro de um auto layout
    alignSelf: 'auto',
    // CSS justify-self do item dentro de um GRID (posição horizontal na célula); 'auto' = herda o justify-items do pai
    justifySelf: 'auto',
    // espelhamento (vira scale(-1, 1) no transform) e trava de proporção ao redimensionar
    flipX: false,
    flipY: false,
    lockRatio: false,
    // Constraints (só valem em frames SEM auto layout): como a camada reage quando o frame pai é redimensionado.
    // h: 'left'|'right'|'leftright'|'center'|'scale'   v: 'top'|'bottom'|'topbottom'|'center'|'scale'
    constraints: { h: 'left', v: 'top' }, // left|right|leftright|center|scale / top|bottom|topbottom|center|scale
    // itens de CSS Grid: quantas colunas/linhas ocupam (grid-column: span N)
    colSpan: 1, // item de grid
    rowSpan: 1,
    // Campos OPCIONAIS (só existem quando o usuário os define; ausente = padrão do CSS):
    //   minW, maxW, minH, maxH — limites de tamanho em px (min-width, max-width, min-height, max-height);
    //   aspect — proporção largura/altura (CSS aspect-ratio), ex.: 1.7778 = 16:9. Veja limitSize/applyLimits/hasAspect.
    //   margin — [topo, direita, baixo, esquerda] em px, só para itens EM FLUXO de um flex/grid (CSS margin);
    //   fx — filtros de cor { brightness, contrast, saturate (%), grayscale (%), hue (°) }, só as chaves fora do padrão
    //   (CSS filter: brightness() contrast() saturate() grayscale() hue-rotate()). Veja css.js → colorFilters.
    //   (texto) wordSpacing — espaço extra entre palavras em px; truncate — 'ellipsis' (uma linha com …) ou 'clamp'
    //   (limita a `lines` linhas, padrão 2): CSS text-overflow / line-clamp. Veja css.js → truncateCss.
    // protótipo: lista de interações da camada (ver present.js)
    interactions: [], // protótipo: [{ trigger:'click', action:'navigate'|'back'|'url', target, transition }]
  };
  // --- campos específicos de cada tipo ---
  if (type === 'frame') {
    node.fill = defaultFill('#FFFFFF');
    node.w = 320; node.h = 240;
    // clip=true → overflow:hidden (o que sai do frame fica cortado)
    node.clip = true;
    // auto layout (flexbox/grid)
    node.layout = defaultLayout();
    // grades de layout: guias visuais de colunas/linhas/quadrícula (não afetam o CSS gerado)
    node.grids = []; // grades de layout (colunas/linhas/quadrículas) só de guia
    node.children = [];
  } else if (type === 'section') {
    // Seção: contêiner de ORGANIZAÇÃO do canvas (como no Figma). Só existe na raiz da página, só guarda frames, não
    // tem auto layout nem corta o conteúdo. No código exportado vira <section>.
    node.w = 800; node.h = 600;
    node.fill = defaultFill('#EDEDED');
    node.children = [];
  } else if (type === 'line') {
    // Linha: uma caixa de 160×12 (a espessura real vem do stroke.width; os 12px extras só facilitam o clique)
    node.w = 160; node.h = 12;
    node.fill = { ...defaultFill(), type: 'none' };
    node.stroke = { ...defaultStroke(), width: 2, color: '#111111' };
  } else if (type === 'path') {
    // Vetor: `points` guarda os pontos do caminho; hin/hout = alças de Bézier (null = ponto de canto).
    // As coordenadas ficam num espaço próprio de tamanho vw×vh (o "viewBox" do SVG); w/h só esticam esse espaço.
    node.points = []; // [{ x, y, hin:{x,y}|null, hout:{x,y}|null }] em coordenadas do viewBox
    node.closed = false;
    node.vw = 100; node.vh = 100;
    node.fill = { ...defaultFill(), type: 'none' };
    node.stroke = { ...defaultStroke(), width: 2, color: '#111111' };
  } else if (type === 'group') {
    // Grupo: só uma caixa que contém filhos. Não tem estilo próprio; o tamanho é sempre recalculado a partir
    // dos filhos (ver fitGroups).
    node.children = [];
    node.fill = { ...defaultFill(), type: 'none' };
  } else if (type === 'text') {
    // Texto: começa com tamanho 'hug' nos dois eixos (a caixa acompanha o texto).
    Object.assign(node, {
      text: 'Texto',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 400,
      fontStyle: 'normal',
      // lineHeight é um multiplicador sem unidade (CSS `line-height: 1.4`); letterSpacing em px
      lineHeight: 1.4,
      letterSpacing: 0,
      textAlign: 'left',
      textDecoration: 'none',
      textTransform: 'none',
      textVAlign: 'top',
      sizeX: 'hug',
      sizeY: 'hug',
      w: 60, h: 22,
      fill: defaultFill('#111111'),
    });
  } else if (type === 'ellipse') {
    node.fill = defaultFill('#D9D9D9');
  }
  // os `props` do chamador vencem os padrões acima
  Object.assign(node, props);
  return node;
}

/** true para camadas que guardam filhos (frame, grupo e seção). */
export const isContainer = (n) => !!n && (n.type === 'frame' || n.type === 'group' || n.type === 'section');

/**
 * "Prancheta" (board): frame no nível de cima, ou seja, na raiz da página OU direto dentro de uma seção. É o que
 * ganha nome flutuante acima do canvas, vira tela no modo Apresentar e não entra em outros frames ao ser arrastado.
 * @param {object} node  a camada
 * @param {object|null} parent  o pai dela (null = raiz da página)
 */
export const isBoard = (node, parent) => !!node && node.type === 'frame' && (!parent || parent.type === 'section');

/** Constraints de uma camada, com padrão (esquerda/topo) para documentos salvos antes desse recurso existir. */
export const constraintsOf = (n) => n.constraints || { h: 'left', v: 'top' };

/** true se o nó é um frame com auto layout ligado (flex ou grid). */
export const hasLayout = (n) => !!n && n.type === 'frame' && n.layout.mode !== 'none';

/**
 * A camada participa do fluxo do auto layout do pai? Se sim, ela é `position: relative` e quem decide a posição
 * é o navegador (flex/grid); se não, é `position: absolute` e usa x/y.
 */
export const isFlow = (node, parent) => hasLayout(parent) && !node.absolute;

/** Cópia profunda via JSON (suficiente: o documento só tem dados simples, sem funções nem datas). */
export const cloneDeep = (v) => JSON.parse(JSON.stringify(v));

// ---------------------------------------------------------------- estados interativos (:hover, :active, :focus)
/**
 * Propriedades VISUAIS que um estado pode sobrescrever (o resto — tamanho, posição, layout — não muda com o mouse).
 * `scale` só existe nos estados (padrão 1): vira `transform: scale()`.
 */
export const STATE_KEYS = ['fill', 'stroke', 'radius', 'shadows', 'blur', 'bgBlur', 'fx', 'opacity', 'blend', 'scale'];
/** Estados disponíveis: [id, rótulo, pseudo-classe CSS]. */
export const STATE_LIST = [['hover', 'Hover', ':hover'], ['active', 'Pressionado', ':active'], ['focus', 'Foco', ':focus-visible']];
/** Valor padrão das chaves que a camada base pode não ter. */
const STATE_DEFAULT = { scale: 1 };

/** Camadas com caixa própria que aceitam estados (grupo, seção e linha não). */
export const canHaveStates = (n) => !!n && n.type !== 'group' && n.type !== 'section' && n.type !== 'line';
/** A camada tem algum estado com sobrescritas? (`which`: um estado específico, ou qualquer um se omitido.) */
export const hasStates = (n, which) => !!n?.states && (which ? Object.keys(n.states[which] || {}).length > 0 : Object.values(n.states).some((o) => Object.keys(o || {}).length));

/**
 * "Visão" de uma camada num ou mais estados: uma cópia rasa dela com as sobrescritas do(s) estado(s) por cima, na
 * ordem dada (como a cascata do CSS: ['hover', 'active'] = hover e depois pressionado por cima). Sem sobrescritas
 * devolve a própria camada. Não altera nada.
 * @param {object} node
 * @param {string|string[]} states
 */
export function stateView(node, states) {
  let v = node;
  for (const s of Array.isArray(states) ? states : [states]) {
    const ov = node.states?.[s];
    if (!ov || !Object.keys(ov).length) continue;
    if (v === node) v = { ...node };
    for (const k of STATE_KEYS) if (ov[k] !== undefined) v[k] = ov[k] === null ? null : cloneDeep(ov[k]);
  }
  return v;
}

/**
 * Edita UM estado de uma camada: roda `fn` num RASCUNHO com os valores visuais do estado e guarda em
 * `node.states[estado]` SÓ o que ficou diferente da camada base (se voltar ao valor base, a sobrescrita some; sem
 * nenhuma, o estado some). É assim que o painel Design edita um estado sem saber que está num estado.
 * @param {object} node  camada real (é alterada)
 * @param {string} state  'hover' | 'active' | 'focus'
 * @param {(draft: object) => void} fn  recebe o rascunho (mexa só nas chaves de STATE_KEYS)
 */
export function editState(node, state, fn) {
  const view = stateView(node, state);
  const draft = { ...node };
  for (const k of STATE_KEYS) {
    const val = view[k] ?? STATE_DEFAULT[k];
    draft[k] = val === undefined || val === null ? val : cloneDeep(val);
  }
  fn(draft);
  const ov = { ...(node.states?.[state] || {}) };
  for (const k of STATE_KEYS) {
    let val = draft[k];
    if (val === undefined) val = k === 'fx' ? {} : STATE_DEFAULT[k] ?? null; // "sem valor" também é um valor a sobrescrever
    const base = node[k] ?? STATE_DEFAULT[k] ?? (k === 'fx' ? {} : null);
    if (JSON.stringify(val) === JSON.stringify(base)) delete ov[k]; else ov[k] = val;
  }
  const states = { ...(node.states || {}) };
  if (Object.keys(ov).length) states[state] = ov; else delete states[state];
  if (Object.keys(states).length) node.states = states; else delete node.states;
}

/** Clona uma camada e TODOS os descendentes, gerando ids novos (usado em duplicar, copiar/colar e Alt+arrastar). */
export function cloneNode(node) {
  const copy = cloneDeep(node);
  const reid = (n) => {
    n.id = uid();
    n.children?.forEach(reid);
  };
  reid(copy);
  return copy;
}

/**
 * Percorre a árvore de camadas em profundidade.
 * @param {object[]} list  lista de nós (ex.: page.children)
 * @param {(node, parent, list, index) => (void|false)} fn  chamada para cada nó; retornar `false` NÃO desce nos filhos dele
 * @param {object|null} [parent]  pai da lista (null na raiz)
 */
export function walk(list, fn, parent = null) {
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    if (fn(n, parent, list, i) === false) continue;
    if (n.children) walk(n.children, fn, n);
  }
}

/** Cria uma página vazia. `guides` guarda as guias de régua (posições em px do mundo). */
export function makePage(name = 'Página 1') {
  return { id: uid(), name, children: [], guides: [] };
}

/**
 * Documento vazio. Estrutura completa:
 *  { version, name,
 *    pages:  [{ id, name, children: [camadas], guides: [{axis:'x'|'y', pos}] }],
 *    assets: { [assetId]: 'data:image/...' }   // imagens ficam FORA das páginas para não pesarem no histórico
 *    styles: { colors: [...], texts: [...] } } // estilos compartilhados de cor e texto
 */
export function makeDoc() {
  return { version: 1, name: 'Sem título', pages: [makePage()], assets: {}, styles: { colors: [], texts: [] } };
}

/** Gera o próximo nome livre para o tipo ("Retângulo 1", "Retângulo 2"...), contando as camadas do mesmo tipo na página. */
export function nextName(page, type) {
  // MAIOR número já usado + 1 (e não "quantos existem + 1"): se um "Retângulo 1" virou frame ou foi apagado, contar
  // daria um nome repetido ("Retângulo 4" duas vezes)
  const label = TYPE_LABEL[type] || type;
  const re = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`);
  let max = 0;
  walk(page.children, (n) => {
    const m = re.exec(n.name || '');
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `${label} ${max + 1}`;
}

/**
 * Ajusta cada GRUPO ao retângulo que envolve seus filhos e remove grupos vazios.
 * Como um grupo não tem tamanho próprio, depois de mover/redimensionar um filho a caixa do grupo precisa ser
 * recalculada. Roda no fim de cada gesto (em `store.commit`), não durante o arrasto, para não "mexer o chão"
 * debaixo do ponteiro. As coordenadas dos filhos são relativas ao grupo, então ao mover a origem do grupo
 * subtraímos o mesmo valor dos filhos (a posição visual não muda).
 * @param {object[]} list  lista de nós a processar (recursivo)
 */
export function fitGroups(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    const n = list[i];
    if (!n.children) continue;
    fitGroups(n.children);
    if (n.type !== 'group') continue;
    if (!n.children.length) {
      list.splice(i, 1);
      continue;
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of n.children) {
      x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y);
      x1 = Math.max(x1, c.x + c.w); y1 = Math.max(y1, c.y + c.h);
    }
    if (x0 !== 0 || y0 !== 0) {
      for (const c of n.children) { c.x -= x0; c.y -= y0; }
      n.x += x0; n.y += y0;
    }
    n.w = round(x1 - x0);
    n.h = round(y1 - y0);
  }
}

/**
 * Aplica as CONSTRAINTS dos filhos depois que o frame mudou de tamanho (de ow×oh para frame.w×frame.h).
 * Por eixo, cada filho escolhe: colar no início (padrão), colar no fim (right/bottom), esticar entre as duas
 * bordas (leftright/topbottom), manter o centro ou escalar proporcionalmente.
 * Não faz nada em frames com auto layout (aí quem manda é o CSS). É recursivo: se um filho mudou de tamanho,
 * os filhos dele reagem também.
 * @param {object} frame  frame JÁ com o tamanho novo
 * @param {number} ow  largura antiga
 * @param {number} oh  altura antiga
 */
export function applyConstraints(frame, ow, oh) {
  if (!frame.children || hasLayout(frame) || (frame.w === ow && frame.h === oh)) return;
  const dw = frame.w - ow, dh = frame.h - oh;
  const sx = ow ? frame.w / ow : 1, sy = oh ? frame.h / oh : 1;
  for (const c of frame.children) {
    const cw = c.w, ch = c.h;
    const { h, v } = constraintsOf(c);
    if (h === 'right') c.x += dw;
    else if (h === 'leftright') c.w = Math.max(1, c.w + dw);
    else if (h === 'center') c.x += dw / 2;
    else if (h === 'scale') { c.x *= sx; c.w = Math.max(1, c.w * sx); }
    if (v === 'bottom') c.y += dh;
    else if (v === 'topbottom') c.h = Math.max(1, c.h + dh);
    else if (v === 'center') c.y += dh / 2;
    else if (v === 'scale') { c.y *= sy; c.h = Math.max(1, c.h * sy); }
    c.x = round(c.x); c.y = round(c.y); c.w = round(c.w); c.h = round(c.h);
    if (c.w !== cw || c.h !== ch) {
      if (c.type === 'group') c.children.forEach((k) => scaleNode(k, c.w / cw, c.h / ch));
      else applyConstraints(c, cw, ch);
    }
  }
}

/**
 * Tipos de camada que têm uma caixa CSS de verdade para receber limites de tamanho e proporção: grupos não têm
 * tamanho próprio (a caixa é recalculada dos filhos) e a linha é só uma barra.
 */
export const hasSizeLimits = (n) => !!n && n.type !== 'group' && n.type !== 'line';

/** A camada tem proporção (aspect-ratio) ligada? Texto, grupo e linha não usam. */
export const hasAspect = (n) => !!n && n.aspect > 0 && n.type !== 'text' && n.type !== 'group' && n.type !== 'line';

/**
 * Ajusta (w, h) aos LIMITES da camada: campos opcionais `minW`, `maxW`, `minH`, `maxH` em px (ausentes = sem
 * limite). Como no CSS, o mínimo vence o máximo quando os dois se contradizem.
 * @returns {[number, number]} largura e altura já limitadas
 */
export function limitSize(n, w, h) {
  const clampTo = (v, lo, hi) => {
    if (hi > 0 && v > hi) v = hi;
    if (lo > 0 && v < lo) v = lo;
    return v;
  };
  return [clampTo(w, n.minW, n.maxW), clampTo(h, n.minH, n.maxH)];
}

/**
 * Aplica os limites ao tamanho JÁ guardado, só nos eixos de tamanho FIXO (os eixos hug/fill quem decide é o
 * navegador, e o canvas mede de volta). Se mudou, os filhos reagem como em qualquer redimensionamento (constraints).
 */
export function applyLimits(n) {
  const ow = n.w, oh = n.h;
  const [w, h] = limitSize(n, ow, oh);
  if (n.sizeX === 'fixed') n.w = Math.max(1, round(w));
  if (n.sizeY === 'fixed') n.h = Math.max(1, round(h));
  if (n.w !== ow || n.h !== oh) applyConstraints(n, ow, oh);
}

/**
 * Redimensiona UMA camada de forma "inteligente": respeita "travar proporção", marca o eixo como 'fixed' e
 * propaga o efeito para dentro (escala os filhos de um grupo; aplica constraints nos filhos de um frame).
 * @param {object} n  camada
 * @param {number} nw  nova largura
 * @param {number} nh  nova altura
 * @param {'w'|'h'} [axis='w']  qual campo o usuário editou (importa para a trava de proporção)
 */
export function resizeNode(n, nw, nh, axis = 'w') {
  const ow = n.w, oh = n.h;
  // PROPORÇÃO do CSS (aspect-ratio): manda no outro eixo; senão vale "travar proporção" (a razão de antes)
  const ratio = hasAspect(n) ? n.aspect : 0;
  if (ratio) {
    if (axis === 'w') nh = nw / ratio;
    else nw = nh * ratio;
  } else if (n.lockRatio && ow && oh) {
    if (axis === 'w') nh = (nw * oh) / ow;
    else nw = (nh * ow) / oh;
  }
  // limites min/max (CSS): vencem a proporção; depois do corte, o outro eixo SEGUE a proporção de novo (como o CSS faz
  // com a altura "auto" quando a largura bate no max-width) e é limitado mais uma vez
  [nw, nh] = limitSize(n, nw, nh);
  if (ratio) {
    if (axis === 'w') nh = nw / ratio; else nw = nh * ratio;
    [nw, nh] = limitSize(n, nw, nh);
  }
  n.w = Math.max(1, round(nw));
  n.h = Math.max(1, round(nh));
  if (axis === 'w' || (n.lockRatio && !ratio)) n.sizeX = 'fixed';
  if (axis === 'h' || (n.lockRatio && !ratio)) n.sizeY = 'fixed';
  if (n.type === 'group') n.children.forEach((k) => scaleNode(k, n.w / ow, n.h / oh));
  else applyConstraints(n, ow, oh);
}

/**
 * Escala uma camada e (se for grupo) todos os filhos por (sx, sy), multiplicando posição e tamanho.
 * Usado ao redimensionar grupos e seleções múltiplas. Textos viram 'fixed' na largura (senão voltariam ao
 * tamanho natural no render).
 */
export function scaleNode(node, sx, sy) {
  node.x = round(node.x * sx);
  node.y = round(node.y * sy);
  node.w = Math.max(1, round(node.w * sx));
  node.h = Math.max(1, round(node.h * sy));
  if (node.type === 'text') {
    node.sizeX = 'fixed';
  }
  if (node.type === 'group') {
    node.children.forEach((c) => scaleNode(c, sx, sy));
  }
}

/**
 * Transforma um nome em "slug" seguro para classe CSS e nome de arquivo: tira acentos, deixa minúsculo e troca
 * qualquer coisa fora de a-z/0-9 por '-'. "Botão primário" → "botao-primario". Vazio vira 'item'.
 */
export const slugify = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
